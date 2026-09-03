import { describe, it, expect } from 'vitest';
import {
  computeAllBreakdowns,
  computeDimensionBreakdown,
  computeMfaBreakdown,
  discoverAttributeBreakdowns,
  dimensionTitle,
  filterMembers,
  getMemberDimensionValue,
  getObservedFactorLabels,
  humanizeAttributeKey,
  memberMatchesMfaValue,
  outlierValues,
  sortMembers,
  attributeDriftValues,
  attributeSignals,
  attributeTailCount,
  nearDuplicateValues,
  normalizeAttributeValue,
  rankAttributes,
  DRIFT_WEIGHT,
  RULE_WEIGHT,
  TAIL_SHARE_THRESHOLD,
  TAIL_WEIGHT,
  NONE_VALUE,
  OTHER_VALUE,
  RESERVED_DIMENSIONS,
  SOURCE_DIMENSION,
  type AttributeSummary,
  type MemberFilter,
} from './memberAnalytics';
import type { OktaUser, MemberMfaResult } from '../../../shared/types';
import { summarizeFactors } from '../../../shared/utils/mfaUtils';

const user = (
  id: string,
  profile: Partial<OktaUser['profile']>,
  status: OktaUser['status'] = 'ACTIVE',
): OktaUser => ({
  id,
  status,
  profile: {
    login: `${id}@example.com`,
    email: `${id}@example.com`,
    firstName: id,
    lastName: 'Test',
    ...profile,
  },
});

const members: OktaUser[] = [
  user('alice', { department: 'Engineering', title: 'Engineer' }),
  user('bob', { department: 'Engineering', title: 'Manager' }),
  user('carol', { department: 'Sales' }, 'SUSPENDED'),
  user('dave', {}, 'DEPROVISIONED'), // no department
];

describe('getMemberDimensionValue', () => {
  it('reads status and profile fields, trimming strings', () => {
    expect(getMemberDimensionValue(members[0], 'status')).toBe('ACTIVE');
    expect(getMemberDimensionValue(members[0], 'department')).toBe('Engineering');
    expect(getMemberDimensionValue(user('x', { city: '  NYC  ' }), 'city')).toBe('NYC');
    expect(getMemberDimensionValue(members[3], 'department')).toBe('');
  });
});

describe('computeAllBreakdowns', () => {
  it('counts values per dimension with percentages', () => {
    const breakdowns = computeAllBreakdowns(members);
    const dept = breakdowns.department;
    const eng = dept.find((r) => r.value === 'Engineering');
    expect(eng?.count).toBe(2);
    expect(eng?.pct).toBe(50);
  });

  it('buckets missing values into a (none) row', () => {
    const breakdowns = computeAllBreakdowns(members);
    const none = breakdowns.department.find((r) => r.value === NONE_VALUE);
    expect(none?.count).toBe(1);
    expect(none?.label).toBe('(none)');
  });

  it('aggregates the tail beyond maxRows into an Other row', () => {
    const many: OktaUser[] = Array.from({ length: 12 }, (_, i) =>
      user(`u${i}`, { department: `Dept${i}` }),
    );
    const breakdowns = computeAllBreakdowns(many, 8);
    const other = breakdowns.department.find((r) => r.value === OTHER_VALUE);
    expect(other).toBeDefined();
    expect(other?.count).toBe(4); // 12 distinct - 8 kept = 4 aggregated
  });
});

