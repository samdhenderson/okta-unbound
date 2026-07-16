/**
 * @module shared/membership/groupSource.test
 * @description Unit tests for the member-source aggregation.
 */

import { describe, it, expect } from 'vitest';
import { summarizeMemberSources, type GroupIdentity } from './groupSource';
import type { MembershipRule, OktaUser } from '../types';

function member(id: string, profile: Record<string, string> = {}): OktaUser {
  return {
    id,
    status: 'ACTIVE',
    profile: { login: `${id}@x.io`, email: `${id}@x.io`, firstName: id, lastName: 'U', ...profile },
  };
}

const oktaGroup: GroupIdentity = { id: 'g1', name: 'Engineering', type: 'OKTA_GROUP' };

const engRule: MembershipRule = {
  id: 'r1',
  name: 'Eng feeder',
  status: 'ACTIVE',
  groupIds: ['g1'],
  conditionExpression: 'user.department=="Eng"',
  userAttributes: ['department'],
};

describe('summarizeMemberSources', () => {
  it('classifies members with a matching active rule as rule-based', () => {
    const members = [member('u1', { department: 'Eng' }), member('u2', { department: 'Eng' })];
    const result = summarizeMemberSources(oktaGroup, members, [engRule]);
    expect(result).toMatchObject({ total: 2, direct: 0, ruleBased: 2 });
    expect(result.byRule).toEqual([{ ruleId: 'r1', ruleName: 'Eng feeder', count: 2 }]);
  });

  it('classifies members as manual when no rule targets the group', () => {
    const result = summarizeMemberSources(oktaGroup, [member('u1')], []);
    expect(result).toMatchObject({ total: 1, direct: 1, ruleBased: 0 });
    expect(result.byRule).toEqual([]);
  });

  it('treats APP_GROUP membership as application-managed (rule-based, no attributed rule)', () => {
    const appGroup: GroupIdentity = { id: 'g2', name: 'App Group', type: 'APP_GROUP' };
    const result = summarizeMemberSources(appGroup, [member('u1')], []);
    expect(result).toMatchObject({ total: 1, direct: 0, ruleBased: 1 });
    // Application-managed members have no group rule to attribute.
    expect(result.byRule).toEqual([]);
  });

  it('counts a member excluded from every feeding rule as manual', () => {
    const excludingRule: MembershipRule = {
      ...engRule,
      conditions: { people: { users: { exclude: ['u1'] } } },
    };
    const result = summarizeMemberSources(
      oktaGroup,
      [member('u1', { department: 'Eng' })],
      [excludingRule],
    );
    expect(result).toMatchObject({ direct: 1, ruleBased: 0 });
  });

  it('tallies contributions across multiple rules, sorted by count', () => {
    const salesRule: MembershipRule = {
      id: 'r2',
      name: 'Sales feeder',
      status: 'ACTIVE',
      groupIds: ['g1'],
      conditionExpression: 'user.department=="Sales"',
      userAttributes: ['department'],
    };
    const members = [
      member('u1', { department: 'Eng' }),
      member('u2', { department: 'Eng' }),
      member('u3', { department: 'Sales' }),
    ];
    const result = summarizeMemberSources(oktaGroup, members, [engRule, salesRule]);
    expect(result.ruleBased).toBe(3);
    expect(result.byRule[0]).toEqual({ ruleId: 'r1', ruleName: 'Eng feeder', count: 2 });
    expect(result.byRule[1]).toEqual({ ruleId: 'r2', ruleName: 'Sales feeder', count: 1 });
  });
});
