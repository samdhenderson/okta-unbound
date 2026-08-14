/**
 * The `isMemberOf*` functions, answered against a supplied group list.
 *
 * These were unevaluable for the module's whole life — `group-membership-fn`, "we
 * would need the user's groups". `RuleEvaluationOptions` was built as the seam to
 * close that, and this pins both halves of the bargain:
 *
 * - **With** a group list, the answer is definite in *both* directions. Finding no
 *   match is `no-match`, not "don't know", which is only sound because the option
 *   is documented to carry the user's complete membership set.
 * - **Without** one, nothing changes. Every existing caller keeps the old
 *   behaviour, so upgrading the module cannot silently turn a shrug into a verdict.
 *
 * `isMemberOfGroupNameRegex` is the deliberate exception and is pinned separately:
 * it stays unevaluable even with a list, because building a `RegExp` from
 * tenant-authored text hands its author a backtracking lever over the panel's only
 * thread.
 */
import { describe, it, expect } from 'vitest';
import { tryEvaluateRuleExpression, tryEvaluateRuleExpressionDetailed } from './ruleEvaluator';
import type { OktaUser } from './types';

const user: OktaUser = {
  id: '00uFAKEuser00001',
  status: 'ACTIVE',
  profile: {
    login: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
  },
};

/** The user's complete membership set, as the option requires. */
const groups = [
  { id: '00gFAKEgroup0001', name: 'Engineering' },
  { id: '00gFAKEgroup0002', name: 'VPN — Standard' },
];

describe('isMemberOf* with a group context', () => {
  it.each([
    ['isMemberOfGroup("00gFAKEgroup0001")', 'match'],
    ['isMemberOfGroup("00gFAKEgroup9999")', 'no-match'],
    ['isMemberOfGroupName("Engineering")', 'match'],
    ['isMemberOfGroupName("Finance")', 'no-match'],
    ['isMemberOfAnyGroup("00gFAKEgroup9999", "00gFAKEgroup0002")', 'match'],
    ['isMemberOfAnyGroup("00gFAKEgroup9998", "00gFAKEgroup9999")', 'no-match'],
    ['isMemberOfAnyGroupName("Finance", "Engineering")', 'match'],
    ['isMemberOfAnyGroupName("Finance", "Legal")', 'no-match'],
    ['isMemberOfGroupNameStartsWith("VPN")', 'match'],
    ['isMemberOfGroupNameStartsWith("SSH")', 'no-match'],
    ['isMemberOfGroupNameContains("Standard")', 'match'],
    ['isMemberOfGroupNameContains("Premium")', 'no-match'],
  ])('%s → %s', (expression, expected) => {
    expect(tryEvaluateRuleExpression(expression, user, groups)).toBe(expected);
  });

  it('matches group names case-sensitively, as Okta does', () => {
    // Two groups differing only in case are two different groups; lower-casing
    // here would report a membership the tenant does not have.
    expect(tryEvaluateRuleExpression('isMemberOfGroupName("engineering")', user, groups)).toBe(
      'no-match',
    );
  });

  it('combines with profile clauses in one expression', () => {
    expect(
      tryEvaluateRuleExpression(
        'user.department == "Engineering" && isMemberOfGroup("00gFAKEgroup0002")',
        user,
        groups,
      ),
    ).toBe('match');
  });

  it('answers no-match for a user with no groups at all', () => {
    // An empty list is a real answer ("they are in nothing"), not a missing one.
    expect(tryEvaluateRuleExpression('isMemberOfGroup("00gFAKEgroup0001")', user, [])).toBe(
      'no-match',
    );
  });
});

describe('isMemberOf* without a group context', () => {
  it.each([
    'isMemberOfGroup("00gFAKEgroup0001")',
    'isMemberOfGroupName("Engineering")',
    'isMemberOfAnyGroup("00gFAKEgroup0001")',
    'isMemberOfAnyGroupName("Engineering")',
    'isMemberOfGroupNameStartsWith("VPN")',
    'isMemberOfGroupNameContains("Standard")',
  ])('%s stays unevaluable, never no-match', (expression) => {
    expect(tryEvaluateRuleExpression(expression, user)).toBe('unevaluable');
    expect(tryEvaluateRuleExpressionDetailed(expression, user)).toEqual({
      outcome: 'unevaluable',
      reasonCode: 'group-membership-fn',
    });
  });
});

describe('isMemberOfGroupNameRegex is never run', () => {
  it('stays unevaluable even with a group list, under its own reason', () => {
    // Not "we lack the groups" — we have them. The pattern is tenant-authored and
    // a RegExp built from it could hang the panel, so we decline to check.
    expect(
      tryEvaluateRuleExpressionDetailed('isMemberOfGroupNameRegex(".*")', user, groups),
    ).toEqual({ outcome: 'unevaluable', reasonCode: 'group-name-regex' });
  });

  it('makes the whole condition unevaluable rather than guessing around it', () => {
    expect(
      tryEvaluateRuleExpression(
        'user.department == "Engineering" && isMemberOfGroupNameRegex("Eng.*")',
        user,
        groups,
      ),
    ).toBe('unevaluable');
  });
});
