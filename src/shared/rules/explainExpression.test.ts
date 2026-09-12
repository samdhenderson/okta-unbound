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
    // Present and explicitly `null`, and a multi-valued attribute: both are
    // states the absent-attribute and array rows below have to be contrasted
    // against.
    nullable: null,
    roles: ['admin', 'dev'],
    // A custom attribute whose name is not a valid bare identifier, reachable
    // only through computed access.
    'cost center': 'CC-9',
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

describe('isMemberOfGroupNameRegex references (ADR-0002)', () => {
  /** The user's complete membership set, as the group-context option requires. */
  const groups = [
    { id: '00gFAKEgroup0001', name: 'SecOps-Alpha' },
    { id: '00gFAKEgroup0002', name: 'Engineering' },
  ];

  it('carries the pattern as a structured reference, satisfied by the name that matched', () => {
    const { clauses } = explainRuleExpression('isMemberOfGroupNameRegex("^SecOps-.*")', user, {
      groups,
    });

    expect(clauses[0].status).toBe('pass');
    expect(clauses[0].groupRequirement).toBe('member');
    expect(clauses[0].groupReferences).toEqual([
      {
        match: 'nameRegex',
        value: '^SecOps-.*',
        satisfied: true,
        matchedGroupName: 'SecOps-Alpha',
      },
    ]);
  });

  it('reports an unsatisfied pattern as unsatisfied, with no group named', () => {
    const { clauses } = explainRuleExpression('isMemberOfGroupNameRegex("^Finance-.*")', user, {
      groups,
    });

    expect(clauses[0].status).toBe('fail');
    expect(clauses[0].groupReferences).toEqual([
      { match: 'nameRegex', value: '^Finance-.*', satisfied: false },
    ]);
  });

  it('carries no references at all when the engine declined the pattern', () => {
    // `satisfied: false` beside a check that never ran reads as a definite "not
    // in any of these", which is the claim a decline has not earned.
    const { clauses } = explainRuleExpression('isMemberOfGroupNameRegex("(?=Sec).*")', user, {
      groups,
    });

    expect(clauses[0].status).toBe('not-evaluated');
    expect(clauses[0].reasonCode).toBe('regex-unsupported-syntax');
    expect(clauses[0].groupReferences).toBeUndefined();
    expect(clauses[0].groupRequirement).toBeUndefined();
  });

  it('looks through a negation, like the other membership forms', () => {
    const { clauses } = explainRuleExpression('!isMemberOfGroupNameRegex("^SecOps-.*")', user, {
      groups,
    });

    expect(clauses[0].status).toBe('fail');
    expect(clauses[0].groupRequirement).toBe('non-member');
    expect(clauses[0].groupReferences?.map((r) => r.satisfied)).toEqual([true]);
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
      // `String.replaceFirst` takes a regular expression in the language Okta's
      // EL is built on, so the evaluator refuses it rather than approximating it
      // as a literal replace. `String.substring` used to stand here and is now
      // implemented.
      expression: 'String.replaceFirst(user.email, "a", "b") == "ada"',
      expressionText: 'String.replaceFirst(user.email, "a", "b") == "ada"',
      reasonCode: 'unknown-fn',
    },
    {
      name: 'an allow-listed function at the wrong arity',
      expression: 'String.startsWith(user.firstName)',
      expressionText: 'String.startsWith(user.firstName)',
      reasonCode: 'fn-arity',
    },
    {
      // A string-literal computed key now resolves the same as its dotted
      // form; only a non-literal computed key stays unsupported. See
      // "computed member access" below for the now-supported case.
      name: 'a non-literal computed member access',
      expression: 'user[user.department] == "Engineering"',
      expressionText: 'user[user.department] == "Engineering"',
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

  it('distinguishes an attribute present-and-null from one that is absent', () => {
    // Present and explicitly null is a value the org holds, so it compares.
    const present = explainRuleExpression('user.nullable == null', user);
    expect(present.clauses[0].resolvedValue).toBeNull();
    expect(present.clauses[0].status).toBe('pass');

    // Absent is the evaluator not understanding the expression, and it must not
    // be dressed up as a satisfied `== null` (D-114).
    const absent = explainRuleExpression('user.costCenter == null', user);
    expect(absent.clauses[0].status).toBe('not-evaluated');
    expect(absent.clauses[0].reasonCode).toBe('attribute-absent');

    const nothing = explainRuleExpression('isMemberOfGroupName("Engineering")', user);
    expect(nothing.clauses[0].resolvedValue).toBeUndefined();
  });
});

describe('String.stringSwitch — matched cases and the required default', () => {
  it('stringifies the call generically and reports the matched value', () => {
    const { clauses } = explainRuleExpression(
      'String.stringSwitch(user.department, "Other", "Eng", "yes") == "yes"',
      user,
    );
    expect(clauses[0]).toEqual({
      expressionText: 'String.stringSwitch(user.department, "Other", "Eng", "yes") == "yes"',
      resolvedValue: 'yes',
      status: 'pass',
    });
  });

  it('reports the default value when no pair matches', () => {
    const { clauses } = explainRuleExpression(
      'String.stringSwitch(user.department, "Other", "Sales", "yes") == "Other"',
      user,
    );
    expect(clauses[0]).toEqual({
      expressionText: 'String.stringSwitch(user.department, "Other", "Sales", "yes") == "Other"',
      resolvedValue: 'Other',
      status: 'pass',
    });
  });

  it('is not-evaluated with fn-arity for a lone trailing key, never a guess', () => {
    const { clauses } = explainRuleExpression(
      'String.stringSwitch(user.department, "Other", "Eng") == "Other"',
      user,
    );
    expect(clauses[0].status).toBe('not-evaluated');
    expect(clauses[0].reasonCode).toBe('fn-arity');
  });
});

describe('unary minus and computed member access', () => {
  it('stringifies a negative literal faithfully', () => {
    const { clauses, summary } = explainRuleExpression('user.headcount >= -1', user);

    expect(clauses[0]).toEqual({
      expressionText: 'user.headcount >= -1',
      resolvedValue: 42,
      status: 'pass',
    });
    expect(summary.result).toEqual({ outcome: 'match' });
  });

  it('stringifies computed member access with its original quoting', () => {
    const { clauses, summary } = explainRuleExpression('user["cost center"] == "CC-9"', user);

    expect(clauses[0]).toEqual({
      expressionText: 'user["cost center"] == "CC-9"',
      resolvedValue: 'CC-9',
      status: 'pass',
    });
    expect(summary.result).toEqual({ outcome: 'match' });
  });

  it('reports a failing computed-access clause, never as not-evaluated', () => {
    const { clauses } = explainRuleExpression('user["cost center"] == "CC-1"', user);
    expect(clauses[0]).toEqual({
      expressionText: 'user["cost center"] == "CC-1"',
      resolvedValue: 'CC-9',
      status: 'fail',
    });
  });

  it('reports attribute-absent for a computed key the profile does not carry', () => {
    const { clauses } = explainRuleExpression('user["cost centre"] == "CC-9"', user);
    expect(clauses[0].status).toBe('not-evaluated');
    expect(clauses[0].reasonCode).toBe('attribute-absent');
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
    // Attributes the fixture actually carries: the subject is truncation and the
    // whole-expression verdict, and reading three absent attributes would make
    // every clause `not-evaluated` and the verdict `unevaluable` for reasons
    // that have nothing to do with the cap.
    const { clauses, summary } = explainRuleExpression(
      'user.department == "1" && user.title == "2" && user.city == "3"',
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
    // A string-literal computed key now resolves (see the dedicated describe
    // block below); only a non-literal one stays unsupported.
    'user[user.department] == "Engineering"',
    'user.department + "x" == "Engineeringx"',
    'String.replaceFirst(user.email, "a", "b") == "ada"',
    'Arrays.flatten(user.roles)',
    'Arrays.contains(user.department, "Eng")',
    'user.costCenter == "1234"',
    'user.roles == "admin,dev"',
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

// A conditional is ONE clause. Its branches are not alternatives the admin can
// satisfy independently — which branch is even read depends on the test — so
// splitting it would describe a rule nobody wrote. The evaluator now answers
// them, so the rows carry real verdicts rather than `unsupported-node`.
describe('conditional expressions are a single clause', () => {
  it('stringifies a conditional faithfully, parenthesising a binary part', () => {
    const { clauses } = explainRuleExpression(
      'user.department == "Engineering" ? "EMEA" : "AMER"',
      user,
    );

    expect(clauses).toHaveLength(1);
    expect(clauses[0].expressionText).toBe('(user.department == "Engineering") ? "EMEA" : "AMER"');
    // Allow-listed, resolved — but a string is not a condition.
    expect(clauses[0].status).toBe('not-evaluated');
    expect(clauses[0].reasonCode).toBe('not-a-boolean');
  });

  it('does not split a conditional whose branches contain connectives', () => {
    const { clauses } = explainRuleExpression(
      'user.isContractor ? (user.department == "Engineering" && user.title == "Intern") : false',
      user,
    );

    expect(clauses).toHaveLength(1);
    expect(clauses[0].status).toBe('pass');
  });

  it('passes, fails, and withholds on the chosen branch', () => {
    const pass = explainRuleExpression(
      'user.isContractor ? user.department == "Engineering" : false',
      user,
    );
    const fail = explainRuleExpression(
      'user.isContractor ? user.department == "Sales" : false',
      user,
    );
    // `>` is allow-listed but gives up unless both operands are numbers.
    const withheld = explainRuleExpression(
      'user.isContractor ? user.department > "A" : false',
      user,
    );

    expect(pass.clauses[0].status).toBe('pass');
    expect(fail.clauses[0].status).toBe('fail');
    expect(withheld.clauses[0].status).toBe('not-evaluated');
    expect(withheld.clauses[0].reasonCode).toBe('operand-type');
  });

  it('is one clause among the conjuncts around it', () => {
    const { clauses, summary } = explainRuleExpression(
      'user.city == "San Francisco" && (user.isContractor ? user.title == "Manager" : false)',
      user,
    );

    expect(clauses.map((c) => c.expressionText)).toEqual([
      'user.city == "San Francisco"',
      'user.isContractor ? (user.title == "Manager") : false',
    ]);
    expect(clauses.map((c) => c.status)).toEqual(['pass', 'fail']);
    expect(summary.result).toEqual({ outcome: 'no-match' });
  });
});
