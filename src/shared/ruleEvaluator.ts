/**
 * @module shared/ruleEvaluator
 * @description Best-effort client-side evaluator for Okta group-rule expressions.
 *
 * Syntax is parsed by [`jsep`](https://github.com/EricSmekens/jsep) — an
 * AST-only expression parser that performs no evaluation and generates no code.
 * **Semantics are ours**: the AST is walked against an explicit allow-list of
 * operators and Okta Expression Language functions ({@link SUPPORTED_FUNCTIONS}).
 * Anything outside that allow-list resolves to "unevaluable" — never to a guess,
 * and never to `eval`/`new Function` (which the MV3 extension CSP forbids anyway).
 * Rule expressions come from the Okta API and are treated as untrusted input.
 *
 * Three-valued (Kleene) logic is used throughout: an operand the evaluator cannot
 * resolve poisons only the parts of the expression that actually depend on it, so
 * `unresolvable || true` is still `true` and `unresolvable && false` is still
 * `false`. This is what lets {@link tryEvaluateRuleExpression} promise it will
 * never answer `no-match` when it merely failed to understand the expression.
 *
 * Group-membership functions (`isMemberOfGroup`, `isMemberOfGroupName`,
 * `isMemberOfAnyGroup*`, `…NameStartsWith`, `…NameContains`, `…NameRegex`) and
 * app-context (`app.*`) expressions cannot be resolved client-side — see
 * {@link GROUP_MEMBERSHIP_FUNCTIONS} for the seam that would resolve the former.
 *
 * Parsing is memoised in a bounded, FIFO-evicting cache ({@link PARSE_CACHE_LIMIT}
 * entries) because attribution evaluates the same few rule conditions once per
 * group member. Cached ASTs are shared across calls and users, so both walks
 * treat them as strictly read-only.
 *
 * @see {@link tryEvaluateRuleExpression} — the three-outcome API new code should use.
 * @see {@link evaluateRuleExpression} — legacy boolean API (cannot distinguish
 *   "false" from "could not tell").
 * @see {@link canEvaluateClientSide}
 */

import jsep from 'jsep';
import { createLogger } from './utils/logger';
import type { OktaUser } from './types';

const log = createLogger('RuleEvaluator');

/**
 * Okta Expression Language accepts word forms of the boolean and equality
 * operators (`and`, `or`, `eq`, `ne`) alongside the symbolic ones. jsep supports
 * identifier-shaped operators natively, so they are registered once at module
 * load; jsep's own boundary check keeps `user.andy` an attribute rather than an
 * `and` operator. Precedences mirror jsep's built-ins (`||` 1, `&&` 2, `==` 6).
 */
const WORD_BINARY_OPERATORS: ReadonlyArray<readonly [string, number]> = [
  ['or', 1],
  ['OR', 1],
  ['and', 2],
  ['AND', 2],
  ['eq', 6],
  ['ne', 6],
];

for (const [operator, precedence] of WORD_BINARY_OPERATORS) {
  jsep.addBinaryOp(operator, precedence);
}

/**
 * Hard cap on the expression length we will parse at all. Rule expressions are
 * untrusted input and both jsep's parser and this evaluator recurse; the cap
 * bounds the work an adversarial tenant value can cause. Real Okta group-rule
 * conditions are orders of magnitude shorter.
 */
const MAX_EXPRESSION_LENGTH = 4096;

/** A value an expression operand can resolve to. */
type ExprValue = string | number | boolean | null;

/**
 * Sentinel for "this sub-expression cannot be resolved client-side". Distinct
 * from `false` and from `null` — the whole point of the rewrite is that those
 * three are no longer conflated.
 */
const UNRESOLVED: unique symbol = Symbol('unresolved');
type Unresolved = typeof UNRESOLVED;

/** Result of evaluating a node: a concrete value, or {@link UNRESOLVED}. */
type EvalResult = ExprValue | Unresolved;

/** Whether the three-valued evaluator failed to resolve a node. */
function isUnresolved(result: EvalResult): result is Unresolved {
  return result === UNRESOLVED;
}

// ---------------------------------------------------------------------------
// Allow-lists
// ---------------------------------------------------------------------------

