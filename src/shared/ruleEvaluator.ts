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
 * Both walks take an **options object** rather than positional arguments
 * ({@link RuleEvaluationOptions}). That is deliberate: the deferred
 * group-membership seam threads a resolved group list through every visitor, and
 * an options object makes that one additive field instead of a signature rewrite
 * across eight functions.
 *
 * The AST-level seam ({@link parseRuleExpression}, {@link checkRuleNodeSupport},
 * {@link evaluateRuleNode}, {@link evaluateParsedRule}) exists so a caller that
 * needs to explain an expression clause by clause — `shared/rules/explainExpression`
 * — can reuse the one memoised parse and the one allow-list instead of adding a
 * second parser or a second grammar.
 *
 * There is deliberately **no boolean entry point**. A two-valued API has to
 * collapse "did not match" into "could not tell", and membership attribution
 * reads the resulting `false` as a manual add — the exact defect the three-valued
 * core exists to prevent (ADR-0025).
 *
 * @see {@link tryEvaluateRuleExpression} — the three-outcome API new code should use.
 * @see {@link tryEvaluateRuleExpressionDetailed} — same outcomes, plus the reason code.
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
 * A value an expression operand can resolve to — the public alias of the
 * evaluator's internal operand type.
 *
 * Values come from the user's Okta profile, so they are **PII**: rendering them
 * is fine (React escapes), logging them is not, and any export path must send
 * them through `csvUtils.escapeCSV`.
 */
export type RuleExprValue = ExprValue;

/**
 * Why the evaluator declined to answer — the payload behind an `unevaluable`
 * outcome, and behind a `not-evaluated` clause in the explainer.
 *
 * Every code is a **non-sensitive constant**: reason codes are safe to log,
 * expression text and resolved values are not.
 *
 * - `empty` — the expression was empty or whitespace-only.
 * - `too-long` — longer than {@link MAX_EXPRESSION_LENGTH}; rejected before parsing.
 * - `parse-error` — jsep could not parse it.
 * - `unsupported-operator` — a binary operator outside {@link SUPPORTED_BINARY_OPERATORS}.
 * - `group-membership-fn` — a {@link GROUP_MEMBERSHIP_FUNCTIONS} call made without
 *   a {@link RuleGroupContext}; answering it needs the user's full group list.
 * - `group-name-regex` — `isMemberOfGroupNameRegex`, which this module declines to
 *   run **even with** a group list. See {@link GROUP_MEMBERSHIP_FUNCTIONS}.
 * - `unknown-fn` — a call outside {@link SUPPORTED_FUNCTIONS}.
 * - `fn-arity` — an allow-listed function called with the wrong argument count.
 * - `unsupported-node` — a node shape we do not model (computed or non-`user.*`
 *   member access, a bare identifier, `this`, a regex literal, a `Compound`, …).
 * - `operand-type` — allow-listed grammar, but an operand's runtime type is
 *   outside what the operator or function accepts (`user.department > "A"`,
 *   `String.startsWith(user.employeeNumber, "4")`).
 * - `not-a-boolean` — fully resolved, but not to a boolean, so it is not a
 *   condition (`user.department`, `"Engineering"`).
 * - `walk-failed` — the walk threw (a pathologically nested expression can
 *   exhaust the stack).
 */
export type RuleUnevaluableReason =
  | 'empty'
  | 'too-long'
  | 'parse-error'
  | 'unsupported-operator'
  | 'group-membership-fn'
  | 'group-name-regex'
  | 'unknown-fn'
  | 'fn-arity'
  | 'unsupported-node'
  | 'operand-type'
  | 'not-a-boolean'
  | 'walk-failed';

/**
 * One group the user belongs to, as the `isMemberOf*` functions need to see it.
 *
 * Both fields are required because the two families of membership function ask
 * different questions of the same list: `isMemberOfGroup` matches on `id`, and
 * every `…Name*` variant matches on `name`.
 */
export interface RuleGroupContextEntry {
  /** Okta group id, matched by the id-taking functions. */
  readonly id: string;
  /** Group display name, matched by the name-taking functions. **Untrusted.** */
  readonly name: string;
}

