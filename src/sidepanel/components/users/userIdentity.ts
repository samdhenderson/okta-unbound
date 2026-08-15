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
import { userStatusVariant } from '../shared/status';
import type { EntityIdentityDescriptor } from '../shared/identityDescriptor';

/** Options for {@link userIdentity}. */
export interface UserIdentityOptions {
  /**
   * How many groups the user belongs to, when the tab has already loaded them. Omitted
   * while memberships are still resolving, which drops the line rather than showing a
   * misleading `0`.
   */
  groupCount?: number;
}

/**
 * Build the header identity descriptor for a user.
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

  return {
    key: user.id,
    name: userDisplayName(user),
    // The raw Okta status string is the label on purpose: `SUSPENDED` and `LOCKED_OUT` are
    // the terms the Admin Console uses, so a humanised version would make the panel and
    // Okta disagree about what a user's state is called.
    badge: { text: user.status, variant: userStatusVariant(user.status) },
    lines:
      groupCount === undefined
        ? []
        : [
            {
              kind: 'metric',
              icon: 'users',
              value: groupCount.toLocaleString(),
              label: groupCount === 1 ? 'group' : 'groups',
            },
          ],
    link: { entityType: 'user', entityId: user.id },
  };
}
