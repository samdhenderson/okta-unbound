/**
 * @module sidepanel/components/groups/memberSourceBuckets
 * @description Folds a {@link MemberSourceBreakdown} into ordered display buckets for the meter.
 *
 * Pure and I/O-free so the meter stays a dumb renderer: this module owns the
 * bucket order, the labels, the token classes and the percentage maths. It sits
 * one level above `detail/` because both the full-size meter in the Group Detail
 * view and the compact meter in the group list row project their breakdown
 * through it — one bucket definition, two renderers.
 *
 * ## Why `ruleBased` is not rendered as-is
 *
 * {@link MemberSourceBreakdown} carries `unattributed` as a **subset of
 * `ruleBased`**, not a fourth disjoint bucket — its invariants are
 * `direct + ruleBased === total` and `unattributed <= ruleBased`. A member is
 * `unattributed` when at least one feeding rule's condition could not be
 * evaluated client-side, so the classifier fell back to a heuristic and
 * "rule-managed" is inferred rather than confirmed.
 *
 * The meter shows three *mutually exclusive* segments, so the confirmed bucket
 * is `ruleBased - unattributed`. Summing the raw fields instead would
 * double-count every indeterminate member — inflating the analyzed total above
 * `total` and shrinking every segment's share of the track.
 *
 * ## Three projections, one breakdown
 *
 * - {@link toMemberSourceBuckets} — the **coarse** three (`Rule-managed` /
 *   `Manual` / `Indeterminate`). Still the right shape for a one-line text
 *   summary, where naming every rule would not fit.
 * - {@link toMemberSourceSegments} — the **per-rule** segment set: one segment
 *   per rule that solely explains members, an aggregated `Other rules` tail, a
 *   `Matched by 2+ rules` segment, then the same `Rule-managed` remainder,
 *   `Manual` and `Indeterminate`. Exclusivity is guaranteed by construction (see
 *   the function), so the segments still sum to the analyzed member count.
 * - {@link toRuleAttributionRows} — the "Attributed to" list, which keeps
 *   `byRule`'s attribution counts but marks each rule as Okta-attributed (a
 *   fact) or client-inferred (a deduction).
 *
 * Per-rule segment colours come from the sanctioned chart ramp
 * ({@link module:sidepanel/theme/chartPalette}) — the ramp's length is the hard
 * cap on individually-named rules, and anything past it aggregates into `Other
 * rules` **with its dropped-rule count stated**, never silently truncated.
 */

import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';
import { INDIGO_RAMP, CHART_OTHER_COLOR } from '../../theme/chartPalette';

/**
 * Identity of one display bucket in the member-source meter.
 *
 * `rule:<ruleId>` keys one named rule's exclusive segment; the rest are fixed.
 */
export type MemberSourceBucketKey =
  'ruleBased' | 'direct' | 'unattributed' | 'multiRule' | 'otherRules' | `rule:${string}`;

/** One rendered segment/legend row of the member-source meter. */
export interface MemberSourceBucket {
  /** Which bucket this is. */
  key: MemberSourceBucketKey;
  /** Short human label ("Rule-managed"). */
  label: string;
  /** One-line explanation of what landed a member in this bucket. */
  description: string;
  /** Number of analyzed members in the bucket. */
  count: number;
  /** Share of the analyzed total, `0`–`100`. `0` when nothing was analyzed. */
  percent: number;
  /** Odyssey token class for the meter segment's fill. `''` when {@link color} carries it. */
  barClass: string;
  /** Odyssey token class for the legend swatch. `''` when {@link color} carries it. */
  dotClass: string;
  /**
   * Chart-ramp colour for a per-rule segment, as a CSS value from
   * {@link module:sidepanel/theme/chartPalette}. Absent on the token-based
   * buckets, which colour themselves through {@link barClass}.
   */
  color?: string;
  /**
   * How many feeding rules the `otherRules` bucket folds together. Rendered, so
   * an aggregated tail always states how many rules it dropped from the legend.
   */
  aggregatedRuleCount?: number;
}

