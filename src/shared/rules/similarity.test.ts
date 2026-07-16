/**
 * @module shared/rules/similarity.test
 * @description Unit tests for the rule similarity clustering + sort.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeRuleName,
  normalizeRuleExpression,
  rulesAreSimilar,
  clusterSimilarRules,
  sortRules,
} from './similarity';
import type { FormattedRule } from '../types';

/** Minimal FormattedRule factory. */
function rule(id: string, name: string, expression: string): FormattedRule {
  return {
    id,
    name,
    status: 'ACTIVE',
    condition: expression,
    conditionExpression: expression,
    groupIds: [],
    userAttributes: [],
    created: '2024-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
  };
}

/** Names in list order — the assertion surface for ordering tests. */
const names = (rules: FormattedRule[]) => rules.map((r) => r.name);

describe('normalizers', () => {
  it('strips the consolidated suffix and normalizes punctuation/case', () => {
    expect(normalizeRuleName('Eng — Team (consolidated)')).toBe('eng team');
    expect(normalizeRuleName('Sales_Team')).toBe('sales team');
  });

  it('collapses whitespace and lower-cases expressions', () => {
    expect(normalizeRuleExpression("user.department  ==   'Eng'")).toBe("user.department == 'eng'");
  });
});

describe('rulesAreSimilar', () => {
  it('pairs identical expressions', () => {
    const a = rule('1', 'Alpha', "user.department == 'Eng'");
    const b = rule('2', 'Totally Different', "user.department == 'Eng'");
    expect(rulesAreSimilar(a, b)).toBe(true);
  });

  it('pairs rules that key off the same attribute with different values', () => {
    const a = rule('1', 'Alpha', "user.department == 'Eng'");
    const b = rule('2', 'Beta', "user.department == 'Sales'");
    expect(rulesAreSimilar(a, b)).toBe(true);
  });

  it('pairs similar names even with unrelated expressions', () => {
    const a = rule('1', 'Contractor Access West', "user.title == 'x'");
    const b = rule('2', 'Contractor Access East', "user.city == 'y'");
    expect(rulesAreSimilar(a, b)).toBe(true);
  });

  it('does not pair unrelated rules', () => {
    const a = rule('1', 'Engineering', "user.department == 'Eng'");
    const b = rule('2', 'Payroll Region', "user.countryCode == 'US'");
    expect(rulesAreSimilar(a, b)).toBe(false);
  });
});

describe('clusterSimilarRules', () => {
  it('groups similar rules and marks siblings; singletons stand alone', () => {
    const rules = [
      rule('1', 'Eng', "user.department == 'Eng'"),
      rule('2', 'Sales', "user.department == 'Sales'"),
      rule('3', 'Country', "user.countryCode == 'US'"),
    ];
    const clusters = clusterSimilarRules(rules);
    // One 2-rule cluster (department) + one singleton.
    const sibling = clusters.find((c) => c.hasSiblings);
    expect(sibling?.rules.map((r) => r.id).sort()).toEqual(['1', '2']);
    expect(clusters.some((c) => !c.hasSiblings && c.rules[0].id === '3')).toBe(true);
  });

  it('orders multi-rule clusters before singletons', () => {
    const rules = [
      rule('solo', 'Zeta Solo', "user.city == 'NYC'"),
      rule('a', 'Dept A', "user.department == 'A'"),
      rule('b', 'Dept B', "user.department == 'B'"),
    ];
    const clusters = clusterSimilarRules(rules);
    expect(clusters[0].hasSiblings).toBe(true);
    expect(clusters[clusters.length - 1].hasSiblings).toBe(false);
  });
});

describe('sortRules', () => {
  const rules = [
    rule('1', 'Beta', "user.department == 'Sales'"),
    rule('2', 'Alpha', "user.countryCode == 'US'"),
    rule('3', 'Gamma', "user.department == 'Eng'"),
  ];

  it('default preserves input order and returns a new array', () => {
    const out = sortRules(rules, 'default');
    expect(names(out)).toEqual(['Beta', 'Alpha', 'Gamma']);
    expect(out).not.toBe(rules);
  });

  it('name sorts alphabetically', () => {
    expect(names(sortRules(rules, 'name'))).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('similarity places the two department rules adjacently', () => {
    const out = names(sortRules(rules, 'similarity'));
    const iBeta = out.indexOf('Beta');
    const iGamma = out.indexOf('Gamma');
    expect(Math.abs(iBeta - iGamma)).toBe(1);
  });

  it('similarity keeps every rule exactly once', () => {
    const out = sortRules(rules, 'similarity');
    expect(out.map((r) => r.id).sort()).toEqual(['1', '2', '3']);
  });
});
