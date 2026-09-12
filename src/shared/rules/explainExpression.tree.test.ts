/*
 * The nested projection of the clause explainer: `RuleExplanation.tree`.
 *
 * The flat `clauses` list and this tree are two views of ONE walk, so the
 * properties asserted here are mostly agreement properties — a leaf says what its
 * row says, a connective's verdict is the verdict the app acts on, and the root
 * can never contradict `summary.result`. The last of those is the load-bearing
 * one: a tree that disagreed with the summary above it would put two different
 * answers to the same question on one screen.
 *
 * Fixtures use obviously fake placeholders only.
 */
import { describe, it, expect } from 'vitest';
import {
  explainRuleExpression,
  ATTRIBUTE_ABSENT,
  MAX_TREE_DEPTH,
  type ClauseStatus,
  type ClauseTreeNode,
  type ConnectiveNode,
  type LeafClauseNode,
} from './explainExpression';
import type { RuleGroupContext } from '../ruleEvaluator';
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
    nullable: null,
    roles: ['admin', 'dev'],
    'cost center': 'CC-9',
  },
};

const groups: RuleGroupContext = [
  { id: '00gFAKE0000000000000', name: 'Engineering' },
  { id: '00gFAKE0000000000001', name: 'Contractors' },
];

/** Narrow to a connective, failing the test (not the type-check) when it is a leaf. */
function connective(node: ClauseTreeNode): ConnectiveNode {
  if (node.node !== 'connective') {
    throw new Error(`expected a connective, got a leaf: ${node.expressionText}`);
  }
  return node;
}

/** Narrow to a leaf, failing the test when it is a connective. */
function leaf(node: ClauseTreeNode): LeafClauseNode {
  if (node.node !== 'leaf') throw new Error(`expected a leaf, got a ${node.kind} group`);
  return node;
}

/** The child at `index`, or a failure naming what was actually there. */
function childAt(node: ClauseTreeNode, index: number): ClauseTreeNode {
  const child = connective(node).children[index];
  if (!child) throw new Error(`no child at index ${index}`);
  return child;
}

/** A node's own outcome, whichever kind it is. */
function statusOf(node: ClauseTreeNode): ClauseStatus {
  return node.node === 'leaf' ? node.status : node.verdict;
}

/** Every leaf under a node, in source order. */
function leaves(node: ClauseTreeNode): LeafClauseNode[] {
  if (node.node === 'leaf') return [node];
  return node.children.flatMap(leaves);
}

// ===========================================================================
// Shape
// ===========================================================================
describe('tree shape', () => {
  it('flattens a chain of one connective into a single n-ary node', () => {
    const { tree } = explainRuleExpression(
      'user.department == "Engineering" && user.title == "Intern" && user.city == "San Francisco"',
      user,
    );

    const root = connective(tree);
    expect(root.kind).toBe('and');
    expect(root.depth).toBe(0);
    expect(root.children.map((child) => child.node)).toEqual(['leaf', 'leaf', 'leaf']);
    expect(root.children.map((child) => leaf(child).expressionText)).toEqual([
      'user.department == "Engineering"',
      'user.title == "Intern"',
      'user.city == "San Francisco"',
    ]);
  });

  it('nests a disjunction inside a conjunction instead of flattening it', () => {
    const { tree } = explainRuleExpression(
      'user.department == "Engineering" && (user.city == "Berlin" || user.title == "Intern")',
      user,
    );

    const root = connective(tree);
    expect(root.kind).toBe('and');
    expect(root.children).toHaveLength(2);
    expect(leaf(childAt(root, 0)).expressionText).toBe('user.department == "Engineering"');

    const or = connective(childAt(root, 1));
    expect(or.kind).toBe('or');
    expect(or.depth).toBe(1);
    expect(or.children.map((child) => leaf(child).expressionText)).toEqual([
      'user.city == "Berlin"',
      'user.title == "Intern"',
    ]);
  });

  it('roots at an OR when the whole condition is a disjunction', () => {
    const { tree } = explainRuleExpression('user.city == "Berlin" || user.title == "Intern"', user);

    expect(connective(tree).kind).toBe('or');
    expect(connective(tree).children).toHaveLength(2);
  });

  it('roots at a leaf for a single-clause rule', () => {
    const { tree, clauses } = explainRuleExpression('user.department == "Engineering"', user);

    expect(leaf(tree).expressionText).toBe('user.department == "Engineering"');
    expect(leaf(tree).status).toBe('pass');
    expect(leaf(tree).expressionText).toBe(clauses[0]?.expressionText);
  });

  it('keeps a negated conjunction whole, exactly as the flat row does', () => {
    const expression = '!(user.department == "Engineering" && user.title == "Intern")';
    const { tree, clauses } = explainRuleExpression(expression, user);

    // Reporting the parts of `!(a && b)` separately would invert their meaning,
    // so the negation is one leaf in both projections.
    expect(leaf(tree).expressionText).toBe(clauses[0]?.expressionText);
    expect(leaf(tree).status).toBe(clauses[0]?.status);
    expect(clauses).toHaveLength(1);
  });

  it('roots at a leaf carrying the reason when nothing parsed', () => {
    const { tree, clauses } = explainRuleExpression('user.department ==', user);

    expect(clauses).toEqual([]);
    expect(leaf(tree)).toEqual({
      node: 'leaf',
      expressionText: '',
      resolvedValue: undefined,
      status: 'not-evaluated',
      reasonCode: 'parse-error',
      reads: [],
    });
  });
});

