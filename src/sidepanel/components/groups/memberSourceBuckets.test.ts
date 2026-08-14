import { describe, it, expect } from 'vitest';
import {
  ATTRIBUTION_BUCKET,
  MAX_RULE_SEGMENTS,
  describeAttribution,
  toMemberSourceBuckets,
  toMemberSourceSegments,
  toRuleAttributionRows,
} from './memberSourceBuckets';
import type {
  MemberSourceBreakdown,
  RuleMemberCounts,
} from '../../../shared/membership/groupSource';
import type { MembershipAttribution } from '../../../shared/types';

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

/** A rule's exclusive member counts, defaulting to a plain Okta-attributed rule. */
const ruleCounts = (
  ruleId: string,
  soleCount: number,
  over: Partial<RuleMemberCounts> = {},
): RuleMemberCounts => ({
  ruleId,
  ruleName: `Rule ${ruleId}`,
  soleCount,
  oktaAttributedCount: soleCount,
  clientAttributedCount: 0,
  ...over,
});

/** Sum every segment's count — the property the whole meter rests on. */
const sum = (segments: { count: number }[]) => segments.reduce((n, s) => n + s.count, 0);

describe('toMemberSourceSegments', () => {
  it('draws one segment per rule, mutually exclusive and summing to the member count', () => {
    const source = breakdown({
      total: 10,
      direct: 2,
      ruleBased: 8,
      byRuleMembers: [ruleCounts('r1', 5), ruleCounts('r2', 3)],
      multiRuleMembers: 0,
    });

    const segments = toMemberSourceSegments(source).filter((s) => s.count > 0);

    expect(segments.map((s) => s.key)).toEqual(['rule:r1', 'rule:r2', 'direct']);
    expect(segments.map((s) => s.count)).toEqual([5, 3, 2]);
    expect(sum(segments)).toBe(source.total);
    expect(segments.reduce((n, s) => n + s.percent, 0)).toBeCloseTo(100);
  });

  it('counts a member matched by two rules once, in its own trailing segment', () => {
    // The live shape: 68 single-rule members, 1 two-rule member, 1 manual add.
    // byRule would credit the shared member twice; these segments must not.
    const source = breakdown({
      total: 70,
      direct: 1,
      ruleBased: 69,
      byRuleMembers: [ruleCounts('r1', 40), ruleCounts('r2', 28)],
      multiRuleMembers: 1,
    });

    const segments = toMemberSourceSegments(source).filter((s) => s.count > 0);

    const multi = segments.find((s) => s.key === 'multiRule');
    expect(multi).toMatchObject({ count: 1, label: 'Matched by 2+ rules' });
    expect(segments.map((s) => s.key)).toEqual(['rule:r1', 'rule:r2', 'multiRule', 'direct']);
    expect(sum(segments)).toBe(70);
  });

  it('keeps a one-member segment as its own legend entry rather than folding it away', () => {
    const segments = toMemberSourceSegments(
      breakdown({
        total: 70,
        direct: 0,
        ruleBased: 70,
        byRuleMembers: [ruleCounts('r1', 69), ruleCounts('r2', 1)],
      }),
    ).filter((s) => s.count > 0);

    const tiny = segments.find((s) => s.key === 'rule:r2');
    expect(tiny?.count).toBe(1);
    expect(tiny?.percent).toBeGreaterThan(0);
  });

  it('aggregates past the ramp into "Other rules" and states how many it dropped', () => {
    const rules = Array.from({ length: 7 }, (_, i) => ruleCounts(`r${i + 1}`, 10 - i));
    const source = breakdown({
      total: 49,
      direct: 0,
      ruleBased: 49,
      byRuleMembers: rules,
      multiRuleMembers: 0,
    });

    const segments = toMemberSourceSegments(source).filter((s) => s.count > 0);
    const named = segments.filter((s) => s.key.startsWith('rule:'));
    const other = segments.find((s) => s.key === 'otherRules');

    expect(named).toHaveLength(MAX_RULE_SEGMENTS);
    // The 7th rule is aggregated, never silently truncated: its count is carried
    // and the number of folded rules is stated.
    expect(other).toMatchObject({ count: 4, aggregatedRuleCount: 1 });
    expect(other?.description).toContain('1 further rule');
    expect(sum(segments)).toBe(49);
  });

  it('respects a smaller segment budget, as the compact row meter passes', () => {
    const rules = Array.from({ length: 5 }, (_, i) => ruleCounts(`r${i + 1}`, 10 - i));
    const segments = toMemberSourceSegments(
      breakdown({ total: 40, direct: 0, ruleBased: 40, byRuleMembers: rules }),
      { maxRules: 3 },
    ).filter((s) => s.count > 0);

    expect(segments.filter((s) => s.key.startsWith('rule:'))).toHaveLength(3);
    expect(segments.find((s) => s.key === 'otherRules')).toMatchObject({
      count: 13,
      aggregatedRuleCount: 2,
    });
    expect(sum(segments)).toBe(40);
  });

  it('omits a zero-count segment entirely instead of rendering an empty slice', () => {
    const segments = toMemberSourceSegments(
      breakdown({
        total: 4,
        direct: 0,
        ruleBased: 4,
        // r2 only ever appears alongside another rule, so it explains nobody alone.
        byRuleMembers: [ruleCounts('r1', 4), ruleCounts('r2', 0, { oktaAttributedCount: 1 })],
        multiRuleMembers: 0,
      }),
    );

    expect(segments.map((s) => s.key)).not.toContain('rule:r2');
    expect(segments.every((s) => s.key !== 'otherRules')).toBe(true);
    expect(segments.filter((s) => s.count > 0).map((s) => s.key)).toEqual(['rule:r1']);
  });

  it('leaves rule-managed members no named rule explains in the aggregate segment', () => {
    // An APP_GROUP's members are rule-managed with no group rule to name.
    const segments = toMemberSourceSegments(
      breakdown({ total: 6, direct: 0, ruleBased: 6, byRuleMembers: [ruleCounts('r1', 2)] }),
    ).filter((s) => s.count > 0);

    expect(segments.map((s) => [s.key, s.count])).toEqual([
      ['rule:r1', 2],
      ['ruleBased', 4],
    ]);
  });

  it('degrades to the three coarse buckets when exclusivity was never computed', () => {
    const source = breakdown({ total: 10, direct: 4, ruleBased: 6, unattributed: 2 });

    expect(toMemberSourceSegments(source)).toEqual(toMemberSourceBuckets(source));
  });

  it('never over-fills the track when the per-rule counts exceed the members available', () => {
    // Malformed input: 99 sole members inside a 3-member rule-managed budget.
    const segments = toMemberSourceSegments(
      breakdown({
        total: 4,
        direct: 1,
        ruleBased: 3,
        byRuleMembers: [ruleCounts('r1', 99)],
        multiRuleMembers: 50,
      }),
    );

    expect(sum(segments)).toBe(4);
    expect(segments.every((s) => s.count >= 0)).toBe(true);
    expect(segments.reduce((n, s) => n + s.percent, 0)).toBeCloseTo(100);
  });

  it('colours named rules from the chart ramp and never inlines a hex itself', () => {
    const segments = toMemberSourceSegments(
      breakdown({ total: 3, direct: 0, ruleBased: 3, byRuleMembers: [ruleCounts('r1', 3)] }),
    ).filter((s) => s.count > 0);

    const [rule] = segments;
    expect(rule.color).toBeTruthy();
    expect(rule.barClass).toBe('');
    // The token buckets keep their Odyssey classes and take no inline colour.
    for (const segment of segments.filter((s) => !s.key.startsWith('rule:'))) {
      expect(segment.barClass).toMatch(/^bg-/);
      expect(segment.color).toBeUndefined();
    }
  });
});

