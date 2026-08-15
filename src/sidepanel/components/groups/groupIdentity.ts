/**
 * @module sidepanel/components/groups/groupIdentity
 * @description Turns a group into the header's identity descriptor.
 *
 * The one place a group's header vocabulary is decided — its type label, its badge colour,
 * and how its member count reads. Replaces two divergent copies of that decision: the
 * `typeBadges` map in the former `GroupIdentitySection` and the `groupTypeBadgeVariant` /
 * `groupTypeBadgeText` pair in `GroupsTab`, which coloured the same three types through two
 * separate palettes.
 *
 * Pure by design: a `GroupSummary` in, plain data out, no JSX and no `oktaOrigin`. That is
 * what lets the badge choice and the pluralisation be unit-tested without rendering.
 */
import type { GroupSummary, GroupType } from '../../../shared/types';
import type { EntityIdentityDescriptor } from '../shared/identityDescriptor';
import type { BadgeVariant } from '../shared/Badge';

/**
 * Badge label and treatment per Okta group type.
 *
 * `warning` on an app group reads as a *category* here, not a severity — it is the token
 * that stays legible next to `primary` without claiming something is wrong. Same reasoning
 * as `ContextBar`'s per-entity dot colours.
 */
const TYPE_BADGES: Record<GroupType, { text: string; variant: BadgeVariant }> = {
  OKTA_GROUP: { text: 'Okta group', variant: 'primary' },
  APP_GROUP: { text: 'App group', variant: 'warning' },
  BUILT_IN: { text: 'Built-in', variant: 'neutral' },
};

/**
 * Build the header identity descriptor for a group.
 *
 * @param group - The group being browsed.
 * @returns The descriptor the Groups tab spreads onto `PageHeader`.
 *
 * @example
 * ```ts
 * const identity = groupIdentity(group);
 * // → { key: '00gFAKE…', name: 'Engineering',
 * //     badge: { text: 'Okta group', variant: 'primary' },
 * //     lines: [{ kind: 'metric', icon: 'users', value: '1,284', label: 'members' }],
 * //     link: { entityType: 'group', entityId: '00gFAKE…' } }
 * ```
 */
export function groupIdentity(group: GroupSummary): EntityIdentityDescriptor {
  // An unrecognised type is possible: `type` comes from an Okta response, and while zod
  // validates the shape at the boundary, a new Okta group type would widen the union
  // before this map knows about it.
  const badge = TYPE_BADGES[group.type] ?? TYPE_BADGES.BUILT_IN;

  return {
    key: group.id,
    name: group.name,
    badge,
    lines: [
      {
        kind: 'metric',
        icon: 'users',
        value: group.memberCount.toLocaleString(),
        label: group.memberCount === 1 ? 'member' : 'members',
      },
    ],
    link: { entityType: 'group', entityId: group.id },
  };
}
