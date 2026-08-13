/**
 * @module shared/rules/explainExpression
 * @description Clause-level explanation of an Okta group-rule condition against a
 * user — "why isn't this person in that group?" answered per clause instead of
 * with a bare "no match".
 *
 * For `user.department == "Engineering" && user.title != "Intern"` this produces
 * one row per clause: department **pass** (resolved `"Engineering"`) and title
 * **fail** (resolved `"Intern"`), plus a summary the UI can render as
 * _"3 of 4 clauses evaluated, 1 needs group context"_.
 *
 * ## It never guesses
 *
 * A clause is `fail` **only** when the evaluator resolved it to boolean `false`.
 * Anything it could not resolve — a group-membership call, an unsupported
 * operator, an ungrammatical fragment, a type mismatch — is `not-evaluated` with
 * a {@link RuleUnevaluableReason}, never `fail`. Presenting "couldn't parse" as
 * "didn't match" would be a worse bug than the one this module fixes: an
 * administrator acts on these answers.
 *
 * ## Nothing is short-circuited
 *
 * Every clause is evaluated on its own merits, so the right-hand side of an `&&`
 * whose left side already failed is still reported honestly as `pass` or `fail`.
 * That is not a departure from the engine: `ruleEvaluator`'s Kleene
 * `evaluateAnd`/`evaluateOr` are *eager* by construction — they must evaluate
 * both operands to know that `unresolvable && false` is `false` — so no clause is
 * ever skipped, and `not-evaluated` always means "could not resolve", never
 * "did not need to". The whole-expression verdict in
 * {@link RuleExplanationSummary.result} is the Kleene answer and stays
 * authoritative: with `||`, a single failing clause does not mean "no match".
 *
 * ## One parse, one allow-list
 *
 * This module imports `jsep` **for types only** — it cannot parse. It reuses
 * `ruleEvaluator`'s memoised parse ({@link parseRuleExpression}) and its
 * allow-list walks ({@link checkRuleNodeSupport}, {@link evaluateRuleNode}), so
 * the explanation can never disagree with the evaluation the rest of the app
 * acts on, and no second parser exists to drift.
 *
 * ## Security
 *
 * `expressionText` and `resolvedValue` are **untrusted, end-user-controllable
 * tenant data** (rule text and Okta profile attributes):
 *
 * - Render them through React's escaping. Never `dangerouslySetInnerHTML`, never
 *   a hand-built HTML string.
 * - **Never log them.** Only reason codes are safe to log — this module logs
 *   nothing at all.
 * - Any export path must send every cell through `csvUtils.escapeCSV` (RFC 4180
 *   quoting plus the spreadsheet-formula-injection guard); a rule expression
 *   beginning `=` is exactly the payload that guard exists for.
 *
 * @see {@link explainRuleExpression}
 */

import type jsep from 'jsep';
import {
  RULE_CONNECTIVE_OPERATORS,
  checkRuleNodeSupport,
  evaluateParsedRule,
  evaluateRuleNode,
  parseRuleExpression,
  type RuleExprValue,
  type RuleGroupContext,
  type RuleGroupContextEntry,
  type RuleMatchResult,
  type RuleUnevaluableReason,
} from '../ruleEvaluator';
import type { OktaUser } from '../types';

/**
 * Default cap on the number of clause rows returned.
 *
 * Rule conditions are untrusted input capped at 4096 characters, which still
 * leaves room for hundreds of `&&`-joined clauses; a UI list — and the walk that
 * builds it — is bounded rather than trusting the tenant to be reasonable. Real
 * conditions are far smaller.
 */
export const DEFAULT_MAX_CLAUSES = 64;

/** Outcome of a single clause. `fail` means "resolved to false", nothing else. */
export type ClauseStatus = 'pass' | 'fail' | 'not-evaluated';

/** How an `isMemberOf*` argument identifies the group it asks about. */
export type ClauseGroupMatch = 'id' | 'name' | 'nameStartsWith' | 'nameContains';

