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

  it('a member no other rule explains is held by this rule alone', () => {
    const rules = [rule('r1', ['g1'])];
    const { heldSolelyByRule, unaffected } = classifyGroupImpact(
      'r1',
      target([member('u1')]),
      rules,
    );
    expect(heldSolelyByRule.map((u) => u.id)).toEqual(['u1']);
    expect(unaffected).toEqual([]);
  });

  it('a member also held by another active rule is unaffected', () => {
    const rules = [rule('r1', ['g1']), rule('r2', ['g1'])];
    const { heldSolelyByRule, unaffected } = classifyGroupImpact(
      'r1',
      target([member('u1')]),
      rules,
    );
    expect(heldSolelyByRule).toEqual([]);
    expect(unaffected.map((u) => u.id)).toEqual(['u1']);
  });

  it('an inactive second rule does not share the hold', () => {
    const rules = [rule('r1', ['g1']), rule('r2', ['g1'], 'INACTIVE')];
    const { heldSolelyByRule } = classifyGroupImpact('r1', target([member('u1')]), rules);
    expect(heldSolelyByRule.map((u) => u.id)).toEqual(['u1']);
  });

  it('a member excluded from the analyzed rule is treated as manual and unaffected', () => {
    const rules = [rule('r1', ['g1'], 'ACTIVE', ['u1'])];
    const { heldSolelyByRule, unaffected } = classifyGroupImpact(
      'r1',
      target([member('u1')]),
      rules,
    );
    expect(heldSolelyByRule).toEqual([]);
    expect(unaffected.map((u) => u.id)).toEqual(['u1']);
  });

  it('a member excluded from the analyzed rule but held by another rule is unaffected', () => {
    const rules = [rule('r1', ['g1'], 'ACTIVE', ['u1']), rule('r2', ['g1'])];
    const { heldSolelyByRule, unaffected } = classifyGroupImpact(
      'r1',
      target([member('u1')]),
      rules,
    );
    expect(heldSolelyByRule).toEqual([]);
    expect(unaffected.map((u) => u.id)).toEqual(['u1']);
  });

  it('a manual member (no rule targets the group) is unaffected', () => {
    const rules = [rule('r1', ['other-group'])];
    const { heldSolelyByRule, unaffected } = classifyGroupImpact(
      'r1',
      target([member('u1')]),
      rules,
    );
    expect(heldSolelyByRule).toEqual([]);
    expect(unaffected.map((u) => u.id)).toEqual(['u1']);
  });

  it('APP_GROUP members are application-managed and never held by a group rule', () => {
    const rules = [rule('r1', ['g1'])];
    const { heldSolelyByRule, unaffected } = classifyGroupImpact(
      'r1',
      target([member('u1')], 'APP_GROUP'),
      rules,
    );
    expect(heldSolelyByRule).toEqual([]);
    expect(unaffected.map((u) => u.id)).toEqual(['u1']);
  });

  it('an analyzed rule that is itself inactive holds nobody up', () => {
    const rules = [rule('r1', ['g1'], 'INACTIVE')];
    const { heldSolelyByRule, unaffected } = classifyGroupImpact(
      'r1',
      target([member('u1')]),
      rules,
    );
    expect(heldSolelyByRule).toEqual([]);
    expect(unaffected.map((u) => u.id)).toEqual(['u1']);
  });

  it('partitions a mixed group correctly', () => {
    const rules = [rule('r1', ['g1'], 'ACTIVE', ['u3']), rule('r2', ['g1'])];
    const members = [member('u1'), member('u2'), member('u3')];
    // Make u2 held by r2 as well as r1; classification only needs r2 to target g1.
    const { heldSolelyByRule, unaffected } = classifyGroupImpact('r1', target(members), rules);
    // u1 and u2 are held by r1 and r2 (both target g1) -> r1 does not hold them
    // alone. u3 is excluded from r1 -> manual. So nothing is held solely by r1.
    expect(heldSolelyByRule).toEqual([]);
    expect(unaffected.map((u) => u.id).sort()).toEqual(['u1', 'u2', 'u3']);
  });

  /**
   * The naming defect D-052 fixed: this population is the same three ways, and
   * only one of the three verbs moves anybody. The engine must not answer the
   * deactivate question with a set named for access loss.
   */
  it('names the population rather than a per-verb consequence', () => {
    const rules = [rule('r1', ['g1'])];
    const result = classifyGroupImpact('r1', target([member('u1')]), rules);
    expect(Object.keys(result).sort()).toEqual(['heldSolelyByRule', 'unaffected']);
    expect(result).not.toHaveProperty('losing');
    expect(result).not.toHaveProperty('retaining');
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
      heldSolelyCount: 2,
    });
    expect(summary.targetGroups[1]).toMatchObject({
      groupId: 'g2',
      memberCount: 2,
      heldSolelyCount: 2,
    });
    // u2 appears in both target groups -> counted once.
    expect(summary.distinctMemberCount).toBe(3);
    expect(summary.totalHeldSolely).toBe(3);
  });

  it('reports nobody held solely when every member is held by another rule too', () => {
    const rules = [rule('r1', ['g1']), rule('r2', ['g1'])];
    const targets: TargetGroupMembers[] = [
      { groupId: 'g1', groupName: 'G1', members: [member('u1')] },
    ];
    const summary = summarizeRuleImpact('r1', 'Rule One', targets, rules);
    expect(summary.totalHeldSolely).toBe(0);
    expect(summary.targetGroups[0].heldSolelyCount).toBe(0);
  });
});
