/**
 * @module sidepanel/hooks/useGroupAccessGrants
 * @description Loads what membership in a group actually grants: the apps it is
 * assigned to, and the admin roles it carries for every member.
 *
 * The Group Detail view already answers *where members come from*
 * ({@link sidepanel/hooks/useGroupSource.useGroupSource}) and *what rules touch
 * it* ({@link sidepanel/hooks/useGroupRuleReferences.useGroupRuleReferences}), but
 * never *what membership does* — this hook is the third axis, sibling in shape to
 * both: gated on `isActive` via {@link useOwedLoad} exactly like
 * {@link sidepanel/hooks/useGroupRuleReferences.useGroupRuleReferences}
 * (ADR-0018/0026, no hidden tab may issue API traffic).
 *
 * Cost: exactly two requests per open — `GET /api/v1/groups/{id}/apps?limit=200`
 * and `GET /api/v1/groups/{id}/roles` — both walked with
 * {@link fetchAllPages} rather than a hand-rolled `Link` loop, though in practice
 * neither endpoint returns more than one page for a single group. Read-only.
 *
 * ## Why the two axes have different failure shapes
 *
 * `GET /api/v1/groups/{id}/apps` is a routine list read: a failure is
 * surfaced as a real error (`appsStatus: 'error'`), because it answers the
 * primary question this hook exists for.
 *
 * `GET /api/v1/groups/{id}/roles` **commonly 403s for a non-super-admin
 * session** — that is an expected permission gap, not a failure, so it never
 * fails the view. It degrades to `rolesStatus: 'unavailable'`, which the caller
 * renders as a *hidden* subsection rather than an alert. That is deliberately
 * distinct from `rolesStatus: 'available'` with an empty list — a confirmed
 * "this group carries no admin role" — because collapsing "couldn't read" into
 * "no roles" would misreport a permission gap as a confirmed absence of admin
 * access.
 */

import { useRef, useState } from 'react';
import { z } from 'zod';
import { useOwedLoad } from './useOwedLoad';
import { useOktaApi } from './useOktaApi';
import { fetchAllPages, OKTA_PAGE_SIZE } from '../../shared/utils/oktaPagination';
import { oktaAppListItemSchema } from '../../shared/schemas/okta';
import { createLogger } from '../../shared/utils/logger';
import type { SourceStatus } from './useGroupSource';

const log = createLogger('useGroupAccessGrants');

/**
 * One app this group is assigned to, reduced to what the view shows.
 *
 * Validated leniently against {@link oktaAppListItemSchema} — only `id` is
 * required, per ADR-0006 — so an app row missing every optional field still
 * renders (with an id-derived fallback label) instead of vanishing.
 */
export interface AppGrant {
  /** Okta app id, used for the {@link EntityLink} deep link into the Apps tab. */
  id: string;
  /** Display label. */
  label: string;
  /**
   * Okta lifecycle status (`ACTIVE`, `INACTIVE`, …), when the row reported one.
   *
   * Optional because `oktaAppListItemSchema` catches every field past the id:
   * a row Okta sends an unexpected value for degrades to "not reported" rather
   * than being dropped, which would cost the caller a whole application. So
   * absent here is genuinely unknown, and a consumer must render nothing rather
   * than an "Unknown" badge.
   */
  status?: string;
  /** Sign-on mode, when the row reported one. Same optionality contract as {@link status}. */
  signOnMode?: string;
  /** When Okta last updated the app, when the row reported a parseable date. */
  lastUpdated?: Date;
}

/**
 * One admin role granted to every member of this group.
 *
 * Deliberately does **not** carry a resource scope: `GET
 * /api/v1/groups/{id}/roles` reports the role type but not which apps or
 * groups it applies to, so there is nothing accurate to attach here. The
 * caller must render this as "a role is granted," never as a fully-resolved
 * permission — see the module doc.
 */
export interface RoleGrant {
  /** Okta role assignment id. Not a navigable entity — roles have no detail view. */
  id: string;
  /** Role type label (e.g. "Application Administrator"). */
  label: string;
}

/**
 * Whether the admin-roles read could be completed.
 *
 * - `'loading'` — the request is in flight.
 * - `'available'` — the read succeeded; `roles` is the confirmed (possibly
 *   empty) list.
 * - `'unavailable'` — the read failed (most commonly a `403` for a
 *   non-super-admin session). `roles` is `[]`, but that is **not** the same
 *   claim as `'available'` with an empty list — see the module doc.
 */
export type RolesReadStatus = 'loading' | 'available' | 'unavailable';

/**
 * Lenient row schema for `GET /api/v1/groups/{id}/roles` (ADR-0006). Only `id`
 * is required; `label` and `type` are optional and unknown fields
 * `.passthrough()`, following the {@link oktaAppListItemSchema} precedent —
 * Okta's role-assignment payload is not a stable contract this view should
 * depend on beyond the two fields it actually reads.
 */