/**
 * One group an `isMemberOf*` clause asks about, and whether the user is in it.
 *
 * Carried structurally rather than left for the UI to re-parse out of
 * `expressionText`: the arguments are read straight off the AST the clause was
 * explained from, so a name containing a bracket or a comma cannot be
 * mis-recovered. This is what lets a caller say "they would need to be in
 * <group>" instead of "a clause failed".
 */
export interface ClauseGroupReference {
  /** Which field of the user's groups this argument is matched against. */
  readonly match: ClauseGroupMatch;
  /** The rule's literal — a group id, a full name, or a prefix/substring. **Untrusted.** */
  readonly value: string;
  /** Whether any of the user's groups satisfies this argument. */
  readonly satisfied: boolean;
  /**
   * The name of the user's group that satisfied it, when one did. Absent for an
   * unsatisfied reference — there is no group to name — and for a clause
   * explained without a group list. **Untrusted.**
   */
  readonly matchedGroupName?: string;
}

/** One clause of a rule condition, explained against one user. */
export interface ClauseExplanation {
  /**
   * The clause, reconstructed from the AST. Whitespace and redundant parentheses
   * are normalised, so this is equivalent to — not byte-identical with — the
   * tenant's original text. **Untrusted:** render escaped, never log.
   */
  readonly expressionText: string;
  /**
   * The value that drove the outcome: the clause's left-most non-literal operand,
   * resolved against the user's profile (`user.department` → `"Engineering"`).
   *
   * `undefined` when no operand resolved (a group-membership call takes only
   * literals, for instance); `null` when the attribute resolved to Okta's null —
   * the two are deliberately distinct. **PII:** render escaped, never log, and
   * escape it for CSV export.
   */
  readonly resolvedValue: RuleExprValue | undefined;
  /** Whether the clause passed, failed, or could not be resolved. */
  readonly status: ClauseStatus;
  /** Present exactly when `status` is `not-evaluated`: why the evaluator gave up. */
  readonly reasonCode?: RuleUnevaluableReason;
  /**
   * Present only for an `isMemberOf*` clause explained **with** a group list:
   * the groups it asks about, and whether the user is in each.
   *
   * Absent without a list, because `satisfied` would then mean "not known to be
   * satisfied" while reading as a definite `false`. A *failing* clause carrying
   * these is the "they would need to be in X" case; a passing one names the
   * group that already qualifies them.
   */
  readonly groupReferences?: readonly ClauseGroupReference[];
}

/** Per-rule counts the UI renders above the clause list. */
export interface RuleExplanationSummary {
  /** Clause rows returned. Equals `clauses.length`. */
  readonly totalClauses: number;
  /** Rows with a real verdict (`pass` + `fail`) — the "3 of 4 clauses evaluated". */
  readonly evaluatedClauses: number;
  /** Rows that resolved to `true`. */
  readonly passedClauses: number;
  /** Rows that resolved to `false`. */
  readonly failedClauses: number;
  /** Rows the evaluator could not resolve. Never counted as failures. */
  readonly notEvaluatedClauses: number;
  /**
   * Rows blocked specifically on `isMemberOf*` for want of a group list — the
   * "1 needs group context" of the summary line.
   *
   * Always `0` once {@link ExplainRuleOptions.groups} is supplied: those clauses
   * then carry a real verdict. It does **not** count the `group-name-regex`
   * rows, which are unevaluated for a different reason and would not be fixed by
   * any group list.
   */
  readonly needsGroupContext: number;
  /**
   * The whole-expression verdict, from the same engine every other consumer uses
   * (three-valued, so it is **not** derivable by counting the rows above — an
   * `||` can match with most of its clauses failing).
   */
  readonly result: RuleMatchResult;
  /** Whether clauses were dropped at the `maxClauses` cap (counts describe the rows returned). */
  readonly truncated: boolean;
}

/** A rule condition explained against one user: the clause rows plus their summary. */
export interface RuleExplanation {
  /** One row per clause, in source order. Empty when the expression never parsed. */
  readonly clauses: readonly ClauseExplanation[];
  /** Per-rule counts and the authoritative whole-expression verdict. */
  readonly summary: RuleExplanationSummary;
}

