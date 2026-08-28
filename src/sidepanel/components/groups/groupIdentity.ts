/**
 * @module sidepanel/components/groups/groupIdentity
 * @description Turns a group into the header's identity descriptor.
 *
 * The one place a group's header vocabulary is decided — its type label, its badge colour,
 * how its member count reads, and which of Okta's facts are known well enough to show.
 * Replaces two divergent copies of that decision: the `typeBadges` map in the former
 * `GroupIdentitySection` and the `groupTypeBadgeVariant` / `groupTypeBadgeText` pair in
 * `GroupsTab`, which coloured the same three types through two separate palettes.
 *
 * Pure by design: a `GroupSummary` in, plain data out, no JSX and no `oktaOrigin`. That is
 * what lets the badge choice, the pluralisation and the omission rules be unit-tested
 * without rendering.
 *
 * The type mark itself is demoted to a dot-marked `status` fact in the identity rows rather
 * than the header's loud trailing badge — none of the three group types is `danger`, so a
 * group descriptor never populates {@link EntityIdentityDescriptor.badge} today, but the
 * check is written generically against the variant rather than hard-coded to "never", so a
 * future group type Okta ships as genuinely alarming would still earn the loud treatment.
 */
import type { GroupSummary, GroupType } from '../../../shared/types';
import type {
  EntityIdentityDescriptor,
  IdentityFact,
  IdentityRow,
} from '../shared/identityDescriptor';
import type { BadgeVariant } from '../shared/Badge';
import { formatDateShort, getRelativeTime } from '../../../shared/utils/dateFormat';

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
 * Build the header identity descriptor for a group.
 *
 * Rows are identity, then counts, then timestamps. A count Okta has not reported yet is
 * **omitted rather than shown as zero** — `usedInRuleCount` is `undefined` until the rules
 * payload loads, and `ruleCount` reads `0` in that same window, so neither is rendered
 * until it is positive. That is deliberately asymmetric with `memberCount`, which the list
 * payload always carries and where `0 members` is a real answer.
 *
 * @param group - The group being browsed.
 * @returns The descriptor the Groups tab spreads onto `PageHeader`.
 *
 * @example
 * ```ts
 * const identity = groupIdentity(group);
 * // rows → [[● Okta group · id], [1,284 members · 2 rules], [Created 12 Mar 2021 · Updated 4 days ago]]
 * ```
 */
export function groupIdentity(group: GroupSummary): EntityIdentityDescriptor {
  // An unrecognised type is possible: `type` comes from an Okta response, and while zod
  // validates the shape at the boundary, a new Okta group type would widen the union
  // before this map knows about it.
  const typeMark = TYPE_BADGES[group.type] ?? TYPE_BADGES.BUILT_IN;
  const isAlarming = typeMark.variant === 'danger';

  const identityRow: IdentityRow = isAlarming
    ? []
    : [{ kind: 'status', variant: typeMark.variant, text: typeMark.text }];
  identityRow.push({ kind: 'id', value: group.id, copyLabel: 'Copy group id' });

  const counts: IdentityRow = [metric('users', group.memberCount, 'member')];
  if (group.ruleCount > 0) {
    counts.push(metric('bolt', group.ruleCount, 'rule', 'Rules that assign members here'));
  }
  if (group.usedInRuleCount !== undefined && group.usedInRuleCount > 0) {
    counts.push(
      metric(
        'link',
        group.usedInRuleCount,
        'reference',
        'Rules whose condition mentions this group',
      ),
    );
  }

  const timestamps: IdentityRow = [];
  if (group.created) {
    timestamps.push({
      kind: 'text',
      icon: 'clock',
      text: `Created ${formatDateShort(group.created)}`,
    });
  }
  if (group.lastUpdated) {
    // Recency answers "has anyone touched this lately?", which is the question an admin
    // actually asks here; the exact timestamp lives in the About section below.
    const relative = getRelativeTime(group.lastUpdated.toISOString());
    timestamps.push({
      kind: 'text',
      text: `Updated ${relative ?? formatDateShort(group.lastUpdated)}`,
    });
  }

  return {
    key: group.id,
    name: group.name,
    badge: isAlarming ? typeMark : undefined,
    rows: [identityRow, counts, timestamps],
    link: { entityType: 'group', entityId: group.id },
  };
}