/** Equality operators, including Okta's `eq`/`ne` word forms. */
const EQUALITY_OPERATORS = new Set(['==', '===', 'eq']);
/** Inequality operators, including Okta's `ne` word form. */
const INEQUALITY_OPERATORS = new Set(['!=', '!==', 'ne']);
/** Numeric ordering operators. Only applied when both operands are numbers. */
const RELATIONAL_OPERATORS = new Set(['<', '>', '<=', '>=']);
/** Boolean conjunction, including Okta's word forms. */
const AND_OPERATORS = new Set(['&&', 'and', 'AND']);
/** Boolean disjunction, including Okta's word forms. */
const OR_OPERATORS = new Set(['||', 'or', 'OR']);

/** Every binary operator this evaluator understands. Anything else is unevaluable. */
const SUPPORTED_BINARY_OPERATORS: ReadonlySet<string> = new Set([
  ...EQUALITY_OPERATORS,
  ...INEQUALITY_OPERATORS,
  ...RELATIONAL_OPERATORS,
  ...AND_OPERATORS,
  ...OR_OPERATORS,
]);

/** An allow-listed Okta EL function: its exact arity plus a TypeScript implementation. */
interface SupportedFunction {
  /** Exact number of arguments. Calls with any other count are unevaluable. */
  arity: number;
  /** Pure implementation. Returns {@link UNRESOLVED} for argument types it cannot handle. */
  evaluate: (args: readonly ExprValue[]) => EvalResult;
}

/** Narrow an operand to a string, or give up. Okta EL string functions are string-typed. */
function asString(value: ExprValue | undefined): string | Unresolved {
  return typeof value === 'string' ? value : UNRESOLVED;
}

/** Apply `fn` to two string operands, giving up unless both really are strings. */
function withTwoStrings(
  args: readonly ExprValue[],
  fn: (a: string, b: string) => ExprValue,
): EvalResult {
  const first = asString(args[0]);
  const second = asString(args[1]);
  if (isUnresolved(first) || isUnresolved(second)) return UNRESOLVED;
  return fn(first, second);
}

/** Apply `fn` to a single string operand, giving up unless it really is a string. */
function withOneString(args: readonly ExprValue[], fn: (a: string) => ExprValue): EvalResult {
  const first = asString(args[0]);
  return isUnresolved(first) ? UNRESOLVED : fn(first);
}

/**
 * The Okta Expression Language functions this evaluator implements, keyed by
 * their fully-qualified name.
 *
 * Deliberately small: a function is listed only when its Okta semantics are
 * unambiguous, because an approximation would produce a confidently wrong
 * answer, which is strictly worse than reporting the expression as unevaluable.
 * Collection (`Arrays.*`) helpers are **not** available inside group-rule
 * conditions and are intentionally absent.
 */
export const SUPPORTED_FUNCTIONS: ReadonlyMap<string, SupportedFunction> = new Map<
  string,
  SupportedFunction
>([
  ['String.toUpperCase', { arity: 1, evaluate: (a) => withOneString(a, (s) => s.toUpperCase()) }],
  ['String.toLowerCase', { arity: 1, evaluate: (a) => withOneString(a, (s) => s.toLowerCase()) }],
  ['String.len', { arity: 1, evaluate: (a) => withOneString(a, (s) => s.length) }],
  [
    'String.stringContains',
    { arity: 2, evaluate: (a) => withTwoStrings(a, (s, search) => s.includes(search)) },
  ],
  [
    'String.startsWith',
    { arity: 2, evaluate: (a) => withTwoStrings(a, (s, prefix) => s.startsWith(prefix)) },
  ],
  [
    'String.endsWith',
    { arity: 2, evaluate: (a) => withTwoStrings(a, (s, suffix) => s.endsWith(suffix)) },
  ],
  ['String.append', { arity: 2, evaluate: (a) => withTwoStrings(a, (s, suffix) => s + suffix) }],
]);

/**
 * Okta EL functions that ask whether the user is in some other group.
 *
 * They are always unevaluable here because answering them needs the user's full
 * group list, which this module is not given. **Seam for a future version:**
 * thread the user's resolved groups (ids *and* names) into the evaluator and
 * implement these against that list. Note `isMemberOfGroupName` matches across
 * all group sources — an Okta group and a directory-sourced group sharing a name
 * both match — so name-based resolution needs the full, multi-source list rather
 * than just the Okta groups the side panel happens to have cached.
 */
