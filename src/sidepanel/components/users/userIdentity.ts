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
 * Rows are identity, then counts, then timestamps. Facts Okta has not reported are omitted
 * rather than zeroed: `managedBy.rules` is absent until the membership analysis has run.
 * A `lastLogin` of `null` is the exception — that is a real answer ("never"), not a
 * missing one, so it is stated.
 *
 * @param user - The user being browsed.
 * @param options - See {@link UserIdentityOptions}.
 * @returns The descriptor the Users tab spreads onto `PageHeader`.
 *
 * @example
 * ```ts
 * const identity = userIdentity(user, { groupCount: memberships.length });
 * ```
 */
export function userIdentity(
  user: OktaUser,
  options: UserIdentityOptions = {},
): EntityIdentityDescriptor {
  const { groupCount } = options;

  const counts: IdentityRow = [];
  if (groupCount !== undefined) {
    counts.push(metric('users', groupCount, 'group'));
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
    // The raw Okta status string is the label on purpose: `SUSPENDED` and `LOCKED_OUT` are
    // the terms the Admin Console uses, so a humanised version would make the panel and
    // Okta disagree about what a user's state is called.
    badge: { text: user.status, variant: userStatusVariant(user.status) },
    rows: [[{ kind: 'id', value: user.id, copyLabel: 'Copy user id' }], counts, timestamps],
    link: { entityType: 'user', entityId: user.id },
  };
}
