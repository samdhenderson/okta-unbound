/**
 * Unit tests for the Groups pane's verdict badge.
 *
 * This module is where an attribution can silently become a lie: it compresses a
 * whole hedged sentence into one or two words, so a wrong mapping does not look
 * wrong — it looks confident. Every row of the design's table is pinned here,
 * plus the two invariants that are not in the table: a proven membership
 * (ADR-0031) never wears the deduction variant, and the badge's hover text is
 * `membershipSourceLine`'s own sentence rather than a rewrite of it.
 */
import { describe, it, expect } from 'vitest';
import {
  filterMemberships,
  membershipBucket,
  membershipBucketCounts,
  membershipSummaryLine,
  membershipVerdict,
} from './membershipVerdict';
import { membershipSourceLine } from '../../../shared/membership/sourceLine';
import type { GroupMembership, MembershipRule } from '../../../shared/types';

const rule = (id: string, name: string): MembershipRule => ({
  id,
  name,
  status: 'ACTIVE',
  conditionExpression: 'user.department == "Engineering"',
});

const membership = (over: Partial<GroupMembership> = {}): GroupMembership => ({
  group: { id: '00gFAKE00000000000001', type: 'OKTA_GROUP', profile: { name: 'Engineering' } },
  membershipType: 'RULE_BASED',
  rules: [rule('0prFAKErule00001', 'Auto-add Engineers')],
  attribution: 'exact',
  ...over,
});

describe('membershipVerdict — the design table, row by row', () => {
  it('labels a rule-based membership with exact attribution as a plain Rule', () => {
    const verdict = membershipVerdict(membership({ attribution: 'exact' }));

    expect(verdict.label).toBe('Rule');
    expect(verdict.variant).toBe('primary');
  });

  it('names the rule for an inferred attribution, marked by variant rather than wording', () => {
    const verdict = membershipVerdict(membership({ attribution: 'inferred' }));

    expect(verdict.label).toBe('Rule');
    expect(verdict.variant).toBe('warning');
  });

  it('spells out the candidate count when nothing separates the candidates', () => {
    const verdict = membershipVerdict(
      membership({
        attribution: 'ambiguous',
        rules: [rule('0prFAKErule00001', 'By title'), rule('0prFAKErule00002', 'By group')],
      }),
    );

    expect(verdict.label).toBe('Rule · 2');
    expect(verdict.variant).toBe('warning');
  });

  it('labels an undeduced direct membership as Direct', () => {
    const verdict = membershipVerdict(
      membership({ membershipType: 'DIRECT', rules: [], attribution: 'exact' }),
    );

    expect(verdict.label).toBe('Direct');
    expect(verdict.variant).toBe('success');
  });

  it('labels an app-mastered group with no rules as App', () => {
    const verdict = membershipVerdict(
      membership({
        group: { id: '00gFAKE00000000000002', type: 'APP_GROUP', profile: { name: 'Salesforce' } },
        rules: [],
      }),
    );

    expect(verdict.label).toBe('App');
    expect(verdict.variant).toBe('neutral');
  });

  it('labels an unclassified membership Unresolved', () => {
    const verdict = membershipVerdict(
      membership({ membershipType: 'UNKNOWN', rules: [], attribution: 'ambiguous' }),
    );

    expect(verdict.label).toBe('Unresolved');
    expect(verdict.variant).toBe('warning');
  });

  it('labels a rule-managed membership with no rule attributed Unresolved', () => {
    const verdict = membershipVerdict(membership({ rules: [] }));

    expect(verdict.label).toBe('Unresolved');
    expect(verdict.variant).toBe('warning');
  });
});

/**
 * The table's fourth row says `DIRECT`, **not deduced**. A membership the
 * classifier deduced was a manual add now says `Direct` in the same words as one
 * it proved, so the badge *variant* is the only thing left carrying the
 * difference — which is what these pin.
 */
describe('membershipVerdict — a deduced direct membership', () => {
  const deducedDirect = membership({
    membershipType: 'DIRECT',
    rules: [],
    attribution: 'inferred',
  });
  const provenDirect = membership({
    membershipType: 'DIRECT',
    rules: [],
    attribution: 'exact',
  });

  it('says Direct, but not with a proven membership’s badge variant', () => {
    expect(membershipVerdict(deducedDirect).label).toBe('Direct');
    expect(membershipVerdict(deducedDirect).variant).toBe('warning');
    expect(membershipVerdict(provenDirect).variant).toBe('success');
  });

  it('stays in the direct bucket rather than being swept into unresolved', () => {
    // Its own source line says "Added directly"; a badge saying "Unresolved"
    // beside that sentence would contradict the row it sits on.
    expect(membershipBucket(deducedDirect)).toBe('direct');
  });
});

