import { describe, it, expect } from 'vitest';
import { toMemberSourceBuckets } from './memberSourceBuckets';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';

const breakdown = (over: Partial<MemberSourceBreakdown> = {}): MemberSourceBreakdown => ({
  total: 0,
  direct: 0,
  ruleBased: 0,
  unattributed: 0,
  byRule: [],
  ...over,
});

describe('toMemberSourceBuckets', () => {
  it('always returns the three buckets in a stable order', () => {
    expect(toMemberSourceBuckets(breakdown()).map((b) => b.key)).toEqual([
      'ruleBased',
      'direct',
      'unattributed',
    ]);
  });

  it('splits counts across the buckets and computes percentages that sum to 100', () => {
    const buckets = toMemberSourceBuckets(breakdown({ total: 4, direct: 1, ruleBased: 3 }));

    expect(buckets.map((b) => b.count)).toEqual([3, 1, 0]);
    expect(buckets.map((b) => Math.round(b.percent))).toEqual([75, 25, 0]);
    expect(buckets.reduce((sum, b) => sum + b.percent, 0)).toBeCloseTo(100);
  });

  it('carves the indeterminate bucket OUT of ruleBased rather than adding to it', () => {
    // `unattributed` is a subset of `ruleBased` (invariants: direct + ruleBased
    // === total, unattributed <= ruleBased). Of the 3 rule-managed members, 2
    // could not be confirmed, so only 1 is a confirmed rule-based member.
    const buckets = toMemberSourceBuckets(
      breakdown({ total: 4, direct: 1, ruleBased: 3, unattributed: 2 }),
    );

    expect(buckets.map((b) => b.count)).toEqual([1, 1, 2]);
    expect(buckets.map((b) => Math.round(b.percent))).toEqual([25, 25, 50]);
  });

  it('never double-counts: the buckets sum to the reported total', () => {
    // Regression guard. Summing the raw fields would give 3 + 1 + 2 = 6 against a
    // total of 4, inflating the track and shrinking every segment's share.
    const source = breakdown({ total: 4, direct: 1, ruleBased: 3, unattributed: 2 });
    const buckets = toMemberSourceBuckets(source);

    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(source.total);
  });

  it('clamps an unattributed count that exceeds ruleBased', () => {
    // Malformed input must not produce a negative segment.
    const buckets = toMemberSourceBuckets(
      breakdown({ total: 3, direct: 1, ruleBased: 2, unattributed: 5 }),
    );

    expect(buckets.map((b) => b.count)).toEqual([0, 1, 2]);
    expect(buckets.every((b) => b.count >= 0)).toBe(true);
  });

  it('percentages against the analyzed sum, not the reported total', () => {
    // A `total` that disagrees with the buckets must not make the bar overflow or
    // under-fill its track.
    const buckets = toMemberSourceBuckets(breakdown({ total: 99, direct: 1, ruleBased: 1 }));
    expect(buckets.reduce((sum, b) => sum + b.percent, 0)).toBeCloseTo(100);
  });

  it('yields 0% everywhere (never NaN) when nothing was analyzed', () => {
    for (const bucket of toMemberSourceBuckets(breakdown())) {
      expect(bucket.percent).toBe(0);
    }
  });

  it('carries a label and token classes for every bucket', () => {
    for (const bucket of toMemberSourceBuckets(breakdown())) {
      expect(bucket.label).toBeTruthy();
      expect(bucket.description).toBeTruthy();
      expect(bucket.barClass).toMatch(/^bg-/);
      expect(bucket.dotClass).toMatch(/^bg-/);
    }
  });
});