describe('filterMembers', () => {
  it('returns all members with no query or filters', () => {
    expect(filterMembers(members, '', [], null)).toHaveLength(4);
  });

  it('filters by free-text query across name/email/login', () => {
    const result = filterMembers(members, 'alice', [], null);
    expect(result.map((m) => m.id)).toEqual(['alice']);
  });

  it('ORs values within a dimension', () => {
    const filters: MemberFilter[] = [
      { dimension: 'status', value: 'SUSPENDED', label: 's' },
      { dimension: 'status', value: 'DEPROVISIONED', label: 'd' },
    ];
    const result = filterMembers(members, '', filters, null);
    expect(result.map((m) => m.id).sort()).toEqual(['carol', 'dave']);
  });

  it('ANDs across dimensions', () => {
    const filters: MemberFilter[] = [
      { dimension: 'department', value: 'Engineering', label: 'eng' },
      { dimension: 'title', value: 'Manager', label: 'mgr' },
    ];
    const result = filterMembers(members, '', filters, null);
    expect(result.map((m) => m.id)).toEqual(['bob']);
  });

  it('matches the (none) sentinel against missing attributes', () => {
    const filters: MemberFilter[] = [{ dimension: 'department', value: NONE_VALUE, label: 'none' }];
    const result = filterMembers(members, '', filters, null);
    expect(result.map((m) => m.id)).toEqual(['dave']);
  });

  it('filters by mfa facets using scan results', () => {
    const mfa = new Map<string, MemberMfaResult>([
      [
        'alice',
        summarizeFactors('alice', [
          { id: '1', factorType: 'sms', provider: 'OKTA', status: 'ACTIVE' },
        ]),
      ],
      ['bob', summarizeFactors('bob', [])],
    ]);
    const filters: MemberFilter[] = [{ dimension: 'mfa', value: 'has:SMS', label: 'Has SMS' }];
    const result = filterMembers([members[0], members[1]], '', filters, mfa);
    expect(result.map((m) => m.id)).toEqual(['alice']);
  });

  it('ANDs multiple mfa constraints, supporting has + missing together', () => {
    const mfa = new Map<string, MemberMfaResult>([
      // alice: SMS only
      [
        'alice',
        summarizeFactors('alice', [
          { id: '1', factorType: 'sms', provider: 'OKTA', status: 'ACTIVE' },
        ]),
      ],
      // bob: SMS + Okta Verify Push
      [
        'bob',
        summarizeFactors('bob', [
          { id: '1', factorType: 'sms', provider: 'OKTA', status: 'ACTIVE' },
          { id: '2', factorType: 'push', provider: 'OKTA', status: 'ACTIVE' },
        ]),
      ],
    ]);
    // Has SMS AND Missing Okta Verify Push -> only alice
    const filters: MemberFilter[] = [
      { dimension: 'mfa', value: 'has:SMS', label: 'Has SMS' },
      { dimension: 'mfa', value: 'missing:Okta Verify Push', label: 'Missing Okta Verify Push' },
    ];
    const result = filterMembers([members[0], members[1]], '', filters, mfa);
    expect(result.map((m) => m.id)).toEqual(['alice']);
  });
});

describe('memberMatchesMfaValue', () => {
  const enrolled = summarizeFactors('u', [
    { id: '1', factorType: 'push', provider: 'OKTA', status: 'ACTIVE' },
    { id: '2', factorType: 'sms', provider: 'OKTA', status: 'ACTIVE' },
  ]);
  const none = summarizeFactors('u', []);

  it('evaluates none / multiple / has: / missing: / enrolled', () => {
    expect(memberMatchesMfaValue(none, 'none')).toBe(true);
    expect(memberMatchesMfaValue(enrolled, 'none')).toBe(false);
    expect(memberMatchesMfaValue(enrolled, 'multiple')).toBe(true);
    expect(memberMatchesMfaValue(enrolled, 'has:SMS')).toBe(true);
    expect(memberMatchesMfaValue(enrolled, 'has:Voice Call')).toBe(false);
    expect(memberMatchesMfaValue(enrolled, 'enrolled')).toBe(true);
    expect(memberMatchesMfaValue(undefined, 'none')).toBe(false);
  });

  it('handles missing: as negation, including unscanned members', () => {
    expect(memberMatchesMfaValue(enrolled, 'missing:SMS')).toBe(false); // has it
    expect(memberMatchesMfaValue(enrolled, 'missing:Voice Call')).toBe(true); // lacks it
    expect(memberMatchesMfaValue(none, 'missing:SMS')).toBe(true); // no factors
    expect(memberMatchesMfaValue(undefined, 'missing:SMS')).toBe(true); // unscanned -> lacks it
  });
});

describe('sortMembers', () => {
  it('sorts by name ascending and descending', () => {
    const asc = sortMembers(members, 'name', false, null).map((m) => m.id);
    const desc = sortMembers(members, 'name', true, null).map((m) => m.id);
    expect(asc).toEqual(['alice', 'bob', 'carol', 'dave']);
    expect(desc).toEqual(['dave', 'carol', 'bob', 'alice']);
  });

  it('sorts by factor count using scan results', () => {
    const mfa = new Map<string, MemberMfaResult>([
      [
        'alice',
        summarizeFactors('alice', [
          { id: '1', factorType: 'sms', provider: 'OKTA', status: 'ACTIVE' },
          { id: '2', factorType: 'push', provider: 'OKTA', status: 'ACTIVE' },
        ]),
      ],
      ['bob', summarizeFactors('bob', [])],
    ]);
    const result = sortMembers([members[0], members[1]], 'factors', true, mfa).map((m) => m.id);
    expect(result).toEqual(['alice', 'bob']); // alice has more factors, desc first
  });
});