describe('toRuleAttributionRows', () => {
  it('marks an Okta-attributed rule as a fact and a heuristic one as an inference', () => {
    const rows = toRuleAttributionRows(
      breakdown({
        total: 4,
        direct: 0,
        ruleBased: 4,
        byRule: [
          { ruleId: 'r1', ruleName: 'Rule r1', count: 3 },
          { ruleId: 'r2', ruleName: 'Rule r2', count: 1 },
        ],
        byRuleMembers: [
          ruleCounts('r1', 3),
          ruleCounts('r2', 1, { oktaAttributedCount: 0, clientAttributedCount: 1 }),
        ],
      }),
    );

    expect(rows[0]).toMatchObject({ provenance: 'okta', provenanceLabel: 'Okta-attributed' });
    expect(rows[1]).toMatchObject({ provenance: 'inferred', provenanceLabel: 'Inferred' });
    expect(rows[0].provenanceClass).not.toBe(rows[1].provenanceClass);
  });

  it('flags a rule with both kinds of attribution as partly inferred', () => {
    const [row] = toRuleAttributionRows(
      breakdown({
        total: 3,
        direct: 0,
        ruleBased: 3,
        byRule: [{ ruleId: 'r1', ruleName: 'Rule r1', count: 3 }],
        byRuleMembers: [ruleCounts('r1', 3, { oktaAttributedCount: 2, clientAttributedCount: 1 })],
      }),
    );

    expect(row).toMatchObject({ provenance: 'mixed', provenanceLabel: 'Partly inferred' });
    expect(row.provenanceTitle).toContain('2 of 3 attributed by Okta');
  });

  it('claims nothing when the breakdown never recorded provenance', () => {
    const [row] = toRuleAttributionRows(
      breakdown({ byRule: [{ ruleId: 'r1', ruleName: 'Rule r1', count: 3 }] }),
    );

    expect(row).toEqual({ ruleId: 'r1', ruleName: 'Rule r1', count: 3 });
  });

  it('keeps byRule’s attribution counts, which a two-rule member is in twice', () => {
    const rows = toRuleAttributionRows(
      breakdown({
        total: 2,
        direct: 0,
        ruleBased: 2,
        byRule: [
          { ruleId: 'r1', ruleName: 'Rule r1', count: 2 },
          { ruleId: 'r2', ruleName: 'Rule r2', count: 1 },
        ],
        byRuleMembers: [ruleCounts('r1', 1, { oktaAttributedCount: 2 }), ruleCounts('r2', 0)],
        multiRuleMembers: 1,
      }),
    );

    expect(rows.map((r) => r.count)).toEqual([2, 1]);
  });
});

