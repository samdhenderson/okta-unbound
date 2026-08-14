/*
 * Outcome-parity table for `ruleEvaluator`.
 *
 * This file is a *characterization* suite: it pins the observable outcome of
 * `tryEvaluateRuleExpression` and of the grammar gate for a broad matrix of
 * expressions, without asserting anything about how those outcomes are reached.
 *
 * Why it exists: the shared-AST refactor — parse each expression ONCE and share
 * the tree between the grammar gate and the evaluation walk, behind a bounded
 * parse memo — had to prove it changed no outcome. It has since landed, and the
 * table now guards the result: `tryEvaluateRuleExpression` is the API membership
 * attribution depends on, so a red row here is a semantic regression in the one
 * place a wrong answer becomes a wrong access decision.
 *
 * Table 2 reached the gate through `canEvaluateClientSide` until ADR-0025 retired
 * that wrapper; it now goes through `parseRuleExpression` + `checkRuleNodeSupport`,
 * which is the same walk over the same memoised parse.
 *
 * It deliberately overlaps `ruleEvaluator.test.ts` in places: that file documents
 * intent case-by-case, this one is an exhaustive table.
 */
import { describe, it, expect } from 'vitest';
import {
  checkRuleNodeSupport,
  parseRuleExpression,
  tryEvaluateRuleExpression,
  GROUP_MEMBERSHIP_FUNCTIONS,
  SUPPORTED_FUNCTIONS,
  type RuleMatchOutcome,
} from './ruleEvaluator';
import type { OktaUser } from './types';

/**
 * The whole-expression grammar gate, rebuilt from the two live entry points that
 * replaced the retired `canEvaluateClientSide` wrapper (ADR-0025).
 *
 * `checkRuleNodeSupport(ast, {})` runs the identical allow-list walk on the
 * identical memoised parse, so every row of table 2 keeps its meaning.
 */
const gateAccepts = (expression: string): boolean => {
  const parsed = parseRuleExpression(expression);
  return parsed.ok && checkRuleNodeSupport(parsed.ast).supported;
};

// ---------------------------------------------------------------------------
// Fixture — obviously fake placeholders only.
// ---------------------------------------------------------------------------

/**
 * One user, used by every row of the outcome table. Attribute types are chosen so
 * the table can exercise a string, a number, a boolean, an array (stringified) and
 * an absent attribute without swapping fixtures between rows.
 */
const user: OktaUser = {
  id: '00uFAKE0000000000000',
  status: 'ACTIVE',
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Developer',
    city: 'San Francisco',
    // Custom attributes (the `[key: string]: any` extension point) carry the
    // non-string types; the declared profile fields are all `string`.
    headcount: 42,
    isContractor: true,
    roles: ['admin', 'dev'],
  },
};

/**
 * `MAX_EXPRESSION_LENGTH` is module-private, so the boundary rows re-state it.
 * Keep in sync with `ruleEvaluator.ts`.
 */
const MAX_EXPRESSION_LENGTH = 4096;

/** A grammatical, gate-passing expression padded to exactly `totalLength` chars. */
function paddedExpression(totalLength: number): string {
  const prefix = 'user.department == "';
  const pad = 'x'.repeat(totalLength - prefix.length - 1);
  return `${prefix}${pad}"`;
}

/**
 * A sub-expression that PASSES the gate but resolves to UNRESOLVED at evaluation
 * time: `>` is allow-listed, but `evaluateRelational` gives up unless both
 * operands are numbers. This is the only way to observe three-valued propagation
 * through the gated API — a group-membership call would be rejected by the gate
 * before the Kleene logic ever runs.
 */
const UNRESOLVED_CLAUSE = 'user.department > "A"';

interface OutcomeCase {
  name: string;
  expression: string;
  expected: RuleMatchOutcome;
}

interface GateCase {
  name: string;
  expression: string;
  expected: boolean;
}

// ---------------------------------------------------------------------------
// Table 1 — tryEvaluateRuleExpression(expression, user)
// ---------------------------------------------------------------------------