describe('humanizeAttributeKey / dimensionTitle', () => {
  it('humanizes camelCase and snake_case keys', () => {
    expect(humanizeAttributeKey('costCenter')).toBe('Cost center');
    expect(humanizeAttributeKey('employee_type')).toBe('Employee type');
    expect(humanizeAttributeKey('customBadge99')).toBe('Custom badge 99');
  });

  it('prefers curated titles, else humanizes', () => {
    expect(dimensionTitle('countryCode')).toBe('Country');
    expect(dimensionTitle('favoriteColor')).toBe('Favorite color');
  });
});

describe('discoverAttributeBreakdowns', () => {
  it('discovers populated profile attributes with distributions', () => {
    const attrs = discoverAttributeBreakdowns(members);
    const keys = attrs.map((a) => a.key);
    expect(keys).toContain('department');
    expect(keys).toContain('title');
    const dept = attrs.find((a) => a.key === 'department')!;
    expect(dept.label).toBe('Department');
    expect(dept.distinct).toBe(2); // Engineering, Sales
    expect(dept.populated).toBe(3); // dave has none
    // A (none) row is folded in so the spread stays honest.
    expect(dept.rows.some((r) => r.value === NONE_VALUE && r.count === 1)).toBe(true);
  });

  it('excludes identity / PII fields even when present', () => {
    const keys = discoverAttributeBreakdowns(members).map((a) => a.key);
    for (const k of ['login', 'email', 'firstName', 'lastName']) {
      expect(keys).not.toContain(k);
    }
  });

  it('surfaces arbitrary custom attributes and coerces non-string values', () => {
    const custom: OktaUser[] = [
      user('a', { costCenter: 'CC-1', remote: true } as never),
      user('b', { costCenter: 'CC-1', remote: false } as never),
      user('c', { costCenter: 'CC-2', remote: true } as never),
    ];
    const attrs = discoverAttributeBreakdowns(custom);
    const remote = attrs.find((a) => a.key === 'remote')!;
    expect(remote).toBeDefined();
    expect(remote.distinct).toBe(2); // "true" / "false"
    expect(remote.rows.find((r) => r.value === 'true')?.count).toBe(2);
  });

  it('drops identifier-like attributes where nearly every value is unique', () => {
    const many: OktaUser[] = Array.from({ length: 20 }, (_, i) =>
      user(`u${i}`, { department: 'Eng', badgeId: `B-${i}` } as never),
    );
    const keys = discoverAttributeBreakdowns(many).map((a) => a.key);
    expect(keys).toContain('department'); // one shared value — kept
    expect(keys).not.toContain('badgeId'); // 20 distinct of 20 — pruned
  });

  it('keeps high-cardinality attributes in small groups (below the guard floor)', () => {
    const few: OktaUser[] = Array.from({ length: 4 }, (_, i) =>
      user(`u${i}`, { costCenter: `CC-${i}` }),
    );
    const keys = discoverAttributeBreakdowns(few).map((a) => a.key);
    expect(keys).toContain('costCenter');
  });

  it('orders common organizational attributes ahead of the rest', () => {
    const rich: OktaUser[] = [
      user('a', { department: 'Eng', title: 'SWE', costCenter: 'CC-1', zzCustom: 'x' } as never),
      user('b', { department: 'Sales', title: 'AE', costCenter: 'CC-2', zzCustom: 'y' } as never),
    ];
    const order = discoverAttributeBreakdowns(rich).map((a) => a.key);
    expect(order.indexOf('department')).toBeLessThan(order.indexOf('costCenter'));
    expect(order.indexOf('title')).toBeLessThan(order.indexOf('zzCustom'));
  });
});