export const GROUP_MEMBERSHIP_FUNCTIONS: ReadonlySet<string> = new Set([
  'isMemberOfGroup',
  'isMemberOfGroupName',
  'isMemberOfAnyGroup',
  'isMemberOfAnyGroupName',
  'isMemberOfGroupNameStartsWith',
  'isMemberOfGroupNameContains',
  'isMemberOfGroupNameRegex',
]);

// ---------------------------------------------------------------------------
// AST narrowing helpers (jsep's Expression carries an index signature, so each
// node type is narrowed explicitly rather than by property access).
// ---------------------------------------------------------------------------

function isLiteral(node: jsep.Expression): node is jsep.Literal {
  return node.type === 'Literal';
}

function isIdentifier(node: jsep.Expression): node is jsep.Identifier {
  return node.type === 'Identifier';
}

function isMemberExpression(node: jsep.Expression): node is jsep.MemberExpression {
  return node.type === 'MemberExpression';
}

function isCallExpression(node: jsep.Expression): node is jsep.CallExpression {
  return node.type === 'CallExpression';
}

function isUnaryExpression(node: jsep.Expression): node is jsep.UnaryExpression {
  return node.type === 'UnaryExpression';
}

function isBinaryExpression(node: jsep.Expression): node is jsep.BinaryExpression {
  return node.type === 'BinaryExpression';
}

/**
 * Fully-qualified name of a call's callee — `String.startsWith`, or a bare
 * `isMemberOfGroup`. Returns `undefined` for any callee shape we do not model
 * (computed access, nested namespaces, a call returning a function, …).
 */
function calleeName(node: jsep.CallExpression): string | undefined {
  const callee = node.callee;
  if (isIdentifier(callee)) return callee.name;
  if (isMemberExpression(callee) && !callee.computed) {
    const { object, property } = callee;
    if (isIdentifier(object) && isIdentifier(property)) return `${object.name}.${property.name}`;
  }
  return undefined;
}

/**
 * Hard cap on {@link parseCache} entries. Bounded on purpose — see the cache's
 * own note. 128 comfortably covers every distinct rule condition a group (or a
 * whole org's worth of open tabs) realistically feeds through the evaluator,
 * while keeping worst-case retention trivially small.
 */
const PARSE_CACHE_LIMIT = 128;

/**
 * Bounded memo of parsed expressions, keyed by the raw expression text.
 *
 * Membership attribution evaluates the same handful of rule conditions once per
 * member, so a 500-member group re-parses the same 3 strings 1,500 times. The
 * memo makes that one parse each.
 *
 * **Bounded, with FIFO eviction.** Expressions are untrusted, user-controllable
 * Okta data and the side panel is long-lived, so an unbounded `Map` keyed by
 * expression text is unbounded memory growth. `Map` preserves insertion order,
 * so deleting the first key evicts the oldest entry. Entries are only ever
 * inserted *after* the empty/length gates in {@link parseExpression}, so every
 * retained key is at most {@link MAX_EXPRESSION_LENGTH} characters by
 * construction. Keys are primitive strings, so a `WeakMap` is not applicable.
 *
 * **Parse failures are cached too** (as `undefined`), read back with `has`
 * rather than a truthiness check — otherwise an ungrammatical expression, which
 * is exactly what an adversarial tenant would supply, re-parses on every member.
 *
 * **Cached ASTs are shared across calls and across users, so every consumer must
 * treat them as strictly read-only.** Both walks ({@link isSupportedNode} and
 * {@link evaluateNode}) only read; neither annotates or rewrites nodes.
 *
 * Nothing about this cache is ever logged — its keys are expression text, which
 * can carry tenant PII.
 */
const parseCache = new Map<string, jsep.Expression | undefined>();

/** Record a parse outcome, evicting the oldest entry once the cap is reached. */
function rememberParse(
  expression: string,
  ast: jsep.Expression | undefined,
): jsep.Expression | undefined {
  if (parseCache.size >= PARSE_CACHE_LIMIT) {
    const oldest = parseCache.keys().next();
    if (!oldest.done) parseCache.delete(oldest.value);
  }
  parseCache.set(expression, ast);
  return ast;
}

