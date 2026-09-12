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
import {
  explainRuleExpression,
  DEFAULT_MAX_CLAUSES,
  type ClauseStatus,
  type ClauseTreeNode,
  type ConnectiveNode,
  type LeafClauseNode,
  userAttributeNamesRead,
} from './explainExpression';
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

// ---------------------------------------------------------------------------
// Reading the tree as requirements.
//
// This suite was written against a flat `clauses` list that no longer exists;
// every assertion below was retargeted onto the tree, which is now the only
// projection. The three helpers are the whole of that mapping: a top-level
// requirement is a child of the root AND (or the root itself), which is exactly
// what the flat list held, and `rowOf` strips the two fields a leaf carries that
// a row never did, so the whole-object assertions still read as they did.
// ---------------------------------------------------------------------------

/**
 * The condition's top-level requirements: the conjuncts of the root, with a
 * disjunction kept whole as one. The unit {@link RuleExplanationSummary} counts.
 */
function requirements(tree: ClauseTreeNode): readonly ClauseTreeNode[] {
  return tree.node === 'connective' && tree.kind === 'and' ? tree.children : [tree];
}

/** Requirement `index` as a leaf, failing the test when it is a connective group. */
function leafAt(tree: ClauseTreeNode, index: number): LeafClauseNode {
  const node = requirements(tree)[index];
  if (!node) throw new Error(`no requirement at index ${index}`);
  if (node.node !== 'leaf') throw new Error(`requirement ${index} is a ${node.kind} group`);
  return node;
}

/** Requirement `index` as a connective group, failing the test when it is a leaf. */
function groupAt(tree: ClauseTreeNode, index: number): ConnectiveNode {
  const node = requirements(tree)[index];
  if (!node) throw new Error(`no requirement at index ${index}`);
  if (node.node !== 'connective') throw new Error(`requirement ${index} is a leaf`);
  return node;
}

/** A node's own outcome, whichever kind of node it is. */
function statusOf(node: ClauseTreeNode): ClauseStatus {
  return node.node === 'leaf' ? node.status : node.verdict;
}

/** One node as a leaf, failing the test when it is a connective group. */
function leafOf(node: ClauseTreeNode | undefined): LeafClauseNode {
  if (!node) throw new Error('expected a node, got nothing');
  if (node.node !== 'leaf') throw new Error(`expected a leaf, got a ${node.kind} group`);
  return node;
}

/** Every leaf under a node, in source order. */
function leavesOf(node: ClauseTreeNode): readonly LeafClauseNode[] {
  return node.node === 'leaf' ? [node] : node.children.flatMap(leavesOf);
}

/**
 * A leaf's clause facts, without the two fields only a tree node carries.
 *
 * Built field by field rather than by rest-destructuring so that an optional
 * field genuinely absent on the node stays absent here — `toEqual` would
 * otherwise be comparing against a key the row never had.
 */
function rowOf(node: LeafClauseNode): Omit<LeafClauseNode, 'node' | 'reads'> {
  return {
    expressionText: node.expressionText,
    resolvedValue: node.resolvedValue,
    status: node.status,
    ...(node.reasonCode !== undefined ? { reasonCode: node.reasonCode } : {}),
    ...(node.groupReferences ? { groupReferences: node.groupReferences } : {}),
    ...(node.groupRequirement ? { groupRequirement: node.groupRequirement } : {}),
  };
}

