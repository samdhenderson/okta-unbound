/**
 * Behavior tests for {@link LeafClauseNode.predicate}: the structured
 * description a leaf clause carries so the UI can compose a sentence instead of
 * printing `String.toLowerCase(user.department) == "sales"` at an administrator.
 *
 * The rule the table below enforces is that recognition is **exact or absent**
 * — every shape that is not recognised verbatim carries no predicate at all,
 * never an approximate one (`docs/claims.md`).
 */
import { describe, it, expect } from 'vitest';
import {
  explainRuleExpression,
  type LeafClauseNode,
  type LeafPredicate,
} from './explainExpression';
import type { OktaUser } from '../types';
import type { RuleGroupContext } from '../ruleEvaluator';

const user: OktaUser = {
  id: '00uFAKEPREDICATE1',
  status: 'ACTIVE',
  profile: {
    login: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Intern',
    isContractor: false,
    headcount: 42,
    'cost center': 'CC-9',
  },
};

/** The predicate of an expression explained as a single leaf. */
function predicateOf(expression: string): LeafPredicate | undefined {
  const { tree } = explainRuleExpression(expression, user);
  expect(tree.node).toBe('leaf');
  return (tree as LeafClauseNode).predicate;
}

describe('explainRuleExpression — leaf predicates', () => {
  it('describes a plain comparison as its subject, operator and operand', () => {
    expect(predicateOf('user.department == "Engineering"')).toEqual({
      form: 'compare',
      subject: { path: 'user.department', transforms: [] },
      operator: 'eq',
      operand: 'Engineering',
    });
  });

  it.each([
    ['user.department != "Sales"', 'ne'],
    ['user.department ne "Sales"', 'ne'],
    ['user.department eq "Sales"', 'eq'],
    ['user.headcount < 50', 'lt'],
    ['user.headcount <= 50', 'lte'],
    ['user.headcount > 50', 'gt'],
    ['user.headcount >= 50', 'gte'],
  ])('maps the operator of %s to %s', (expression, operator) => {
    expect(predicateOf(expression)).toMatchObject({ form: 'compare', operator });
  });

  it('names the computed-key form with the same path the evidence line uses', () => {
    expect(predicateOf('user["cost center"] == "CC-9"')).toEqual({
      form: 'compare',
      subject: { path: 'user["cost center"]', transforms: [] },
      operator: 'eq',
      operand: 'CC-9',
    });
  });

  it('orders nested transforms innermost first', () => {
    expect(
      predicateOf('String.toLowerCase(String.removeSpaces(user.department)) == "sales"'),
    ).toEqual({
      form: 'compare',
      subject: { path: 'user.department', transforms: ['removeSpaces', 'toLowerCase'] },
      operator: 'eq',
      operand: 'sales',
    });
  });

  it.each([
    ['String.toUpperCase(user.department) == "X"', 'toUpperCase'],
    ['String.len(user.department) > 3', 'len'],
    ['Arrays.size(user.department) > 1', 'size'],
    ['Arrays.toCsvString(user.department) == "a,b"', 'toCsvString'],
  ])('recognises the transform in %s', (expression, transform) => {
    expect(predicateOf(expression)).toMatchObject({
      subject: { path: 'user.department', transforms: [transform] },
    });
  });

  it('normalises a literal on the left, mirroring the relational operator', () => {
    expect(predicateOf('50 > user.headcount')).toEqual({
      form: 'compare',
      subject: { path: 'user.headcount', transforms: [] },
      operator: 'lt',
      operand: 50,
    });
    expect(predicateOf('"Sales" == user.department')).toMatchObject({
      form: 'compare',
      operator: 'eq',
      operand: 'Sales',
    });
  });

  it('describes two subjects compared with each other', () => {
    expect(predicateOf('user.department == user.title')).toEqual({
      form: 'compare-subjects',
      left: { path: 'user.department', transforms: [] },
      operator: 'eq',
      right: { path: 'user.title', transforms: [] },
    });
  });

  it('keeps null, boolean and numeric operands as the values they are', () => {
    expect(predicateOf('user.department == null')).toMatchObject({ operand: null });
    expect(predicateOf('user.isContractor == true')).toMatchObject({ operand: true });
    expect(predicateOf('user.headcount == 42')).toMatchObject({ operand: 42 });
  });

  it.each([
    ['String.stringContains(user.login, "_vendor")', 'contains'],
    ['String.startsWith(user.login, "svc-")', 'starts-with'],
    ['String.endsWith(user.login, "@example.com")', 'ends-with'],
  ])('describes %s as %s', (expression, form) => {
    expect(predicateOf(expression)).toEqual({
      form,
      subject: { path: 'user.login', transforms: [] },
      operand: expect.any(String),
      negated: false,
    });
  });

  it('describes the array forms', () => {
    expect(predicateOf('Arrays.contains(user.department, "Engineering")')).toEqual({
      form: 'array-contains',
      subject: { path: 'user.department', transforms: [] },
      operand: 'Engineering',
      negated: false,
    });
    expect(predicateOf('Arrays.isEmpty(user.department)')).toEqual({
      form: 'empty',
      subject: { path: 'user.department', transforms: [] },
      negated: false,
    });
  });

  it('describes a bare attribute clause as a boolean question about it', () => {
    expect(predicateOf('user.isContractor')).toEqual({
      form: 'boolean-attribute',
      subject: { path: 'user.isContractor', transforms: [] },
      negated: false,
    });
  });

  it.each([
    ['!user.isContractor', true],
    ['not user.isContractor', true],
    ['NOT user.isContractor', true],
  ])('flags %s as negated', (expression, negated) => {
    expect(predicateOf(expression)).toMatchObject({ form: 'boolean-attribute', negated });
  });

  it.each([
    ['!(user.department == "Sales")', 'ne'],
    ['!(user.department != "Sales")', 'eq'],
    ['!(user.headcount < 50)', 'gte'],
    ['!(user.headcount <= 50)', 'gt'],
    ['!(user.headcount > 50)', 'lte'],
    ['!(user.headcount >= 50)', 'lt'],
  ])('folds the negation of %s into the complementary operator %s', (expression, operator) => {
    expect(predicateOf(expression)).toMatchObject({ form: 'compare', operator });
  });

  it('flips the negated flag rather than the operator for the flag-carrying forms', () => {
    expect(predicateOf('!String.stringContains(user.login, "_vendor")')).toMatchObject({
      form: 'contains',
      negated: true,
    });
    expect(predicateOf('!Arrays.isEmpty(user.department)')).toMatchObject({
      form: 'empty',
      negated: true,
    });
    expect(predicateOf('!Arrays.contains(user.department, "Engineering")')).toMatchObject({
      form: 'array-contains',
      negated: true,
    });
  });

  it('describes nothing for a double negation', () => {
    expect(predicateOf('!!user.isContractor')).toBeUndefined();
    expect(predicateOf('!(!(user.department == "Sales"))')).toBeUndefined();
  });

  it.each([
    ['"a" == "b"', 'literal compared with literal'],
    ['String.substring(user.department, 0, 3) == "Eng"', 'a transform outside the closed set'],
    ['String.toLowerCase(String.append(user.department, "x")) == "a"', 'a nested non-transform'],
    ['(user.active ? user.department : user.title) == "Sales"', 'a conditional'],
    ['String.stringContains(user.login, user.department)', 'a non-literal operand'],
    ['Arrays.contains(user.groups, user.department)', 'a non-literal array operand'],
    ['String.toLowerCase(user.department)', 'a transform standing as a whole clause'],
  ])('describes nothing for %s (%s)', (expression) => {
    expect(predicateOf(expression)).toBeUndefined();
  });

  it('describes nothing for a group-membership clause, which has its own treatment', () => {
    const groups: RuleGroupContext = [{ id: '00gFAKEPREDICATE1', name: 'Engineering' }];
    const { tree } = explainRuleExpression('isMemberOfGroup("00gFAKEPREDICATE1")', user, {
      groups,
    });
    const leaf = tree as LeafClauseNode;

    expect(leaf.predicate).toBeUndefined();
    expect(leaf.groupRequirement).toBe('member');
  });

  it('describes a clause the evaluator could not resolve, because the rule still asks it', () => {
    const { tree } = explainRuleExpression('user.department > "A"', user);
    const leaf = tree as LeafClauseNode;

    expect(leaf.status).toBe('not-evaluated');
    expect(leaf.predicate).toMatchObject({ form: 'compare', operator: 'gt', operand: 'A' });
  });

  it('describes every leaf under a connective, not just the root', () => {
    const { tree } = explainRuleExpression(
      'user.department == "Engineering" && !String.startsWith(user.login, "svc-")',
      user,
    );
    expect(tree.node).toBe('connective');
    const children = tree.node === 'connective' ? tree.children : [];

    expect(children.map((child) => (child.node === 'leaf' ? child.predicate : undefined))).toEqual([
      {
        form: 'compare',
        subject: { path: 'user.department', transforms: [] },
        operator: 'eq',
        operand: 'Engineering',
      },
      {
        form: 'starts-with',
        subject: { path: 'user.login', transforms: [] },
        operand: 'svc-',
        negated: true,
      },
    ]);
  });
});
