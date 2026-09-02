/**
 * @module shared/rules/consolidation.test
 * @description Unit tests for the pure rule-consolidation helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  buildConsolidatedRulePayload,
  consolidatedRuleName,
  unionTargetGroups,
  normalizeExpression,
  findMergeableRuleGroups,
  CONSOLIDATED_SUFFIX,
  MAX_RULE_NAME_LENGTH,
} from './consolidation';
import type { OktaGroupRule } from '../types';

function rule(over: Partial<OktaGroupRule> = {}): OktaGroupRule {
  return {
    id: 'r1',
    name: 'Eng',
    status: 'ACTIVE',
    type: 'group_rule',
    created: '',
    lastUpdated: '',
    conditions: { expression: { value: 'user.department=="Eng"', type: 'x' } },
    actions: { assignUserToGroups: { groupIds: ['g1'] } },
    ...over,
  };
}

describe('MAX_RULE_NAME_LENGTH', () => {
  /*
    D-090: this used to be declared twice, here and in `useCreateFeedingRule`,
    under two names. It is a fact about Okta's API, so the number itself is
    pinned — the group rung's create-a-rule draft now imports this declaration,
    and a change made in one place has to be a change made for both.
  */
  it("is Okta's 50-character group-rule name cap", () => {
    expect(MAX_RULE_NAME_LENGTH).toBe(50);
  });
});

describe('consolidatedRuleName', () => {
  it('appends the suffix', () => {
    expect(consolidatedRuleName('Eng')).toBe(`Eng${CONSOLIDATED_SUFFIX}`);
  });

  it('truncates to stay within the 50-char Okta limit', () => {
    const long = 'x'.repeat(60);
    const name = consolidatedRuleName(long);
    expect(name.length).toBeLessThanOrEqual(50);
    expect(name.length).toBeLessThanOrEqual(MAX_RULE_NAME_LENGTH);
    expect(name.endsWith(CONSOLIDATED_SUFFIX)).toBe(true);
  });
});

describe('unionTargetGroups', () => {
  it('adds new ids without duplicating existing ones, order-preserving', () => {
    expect(
      unionTargetGroups(rule({ actions: { assignUserToGroups: { groupIds: ['g1', 'g2'] } } }), [
        'g2',
        'g3',
      ]),
    ).toEqual(['g1', 'g2', 'g3']);
  });
});

describe('buildConsolidatedRulePayload', () => {
  it('copies conditions verbatim and unions the target groups', () => {
    const src = rule();
    const payload = buildConsolidatedRulePayload(src, ['g2']);
    expect(payload).toEqual({
      type: 'group_rule',
      name: `Eng${CONSOLIDATED_SUFFIX}`,
      conditions: src.conditions,
      actions: { assignUserToGroups: { groupIds: ['g1', 'g2'] } },
    });
  });
});

describe('normalizeExpression', () => {
  it('collapses whitespace and lower-cases', () => {
    expect(
      normalizeExpression(
        rule({ conditions: { expression: { value: '  User.Dept == "X" ', type: 't' } } }),
      ),
    ).toBe('user.dept == "x"');
  });
});

describe('findMergeableRuleGroups', () => {
  it('clusters rules with identical expressions and unions their target groups', () => {
    const rules = [
      rule({ id: 'a', actions: { assignUserToGroups: { groupIds: ['g1'] } } }),
      rule({ id: 'b', actions: { assignUserToGroups: { groupIds: ['g2'] } } }),
      rule({ id: 'c', conditions: { expression: { value: 'user.dept=="Sales"', type: 't' } } }),
    ];
    const groups = findMergeableRuleGroups(rules);
    expect(groups).toHaveLength(1);
    expect(groups[0].rules.map((r) => r.id)).toEqual(['a', 'b']);
    expect(groups[0].unionGroupIds).toEqual(['g1', 'g2']);
  });

  it('ignores single rules and empty expressions', () => {
    const rules = [
      rule({ id: 'a' }),
      rule({ id: 'b', conditions: { expression: { value: '', type: 't' } } }),
      rule({ id: 'c', conditions: { expression: { value: '', type: 't' } } }),
    ];
    expect(findMergeableRuleGroups(rules)).toEqual([]);
  });
});