// ===========================================================================
// Verdicts and the structured basis for explaining them
// ===========================================================================
describe('connective verdicts', () => {
  it('passes an OR on one passing alternative, naming it, and counts the undecided one', () => {
    // Eager Kleene: `true || unresolvable` is `true`. The unreadable alternative
    // cannot change the answer, and `decidedByChildIndices` is what lets a caller
    // say so without re-deriving it.
    const { tree, summary } = explainRuleExpression(
      'user.department == "Engineering" || user.missingAttribute == "x"',
      user,
    );

    const root = connective(tree);
    expect(root.verdict).toBe('pass');
    expect(root.decidedByChildIndices).toEqual([0]);
    expect(root.undecidedChildCount).toBe(1);
    expect(statusOf(childAt(root, 1))).toBe('not-evaluated');
    expect(summary.result).toEqual({ outcome: 'match' });
  });

  it('fails an AND on one failing conjunct, naming it', () => {
    const { tree } = explainRuleExpression(
      'user.department == "Sales" && user.missingAttribute == "x"',
      user,
    );

    const root = connective(tree);
    expect(root.verdict).toBe('fail');
    expect(root.decidedByChildIndices).toEqual([0]);
    expect(root.undecidedChildCount).toBe(1);
  });

  it('names every failing conjunct, not just the first', () => {
    const { tree } = explainRuleExpression(
      'user.department == "Sales" && user.title == "Intern" && user.city == "Berlin"',
      user,
    );

    expect(connective(tree).decidedByChildIndices).toEqual([0, 2]);
  });

  it('fails an OR only when every alternative failed, and blames none of them', () => {
    const { tree } = explainRuleExpression(
      'user.department == "Sales" || user.city == "Berlin"',
      user,
    );

    const root = connective(tree);
    expect(root.verdict).toBe('fail');
    // Every child carries a failing OR; naming them all would say one of them
    // decided it.
    expect(root.decidedByChildIndices).toEqual([]);
    expect(root.undecidedChildCount).toBe(0);
  });

  it('blames no child for a passing AND either', () => {
    const { tree } = explainRuleExpression(
      'user.department == "Engineering" && user.title == "Intern"',
      user,
    );

    const root = connective(tree);
    expect(root.verdict).toBe('pass');
    expect(root.decidedByChildIndices).toEqual([]);
  });

  it('leaves an AND undecided when a conjunct could not be read and none failed', () => {
    const { tree, summary } = explainRuleExpression(
      'user.department == "Engineering" && user.missingAttribute == "x"',
      user,
    );

    const root = connective(tree);
    expect(root.verdict).toBe('not-evaluated');
    expect(root.decidedByChildIndices).toEqual([]);
    expect(root.undecidedChildCount).toBe(1);
    expect(summary.result.outcome).toBe('unevaluable');
  });

  it('reports a group-gated sibling the way the app answers it, not more confidently', () => {
    // The grammar gate rejects the whole sub-expression for want of a group list,
    // so the app's answer is "cannot tell" — the tree says the same rather than
    // claiming the passing alternative settled it.
    const { tree, summary } = explainRuleExpression(
      'user.department == "Engineering" || isMemberOfGroup("00gFAKE0000000000000")',
      user,
    );

    const root = connective(tree);
    expect(root.verdict).toBe('not-evaluated');
    expect(root.decidedByChildIndices).toEqual([]);
    expect(summary.result).toEqual({ outcome: 'unevaluable', reasonCode: 'group-membership-fn' });
  });

  it('answers that same rule once the group list is supplied', () => {
    const { tree } = explainRuleExpression(
      'user.department == "Sales" || isMemberOfGroup("00gFAKE0000000000000")',
      user,
      { groups },
    );

    const root = connective(tree);
    expect(root.verdict).toBe('pass');
    expect(root.decidedByChildIndices).toEqual([1]);
    expect(root.undecidedChildCount).toBe(0);
  });
});

