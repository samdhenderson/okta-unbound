/**
 * Unit tests for `analyzeMemberships`, pinning the in-file UsersTab heuristic
 * AS-IS (no rule-exclusion logic — that is the divergent useUserMemberships copy).
 */
import { describe, it, expect } from 'vitest';
import { analyzeMemberships } from './membershipAnalysis';
import type { OktaGroup, OktaUser, MembershipRule } from '../types';

function group(over: Partial<OktaGroup> = {}): OktaGroup {
  return {
    id: 'g1',
    type: 'OKTA_GROUP',
    created: '2020-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    profile: { name: 'Engineering', description: '' },
    ...over,
  } as OktaGroup;
}

function rule(over: Partial<MembershipRule> = {}): MembershipRule {
  return { id: 'r1', name: 'Rule 1', status: 'ACTIVE', groupIds: ['g1'], ...over };
}

const user: OktaUser = {
  id: 'u1',
  status: 'ACTIVE',
  profile: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@x.com', login: 'ada@x.com' },
} as OktaUser;

describe('analyzeMemberships', () => {
  it('returns [] for no groups', () => {
    expect(analyzeMemberships([], [rule()], user)).toEqual([]);
  });

  it('classifies APP_GROUP as RULE_BASED with no rule, even absent any rules', () => {
    const [m] = analyzeMemberships([group({ id: 'a', type: 'APP_GROUP' })], [], user);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.rule).toBeUndefined();
  });

  it('classifies a group with no matching active rules as DIRECT', () => {
    const [m] = analyzeMemberships([group({ id: 'g2' })], [rule({ groupIds: ['other'] })], user);
    expect(m.membershipType).toBe('DIRECT');
    expect(m.rule).toBeUndefined();
  });

  it('ignores INACTIVE rules (→ DIRECT)', () => {
    const [m] = analyzeMemberships([group()], [rule({ status: 'INACTIVE' })], user);
    expect(m.membershipType).toBe('DIRECT');
  });

  it('classifies a group with a matching active rule as RULE_BASED and attributes it', () => {
    const r = rule({ id: 'rX', groupIds: ['g1'] });
    const [m] = analyzeMemberships([group()], [r], user);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.rule?.id).toBe('rX');
  });

  it('matches on actions.assignUserToGroups.groupIds when groupIds is absent', () => {
    const r = rule({
      id: 'rA',
      groupIds: undefined,
      actions: { assignUserToGroups: { groupIds: ['g1'] } },
    });
    const [m] = analyzeMemberships([group()], [r], user);
    expect(m.membershipType).toBe('RULE_BASED');
    expect(m.rule?.id).toBe('rA');
  });

  it('defaults attribution to the first matching rule (low confidence)', () => {
    const first = rule({ id: 'first' });
    const second = rule({ id: 'second' });
    const [m] = analyzeMemberships([group()], [first, second], user);
    expect(m.rule?.id).toBe('first');
  });

  it('prefers a rule whose referenced attribute value appears in its condition', () => {
    const engUser = {
      ...user,
      profile: { ...user.profile, department: 'Engineering' },
    } as OktaUser;
    const plain = rule({ id: 'plain' });
    const matching = rule({
      id: 'matching',
      userAttributes: ['department'],
      conditions: {
        expression: { value: 'user.department == "engineering"', type: 'urn:okta:expression:1.0' },
      },
    });
    const [m] = analyzeMemberships([group()], [plain, matching], engUser);
    expect(m.rule?.id).toBe('matching');
  });
});