/** Static per-bucket presentation, keyed by bucket. */
const BUCKET_META: Record<
  'ruleBased' | 'direct' | 'unattributed' | 'multiRule',
  { label: string; description: string; barClass: string; dotClass: string }
> = {
  ruleBased: {
    label: 'Rule-managed',
    description: "Matched a targeting rule's condition, so that rule accounts for this membership.",
    barClass: 'bg-primary',
    dotClass: 'bg-primary',
  },
  direct: {
    label: 'Manual',
    description: 'Added directly — no rule accounts for this membership.',
    barClass: 'bg-neutral-400',
    dotClass: 'bg-neutral-400',
  },
  unattributed: {
    label: 'Indeterminate',
    description: 'A targeting rule could not be evaluated here, so the source is unconfirmed.',
    barClass: 'bg-warning',
    dotClass: 'bg-warning',
  },
  multiRule: {
    label: 'Matched by 2+ rules',
    description:
      'Attributed to more than one rule, so no single rule owns the membership. Counted once.',
    barClass: 'bg-primary-dark',
    dotClass: 'bg-primary-dark',
  },
};

/** Bucket order — largest-signal first, indeterminate last. */
const BUCKET_ORDER: ('ruleBased' | 'direct' | 'unattributed')[] = [
  'ruleBased',
  'direct',
  'unattributed',
];

/**
 * The hard cap on individually-named rule segments: the chart ramp's length.
 *
 * A seventh rule would have no colour of its own, and clamping it onto the
 * lightest stop (as `AttributeFacet` does) would make two rules look like one —
 * so the tail aggregates into `Other rules` instead.
 */
export const MAX_RULE_SEGMENTS = INDIGO_RAMP.length;

/** Counts still to be distributed, clamped so no segment can go negative. */
function budgetTaker(available: number): (wanted: number) => number {
  let remaining = Math.max(0, available);
  return (wanted: number) => {
    const taken = Math.max(0, Math.min(wanted, remaining));
    remaining -= taken;
    return taken;
  };
}

/** Attach each bucket's share of the analyzed sum (never `NaN`). */
function withPercent(buckets: Omit<MemberSourceBucket, 'percent'>[]): MemberSourceBucket[] {
  const analyzed = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  return buckets.map((bucket) => ({
    ...bucket,
    percent: analyzed === 0 ? 0 : (bucket.count / analyzed) * 100,
  }));
}

/** The confirmed/indeterminate split of `ruleBased`, clamped against bad input. */
function splitRuleBased(breakdown: MemberSourceBreakdown): {
  confirmed: number;
  indeterminate: number;
} {
  // `unattributed` is carved OUT of `ruleBased`, never added alongside it.
  // Clamped so a malformed breakdown can't produce a negative segment.
  const indeterminate = Math.max(0, Math.min(breakdown.unattributed, breakdown.ruleBased));
  return { confirmed: breakdown.ruleBased - indeterminate, indeterminate };
}

/**
 * Project a breakdown onto the meter's three coarse, mutually-exclusive buckets.
 *
 * Always returns all three buckets in a stable order so the meter's legend does
 * not reflow between groups; callers drop empty buckets from the bar themselves.
 * Percentages are computed against the sum of the buckets (not
 * `breakdown.total`), so the segments always fill the track exactly even when a
 * caller supplies counts that disagree with the reported total.
 *
 * Use this where a per-rule breakdown would not fit — the compact row's one-line
 * text summary. The bar itself uses {@link toMemberSourceSegments}.
 *
 * @param breakdown - The analyzed manual-vs-rule split, in which `unattributed`
 *   is a subset of `ruleBased` (see the module header).
 * @returns The three exclusive buckets, `ruleBased` → `direct` → `unattributed`.
 */
export function toMemberSourceBuckets(breakdown: MemberSourceBreakdown): MemberSourceBucket[] {
  const { confirmed, indeterminate } = splitRuleBased(breakdown);

  const counts: Record<'ruleBased' | 'direct' | 'unattributed', number> = {
    ruleBased: confirmed,
    direct: breakdown.direct,
    unattributed: indeterminate,
  };

  return withPercent(BUCKET_ORDER.map((key) => ({ key, ...BUCKET_META[key], count: counts[key] })));
}