/** Parse an expression, or `undefined` if it is empty, oversized, or ungrammatical. */
function parseExpression(expression: string): jsep.Expression | undefined {
  if (!expression || !expression.trim()) return undefined;
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    log.debug('Rule expression rejected', { reason: 'too-long', length: expression.length });
    return undefined;
  }
  // `has`, not a truthiness check: a cached parse *failure* is `undefined` and
  // must still count as a hit.
  if (parseCache.has(expression)) return parseCache.get(expression);
  try {
    return rememberParse(expression, jsep(expression.trim()));
  } catch {
    // Never log the expression itself: literals can carry tenant PII.
    log.debug('Rule expression rejected', { reason: 'parse-error' });
    return rememberParse(expression, undefined);
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** Truthiness of a resolved value, propagating {@link UNRESOLVED}. */
function truthiness(result: EvalResult): boolean | Unresolved {
  return isUnresolved(result) ? UNRESOLVED : Boolean(result);
}

/**
 * Read `user.<attribute>` off the user's profile. Only the single-level
 * `user.*` form is modelled; `app.*`, `session.*`, computed access and nested
 * paths are unresolvable.
 */
function resolveMember(node: jsep.MemberExpression, user: OktaUser): EvalResult {
  if (node.computed) return UNRESOLVED;
  const { object, property } = node;
  if (!isIdentifier(object) || object.name !== 'user') return UNRESOLVED;
  if (!isIdentifier(property)) return UNRESOLVED;

  const raw = (user.profile as Record<string, unknown>)[property.name];
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
  return String(raw);
}

/** Three-valued conjunction: `false` wins over unresolved, unresolved wins over `true`. */
function evaluateAnd(left: EvalResult, right: EvalResult): EvalResult {
  const a = truthiness(left);
  const b = truthiness(right);
  if (a === false || b === false) return false;
  if (isUnresolved(a) || isUnresolved(b)) return UNRESOLVED;
  return true;
}

/** Three-valued disjunction: `true` wins over unresolved, unresolved wins over `false`. */
function evaluateOr(left: EvalResult, right: EvalResult): EvalResult {
  const a = truthiness(left);
  const b = truthiness(right);
  if (a === true || b === true) return true;
  if (isUnresolved(a) || isUnresolved(b)) return UNRESOLVED;
  return false;
}

/** Numeric ordering. Unresolvable unless both operands really are numbers. */
function evaluateRelational(operator: string, left: EvalResult, right: EvalResult): EvalResult {
  if (typeof left !== 'number' || typeof right !== 'number') return UNRESOLVED;
  switch (operator) {
    case '<':
      return left < right;
    case '>':
      return left > right;
    case '<=':
      return left <= right;
    case '>=':
      return left >= right;
    default:
      return UNRESOLVED;
  }
}

function evaluateBinary(node: jsep.BinaryExpression, user: OktaUser): EvalResult {
  const { operator } = node;
  const left = evaluateNode(node.left, user);
  const right = evaluateNode(node.right, user);

  if (AND_OPERATORS.has(operator)) return evaluateAnd(left, right);
  if (OR_OPERATORS.has(operator)) return evaluateOr(left, right);

  // Comparison operators cannot answer anything about an unresolved operand.
  if (isUnresolved(left) || isUnresolved(right)) return UNRESOLVED;

  // Strict, type-sensitive equality — matching Okta's case-sensitive comparison
  // and the behaviour this module has always had.
  if (EQUALITY_OPERATORS.has(operator)) return left === right;
  if (INEQUALITY_OPERATORS.has(operator)) return left !== right;
  if (RELATIONAL_OPERATORS.has(operator)) return evaluateRelational(operator, left, right);

  log.debug('Rule expression not evaluable', { reason: 'unsupported-operator' });
  return UNRESOLVED;
}

function evaluateCall(node: jsep.CallExpression, user: OktaUser): EvalResult {
  const name = calleeName(node);
  const fn = name ? SUPPORTED_FUNCTIONS.get(name) : undefined;
  if (!name || !fn) {
    log.debug('Rule expression not evaluable', {
      reason: name && GROUP_MEMBERSHIP_FUNCTIONS.has(name) ? 'group-membership-fn' : 'unknown-fn',
    });
    return UNRESOLVED;
  }
  if (node.arguments.length !== fn.arity) {
    log.debug('Rule expression not evaluable', { reason: 'fn-arity' });
    return UNRESOLVED;
  }

  const args: ExprValue[] = [];
  for (const argument of node.arguments) {
    const value = evaluateNode(argument, user);
    if (isUnresolved(value)) return UNRESOLVED;
    args.push(value);
  }
  return fn.evaluate(args);
}

/** Walk one AST node against the allow-list. Never throws for unsupported input. */
function evaluateNode(node: jsep.Expression, user: OktaUser): EvalResult {
  if (isLiteral(node)) {
    const { value } = node;
    if (value === null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return UNRESOLVED; // e.g. a regular-expression literal
  }
  if (isMemberExpression(node)) return resolveMember(node, user);
  if (isCallExpression(node)) return evaluateCall(node, user);
  if (isBinaryExpression(node)) return evaluateBinary(node, user);
  if (isUnaryExpression(node)) {
    if (node.operator !== '!') return UNRESOLVED;
    const argument = truthiness(evaluateNode(node.argument, user));
    return isUnresolved(argument) ? UNRESOLVED : !argument;
  }
  // Identifier, Compound, ArrayExpression, ConditionalExpression, ThisExpression,
  // SequenceExpression — none are meaningful group-rule conditions.
  log.debug('Rule expression not evaluable', { reason: 'unsupported-node' });
  return UNRESOLVED;
}

/**
 * Walk an already-parsed AST. Returns {@link UNRESOLVED} for anything outside
 * the allow-list, and never throws.
 *
 * Takes the AST rather than the expression text so callers that also need the
 * {@link canEvaluateAst} gate can parse once and share the tree. **Read-only:**
 * the node may come from {@link parseCache} and be shared with other calls.
 */
function evaluateAst(ast: jsep.Expression, user: OktaUser): EvalResult {
  try {
    return evaluateNode(ast, user);
  } catch {
    // Defensive: a pathologically nested expression can exhaust the stack.
    log.debug('Rule expression not evaluable', { reason: 'walk-failed' });
    return UNRESOLVED;
  }
}

/** Parse + walk. Returns {@link UNRESOLVED} for anything outside the allow-list. */
function evaluate(expression: string, user: OktaUser): EvalResult {
  const ast = parseExpression(expression);
  if (!ast) return UNRESOLVED;
  return evaluateAst(ast, user);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Whether a rule expression matched a user, or whether that could not be
 * determined client-side.
 *
 * - `match` — the user satisfies the condition.
 * - `no-match` — the expression was fully understood and the user does **not**
 *   satisfy it.
 * - `unevaluable` — the expression is outside the supported subset; nothing at
 *   all is implied about the user.
 */
export type RuleMatchOutcome = 'match' | 'no-match' | 'unevaluable';

/**
 * Evaluate a group-rule condition against a user, distinguishing "does not
 * match" from "cannot tell".
 *
 * This is the API callers that act on the answer (e.g. membership attribution)
 * must use. It returns `unevaluable` — **never** `no-match` — when the
 * expression is empty, oversized, ungrammatical, uses an unsupported node type
 * or operator, calls a function outside {@link SUPPORTED_FUNCTIONS} (including
 * every {@link GROUP_MEMBERSHIP_FUNCTIONS} entry), references anything other
 * than a `user.*` profile attribute, or does not reduce to a boolean.
 *
 * @param expression - The rule's condition expression (untrusted Okta data).
 * @param user - The user to evaluate the condition against.
 * @returns The {@link RuleMatchOutcome}. Pure — no API calls, no code execution.
 */
export function tryEvaluateRuleExpression(expression: string, user: OktaUser): RuleMatchOutcome {
  // Parsed once and shared by both gates below; the AST is walked twice but jsep
  // runs at most once (and not at all on a {@link parseCache} hit).
  const ast = parseExpression(expression);
  if (!ast) return 'unevaluable';

  // Gate 1 — grammar: is every node of the expression on the allow-list?
  if (!canEvaluateAst(ast)) return 'unevaluable';

  // Gate 2 — shape, and deliberately INDEPENDENT of gate 1: an expression can
  // be entirely allow-listed and still not be a condition (`user.department`,
  // `"Engineering"`, `String.toUpperCase(user.department)` all pass gate 1). A
  // condition that does not reduce to a boolean is not a condition we
  // understand, whatever it reduced to. Collapsing the two gates would turn
  // those into `no-match`, which membership attribution reads as a manual add.
  const result = evaluateAst(ast, user);
  if (typeof result !== 'boolean') return 'unevaluable';
  return result ? 'match' : 'no-match';
}

/**
 * Legacy boolean evaluator: `true` when the user matches, `false` otherwise.
 *
 * Retained for existing callers and behaviour-pinning tests. It **cannot
 * distinguish "did not match" from "could not be evaluated"** — both are
 * `false` — so new code should use {@link tryEvaluateRuleExpression} instead.
 *
 * Supported subset: `user.<attribute>` reads, string/number/boolean/null
 * literals, `==`/`===`/`eq`, `!=`/`!==`/`ne`, `<`/`>`/`<=`/`>=` (numbers only),
 * `&&`/`and`/`AND`, `||`/`or`/`OR`, `!`, parentheses, and the calls in
 * {@link SUPPORTED_FUNCTIONS}.
 *
 * @param expression - The rule's condition expression (untrusted Okta data).
 * @param user - The user to evaluate the condition against.
 * @returns `true` only when the expression was understood **and** matched.
 */
export function evaluateRuleExpression(expression: string, user: OktaUser): boolean {
  const result = evaluate(expression, user);
  return isUnresolved(result) ? false : Boolean(result);
}

/** Recursively check a parsed node against the allow-list. */
function isSupportedNode(node: jsep.Expression): boolean {
  if (isLiteral(node)) {
    const { value } = node;
    return (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }
  if (isMemberExpression(node)) {
    return (
      !node.computed &&
      isIdentifier(node.object) &&
      node.object.name === 'user' &&
      isIdentifier(node.property)
    );
  }
  if (isCallExpression(node)) {
    const name = calleeName(node);
    const fn = name ? SUPPORTED_FUNCTIONS.get(name) : undefined;
    if (!fn || node.arguments.length !== fn.arity) return false;
    return node.arguments.every(isSupportedNode);
  }
  if (isUnaryExpression(node)) {
    return node.operator === '!' && isSupportedNode(node.argument);
  }
  if (isBinaryExpression(node)) {
    return (
      SUPPORTED_BINARY_OPERATORS.has(node.operator) &&
      isSupportedNode(node.left) &&
      isSupportedNode(node.right)
    );
  }
  return false;
}

/**
 * Check an already-parsed AST against the allow-list, defensively.
 *
 * Takes the AST rather than the expression text so {@link tryEvaluateRuleExpression}
 * can share one parse between this gate and {@link evaluateAst}. **Read-only:**
 * the node may come from {@link parseCache} and be shared with other calls.
 */
function canEvaluateAst(ast: jsep.Expression): boolean {
  try {
    return isSupportedNode(ast);
  } catch {
    return false;
  }
}

/**
 * Pre-validate whether an expression can be resolved client-side at all.
 *
 * Call this before {@link evaluateRuleExpression} to avoid presenting a
 * "no match" that is really a "don't know" — the UI should say "Cannot
 * evaluate" instead. ({@link tryEvaluateRuleExpression} applies this gate
 * itself.)
 *
 * Implemented as an **AST walk**, not a substring scan: an expression that
 * parses but uses an unsupported operator or function is rejected here rather
 * than silently degrading to `false` at evaluation time. Group-membership calls
 * and `app.*` context — the historical rejections — are still rejected, because
 * neither is on the allow-list.
 *
 * @param expression - The rule's condition expression (untrusted Okta data).
 * @returns `true` only if every node of the expression is on the allow-list.
 */
export function canEvaluateClientSide(expression: string): boolean {
  const ast = parseExpression(expression);
  if (!ast) return false;
  return canEvaluateAst(ast);
}