describe('computeDimensionBreakdown', () => {
  it('returns the full distribution without an Other row by default', () => {
    const many: OktaUser[] = Array.from({ length: 12 }, (_, i) =>
      user(`u${i}`, { department: `Dept${i}` }),
    );
    const rows = computeDimensionBreakdown(many, 'department');
    expect(rows).toHaveLength(12);
    expect(rows.some((r) => r.value === OTHER_VALUE)).toBe(false);
  });

  /*
    The Insights card's "Other (N values)" drill-in depends on exactly this:
    `discoverAttributeBreakdowns` keeps only `maxRows` values and folds the rest
    into an aggregate that *discards* which values they were, so the tail has to
    be recoverable from the roster instead of carried through the summary.
  */
  it('recovers the values a truncated summary folded into its Other row', () => {
    // Two members per department, so the distribution has a real spread and is
    // not dropped by the near-unique identifier guard.
    const many: OktaUser[] = Array.from({ length: 40 }, (_, i) =>
      user(`u${i}`, { department: `Dept${String(i % 20).padStart(2, '0')}` }),
    );

    const summary = discoverAttributeBreakdowns(many, { maxRows: 6 }).find(
      (a) => a.key === 'department',
    );
    const other = summary?.rows.find((r) => r.value === OTHER_VALUE);

    // The summary aggregates the tail and names none of it.
    expect(other).toBeDefined();
    expect(other?.label).toBe('Other (14 values)');
    expect(other?.count).toBe(28);
    expect(JSON.stringify(summary?.rows)).not.toContain('Dept19');

    // The full distribution re-derived from the same roster names all of it.
    const full = computeDimensionBreakdown(many, 'department');
    const named = summary?.rows
      .filter((r) => r.value !== OTHER_VALUE && r.value !== NONE_VALUE)
      .map((r) => r.value);
    const hidden = full.map((r) => r.value).filter((v) => !named?.includes(v));

    expect(hidden).toHaveLength(14);
    expect(hidden).toContain('Dept19');
    expect(hidden.reduce((sum, v) => sum + (full.find((r) => r.value === v)?.count ?? 0), 0)).toBe(
      other?.count,
    );
  });
});

describe('getObservedFactorLabels', () => {
  it('returns the sorted union of factor labels across results', () => {
    const mfa = new Map<string, MemberMfaResult>([
      [
        'alice',
        summarizeFactors('alice', [
          { id: '1', factorType: 'sms', provider: 'OKTA', status: 'ACTIVE' },
        ]),
      ],
      [
        'bob',
        summarizeFactors('bob', [
          { id: '2', factorType: 'push', provider: 'OKTA', status: 'ACTIVE' },
        ]),
      ],
    ]);
    expect(getObservedFactorLabels(mfa)).toEqual(['Okta Verify Push', 'SMS']);
    expect(getObservedFactorLabels(null)).toEqual([]);
  });
});

describe('computeMfaBreakdown', () => {
  it('builds none, multiple, and per-label rows', () => {
    const mfa = new Map<string, MemberMfaResult>([
      [
        'alice',
        summarizeFactors('alice', [
          { id: '1', factorType: 'push', provider: 'OKTA', status: 'ACTIVE' },
          { id: '2', factorType: 'sms', provider: 'OKTA', status: 'ACTIVE' },
        ]),
      ],
      ['bob', summarizeFactors('bob', [])],
    ]);
    const rows = computeMfaBreakdown([members[0], members[1]], mfa);
    const byValue = Object.fromEntries(rows.map((r) => [r.value, r.count]));
    expect(byValue['none']).toBe(1); // bob
    expect(byValue['multiple']).toBe(1); // alice
    expect(byValue['has:SMS']).toBe(1);
    expect(byValue['has:Okta Verify Push']).toBe(1);
  });

  it('returns no rows when there is no scan', () => {
    expect(computeMfaBreakdown(members, null)).toEqual([]);
  });
});

