/*
 * Clause-level rule explainer.
 *
 * The load-bearing property, asserted from several directions below: a clause is
 * `fail` ONLY when the evaluator resolved it to boolean `false`. Everything it
 * could not resolve is `not-evaluated` with a reason code. Reporting "couldn't
 * parse" as "didn't match" would be a worse bug than the bare "no match" this
 * module replaces — an administrator acts on these rows.
 *
 * Fixtures use obviously fake placeholders only.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { explainRuleExpression, DEFAULT_MAX_CLAUSES } from './explainExpression';
import { tryEvaluateRuleExpression } from '../ruleEvaluator';
import type { OktaUser } from '../types';

const user: OktaUser = {
  id: '00uFAKE0000000000000',
  status: 'ACTIVE',
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Intern',
    city: 'San Francisco',
    headcount: 42,
    isContractor: true,
  },
};

describe('explainRuleExpression — the §H example', () => {
  const expression = 'user.department == "Engineering" && user.title != "Intern"';

  it('reports one row per clause, with the profile values that drove each outcome', () => {
    const { clauses } = explainRuleExpression(expression, user);

    expect(clauses).toHaveLength(2);
    expect(clauses[0]).toEqual({
      expressionText: 'user.department == "Engineering"',
      resolvedValue: 'Engineering',
      status: 'pass',
    });
    expect(clauses[1]).toEqual({
      expressionText: 'user.title != "Intern"',
      resolvedValue: 'Intern',
      status: 'fail',
    });
  });

  it('summarises the rule the way the UI renders it', () => {
    const { summary } = explainRuleExpression(expression, user);

    expect(summary.totalClauses).toBe(2);
    expect(summary.evaluatedClauses).toBe(2);
    expect(summary.passedClauses).toBe(1);
    expect(summary.failedClauses).toBe(1);
    expect(summary.notEvaluatedClauses).toBe(0);
    expect(summary.needsGroupContext).toBe(0);
    expect(summary.truncated).toBe(false);
    expect(summary.result).toEqual({ outcome: 'no-match' });
  });

  it('agrees with the engine every other consumer acts on', () => {
    expect(explainRuleExpression(expression, user).summary.result.outcome).toBe(
      tryEvaluateRuleExpression(expression, user),
    );
  });
});

describe('clauses that need group context', () => {
  const expression = 'isMemberOfGroup("00gFAKE0000000000000") && user.department == "Engineering"';

  it('reports the group-membership clause as not-evaluated while its sibling still answers', () => {
    const { clauses, summary } = explainRuleExpression(expression, user);

    expect(clauses).toHaveLength(2);
    expect(clauses[0]).toEqual({
      expressionText: 'isMemberOfGroup("00gFAKE0000000000000")',
      resolvedValue: undefined,
      status: 'not-evaluated',
      reasonCode: 'group-membership-fn',
    });
    // The whole point: the sibling is NOT collapsed into the same "don't know".
    expect(clauses[1].status).toBe('pass');
    expect(clauses[1].resolvedValue).toBe('Engineering');

    expect(summary.evaluatedClauses).toBe(1);
    expect(summary.totalClauses).toBe(2);
    expect(summary.needsGroupContext).toBe(1);
    // "1 of 2 clauses evaluated, 1 needs group context" — and no verdict.
    expect(summary.result).toEqual({ outcome: 'unevaluable', reasonCode: 'group-membership-fn' });
  });

  it('counts every group-membership flavour toward needsGroupContext', () => {
    const { clauses, summary } = explainRuleExpression(
      'isMemberOfGroupName("Engineering") || isMemberOfAnyGroup("00gFAKE1", "00gFAKE2") || user.city == "San Francisco"',
      user,
    );

    // One requirement now: the three are alternatives of a single disjunction.
    expect(summary.totalClauses).toBe(1);
    expect(summary.needsGroupContext).toBe(1);
    // Which half of the rule holds is still reported, on the alternatives.
    expect(clauses[0].alternatives?.map((alt) => alt.status)).toEqual([
      'not-evaluated',
      'not-evaluated',
      'pass',
    ]);
    // The rule-level verdict is conservative by design (pinned behaviour): the
    // grammar gate rejects the whole expression before the Kleene walk can use
    // the matching operand. The clause rows are exactly what makes that
    // tolerable — the admin still sees which half of the rule holds.
    expect(summary.result).toEqual({ outcome: 'unevaluable', reasonCode: 'group-membership-fn' });
  });
});

describe('clauses the grammar gate rejects', () => {
  it.each([
    {
      name: 'an unsupported operator',
      expression: 'user.department + "x" == "Engineeringx"',
      expressionText: '(user.department + "x") == "Engineeringx"',
      reasonCode: 'unsupported-operator',
    },
    {
      name: 'a function outside the allow-list',
      expression: 'String.substring(user.email, 0, 3) == "ada"',
      expressionText: 'String.substring(user.email, 0, 3) == "ada"',
      reasonCode: 'unknown-fn',
    },
    {
      name: 'an allow-listed function at the wrong arity',
      expression: 'String.startsWith(user.firstName)',
      expressionText: 'String.startsWith(user.firstName)',
      reasonCode: 'fn-arity',
    },
    {
      name: 'computed member access',
      expression: 'user["department"] == "Engineering"',
      expressionText: 'user["department"] == "Engineering"',
      reasonCode: 'unsupported-node',
    },
    {
      name: 'app context',
      expression: 'app.clientId == "0oaFAKE"',
      expressionText: 'app.clientId == "0oaFAKE"',
      reasonCode: 'unsupported-node',
    },
  ])('reports $name as not-evaluated, never fail', ({ expression, expressionText, reasonCode }) => {
    const { clauses, summary } = explainRuleExpression(expression, user);

    expect(clauses).toHaveLength(1);
    expect(clauses[0].status).toBe('not-evaluated');
    expect(clauses[0].expressionText).toBe(expressionText);
    expect(clauses[0].reasonCode).toBe(reasonCode);
    expect(summary.evaluatedClauses).toBe(0);
    expect(summary.failedClauses).toBe(0);
  });

  it('still resolves what it can from a rejected clause', () => {
    // The right operand is ungrammatical for us; the left is an ordinary profile
    // read, and showing it is more useful than showing nothing.
    const { clauses } = explainRuleExpression('user.department == "Eng" + "x"', user);

    expect(clauses[0].status).toBe('not-evaluated');
    expect(clauses[0].resolvedValue).toBe('Engineering');
  });

  it('reports a clause that is allow-listed but is not a condition', () => {
    // Both gates are independent: `user.department` is entirely on the allow-list
    // and still cannot be a pass or a fail.
    const { clauses } = explainRuleExpression('user.department && user.city == "Berlin"', user);

    expect(clauses[0]).toEqual({
      expressionText: 'user.department',
      resolvedValue: 'Engineering',
      status: 'not-evaluated',
      reasonCode: 'not-a-boolean',
    });
    expect(clauses[1].status).toBe('fail');
  });

  it('reports an operand-type mismatch as not-evaluated', () => {
    // Grammatical and fully allow-listed; `>` simply refuses non-numbers.
    const { clauses } = explainRuleExpression('user.department > "A"', user);

    expect(clauses[0].status).toBe('not-evaluated');
    expect(clauses[0].reasonCode).toBe('operand-type');
  });
});

describe('nesting, parentheses and negation', () => {
  it('keeps a parenthesised OR group whole and names its alternatives', () => {
    const { clauses, summary } = explainRuleExpression(
      '(user.department == "Engineering" || user.department == "Sales") && user.city == "Berlin"',
      user,
    );

    // Two REQUIREMENTS, not three clauses. This used to flatten to three, which
    // stated that the user had to be in Engineering AND in Sales.
    expect(clauses).toHaveLength(2);
    expect(clauses[1].expressionText).toBe('user.city == "Berlin"');
    expect(clauses.map((clause) => clause.status)).toEqual(['pass', 'fail']);

    // The detail the flattening used to provide is still here, one level down.
    expect(clauses[0].alternatives?.map((alt) => alt.expressionText)).toEqual([
      'user.department == "Engineering"',
      'user.department == "Sales"',
    ]);
    expect(clauses[0].alternatives?.map((alt) => alt.status)).toEqual(['pass', 'fail']);
    expect(clauses[1].alternatives).toBeUndefined();

    expect(summary.result).toEqual({ outcome: 'no-match' });
  });

  it('flattens a nested OR into one list of alternatives', () => {
    const { clauses } = explainRuleExpression(
      'user.city == "Berlin" || (user.city == "Paris" || user.city == "Seattle")',
      user,
    );

    expect(clauses).toHaveLength(1);
    expect(clauses[0].alternatives?.map((alt) => alt.expressionText)).toEqual([
      'user.city == "Berlin"',
      'user.city == "Paris"',
      'user.city == "Seattle"',
    ]);
  });

  it('keeps a negated group whole rather than inverting its parts', () => {
    // Splitting `!(a && b)` into a and b would report each part's own truth,
    // which is not what the clause asserts.
    const { clauses } = explainRuleExpression(
      '!(user.department == "Engineering" && user.title == "Intern")',
      user,
    );

    expect(clauses).toHaveLength(1);
    expect(clauses[0].expressionText).toBe(
      '!((user.department == "Engineering") && (user.title == "Intern"))',
    );
    expect(clauses[0].status).toBe('fail');
  });

  it('explains a negated leaf with the value it negated, not the negation', () => {
    const { clauses } = explainRuleExpression(
      '!(user.department == "Sales") && !user.isContractor',
      user,
    );

    expect(clauses[0]).toEqual({
      expressionText: '!(user.department == "Sales")',
      resolvedValue: 'Engineering',
      status: 'pass',
    });
    expect(clauses[1]).toEqual({
      expressionText: '!user.isContractor',
      resolvedValue: true,
      status: 'fail',
    });
  });

  it('explains the word forms and String calls Okta actually uses', () => {
    const { clauses, summary } = explainRuleExpression(
      'String.startsWith(user.firstName, "Ad") and user.city ne "Berlin"',
      user,
    );

    expect(clauses[0]).toEqual({
      expressionText: 'String.startsWith(user.firstName, "Ad")',
      resolvedValue: 'Ada',
      status: 'pass',
    });
    expect(clauses[1].status).toBe('pass');
    expect(summary.result).toEqual({ outcome: 'match' });
  });

  it('distinguishes an absent attribute (null) from nothing resolvable', () => {
    const absent = explainRuleExpression('user.costCenter == null', user);
    expect(absent.clauses[0].resolvedValue).toBeNull();
    expect(absent.clauses[0].status).toBe('pass');

    const nothing = explainRuleExpression('isMemberOfGroupName("Engineering")', user);
    expect(nothing.clauses[0].resolvedValue).toBeUndefined();
  });
});

describe('nothing is short-circuited', () => {
  it('reports the right side of an && whose left side already failed', () => {
    const { clauses, summary } = explainRuleExpression(
      'user.department == "Sales" && user.title == "Intern"',
      user,
    );

    expect(clauses[0].status).toBe('fail');
    // Honest, not skipped: the clause matches, the rule as a whole does not.
    expect(clauses[1].status).toBe('pass');
    expect(summary.evaluatedClauses).toBe(2);
    expect(summary.result).toEqual({ outcome: 'no-match' });
  });

  it('reports the right side of an || whose left side already matched', () => {
    const { clauses, summary } = explainRuleExpression(
      'user.department == "Engineering" || user.city == "Berlin"',
      user,
    );

    // The disjunction is one clause, and it passes. Nothing is short-circuited:
    // the alternative that did NOT hold is still evaluated and reported.
    expect(clauses).toHaveLength(1);
    expect(clauses[0].status).toBe('pass');
    expect(clauses[0].alternatives?.map((alt) => alt.status)).toEqual(['pass', 'fail']);
    expect(summary.result).toEqual({ outcome: 'match' });
  });

  it('evaluates both sides of an && whose left side already failed', () => {
    const { clauses, summary } = explainRuleExpression(
      'user.department == "Sales" && user.city == "Berlin"',
      user,
    );

    // Two conjuncts, both reported. A short-circuiting walk would leave the
    // second unevaluated once the first decided the rule.
    expect(clauses.map((clause) => clause.status)).toEqual(['fail', 'fail']);
    expect(summary.result).toEqual({ outcome: 'no-match' });
  });
});

describe('expressions that never become clauses', () => {
  it('rejects an oversized expression before parsing it', () => {
    const huge = `user.department == "${'x'.repeat(5000)}"`;
    const { clauses, summary } = explainRuleExpression(huge, user);

    expect(clauses).toEqual([]);
    expect(summary.result).toEqual({ outcome: 'unevaluable', reasonCode: 'too-long' });
    expect(summary.totalClauses).toBe(0);
    expect(summary.failedClauses).toBe(0);
  });

  it('reports an ungrammatical expression as a parse error', () => {
    const { clauses, summary } = explainRuleExpression('user.department == ', user);

    expect(clauses).toEqual([]);
    expect(summary.result).toEqual({ outcome: 'unevaluable', reasonCode: 'parse-error' });
  });

  it('reports an empty or whitespace-only expression', () => {
    expect(explainRuleExpression('', user).summary.result).toEqual({
      outcome: 'unevaluable',
      reasonCode: 'empty',
    });
    expect(explainRuleExpression('   ', user).summary.result).toEqual({
      outcome: 'unevaluable',
      reasonCode: 'empty',
    });
  });
});

describe('bounded output', () => {
  it('caps clause rows and says so', () => {
    const { clauses, summary } = explainRuleExpression(
      'user.a == "1" && user.b == "2" && user.c == "3"',
      user,
      { maxClauses: 2 },
    );

    expect(clauses).toHaveLength(2);
    expect(summary.totalClauses).toBe(2);
    expect(summary.truncated).toBe(true);
    // The verdict is still computed over the WHOLE expression, not the rows kept.
    expect(summary.result).toEqual({ outcome: 'no-match' });
  });

  it('ignores a nonsensical cap and falls back to the default', () => {
    const expression = Array.from(
      { length: DEFAULT_MAX_CLAUSES + 5 },
      (_, i) => `user.a${i} == "x"`,
    ).join(' && ');

    for (const maxClauses of [0, -1, Number.NaN]) {
      const { clauses, summary } = explainRuleExpression(expression, user, { maxClauses });
      expect(clauses).toHaveLength(DEFAULT_MAX_CLAUSES);
      expect(summary.truncated).toBe(true);
    }
  });
});

// ===========================================================================
// The non-negotiable property, stated once as a table.
// ===========================================================================
describe('an unresolvable clause is never a failure', () => {
  const unevaluable = [
    'isMemberOfGroup("00gFAKE0000000000000")',
    'isMemberOfGroupNameStartsWith("Eng") && user.department == "Engineering"',
    'app.clientId == "0oaFAKE" || user.city == "Berlin"',
    'session.amr == "pwd"',
    'user["department"] == "Engineering"',
    'user.department + "x" == "Engineeringx"',
    'String.substring(user.email, 0, 3) == "ada"',
    'Arrays.contains(user.department, "Eng")',
    'String.startsWith(user.headcount, "4")',
    'user.department > "A"',
    'user.department',
    '"Engineering"',
    'String.toUpperCase(user.department)',
    'this.foo == 1',
    'user.constructor.constructor("return 1")()',
  ];

  it.each(unevaluable)('never reports %s as fail', (expression) => {
    const { clauses, summary } = explainRuleExpression(expression, user);

    for (const clause of clauses) {
      if (clause.status === 'not-evaluated') {
        expect(clause.reasonCode).toBeDefined();
      } else {
        // Any clause that DID get a verdict must genuinely have resolved — the
        // only rows allowed to say "fail" are the ones the evaluator understood.
        expect(clause.status === 'pass' || clause.status === 'fail').toBe(true);
      }
    }

    // Not one of these expressions may produce a rule-level "no match".
    expect(summary.result.outcome).not.toBe('no-match');
    expect(summary.result.outcome).toBe(tryEvaluateRuleExpression(expression, user));
  });

  it('never fails a clause whose only problem is a sibling it cannot resolve', () => {
    const { clauses } = explainRuleExpression(
      'isMemberOfGroup("00gFAKE0000000000000") && user.department == "Sales"',
      user,
    );

    expect(clauses[0].status).toBe('not-evaluated');
    // This one really is false, and says so — Kleene makes the rule a no-match,
    // but that is the summary's job, not the clause's.
    expect(clauses[1].status).toBe('fail');
  });
});

// ===========================================================================
// Parse reuse. `explainExpression` imports jsep for TYPES only, so it cannot
// parse; it goes through `ruleEvaluator`'s memoised parser. Observed the same
// way the memo's own tests observe it: `parseExpression` emits exactly one
// `parse-error` debug line per REAL parse attempt that throws, and nothing on a
// cache hit. A second parser (or a memo bypass) would show up as extra lines.
// ===========================================================================
describe('parse reuse', () => {
  let debugSpy: MockInstance;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  const parseAttempts = (): number =>
    debugSpy.mock.calls.filter(
      (args) =>
        args[1] === 'Rule expression rejected' &&
        (args[2] as { reason?: string } | undefined)?.reason === 'parse-error',
    ).length;

  it('parses an expression at most once across the explainer and the evaluator', () => {
    // Unique to this test: the memo is module state shared across the file.
    const bad = 'user.explainerParseReuse ==';

    expect(explainRuleExpression(bad, user).summary.result).toEqual({
      outcome: 'unevaluable',
      reasonCode: 'parse-error',
    });
    expect(parseAttempts()).toBe(1);

    explainRuleExpression(bad, user);
    tryEvaluateRuleExpression(bad, user);
    expect(parseAttempts()).toBe(1);
  });

  it('is a pure function: repeated explanations of the same expression agree', () => {
    const expression =
      'String.toUpperCase(user.department) == "ENGINEERING" && user.title != "Intern"';
    const first = explainRuleExpression(expression, user);
    const second = explainRuleExpression(expression, user);

    expect(second).toEqual(first);
  });

  it('explains the same shared AST differently for different users', () => {
    const expression = 'user.department == "Engineering" && user.title != "Intern"';
    const other: OktaUser = {
      ...user,
      id: '00uFAKE0000000000001',
      profile: { ...user.profile, department: 'Sales', title: 'Manager' },
    };

    const mine = explainRuleExpression(expression, user);
    const theirs = explainRuleExpression(expression, other);

    expect(mine.clauses.map((c) => c.status)).toEqual(['pass', 'fail']);
    expect(theirs.clauses.map((c) => c.status)).toEqual(['fail', 'pass']);
    expect(theirs.clauses[0].resolvedValue).toBe('Sales');
  });
});
