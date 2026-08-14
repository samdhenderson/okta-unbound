/**
 * @module sidepanel/components/groups/groupSourceSummary
 * @description Pure derivation of everything a compact group row renders.
 *
 * {@link GroupListItem} is a dense row rendered a few hundred times in a long
 * list, so every decision it makes — which badge, which identity line, which
 * facts, and what the member-source meter is allowed to claim — is computed here
 * instead of inline in JSX. The module is pure and I/O-free: it never fetches,
 * and it cannot, which is the structural guarantee that the list does not
 * trigger a paginated member read per row.
 *
 * Three honesty rules are encoded here rather than left to the caller:
 *
 * 1. **The two rule relationships stay distinct.** "Fed by N rules"
 *    (`ruleCount` — rules that assign users *into* the group) and "Used in N
 *    rules" (`usedInRuleCount` — rules that merely reference the group in a
 *    condition) are separate facts. The old row summed them into one "N rules"
 *    badge, which conflated a membership source with a membership test.
 * 2. **`usedInRuleCount` is `undefined` until the rules payload is known.** That
 *    is *unknown*, not zero, so the fact is omitted rather than rendered as 0.
 * 3. **The meter only claims what has been computed.** A breakdown is supplied
 *    only when one is already in the session cache; otherwise the row says so.
 */

import type { GroupSummary, GroupType } from '../../../shared/types';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';
import {
  toMemberSourceBuckets,
  toMemberSourceSegments,
  type MemberSourceBucket,
} from './memberSourceBuckets';

/**
 * How many rules the compact row meter names before the tail aggregates into
 * `Other rules`.
 *
 * The detail view's meter is the full-width one and gets the chart ramp's six
 * stops; the row's bar is 56px, where a seventh sliver would be indistinguishable
 * from a rendering artifact. Three named rules plus an aggregated tail is the
 * most it can encode legibly — and the row's *text* is coarser still (see
 * {@link describeMemberSource}).
 */
export const COMPACT_RULE_SEGMENTS = 3;

/** A short badge with its Odyssey token classes. */
export interface GroupTypeBadge {
  /** Badge text (`OKTA` / `APP` / `BUILT-IN`). */
  label: string;
  /** Background/text/border token classes for the badge. */
  className: string;
}

/** Per-type badge presentation, keyed by Okta's group type. */
const TYPE_BADGES: Record<GroupType, GroupTypeBadge> = {
  OKTA_GROUP: {
    label: 'OKTA',
    className: 'bg-primary-light text-primary-text border-primary-highlight',
  },
  APP_GROUP: {
    label: 'APP',
    className: 'bg-warning-light text-warning-text border-warning-light',
  },
  BUILT_IN: {
    label: 'BUILT-IN',
    className: 'bg-neutral-50 text-neutral-700 border-neutral-200',
  },
};

/** Fallback for a group whose `type` is outside the known union. */
const UNKNOWN_TYPE_BADGE = TYPE_BADGES.BUILT_IN;

/** The line rendered directly under the group name. */
export interface GroupIdentityLine {
  /** `description` when the group has one, otherwise its Okta id. */
  text: string;
  /** Which of the two the `text` is, so the row can style the id as mono. */
  kind: 'description' | 'id';
  /** Tooltip, spelling out the fallback when there is no description. */
  title: string;
}

/** One compact, exact fact rendered in the row's signal line. */
export interface GroupRowFact {
  /** Stable React key. */
  key: 'fedBy' | 'usedIn' | 'push';
  /** Short visible label ("Fed by 2 rules"). */
  label: string;
  /** Tooltip that spells out what the number actually means. */
  title: string;
}

/** What the row is allowed to say about where the members came from. */
export type MemberSourceState =
  /** The group is empty, so there is nothing to attribute. */
  | { kind: 'no-members'; summary: string; title: string }
  /**
   * No breakdown has been computed for this group in this session. The row shows
   * this — it never fetches one, because computing it costs `ceil(N/200)`
   * paginated member requests per group.
   */
  | { kind: 'unknown'; summary: string; title: string }
  /**
   * A breakdown is available. `segments` are the non-empty, mutually exclusive
   * display buckets for the bar — up to {@link COMPACT_RULE_SEGMENTS} per-rule
   * segments, then the aggregated tail and the coarse buckets — while `summary`
   * is the coarser text that fits on the row's one line.
   */
  | { kind: 'computed'; segments: MemberSourceBucket[]; summary: string; title: string };

/** Everything {@link GroupListItem} renders, derived once per group/breakdown pair. */
export interface GroupRowModel {
  /** Okta group-type badge. */
  typeBadge: GroupTypeBadge;
  /** Source application name for an `APP_GROUP`, else `null`. */
  sourceApp: string | null;
  /** The line under the name: description, or the id when there is none. */
  identity: GroupIdentityLine;
  /** Exact member count — free from Okta's `?expand=stats`, never a fetch. */
  memberCount: number;
  /** `member` / `members`, pluralized for {@link GroupRowModel.memberCount}. */
  memberNoun: string;
  /** Rule and push facts, in render order. Empty when the group has neither. */
  facts: GroupRowFact[];
  /** The member-source meter's state. */
  source: MemberSourceState;
}

/** `''` for 1, `'s'` otherwise. */
const plural = (n: number): string => (n === 1 ? '' : 's');