describe('filterMembers by membership source', () => {
  // Ids per bucket, exactly the shape `buildMemberSourceIndex` produces.
  const buckets = new Map<string, ReadonlySet<string>>([
    ['rule:r1', new Set(['alice', 'bob'])],
    ['direct', new Set(['carol'])],
    ['unattributed', new Set(['dave'])],
  ]);

  const sourceFilter = (value: string): MemberFilter => ({
    dimension: SOURCE_DIMENSION,
    value,
    label: value,
  });

  it('selects the members in the chosen bucket', () => {
    const result = filterMembers(members, '', [sourceFilter('direct')], null, buckets);
    expect(result.map((m) => m.id)).toEqual(['carol']);
  });

  it('ORs within the dimension, like any other facet', () => {
    const result = filterMembers(
      members,
      '',
      [sourceFilter('direct'), sourceFilter('unattributed')],
      null,
      buckets,
    );
    expect(result.map((m) => m.id)).toEqual(['carol', 'dave']);
  });

  it('ANDs across dimensions', () => {
    const result = filterMembers(
      members,
      '',
      [sourceFilter('rule:r1'), { dimension: 'title', value: 'Manager', label: 'Manager' }],
      null,
      buckets,
    );
    expect(result.map((m) => m.id)).toEqual(['bob']);
  });

  it('still applies the free-text query', () => {
    const result = filterMembers(members, 'alice', [sourceFilter('rule:r1')], null, buckets);
    expect(result.map((m) => m.id)).toEqual(['alice']);
  });

  it('matches nobody for a bucket the index does not carry', () => {
    // Not the same as an empty bucket: `multiRule` is absent because nobody is
    // in it, and "nobody" is the honest answer either way.
    expect(filterMembers(members, '', [sourceFilter('multiRule')], null, buckets)).toEqual([]);
  });

  it('matches nobody — never everybody — when no index was supplied', () => {
    // The state should be unreachable (source pills only render once the
    // analysis has run). If it is reached, an unevaluable constraint satisfying
    // everyone would leave a pill looking active while changing nothing.
    expect(filterMembers(members, '', [sourceFilter('direct')], null, null)).toEqual([]);
    expect(filterMembers(members, '', [sourceFilter('direct')], null)).toEqual([]);
  });

  it('is unaffected when no source filter is active', () => {
    expect(filterMembers(members, '', [], null, null)).toHaveLength(members.length);
  });
});

describe('RESERVED_DIMENSIONS', () => {
  it('keeps a profile attribute from colliding with a built-in dimension', () => {
    // An org really can define a custom `source` attribute. Discovering it would
    // produce a facet whose filters are indistinguishable from the
    // membership-source pills, since `Dimension` is a bare string.
    const colliding = [
      user('a', { source: 'Workday', status: 'Contractor' } as Partial<OktaUser['profile']>),
      user('b', { source: 'Manual', status: 'Contractor' } as Partial<OktaUser['profile']>),
    ];

    const keys = discoverAttributeBreakdowns(colliding).map((summary) => summary.key);

    expect(keys).not.toContain('source');
    expect(keys).not.toContain('status');
    expect(RESERVED_DIMENSIONS.has('mfa')).toBe(true);
  });
});

/*
  `outlierValues` accuses a record of being wrong, so every case here is about
  the guards rather than the happy path: what it must *not* flag.
*/
describe('outlierValues', () => {
  const summaryOf = (
    rows: Array<[string, number]>,
    total: number,
    blanks = 0,
  ): AttributeSummary => {
    const populated = rows.reduce((sum, [, count]) => sum + count, 0);
    return {
      key: 'department',
      label: 'Department',
      distinct: rows.length,
      populated,
      total,
      fillRate: (populated / total) * 100,
      rows: [
        ...rows.map(([value, count]) => ({
          value,
          label: value,
          count,
          pct: (count / total) * 100,
        })),
        ...(blanks > 0
          ? [{ value: NONE_VALUE, label: '(none)', count: blanks, pct: (blanks / total) * 100 }]
          : []),
      ],
    };
  };

  it('flags the handful that diverge from a dominant house style', () => {
    const summary = summaryOf(
      [
        ['Engineering', 94],
        ['engineering', 3],
        ['ENGINEERING', 3],
      ],
      100,
    );
    expect(outlierValues(summary)).toEqual(['engineering', 'ENGINEERING']);
  });

  it('never flags the dominant value itself', () => {
    const summary = summaryOf(
      [
        ['Engineering', 94],
        ['engineering', 6],
      ],
      100,
    );
    expect(outlierValues(summary)).not.toContain('Engineering');
  });

  it('flags nothing when there is no dominant value to diverge from', () => {
    // A legitimate three-way split. Calling the 25% arm an error would be nonsense.
    const summary = summaryOf(
      [
        ['Engineering', 40],
        ['Sales', 35],
        ['Support', 25],
      ],
      100,
    );
    expect(outlierValues(summary)).toEqual([]);
  });

  it('never flags blanks — an empty attribute is a different problem', () => {
    const summary = summaryOf([['Engineering', 95]], 100, 5);
    expect(outlierValues(summary)).toEqual([]);
  });

  it('never flags the aggregated Other bucket, which is not one value', () => {
    const summary: AttributeSummary = {
      key: 'department',
      label: 'Department',
      distinct: 9,
      populated: 100,
      total: 100,
      rows: [
        { value: 'Engineering', label: 'Engineering', count: 94, pct: 94 },
        { value: OTHER_VALUE, label: 'Other', count: 6, pct: 6 },
      ],
      fillRate: 100,
    };
    expect(outlierValues(summary)).toEqual([]);
  });

  it('measures share against the populated rows, not the whole roster', () => {
    // Half the group is blank; among the people who *do* have a value, one
    // spelling dominates and one diverges. The blanks must not dilute that.
    const summary = summaryOf(
      [
        ['Engineering', 48],
        ['engineering', 2],
      ],
      100,
      50,
    );
    expect(outlierValues(summary)).toEqual(['engineering']);
  });

  it('flags nothing when only one value exists', () => {
    expect(outlierValues(summaryOf([['Engineering', 100]], 100))).toEqual([]);
  });
});

