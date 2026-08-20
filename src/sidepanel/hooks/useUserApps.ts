/**
 * @module sidepanel/hooks/useUserApps
 * @description Loads one user's app assignments for the Users tab's Apps pane, and names the group behind each one.
 *
 * ## The group is named on load, and it costs nothing
 *
 * `getUserApps` already asks `GET /api/v1/apps?filter=user.id eq "{id}"` with
 * `expand=user/{id}`, and Okta names the granting group in that embed's
 * `_links.group.href`. The panel used to parse it away and then offer a per-row
 * "name the group" button for an answer it had already been handed. So every
 * `grantGroupId` this hook returns from the primary walk rides the **same
 * requests** the app list itself costs — no fan-out, no button.
 *
 * ## The fallback, and why it is visible
 *
 * Some rows come back with no group in the embed. For those — and **only** those,
 * where the scope is `'GROUP'` so we know a group is involved — this hook walks
 * `appOperations.getAppGroupAssignments` and intersects the app's assigned groups
 * with the user's memberships. That is one paginated walk *per unresolved app*:
 * linear in app count, exactly the cost ADR-0031 gated the per-membership proof
 * behind. Here it runs, but never silently — it goes through
 * `coreApi.runOperation` (ADR-0009), so it appears in the ActivityBar with live
 * counts and a working Cancel, and the resolved count is logged. A fallback that
 * ran invisibly would read to an admin as if the answer were free.
 *
 * Each walk is cached under `cacheKeys.appGroups(appId)` at {@link TTL_LONG}, so
 * a second visit to the pane costs nothing at all.
 *
 * ## What it refuses to conclude
 *
 * - An intersection with **more than one** member group narrows the candidates
 *   without naming the grantor, so the row stays unresolved. Picking one would be
 *   an attribution invented here (ADR-0020).
 * - A failed walk (`null`) is not an empty one. Neither becomes "no group path".
 * - A partial primary walk surfaces as `complete: false` rather than as a shorter
 *   list, because a transport failure rendered as "fewer apps" is a confident
 *   wrong statement about someone's access.
 *
 * App labels, group names and `_links` hrefs are end-user-controllable Okta data
 * and are **never** logged — this module logs identifiers and counts only.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useOktaApi } from './useOktaApi';
import { useEntityQuery } from '../cache/useEntityQuery';
import { getOrFetch } from '../cache/entityCache';
import { cacheKeys, TTL_LONG } from '../cache/keys';
import { createLogger } from '../../shared/utils/logger';
import { summarizeAppSources, indexAppsByGroup } from '../components/users/appSourceSummary';
import type { AppsByGroupId } from '../components/users/appSourceSummary';
import type { GroupMembership } from '../../shared/types';
import type { UserAppAssignment, UserAppsResult } from './useOktaApi/userOperations';

const log = createLogger('useUserApps');

/** Inputs to {@link useUserApps} beyond the user id. */
export interface UseUserAppsOptions {
  /** Tab whose content script holds the live Okta session. */
  targetTabId: number | null;
  /**
   * The user's group memberships, as the detail rung already holds them.
   *
   * Taken as an argument rather than fetched: this hook must not issue a second
   * `GET /api/v1/users/{id}/groups` for data one level up already has, and a
   * second copy could disagree with the Groups pane about the same membership.
   * They are used only to *name* a group Okta already credited, to explain how
   * that group was itself granted, and to narrow the fallback's candidates —
   * never to infer a source Okta did not report.
   */
  memberships: GroupMembership[];
  /**
   * Whether the Apps pane is the visible one. Defaults to `true` so a story or a
   * standalone render is unaffected.
   *
   * This is the **deferred re-arm** gate from `docs/state-management.md`:
   * `enabled` sits in the guard *and* in the dependency array of the effects
   * below, so entering the pane late runs the work that was deferred rather than
   * dropping it. It does not turn a return to the pane into a refetch — the
   * entity cache serves a fresh entry with no request, and the fallback latches
   * per app set.
   */
  enabled?: boolean;
}