/**
 * The user's resolved group memberships — **every** group they are in.
 *
 * ## This list must be complete, or the answers are wrong
 *
 * The membership functions are answered in *both* directions: finding no match
 * returns `false`, not "don't know". That is only sound when the list is the
 * user's whole membership set, which is why the intended source is Okta's own
 * `GET /api/v1/users/{id}/groups` — authoritative, and inclusive of
 * directory-sourced groups that the side panel's cached Okta group list would
 * miss.
 *
 * Supplying a *partial* list (e.g. only the groups one screen happens to have
 * loaded) turns every unlisted group into a confident `false`. Omit the option
 * entirely rather than passing a subset: absent means the functions stay
 * `group-membership-fn` unevaluable, which is the honest answer.
 */
export type RuleGroupContext = readonly RuleGroupContextEntry[];

/**
 * Everything the evaluation walk needs, as an object rather than positional
 * arguments.
 */
export interface RuleEvaluationOptions {
  /** The user whose profile `user.<attribute>` reads resolve against. */
  readonly user: OktaUser;
  /**
   * The user's complete group list, enabling the `isMemberOf*` functions.
   *
   * Omitted, those functions remain unevaluable (`group-membership-fn`) exactly
   * as before this option existed — so no existing caller changes behaviour by
   * upgrading. See {@link RuleGroupContext} for why a partial list is worse than
   * none at all.
   */
  readonly groups?: RuleGroupContext;
}

/**
 * Internal evaluation options: {@link RuleEvaluationOptions} plus an optional
 * observer that captures *why* a node could not be resolved.
 *
 * The observer exists because the reason codes were previously written only to
 * `log.debug`, which is a no-op in production builds — so eight distinct "we
 * could not tell" answers collapsed into one. It receives **reason codes only**;
 * never expression text and never resolved values.
 */
interface EvaluationWalkOptions extends RuleEvaluationOptions {
  readonly onUnresolved?: (reason: RuleUnevaluableReason) => void;
}

/** Internal grammar-walk options. Same observer contract as {@link EvaluationWalkOptions}. */
interface GrammarWalkOptions {
  readonly onUnsupported?: (reason: RuleUnevaluableReason) => void;
  /**
   * Whether a {@link RuleGroupContext} will be available at evaluation time.
   *
   * The grammar gate answers "can this be resolved client-side at all", and for
   * the `isMemberOf*` functions that now depends on whether the caller holds the
   * user's group list. The gate and the evaluation walk must agree, or an
   * expression would pass support and then fail to resolve.
   */
  readonly hasGroupContext?: boolean;
}

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

/**
 * The boolean connectives, symbolic and word forms.
 *
 * Exported because a rule condition's *clauses* are exactly the leaves you reach
 * by descending through these operators — `shared/rules/explainExpression` splits
 * on this set rather than restating it and drifting.
 */
export const RULE_CONNECTIVE_OPERATORS: ReadonlySet<string> = new Set([
  ...AND_OPERATORS,
  ...OR_OPERATORS,
]);

/**
 * The conjunctive connectives alone.
 *
 * A rule's independently-reportable *requirements* are the leaves you reach by
 * descending through these and stopping at a disjunction, because the parts of
 * an OR are alternatives rather than requirements: only one has to hold. See
 * {@link RULE_CONNECTIVE_OPERATORS} for the full set, which is still what the
 * evaluator itself walks.
 */
export const RULE_CONJUNCTIVE_OPERATORS: ReadonlySet<string> = new Set([...AND_OPERATORS]);

/**
 * The disjunctive connectives alone.
 *
 * The parts either side of one of these are *alternatives*: only one has to
 * hold. Explanation surfaces use this to keep an OR group whole as a single
 * requirement while still naming what it offers.
 */
export const RULE_DISJUNCTIVE_OPERATORS: ReadonlySet<string> = new Set([...OR_OPERATORS]);

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
 * Answered against a {@link RuleGroupContext} when the caller supplies one, and
 * reported as `group-membership-fn` unevaluable when it does not — the module's
 * behaviour before the group list existed, preserved for every caller that has no
 * list to give. Note `isMemberOfGroupName` matches across all group sources — an
 * Okta group and a directory-sourced group sharing a name both match — which is
 * why `RuleGroupContext` insists on the user's *complete* membership set rather
 * than the Okta groups a screen happens to have cached.
 *
 * ## `isMemberOfGroupNameRegex` is deliberately never run
 *
 * It is the one member of this set that stays unevaluable even with a group list,
 * under its own reason code (`group-name-regex`). The pattern is tenant-authored
 * text, and building a `RegExp` from it hands an untrusted author a
 * catastrophic-backtracking lever over the side panel's only thread — a rule
 * whose evaluation hangs the UI. There is no way to bound backtracking in a
 * JavaScript `RegExp`, so the honest, safe answer is to say we did not check.
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

