/**
 * @module sidepanel/components/users/userIdentity
 * @description Turns a user into the header's identity descriptor.
 *
 * The one place a user's header vocabulary is decided. The status badge now resolves
 * through the shared {@link sidepanel/components/shared/status.userStatusVariant} *and* the
 * shared `Badge` palette; the former `UserIdentityCard` consumed the shared variant
 * decision but then re-coloured it through a local `VARIANT_CLASSES` map built on raw
 * Tailwind hues (`bg-emerald-50`, `bg-amber-50`) rather than tokens.
 *
 * Pure by design: an `OktaUser` in, plain data out, no JSX and no `oktaOrigin`.
 *
 * The header's loud trailing badge is reserved for `danger` — `LOCKED_OUT` and
 * `DEPROVISIONED` — because a locked or deactivated user should shout. Every calmer status
 * (`ACTIVE`, `PROVISIONED`, `STAGED`, `SUSPENDED`, `RECOVERY`, `PASSWORD_EXPIRED`) is demoted
 * to a dot-marked `status` fact in the identity rows instead, so the header no longer varies
 * in height depending on how alarming a user's status is.
 */
import type { OktaUser } from '../../../shared/types';
import { userDisplayName } from '../../../shared/utils/userDisplay';
import { formatDateShort, getRelativeTime } from '../../../shared/utils/dateFormat';
import { userStatusVariant } from '../shared/status';
import type {
  EntityIdentityDescriptor,
  IdentityFact,
  IdentityRow,
} from '../shared/identityDescriptor';

/** Options for {@link userIdentity}. */
export interface UserIdentityOptions {
  /**
   * How many groups the user belongs to, when the tab has already loaded them. Omitted
   * while memberships are still resolving, which drops the fact rather than showing a
   * misleading `0`.
   */
  groupCount?: number;
  /**
   * How many applications are assigned to the user, when the tab has already loaded
   * them. Omitted while the apps request is still outstanding — same rule as
   * {@link UserIdentityOptions.groupCount}, and for the same reason: a user with no
   * apps and a user whose apps have not been fetched are different answers, and only
   * one of them is `0`.
   *
   * The count must come from the full assignment list the Apps pane already
   * resolves, not from a first-page count.
   */
  appCount?: number;
}

/** A counted fact, with its label pluralised to match. */
const metric = (
  icon: Extract<IdentityFact, { kind: 'metric' }>['icon'],
  n: number,
  singular: string,
  title?: string,
): Extract<IdentityFact, { kind: 'metric' }> => ({
  kind: 'metric',
  icon,
  value: n.toLocaleString(),
  label: n === 1 ? singular : `${singular}s`,
  title,
});

/**
 * Build the header identity descriptor for a user.
 *
 * Rows are identity, then counts, then timestamps. The counts row carries groups and then
 * apps. Facts Okta has not reported are omitted rather than zeroed: `managedBy.rules` is
 * absent until the membership analysis has run, and both counts are absent until their
 * payload lands. A `lastLogin` of `null` is the exception — that is a real answer
 * ("never"), not a missing one, so it is stated.
 *
 * @param user - The user being browsed.
 * @param options - See {@link UserIdentityOptions}.
 * @returns The descriptor the Users tab spreads onto `PageHeader`.
 *
 * @example
 * ```ts
 * const identity = userIdentity(user, {
 *   groupCount: memberships.length,
 *   appCount: apps?.length, // `undefined` until the apps request resolves
 * });
 * // rows → [[● ACTIVE · id], [42 groups], [Last login 2 days ago]]
 * ```
 */
export function userIdentity(
  user: OktaUser,
  options: UserIdentityOptions = {},
): EntityIdentityDescriptor {
  const { groupCount, appCount } = options;

  // The raw Okta status string is the label on purpose: `SUSPENDED` and `LOCKED_OUT` are
  // the terms the Admin Console uses, so a humanised version would make the panel and
  // Okta disagree about what a user's state is called.
  const statusVariant = userStatusVariant(user.status);
  const isAlarming = statusVariant === 'danger';

  const identityRow: IdentityRow = isAlarming
    ? []
    : [{ kind: 'status', variant: statusVariant, text: user.status }];
  identityRow.push({ kind: 'id', value: user.id, copyLabel: 'Copy user id' });

  const counts: IdentityRow = [];
  if (groupCount !== undefined) {
    counts.push(metric('users', groupCount, 'group'));
  }
  if (appCount !== undefined) {
    counts.push(metric('app', appCount, 'app', 'Applications assigned to this user'));
  }
  const managingRules = user.managedBy?.rules?.length ?? 0;
  if (managingRules > 0) {
    counts.push(metric('bolt', managingRules, 'rule', 'Rules that grant this user membership'));
  }

  const timestamps: IdentityRow = [];
  if (user.lastLogin !== undefined) {
    const relative = getRelativeTime(user.lastLogin);
    timestamps.push({
      kind: 'text',
      icon: 'clock',
      text: `Last login ${relative ?? (user.lastLogin ? formatDateShort(user.lastLogin) : 'never')}`,
    });
  }
  if (user.created) {
    timestamps.push({ kind: 'text', text: `Created ${formatDateShort(user.created)}` });
  }

  return {
    key: user.id,
    name: userDisplayName(user),
    badge: isAlarming ? { text: user.status, variant: statusVariant } : undefined,
    rows: [identityRow, counts, timestamps],
    link: { entityType: 'user', entityId: user.id },
  };
}