/*
  The drift heuristic, tested from both ends.

  A near-duplicate check is the kind of rule that goes wrong by being too
  eager — every case below that must *not* collide is a case where a reader
  would be told two legitimately different values are one mistake. Those are
  the tests worth having; the happy path is one line.
*/
describe('normalizeAttributeValue', () => {
  it('folds case, outer whitespace and internal whitespace runs — and nothing else', () => {
    expect(normalizeAttributeValue('  Engineering  ')).toBe('engineering');
    expect(normalizeAttributeValue('Platform   Engineering')).toBe('platform engineering');
    expect(normalizeAttributeValue('Platform\tEngineering')).toBe('platform engineering');
    // Punctuation, abbreviation and spelling survive untouched: only a human can
    // say whether `Eng.` and `Engineering` are the same team.
    expect(normalizeAttributeValue('Eng.')).toBe('eng.');
    expect(normalizeAttributeValue('R&D')).toBe('r&d');
  });
});

describe('nearDuplicateValues', () => {
  it('collides values that differ only in case', () => {
    expect(nearDuplicateValues(['Engineering', 'engineering', 'Sales'])).toEqual([
      'Engineering',
      'engineering',
    ]);
  });

  it('collides values that differ only in whitespace', () => {
    expect(nearDuplicateValues(['Engineering', 'Engineering ', 'Sales'])).toEqual([
      'Engineering',
      'Engineering ',
    ]);
    expect(nearDuplicateValues(['Platform Engineering', 'Platform  Engineering'])).toEqual([
      'Platform Engineering',
      'Platform  Engineering',
    ]);
  });

  it('reports every member of a collision, not just the first pair', () => {
    expect(nearDuplicateValues(['Engineering', 'engineering', 'ENGINEERING'])).toEqual([
      'Engineering',
      'engineering',
      'ENGINEERING',
    ]);
  });

  it('reports two separate collisions separately, grouped', () => {
    expect(
      nearDuplicateValues(['Engineering', 'Sales', 'engineering', 'sales', 'Support']),
    ).toEqual(['Engineering', 'engineering', 'Sales', 'sales']);
  });

  // --- what it must NOT flag ------------------------------------------------

  it('does not flag genuinely different values', () => {
    expect(nearDuplicateValues(['Engineering', 'Sales', 'Support'])).toEqual([]);
  });

  it('does not flag an abbreviation of another value', () => {
    // `Eng` may well *mean* `Engineering`, but nothing here can know that, and
    // saying so would accuse a correct record of being wrong.
    expect(nearDuplicateValues(['Eng', 'Engineering'])).toEqual([]);
  });

  it('does not flag values differing by punctuation', () => {
    expect(nearDuplicateValues(['CC-1000', 'CC1000'])).toEqual([]);
    expect(nearDuplicateValues(['R&D', 'R and D'])).toEqual([]);
  });

  it('does not flag values differing only in an accent', () => {
    // Two spellings, but not the same string with the shift key held — a
    // localization question, not a data-entry slip.
    expect(nearDuplicateValues(['Zurich', 'Zürich'])).toEqual([]);
  });

  it('does not flag a single value against itself, however it is repeated', () => {
    expect(nearDuplicateValues(['Engineering'])).toEqual([]);
    expect(nearDuplicateValues(['Engineering', 'Engineering'])).toEqual([]);
  });

  it('never flags blanks — every empty value would otherwise collide with every other', () => {
    expect(nearDuplicateValues(['', '   ', '\t', 'Engineering'])).toEqual([]);
  });

  it('flags nothing in an empty set', () => {
    expect(nearDuplicateValues([])).toEqual([]);
  });
});

