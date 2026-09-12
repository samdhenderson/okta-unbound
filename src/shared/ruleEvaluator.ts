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
 * `isMemberOfAnyGroup*`, `…NameStartsWith`, `…NameContains`, `…NameRegex`) are
 * answered only against a caller-supplied group list — see
 * {@link GROUP_MEMBERSHIP_FUNCTIONS} for that seam, including how the regex
 * variant runs its tenant-authored pattern through the linear-time engine in
 * `shared/rules/safeRegex` rather than a `RegExp` (ADR-0002). App-context
 * (`app.*`) expressions cannot be resolved client-side at all.
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
import { compileSafeRegex, matchCompiled, type SafeRegexDeclineReason } from './rules/safeRegex';
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
 * Okta's documentation names `NOT` alongside `AND` and `OR`, but only the binary
 * word forms were ever registered — so `NOT isMemberOfGroup("00g…")` failed to
 * parse and the whole rule came back `parse-error`, indistinguishable from an
 * expression that was genuinely malformed. jsep's own boundary check keeps
 * `user.notes` an attribute rather than a `not` applied to `es`.
 */
const WORD_UNARY_OPERATORS: readonly string[] = ['not', 'NOT'];

for (const operator of WORD_UNARY_OPERATORS) {
  jsep.addUnaryOp(operator);
}

/**
 * Every unary *negation* operator this evaluator understands — symbolic and
 * word forms. Unary minus (`-1`) is handled separately, and only when its
 * argument is a numeric literal (`evaluateNode`/`isSupportedNode`'s own
 * `operator === '-'` branch): it negates a constant rather than negating a
 * boolean, so it does not belong in this set. Anything else (`+`, `~`) is not
 * a group-rule condition and stays unevaluable.
 */
const NEGATION_OPERATORS: ReadonlySet<string> = new Set(['!', ...WORD_UNARY_OPERATORS]);

/**
 * Hard cap on the expression length we will parse at all. Rule expressions are
 * untrusted input and both jsep's parser and this evaluator recurse; the cap
 * bounds the work an adversarial tenant value can cause. Real Okta group-rule
 * conditions are orders of magnitude shorter.
 */
const MAX_EXPRESSION_LENGTH = 4096;

/** A scalar an expression operand can resolve to. */
type ExprScalar = string | number | boolean | null;

/**
 * A value an expression operand can resolve to.
 *
 * Arrays are here because Okta states a group-rule condition may use "String,
 * **Arrays**, and user expressions", and a multi-valued profile attribute is
 * ordinary. Before they were modelled, `resolveMember` sent one through
 * `String(raw)` — so `["a","b"]` became the string `"a,b"` and
 * `user.roles == "a,b"` answered a confident `true`. A wrong answer, not a
 * missing one. Arrays are deliberately **one level deep and scalar-valued**: a
 * nested array is a shape Okta's rule surface does not produce and this module
 * does not guess at.
 */
type ExprValue = ExprScalar | readonly ExprScalar[];