/**
 * Options for {@link explainRuleExpression}.
 *
 * An object rather than positional arguments: the deferred group-membership work
 * threads the user's resolved group list through the evaluator, and this is where
 * it arrives — one additive field, no signature rewrite.
 */
export interface ExplainRuleOptions {
  /** Cap on clause rows. Defaults to {@link DEFAULT_MAX_CLAUSES}; values below 1 are ignored. */
  readonly maxClauses?: number;
  /**
   * The user's **complete** group list, which turns every `isMemberOf*` clause
   * from `not-evaluated` / `group-membership-fn` into a real `pass` or `fail`.
   *
   * Omit it rather than passing a partial list: absent, those clauses stay
   * honestly unevaluated, whereas a subset would report groups the user *is* in
   * as clauses they failed. See {@link RuleGroupContext}.
   *
   * `isMemberOfGroupNameRegex` stays unevaluated either way, under its own
   * `group-name-regex` reason — the evaluator declines to run tenant-authored
   * patterns.
   */
  readonly groups?: RuleGroupContext;
}

// ---------------------------------------------------------------------------
// Node narrowing. jsep's `Expression` carries an index signature, so each node
// shape is narrowed explicitly. (`ruleEvaluator` keeps its own module-private
// copies; these are the unparser's, and are intentionally not part of the seam.)
// ---------------------------------------------------------------------------

function asLiteral(node: jsep.Expression): jsep.Literal | undefined {
  return node.type === 'Literal' ? (node as jsep.Literal) : undefined;
}

function asIdentifier(node: jsep.Expression): jsep.Identifier | undefined {
  return node.type === 'Identifier' ? (node as jsep.Identifier) : undefined;
}

function asMemberExpression(node: jsep.Expression): jsep.MemberExpression | undefined {
  return node.type === 'MemberExpression' ? (node as jsep.MemberExpression) : undefined;
}

function asCallExpression(node: jsep.Expression): jsep.CallExpression | undefined {
  return node.type === 'CallExpression' ? (node as jsep.CallExpression) : undefined;
}

function asUnaryExpression(node: jsep.Expression): jsep.UnaryExpression | undefined {
  return node.type === 'UnaryExpression' ? (node as jsep.UnaryExpression) : undefined;
}

function asBinaryExpression(node: jsep.Expression): jsep.BinaryExpression | undefined {
  return node.type === 'BinaryExpression' ? (node as jsep.BinaryExpression) : undefined;
}

function asCompound(node: jsep.Expression): jsep.Compound | undefined {
  return node.type === 'Compound' ? (node as jsep.Compound) : undefined;
}

function asArrayExpression(node: jsep.Expression): jsep.ArrayExpression | undefined {
  return node.type === 'ArrayExpression' ? (node as jsep.ArrayExpression) : undefined;
}

function asConditionalExpression(node: jsep.Expression): jsep.ConditionalExpression | undefined {
  return node.type === 'ConditionalExpression' ? (node as jsep.ConditionalExpression) : undefined;
}

/** Placeholder for a node shape the unparser does not model. Plain text, never markup. */
const UNPRINTABLE_NODE = '[unsupported expression]';

/**
 * Reconstruct a node's source text.
 *
 * jsep records no source offsets, so clause text is unparsed from the AST rather
 * than sliced out of the original string. Output is plain text — it is rendered
 * through React's escaping, never as HTML.
 */