const oktaGroupRoleRowSchema = z
  .object({
    id: z.string(),
    label: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

/** Return shape of {@link useGroupAccessGrants}. */
export interface UseGroupAccessGrantsReturn {
  /** Apps this group is assigned to. */
  apps: AppGrant[];
  /** Status of the app-assignment read. */
  appsStatus: SourceStatus;
  /** Error message when the app-assignment read failed. */
  appsError: string | null;
  /** Admin roles granted to every member of this group. */
  roles: RoleGrant[];
  /** Whether the admin-roles read could be completed. See {@link RolesReadStatus}. */
  rolesStatus: RolesReadStatus;
}

/**
 * Reduce a validated app-list row to what the view renders.
 *
 * Keeps the three descriptive fields `oktaAppListItemSchema` was already
 * validating and this function used to discard. They cost nothing — the same
 * response carried them — and they are what lets the Access tab render an app
 * row rather than a chip.
 */
function toAppGrant(app: {
  id: string;
  label?: string;
  name?: string;
  status?: string;
  signOnMode?: string;
  lastUpdated?: string | null;
}): AppGrant {
  // An unparseable timestamp is dropped, never surfaced as `Invalid Date`.
  const lastUpdated = app.lastUpdated ? new Date(app.lastUpdated) : undefined;
  return {
    id: app.id,
    label: app.label ?? app.name ?? app.id,
    status: app.status,
    signOnMode: app.signOnMode,
    lastUpdated: lastUpdated && !Number.isNaN(lastUpdated.getTime()) ? lastUpdated : undefined,
  };
}

/** Reduce a validated role row to what the view renders. */
function toRoleGrant(role: { id: string; label?: string; type?: string }): RoleGrant {
  return { id: role.id, label: role.label ?? role.type ?? 'Admin role' };
}

/**
 * Resolve what membership in a group grants: the apps it is assigned to, plus
 * any admin roles it carries.
 *
 * @param groupId - Group to look up.
 * @param targetTabId - Connected Okta tab id (the load no-ops when absent).
 * @param enabled - Whether the hosting tab is the visible one. The Group Detail
 *   view stays mounted while another top-level tab is selected, and a new
 *   `targetTabId` re-arms the load — so while this is `false` the load is
 *   **deferred, not dropped**, and runs once the view is on screen again.
 *   Defaults to `true`.
 * @returns The apps and roles axes, each with its own status — see
 *   {@link UseGroupAccessGrantsReturn}.
 */
export function useGroupAccessGrants(
  groupId: string,
  targetTabId?: number,
  enabled = true,
): UseGroupAccessGrantsReturn {
  const api = useOktaApi({ targetTabId: targetTabId ?? null });
  const { makeApiRequest } = api;

  const [apps, setApps] = useState<AppGrant[]>([]);
  const [appsStatus, setAppsStatus] = useState<SourceStatus>('loading');
  const [appsError, setAppsError] = useState<string | null>(null);

  const [roles, setRoles] = useState<RoleGrant[]>([]);
  const [rolesStatus, setRolesStatus] = useState<RolesReadStatus>('loading');

  // Guards a stale load (the view switched groups mid-flight) from writing state.
  const runIdRef = useRef(0);

  // Reset to the loading state during render when the group changes — the React
  // derive-state-from-props pattern, so the caller never paints one group's grants
  // under another group's heading. Doing it in an effect would both flash the
  // stale list and trip `react-hooks/set-state-in-effect`.
  const [lastGroupId, setLastGroupId] = useState(groupId);
  if (groupId !== lastGroupId) {
    setLastGroupId(groupId);
    setApps([]);
    setAppsStatus('loading');
    setAppsError(null);
    setRoles([]);
    setRolesStatus('loading');
  }

  // A load is owed whenever the group or the API target changes, and is paid the
  // next time the view is visible.
  useOwedLoad(targetTabId == null ? groupId : `${targetTabId}:${groupId}`, enabled, () => {
    const runId = ++runIdRef.current;

    fetchAllPages(
      (url) => makeApiRequest(url, { reason: 'Load group app assignments' }),
      `/api/v1/groups/${groupId}/apps?limit=${OKTA_PAGE_SIZE}`,
      {
        schema: oktaAppListItemSchema,
        context: 'GET /api/v1/groups/{id}/apps',
      },
    )
      .then((items) => {
        if (runId !== runIdRef.current) return;
        setApps(items.map(toAppGrant));
        setAppsStatus('done');
      })
      .catch((err) => {
        if (runId !== runIdRef.current) return;
        log.error('Failed to load group app assignments:', err);
        setAppsError(err instanceof Error ? err.message : 'Failed to load app assignments');
        setAppsStatus('error');
      });

    fetchAllPages(
      (url) => makeApiRequest(url, { reason: 'Load group admin roles' }),
      `/api/v1/groups/${groupId}/roles`,
      {
        schema: oktaGroupRoleRowSchema,
        context: 'GET /api/v1/groups/{id}/roles',
      },
    )
      .then((items) => {
        if (runId !== runIdRef.current) return;
        setRoles(items.map(toRoleGrant));
        setRolesStatus('available');
      })
      .catch((err) => {
        if (runId !== runIdRef.current) return;
        // Degrade to hidden rather than failing the view: a 403 here is an
        // expected outcome for a non-super-admin session, not an exceptional
        // one, so this logs at debug rather than error. Identifier only —
        // never the response body.
        log.debug('Group admin-roles read unavailable (degrading to hidden)', {
          groupId,
          message: err instanceof Error ? err.message : String(err),
        });
        setRoles([]);
        setRolesStatus('unavailable');
      });
  });

  return { apps, appsStatus, appsError, roles, rolesStatus };
}