/**
 * A value an expression operand can resolve to — the public alias of the
 * evaluator's internal operand type.
 *
 * Values come from the user's Okta profile, so they are **PII**: rendering them
 * is fine (React escapes), logging them is not, and any export path must send
 * them through `csvUtils.escapeCSV`.
 *
 * A multi-valued attribute resolves to a **real array**, never to a joined
 * string — see {@link ExprValue}. A surface rendering one must format it as a
 * list rather than falling through to `String(value)`, which would print the
 * same text a single comma-containing string prints.
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
 * - `unsupported-operator` — a binary operator outside {@link SUPPORTED_BINARY_OPERATORS},
 *   or a unary minus whose argument is not a numeric literal (`-user.x`, `-(expr)`, `-"a"`).
 * - `group-membership-fn` — a {@link GROUP_MEMBERSHIP_FUNCTIONS} call made without
 *   a {@link RuleGroupContext}; answering it needs the user's full group list.
 * - `group-name-regex` — retired from the emit path by ADR-0002, which replaced the
 *   blanket refusal of `isMemberOfGroupNameRegex` with the linear-time engine in
 *   `shared/rules/safeRegex`. Nothing produces this code any more; it stays in the
 *   union (and in the copy table) until the flat-explanation cleanup lands, so a
 *   stored or in-flight value still renders.
 * - `regex-unsupported-syntax` — `isMemberOfGroupNameRegex` was given a pattern the
 *   safe engine does not implement (lookaround, a backreference, `{n,m}`) or cannot
 *   parse at all. Declined, never approximated.
 * - `regex-too-complex` — the pattern or a group name is past one of the engine's
 *   hard caps (length, state count, step budget), so the check did not run.
 * - `unknown-fn` — a call outside {@link SUPPORTED_FUNCTIONS}.
 * - `fn-arity` — an allow-listed function called with the wrong argument count,
 *   or (for a variadic function like `String.stringSwitch`) trailing arguments
 *   that do not come in complete key/value pairs.
 * - `unsupported-node` — a node shape we do not model (non-`user.*` member
 *   access, a non-string-literal or nested computed key (`user[x]`,
 *   `user["a"]["b"]`), a bare identifier, `this`, a regex literal, a
 *   `Compound`, an array literal, …).
 * - `operand-type` — allow-listed grammar, but an operand's runtime type is
 *   outside what the operator or function accepts (`user.department > "A"`,
 *   `String.startsWith(user.employeeNumber, "4")`, an object-valued attribute).
 * - `attribute-absent` — `user.<attribute>` names something this user's profile
 *   does not carry at all. Distinct from an attribute present and explicitly
 *   `null`: only the second licenses a comparison. Collapsing them is what made
 *   `user.status == "ACTIVE"` answer `no-match` for an entire org (D-114).
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
  | 'regex-unsupported-syntax'
  | 'regex-too-complex'
  | 'unknown-fn'
  | 'fn-arity'
  | 'unsupported-node'
  | 'operand-type'
  | 'attribute-absent'
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

/**
 * A variadic function's argument shape: at least `minArgs` arguments, and every
 * argument from `pairsFrom` on must come in pairs (`(key, value)` slots) — a
 * lone trailing key with no value is a malformed call, not a zero-argument one.
 *
 * `String.stringSwitch(input, defaultString, key1, value1, key2, value2, …)` is
 * the one function this shape exists for: `minArgs: 2` (the input and the
 * required default), `pairsFrom: 2` (everything after those two must pair up).
 */
interface VariadicPairsArity {
  readonly minArgs: number;
  readonly pairsFrom: number;
}

/** An allow-listed Okta EL function: its arity plus a TypeScript implementation. */
interface SupportedFunction {
  /**
   * Exact number of arguments, or a {@link VariadicPairsArity} shape for a
   * function whose trailing arguments come in key/value pairs. Calls outside
   * either shape are unevaluable (`fn-arity`).
   */
  arity: number | VariadicPairsArity;
  /** Pure implementation. Returns {@link UNRESOLVED} for argument types it cannot handle. */
  evaluate: (args: readonly ExprValue[]) => EvalResult;
}

/** Whether `argCount` satisfies a {@link SupportedFunction}'s `arity`. */
function arityMatches(fn: SupportedFunction, argCount: number): boolean {
  if (typeof fn.arity === 'number') return argCount === fn.arity;
  const { minArgs, pairsFrom } = fn.arity;
  return argCount >= minArgs && (argCount - pairsFrom) % 2 === 0;
}

/** Narrow an operand to a string, or give up. Okta EL string functions are string-typed. */
function asString(value: ExprValue | undefined): string | Unresolved {
  return typeof value === 'string' ? value : UNRESOLVED;
}

/** Narrow an operand to an integer, or give up. Index and length arguments are integral. */
function asInteger(value: ExprValue | undefined): number | Unresolved {
  return typeof value === 'number' && Number.isInteger(value) ? value : UNRESOLVED;
}

/** Narrow an operand to an array, or give up. The `Arrays.*` helpers are array-typed. */
function asArray(value: ExprValue | undefined): readonly ExprScalar[] | Unresolved {
  return Array.isArray(value) ? value : UNRESOLVED;
}

/** Apply `fn` to two string operands, giving up unless both really are strings. */
function withTwoStrings(
  args: readonly ExprValue[],
  fn: (a: string, b: string) => EvalResult,
): EvalResult {
  const first = asString(args[0]);
  const second = asString(args[1]);
  if (isUnresolved(first) || isUnresolved(second)) return UNRESOLVED;
  return fn(first, second);
}

/** Apply `fn` to a single string operand, giving up unless it really is a string. */
function withOneString(args: readonly ExprValue[], fn: (a: string) => EvalResult): EvalResult {
  const first = asString(args[0]);
  return isUnresolved(first) ? UNRESOLVED : fn(first);
}

/** Apply `fn` to a single array operand, giving up unless it really is an array. */
function evaluateOverArray(
  args: readonly ExprValue[],
  fn: (items: readonly ExprScalar[]) => ExprValue,
): EvalResult {
  const items = asArray(args[0]);
  return isUnresolved(items) ? UNRESOLVED : fn(items);
}