function stringifyNode(node: jsep.Expression): string {
  const literal = asLiteral(node);
  // `raw` preserves the tenant's own quoting; `value` is the fallback for any
  // node a jsep plugin might add without one.
  if (literal) return typeof literal.raw === 'string' ? literal.raw : String(literal.value);

  const identifier = asIdentifier(node);
  if (identifier) return identifier.name;

  const member = asMemberExpression(node);
  if (member) {
    const object = stringifyNode(member.object);
    return member.computed
      ? `${object}[${stringifyNode(member.property)}]`
      : `${object}.${stringifyNode(member.property)}`;
  }

  const call = asCallExpression(node);
  if (call) {
    const args = call.arguments.map(stringifyNode).join(', ');
    return `${stringifyNode(call.callee)}(${args})`;
  }

  const unary = asUnaryExpression(node);
  if (unary) return `${unary.operator}${stringifyOperand(unary.argument)}`;

  const binary = asBinaryExpression(node);
  if (binary) {
    return `${stringifyOperand(binary.left)} ${binary.operator} ${stringifyOperand(binary.right)}`;
  }

  const compound = asCompound(node);
  if (compound) return compound.body.map(stringifyNode).join(' ');

  const array = asArrayExpression(node);
  if (array) {
    return `[${array.elements.map((el) => (el ? stringifyNode(el) : '')).join(', ')}]`;
  }

  const conditional = asConditionalExpression(node);
  if (conditional) {
    return `${stringifyOperand(conditional.test)} ? ${stringifyOperand(conditional.consequent)} : ${stringifyOperand(conditional.alternate)}`;
  }

  if (node.type === 'ThisExpression') return 'this';
  return UNPRINTABLE_NODE;
}

/** {@link stringifyNode}, parenthesising a nested binary so precedence stays visible. */
function stringifyOperand(node: jsep.Expression): string {
  const text = stringifyNode(node);
  return asBinaryExpression(node) ? `(${text})` : text;
}

// ---------------------------------------------------------------------------
// Clause decomposition
// ---------------------------------------------------------------------------

/** Mutable accumulator for {@link collectClauseNodes}. */
interface ClauseCollection {
  readonly nodes: jsep.Expression[];
  truncated: boolean;
}

/**
 * Split a condition into clauses by descending through boolean connectives only.
 *
 * `a && (b || c)` yields three clauses; `!(a && b)` yields one, because the
 * negation applies to the *combination* and reporting its parts separately would
 * invert their meaning. Parentheses leave no node in jsep's AST, so grouping is
 * already normalised away by the time we get here.
 */
function collectClauseNodes(
  node: jsep.Expression,
  collection: ClauseCollection,
  limit: number,
): void {
  const binary = asBinaryExpression(node);
  if (binary && RULE_CONNECTIVE_OPERATORS.has(binary.operator)) {
    collectClauseNodes(binary.left, collection, limit);
    collectClauseNodes(binary.right, collection, limit);
    return;
  }
  if (collection.nodes.length >= limit) {
    collection.truncated = true;
    return;
  }
  collection.nodes.push(node);
}

/**
 * The sub-expressions a clause compares, in source order — the candidates for
 * {@link ClauseExplanation.resolvedValue}. A clause that is itself an operand
 * (a bare `user.active`) is its own candidate; a negation looks *through* itself,
 * so `!(user.department == "Sales")` still offers the department, not the `false`
 * it inverted.
 */
function operandsOf(node: jsep.Expression): readonly jsep.Expression[] {
  const binary = asBinaryExpression(node);
  if (binary) return [binary.left, binary.right];

  const unary = asUnaryExpression(node);
  if (unary) return operandsOf(unary.argument);

  const call = asCallExpression(node);
  if (call) return call.arguments;

  return [node];
}

/**
 * Resolve the value that drove a clause: its left-most non-literal operand.
 *
 * Literals are skipped because echoing `"Engineering"` back at the admin says
 * nothing — the useful half of `user.department == "Engineering"` is what the
 * *profile* held. Computed even for clauses the grammar gate rejects: knowing
 * the department was `"Engineering"` is useful next to a clause that could not
 * be evaluated for an unrelated reason.
 */
function resolveClauseValue(node: jsep.Expression, user: OktaUser): RuleExprValue | undefined {
  for (const operand of operandsOf(node)) {
    if (asLiteral(operand)) continue;
    const evaluation = evaluateRuleNode(operand, { user });
    if (evaluation.resolved) return evaluation.value;
  }
  return undefined;
}