/** The one membership function that stays unevaluable even with a group list. */
const GROUP_NAME_REGEX_FUNCTION = 'isMemberOfGroupNameRegex';

/**
 * How one membership function reads its arguments against the group list.
 *
 * `variadic` distinguishes the `…Any…` forms, which Okta lets take any number of
 * groups, from the single-argument forms. Both require at least one argument, so
 * arity is checked as a minimum rather than an exact count.
 */
interface GroupMembershipFunction {
  /** Whether the user is in a group matching one argument. */
  readonly matches: (group: RuleGroupContextEntry, argument: string) => boolean;
  /** Whether Okta allows more than one group argument. */
  readonly variadic: boolean;
}

/**
 * Name matching is case-sensitive, mirroring Okta's own evaluation: two groups
 * differing only in case are two different groups, and lower-casing here would
 * report a membership the tenant does not have.
 */
const GROUP_MEMBERSHIP_IMPLEMENTATIONS: ReadonlyMap<string, GroupMembershipFunction> = new Map([
  ['isMemberOfGroup', { matches: (g, a) => g.id === a, variadic: false }],
  ['isMemberOfAnyGroup', { matches: (g, a) => g.id === a, variadic: true }],
  ['isMemberOfGroupName', { matches: (g, a) => g.name === a, variadic: false }],
  ['isMemberOfAnyGroupName', { matches: (g, a) => g.name === a, variadic: true }],
  ['isMemberOfGroupNameStartsWith', { matches: (g, a) => g.name.startsWith(a), variadic: false }],
  ['isMemberOfGroupNameContains', { matches: (g, a) => g.name.includes(a), variadic: false }],
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
 * Give up on a node, attributing a reason to the walk's observer.
 *
 * Only a reason **code** is recorded — never the node, its text or its value.
 */
function giveUp(reason: RuleUnevaluableReason, options: EvaluationWalkOptions): Unresolved {
  options.onUnresolved?.(reason);
  return UNRESOLVED;
}

/**
 * {@link giveUp}, for the sites that have always emitted a debug line. Kept
 * separate so attributing the previously-silent give-up sites to the observer
 * does not change what (or how much) this module logs.
 */
function giveUpLogged(reason: RuleUnevaluableReason, options: EvaluationWalkOptions): Unresolved {
  log.debug('Rule expression not evaluable', { reason });
  return giveUp(reason, options);
}

/**
 * Read `user.<attribute>` off the user's profile. Only the single-level
 * `user.*` form is modelled; `app.*`, `session.*`, computed access and nested
 * paths are unresolvable.
 */
function resolveMember(node: jsep.MemberExpression, options: EvaluationWalkOptions): EvalResult {
  if (node.computed) return giveUp('unsupported-node', options);
  const { object, property } = node;
  if (!isIdentifier(object) || object.name !== 'user') return giveUp('unsupported-node', options);
  if (!isIdentifier(property)) return giveUp('unsupported-node', options);

  const raw = (options.user.profile as Record<string, unknown>)[property.name];
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
function evaluateRelational(
  operator: string,
  left: EvalResult,
  right: EvalResult,
  options: EvaluationWalkOptions,
): EvalResult {
  if (typeof left !== 'number' || typeof right !== 'number') {
    return giveUp('operand-type', options);
  }
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
      return giveUp('unsupported-operator', options);
  }
}

function evaluateBinary(node: jsep.BinaryExpression, options: EvaluationWalkOptions): EvalResult {
  const { operator } = node;
  const left = evaluateNode(node.left, options);
  const right = evaluateNode(node.right, options);

  if (AND_OPERATORS.has(operator)) return evaluateAnd(left, right);
  if (OR_OPERATORS.has(operator)) return evaluateOr(left, right);

  // Comparison operators cannot answer anything about an unresolved operand.
  if (isUnresolved(left) || isUnresolved(right)) return UNRESOLVED;

  // Strict, type-sensitive equality — matching Okta's case-sensitive comparison
  // and the behaviour this module has always had.
  if (EQUALITY_OPERATORS.has(operator)) return left === right;
  if (INEQUALITY_OPERATORS.has(operator)) return left !== right;
  if (RELATIONAL_OPERATORS.has(operator)) {
    return evaluateRelational(operator, left, right, options);
  }

  return giveUpLogged('unsupported-operator', options);
}

/**
 * Answer one `isMemberOf*` call against the supplied group list.
 *
 * Returns {@link UNRESOLVED} only for reasons that are genuinely unknowable here
 * — no group list, the regex variant, a bad arity, or a non-string argument.
 * Otherwise the answer is definite in both directions: finding no matching group
 * is `false`, which is sound precisely because {@link RuleGroupContext} is
 * documented to be the user's complete membership set.
 */
function evaluateGroupMembershipCall(
  node: jsep.CallExpression,
  name: string,
  options: EvaluationWalkOptions,
): EvalResult {
  if (name === GROUP_NAME_REGEX_FUNCTION) return giveUpLogged('group-name-regex', options);

  const { groups } = options;
  if (!groups) return giveUpLogged('group-membership-fn', options);

  const fn = GROUP_MEMBERSHIP_IMPLEMENTATIONS.get(name);
  if (!fn) return giveUpLogged('group-membership-fn', options);

  const wrongArity = fn.variadic ? node.arguments.length < 1 : node.arguments.length !== 1;
  if (wrongArity) return giveUpLogged('fn-arity', options);

  const targets: string[] = [];
  for (const argument of node.arguments) {
    const value = evaluateNode(argument, options);
    if (isUnresolved(value)) return UNRESOLVED;
    // Okta names every group by a string literal; anything else is a rule we do
    // not model rather than a membership we can rule out.
    if (typeof value !== 'string') return giveUp('operand-type', options);
    targets.push(value);
  }

  return targets.some((target) => groups.some((group) => fn.matches(group, target)));
}

function evaluateCall(node: jsep.CallExpression, options: EvaluationWalkOptions): EvalResult {
  const name = calleeName(node);
  const fn = name ? SUPPORTED_FUNCTIONS.get(name) : undefined;
  if (!name || !fn) {
    if (name && GROUP_MEMBERSHIP_FUNCTIONS.has(name)) {
      return evaluateGroupMembershipCall(node, name, options);
    }
    return giveUpLogged('unknown-fn', options);
  }
  if (node.arguments.length !== fn.arity) {
    return giveUpLogged('fn-arity', options);
  }

  const args: ExprValue[] = [];
  for (const argument of node.arguments) {
    const value = evaluateNode(argument, options);
    // The argument's own walk has already attributed a reason.
    if (isUnresolved(value)) return UNRESOLVED;
    args.push(value);
  }
  const result = fn.evaluate(args);
  // The only way an allow-listed implementation gives up is an argument type it
  // cannot handle (e.g. `String.startsWith` on a number).
  return isUnresolved(result) ? giveUp('operand-type', options) : result;
}

/** Walk one AST node against the allow-list. Never throws for unsupported input. */
function evaluateNode(node: jsep.Expression, options: EvaluationWalkOptions): EvalResult {
  if (isLiteral(node)) {
    const { value } = node;
    if (value === null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return giveUp('unsupported-node', options); // e.g. a regular-expression literal
  }
  if (isMemberExpression(node)) return resolveMember(node, options);
  if (isCallExpression(node)) return evaluateCall(node, options);
  if (isBinaryExpression(node)) return evaluateBinary(node, options);
  if (isUnaryExpression(node)) {
    if (node.operator !== '!') return giveUp('unsupported-node', options);
    const argument = truthiness(evaluateNode(node.argument, options));
    return isUnresolved(argument) ? UNRESOLVED : !argument;
  }
  // Identifier, Compound, ArrayExpression, ConditionalExpression, ThisExpression,
  // SequenceExpression — none are meaningful group-rule conditions.
  return giveUpLogged('unsupported-node', options);
}

/**
 * Walk an already-parsed AST. Returns {@link UNRESOLVED} for anything outside
 * the allow-list, and never throws.
 *
 * Takes the AST rather than the expression text so callers that also need the
 * {@link canEvaluateAst} gate can parse once and share the tree. **Read-only:**
 * the node may come from {@link parseCache} and be shared with other calls.
 */
function evaluateAst(ast: jsep.Expression, options: EvaluationWalkOptions): EvalResult {
  try {
    return evaluateNode(ast, options);
  } catch {
    // Defensive: a pathologically nested expression can exhaust the stack.
    return giveUpLogged('walk-failed', options);
  }
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
 * every {@link GROUP_MEMBERSHIP_FUNCTIONS} entry **unless** `groups` is supplied),
 * references anything other than a `user.*` profile attribute, or does not reduce
 * to a boolean.
 *
 * @param expression - The rule's condition expression (untrusted Okta data).
 * @param user - The user to evaluate the condition against.
 * @param groups - The user's **complete** group list, enabling the `isMemberOf*`
 *   functions. Omit it rather than passing a partial list — see
 *   {@link RuleGroupContext}.
 * @returns The {@link RuleMatchOutcome}. Pure — no API calls, no code execution.
 */
export function tryEvaluateRuleExpression(
  expression: string,
  user: OktaUser,
  groups?: RuleGroupContext,
): RuleMatchOutcome {
  // Parsed once and shared by both gates below; the AST is walked twice but jsep
  // runs at most once (and not at all on a {@link parseCache} hit).
  const ast = parseExpression(expression);
  if (!ast) return 'unevaluable';

  // Gate 1 — grammar: is every node of the expression on the allow-list?
  if (!canEvaluateAst(ast, { hasGroupContext: groups !== undefined })) return 'unevaluable';

  // Gate 2 — shape, and deliberately INDEPENDENT of gate 1: an expression can
  // be entirely allow-listed and still not be a condition (`user.department`,
  // `"Engineering"`, `String.toUpperCase(user.department)` all pass gate 1). A
  // condition that does not reduce to a boolean is not a condition we
  // understand, whatever it reduced to. Collapsing the two gates would turn
  // those into `no-match`, which membership attribution reads as a manual add.
  const result = evaluateAst(ast, { user, groups });
  if (typeof result !== 'boolean') return 'unevaluable';
  return result ? 'match' : 'no-match';
}

/** Reject a node, attributing a reason code (never node text) to the observer. */
function reject(reason: RuleUnevaluableReason, options: GrammarWalkOptions): false {
  options.onUnsupported?.(reason);
  return false;
}

/** Recursively check a parsed node against the allow-list. */
function isSupportedNode(node: jsep.Expression, options: GrammarWalkOptions = {}): boolean {
  if (isLiteral(node)) {
    const { value } = node;
    const supported =
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean';
    return supported || reject('unsupported-node', options);
  }
  if (isMemberExpression(node)) {
    const supported =
      !node.computed &&
      isIdentifier(node.object) &&
      node.object.name === 'user' &&
      isIdentifier(node.property);
    return supported || reject('unsupported-node', options);
  }
  if (isCallExpression(node)) {
    const name = calleeName(node);
    const fn = name ? SUPPORTED_FUNCTIONS.get(name) : undefined;
    if (!fn) {
      if (!name || !GROUP_MEMBERSHIP_FUNCTIONS.has(name)) return reject('unknown-fn', options);
      // Support for these tracks what the evaluation walk can actually do, so the
      // two never disagree: the regex variant is refused outright, and the rest
      // are supported exactly when a group list will be there to answer them.
      if (name === GROUP_NAME_REGEX_FUNCTION) return reject('group-name-regex', options);
      if (!options.hasGroupContext) return reject('group-membership-fn', options);
      const membershipFn = GROUP_MEMBERSHIP_IMPLEMENTATIONS.get(name);
      if (!membershipFn) return reject('group-membership-fn', options);
      const wrongArity = membershipFn.variadic
        ? node.arguments.length < 1
        : node.arguments.length !== 1;
      if (wrongArity) return reject('fn-arity', options);
      return node.arguments.every((argument) => isSupportedNode(argument, options));
    }
    if (node.arguments.length !== fn.arity) return reject('fn-arity', options);
    // Arrow, not a bare reference: `every` would otherwise pass the index as the
    // options object.
    return node.arguments.every((argument) => isSupportedNode(argument, options));
  }
  if (isUnaryExpression(node)) {
    if (node.operator !== '!') return reject('unsupported-node', options);
    return isSupportedNode(node.argument, options);
  }
  if (isBinaryExpression(node)) {
    if (!SUPPORTED_BINARY_OPERATORS.has(node.operator)) {
      return reject('unsupported-operator', options);
    }
    return isSupportedNode(node.left, options) && isSupportedNode(node.right, options);
  }
  return reject('unsupported-node', options);
}

/**
 * Check an already-parsed AST against the allow-list, defensively.
 *
 * Takes the AST rather than the expression text so {@link tryEvaluateRuleExpression}
 * can share one parse between this gate and {@link evaluateAst}. **Read-only:**
 * the node may come from {@link parseCache} and be shared with other calls.
 */
function canEvaluateAst(ast: jsep.Expression, options: GrammarWalkOptions = {}): boolean {
  try {
    return isSupportedNode(ast, options);
  } catch {
    // Defensive: a pathologically nested expression can exhaust the stack. No
    // reason has been recorded yet — a rejection would have returned instead of
    // recursing further.
    return reject('walk-failed', options);
  }
}

// ---------------------------------------------------------------------------
// AST seam — for callers that need to explain an expression rather than just
// evaluate it. Everything below reuses the ONE memoised parse and the ONE
// allow-list above; none of it parses, and none of it mutates a node.
// ---------------------------------------------------------------------------

/**
 * Outcome of {@link parseRuleExpression}: the shared AST, or why there isn't one.
 *
 * Discriminated on `ok` so the failure reason cannot be read off a success.
 */
export type ParsedRuleExpression =
  | {
      readonly ok: true;
      /**
       * The parsed tree. **Read-only** — it may be the memoised instance shared
       * with every other caller of this module.
       */
      readonly ast: jsep.Expression;
    }
  | {
      readonly ok: false;
      readonly reasonCode: Extract<RuleUnevaluableReason, 'empty' | 'too-long' | 'parse-error'>;
    };

/**
 * Parse a rule expression through the module's bounded parse memo, reporting
 * *why* it could not be parsed.
 *
 * Delegates to the same private parser {@link tryEvaluateRuleExpression} uses, so
 * a given expression is handed to jsep at most once no matter how many callers
 * ask for it; the reason is classified afterwards from the input, not by a second
 * parse attempt.
 *
 * @param expression - The rule's condition expression (untrusted Okta data).
 * @returns The shared AST, or a {@link RuleUnevaluableReason} for the failure.
 */
export function parseRuleExpression(expression: string): ParsedRuleExpression {
  const ast = parseExpression(expression);
  if (ast) return { ok: true, ast };
  if (!expression || !expression.trim()) return { ok: false, reasonCode: 'empty' };
  if (expression.length > MAX_EXPRESSION_LENGTH) return { ok: false, reasonCode: 'too-long' };
  return { ok: false, reasonCode: 'parse-error' };
}

/** Whether a node is on the allow-list, and if not, which rule rejected it. */
export type RuleNodeSupport =
  | { readonly supported: true }
  | { readonly supported: false; readonly reasonCode: RuleUnevaluableReason };

/**
 * Grammar-gate one already-parsed node, surfacing the reason code the walk would
 * otherwise only have written to a debug line.
 *
 * This is the same allow-list walk {@link tryEvaluateRuleExpression} applies as
 * its grammar gate, exposed so it can be run against a sub-tree instead of a
 * whole expression — a clause-level explainer therefore cannot drift from what
 * the evaluator will actually answer. Pair it with {@link parseRuleExpression} to
 * gate an expression from text.
 *
 * @param node - A node from {@link parseRuleExpression}. Treated as read-only.
 * @param options - Set `hasGroupContext` when a {@link RuleGroupContext} will be
 *   supplied at evaluation time, so the `isMemberOf*` calls this gate would
 *   otherwise reject are recognised as answerable.
 * @returns Supported, or the **first** reason the walk rejected it.
 */
export function checkRuleNodeSupport(
  node: jsep.Expression,
  options: { readonly hasGroupContext?: boolean } = {},
): RuleNodeSupport {
  let reasonCode: RuleUnevaluableReason | undefined;
  const supported = canEvaluateAst(node, {
    hasGroupContext: options.hasGroupContext,
    onUnsupported: (reason) => {
      reasonCode ??= reason;
    },
  });
  return supported
    ? { supported: true }
    : { supported: false, reasonCode: reasonCode ?? 'walk-failed' };
}

/** A node's resolved value, or why the three-valued walk could not resolve it. */
export type RuleNodeEvaluation =
  | { readonly resolved: true; readonly value: RuleExprValue }
  | { readonly resolved: false; readonly reasonCode: RuleUnevaluableReason };

/**
 * Evaluate one already-parsed node against a user, surfacing {@link UNRESOLVED}
 * as a reason code instead of silently collapsing it.
 *
 * The `resolved: false` case is the {@link UNRESOLVED} sentinel — the module's
 * existing, Kleene-aware "cannot determine" mechanism — reported rather than
 * discarded. A caller must **never** present it as "did not match".
 *
 * @param node - A node from {@link parseRuleExpression}. Treated as read-only.
 * @param options - {@link RuleEvaluationOptions}; the seam for future context.
 * @returns The resolved value (**PII**: render, never log) or a reason code.
 */
export function evaluateRuleNode(
  node: jsep.Expression,
  options: RuleEvaluationOptions,
): RuleNodeEvaluation {
  let reasonCode: RuleUnevaluableReason | undefined;
  const result = evaluateAst(node, {
    ...options,
    onUnresolved: (reason) => {
      reasonCode ??= reason;
    },
  });
  return isUnresolved(result)
    ? { resolved: false, reasonCode: reasonCode ?? 'operand-type' }
    : { resolved: true, value: result };
}

/**
 * {@link RuleMatchOutcome} plus the reason behind an `unevaluable` answer.
 *
 * The companion payload type: `RuleMatchOutcome` stays a bare 3-string union
 * (it is pinned by many callers and tests), and this discriminated union carries
 * the detail alongside it. `reasonCode` is reachable **only** on the
 * `unevaluable` arm, so no caller can read a reason off a real match.
 */
export type RuleMatchResult =
  | { readonly outcome: 'match' }
  | { readonly outcome: 'no-match' }
  | { readonly outcome: 'unevaluable'; readonly reasonCode: RuleUnevaluableReason };

/**
 * Evaluate an already-parsed rule condition, with the reason for an
 * `unevaluable` answer.
 *
 * Applies the same two **independent** gates as {@link tryEvaluateRuleExpression}:
 * the grammar gate, then the "did it reduce to a boolean?" gate. They stay
 * separate on purpose — `user.department`, `"Engineering"` and
 * `String.toUpperCase(user.department)` are all fully allow-listed yet are not
 * conditions, and collapsing the gates would report them as `no-match`.
 *
 * @param ast - A node from {@link parseRuleExpression}. Treated as read-only.
 * @param options - {@link RuleEvaluationOptions}.
 * @returns A {@link RuleMatchResult}; `no-match` only when fully understood.
 */
export function evaluateParsedRule(
  ast: jsep.Expression,
  options: RuleEvaluationOptions,
): RuleMatchResult {
  // The gate must be told what the walk will have: with a group list in hand the
  // `isMemberOf*` calls it would otherwise reject are answerable.
  const support = checkRuleNodeSupport(ast, { hasGroupContext: options.groups !== undefined });
  if (!support.supported) return { outcome: 'unevaluable', reasonCode: support.reasonCode };

  const evaluation = evaluateRuleNode(ast, options);
  if (!evaluation.resolved) {
    return { outcome: 'unevaluable', reasonCode: evaluation.reasonCode };
  }
  if (typeof evaluation.value !== 'boolean') {
    return { outcome: 'unevaluable', reasonCode: 'not-a-boolean' };
  }
  return { outcome: evaluation.value ? 'match' : 'no-match' };
}

/**
 * {@link tryEvaluateRuleExpression} with the reason code attached.
 *
 * Returns exactly the same outcome as `tryEvaluateRuleExpression` for every
 * input — a test table pins that agreement — and adds the payload the UI needs
 * to say *why* it cannot tell ("needs group context") rather than a bare
 * "cannot evaluate". Like that function it will **never** answer `no-match` for
 * an expression it merely failed to understand.
 *
 * @param expression - The rule's condition expression (untrusted Okta data).
 * @param user - The user to evaluate the condition against.
 * @param groups - The user's **complete** group list, enabling the `isMemberOf*`
 *   functions. Omit it rather than passing a partial list — see
 *   {@link RuleGroupContext}.
 * @returns A {@link RuleMatchResult}. Pure — no API calls, no code execution.
 */
export function tryEvaluateRuleExpressionDetailed(
  expression: string,
  user: OktaUser,
  groups?: RuleGroupContext,
): RuleMatchResult {
  const parsed = parseRuleExpression(expression);
  if (!parsed.ok) return { outcome: 'unevaluable', reasonCode: parsed.reasonCode };
  return evaluateParsedRule(parsed.ast, { user, groups });
}