/**
 * `Arrays.contains(array, value)` — strict membership, no coercion.
 *
 * Strict because the surrounding evaluator's equality is strict: `"1"` and `1`
 * are different values everywhere else in this module, and a helper that
 * quietly coerced would answer `true` where `==` answers `false`.
 */
function evaluateArraysContains(args: readonly ExprValue[]): EvalResult {
  const items = asArray(args[0]);
  if (isUnresolved(items)) return UNRESOLVED;
  const needle = args[1];
  // An array operand has no meaning as a *member* of another array here, and
  // Okta's rule surface does not nest them — so decline rather than compare by
  // reference, which would always be `false`.
  if (Array.isArray(needle) || needle === undefined) return UNRESOLVED;
  return items.some((item) => item === needle);
}

/** `String.join(separator, first, second)` — Okta's three-argument form. */
function evaluateJoin(args: readonly ExprValue[]): EvalResult {
  const separator = asString(args[0]);
  const first = asString(args[1]);
  const second = asString(args[2]);
  if (isUnresolved(separator) || isUnresolved(first) || isUnresolved(second)) return UNRESOLVED;
  return `${first}${separator}${second}`;
}

/** `String.replace(str, target, replacement)` — every occurrence, target literal. */
function evaluateReplace(args: readonly ExprValue[]): EvalResult {
  const source = asString(args[0]);
  const target = asString(args[1]);
  const replacement = asString(args[2]);
  if (isUnresolved(source) || isUnresolved(target) || isUnresolved(replacement)) return UNRESOLVED;
  // `replaceAll` with string arguments is literal — no pattern is compiled, so a
  // tenant-authored target carries no backtracking risk. An empty target would
  // splice the replacement between every character, which is not a substitution
  // anyone writes a rule to mean.
  if (target === '') return UNRESOLVED;
  // `split`/`join` rather than `replaceAll`: the repo's TypeScript lib target
  // predates it, and both are literal — no pattern is compiled either way.
  return source.split(target).join(replacement);
}

/**
 * `String.substring(str, startIndex, endIndex)`.
 *
 * **Out-of-range gives up rather than clamping.** Java's `substring` throws on a
 * bad range, so there is no defined value to report; clamping would invent one,
 * and the invented one feeds a comparison. Declining is the honest answer.
 */
function evaluateSubstring(args: readonly ExprValue[]): EvalResult {
  const source = asString(args[0]);
  const start = asInteger(args[1]);
  const end = asInteger(args[2]);
  if (isUnresolved(source) || isUnresolved(start) || isUnresolved(end)) return UNRESOLVED;
  if (start < 0 || end > source.length || start > end) return UNRESOLVED;
  return source.slice(start, end);
}

/**
 * `String.substringAfter` / `String.substringBefore`, **for the found case only**.
 *
 * When the separator is absent the two functions disagree in the library Okta's
 * expression language is built on — one yields the empty string, the other the
 * whole input — and Okta does not publish which convention it follows. Rather
 * than pick, the not-found case resolves to nothing: a true answer where the
 * separator is present, and a named absence where it is not.
 */
function substringAfter(source: string, separator: string): ExprValue | Unresolved {
  const at = source.indexOf(separator);
  return at === -1 ? UNRESOLVED : source.slice(at + separator.length);
}

/** See {@link substringAfter} — same not-found reasoning, other side of the split. */
function substringBefore(source: string, separator: string): ExprValue | Unresolved {
  const at = source.indexOf(separator);
  return at === -1 ? UNRESOLVED : source.slice(0, at);
}

/**
 * `String.stringSwitch(input, defaultString, key1, value1, key2, value2, …)`.
 *
 * Okta's own documented examples pin every branch, and none of them is
 * equality: `String.stringSwitch("Substrings count", "default", "ring", "value1")`
 * returns `"value1"` because `"Substrings"` **contains** `"ring"` — matching is
 * substring containment, the same discipline `String.stringContains` already
 * uses. Pairs are tried **in the order supplied**, and the first key contained
 * in the input wins even when a later key also matches — Okta's own worked
 * example (`stringSwitch("First match wins", "default", "absent", "value1",
 * "wins", "value2", "match", "value3")` → `"value2"`) picks the pair listed
 * second over a substring match ("match") that occurs later in the key list
 * but is also present in the input. No pair matching falls through to
 * `defaultString` — a required positional argument, not an optional slot — so
 * there is no branch left this function has to guess at. See
 * docs/adr/0003-stringswitch-matched-cases.md.
 */