describe('explainRuleExpression — the §H example', () => {
  const expression = 'user.department == "Engineering" && user.title != "Intern"';

  it('reports one row per clause, with the profile values that drove each outcome', () => {
    const { tree } = explainRuleExpression(expression, user);

    expect(requirements(tree)).toHaveLength(2);
    expect(rowOf(leafAt(tree, 0))).toEqual({
      expressionText: 'user.department == "Engineering"',
      resolvedValue: 'Engineering',
      status: 'pass',
    });
    expect(rowOf(leafAt(tree, 1))).toEqual({
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
    const { tree, summary } = explainRuleExpression(expression, user);

    expect(requirements(tree)).toHaveLength(2);
    expect(rowOf(leafAt(tree, 0))).toEqual({
      expressionText: 'isMemberOfGroup("00gFAKE0000000000000")',
      resolvedValue: undefined,
      status: 'not-evaluated',
      reasonCode: 'group-membership-fn',
    });
    // The whole point: the sibling is NOT collapsed into the same "don't know".
    expect(leafAt(tree, 1).status).toBe('pass');
    expect(leafAt(tree, 1).resolvedValue).toBe('Engineering');

    expect(summary.evaluatedClauses).toBe(1);
    expect(summary.totalClauses).toBe(2);
    expect(summary.needsGroupContext).toBe(1);
    // "1 of 2 clauses evaluated, 1 needs group context" — and no verdict.
    expect(summary.result).toEqual({ outcome: 'unevaluable', reasonCode: 'group-membership-fn' });
  });

  it('counts every group-membership flavour toward needsGroupContext', () => {
    const { tree, summary } = explainRuleExpression(
      'isMemberOfGroupName("Engineering") || isMemberOfAnyGroup("00gFAKE1", "00gFAKE2") || user.city == "San Francisco"',
      user,
    );

    // One requirement now: the three are alternatives of a single disjunction.
    expect(summary.totalClauses).toBe(1);
    expect(summary.needsGroupContext).toBe(1);
    // Which half of the rule holds is still reported, on the alternatives.
    expect(groupAt(tree, 0).children.map(statusOf)).toEqual([
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
    const { tree } = explainRuleExpression('isMemberOfGroupNameRegex("^SecOps-.*")', user, {
      groups,
    });

    expect(leafAt(tree, 0).status).toBe('pass');
    expect(leafAt(tree, 0).groupRequirement).toBe('member');
    expect(leafAt(tree, 0).groupReferences).toEqual([
      {
        match: 'nameRegex',
        value: '^SecOps-.*',
        satisfied: true,
        matchedGroupName: 'SecOps-Alpha',
      },
    ]);
  });

  it('reports an unsatisfied pattern as unsatisfied, with no group named', () => {
    const { tree } = explainRuleExpression('isMemberOfGroupNameRegex("^Finance-.*")', user, {
      groups,
    });

    expect(leafAt(tree, 0).status).toBe('fail');
    expect(leafAt(tree, 0).groupReferences).toEqual([
      { match: 'nameRegex', value: '^Finance-.*', satisfied: false },
    ]);
  });

  it('carries no references at all when the engine declined the pattern', () => {
    // `satisfied: false` beside a check that never ran reads as a definite "not
    // in any of these", which is the claim a decline has not earned.
    const { tree } = explainRuleExpression('isMemberOfGroupNameRegex("(?=Sec).*")', user, {
      groups,
    });

    expect(leafAt(tree, 0).status).toBe('not-evaluated');
    expect(leafAt(tree, 0).reasonCode).toBe('regex-unsupported-syntax');
    expect(leafAt(tree, 0).groupReferences).toBeUndefined();
    expect(leafAt(tree, 0).groupRequirement).toBeUndefined();
  });

  it('looks through a negation, like the other membership forms', () => {
    const { tree } = explainRuleExpression('!isMemberOfGroupNameRegex("^SecOps-.*")', user, {
      groups,
    });

    expect(leafAt(tree, 0).status).toBe('fail');
    expect(leafAt(tree, 0).groupRequirement).toBe('non-member');
    expect(leafAt(tree, 0).groupReferences?.map((r) => r.satisfied)).toEqual([true]);
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
    const { tree, summary } = explainRuleExpression(expression, user);

    expect(requirements(tree)).toHaveLength(1);
    expect(leafAt(tree, 0).status).toBe('not-evaluated');
    expect(leafAt(tree, 0).expressionText).toBe(expressionText);
    expect(leafAt(tree, 0).reasonCode).toBe(reasonCode);
    expect(summary.evaluatedClauses).toBe(0);
    expect(summary.failedClauses).toBe(0);
  });

  it('still resolves what it can from a rejected clause', () => {
    // The right operand is ungrammatical for us; the left is an ordinary profile
    // read, and showing it is more useful than showing nothing.
    const { tree } = explainRuleExpression('user.department == "Eng" + "x"', user);

    expect(leafAt(tree, 0).status).toBe('not-evaluated');
    expect(leafAt(tree, 0).resolvedValue).toBe('Engineering');
  });

  it('reports a clause that is allow-listed but is not a condition', () => {
    // Both gates are independent: `user.department` is entirely on the allow-list
    // and still cannot be a pass or a fail.
    const { tree } = explainRuleExpression('user.department && user.city == "Berlin"', user);

    expect(rowOf(leafAt(tree, 0))).toEqual({
      expressionText: 'user.department',
      resolvedValue: 'Engineering',
      status: 'not-evaluated',
      reasonCode: 'not-a-boolean',
    });
    expect(leafAt(tree, 1).status).toBe('fail');
  });

  it('reports an operand-type mismatch as not-evaluated', () => {
    // Grammatical and fully allow-listed; `>` simply refuses non-numbers.
    const { tree } = explainRuleExpression('user.department > "A"', user);

    expect(leafAt(tree, 0).status).toBe('not-evaluated');
    expect(leafAt(tree, 0).reasonCode).toBe('operand-type');
  });
});

describe('nesting, parentheses and negation', () => {
  it('keeps a parenthesised OR group whole and names its alternatives', () => {
    const { tree, summary } = explainRuleExpression(
      '(user.department == "Engineering" || user.department == "Sales") && user.city == "Berlin"',
      user,
    );

    // Two REQUIREMENTS, not three clauses. This used to flatten to three, which
    // stated that the user had to be in Engineering AND in Sales.
    expect(requirements(tree)).toHaveLength(2);
    expect(leafAt(tree, 1).expressionText).toBe('user.city == "Berlin"');
    expect(requirements(tree).map(statusOf)).toEqual(['pass', 'fail']);

    // The detail the flattening used to provide is still here, one level down —
    // as the OR group's children, which is where it lives now.
    expect(groupAt(tree, 0).children.map((alt) => leafOf(alt).expressionText)).toEqual([
      'user.department == "Engineering"',
      'user.department == "Sales"',
    ]);
    expect(groupAt(tree, 0).children.map(statusOf)).toEqual(['pass', 'fail']);
    // The other requirement is a plain clause, with no alternatives to descend into.
    expect(requirements(tree)[1]?.node).toBe('leaf');

    expect(summary.result).toEqual({ outcome: 'no-match' });
  });

  it('flattens a nested OR into one list of alternatives', () => {
    const { tree } = explainRuleExpression(
      'user.city == "Berlin" || (user.city == "Paris" || user.city == "Seattle")',
      user,
    );

    expect(requirements(tree)).toHaveLength(1);
    expect(groupAt(tree, 0).children.map((alt) => leafOf(alt).expressionText)).toEqual([
      'user.city == "Berlin"',
      'user.city == "Paris"',
      'user.city == "Seattle"',
    ]);
  });

  it('keeps a negated group whole rather than inverting its parts', () => {
    // Splitting `!(a && b)` into a and b would report each part's own truth,
    // which is not what the clause asserts.
    const { tree } = explainRuleExpression(
      '!(user.department == "Engineering" && user.title == "Intern")',
      user,
    );

    expect(requirements(tree)).toHaveLength(1);
    expect(leafAt(tree, 0).expressionText).toBe(
      '!((user.department == "Engineering") && (user.title == "Intern"))',
    );
    expect(leafAt(tree, 0).status).toBe('fail');
  });

  it('explains a negated leaf with the value it negated, not the negation', () => {
    const { tree } = explainRuleExpression(
      '!(user.department == "Sales") && !user.isContractor',
      user,
    );

    expect(rowOf(leafAt(tree, 0))).toEqual({
      expressionText: '!(user.department == "Sales")',
      resolvedValue: 'Engineering',
      status: 'pass',
    });
    expect(rowOf(leafAt(tree, 1))).toEqual({
      expressionText: '!user.isContractor',
      resolvedValue: true,
      status: 'fail',
    });
  });

  it('explains the word forms and String calls Okta actually uses', () => {
    const { tree, summary } = explainRuleExpression(
      'String.startsWith(user.firstName, "Ad") and user.city ne "Berlin"',
      user,
    );

    expect(rowOf(leafAt(tree, 0))).toEqual({
      expressionText: 'String.startsWith(user.firstName, "Ad")',
      resolvedValue: 'Ada',
      status: 'pass',
    });
    expect(leafAt(tree, 1).status).toBe('pass');
    expect(summary.result).toEqual({ outcome: 'match' });
  });

  it('reads present-and-null and absent as the same value, because Okta cannot tell them apart', () => {
    // Okta reports "no value" by omitting the attribute, so both states are the
    // same fact and both compare (ADR-0004). The reading this test used to pin —
    // absent as unreadable — is now guarded where it actually mattered: a
    // top-level field resolves off the user root (D-114), covered in
    // `ruleEvaluator.test.ts`.
    const present = leafOf(explainRuleExpression('user.nullable == null', user).tree);
    expect(present.resolvedValue).toBeNull();
    expect(present.status).toBe('pass');

    const absent = leafOf(explainRuleExpression('user.costCenter == null', user).tree);
    expect(absent.status).toBe('pass');
    expect(absent.reasonCode).toBeUndefined();

    // A clause that genuinely could not be read still carries no value at all —
    // distinct from one that resolved to `null`.
    const nothing = leafOf(explainRuleExpression('isMemberOfGroupName("Engineering")', user).tree);
    expect(nothing.resolvedValue).toBeUndefined();
    expect(nothing.status).toBe('not-evaluated');
  });
});

describe('String.stringSwitch — matched cases and the required default', () => {
  it('stringifies the call generically and reports the matched value', () => {
    const { tree } = explainRuleExpression(
      'String.stringSwitch(user.department, "Other", "Eng", "yes") == "yes"',
      user,
    );
    expect(rowOf(leafAt(tree, 0))).toEqual({
      expressionText: 'String.stringSwitch(user.department, "Other", "Eng", "yes") == "yes"',
      resolvedValue: 'yes',
      status: 'pass',
    });
  });

  it('reports the default value when no pair matches', () => {
    const { tree } = explainRuleExpression(
      'String.stringSwitch(user.department, "Other", "Sales", "yes") == "Other"',
      user,
    );
    expect(rowOf(leafAt(tree, 0))).toEqual({
      expressionText: 'String.stringSwitch(user.department, "Other", "Sales", "yes") == "Other"',
      resolvedValue: 'Other',
      status: 'pass',
    });
  });

  it('is not-evaluated with fn-arity for a lone trailing key, never a guess', () => {
    const { tree } = explainRuleExpression(
      'String.stringSwitch(user.department, "Other", "Eng") == "Other"',
      user,
    );
    expect(leafAt(tree, 0).status).toBe('not-evaluated');
    expect(leafAt(tree, 0).reasonCode).toBe('fn-arity');
  });
});

describe('unary minus and computed member access', () => {
  it('stringifies a negative literal faithfully', () => {
    const { tree, summary } = explainRuleExpression('user.headcount >= -1', user);

    expect(rowOf(leafAt(tree, 0))).toEqual({
      expressionText: 'user.headcount >= -1',
      resolvedValue: 42,
      status: 'pass',
    });
    expect(summary.result).toEqual({ outcome: 'match' });
  });

  it('stringifies computed member access with its original quoting', () => {
    const { tree, summary } = explainRuleExpression('user["cost center"] == "CC-9"', user);

    expect(rowOf(leafAt(tree, 0))).toEqual({
      expressionText: 'user["cost center"] == "CC-9"',
      resolvedValue: 'CC-9',
      status: 'pass',
    });
    expect(summary.result).toEqual({ outcome: 'match' });
  });

  it('reports a failing computed-access clause, never as not-evaluated', () => {
    const { tree } = explainRuleExpression('user["cost center"] == "CC-1"', user);
    expect(rowOf(leafAt(tree, 0))).toEqual({
      expressionText: 'user["cost center"] == "CC-1"',
      resolvedValue: 'CC-9',
      status: 'fail',
    });
  });

  it('resolves a computed key the profile does not carry to null, and fails the clause', () => {
    const { tree } = explainRuleExpression('user["cost centre"] == "CC-9"', user);
    expect(leafAt(tree, 0).status).toBe('fail');
    expect(leafAt(tree, 0).reasonCode).toBeUndefined();
    expect(leafAt(tree, 0).reads).toEqual([{ path: 'user["cost centre"]', value: null }]);
  });
});

describe('nothing is short-circuited', () => {
  it('reports the right side of an && whose left side already failed', () => {
    const { tree, summary } = explainRuleExpression(
      'user.department == "Sales" && user.title == "Intern"',
      user,
    );

    expect(leafAt(tree, 0).status).toBe('fail');
    // Honest, not skipped: the clause matches, the rule as a whole does not.
    expect(leafAt(tree, 1).status).toBe('pass');
    expect(summary.evaluatedClauses).toBe(2);
    expect(summary.result).toEqual({ outcome: 'no-match' });
  });

  it('reports the right side of an || whose left side already matched', () => {
    const { tree, summary } = explainRuleExpression(
      'user.department == "Engineering" || user.city == "Berlin"',
      user,
    );

    // The disjunction is one clause, and it passes. Nothing is short-circuited:
    // the alternative that did NOT hold is still evaluated and reported.
    expect(requirements(tree)).toHaveLength(1);
    expect(statusOf(requirements(tree)[0])).toBe('pass');
    expect(groupAt(tree, 0).children.map(statusOf)).toEqual(['pass', 'fail']);
    expect(summary.result).toEqual({ outcome: 'match' });
  });

  it('evaluates both sides of an && whose left side already failed', () => {
    const { tree, summary } = explainRuleExpression(
      'user.department == "Sales" && user.city == "Berlin"',
      user,
    );

    // Two conjuncts, both reported. A short-circuiting walk would leave the
    // second unevaluated once the first decided the rule.
    expect(requirements(tree).map(statusOf)).toEqual(['fail', 'fail']);
    expect(summary.result).toEqual({ outcome: 'no-match' });
  });
});

describe('expressions that never become clauses', () => {
  it('rejects an oversized expression before parsing it', () => {
    const huge = `user.department == "${'x'.repeat(5000)}"`;
    const { tree, summary } = explainRuleExpression(huge, user);

    // No clause to count, and a root that states the reason rather than echoing
    // the 5KB blob back.
    expect(rowOf(leafOf(tree))).toEqual({
      expressionText: '',
      resolvedValue: undefined,
      status: 'not-evaluated',
      reasonCode: 'too-long',
    });
    expect(summary.result).toEqual({ outcome: 'unevaluable', reasonCode: 'too-long' });
    expect(summary.totalClauses).toBe(0);
    expect(summary.failedClauses).toBe(0);
  });

  it('reports an ungrammatical expression as a parse error', () => {
    const { tree, summary } = explainRuleExpression('user.department == ', user);

    expect(summary.totalClauses).toBe(0);
    expect(leafOf(tree).reasonCode).toBe('parse-error');
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
    const { tree, summary } = explainRuleExpression(
      'user.department == "1" && user.title == "2" && user.city == "3"',
      user,
      { maxClauses: 2 },
    );

    expect(requirements(tree)).toHaveLength(2);
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
      const { tree, summary } = explainRuleExpression(expression, user, { maxClauses });
      expect(requirements(tree)).toHaveLength(DEFAULT_MAX_CLAUSES);
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
    const { tree, summary } = explainRuleExpression(expression, user);

    // Every leaf, not merely the top-level requirements: the tree reaches inside
    // an OR group, so this table now holds one level deeper than it could.
    for (const clause of leavesOf(tree)) {
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
    const { tree } = explainRuleExpression(
      'isMemberOfGroup("00gFAKE0000000000000") && user.department == "Sales"',
      user,
    );

    expect(leafAt(tree, 0).status).toBe('not-evaluated');
    // This one really is false, and says so — Kleene makes the rule a no-match,
    // but that is the summary's job, not the clause's.
    expect(leafAt(tree, 1).status).toBe('fail');
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

    expect(requirements(mine.tree).map(statusOf)).toEqual(['pass', 'fail']);
    expect(requirements(theirs.tree).map(statusOf)).toEqual(['fail', 'pass']);
    expect(leafAt(theirs.tree, 0).resolvedValue).toBe('Sales');
  });
});

// A conditional is ONE clause. Its branches are not alternatives the admin can
// satisfy independently — which branch is even read depends on the test — so
// splitting it would describe a rule nobody wrote. The evaluator now answers
// them, so the rows carry real verdicts rather than `unsupported-node`.
describe('conditional expressions are a single clause', () => {
  it('stringifies a conditional faithfully, parenthesising a binary part', () => {
    const { tree } = explainRuleExpression(
      'user.department == "Engineering" ? "EMEA" : "AMER"',
      user,
    );

    expect(requirements(tree)).toHaveLength(1);
    expect(leafAt(tree, 0).expressionText).toBe(
      '(user.department == "Engineering") ? "EMEA" : "AMER"',
    );
    // Allow-listed, resolved — but a string is not a condition.
    expect(leafAt(tree, 0).status).toBe('not-evaluated');
    expect(leafAt(tree, 0).reasonCode).toBe('not-a-boolean');
  });

  it('does not split a conditional whose branches contain connectives', () => {
    const { tree } = explainRuleExpression(
      'user.isContractor ? (user.department == "Engineering" && user.title == "Intern") : false',
      user,
    );

    expect(requirements(tree)).toHaveLength(1);
    expect(leafAt(tree, 0).status).toBe('pass');
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

    expect(leafOf(pass.tree).status).toBe('pass');
    expect(leafOf(fail.tree).status).toBe('fail');
    expect(leafOf(withheld.tree).status).toBe('not-evaluated');
    expect(leafOf(withheld.tree).reasonCode).toBe('operand-type');
  });

  it('is one clause among the conjuncts around it', () => {
    const { tree, summary } = explainRuleExpression(
      'user.city == "San Francisco" && (user.isContractor ? user.title == "Manager" : false)',
      user,
    );

    expect(requirements(tree).map((node) => leafOf(node).expressionText)).toEqual([
      'user.city == "San Francisco"',
      'user.isContractor ? (user.title == "Manager") : false',
    ]);
    expect(requirements(tree).map(statusOf)).toEqual(['pass', 'fail']);
    expect(summary.result).toEqual({ outcome: 'no-match' });
  });
});

// ===========================================================================
// The exact read set — a correctness input, not a label
// ===========================================================================
// `blastRadius` decides whether a profile edit can possibly move a rule's verdict
// by comparing this set against the drafted keys. A miss would claim an edit
// cannot reach a rule it does reach, so the two failure directions are pinned
// separately: a name that must be found, and a shape that must refuse to answer.
describe('userAttributeNamesRead', () => {
  it('reads the dotted and computed forms as the same attribute name', () => {
    expect(userAttributeNamesRead('user.department == "Eng"')).toEqual(new Set(['department']));
    expect(userAttributeNamesRead('user["department"] == "Eng"')).toEqual(new Set(['department']));
    expect(userAttributeNamesRead('user[\'cost center\'] == "CC-9"')).toEqual(
      new Set(['cost center']),
    );
  });

  it('finds every read, however deeply nested', () => {
    expect(
      userAttributeNamesRead(
        'String.startsWith(user.title, "Sr") && (user.city == "Berlin" || !(user.headcount > 3)) ? user.region == "EU" : user.division == "EMEA"',
      ),
    ).toEqual(new Set(['title', 'city', 'headcount', 'region', 'division']));
  });

  it('finds a read inside a group-membership argument', () => {
    expect(userAttributeNamesRead('isMemberOfGroupName(user.department)')).toEqual(
      new Set(['department']),
    );
  });

  it('reports no reads for a condition that reads none', () => {
    // An empty set, not `undefined`: "this reads nothing" is a real answer, and a
    // profile edit genuinely cannot move such a rule's own verdict.
    expect(userAttributeNamesRead('isMemberOfGroupName("Engineering")')).toEqual(new Set());
  });

  it('refuses to answer for a read whose name is not statically knowable', () => {
    // `undefined`, never a partial set. A caller reads an incomplete set as "the
    // edit cannot reach this rule", which is exactly the wrong conclusion.
    expect(userAttributeNamesRead('user[user.department] == "x"')).toBeUndefined();
    expect(userAttributeNamesRead('user[user.a] == "x" && user.b == "y"')).toBeUndefined();
  });

  it('refuses to answer for an expression it cannot parse', () => {
    expect(userAttributeNamesRead('user.department ==')).toBeUndefined();
    expect(userAttributeNamesRead('')).toBeUndefined();
  });

  it('does not mistake a quoted attribute name for a read', () => {
    // The whole reason this walks the AST rather than the text: a string literal
    // that happens to spell a read is not one.
    expect(userAttributeNamesRead('user.title == "user.department"')).toEqual(new Set(['title']));
  });
});