/*
  Drift found at *discovery* time, over the full value map — the case the visible
  rows cannot see, and the whole reason `driftValues` is carried on the summary.
*/
describe('discoverAttributeBreakdowns drift detection', () => {
  it('sees a mis-spelling that the summary folded into its Other row', () => {
    const members: OktaUser[] = [
      ...Array.from({ length: 30 }, (_, i) => user(`e${i}`, { department: 'Engineering' })),
      ...Array.from({ length: 12 }, (_, i) => user(`d${i}`, { department: `Dept${i % 6}` })),
      // One straggler, far down the tail and invisible to the top-6 rows.
      user('drift', { department: 'engineering' }),
    ];

    const summary = discoverAttributeBreakdowns(members, { maxRows: 6 }).find(
      (a) => a.key === 'department',
    );

    // The tail hides it: no visible row names `engineering`.
    expect(summary?.rows.some((r) => r.label === 'engineering')).toBe(false);
    // The summary caught it anyway.
    expect(summary?.driftValues).toEqual(['Engineering', 'engineering']);

    // And `outlierValues`, which only ever sees the named rows, cannot.
    expect(outlierValues(summary as AttributeSummary)).not.toContain('engineering');
  });

  it('carries an empty drift list for a clean attribute', () => {
    const members = Array.from({ length: 20 }, (_, i) =>
      user(`u${i}`, { department: i % 2 === 0 ? 'Engineering' : 'Sales' }),
    );
    const summary = discoverAttributeBreakdowns(members).find((a) => a.key === 'department');
    expect(summary?.driftValues).toEqual([]);
  });
});

/*
  The scoring. Each signal is exercised alone so a weight cannot be attributed to
  the wrong test, then all three together, then at the split boundary.
*/
describe('attributeSignals', () => {
  const summaryOf = (
    rows: Array<[string, number]>,
    total: number,
    extra: Partial<AttributeSummary> = {},
  ): AttributeSummary => {
    const populated = rows.reduce((sum, [, c]) => sum + c, 0);
    return {
      key: 'department',
      label: 'Department',
      distinct: rows.length,
      populated,
      total,
      fillRate: (populated / total) * 100,
      rows: rows.map(([value, count]) => ({
        value,
        label: value === OTHER_VALUE ? 'Other (4 values)' : value,
        count,
        pct: (count / total) * 100,
      })),
      ...extra,
    };
  };

  it('reports drift alone, at its weight', () => {
    const signals = attributeSignals(
      summaryOf(
        [
          ['Engineering', 60],
          ['engineering', 40],
        ],
        100,
      ),
      0,
    );
    expect(signals.map((s) => s.kind)).toEqual(['drift']);
    expect(signals[0]?.weight).toBe(DRIFT_WEIGHT);
  });

  it('reports the hidden tail alone, at its weight', () => {
    const signals = attributeSignals(
      summaryOf(
        [
          ['Engineering', 70],
          [OTHER_VALUE, 30],
        ],
        100,
      ),
      0,
    );
    expect(signals.map((s) => s.kind)).toEqual(['tail']);
    expect(signals[0]?.weight).toBe(TAIL_WEIGHT);
  });

  it('reports rule coupling alone, at its weight', () => {
    const signals = attributeSignals(summaryOf([['Engineering', 100]], 100), 2);
    expect(signals.map((s) => s.kind)).toEqual(['rule']);
    expect(signals[0]?.weight).toBe(RULE_WEIGHT);
  });

  it('composes all three, in badge order', () => {
    const signals = attributeSignals(
      summaryOf(
        [
          ['Engineering', 50],
          ['engineering', 20],
          [OTHER_VALUE, 30],
        ],
        100,
      ),
      1,
    );
    expect(signals.map((s) => s.kind)).toEqual(['drift', 'tail', 'rule']);
    expect(signals.reduce((sum, s) => sum + s.weight, 0)).toBe(
      DRIFT_WEIGHT + TAIL_WEIGHT + RULE_WEIGHT,
    );
  });

  it('reports nothing for a clean, uncoupled, fully-named attribute', () => {
    expect(
      attributeSignals(
        summaryOf(
          [
            ['Engineering', 60],
            ['Sales', 40],
          ],
          100,
        ),
        0,
      ),
    ).toEqual([]);
  });

  it('holds the tail signal exactly at the threshold, and drops it one member below', () => {
    const at = summaryOf(
      [
        ['Engineering', 100 - TAIL_SHARE_THRESHOLD],
        [OTHER_VALUE, TAIL_SHARE_THRESHOLD],
      ],
      100,
    );
    const below = summaryOf(
      [
        ['Engineering', 100 - TAIL_SHARE_THRESHOLD + 1],
        [OTHER_VALUE, TAIL_SHARE_THRESHOLD - 1],
      ],
      100,
    );
    expect(attributeSignals(at, 0).map((s) => s.kind)).toEqual(['tail']);
    expect(attributeSignals(below, 0)).toEqual([]);
  });

  it("prefers the summary's own drift list over what the visible rows show", () => {
    // The rows are clean; the discovery pass saw the tail and says otherwise.
    const summary = summaryOf([['Engineering', 100]], 100, {
      driftValues: ['Engineering', 'engineering'],
    });
    expect(attributeDriftValues(summary)).toEqual(['Engineering', 'engineering']);
    expect(attributeSignals(summary, 0).map((s) => s.kind)).toEqual(['drift']);
  });

  it('states each signal as a phrase, never a bare number', () => {
    // A collapsed card shows only these strings; a "3" would explain nothing.
    const signals = attributeSignals(
      summaryOf(
        [
          ['Engineering', 50],
          ['engineering', 20],
          [OTHER_VALUE, 30],
        ],
        100,
      ),
      1,
    );
    for (const signal of signals) {
      expect(signal.label).toMatch(/[a-z]{3}/i);
      expect(signal.description.length).toBeGreaterThan(signal.label.length);
    }
  });

  it('counts the tail off the summary, and zero when nothing was folded away', () => {
    expect(attributeTailCount(summaryOf([['Engineering', 100]], 100))).toBe(0);
    expect(
      attributeTailCount(
        summaryOf(
          [
            ['Engineering', 70],
            [OTHER_VALUE, 30],
          ],
          100,
        ),
      ),
    ).toBe(30);
  });
});