function evaluateStringSwitch(args: readonly ExprValue[]): EvalResult {
  const input = asString(args[0]);
  const fallback = asString(args[1]);
  if (isUnresolved(input) || isUnresolved(fallback)) return UNRESOLVED;
  for (let i = 2; i + 1 < args.length; i += 2) {
    const key = asString(args[i]);
    const value = asString(args[i + 1]);
    if (isUnresolved(key) || isUnresolved(value)) return UNRESOLVED;
    if (input.includes(key)) return value;
  }
  return fallback;
}

/**
 * The Okta Expression Language functions this evaluator implements, keyed by
 * their fully-qualified name.
 *
 * A function is listed only when its Okta semantics are **unambiguous**, because
 * an approximation produces a confidently wrong answer, which is strictly worse
 * than reporting the expression unevaluable. That bar, not the size of the list,
 * is what this map is defending.
 *
 * ## What is deliberately absent, and why
 *
 * - **`Time.*` and `Convert.*`** — Okta rejects both families inside a group-rule
 *   condition outright, so implementing them would model a rule Okta will not run.
 * - **`Instant` / `DateTime`** — the timezone the org evaluates in is not
 *   something this panel can read, so every answer would be right or wrong by up
 *   to a day depending on a fact we do not have. That is the definition of
 *   ambiguous.
 * - **`String.replaceFirst`** — Java, which Okta's expression language is built
 *   on, takes a **regular expression** as `replaceFirst`'s target. Implementing
 *   it as a literal replace would be wrong for any rule that relies on that.
 *   Implementing it faithfully needs more than `isMemberOfGroupNameRegex` does:
 *   that function only asks a yes/no question, which `shared/rules/safeRegex`
 *   answers without backtracking (ADR-0002), whereas `replaceFirst` needs the
 *   matched *span* — capture and submatch tracking the safe engine deliberately
 *   does not implement. So the function stays unlisted until it does.
 *   `String.replace` is safe by contrast: its target is a literal.
 *
 * ## `Arrays.*` is available, contrary to this map's former comment
 *
 * Okta's documentation states group-rule conditions allow "String, **Arrays**,
 * and user expressions". This map previously asserted the opposite and listed
 * none, so every rule over a multi-valued profile attribute was unevaluable.
 * `Arrays.add` and `Arrays.flatten` remain absent: they *return* collections
 * rather than answering anything, so no group-rule condition ends in one.
 *
 * ## `String.stringSwitch` is supported, contrary to this map's former comment
 *
 * It used to sit in the "deliberately absent" list above on the theory that its
 * no-match behaviour was unpinned. Okta's own published examples say otherwise:
 * matching is substring containment (not equality), pairs are tried in the
 * order supplied, and the fall-through case is a **required** `defaultString`
 * argument, not an optional one — every branch has a documented answer. See
 * {@link evaluateStringSwitch} and docs/adr/0003-stringswitch-matched-cases.md.
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
  ['String.join', { arity: 3, evaluate: (a) => evaluateJoin(a) }],
  [
    'String.removeSpaces',
    { arity: 1, evaluate: (a) => withOneString(a, (s) => s.replace(/ /g, '')) },
  ],
  ['String.replace', { arity: 3, evaluate: (a) => evaluateReplace(a) }],
  ['String.substring', { arity: 3, evaluate: (a) => evaluateSubstring(a) }],
  [
    'String.stringSwitch',
    {
      arity: { minArgs: 2, pairsFrom: 2 },
      evaluate: (a) => evaluateStringSwitch(a),
    },
  ],
  [
    'String.substringAfter',
    { arity: 2, evaluate: (a) => withTwoStrings(a, (s, sep) => substringAfter(s, sep)) },
  ],
  [
    'String.substringBefore',
    { arity: 2, evaluate: (a) => withTwoStrings(a, (s, sep) => substringBefore(s, sep)) },
  ],
  ['Arrays.contains', { arity: 2, evaluate: (a) => evaluateArraysContains(a) }],
  ['Arrays.size', { arity: 1, evaluate: (a) => evaluateOverArray(a, (items) => items.length) }],
  [
    'Arrays.isEmpty',
    { arity: 1, evaluate: (a) => evaluateOverArray(a, (items) => items.length === 0) },
  ],
  [
    'Arrays.toCsvString',
    { arity: 1, evaluate: (a) => evaluateOverArray(a, (items) => items.join(',')) },
  ],
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
 * ## `isMemberOfGroupNameRegex` is answered too, without a `RegExp`
 *
 * It was the one member of this set that stayed unevaluable even with a group
 * list: the pattern is tenant-authored text, and building a `RegExp` from it
 * hands an untrusted author a catastrophic-backtracking lever over the side
 * panel's only thread. ADR-0002 kept that ban and removed the refusal — the
 * pattern is run by `shared/rules/safeRegex`, a hand-written linear-time engine
 * (parser → Thompson NFA → breadth-wise simulation) with hard caps and full-match
 * (Java `matches()`) semantics. Patterns outside its supported subset, and inputs
 * past its caps, are **declined**, surfacing as `regex-unsupported-syntax` or
 * `regex-too-complex` — never as a guessed answer.
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

/**
 * One argument's answer against the user's whole group list: a definite
 * membership verdict, or the reason none could be produced.
 *
 * A decline is **not** a `false`. Only the id/name comparisons can always answer;
 * `isMemberOfGroupNameRegex` runs a tenant pattern through a bounded engine that
 * is entitled to say it has no opinion, and collapsing that into "not a member"
 * is exactly the confident-wrong answer this module exists to avoid.
 */