/**
 * The badge for an Okta group type.
 *
 * @param type - The group's Okta type.
 * @returns Its label plus token classes; falls back to the built-in badge for an
 *   unrecognized type rather than rendering nothing.
 */
export function groupTypeBadge(type: GroupType): GroupTypeBadge {
  return TYPE_BADGES[type] ?? UNKNOWN_TYPE_BADGE;
}

/**
 * The identity line under the group name.
 *
 * Okta group descriptions are user-authored and frequently blank, so a blank one
 * falls back to the group id rather than leaving a hole in the row: the id is the
 * other thing that identifies a group, it keeps row heights uniform for scanning,
 * and it saves expanding the row to copy it.
 *
 * @param group - The group being rendered.
 * @returns The text, which of the two it is, and a tooltip.
 */
export function groupIdentityLine(group: GroupSummary): GroupIdentityLine {
  const description = group.description?.trim();
  if (description) return { text: description, kind: 'description', title: description };
  return { text: group.id, kind: 'id', title: `Group id ${group.id} — no description set` };
}

/**
 * The exact, free facts about a group's rule and push relationships.
 *
 * @param group - The group being rendered.
 * @returns Zero to three facts. "Fed by" and "Used in" are never merged, and
 *   `usedInRuleCount: undefined` (rules not loaded yet) yields no fact at all.
 */
export function groupRowFacts(group: GroupSummary): GroupRowFact[] {
  const facts: GroupRowFact[] = [];

  if (group.ruleCount > 0) {
    facts.push({
      key: 'fedBy',
      label: `Fed by ${group.ruleCount} rule${plural(group.ruleCount)}`,
      title: `${group.ruleCount} group rule${plural(group.ruleCount)} assign${
        group.ruleCount === 1 ? 's' : ''
      } users into this group`,
    });
  }

  const usedIn = group.usedInRuleCount;
  if (usedIn !== undefined && usedIn > 0) {
    facts.push({
      key: 'usedIn',
      label: `Used in ${usedIn} rule${plural(usedIn)}`,
      title:
        `This group's id appears in the condition of ${usedIn} rule${plural(usedIn)} — ` +
        'those rules test membership here, they do not assign it. ' +
        'Rules that reference the group by name are not counted.',
    });
  }

  const apps = [...new Set((group.pushMappings ?? []).map((m) => m.appName || m.appId))];
  if (apps.length > 0) {
    facts.push({
      key: 'push',
      label: `Pushed to ${apps.length} app${plural(apps.length)}`,
      title: `Pushed to: ${apps.join(', ')}`,
    });
  }

  return facts;
}

/**
 * What the row may claim about the group's member sources.
 *
 * The bar and the text deliberately carry **different resolutions**. The bar
 * draws up to {@link COMPACT_RULE_SEGMENTS} per-rule segments, because colour is
 * free in a 56px strip. The one-line summary beside it collapses back to the
 * coarse `Rule-managed / Manual / Indeterminate` triple, because rule names are
 * unbounded in length and a list row is not: naming rules there would push the
 * member count and the rule facts off the line. The full per-segment detail —
 * every rule, its count and what put a member there — is in the row's tooltip.
 *
 * @param memberCount - The group's exact member count.
 * @param breakdown - An already-computed split, or `null` when none is cached.
 *   Callers must never fetch one to satisfy this argument from a list row.
 * @returns The meter state: empty group, not-yet-computed, or computed segments.
 */
export function describeMemberSource(
  memberCount: number,
  breakdown: MemberSourceBreakdown | null,
): MemberSourceState {
  if (memberCount === 0) {
    return {
      kind: 'no-members',
      summary: 'No members',
      title: 'This group has no members, so there is nothing to attribute.',
    };
  }

  if (!breakdown) {
    return {
      kind: 'unknown',
      summary: 'Source not analyzed',
      title:
        'Where these members came from has not been analyzed. It reads every member of ' +
        'the group once, so the list never does it automatically.',
    };
  }

  const segments = toMemberSourceSegments(breakdown, {
    maxRules: COMPACT_RULE_SEGMENTS,
  }).filter((bucket) => bucket.count > 0);

  const summary = toMemberSourceBuckets(breakdown)
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => `${bucket.label} ${bucket.count.toLocaleString()}`)
    .join(' · ');

  return {
    kind: 'computed',
    segments,
    summary: summary || 'No members to attribute',
    title: segments
      .map((bucket) => `${bucket.label}: ${bucket.count.toLocaleString()} — ${bucket.description}`)
      .join('\n'),
  };
}

/**
 * Derive the whole compact row model for one group.
 *
 * @param group - The group to render.
 * @param breakdown - A member-source split already present in the session cache,
 *   or `null`. Never fetched on the row's behalf.
 * @returns The {@link GroupRowModel} the row renders directly.
 */
export function summarizeGroupRow(
  group: GroupSummary,
  breakdown: MemberSourceBreakdown | null,
): GroupRowModel {
  return {
    typeBadge: groupTypeBadge(group.type),
    sourceApp: group.type === 'APP_GROUP' ? (group.sourceAppName ?? null) : null,
    identity: groupIdentityLine(group),
    memberCount: group.memberCount,
    memberNoun: `member${plural(group.memberCount)}`,
    facts: groupRowFacts(group),
    source: describeMemberSource(group.memberCount, breakdown),
  };
}