/** `isMemberOf*` function → the group field its arguments are matched against. */
const GROUP_MATCH_BY_FUNCTION = new Map<string, ClauseGroupMatch>([
  ['isMemberOfGroup', 'id'],
  ['isMemberOfAnyGroup', 'id'],
  ['isMemberOfGroupName', 'name'],
  ['isMemberOfAnyGroupName', 'name'],
  ['isMemberOfGroupNameStartsWith', 'nameStartsWith'],
  ['isMemberOfGroupNameContains', 'nameContains'],
  // `isMemberOfGroupNameRegex` is absent on purpose: the evaluator declines to
  // run tenant-authored patterns, so listing its groups would imply a check that
  // never happened.
]);

/** Which of the user's groups satisfies one reference, if any. */
function findMatchingGroup(
  match: ClauseGroupMatch,
  value: string,
  groups: RuleGroupContext,
): RuleGroupContextEntry | undefined {
  return groups.find((group) => {
    switch (match) {
      case 'id':
        return group.id === value;
      case 'name':
        return group.name === value;
      case 'nameStartsWith':
        return group.name.startsWith(value);
      case 'nameContains':
        return group.name.includes(value);
    }
  });
}

/**
 * The groups an `isMemberOf*` clause asks about, read off the AST — or
 * `undefined` when the clause is not one of those calls.
 *
 * Returns `undefined` rather than a partial list for any argument that is not a
 * string literal: naming the wrong group is worse than naming none.
 */
function groupReferencesOf(
  node: jsep.Expression,
  groups: RuleGroupContext | undefined,
): readonly ClauseGroupReference[] | undefined {
  // Without a group list there is no `satisfied` to report — only "not known to
  // be satisfied", which reads identically and is not the same fact. The clause
  // is `not-evaluated` in that case anyway, so there is nothing to act on.
  if (!groups) return undefined;

  const call = asCallExpression(node);
  if (!call) return undefined;
  const match = GROUP_MATCH_BY_FUNCTION.get(asIdentifier(call.callee)?.name ?? '');
  if (!match) return undefined;

  const references: ClauseGroupReference[] = [];
  for (const argument of call.arguments) {
    const value = asLiteral(argument)?.value;
    if (typeof value !== 'string') return undefined;
    const matched = findMatchingGroup(match, value, groups);
    references.push({
      match,
      value,
      satisfied: matched !== undefined,
      ...(matched ? { matchedGroupName: matched.name } : {}),
    });
  }
  return references.length > 0 ? references : undefined;
}

/**
 * Explain one clause: grammar gate first, then evaluation, then the
 * "is it actually a condition?" gate.
 *
 * The two gates stay **independent**, exactly as in `ruleEvaluator`: a clause can
 * be entirely allow-listed and still not be a condition (`user.department`,
 * `"Engineering"`, `String.toUpperCase(user.department)`). Collapsing them would
 * turn those into `fail`.
 */
function explainClause(
  node: jsep.Expression,
  user: OktaUser,
  groups: RuleGroupContext | undefined,
): ClauseExplanation {
  const expressionText = stringifyNode(node);
  const resolvedValue = resolveClauseValue(node, user);
  // Attached to every outcome, including the unevaluated ones: naming the groups
  // a clause asks about is useful even when we could not answer it.
  const groupReferences = groupReferencesOf(node, groups);
  const base = { expressionText, resolvedValue, ...(groupReferences ? { groupReferences } : {}) };

  const support = checkRuleNodeSupport(node, { hasGroupContext: groups !== undefined });
  if (!support.supported) {
    return { ...base, status: 'not-evaluated', reasonCode: support.reasonCode };
  }

  const evaluation = evaluateRuleNode(node, { user, groups });
  if (!evaluation.resolved) {
    return { ...base, status: 'not-evaluated', reasonCode: evaluation.reasonCode };
  }
  if (typeof evaluation.value !== 'boolean') {
    return { ...base, status: 'not-evaluated', reasonCode: 'not-a-boolean' };
  }

  return { ...base, status: evaluation.value ? 'pass' : 'fail' };
}