type GroupArgumentVerdict =
  | { readonly kind: 'answer'; readonly matched: boolean }
  | { readonly kind: 'declined'; readonly reason: RuleUnevaluableReason };

/**
 * How one membership function reads its arguments against the group list.
 *
 * `variadic` distinguishes the `…Any…` forms, which Okta lets take any number of
 * groups, from the single-argument forms. Both require at least one argument, so
 * arity is checked as a minimum rather than an exact count.
 */
interface GroupMembershipFunction {
  /**
   * Whether the user is in a group matching one argument.
   *
   * Takes the **whole list** rather than one group so a function with
   * per-argument setup cost pays it once per evaluation: the regex variant
   * compiles its pattern here, not once per group name.
   */
  readonly matchesAny: (groups: RuleGroupContext, argument: string) => GroupArgumentVerdict;
  /** Whether Okta allows more than one group argument. */
  readonly variadic: boolean;
}

/** A verdict that is definitely known, either way. */
function groupAnswer(matched: boolean): GroupArgumentVerdict {
  return { kind: 'answer', matched };
}

/**
 * The six functions that compare an argument against a field of each group.
 *
 * Every one of them can always answer, because the comparison is a plain string
 * operation over a list documented to be complete.
 */
function byField(
  matches: (group: RuleGroupContextEntry, argument: string) => boolean,
): GroupMembershipFunction['matchesAny'] {
  return (groups, argument) => groupAnswer(groups.some((group) => matches(group, argument)));
}

/**
 * Map a `safeRegex` decline onto this module's vocabulary.
 *
 * The split is fixed by ADR-0002: the two codes that mean "this pattern is not
 * something the engine implements" become `regex-unsupported-syntax`, and the
 * five that mean "the engine stopped rather than spend unbounded work" become
 * `regex-too-complex`. Both are reason **codes**, safe to log; the pattern and
 * the group names are not, and never leave this function.
 */
function regexDeclineReason(reason: SafeRegexDeclineReason): RuleUnevaluableReason {
  return reason === 'unsupported-syntax' || reason === 'parse-error'
    ? 'regex-unsupported-syntax'
    : 'regex-too-complex';
}

/**
 * `isMemberOfGroupNameRegex`, run through the linear-time engine (ADR-0002).
 *
 * The pattern is compiled **once** and then matched against each group name in
 * full (Java `matches()` semantics, as Okta evaluates it server-side).
 *
 * A per-name decline — one group name past the engine's input cap, say — is not
 * allowed to silently drop that group from the list. A definite `true` from any
 * other name still answers `true` (a found match is a found match), but a
 * definite `false` is only claimable when **every** name actually evaluated;
 * otherwise the whole call declines.
 */
function matchesAnyByRegex(groups: RuleGroupContext, pattern: string): GroupArgumentVerdict {
  const program = compileSafeRegex(pattern);
  if (program.kind === 'declined') {
    return { kind: 'declined', reason: regexDeclineReason(program.reason) };
  }
  let declined: RuleUnevaluableReason | undefined;
  for (const group of groups) {
    const result = matchCompiled(program, group.name);
    if (result.kind === 'declined') {
      declined ??= regexDeclineReason(result.reason);
      continue;
    }
    if (result.matched) return groupAnswer(true);
  }
  return declined === undefined ? groupAnswer(false) : { kind: 'declined', reason: declined };
}

