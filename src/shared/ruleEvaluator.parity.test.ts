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
    // Present and explicitly `null`, which is a different fact from absent and
    // must stay reachable from the table: `user.andy == null` has to resolve to
    // `null == null` for the word-boundary rows below to be testing the
    // boundary rather than the absent-attribute path.
    andy: null,
    orbit: null,
    notes: null,
    // A negative numeric attribute, for the unary-minus relational rows, and a
    // custom attribute whose name is not a valid bare identifier — reachable
    // only through computed access.
    floor: -1,
    'cost center': 'CC-9',
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
    // An attribute this profile does not carry is the evaluator failing to
    // understand the expression, not a value equal to `null`. Reading the two as
    // one is what made `user.status == "ACTIVE"` answer `no-match` for a whole
    // org (D-114); these three rows pinned that reading and now pin its replacement.
    name: 'absent attribute is not null — it is unevaluable',
    expression: 'user.division == null',
    expected: 'unevaluable',
  },
  {
    name: 'absent attribute yields no verdict against a string either',
    expression: 'user.division == "Platform"',
    expected: 'unevaluable',
  },
  {
    name: 'an attribute present and explicitly null still compares as null',
    expression: 'user.andy == null',
    expected: 'match',
  },
  {
    name: 'a top-level user field resolves off the user, not the profile',
    expression: 'user.status == "ACTIVE"',
    expected: 'match',
  },
  {
    name: 'a top-level user field can answer no-match',
    expression: 'user.status == "SUSPENDED"',
    expected: 'no-match',
  },
  {
    name: 'a user field outside the addressable set stays unevaluable',
    expression: 'user.credentials == null',
    expected: 'unevaluable',
  },
  {
    // Was `match`, on the strength of `String(['admin','dev']) === 'admin,dev'`.
    // An array is an array: `==` cannot compare one, and `Arrays.*` is how it is
    // asked about.
    name: 'a multi-valued attribute is not its joined string',
    expression: 'user.roles == "admin,dev"',
    expected: 'unevaluable',
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
    // jsep's identifier boundary check keeps `andy`/`orbit` whole. Both are
    // present and null on the fixture, so a `match` here proves the boundary
    // held rather than that both reads failed the same way.
    expression: 'user.andy == null and user.orbit == null',
    expected: 'match',
  },
  {
    name: 'the NOT word form negates, and does not swallow an attribute',
    // `NOT`/`not` are registered as unary operators; the same boundary check
    // keeps `user.notes` an attribute rather than `not` applied to `es`.
    expression: 'NOT user.isContractor == false and user.notes == null',
    expected: 'match',
  },
  {
    name: 'the lowercase not word form negates too',
    expression: 'not user.isContractor',
    expected: 'no-match',
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
    name: 'String.join matching',
    expression: 'String.join("-", user.firstName, user.lastName) == "Ada-Lovelace"',
    expected: 'match',
  },
  {
    name: 'String.join non-matching',
    expression: 'String.join("-", user.firstName, user.lastName) == "Ada Lovelace"',
    expected: 'no-match',
  },
  {
    name: 'String.removeSpaces matching',
    expression: 'String.removeSpaces(user.city) == "SanFrancisco"',
    expected: 'match',
  },
  {
    name: 'String.removeSpaces non-matching',
    expression: 'String.removeSpaces(user.city) == "San Francisco"',
    expected: 'no-match',
  },
  {
    name: 'String.replace matching',
    expression: 'String.replace(user.city, "San ", "") == "Francisco"',
    expected: 'match',
  },
  {
    name: 'String.replace non-matching',
    expression: 'String.replace(user.city, "San ", "") == "San Francisco"',
    expected: 'no-match',
  },
  {
    name: 'String.substring matching',
    expression: 'String.substring(user.email, 0, 4) == "user"',
    expected: 'match',
  },
  {
    name: 'String.substring non-matching',
    expression: 'String.substring(user.email, 0, 4) == "USER"',
    expected: 'no-match',
  },
  {
    name: 'String.substring gives up on an out-of-range end rather than clamping',
    expression: 'String.substring(user.firstName, 0, 99) == "Ada"',
    expected: 'unevaluable',
  },
  {
    name: 'String.substringAfter matching',
    expression: 'String.substringAfter(user.email, "@") == "example.com"',
    expected: 'match',
  },
  {
    name: 'String.substringAfter non-matching',
    expression: 'String.substringAfter(user.email, "@") == "other.example"',
    expected: 'no-match',
  },
  {
    name: 'String.substringAfter gives up when the separator is absent',
    // Okta does not publish whether a missing separator yields the empty string
    // or the whole input, and the two produce opposite verdicts.
    expression: 'String.substringAfter(user.firstName, "@") == ""',
    expected: 'unevaluable',
  },
  {
    name: 'String.substringBefore matching',
    expression: 'String.substringBefore(user.email, "@") == "user"',
    expected: 'match',
  },
  {
    name: 'String.substringBefore non-matching',
    expression: 'String.substringBefore(user.email, "@") == "other"',
    expected: 'no-match',
  },
  {
    name: 'Arrays.contains matching',
    expression: 'Arrays.contains(user.roles, "admin")',
    expected: 'match',
  },
  {
    name: 'Arrays.contains non-matching',
    expression: 'Arrays.contains(user.roles, "auditor")',
    expected: 'no-match',
  },
  {
    name: 'Arrays.contains does not coerce its needle',
    expression: 'Arrays.contains(user.roles, 1)',
    expected: 'no-match',
  },
  {
    name: 'Arrays.contains gives up on a non-array first argument',
    expression: 'Arrays.contains(user.department, "Engineering")',
    expected: 'unevaluable',
  },
  { name: 'Arrays.size matching', expression: 'Arrays.size(user.roles) == 2', expected: 'match' },
  {
    name: 'Arrays.size non-matching',
    expression: 'Arrays.size(user.roles) == 3',
    expected: 'no-match',
  },
  {
    name: 'Arrays.isEmpty matching',
    expression: 'Arrays.isEmpty(user.roles) == false',
    expected: 'match',
  },
  {
    name: 'Arrays.isEmpty non-matching',
    expression: 'Arrays.isEmpty(user.roles) == true',
    expected: 'no-match',
  },
  {
    name: 'Arrays.toCsvString matching',
    expression: 'Arrays.toCsvString(user.roles) == "admin,dev"',
    expected: 'match',
  },
  {
    name: 'Arrays.toCsvString non-matching',
    expression: 'Arrays.toCsvString(user.roles) == "admin;dev"',
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
    // `String.replaceFirst` takes a regular expression in the language Okta's EL
    // is built on, so it is refused rather than approximated — see
    // SUPPORTED_FUNCTIONS' note. It stands in for the String namespace's
    // unknown-fn route now that `String.substring` is implemented.
    name: 'reason unknown-fn: String function outside the allow-list',
    expression: 'String.replaceFirst(user.email, "user", "x") == "x@example.com"',
    expected: 'unevaluable',
  },
  {
    // `Arrays.flatten` returns a collection rather than answering anything, so
    // no rule condition ends in one and it is not listed.
    name: 'reason unknown-fn: an Arrays helper outside the allow-list',
    expression: 'Arrays.flatten(user.roles) == "admin"',
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
    // A non-literal computed key stays unsupported; a string-literal key now
    // resolves through the identical `user.<attribute>` lookup — see the
    // "computed member access" rows below.
    name: 'unsupported reference: non-literal computed member access',
    expression: 'user[user.department] == "Engineering"',
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
  // --- conditional expressions (`test ? consequent : alternate`) -------------
  // These rows read `unevaluable` until the evaluator learned the node type:
  // jsep always parsed a ternary, and both walks declined it as
  // `unsupported-node`.
  {
    name: 'conditional: a true test takes the consequent',
    expression: 'user.isContractor ? true : false',
    expected: 'match',
  },
  {
    name: 'conditional: a false test takes the alternate',
    expression: 'user.department == "Sales" ? true : false',
    expected: 'no-match',
  },
  {
    name: 'conditional producing a value, compared',
    expression: '(user.department == "Engineering" ? "Eng" : "Other") == "Eng"',
    expected: 'match',
  },
  {
    name: 'conditional whose chosen branch does not resolve',
    expression: `user.isContractor ? ${UNRESOLVED_CLAUSE} : true`,
    expected: 'unevaluable',
  },
  {
    name: 'conditional whose UNCHOSEN branch does not resolve still answers',
    expression: `user.isContractor ? true : ${UNRESOLVED_CLAUSE}`,
    expected: 'match',
  },
  {
    name: 'conditional with an unresolved test and identical branches resolves',
    expression: `(${UNRESOLVED_CLAUSE} ? "X" : "X") == "X"`,
    expected: 'match',
  },
  {
    name: 'conditional with an unresolved test and differing branches stays unevaluable',
    expression: `(${UNRESOLVED_CLAUSE} ? "X" : "Y") == "X"`,
    expected: 'unevaluable',
  },
  {
    name: 'conditional with an unsupported branch stays unevaluable',
    expression: 'user.isContractor ? true : department',
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

  // --- unary minus on a numeric literal ---------------------------------------
  {
    name: 'unary minus on a numeric literal, matching',
    expression: 'user.floor == -1',
    expected: 'match',
  },
  {
    name: 'unary minus on a numeric literal, non-matching',
    expression: 'user.floor == -2',
    expected: 'no-match',
  },
  {
    name: 'unary minus on a fractional literal',
    expression: 'user.headcount >= -0.5',
    expected: 'match',
  },
  {
    name: 'unary minus on a non-literal operand stays unevaluable',
    expression: 'user.headcount == -user.floor',
    expected: 'unevaluable',
  },

  // --- computed member access with a string-literal key ----------------------
  {
    name: 'computed member access, matching',
    expression: 'user["cost center"] == "CC-9"',
    expected: 'match',
  },
  {
    name: 'computed member access, non-matching',
    expression: 'user["cost center"] == "CC-1"',
    expected: 'no-match',
  },
  {
    name: 'computed member access, attribute the profile does not carry',
    expression: 'user["cost centre"] == "CC-9"',
    expected: 'unevaluable',
  },
  {
    name: 'computed member access with a non-literal key stays unevaluable',
    expression: 'user[user.department] == "Engineering"',
    expected: 'unevaluable',
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
  {
    // Rejected because the LEFT operand, `-user.headcount`, is a unary minus on
    // a non-literal — not because of the right operand, which is now accepted
    // on its own (see the next row).
    name: 'rejects a unary minus applied to a non-literal',
    expression: '-user.headcount == -42',
    expected: false,
  },
  {
    name: 'accepts a unary minus applied to a numeric literal',
    expression: 'user.headcount == -42',
    expected: true,
  },
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
    expression: 'String.replaceFirst(user.email, "user", "x") == "x@example.com"',
    expected: false,
  },
  {
    name: 'rejects an Arrays helper outside the allow-list',
    expression: 'Arrays.flatten(user.roles) == "admin"',
    expected: false,
  },
  {
    name: 'accepts the Arrays helpers that are implemented',
    expression: 'Arrays.contains(user.roles, "admin")',
    expected: true,
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
    // A string-literal computed key is now on the allow-list — see the
    // "computed member access" rows below. Only a non-literal key is rejected.
    name: 'rejects a non-literal computed member access',
    expression: 'user[user.department] == "Engineering"',
    expected: false,
  },
  {
    name: 'accepts computed member access with a string-literal key',
    expression: 'user["department"] == "Engineering"',
    expected: true,
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
    name: 'accepts a conditional expression whose three parts are all supported',
    expression: 'user.isContractor ? true : false',
    expected: true,
  },
  {
    name: 'accepts a nested conditional',
    expression: 'user.isContractor ? (user.department == "Engineering" ? "a" : "b") : "c"',
    expected: true,
  },
  {
    name: 'rejects a conditional with an unsupported test',
    expression: '["a"] ? "a" : "b"',
    expected: false,
  },
  {
    name: 'rejects a conditional with an unsupported consequent',
    expression: 'user.isContractor ? department : "b"',
    expected: false,
  },
  {
    name: 'rejects a conditional with an unsupported alternate',
    expression: 'user.isContractor ? "a" : this.department',
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
