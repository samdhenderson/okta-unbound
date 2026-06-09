import { describe, it, expect } from 'vitest';
import {
  computeAllBreakdowns,
  computeMfaBreakdown,
  filterMembers,
  getMemberDimensionValue,
  memberMatchesMfaValue,
  NONE_VALUE,
  OTHER_VALUE,
  type MemberFilter,
} from './memberAnalytics';
import type { OktaUser, MemberMfaResult } from '../../../../shared/types';
import { summarizeFactors } from '../../../../shared/utils/mfaUtils';

const user = (id: string, profile: Partial<OktaUser['profile']>, status: OktaUser['status'] = 'ACTIVE'): OktaUser => ({
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
      user(`u${i}`, { department: `Dept${i}` })
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
    const filters: MemberFilter[] = [
      { dimension: 'department', value: NONE_VALUE, label: 'none' },
    ];
    const result = filterMembers(members, '', filters, null);
    expect(result.map((m) => m.id)).toEqual(['dave']);
  });

  it('filters by mfa facets using scan results', () => {
    const mfa = new Map<string, MemberMfaResult>([
      ['alice', summarizeFactors('alice', [{ id: '1', factorType: 'sms', provider: 'OKTA', status: 'ACTIVE' }])],
      ['bob', summarizeFactors('bob', [])],
    ]);
    const filters: MemberFilter[] = [{ dimension: 'mfa', value: 'has:SMS', label: 'Has SMS' }];
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

  it('evaluates none / multiple / has: / enrolled', () => {
    expect(memberMatchesMfaValue(none, 'none')).toBe(true);
    expect(memberMatchesMfaValue(enrolled, 'none')).toBe(false);
    expect(memberMatchesMfaValue(enrolled, 'multiple')).toBe(true);
    expect(memberMatchesMfaValue(enrolled, 'has:SMS')).toBe(true);
    expect(memberMatchesMfaValue(enrolled, 'has:Voice Call')).toBe(false);
    expect(memberMatchesMfaValue(enrolled, 'enrolled')).toBe(true);
    expect(memberMatchesMfaValue(undefined, 'none')).toBe(false);
  });
});

describe('computeMfaBreakdown', () => {
  it('builds none, multiple, and per-label rows', () => {
    const mfa = new Map<string, MemberMfaResult>([
      ['alice', summarizeFactors('alice', [
        { id: '1', factorType: 'push', provider: 'OKTA', status: 'ACTIVE' },
        { id: '2', factorType: 'sms', provider: 'OKTA', status: 'ACTIVE' },
      ])],
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
