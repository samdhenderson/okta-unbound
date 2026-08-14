/*
 * Negated group-membership clauses.
 *
 * `!isMemberOfAnyGroup(…)` is a `UnaryExpression`, and the first cut of the group
 * work only looked for a `CallExpression`. So the clause carried NO group
 * references at all, which cascaded: the classifier saw a failing clause with no
 * groups, concluded a profile attribute was to blame, and told an administrator to
 * change a profile value to satisfy an *exclusion*. These pin the polarity.
 *
 * Fixtures use obviously fake placeholders only.
 */
import { describe, it, expect } from 'vitest';
import { explainRuleExpression } from './explainExpression';
import type { RuleGroupContext } from '../ruleEvaluator';
import type { OktaUser } from '../types';

const CONTRACTORS = '00gFAKECONTRACTOR01';
const VENDORS = '00gFAKEVENDORS00001';

const user: OktaUser = {
  id: '00uFAKE0000000000000',
  status: 'ACTIVE',
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
  },
};

/** The user is in Contractors, and in nothing else the rules below name. */
const groups: RuleGroupContext = [
  { id: CONTRACTORS, name: 'emea.contractors' },
  { id: '00gFAKEEVERYONE0001', name: 'Everyone' },
];

describe('a negated membership clause is understood as an exclusion', () => {
  it('THE BUG: reports the groups of a negated call instead of nothing at all', () => {
    const { clauses } = explainRuleExpression(`!isMemberOfAnyGroup("${CONTRACTORS}")`, user, {
      groups,
    });

    expect(clauses).toHaveLength(1);
    expect(clauses[0].groupRequirement).toBe('non-member');
    expect(clauses[0].groupReferences).toEqual([
      {
        match: 'id',
        value: CONTRACTORS,
        satisfied: true,
        matchedGroupName: 'emea.contractors',
      },
    ]);
  });

  it('fails the clause when the user IS in an excluded group', () => {
    const { clauses } = explainRuleExpression(
      `!isMemberOfAnyGroup("${CONTRACTORS}", "${VENDORS}")`,
      user,
      { groups },
    );

    expect(clauses[0].status).toBe('fail');
    // The whole set is carried; only the satisfied one explains the failure, and
    // deciding which is the consumer's job — see `accessCause`.
    expect(clauses[0].groupReferences?.map((r) => r.satisfied)).toEqual([true, false]);
  });

  it('passes the clause when the user is in none of the excluded groups', () => {
    const { clauses } = explainRuleExpression(`!isMemberOfAnyGroup("${VENDORS}")`, user, {
      groups,
    });

    expect(clauses[0].status).toBe('pass');
    expect(clauses[0].groupRequirement).toBe('non-member');
  });

  it('marks an un-negated call as `member`, the opposite requirement', () => {
    const { clauses } = explainRuleExpression(`isMemberOfAnyGroup("${VENDORS}")`, user, { groups });

    expect(clauses[0].groupRequirement).toBe('member');
    expect(clauses[0].status).toBe('fail');
  });

  it('still reports nothing without a group list, negated or not', () => {
    // No list means no `satisfied` to report, so naming the groups would imply a
    // check that never happened. Unchanged by this work.
    const { clauses } = explainRuleExpression(`!isMemberOfAnyGroup("${CONTRACTORS}")`, user);

    expect(clauses[0].status).toBe('not-evaluated');
    expect(clauses[0].groupReferences).toBeUndefined();
    expect(clauses[0].groupRequirement).toBeUndefined();
  });

  it('declines a double negation rather than guessing its polarity', () => {
    const { clauses } = explainRuleExpression(`!!isMemberOfGroup("${CONTRACTORS}")`, user, {
      groups,
    });

    expect(clauses[0].groupReferences).toBeUndefined();
  });

  it('keeps a negated COMBINATION as one clause with no group references', () => {
    // `!(a && b)` negates the combination; reporting its parts separately would
    // invert their meaning, so the clause stays whole and names no groups.
    const { clauses } = explainRuleExpression(
      `!(isMemberOfGroup("${CONTRACTORS}") && user.department == "Sales")`,
      user,
      { groups },
    );

    expect(clauses).toHaveLength(1);
    expect(clauses[0].groupReferences).toBeUndefined();
  });

  it('carries polarity per clause when both directions appear in one rule', () => {
    const { clauses } = explainRuleExpression(
      `isMemberOfGroup("${VENDORS}") && !isMemberOfGroup("${CONTRACTORS}")`,
      user,
      { groups },
    );

    expect(clauses.map((c) => c.groupRequirement)).toEqual(['member', 'non-member']);
  });
});