const OUTCOME_CASES: readonly OutcomeCase[] = [
  // --- user.<attr> reads, one row per resolved value type ------------------
  {
    name: 'string attribute, equal',
    expression: 'user.department == "Engineering"',
    expected: 'match',
  },
  {
    name: 'string attribute, unequal',
    expression: 'user.department == "Sales"',
    expected: 'no-match',
  },
  {
    name: 'string attribute with spaces',
    expression: 'user.city == "San Francisco"',
    expected: 'match',
  },
  { name: 'number attribute, equal', expression: 'user.headcount == 42', expected: 'match' },
  {
    name: 'number attribute vs string literal is strict (no coercion)',
    expression: 'user.headcount == "42"',
    expected: 'no-match',
  },
  { name: 'boolean attribute, equal', expression: 'user.isContractor == true', expected: 'match' },
  {
    name: 'boolean attribute, negated',
    expression: '!user.isContractor',
    expected: 'no-match',
  },
  {
    name: 'missing attribute reads as null',
    expression: 'user.division == null',
    expected: 'match',
  },
  {
    name: 'missing attribute is not equal to a string',
    expression: 'user.division == "Platform"',
    expected: 'no-match',
  },
  {
    name: 'non-scalar attribute is stringified rather than refused',
    expression: 'user.roles == "admin,dev"',
    expected: 'match',
  },

  // --- symbolic operators ---------------------------------------------------
  { name: '== satisfied', expression: 'user.title == "Developer"', expected: 'match' },
  { name: '=== satisfied', expression: 'user.title === "Developer"', expected: 'match' },
  { name: '!= satisfied', expression: 'user.title != "Manager"', expected: 'match' },
  { name: '!== unsatisfied', expression: 'user.title !== "Developer"', expected: 'no-match' },
  { name: '< on numbers', expression: 'user.headcount < 100', expected: 'match' },
  { name: '> on numbers', expression: 'user.headcount > 100', expected: 'no-match' },
  { name: '<= on numbers (boundary)', expression: 'user.headcount <= 42', expected: 'match' },
  { name: '>= on numbers (boundary)', expression: 'user.headcount >= 43', expected: 'no-match' },
  {
    name: '&& with both conjuncts satisfied',
    expression: 'user.department == "Engineering" && user.title == "Developer"',
    expected: 'match',
  },
  {
    name: '|| with one disjunct satisfied',
    expression: 'user.department == "Sales" || user.title == "Developer"',
    expected: 'match',
  },
  {
    name: 'parentheses group as written',
    expression:
      '(user.department == "Sales" || user.department == "Engineering") && user.city == "San Francisco"',
    expected: 'match',
  },
  {
    name: '! applied to a parenthesised comparison',
    expression: '!(user.department == "Sales")',
    expected: 'match',
  },
  {
    name: '! coerces a non-boolean attribute to a boolean outcome',
    expression: '!user.department',
    expected: 'no-match',
  },

  // --- Okta word-form operators --------------------------------------------
  {
    name: 'word form: eq satisfied',
    expression: 'user.department eq "Engineering"',
    expected: 'match',
  },
  {
    name: 'word form: eq unsatisfied',
    expression: 'user.department eq "Sales"',
    expected: 'no-match',
  },
  { name: 'word form: ne satisfied', expression: 'user.department ne "Sales"', expected: 'match' },
  {
    name: 'word form: ne unsatisfied',
    expression: 'user.department ne "Engineering"',
    expected: 'no-match',
  },
  {
    name: 'word form: lowercase and',
    expression: 'user.department eq "Engineering" and user.city eq "San Francisco"',
    expected: 'match',
  },
  {
    name: 'word form: uppercase AND',
    expression: 'user.department eq "Engineering" AND user.city eq "Berlin"',
    expected: 'no-match',
  },
  {
    name: 'word form: lowercase or',
    expression: 'user.department eq "Sales" or user.city eq "San Francisco"',
    expected: 'match',
  },
  {
    name: 'word form: uppercase OR',
    expression: 'user.department eq "Sales" OR user.city eq "Berlin"',
    expected: 'no-match',
  },
  {
    name: 'word-form operators do not swallow attributes that start with them',
    // jsep's identifier boundary check keeps `andy`/`orbit` whole.
    expression: 'user.andy == null and user.orbit == null',
    expected: 'match',
  },

  // --- three-valued (Kleene) propagation ------------------------------------
  {
    name: 'Kleene: unresolved || true → match',
    expression: `${UNRESOLVED_CLAUSE} || user.department == "Engineering"`,
    expected: 'match',
  },
  {
    name: 'Kleene: true || unresolved → match (operand order does not matter)',
    expression: `user.department == "Engineering" || ${UNRESOLVED_CLAUSE}`,
    expected: 'match',
  },
  {
    name: 'Kleene: unresolved && false → no-match',
    expression: `${UNRESOLVED_CLAUSE} && user.department == "Sales"`,
    expected: 'no-match',
  },
  {
    name: 'Kleene: false && unresolved → no-match (operand order does not matter)',
    expression: `user.department == "Sales" && ${UNRESOLVED_CLAUSE}`,
    expected: 'no-match',
  },
  {
    name: 'Kleene: unresolved && true → unevaluable',
    expression: `${UNRESOLVED_CLAUSE} && user.department == "Engineering"`,
    expected: 'unevaluable',
  },
  {
    name: 'Kleene: unresolved || false → unevaluable',
    expression: `${UNRESOLVED_CLAUSE} || user.department == "Sales"`,
    expected: 'unevaluable',
  },
  {
    name: 'Kleene: !unresolved → unevaluable',
    expression: `!(${UNRESOLVED_CLAUSE})`,
    expected: 'unevaluable',
  },
  {
    name: 'Kleene: relational on strings is unresolved, not false',
    expression: UNRESOLVED_CLAUSE,
    expected: 'unevaluable',
  },
  {
    name: 'Kleene: an unresolved argument poisons an allow-listed call',
    // Gate-passing (arity + node types are fine); `asString` gives up on a number.
    expression: 'String.startsWith(user.headcount, "4")',
    expected: 'unevaluable',
  },

  // --- SUPPORTED_FUNCTIONS: one matching + one non-matching row each ---------
  {
    name: 'String.toUpperCase matching',
    expression: 'String.toUpperCase(user.department) == "ENGINEERING"',
    expected: 'match',
  },
  {
    name: 'String.toUpperCase non-matching',
    expression: 'String.toUpperCase(user.department) == "Engineering"',
    expected: 'no-match',
  },
  {
    name: 'String.toLowerCase matching',
    expression: 'String.toLowerCase(user.department) == "engineering"',
    expected: 'match',
  },
  {
    name: 'String.toLowerCase non-matching',
    expression: 'String.toLowerCase(user.department) == "ENGINEERING"',
    expected: 'no-match',
  },
  { name: 'String.len matching', expression: 'String.len(user.firstName) == 3', expected: 'match' },
  {
    name: 'String.len non-matching',
    expression: 'String.len(user.firstName) == 4',
    expected: 'no-match',
  },
  {
    name: 'String.stringContains matching',
    expression: 'String.stringContains(user.email, "@example.com")',
    expected: 'match',
  },
  {
    name: 'String.stringContains non-matching',
    expression: 'String.stringContains(user.email, "@other.example")',
    expected: 'no-match',
  },
  {
    name: 'String.startsWith matching',
    expression: 'String.startsWith(user.firstName, "Ad")',
    expected: 'match',
  },
  {
    name: 'String.startsWith non-matching (case-sensitive)',
    expression: 'String.startsWith(user.firstName, "ad")',
    expected: 'no-match',
  },
  {
    name: 'String.endsWith matching',
    expression: 'String.endsWith(user.email, "example.com")',
    expected: 'match',
  },
  {
    name: 'String.endsWith non-matching',
    expression: 'String.endsWith(user.email, "@other.example")',
    expected: 'no-match',
  },
  {
    name: 'String.append matching',
    expression: 'String.append(user.firstName, " Lovelace") == "Ada Lovelace"',
    expected: 'match',
  },
  {
    name: 'String.append non-matching',
    expression: 'String.append(user.firstName, " Lovelace") == "Ada"',
    expected: 'no-match',
  },

  // --- rejection reason: too-long -------------------------------------------
  {
    name: 'reason too-long: one character over MAX_EXPRESSION_LENGTH',
    expression: paddedExpression(MAX_EXPRESSION_LENGTH + 1),
    expected: 'unevaluable',
  },
  {
    name: 'reason too-long: exactly MAX_EXPRESSION_LENGTH still parses',
    expression: paddedExpression(MAX_EXPRESSION_LENGTH),
    expected: 'no-match',
  },

  // --- rejection reason: parse-error ----------------------------------------
  {
    name: 'reason parse-error: dangling operator',
    expression: 'user.department ==',
    expected: 'unevaluable',
  },
  {
    name: 'reason parse-error: unbalanced parenthesis',
    expression: '(user.department == "Engineering"',
    expected: 'unevaluable',
  },
  {
    name: 'reason parse-error: a regex literal never reaches the walk (jsep has no regex in core)',
    expression: 'user.email == /example/',
    expected: 'unevaluable',
  },
  { name: 'reason parse-error: empty string', expression: '', expected: 'unevaluable' },
  { name: 'reason parse-error: whitespace only', expression: '   ', expected: 'unevaluable' },

  // --- rejection reason: unsupported-operator -------------------------------
  {
    name: 'reason unsupported-operator: modulo',
    expression: 'user.headcount % 2 == 0',
    expected: 'unevaluable',
  },
  {
    name: 'reason unsupported-operator: string concatenation',
    expression: 'user.department + "x" == "Engineeringx"',
    expected: 'unevaluable',
  },
  {
    name: 'reason unsupported-operator: unary minus is not "!"',
    expression: '-user.headcount == -42',
    expected: 'unevaluable',
  },

  // --- rejection reason: group-membership-fn --------------------------------
  {
    name: 'reason group-membership-fn: isMemberOfGroup',
    expression: 'isMemberOfGroup("00gFAKE0000000000000")',
    expected: 'unevaluable',
  },
  {
    name: 'reason group-membership-fn: isMemberOfGroupName',
    expression: 'isMemberOfGroupName("Engineering")',
    expected: 'unevaluable',
  },
  {
    name: 'reason group-membership-fn: isMemberOfAnyGroup',
    expression: 'isMemberOfAnyGroup("00gFAKE0000000000000", "00gFAKE1111111111111")',
    expected: 'unevaluable',
  },
  {
    name: 'reason group-membership-fn: isMemberOfAnyGroupName',
    expression: 'isMemberOfAnyGroupName("Engineering", "Sales")',
    expected: 'unevaluable',
  },
  {
    name: 'reason group-membership-fn: isMemberOfGroupNameStartsWith',
    expression: 'isMemberOfGroupNameStartsWith("Eng")',
    expected: 'unevaluable',
  },
  {
    name: 'reason group-membership-fn: isMemberOfGroupNameContains',
    expression: 'isMemberOfGroupNameContains("ngin")',
    expected: 'unevaluable',
  },
  {
    name: 'reason group-membership-fn: isMemberOfGroupNameRegex',
    expression: 'isMemberOfGroupNameRegex("^Eng")',
    expected: 'unevaluable',
  },
  {
    name: 'a group-membership call poisons the whole expression, even beside a satisfied clause',
    expression: 'isMemberOfGroup("00gFAKE0000000000000") || user.department == "Engineering"',
    expected: 'unevaluable',
  },
  {
    name: 'a group-membership call poisons the whole expression, even beside an unsatisfied clause',
    expression: 'isMemberOfGroup("00gFAKE0000000000000") && user.department == "Sales"',
    expected: 'unevaluable',
  },

  // --- rejection reason: unknown-fn -----------------------------------------
  {
    name: 'reason unknown-fn: String function outside the allow-list',
    expression: 'String.substring(user.email, 0, 3) == "use"',
    expected: 'unevaluable',
  },
  {
    name: 'reason unknown-fn: Arrays namespace is deliberately absent',
    expression: 'Arrays.contains(user.roles, "admin")',
    expected: 'unevaluable',
  },
  {
    name: 'reason unknown-fn: bare unknown identifier callee',
    expression: 'now() == "x"',
    expected: 'unevaluable',
  },
  {
    name: 'reason unknown-fn: callee shape that has no fully-qualified name',
    expression: 'user.a.b("x") == 1',
    expected: 'unevaluable',
  },

  // --- rejection reason: fn-arity -------------------------------------------
  {
    name: 'reason fn-arity: too few arguments',
    expression: 'String.startsWith(user.firstName)',
    expected: 'unevaluable',
  },
  {
    name: 'reason fn-arity: too many arguments',
    expression: 'String.len(user.firstName, "extra") == 3',
    expected: 'unevaluable',
  },

  // --- rejection reason: unsupported node / reference ------------------------
  {
    name: 'unsupported reference: app context',
    expression: 'app.id == "0oaFAKE"',
    expected: 'unevaluable',
  },
  {
    name: 'unsupported reference: session context',
    expression: 'session.amr == "pwd"',
    expected: 'unevaluable',
  },
  {
    name: 'unsupported reference: computed member access',
    expression: 'user["department"] == "Engineering"',
    expected: 'unevaluable',
  },
  {
    name: 'unsupported reference: nested member access',
    expression: 'user.profile.department == "Engineering"',
    expected: 'unevaluable',
  },
  {
    name: 'reason unsupported-node: bare identifier',
    expression: 'department == "Engineering"',
    expected: 'unevaluable',
  },
  {
    name: 'reason unsupported-node: this expression',
    expression: 'this.department == "Engineering"',
    expected: 'unevaluable',
  },
  {
    name: 'reason unsupported-node: array literal',
    expression: 'user.department == ["Engineering"]',
    expected: 'unevaluable',
  },
  {
    name: 'reason unsupported-node: conditional expression',
    expression: 'user.isContractor ? true : false',
    expected: 'unevaluable',
  },
  {
    name: 'reason unsupported-node: compound (two expressions, no operator)',
    expression: 'user.department == "Engineering" user.city == "San Francisco"',
    expected: 'unevaluable',
  },
  {
    name: 'no code execution: a prototype-walking expression is merely unevaluable',
    expression: 'user.constructor.constructor("return 1")()',
    expected: 'unevaluable',
  },

  // --- gate-passing expressions that still do not reduce to a boolean --------
  {
    name: 'does not reduce to a boolean: bare attribute read',
    expression: 'user.department',
    expected: 'unevaluable',
  },
  {
    name: 'does not reduce to a boolean: bare string literal',
    expression: '"Engineering"',
    expected: 'unevaluable',
  },
  {
    name: 'does not reduce to a boolean: allow-listed call returning a string',
    expression: 'String.toUpperCase(user.department)',
    expected: 'unevaluable',
  },
  {
    name: 'does not reduce to a boolean: allow-listed call returning a number',
    expression: 'String.len(user.firstName)',
    expected: 'unevaluable',
  },
  {
    name: 'a bare boolean literal DOES reduce to a boolean',
    expression: 'true',
    expected: 'match',
  },
  {
    name: 'a bare false literal reduces to no-match',
    expression: 'false',
    expected: 'no-match',
  },
];