/** What {@link useUserApps} returns. */
export interface UseUserAppsResult {
  /**
   * The user's assignments, with `grantGroupId` filled in wherever it is known —
   * from the zero-cost embed, or from a fallback walk that has since resolved.
   */
  apps: UserAppAssignment[];
  /** `true` while the app list is loading with nothing cached to show. */
  isLoading: boolean;
  /** Message from the last failed load, or `null`. */
  error: string | null;
  /**
   * `false` when the pagination walk did not finish, so the list is short by an
   * unknown amount. The pane must say so rather than presenting a partial walk as
   * a complete answer. `true` before anything has loaded, since nothing has
   * failed yet.
   */
  complete: boolean;
  /**
   * Whether a walk has actually returned.
   *
   * `apps.length` cannot answer "how many apps does this user have?", because an
   * empty array means *either* nothing has loaded yet *or* the walk finished and
   * the user genuinely has none. A consumer that collapses the two either flashes
   * a `0` it has not earned or permanently hides a real zero — ADR-0032 §2a says
   * omit a fact you cannot answer, but a loaded zero **is** an answer. This is
   * what tells them apart.
   */
  hasLoaded: boolean;
  /**
   * Group id → the labels of the apps this user gets through that group — the
   * inverse of the pane, for the Groups pane's `Also grants:` line.
   *
   * Only groups Okta actually credited appear; a row whose source is unknown is
   * filed under nothing.
   */
  appsByGroupId: AppsByGroupId;
  /**
   * `true` while the granting-group fallback is walking. The work is already
   * visible in the ActivityBar; this lets the pane caveat the rows it has not
   * finished resolving.
   */
  isResolvingSources: boolean;
}

/** Rows the embed left unnamed but which Okta says came from *some* group. */
function unresolvedGroupApps(apps: UserAppAssignment[]): UserAppAssignment[] {
  // `scope === 'GROUP'` is the whole filter on purpose. A row with no scope at
  // all is unknown — spending a walk to narrow candidates for an assignment Okta
  // never said was group-granted would be paying for a guess.
  return apps.filter((app) => app.grantGroupId === undefined && app.scope === 'GROUP');
}

/**
 * Load a user's apps and name the group behind each assignment.
 *
 * @param userId - The user whose apps to list, or `null` when no user is open.
 * @param options - See {@link UseUserAppsOptions}.
 * @returns See {@link UseUserAppsResult}.
 */