/**
 * ADR-0031: the reader spent a request to replace one guess with Okta's own
 * answer. If the badge kept hedging, the request bought nothing.
 */
describe('membershipVerdict — a membership Okta answered for', () => {
  it('states a proven rule grant without a hedge, however hedged the guess was', () => {
    const proven = membershipVerdict(
      membership({
        attribution: 'ambiguous',
        rules: [rule('0prFAKErule00001', 'By title'), rule('0prFAKErule00002', 'By group')],
        provenance: { source: 'okta', rules: [{ id: '0prFAKErule00001', name: 'By title' }] },
      }),
    );

    expect(proven.label).toBe('Rule');
    expect(proven.variant).toBe('primary');
  });

  it('states a proven manual add as Direct — an empty answer is an answer', () => {
    const proven = membershipVerdict(
      membership({ attribution: 'inferred', provenance: { source: 'okta', rules: [] } }),
    );

    expect(proven.label).toBe('Direct');
    expect(proven.variant).toBe('success');
  });

  it('never wears the deduction variant, whichever answer Okta gave', () => {
    for (const rules of [[], [{ id: '0prFAKErule00001', name: 'By title' }]]) {
      const proven = membershipVerdict(
        membership({ attribution: 'ambiguous', provenance: { source: 'okta', rules } }),
      );
      expect(proven.variant).not.toBe('warning');
    }
  });
});

describe('membershipVerdict — the caveat is not rewritten', () => {
  it.each([
    ['exact rule', membership({ attribution: 'exact' })],
    ['ambiguous rule', membership({ attribution: 'ambiguous' })],
    ['direct', membership({ membershipType: 'DIRECT', rules: [] })],
    ['unknown', membership({ membershipType: 'UNKNOWN', rules: [], attribution: 'ambiguous' })],
    [
      'proven',
      membership({ provenance: { source: 'okta', rules: [{ id: '0prFAKEhr', name: 'HR sync' }] } }),
    ],
  ])('reuses `membershipSourceLine`’s own sentence for %s', (_case, m) => {
    expect(membershipVerdict(m).title).toBe(membershipSourceLine(m).description);
  });
});

describe('membershipSummaryLine', () => {
  const oneOfEach = [
    membership({ attribution: 'exact' }),
    membership({ membershipType: 'DIRECT', rules: [] }),
    membership({
      group: { id: '00gFAKE00000000000002', type: 'APP_GROUP', profile: { name: 'Salesforce' } },
      rules: [],
    }),
    membership({ membershipType: 'UNKNOWN', rules: [], attribution: 'ambiguous' }),
  ];

  it('names every bucket that has rows in it', () => {
    expect(membershipSummaryLine(oneOfEach)).toBe(
      '1 by rule · 1 direct · 1 app-mastered · 1 unresolved',
    );
  });

  /**
   * The load-bearing one: a summary that drops a category is worse than no
   * summary, because a reader who trusts it concludes those rows do not exist.
   */
  it('accounts for every membership it was given', () => {
    const counts = membershipBucketCounts(oneOfEach);
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

    expect(total).toBe(oneOfEach.length);
  });

  it('omits a bucket that has no rows rather than printing a zero', () => {
    expect(membershipSummaryLine([membership({ attribution: 'exact' })])).toBe('1 by rule');
  });

  it('says nothing at all when there is nothing to count', () => {
    expect(membershipSummaryLine([])).toBe('');
  });
});

describe('filterMemberships', () => {
  const engineering = membership();
  const opsHandbook = membership({
    group: { id: '00gFAKE00000000000002', type: 'OKTA_GROUP', profile: { name: 'Ops Handbook' } },
    membershipType: 'DIRECT',
    rules: [],
  });

  it('matches on the group name', () => {
    expect(filterMemberships([engineering, opsHandbook], 'ops', 'all')).toEqual([opsHandbook]);
  });

  it('matches on the rule named in the source line, not just the group', () => {
    // "Auto-add Engineers" appears nowhere in the group name.
    expect(filterMemberships([engineering, opsHandbook], 'auto-add', 'all')).toEqual([engineering]);
  });

  it('narrows to one bucket when a pill is selected', () => {
    expect(filterMemberships([engineering, opsHandbook], '', 'direct')).toEqual([opsHandbook]);
  });

  it('applies the query and the bucket together', () => {
    expect(filterMemberships([engineering, opsHandbook], 'ops', 'rule')).toEqual([]);
  });

  it('returns everything for a blank query and no bucket', () => {
    expect(filterMemberships([engineering, opsHandbook], '   ', 'all')).toHaveLength(2);
  });
});