/**
 * Name matching is case-sensitive, mirroring Okta's own evaluation: two groups
 * differing only in case are two different groups, and lower-casing here would
 * report a membership the tenant does not have.
 */
const GROUP_MEMBERSHIP_IMPLEMENTATIONS: ReadonlyMap<string, GroupMembershipFunction> = new Map([
  ['isMemberOfGroup', { matchesAny: byField((g, a) => g.id === a), variadic: false }],
  ['isMemberOfAnyGroup', { matchesAny: byField((g, a) => g.id === a), variadic: true }],
  ['isMemberOfGroupName', { matchesAny: byField((g, a) => g.name === a), variadic: false }],
  ['isMemberOfAnyGroupName', { matchesAny: byField((g, a) => g.name === a), variadic: true }],
  [
    'isMemberOfGroupNameStartsWith',
    { matchesAny: byField((g, a) => g.name.startsWith(a)), variadic: false },
  ],
  [
    'isMemberOfGroupNameContains',
    { matchesAny: byField((g, a) => g.name.includes(a)), variadic: false },
  ],
  ['isMemberOfGroupNameRegex', { matchesAny: matchesAnyByRegex, variadic: false }],
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

function isConditionalExpression(node: jsep.Expression): node is jsep.ConditionalExpression {
  return node.type === 'ConditionalExpression';
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

/**
 * Truthiness of a resolved value, propagating {@link UNRESOLVED}.
 *
 * An **array is never a truth value** here. `Boolean([])` is `true` in
 * JavaScript, so an empty multi-valued attribute standing alone in a conjunction
 * would read as satisfied — a confident answer drawn from a language rule Okta
 * does not share. It resolves to nothing instead.
 */
function truthiness(result: EvalResult): boolean | Unresolved {
  if (isUnresolved(result) || Array.isArray(result)) return UNRESOLVED;
  return Boolean(result);
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
 * Top-level `OktaUser` fields a rule may reference as `user.<name>`.
 *
 * Okta's rule conditions do not distinguish "profile attribute" from "user
 * property" in their syntax — `user.status` and `user.department` are written
 * identically — but this extension's `OktaUser` does, keeping the first group
 * beside `profile` rather than inside it. Reading only `profile` therefore made
 * `user.status == "ACTIVE"` resolve `null == "ACTIVE"` → `false` for **every**
 * user in the org: the evaluator stating with confidence that nobody matches a
 * rule that in fact matches everybody (D-114).
 *
 * Listed explicitly rather than derived, so that adding a field to `OktaUser`
 * that Okta does *not* expose to rule conditions cannot silently become
 * addressable from a tenant-authored expression. `managedBy` and `credentials`
 * are deliberately absent: they are objects, not scalars, and `credentials` in
 * particular is adjacent to material that must never reach an expression.
 */
const USER_TOP_LEVEL_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'status',
  'created',
  'activated',
  'statusChanged',
  'lastLogin',
  'lastUpdated',
  'passwordChanged',
]);

/**
 * Narrow one raw attribute value to an operand, or decline.
 *
 * Three outcomes, and the distinction between the first two is the whole point:
 * a scalar resolves; an array resolves as an array (never a joined string); an
 * object resolves to nothing, because `String({})` is `"[object Object]"` and
 * comparing *that* is a confident answer about a value nobody has read.
 */
function asOperand(raw: unknown, options: EvaluationWalkOptions): EvalResult {
  if (raw === null) return null;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
  if (Array.isArray(raw)) {
    const scalars: ExprScalar[] = [];
    for (const item of raw) {
      if (item === null) {
        scalars.push(null);
      } else if (
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean'
      ) {
        scalars.push(item);
      } else {
        // A nested array or object inside a multi-valued attribute is a shape
        // this module does not model. Declining the whole array is right: a
        // partial one would answer `Arrays.size` and `Arrays.contains` about a
        // collection that is not the user's.
        return giveUp('operand-type', options);
      }
    }
    return scalars;
  }
  return giveUp('operand-type', options);
}

/**
 * Read `user.<attribute>`, from the profile or from the user's own top-level
 * fields. Only the single-level `user.*` form is modelled, dotted
 * (`user.department`) or computed with a string-literal key
 * (`user["cost center"]`); `app.*`, `session.*`, a non-literal or nested
 * computed key, and any deeper path are unresolvable.
 *
 * **An absent attribute is not `null`.** A profile that does not carry the name
 * at all resolves to `attribute-absent` — the evaluator failing to understand
 * the expression, which the module header says must never be reported as
 * `no-match`. An attribute the profile *does* carry, explicitly set to `null`,
 * still resolves to `null`: that is a value the org actually holds, and it
 * licenses a comparison.
 */
function resolveMember(node: jsep.MemberExpression, options: EvaluationWalkOptions): EvalResult {
  const { object, property } = node;
  if (!isIdentifier(object) || object.name !== 'user') return giveUp('unsupported-node', options);

  // `user.<name>` is the dotted form; `user["<name>"]` is the computed form with
  // a string-literal key — same attribute, same resolution below. A computed key
  // that is not a string literal (`user[x]`), or nested computed access, is a
  // shape this module does not model.
  let attributeName: string;
  if (node.computed) {
    if (!isLiteral(property) || typeof property.value !== 'string') {
      return giveUp('unsupported-node', options);
    }
    attributeName = property.value;
  } else {
    if (!isIdentifier(property)) return giveUp('unsupported-node', options);
    attributeName = property.name;
  }

  const profile = options.user.profile as Record<string, unknown>;
  // The profile wins over the top-level field of the same name. An org whose
  // schema defines a custom `status` attribute means that one when it writes
  // `user.status`, and Okta resolves the profile first for exactly that reason.
  // `hasOwnProperty.call`, not `in`: a profile attribute is only what this user
  // actually carries, and `in` would find inherited `toString` and answer about
  // a function.
  if (Object.prototype.hasOwnProperty.call(profile, attributeName)) {
    return asOperand(profile[attributeName], options);
  }
  if (USER_TOP_LEVEL_FIELDS.has(attributeName)) {
    const raw = (options.user as unknown as Record<string, unknown>)[attributeName];
    // Present in the type but not on this response — `lastLogin` on a user who
    // has never signed in, say. Absent is absent, whichever half it is missing
    // from.
    if (raw === undefined) return giveUp('attribute-absent', options);
    return asOperand(raw, options);
  }
  return giveUp('attribute-absent', options);
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

  // Nor about an array one. `===` on two arrays is reference equality, which is
  // `false` for every pair this module can construct — a confident "these differ"
  // about values that may well be identical. `Arrays.*` is how a collection is
  // compared; `==` is not.
  if (Array.isArray(left) || Array.isArray(right)) return giveUp('operand-type', options);

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
 * — no group list, a bad arity, a non-string argument, or a tenant pattern the
 * safe regex engine declined. Otherwise the answer is definite in both
 * directions: finding no matching group is `false`, which is sound precisely
 * because {@link RuleGroupContext} is documented to be the user's complete
 * membership set.
 *
 * The arguments of a variadic `…Any…` call are an **eager OR**: one matching
 * argument answers `true` even if another declined, and only an all-false pass
 * in which nothing declined answers `false`.
 */
function evaluateGroupMembershipCall(
  node: jsep.CallExpression,
  name: string,
  options: EvaluationWalkOptions,
): EvalResult {
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

  let declined: RuleUnevaluableReason | undefined;
  for (const target of targets) {
    const verdict = fn.matchesAny(groups, target);
    if (verdict.kind === 'declined') {
      declined ??= verdict.reason;
      continue;
    }
    if (verdict.matched) return true;
  }
  return declined === undefined ? false : giveUpLogged(declined, options);
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
  if (!arityMatches(fn, node.arguments.length)) {
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

/**
 * Whether two resolved values are the *same* value, under the same equality
 * discipline {@link evaluateBinary} applies to `==`.
 *
 * Strict and scalar-only: an array operand is never comparable here, because
 * `===` on two arrays is reference equality — a confident "these differ" about
 * collections that may well be identical. Two array branches are therefore not
 * the same value, which is what keeps {@link evaluateConditional} from claiming
 * an answer it has not established.
 */
function isSameValue(left: ExprValue, right: ExprValue): boolean {
  if (Array.isArray(left) || Array.isArray(right)) return false;
  return left === right;
}

/**
 * Three-valued conditional (`test ? consequent : alternate`).
 *
 * The test goes through the same {@link truthiness} discipline the connectives
 * use — one truthiness for the whole module, and an array is never a truth
 * value — so a resolved test simply selects its branch, and the selected
 * branch's own {@link UNRESOLVED} propagates.
 *
 * **An unresolved test does not automatically poison the conditional.** Both
 * branches are evaluated, and if they resolve to the same value the structure
 * has already determined the answer whatever the test would have said. That is
 * the eager posture {@link evaluateAnd}/{@link evaluateOr} already take —
 * `unresolvable || true` is `true` — applied to the one other place where a
 * sub-expression we cannot read does not actually change the result. Anything
 * else stays unresolved: never a guess.
 */
function evaluateConditional(
  node: jsep.ConditionalExpression,
  options: EvaluationWalkOptions,
): EvalResult {
  const test = truthiness(evaluateNode(node.test, options));
  if (!isUnresolved(test)) {
    return evaluateNode(test ? node.consequent : node.alternate, options);
  }
  const consequent = evaluateNode(node.consequent, options);
  const alternate = evaluateNode(node.alternate, options);
  if (isUnresolved(consequent) || isUnresolved(alternate)) return UNRESOLVED;
  return isSameValue(consequent, alternate) ? consequent : UNRESOLVED;
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
  if (isConditionalExpression(node)) return evaluateConditional(node, options);
  if (isUnaryExpression(node)) {
    if (node.operator === '-') {
      // Unary minus on a numeric literal only — `-1`, `-0.5`. `-user.x`,
      // `-(expr)` and `-"a"` are not group-rule conditions Okta's own syntax
      // produces, so they stay unevaluable under the same reason a foreign
      // binary operator gets rather than the generic `unsupported-node`.
      const { argument } = node;
      if (isLiteral(argument) && typeof argument.value === 'number') {
        return -argument.value;
      }
      return giveUp('unsupported-operator', options);
    }
    if (!NEGATION_OPERATORS.has(node.operator)) return giveUp('unsupported-node', options);
    const argument = truthiness(evaluateNode(node.argument, options));
    return isUnresolved(argument) ? UNRESOLVED : !argument;
  }
  // Identifier, Compound, ArrayExpression, ThisExpression, SequenceExpression —
  // none are meaningful group-rule conditions.
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
    const isUserObject = isIdentifier(node.object) && node.object.name === 'user';
    // Dotted access (`user.department`) needs an identifier property; computed
    // access (`user["cost center"]`) needs a string-literal one — `user[x]` and
    // nested computed access (`user["a"]["b"]`) are not. Both routes resolve
    // through the identical `resolveMember` lookup.
    const supported =
      isUserObject &&
      (node.computed
        ? isLiteral(node.property) && typeof node.property.value === 'string'
        : isIdentifier(node.property));
    return supported || reject('unsupported-node', options);
  }
  if (isCallExpression(node)) {
    const name = calleeName(node);
    const fn = name ? SUPPORTED_FUNCTIONS.get(name) : undefined;
    if (!fn) {
      if (!name || !GROUP_MEMBERSHIP_FUNCTIONS.has(name)) return reject('unknown-fn', options);
      // Support for these tracks what the evaluation walk can actually do, so the
      // two never disagree: all seven, the regex variant included (ADR-0002), are
      // supported exactly when a group list will be there to answer them. Whether
      // a given tenant pattern is inside the safe engine's subset is not a
      // grammar question — that decline surfaces from the evaluation walk.
      if (!options.hasGroupContext) return reject('group-membership-fn', options);
      const membershipFn = GROUP_MEMBERSHIP_IMPLEMENTATIONS.get(name);
      if (!membershipFn) return reject('group-membership-fn', options);
      const wrongArity = membershipFn.variadic
        ? node.arguments.length < 1
        : node.arguments.length !== 1;
      if (wrongArity) return reject('fn-arity', options);
      return node.arguments.every((argument) => isSupportedNode(argument, options));
    }
    if (!arityMatches(fn, node.arguments.length)) return reject('fn-arity', options);
    // Arrow, not a bare reference: `every` would otherwise pass the index as the
    // options object.
    return node.arguments.every((argument) => isSupportedNode(argument, options));
  }
  if (isUnaryExpression(node)) {
    if (node.operator === '-') {
      const supported = isLiteral(node.argument) && typeof node.argument.value === 'number';
      return supported || reject('unsupported-operator', options);
    }
    if (!NEGATION_OPERATORS.has(node.operator)) return reject('unsupported-node', options);
    return isSupportedNode(node.argument, options);
  }
  if (isBinaryExpression(node)) {
    if (!SUPPORTED_BINARY_OPERATORS.has(node.operator)) {
      return reject('unsupported-operator', options);
    }
    return isSupportedNode(node.left, options) && isSupportedNode(node.right, options);
  }
  if (isConditionalExpression(node)) {
    // Okta EL's `test ? a : b`. Supported exactly when all three parts are — the
    // mirror of `evaluateConditional`, which may have to read either branch (and
    // reads both when the test is unresolved).
    return (
      isSupportedNode(node.test, options) &&
      isSupportedNode(node.consequent, options) &&
      isSupportedNode(node.alternate, options)
    );
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
