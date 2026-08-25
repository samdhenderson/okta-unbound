/**
 * @module sidepanel/components/groups/detail/GroupAccessSection
 * @description "What does membership in this group actually buy?" — the apps
 * this group is assigned to, plus any admin roles it grants to every member.
 *
 * The Group Detail view answers where members come from
 * ({@link GroupMembersSection}) and what rules touch the group
 * ({@link GroupRulesSection}), but never what membership *does* until this
 * section: the two grant axes surfaced by
 * {@link sidepanel/hooks/useGroupAccessGrants.useGroupAccessGrants}.
 *
 * Presentational: the caller owns
 * {@link sidepanel/hooks/useGroupAccessGrants.useGroupAccessGrants} and passes
 * its state through, so this component can be storied in every state without a
 * network.
 *
 * ## Roles carry a caveat, never a bare claim
 *
 * `GET /api/v1/groups/{id}/roles` reports which role *type* is granted but not
 * which apps or groups it is scoped to — so printing the bare role name would
 * overstate what is actually known. Each role is rendered as a plain
 * {@link Badge} labelled "role assigned (scope not shown)" rather than as a
 * fully-resolved permission.
 *
 * ## Apps are rows, not chips
 *
 * Each assigned app used to be a 24px `EntityLink` pill carrying a label and
 * nothing else — a reader could not tell an `ACTIVE` SAML app from a deactivated
 * bookmark without leaving the page. {@link GroupAppRow} is the same disclosure
 * shape the Users tab's app list and the roster's member rows use, fed by the
 * pure {@link module:sidepanel/components/groups/groupAppSource}. It costs no
 * extra request: `GET /api/v1/groups/{id}/apps` already returned the status,
 * sign-on mode and timestamps this list was discarding at the boundary.
 *
 * Push mappings are joined in as an **annotation** on the apps that appear here.
 * {@link GroupPushSection} stays, and stays authoritative: a group is pushed to
 * an app from that app's Push Groups tab, which does not require the group to be
 * assigned to it, so an app can carry a mapping and never appear in this list.
 *
 * ## "Unavailable" is not "no roles"
 *
 * The admin-roles read commonly `403`s for a non-super-admin session — an
 * expected permission gap, not a failure — so `rolesStatus === 'unavailable'`
 * hides the roles subsection entirely rather than showing an alert or an empty
 * list. That is deliberately distinct from `rolesStatus === 'available'` with
 * an empty list, a *confirmed* "this group carries no admin role," which
 * renders as explicit text. Conflating the two would misreport a permission gap
 * as proof the group grants no admin access.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { AlertMessage, Badge, DetailSection, EmptyState, LoadingSpinner } from '../../shared';
import GroupAppRow from './GroupAppRow';
import { toGroupAppRows } from '../groupAppSource';
import type { AppGrant, RoleGrant, RolesReadStatus } from '../../../hooks/useGroupAccessGrants';
import type { SourceStatus } from '../../../hooks/useGroupSource';
import type { PushGroupMapping } from '../../../../shared/types';

/** Props for {@link GroupAccessSection}. */
interface GroupAccessSectionProps {
  /** Apps this group is assigned to. */
  apps: AppGrant[];
  /** Status of the app-assignment read. */
  appsStatus: SourceStatus;
  /** Error message when the app-assignment read failed. */
  appsError: string | null;
  /** Admin roles granted to every member of this group. */
  roles: RoleGrant[];
  /**
   * Whether the admin-roles read could be completed. `'unavailable'` hides the
   * roles subsection; it is not the same as a confirmed empty list. See the
   * module doc.
   */
  rolesStatus: RolesReadStatus;
  /**
   * The group's push mappings, joined onto the app rows. **`undefined` means the
   * enrichment did not run** and no row says anything about push; an empty array
   * is the loaded fact that this group is pushed nowhere.
   */
  pushMappings?: PushGroupMapping[];
  /** Okta org origin for per-app Admin Console links (null when unknown). */
  oktaOrigin?: string | null;
}

/** Tooltip explaining why a role's resource scope is never shown. */
const ROLE_SCOPE_CAVEAT =
  "Okta's group-roles listing reports the role type but not which apps or groups it applies to, so this is not the full grant.";

/** One granted role: its type label plus a caveat badge — never the label alone. */
const RoleRow: React.FC<{ role: RoleGrant }> = ({ role }) => (
  <li className="flex items-center justify-between gap-2">
    <span className="text-sm text-neutral-700">{role.label}</span>
    <Badge variant="neutral" title={ROLE_SCOPE_CAVEAT}>
      role assigned (scope not shown)
    </Badge>
  </li>
);

/**
 * Renders what membership in this group actually grants: the apps it is
 * assigned to, plus any admin roles it carries.
 */
const GroupAccessSection: React.FC<GroupAccessSectionProps> = ({
  apps,
  appsStatus,
  appsError,
  roles,
  rolesStatus,
  pushMappings,
  oktaOrigin,
}) => {
  const rows = useMemo(() => toGroupAppRows(apps, pushMappings), [apps, pushMappings]);

  /*
    Open rows live here rather than in each row, so a re-render of the section
    cannot close one — the same arrangement `MemberList` and
    `GroupMembershipsList` use, for the same reason.
  */
  const [openAppIds, setOpenAppIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleRow = useCallback((appId: string) => {
    setOpenAppIds((previous) => {
      const next = new Set(previous);
      if (!next.delete(appId)) next.add(appId);
      return next;
    });
  }, []);

  const loading = appsStatus === 'loading' || rolesStatus === 'loading';
  // A *confirmed* zero — the roles read actually succeeded and came back
  // empty. `rolesStatus === 'unavailable'` must never satisfy this: that is
  // "couldn't read," not "read, and there are none" (see module doc).
  const confirmedNoRoles = rolesStatus === 'available' && roles.length === 0;
  const genuinelyEmpty = !loading && appsStatus === 'done' && apps.length === 0 && confirmedNoRoles;

  return (
    <DetailSection
      title="Grants access to"
      description="What membership in this group actually gives a member."
    >
      {loading ? (
        <LoadingSpinner size="sm" message="Loading access grants…" centered />
      ) : appsStatus === 'error' ? (
        <AlertMessage
          message={{ text: appsError || 'Failed to load app assignments.', type: 'danger' }}
        />
      ) : genuinelyEmpty ? (
        <EmptyState
          icon="shield"
          title="No access granted"
          description="This group is not assigned to any app and carries no admin role."
        />
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-medium text-neutral-600">
              Assigned apps{apps.length > 0 && ` (${apps.length})`}
            </h3>
            {rows.length === 0 ? (
              <p className="mt-1.5 text-sm text-neutral-500">Not assigned to any app.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {rows.map((row) => (
                  <GroupAppRow
                    key={row.id}
                    row={row}
                    expanded={openAppIds.has(row.id)}
                    onToggle={toggleRow}
                    oktaOrigin={oktaOrigin}
                  />
                ))}
              </ul>
            )}
          </div>

          {rolesStatus === 'available' && (
            <div>
              <h3 className="text-xs font-medium text-neutral-600">
                Admin roles{roles.length > 0 && ` (${roles.length})`}
              </h3>
              {roles.length === 0 ? (
                <p className="mt-1.5 text-sm text-neutral-500">No admin role granted.</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {roles.map((role) => (
                    <RoleRow key={role.id} role={role} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </DetailSection>
  );
};

export default GroupAccessSection;