// ===========================================================================
// Leaves carry the same facts as the rows
// ===========================================================================
describe('leaves and rows are the same walk', () => {
  it('gives a leaf the row facts, minus the flat alternatives list', () => {
    const { tree, clauses } = explainRuleExpression(
      'user.department == "Engineering" && (user.city == "Berlin" || user.title == "Intern")',
      user,
    );

    const root = connective(tree);
    const first = leaf(childAt(root, 0));
    expect(first).toEqual({ ...clauses[0], node: 'leaf', reads: first.reads });

    // The disjunction is a row with `alternatives` and a node with children: the
    // same verdicts, from the same evaluations.
    const or = connective(childAt(root, 1));
    expect(or.verdict).toBe(clauses[1]?.status);
    expect(or.children.map((child) => leaf(child).status)).toEqual(
      clauses[1]?.alternatives?.map((alternative) => alternative.status),
    );
  });

  it('carries the group references and polarity of a membership leaf', () => {
    const { tree } = explainRuleExpression(
      'user.department == "Engineering" && !isMemberOfAnyGroupName("Contractors")',
      user,
      { groups },
    );

    const membership = leaf(childAt(connective(tree), 1));
    expect(membership.groupRequirement).toBe('non-member');
    expect(membership.groupReferences).toEqual([
      {
        match: 'name',
        value: 'Contractors',
        satisfied: true,
        matchedGroupName: 'Contractors',
      },
    ]);
    expect(membership.status).toBe('fail');
  });
});