/** Options for {@link toMemberSourceSegments}. */
export interface MemberSourceSegmentOptions {
  /**
   * How many rules may get their own segment before the rest aggregate into
   * `Other rules`. Defaults to — and is capped at — {@link MAX_RULE_SEGMENTS},
   * the chart ramp's length. The compact row meter passes a smaller number
   * because it is 56px wide.
   */
  maxRules?: number;
}

/**
 * Project a breakdown onto **one segment per attributing rule**, plus the
 * remainder.
 *
 * Order: each named rule (by exclusive member count, descending) → `Other rules`
 * → `Matched by 2+ rules` → `Rule-managed` (the rule-managed members no single
 * named rule explains) → `Manual` → `Indeterminate`.
 *
 * **Exclusivity is guaranteed by construction, not by trusting the input.** The
 * rule-managed members (`ruleBased - unattributed`) are a fixed budget that the
 * segments draw down in order; whatever is left over becomes the `Rule-managed`
 * remainder. So the segments always sum to `direct + ruleBased` and always fill
 * the track exactly, even if a caller hands over `byRuleMembers` counts that
 * exceed the members available.
 *
 * A rule that solely explains **zero** members gets no segment at all — an empty
 * slice is noise, not information. A breakdown with no `byRuleMembers` at all
 * (never computed) degrades to exactly {@link toMemberSourceBuckets}'s three
 * coarse buckets rather than claiming nothing is explained.
 *
 * @param breakdown - The analyzed split.
 * @param options - Segment-count budget; see {@link MemberSourceSegmentOptions}.
 * @returns The exclusive segments in render order. The three coarse buckets are
 *   always present (possibly `0`, so a legend does not reflow); rule, `Other
 *   rules` and multi-rule segments appear only when non-empty.
 */
export function toMemberSourceSegments(
  breakdown: MemberSourceBreakdown,
  options: MemberSourceSegmentOptions = {},
): MemberSourceBucket[] {
  const maxRules = Math.max(0, Math.min(options.maxRules ?? MAX_RULE_SEGMENTS, MAX_RULE_SEGMENTS));
  const { confirmed, indeterminate } = splitRuleBased(breakdown);

  // Only rules that solely explain someone can own a segment; sorted defensively
  // rather than trusting the producer's order.
  const named = (breakdown.byRuleMembers ?? [])
    .filter((rule) => rule.soleCount > 0)
    .slice()
    .sort((a, b) => b.soleCount - a.soleCount || a.ruleName.localeCompare(b.ruleName));

  const shown = named.slice(0, maxRules);
  const dropped = named.slice(maxRules);

  const take = budgetTaker(confirmed);
  const segments: Omit<MemberSourceBucket, 'percent'>[] = [];

  shown.forEach((rule, index) => {
    const count = take(rule.soleCount);
    if (count === 0) return;
    segments.push({
      key: `rule:${rule.ruleId}`,
      label: rule.ruleName,
      description: `Attributed to the rule "${rule.ruleName}" and to no other rule.`,
      count,
      barClass: '',
      dotClass: '',
      color: INDIGO_RAMP[index],
    });
  });

  const otherCount = take(dropped.reduce((sum, rule) => sum + rule.soleCount, 0));
  if (otherCount > 0) {
    segments.push({
      key: 'otherRules',
      label: 'Other rules',
      description:
        `${dropped.length} further rule${dropped.length === 1 ? '' : 's'}, aggregated — ` +
        'each accounts for fewer members than the rules listed above.',
      count: otherCount,
      barClass: '',
      dotClass: '',
      color: CHART_OTHER_COLOR,
      aggregatedRuleCount: dropped.length,
    });
  }

  const multiCount = take(Math.max(0, breakdown.multiRuleMembers ?? 0));
  if (multiCount > 0) {
    segments.push({ key: 'multiRule', ...BUCKET_META.multiRule, count: multiCount });
  }

  // Whatever the named rules did not claim: rule-managed members with no single
  // rule to name (an APP_GROUP's application-managed members, or a breakdown
  // computed before per-rule exclusivity existed).
  segments.push({ key: 'ruleBased', ...BUCKET_META.ruleBased, count: take(confirmed) });
  segments.push({ key: 'direct', ...BUCKET_META.direct, count: breakdown.direct });
  segments.push({ key: 'unattributed', ...BUCKET_META.unattributed, count: indeterminate });

  return withPercent(segments);
}