export function useUserApps(
  userId: string | null,
  { targetTabId, memberships, enabled = true }: UseUserAppsOptions,
): UseUserAppsResult {
  const { getUserApps, getAppGroupAssignments, runOperation } = useOktaApi({ targetTabId });

  // Group ids resolved by the fallback, keyed by app id. Held beside the cached
  // list rather than written into it: the cached value is what Okta returned, and
  // a derived narrowing must not masquerade as part of that response.
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [isResolvingSources, setIsResolvingSources] = useState(false);

  const query = useEntityQuery<UserAppsResult>(
    cacheKeys.userApps(userId ?? 'none'),
    () => getUserApps(userId as string),
    // A null user id can never fetch, whatever the pane is doing.
    { enabled: enabled && Boolean(userId) },
  );

  const data = query.data;

  // The fallback is latched per (user, app set) so returning to the pane replays
  // nothing: the second visit reads the same latch, and the underlying walks are
  // cached at TTL_LONG anyway.
  const attemptedRef = useRef<string | null>(null);

  // A fresh user starts from no derived answers; keeping the previous user's
  // would file one person's apps under another's groups.
  useEffect(() => {
    setResolved({});
    attemptedRef.current = null;
  }, [userId]);

  // Read through refs so the operation effect keys on the *inputs* (which apps
  // need resolving) rather than on identities that change every render — a fresh
  // `memberships` array or a rebuilt api object must not re-arm a fan-out.
  //
  // Assigned during render, the same deliberate exception `useGroupMembersCache`
  // documents: an effect would lag by one commit, so a walk fired in the commit
  // that first produced work would intersect against the *previous* render's
  // memberships. That is a wrong answer, not a stale one.
  const membershipIdsRef = useRef<string[]>([]);
  // eslint-disable-next-line react-hooks/refs
  membershipIdsRef.current = memberships.map((m) => m.group.id);
  const apiRef = useRef({ getAppGroupAssignments, runOperation });
  // eslint-disable-next-line react-hooks/refs
  apiRef.current = { getAppGroupAssignments, runOperation };

  const pending = useMemo(() => (data ? unresolvedGroupApps(data.apps) : []), [data]);
  // Identity of the work, not of the array: a re-render with the same apps must
  // not re-arm the effect.
  const pendingKey = pending.map((app) => app.id).join(',');

  useEffect(() => {
    // `enabled` is in the guard AND the dependency array — the deferred re-arm.
    // Entering the pane later runs this; it is not dropped, and it is not redone.
    if (!enabled || !userId || pendingKey === '') return;

    const latch = `${userId}:${pendingKey}`;
    if (attemptedRef.current === latch) return;
    attemptedRef.current = latch;

    const appIds = pendingKey.split(',');
    const memberGroupIds = new Set(membershipIdsRef.current);
    let cancelled = false;

    setIsResolvingSources(true);

    // ADR-0009: one tracked, cancellable operation rather than N loose promises,
    // so the cost of a walk that is linear in app count is on screen while it is
    // being spent.
    apiRef.current
      .runOperation<string, [string, string] | null>(
        'Name the groups granting these apps',
        appIds,
        async (appId) => {
          const groupIds = await getOrFetch<string[] | null>(
            cacheKeys.appGroups(appId),
            () => apiRef.current.getAppGroupAssignments(appId),
            { ttl: TTL_LONG },
          );
          // `null` is "the walk failed", `[]` is "Okta says no groups". Neither
          // is an answer about this user, and neither becomes one here.
          if (!groupIds) return null;

          const candidates = groupIds.filter((id) => memberGroupIds.has(id));
          // Exactly one shared group names the grantor. Two or more narrows the
          // candidates without resolving them, and choosing between them would be
          // an attribution invented in the client (ADR-0020).
          return candidates.length === 1 ? [appId, candidates[0]] : null;
        },
        { message: ({ completed, total }) => `Naming granting groups (${completed}/${total})` },
      )
      .then((outcome) => {
        if (cancelled) return;
        const named: Record<string, string> = {};
        for (const result of outcome.results) {
          if (result.status === 'fulfilled' && result.value) {
            named[result.value[0]] = result.value[1];
          }
        }
        setResolved((prev) => ({ ...prev, ...named }));
        // Counts and outcomes only — never an app label, a group name or an href.
        log.info('granting-group fallback finished', {
          code: 'user_apps_grant_group_fallback',
          attempted: outcome.total,
          resolved: Object.keys(named).length,
          failed: outcome.failed,
          cancelled: outcome.cancelled,
        });
      })
      .finally(() => {
        if (!cancelled) setIsResolvingSources(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, userId, pendingKey]);

  const apps = useMemo(() => {
    if (!data) return [];
    if (Object.keys(resolved).length === 0) return data.apps;
    return data.apps.map((app) =>
      app.grantGroupId === undefined && resolved[app.id]
        ? { ...app, grantGroupId: resolved[app.id] }
        : app,
    );
  }, [data, resolved]);

  const appsByGroupId = useMemo(
    () => indexAppsByGroup(summarizeAppSources(apps, memberships).rows),
    [apps, memberships],
  );

  return {
    apps,
    isLoading: query.isLoading,
    error: query.error,
    // A walk has returned. Not `apps.length > 0` — see UseUserAppsResult.
    hasLoaded: data !== null,
    // Nothing loaded yet is not a failed walk: `true` until a walk says otherwise.
    complete: data ? data.complete : true,
    appsByGroupId,
    isResolvingSources,
  };
}

/** Re-exported so a consumer types its `Also grants:` map without a deep import. */
export type { AppsByGroupId };