// ===========================================================================
// The attribution → bucket table. This is the enforcement device for
// `MembershipAttribution`: a `Record` keyed by the union is what makes adding a
// new member a compile error here rather than a silent fall-through into the
// confident blue "Rule-managed" segment. These cases guard the *values*; the
// compiler guards the *coverage*.
// ===========================================================================
describe('ATTRIBUTION_BUCKET', () => {
  const ALL_ATTRIBUTIONS: MembershipAttribution[] = ['exact', 'inferred', 'ambiguous'];

  it('maps ONLY a proven classification to the confident bucket', () => {
    expect(ATTRIBUTION_BUCKET.exact).toBe('ruleBased');
  });

  it('sends every guess to the indeterminate bucket, never to Rule-managed', () => {
    for (const attribution of ALL_ATTRIBUTIONS) {
      if (attribution === 'exact') continue;
      expect(ATTRIBUTION_BUCKET[attribution]).toBe('unattributed');
    }
  });

  it('describes every attribution with the same labels the meter legend uses', () => {
    const indeterminate = describeAttribution('ambiguous');
    expect(indeterminate.key).toBe('unattributed');
    expect(indeterminate.label).toBe('Indeterminate');
    expect(indeterminate.barClass).toBe('bg-warning');

    const confident = describeAttribution('exact');
    expect(confident.key).toBe('ruleBased');
    expect(confident.label).toBe('Rule-managed');
    expect(confident.barClass).toBe('bg-primary');
  });

  it('gives every attribution class a described, non-empty bucket', () => {
    for (const attribution of ALL_ATTRIBUTIONS) {
      const described = describeAttribution(attribution);
      expect(described.label).not.toBe('');
      expect(described.description).not.toBe('');
      expect(described.dotClass).not.toBe('');
    }
  });
});