// ===========================================================================
// Attribute reads
// ===========================================================================
describe('attribute reads', () => {
  it('records the path and value of each attribute a leaf compares', () => {
    const { tree } = explainRuleExpression('user.department == user.title', user);

    expect(leaf(tree).reads).toEqual([
      { path: 'user.department', value: 'Engineering' },
      { path: 'user.title', value: 'Intern' },
    ]);
  });

  it('distinguishes an absent attribute from one that is present and null', () => {
    const { tree } = explainRuleExpression(
      'user.missingAttribute == "x" && user.nullable == "x"',
      user,
    );

    const [absent, nullable] = connective(tree).children.map((child) => leaf(child).reads);
    expect(absent).toEqual([{ path: 'user.missingAttribute', value: ATTRIBUTE_ABSENT }]);
    expect(nullable).toEqual([{ path: 'user.nullable', value: null }]);
    // Absent is not null, and neither is zero or the empty string.
    expect(ATTRIBUTE_ABSENT).not.toBe(null);
    expect(typeof ATTRIBUTE_ABSENT).toBe('symbol');
  });

  it('records a multi-valued attribute as the array it is', () => {
    const { tree } = explainRuleExpression('Arrays.contains(user.roles, "admin")', user);

    expect(leaf(tree).reads).toEqual([{ path: 'user.roles', value: ['admin', 'dev'] }]);
  });

  it('renders a computed key as user["…"] and deduplicates by path', () => {
    const { tree } = explainRuleExpression(`user["cost center"] == user['cost center']`, user);

    // One read: the quoting the tenant chose is normalised away, so the two
    // references are recognised as the same attribute.
    expect(leaf(tree).reads).toEqual([{ path: 'user["cost center"]', value: 'CC-9' }]);
  });

  it('finds reads nested inside calls and negations', () => {
    const { tree } = explainRuleExpression(
      '!String.startsWith(String.toUpperCase(user.department), "ENG")',
      user,
    );

    expect(leaf(tree).reads).toEqual([{ path: 'user.department', value: 'Engineering' }]);
  });

  it('records the inner read of a key it cannot name, and not the outer access', () => {
    const { tree } = explainRuleExpression('user[user.department] == "Engineering"', user);

    // `user[user.department]` has no nameable path, so it is not claimed as a
    // read — but the attribute that computed the key genuinely was read.
    expect(leaf(tree).reads).toEqual([{ path: 'user.department', value: 'Engineering' }]);
    expect(leaf(tree).status).toBe('not-evaluated');
  });

  it('records nothing for a clause that reads no attribute', () => {
    const { tree } = explainRuleExpression('isMemberOfGroupName("Engineering")', user, { groups });

    expect(leaf(tree).reads).toEqual([]);
  });

  it('collects every read under a leaf, in source order', () => {
    const { tree } = explainRuleExpression(
      'String.stringContains(String.join("-", user.department, user.city), user.title)',
      user,
    );

    expect(leaf(tree).reads.map((read) => read.path)).toEqual([
      'user.department',
      'user.city',
      'user.title',
    ]);
  });
});

// ===========================================================================
// Bounds
// ===========================================================================
describe('bounded depth', () => {
  const LEAF = 'user.department == "Engineering"';

  /** `levels` nested connectives, alternating `&&` and `||` so nothing flattens. */
  function nested(levels: number): string {
    if (levels === 0) return LEAF;
    return `${LEAF} ${levels % 2 === 0 ? '&&' : '||'} (${nested(levels - 1)})`;
  }

  it('collapses a subtree past the depth cap into one leaf and says so on its parent', () => {
    const { tree, summary } = explainRuleExpression(nested(10), user, { maxClauses: 256 });

    // Walk down the right-hand spine: connectives at depths 0…MAX-1, then a leaf.
    let node: ClauseTreeNode = tree;
    for (let depth = 0; depth < MAX_TREE_DEPTH; depth += 1) {
      const group = connective(node);
      expect(group.depth).toBe(depth);
      // Only the last surviving group lost anything.
      expect(group.truncated).toBe(depth === MAX_TREE_DEPTH - 1 ? true : undefined);
      node = childAt(group, 1);
    }

    const collapsed = leaf(node);
    // No verdict was lost — only the structure below it.
    expect(collapsed.expressionText).toContain('||');
    expect(collapsed.status).toBe('pass');
    expect(summary.truncated).toBe(true);
    expect(statusOf(tree)).toBe('pass');
    expect(summary.result).toEqual({ outcome: 'match' });
  });

  it('keeps a tree exactly at the cap whole', () => {
    const { tree, summary } = explainRuleExpression(nested(MAX_TREE_DEPTH - 1), user, {
      maxClauses: 256,
    });

    let node: ClauseTreeNode = tree;
    for (let depth = 0; depth < MAX_TREE_DEPTH - 1; depth += 1) {
      expect(connective(node).depth).toBe(depth);
      node = childAt(node, 1);
    }
    expect(leaf(node).expressionText).toBe(LEAF);
    expect(summary.truncated).toBe(false);
  });

  it('drops leaves past maxClauses, marks every ancestor that lost one, and still answers', () => {
    // The dropped conjunct is the one that decides the rule: `headcount == 99`
    // is false, so the verdict must be `fail` even though its leaf is not in the
    // tree.
    const { tree, summary } = explainRuleExpression(
      'user.department == "Engineering" && (user.city == "Berlin" || user.title == "Intern") && user.headcount == 99',
      user,
      { maxClauses: 2 },
    );

    const root = connective(tree);
    expect(leaves(tree)).toHaveLength(2);
    // The third leaf and the top-level `user.headcount` conjunct are gone.
    expect(root.truncated).toBe(true);
    expect(connective(childAt(root, 1)).truncated).toBe(true);
    expect(connective(childAt(root, 1)).children).toHaveLength(1);
    expect(summary.truncated).toBe(true);

    // The verdict is computed over the WHOLE expression, not the leaves kept.
    expect(root.verdict).toBe('fail');
    expect(root.decidedByChildIndices).toEqual([]);
    expect(summary.result).toEqual({ outcome: 'no-match' });
  });
});

