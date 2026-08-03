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
 */

import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';

/** Identity of one display bucket in the member-source meter. */
export type MemberSourceBucketKey = 'ruleBased' | 'direct' | 'unattributed';

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
  /** Odyssey token class for the meter segment's fill. */
  barClass: string;
  /** Odyssey token class for the legend swatch. */
  dotClass: string;
}

/** Static per-bucket presentation, keyed by bucket. */
const BUCKET_META: Record<
  MemberSourceBucketKey,
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
};

/** Bucket order — largest-signal first, indeterminate last. */
const BUCKET_ORDER: MemberSourceBucketKey[] = ['ruleBased', 'direct', 'unattributed'];

/**
 * Project a breakdown onto the meter's three mutually-exclusive display buckets.
 *
 * Always returns all three buckets in a stable order so the meter's legend does
 * not reflow between groups; callers drop empty buckets from the bar themselves.
 * Percentages are computed against the sum of the buckets (not
 * `breakdown.total`), so the segments always fill the track exactly even when a
 * caller supplies counts that disagree with the reported total.
 *
 * @param breakdown - The analyzed manual-vs-rule split, in which `unattributed`
 *   is a subset of `ruleBased` (see the module header).
 * @returns The three exclusive buckets, `ruleBased` → `direct` → `unattributed`.
 */
export function toMemberSourceBuckets(breakdown: MemberSourceBreakdown): MemberSourceBucket[] {
  // `unattributed` is carved OUT of `ruleBased`, never added alongside it.
  // Clamped so a malformed breakdown can't produce a negative segment.
  const indeterminate = Math.max(0, Math.min(breakdown.unattributed, breakdown.ruleBased));

  const counts: Record<MemberSourceBucketKey, number> = {
    ruleBased: breakdown.ruleBased - indeterminate,
    direct: breakdown.direct,
    unattributed: indeterminate,
  };

  const analyzed = BUCKET_ORDER.reduce((sum, key) => sum + counts[key], 0);

  return BUCKET_ORDER.map((key) => ({
    key,
    ...BUCKET_META[key],
    count: counts[key],
    percent: analyzed === 0 ? 0 : (counts[key] / analyzed) * 100,
  }));
}
