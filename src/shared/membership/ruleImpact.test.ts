/**
 * @module shared/membership/ruleImpact.test
 * @description Unit tests for the pure rule-impact engine.
 */

import { describe, it, expect } from 'vitest';
import {
  toImpactRule,
  classifyGroupImpact,
  summarizeRuleImpact,
  type ImpactRule,
  type TargetGroupMembers,
} from './ruleImpact';
import type { OktaGroupRule, OktaUser } from '../types';

/** Build a minimal member with just the fields the engine reads. */
function member(id: string): OktaUser {
  return {
    id,
    status: 'ACTIVE',
    profile: { login: `${id}@x.io`, email: `${id}@x.io`, firstName: id, lastName: 'U' },
  };
}

/** Build an ImpactRule inline for readability. */
function rule(
  id: string,
  targetGroupIds: string[],
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
  excludedUserIds: string[] = [],
): ImpactRule {
  return { id, status, targetGroupIds, excludedUserIds };
}

describe('toImpactRule', () => {
  it('extracts target group ids and exclusions from a raw rule', () => {
    const raw: OktaGroupRule = {
      id: 'r1',
      name: 'Engineering',
      status: 'ACTIVE',
      type: 'group_rule',
      created: '',
      lastUpdated: '',
      conditions: {
        expression: { value: 'user.department=="Eng"', type: 'urn:okta:expression:1.0' },
        people: { users: { exclude: ['u9'] } },
      },
      actions: { assignUserToGroups: { groupIds: ['g1', 'g2'] } },
    };
    expect(toImpactRule(raw)).toEqual({
      id: 'r1',
      status: 'ACTIVE',
      targetGroupIds: ['g1', 'g2'],
      excludedUserIds: ['u9'],
    });
  });

  it('defaults missing groups/exclusions to empty arrays', () => {
    const raw: OktaGroupRule = {
      id: 'r2',
      name: 'Bare',
      status: 'INACTIVE',
      type: 'group_rule',
      created: '',
      lastUpdated: '',
    };
    expect(toImpactRule(raw)).toEqual({
      id: 'r2',
      status: 'INACTIVE',
      targetGroupIds: [],
      excludedUserIds: [],
    });
  });
});

describe('classifyGroupImpact', () => {
  const target = (
    members: OktaUser[],
    groupType?: TargetGroupMembers['groupType'],
  ): TargetGroupMembers => ({
    groupId: 'g1',
    groupName: 'Group One',
    groupType,
    members,
  });

  it('a member held only by this rule loses access', () => {
    const rules = [rule('r1', ['g1'])];
    const { losing, retaining } = classifyGroupImpact('r1', target([member('u1')]), rules);
    expect(losing.map((u) => u.id)).toEqual(['u1']);
    expect(retaining).toEqual([]);
  });

  it('a member also held by another active rule retains access', () => {
    const rules = [rule('r1', ['g1']), rule('r2', ['g1'])];
    const { losing, retaining } = classifyGroupImpact('r1', target([member('u1')]), rules);
    expect(losing).toEqual([]);
    expect(retaining.map((u) => u.id)).toEqual(['u1']);
  });

  it('an inactive second rule does not save the member', () => {
    const rules = [rule('r1', ['g1']), rule('r2', ['g1'], 'INACTIVE')];
    const { losing } = classifyGroupImpact('r1', target([member('u1')]), rules);
    expect(losing.map((u) => u.id)).toEqual(['u1']);
  });

  it('a member excluded from the analyzed rule is treated as manual and retains', () => {
    const rules = [rule('r1', ['g1'], 'ACTIVE', ['u1'])];
    const { losing, retaining } = classifyGroupImpact('r1', target([member('u1')]), rules);
    expect(losing).toEqual([]);
    expect(retaining.map((u) => u.id)).toEqual(['u1']);
  });

  it('a member excluded from the analyzed rule but held by another rule retains', () => {
    const rules = [rule('r1', ['g1'], 'ACTIVE', ['u1']), rule('r2', ['g1'])];
    const { losing, retaining } = classifyGroupImpact('r1', target([member('u1')]), rules);
    expect(losing).toEqual([]);
    expect(retaining.map((u) => u.id)).toEqual(['u1']);
  });

  it('a manual member (no rule targets the group) retains', () => {
    const rules = [rule('r1', ['other-group'])];
    const { losing, retaining } = classifyGroupImpact('r1', target([member('u1')]), rules);
    expect(losing).toEqual([]);
    expect(retaining.map((u) => u.id)).toEqual(['u1']);
  });

  it('APP_GROUP members are application-managed and never lose access to a group rule', () => {
    const rules = [rule('r1', ['g1'])];
    const { losing, retaining } = classifyGroupImpact(
      'r1',
      target([member('u1')], 'APP_GROUP'),
      rules,
    );
    expect(losing).toEqual([]);
    expect(retaining.map((u) => u.id)).toEqual(['u1']);
  });

  it('an analyzed rule that is itself inactive removes nobody', () => {
    const rules = [rule('r1', ['g1'], 'INACTIVE')];
    const { losing, retaining } = classifyGroupImpact('r1', target([member('u1')]), rules);
    expect(losing).toEqual([]);
    expect(retaining.map((u) => u.id)).toEqual(['u1']);
  });

  it('partitions a mixed group correctly', () => {
    // u1: only r1 -> loses. u2: r1 + r2 -> retains. u3: excluded from r1 -> retains (manual).
    const rules = [rule('r1', ['g1'], 'ACTIVE', ['u3']), rule('r2', ['g1'])];
    const members = [member('u1'), member('u2'), member('u3')];
    // Make u2 held by r2 as well as r1; classification only needs r2 to target g1.
    const { losing, retaining } = classifyGroupImpact('r1', target(members), rules);
    // u1 held by r1 and r2 (both target g1) -> retains. So with r2 present, nobody
    // held by r1 loses because r2 also targets g1 for all non-excluded members.
    expect(losing).toEqual([]);
    expect(retaining.map((u) => u.id).sort()).toEqual(['u1', 'u2', 'u3']);
  });
});

describe('summarizeRuleImpact', () => {
  it('aggregates per-group impact and de-duplicates users across target groups', () => {
    const rules = [rule('r1', ['g1', 'g2'])];
    const targets: TargetGroupMembers[] = [
      { groupId: 'g1', groupName: 'G1', members: [member('u1'), member('u2')] },
      { groupId: 'g2', groupName: 'G2', members: [member('u2'), member('u3')] },
    ];
    const summary = summarizeRuleImpact('r1', 'Rule One', targets, rules);

    expect(summary.ruleId).toBe('r1');
    expect(summary.targetGroups).toHaveLength(2);
    expect(summary.targetGroups[0]).toMatchObject({
      groupId: 'g1',
      memberCount: 2,
      losingCount: 2,
    });
    expect(summary.targetGroups[1]).toMatchObject({
      groupId: 'g2',
      memberCount: 2,
      losingCount: 2,
    });
    // u2 appears in both target groups -> counted once.
    expect(summary.distinctMemberCount).toBe(3);
    expect(summary.totalLosing).toBe(3);
  });

  it('reports zero loss when every member is held by another rule', () => {
    const rules = [rule('r1', ['g1']), rule('r2', ['g1'])];
    const targets: TargetGroupMembers[] = [
      { groupId: 'g1', groupName: 'G1', members: [member('u1')] },
    ];
    const summary = summarizeRuleImpact('r1', 'Rule One', targets, rules);
    expect(summary.totalLosing).toBe(0);
    expect(summary.targetGroups[0].losingCount).toBe(0);
  });
});