/** How a rule's attribution was established. */
export type RuleAttributionProvenance = 'okta' | 'inferred' | 'mixed';

/** One row of the Group Detail view's "Attributed to" list. */
export interface RuleAttributionRow {
  /** Okta rule id — the deep-link target and React key. */
  ruleId: string;
  /** Rule name, as Okta returned it. */
  ruleName: string;
  /** Members this rule accounts for (attributions: a two-rule member is in both rows). */
  count: number;
  /**
   * Where the attribution came from, or `undefined` when the breakdown never
   * recorded it. Absent means *unknown*, so the row claims nothing.
   */
  provenance?: RuleAttributionProvenance;
  /** Short chip label for {@link provenance}. */
  provenanceLabel?: string;
  /** Tooltip spelling out what the chip asserts. */
  provenanceTitle?: string;
  /** Odyssey token classes for the chip. */
  provenanceClass?: string;
}

/** Static chip presentation per provenance. */
const PROVENANCE_META: Record<
  RuleAttributionProvenance,
  { label: string; title: string; className: string }
> = {
  okta: {
    label: 'Okta-attributed',
    title: 'Okta itself reports these members as assigned by this rule.',
    className: 'bg-neutral-50 text-neutral-700 border-neutral-200',
  },
  inferred: {
    label: 'Inferred',
    title:
      'Okta did not attribute these members — the rule was matched client-side, ' +
      'so this is a deduction, not a fact.',
    className: 'bg-warning-light text-warning-text border-warning-light',
  },
  mixed: {
    label: 'Partly inferred',
    title:
      'Okta attributed some of these members; the rest were matched client-side, ' +
      'so part of this count is a deduction rather than a fact.',
    className: 'bg-warning-light text-warning-text border-warning-light',
  },
};

/**
 * Project a breakdown onto the "Attributed to" list rows.
 *
 * Keeps {@link MemberSourceBreakdown.byRule}'s attribution counts — the honest
 * answer to "how many members does this rule account for?", including members
 * two rules share — and adds the provenance chip that keeps a client-side guess
 * from reading like one of Okta's own facts.
 *
 * @param breakdown - The analyzed split.
 * @returns One row per rule, in `byRule` order. Rows carry no provenance at all
 *   when the breakdown predates per-rule provenance, rather than defaulting to a
 *   claim in either direction.
 */
export function toRuleAttributionRows(breakdown: MemberSourceBreakdown): RuleAttributionRow[] {
  const counts = new Map((breakdown.byRuleMembers ?? []).map((rule) => [rule.ruleId, rule]));

  return breakdown.byRule.map((contribution) => {
    const detail = counts.get(contribution.ruleId);
    const okta = detail?.oktaAttributedCount ?? 0;
    const client = detail?.clientAttributedCount ?? 0;

    if (okta + client === 0) {
      return {
        ruleId: contribution.ruleId,
        ruleName: contribution.ruleName,
        count: contribution.count,
      };
    }

    const provenance: RuleAttributionProvenance =
      client === 0 ? 'okta' : okta === 0 ? 'inferred' : 'mixed';
    const meta = PROVENANCE_META[provenance];

    return {
      ruleId: contribution.ruleId,
      ruleName: contribution.ruleName,
      count: contribution.count,
      provenance,
      provenanceLabel: meta.label,
      provenanceTitle:
        provenance === 'mixed'
          ? `${okta.toLocaleString()} of ${(okta + client).toLocaleString()} attributed by Okta. ${meta.title}`
          : meta.title,
      provenanceClass: meta.className,
    };
  });
}