/** Tally the clause rows into the summary the UI renders above them. */
function summarise(
  clauses: readonly ClauseExplanation[],
  result: RuleMatchResult,
  truncated: boolean,
): RuleExplanationSummary {
  let passedClauses = 0;
  let failedClauses = 0;
  let notEvaluatedClauses = 0;
  let needsGroupContext = 0;

  for (const clause of clauses) {
    if (clause.status === 'pass') passedClauses += 1;
    else if (clause.status === 'fail') failedClauses += 1;
    else {
      notEvaluatedClauses += 1;
      if (clause.reasonCode === 'group-membership-fn') needsGroupContext += 1;
    }
  }

  return {
    totalClauses: clauses.length,
    evaluatedClauses: passedClauses + failedClauses,
    passedClauses,
    failedClauses,
    notEvaluatedClauses,
    needsGroupContext,
    result,
    truncated,
  };
}

/** An explanation with no clause rows — the expression never became an AST. */
function unparsedExplanation(reasonCode: RuleUnevaluableReason): RuleExplanation {
  return {
    clauses: [],
    summary: summarise([], { outcome: 'unevaluable', reasonCode }, false),
  };
}

/** Clamp the caller's cap; anything not a positive number falls back to the default. */
function clauseLimit(maxClauses: number | undefined): number {
  if (maxClauses === undefined || !Number.isFinite(maxClauses) || maxClauses < 1) {
    return DEFAULT_MAX_CLAUSES;
  }
  return Math.floor(maxClauses);
}

/**
 * Explain a group-rule condition against a user, clause by clause.
 *
 * Pure and offline: no API calls, no code execution, no logging. The expression
 * is parsed once through `ruleEvaluator`'s memo and every clause is judged by the
 * same allow-list the rest of the app evaluates with, so an explanation can never
 * contradict the membership answer shown beside it.
 *
 * A clause is `fail` **only** when it resolved to boolean `false`; everything the
 * evaluator could not resolve is `not-evaluated` with a
 * {@link RuleUnevaluableReason}. Clauses are not short-circuited — each is
 * reported on its own merits — while
 * {@link RuleExplanationSummary.result} carries the authoritative three-valued
 * verdict for the expression as a whole.
 *
 * @param expression - The rule's condition expression (untrusted Okta data).
 * @param user - The user to explain the condition against.
 * @param options - {@link ExplainRuleOptions}; also the seam for future context.
 * @returns Clause rows plus a {@link RuleExplanationSummary}. Both
 *   `expressionText` and `resolvedValue` are untrusted/PII: render them escaped,
 *   never log them, and run them through `csvUtils.escapeCSV` before export.
 *
 * @example
 * const { clauses, summary } = explainRuleExpression(
 *   'user.department == "Engineering" && user.title != "Intern"',
 *   user,
 * );
 * // clauses[0] → { expressionText: 'user.department == "Engineering"',
 * //                resolvedValue: 'Engineering', status: 'pass' }
 * // summary    → { evaluatedClauses: 2, failedClauses: 1, … }
 */
export function explainRuleExpression(
  expression: string,
  user: OktaUser,
  options?: ExplainRuleOptions,
): RuleExplanation {
  const parsed = parseRuleExpression(expression);
  if (!parsed.ok) return unparsedExplanation(parsed.reasonCode);

  try {
    const collection: ClauseCollection = { nodes: [], truncated: false };
    collectClauseNodes(parsed.ast, collection, clauseLimit(options?.maxClauses));
    const groups = options?.groups;
    const clauses = collection.nodes.map((node) => explainClause(node, user, groups));
    return {
      clauses,
      summary: summarise(
        clauses,
        evaluateParsedRule(parsed.ast, { user, groups }),
        collection.truncated,
      ),
    };
  } catch {
    // Defensive, mirroring the evaluator: a pathologically nested expression can
    // exhaust the stack. Degrade to "cannot tell", never to a verdict.
    return unparsedExplanation('walk-failed');
  }
}