describe('rankAttributes', () => {
  const clean = (key: string): AttributeSummary => ({
    key,
    label: key,
    distinct: 2,
    populated: 100,
    total: 100,
    fillRate: 100,
    rows: [
      { value: 'A', label: 'A', count: 60, pct: 60 },
      { value: 'B', label: 'B', count: 40, pct: 40 },
    ],
    driftValues: [],
  });

  const drifting = (key: string): AttributeSummary => ({
    ...clean(key),
    driftValues: ['Engineering', 'engineering'],
  });

  const tailed = (key: string): AttributeSummary => ({
    ...clean(key),
    rows: [
      { value: 'A', label: 'A', count: 70, pct: 70 },
      { value: OTHER_VALUE, label: 'Other (5 values)', count: 30, pct: 30 },
    ],
  });

  it('sorts by score, descending', () => {
    const ranked = rankAttributes([clean('quiet'), tailed('tail'), drifting('drift')], () => 0);
    expect(ranked.map((r) => r.summary.key)).toEqual(['drift', 'tail', 'quiet']);
    expect(ranked.map((r) => r.score)).toEqual([DRIFT_WEIGHT, TAIL_WEIGHT, 0]);
  });

  it('ranks drift above a rule dependency — the drift is what breaks the rule', () => {
    const ranked = rankAttributes([clean('ruleFed'), drifting('drift')], (key) =>
      key === 'ruleFed' ? 3 : 0,
    );
    expect(ranked.map((r) => r.summary.key)).toEqual(['drift', 'ruleFed']);
  });

  it('keeps discovery order inside a score — the sort is stable', () => {
    const ranked = rankAttributes([clean('department'), clean('title'), clean('city')], () => 0);
    expect(ranked.map((r) => r.summary.key)).toEqual(['department', 'title', 'city']);
  });

  it('splits flagged from quiet at a score of zero', () => {
    const ranked = rankAttributes([clean('quiet'), drifting('drift'), clean('coupled')], (key) =>
      key === 'coupled' ? 1 : 0,
    );
    const flagged = ranked.filter((r) => r.flagged).map((r) => r.summary.key);
    const quiet = ranked.filter((r) => !r.flagged).map((r) => r.summary.key);
    // One rule is enough to be flagged; nothing at all is not.
    expect(flagged).toEqual(['drift', 'coupled']);
    expect(quiet).toEqual(['quiet']);
  });

  it('ranks an empty set to an empty result', () => {
    expect(rankAttributes([], () => 0)).toEqual([]);
  });
});