// ===========================================================================
// The invariant that keeps one screen from holding two answers
// ===========================================================================
describe('the root verdict always agrees with summary.result', () => {
  const expressions = [
    '',
    '   ',
    'user.department ==',
    'user.department == "Engineering"',
    'user.department == "Sales"',
    'user.department == "Engineering" && user.title == "Intern"',
    'user.department == "Engineering" && user.title == "Manager"',
    'user.department == "Sales" || user.city == "Berlin"',
    'user.department == "Sales" || user.city == "San Francisco"',
    'user.department == "Engineering" || user.missingAttribute == "x"',
    'user.department == "Engineering" && user.missingAttribute == "x"',
    'user.missingAttribute == "x"',
    'user.nullable == "x"',
    '!(user.department == "Engineering" && user.title == "Intern")',
    '!(user.department == "Engineering" || user.title == "Manager")',
    'user.department == "Engineering" && (user.city == "Berlin" || user.title == "Intern")',
    '(user.department == "Engineering" || user.city == "Berlin") && user.title == "Manager"',
    'user.headcount > 40 && user.headcount < 50',
    'user.headcount > "40"',
    'user.department',
    '"Engineering"',
    'String.startsWith(user.department, "Eng")',
    'String.stringSwitch(user.department, "none", "Engineering", "eng") == "eng"',
    'user.department == "Engineering" ? user.title == "Intern" : user.city == "Berlin"',
    'user["cost center"] == "CC-9"',
    'user[user.department] == "Engineering"',
    'Arrays.contains(user.roles, "admin")',
    'user.headcount == -42',
    'session.amr == "pwd"',
    'unknownFunction(user.department) == "x"',
    'isMemberOfGroup("00gFAKE0000000000000")',
    'isMemberOfGroupName("Engineering") && user.department == "Engineering"',
    'isMemberOfGroupName("Nowhere") || user.department == "Sales"',
    '!isMemberOfAnyGroupName("Contractors")',
    'isMemberOfGroupNameRegex("Eng.*") && user.title == "Intern"',
    'isMemberOfGroupNameStartsWith("Eng") || isMemberOfGroupNameContains("tractor")',
    'user.department == "Engineering" && user.title == "Intern" && user.city == "San Francisco"',
  ];

  const byOutcome: Record<string, ClauseStatus> = {
    match: 'pass',
    'no-match': 'fail',
    unevaluable: 'not-evaluated',
  };

  for (const withGroups of [false, true]) {
    for (const expression of expressions) {
      it(`agrees for ${JSON.stringify(expression)}${withGroups ? ' with groups' : ''}`, () => {
        const { tree, summary } = explainRuleExpression(
          expression,
          user,
          withGroups ? { groups } : undefined,
        );

        expect(statusOf(tree)).toBe(byOutcome[summary.result.outcome]);
      });
    }
  }

  it('agrees when the cap has truncated the tree', () => {
    for (const maxClauses of [1, 2, 3]) {
      const { tree, summary } = explainRuleExpression(
        'user.department == "Engineering" && (user.city == "Berlin" || user.title == "Intern") && user.headcount == 42',
        user,
        { maxClauses },
      );

      expect(statusOf(tree)).toBe(byOutcome[summary.result.outcome]);
      expect(summary.truncated).toBe(true);
    }
  });
});