describe('ruleEvaluator parity — tryEvaluateRuleExpression outcome table', () => {
  it.each(OUTCOME_CASES)('$name', ({ expression, expected }) => {
    expect(tryEvaluateRuleExpression(expression, user)).toBe(expected);
  });

  it('never answers no-match for an expression the gate rejects', () => {
    const gateRejected = OUTCOME_CASES.filter((c) => !gateAccepts(c.expression));
    expect(gateRejected.length).toBeGreaterThan(0);
    for (const { name, expression } of gateRejected) {
      expect(tryEvaluateRuleExpression(expression, user), name).toBe('unevaluable');
    }
  });

  it('only ever answers match/no-match for expressions the gate accepts', () => {
    for (const { name, expression, expected } of OUTCOME_CASES) {
      if (expected === 'unevaluable') continue;
      expect(gateAccepts(expression), name).toBe(true);
    }
  });

  it('covers every SUPPORTED_FUNCTIONS entry with a match and a no-match row', () => {
    for (const fnName of SUPPORTED_FUNCTIONS.keys()) {
      const rows = OUTCOME_CASES.filter((c) => c.expression.includes(`${fnName}(`));
      expect(
        rows.some((c) => c.expected === 'match'),
        fnName,
      ).toBe(true);
      expect(
        rows.some((c) => c.expected === 'no-match'),
        fnName,
      ).toBe(true);
    }
  });

  it('covers every GROUP_MEMBERSHIP_FUNCTIONS entry', () => {
    for (const fnName of GROUP_MEMBERSHIP_FUNCTIONS) {
      expect(
        OUTCOME_CASES.some((c) => c.expression.includes(`${fnName}(`)),
        fnName,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Table 2 — gateAccepts(expression)
// ---------------------------------------------------------------------------

const GATE_CASES: readonly GateCase[] = [
  // --- accepted -------------------------------------------------------------
  {
    name: 'accepts a simple equality',
    expression: 'user.department == "Engineering"',
    expected: true,
  },
  { name: 'accepts ===', expression: 'user.department === "Engineering"', expected: true },
  { name: 'accepts !=', expression: 'user.department != "Sales"', expected: true },
  { name: 'accepts !==', expression: 'user.department !== "Sales"', expected: true },
  {
    name: 'accepts the eq word form',
    expression: 'user.department eq "Engineering"',
    expected: true,
  },
  { name: 'accepts the ne word form', expression: 'user.department ne "Sales"', expected: true },
  {
    name: 'accepts the and word form',
    expression: 'user.a eq "x" and user.b eq "y"',
    expected: true,
  },
  {
    name: 'accepts the AND word form',
    expression: 'user.a eq "x" AND user.b eq "y"',
    expected: true,
  },
  {
    name: 'accepts the or word form',
    expression: 'user.a eq "x" or user.b ne "y"',
    expected: true,
  },
  {
    name: 'accepts the OR word form',
    expression: 'user.a eq "x" OR user.b ne "y"',
    expected: true,
  },
  { name: 'accepts &&', expression: 'user.a == "x" && user.b == "y"', expected: true },
  { name: 'accepts ||', expression: 'user.a == "x" || user.b == "y"', expected: true },
  {
    name: 'accepts numeric ordering operators',
    expression: 'user.headcount >= 10',
    expected: true,
  },
  {
    name: 'accepts numeric ordering on non-numbers (the gate does not type-check)',
    expression: UNRESOLVED_CLAUSE,
    expected: true,
  },
  { name: 'accepts a "!" negation', expression: '!(user.department == "Sales")', expected: true },
  {
    name: 'accepts parentheses',
    expression: '(user.a == "x" || user.b == "y") && user.c == "z"',
    expected: true,
  },
  { name: 'accepts a null literal', expression: 'user.division == null', expected: true },
  { name: 'accepts a boolean literal', expression: 'user.isContractor == true', expected: true },
  { name: 'accepts a numeric literal', expression: 'user.headcount == 42', expected: true },
  {
    name: 'accepts String.toUpperCase',
    expression: 'String.toUpperCase(user.a) == "X"',
    expected: true,
  },
  {
    name: 'accepts String.toLowerCase',
    expression: 'String.toLowerCase(user.a) == "x"',
    expected: true,
  },
  { name: 'accepts String.len', expression: 'String.len(user.a) == 3', expected: true },
  {
    name: 'accepts String.stringContains',
    expression: 'String.stringContains(user.email, "@example.com")',
    expected: true,
  },
  {
    name: 'accepts String.startsWith',
    expression: 'String.startsWith(user.a, "x")',
    expected: true,
  },
  { name: 'accepts String.endsWith', expression: 'String.endsWith(user.a, "x")', expected: true },
  {
    name: 'accepts String.append',
    expression: 'String.append(user.a, "x") == "yx"',
    expected: true,
  },
  {
    name: 'accepts an expression at exactly MAX_EXPRESSION_LENGTH',
    expression: paddedExpression(MAX_EXPRESSION_LENGTH),
    expected: true,
  },
  // The gate answers "is every node allow-listed", NOT "does this decide to a
  // boolean" — these three are accepted here yet still `unevaluable` above.
  {
    name: 'accepts a bare attribute read (gate is not a boolean check)',
    expression: 'user.department',
    expected: true,
  },
  {
    name: 'accepts a bare string literal (gate is not a boolean check)',
    expression: '"Engineering"',
    expected: true,
  },
  {
    name: 'accepts a string-returning call (gate is not a boolean check)',
    expression: 'String.toUpperCase(user.department)',
    expected: true,
  },

  // --- rejected -------------------------------------------------------------
  { name: 'rejects an empty expression', expression: '', expected: false },
  { name: 'rejects a whitespace-only expression', expression: '   ', expected: false },
  {
    name: 'rejects an expression one character over MAX_EXPRESSION_LENGTH',
    expression: paddedExpression(MAX_EXPRESSION_LENGTH + 1),
    expected: false,
  },
  { name: 'rejects a dangling operator', expression: 'user.department ==', expected: false },
  {
    name: 'rejects an unbalanced parenthesis',
    expression: '(user.department == "x"',
    expected: false,
  },
  {
    name: 'rejects a regex literal (unparseable in jsep core)',
    expression: 'user.email == /example/',
    expected: false,
  },
  { name: 'rejects modulo', expression: 'user.headcount % 2 == 0', expected: false },
  {
    name: 'rejects string concatenation',
    expression: 'user.department + "x" == "y"',
    expected: false,
  },
  { name: 'rejects a unary minus', expression: '-user.headcount == -42', expected: false },
  {
    name: 'rejects isMemberOfGroup',
    expression: 'isMemberOfGroup("00gFAKE0000000000000")',
    expected: false,
  },
  {
    name: 'rejects isMemberOfGroupName',
    expression: 'isMemberOfGroupName("Engineering")',
    expected: false,
  },
  {
    name: 'rejects isMemberOfAnyGroup',
    expression: 'isMemberOfAnyGroup("00gFAKE0000000000000", "00gFAKE1111111111111")',
    expected: false,
  },
  {
    name: 'rejects isMemberOfAnyGroupName',
    expression: 'isMemberOfAnyGroupName("Engineering", "Sales")',
    expected: false,
  },
  {
    name: 'rejects isMemberOfGroupNameStartsWith',
    expression: 'isMemberOfGroupNameStartsWith("Eng")',
    expected: false,
  },
  {
    name: 'rejects isMemberOfGroupNameContains',
    expression: 'isMemberOfGroupNameContains("ngin")',
    expected: false,
  },
  {
    name: 'rejects isMemberOfGroupNameRegex',
    expression: 'isMemberOfGroupNameRegex("^Eng")',
    expected: false,
  },
  {
    name: 'rejects a whole expression containing one group-membership call',
    expression: 'isMemberOfGroup("00gFAKE0000000000000") || user.department == "Engineering"',
    expected: false,
  },
  {
    name: 'rejects an unknown String function',
    expression: 'String.substring(user.email, 0, 3) == "use"',
    expected: false,
  },
  {
    name: 'rejects the Arrays namespace',
    expression: 'Arrays.contains(user.roles, "admin")',
    expected: false,
  },
  { name: 'rejects a bare unknown callee', expression: 'now() == "x"', expected: false },
  {
    name: 'rejects a callee with no fully-qualified name',
    expression: 'user.a.b("x") == 1',
    expected: false,
  },
  {
    name: 'rejects too few arguments',
    expression: 'String.startsWith(user.firstName)',
    expected: false,
  },
  {
    name: 'rejects too many arguments',
    expression: 'String.len(user.firstName, "extra") == 3',
    expected: false,
  },
  { name: 'rejects app context', expression: 'app.id == "0oaFAKE"', expected: false },
  { name: 'rejects session context', expression: 'session.amr == "pwd"', expected: false },
  {
    name: 'rejects computed member access',
    expression: 'user["department"] == "Engineering"',
    expected: false,
  },
  {
    name: 'rejects nested member access',
    expression: 'user.profile.department == "x"',
    expected: false,
  },
  { name: 'rejects a bare identifier', expression: 'department == "Engineering"', expected: false },
  {
    name: 'rejects a this expression',
    expression: 'this.department == "Engineering"',
    expected: false,
  },
  {
    name: 'rejects an array literal',
    expression: 'user.department == ["Engineering"]',
    expected: false,
  },
  {
    name: 'rejects a conditional expression',
    expression: 'user.isContractor ? true : false',
    expected: false,
  },
  {
    name: 'rejects a compound (two expressions, no operator)',
    expression: 'user.a == "x" user.b == "y"',
    expected: false,
  },
  {
    name: 'rejects a prototype-walking expression',
    expression: 'user.constructor.constructor("return 1")()',
    expected: false,
  },
];

describe('ruleEvaluator parity — grammar gate table', () => {
  it.each(GATE_CASES)('$name', ({ expression, expected }) => {
    expect(gateAccepts(expression)).toBe(expected);
  });

  it('is a pure predicate: repeated calls agree (parse memoisation must not drift)', () => {
    for (const { name, expression, expected } of GATE_CASES) {
      expect(gateAccepts(expression), name).toBe(expected);
      expect(gateAccepts(expression), name).toBe(expected);
    }
  });

  it('every rejected expression is unevaluable through the gated API', () => {
    for (const { name, expression, expected } of GATE_CASES) {
      if (expected) continue;
      expect(tryEvaluateRuleExpression(expression, user), name).toBe('unevaluable');
    }
  });
});

describe('ruleEvaluator parity — determinism', () => {
  it('returns the same outcome on repeated evaluation of every table row', () => {
    for (const { name, expression, expected } of OUTCOME_CASES) {
      expect(tryEvaluateRuleExpression(expression, user), name).toBe(expected);
      expect(tryEvaluateRuleExpression(expression, user), name).toBe(expected);
    }
  });
});
