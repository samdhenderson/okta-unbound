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
 * ## The tree is THE projection
 *
 * {@link RuleExplanation.tree} is the only shape this module hands out: the
 * condition's connective groups nested as written, with one
 * {@link LeafClauseNode} per indivisible clause. A flat `clauses` list sat beside
 * it for one migration and is gone — it could only describe the *top* level, so
 * every consumer that wanted the inside of an `||` had to re-walk a second field
 * (`alternatives`) that existed for no other reason.
 *
 * One walk still feeds everything. The tree, the per-clause verdicts and the
 * {@link RuleExplanationSummary} counts come from the **same** parse, the same
 * per-node evaluations and the same group-reference resolution, memoised per
 * call, so the number above the ledger can never disagree with the nodes under
 * it. The summary keeps counting the condition's **top-level requirements**
 * (conjuncts of the root, a disjunction counted as one), which is what it always
 * counted and what the sentence above the ledger says.
 *
 * ## A clause also says what it asks
 *
 * Beside its text, a recognisable leaf carries a {@link LeafPredicate}: the
 * subject attribute, the transforms wrapped around it, the comparison, and the
 * operand, as **data**. That is what lets the UI state
 * `String.toLowerCase(user.department) == "sales"` as a sentence instead of
 * printing it. Recognition is syntactic, off the same AST nodes the clause is
 * evaluated from, and exact or absent — never approximate.
 *
 * @see {@link explainRuleExpression}
 */

import type jsep from 'jsep';
import {
  RULE_CONJUNCTIVE_OPERATORS,
  RULE_DISJUNCTIVE_OPERATORS,
  RULE_NEGATION_OPERATORS,
  checkRuleNodeSupport,
  evaluateParsedRule,
  evaluateRuleNode,
  parseRuleExpression,
  type RuleExprValue,
  type RuleGroupContext,
  type RuleGroupContextEntry,
  type RuleMatchResult,
  type RuleNodeEvaluation,
  type RuleUnevaluableReason,
} from '../ruleEvaluator';
import { compileSafeRegex, matchCompiled } from './safeRegex';
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

/**
 * How an `isMemberOf*` argument identifies the group it asks about.
 *
 * `nameRegex` is the tenant-authored pattern of `isMemberOfGroupNameRegex`,
 * evaluated by `shared/rules/safeRegex` (ADR-0002) with full-match semantics.
 * It was absent while that function was refused outright.
 */
export type ClauseGroupMatch = 'id' | 'name' | 'nameStartsWith' | 'nameContains' | 'nameRegex';

/**
 * Which way round an `isMemberOf*` clause asks its question.
 *
 * `member` is the bare call: the user must be in one of the groups it names.
 * `non-member` is the negated form (`!isMemberOfAnyGroup(…)`): the rule *excludes*
 * members of those groups, so the user must be in none of them.
 *
 * The distinction is not cosmetic — it inverts which references are the problem.
 * A failing `member` clause is blamed on the groups the user is **missing**; a
 * failing `non-member` clause is blamed on the one they **have**, and adding a
 * group could never fix it.
 */
export type ClauseGroupRequirement = 'member' | 'non-member';

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

/**
 * The value of a profile attribute a clause read, when the profile does not
 * carry that attribute at all.
 *
 * A unique symbol rather than `undefined` or `null`, mirroring `ruleEvaluator`'s
 * own `UNRESOLVED` sentinel: **absent is not zero, and absent is not null.** An
 * attribute present and explicitly `null` records `null`; one the user's profile
 * has never had records this. The two render differently, and collapsing them is
 * the bug class that made `user.status == "ACTIVE"` answer "no match" for a whole
 * org (D-114).
 */
export const ATTRIBUTE_ABSENT: unique symbol = Symbol('attribute-absent');

/**
 * One profile attribute a clause read, with what it held for this user.
 *
 * Collected off the AST, so the path is exactly what the rule dereferenced —
 * never recovered by scanning the clause text, where a quoted `"user.department"`
 * naming a group would be indistinguishable from a read.
 */
export interface AttributeRead {
  /**
   * The display path, normalised: `user.department` for the dotted form,
   * `user["cost center"]` (always double-quoted) for a string-literal computed
   * key. Deduplicated on this, so `user['x']` and `user["x"]` are one read.
   * **Untrusted:** an attribute name is tenant-authored — render escaped.
   */
  readonly path: string;
  /**
   * What the attribute held, or {@link ATTRIBUTE_ABSENT} when this user's
   * profile does not carry it. **PII:** render escaped, never log, escape for CSV.
   */
  readonly value: RuleExprValue | typeof ATTRIBUTE_ABSENT;
}

/**
 * A value-transforming Okta EL function this module can describe in words.
 *
 * Deliberately a closed set, and deliberately not every function the evaluator
 * supports: a transform is listed here only when there is an unambiguous English
 * reading of it (`String.toLowerCase` → "lowercased"). `String.substring` and
 * `String.stringSwitch` have no such reading, so a clause using one carries no
 * {@link LeafPredicate} at all rather than an approximate description.
 */
export type SubjectTransform =
  'toLowerCase' | 'toUpperCase' | 'removeSpaces' | 'len' | 'size' | 'toCsvString';

/** The attribute a clause is *about*, plus the functions wrapped around it. */
export interface SubjectDescription {
  /**
   * The attribute's display path, in the same normalised form as
   * {@link AttributeRead.path} (`user.department`, `user["cost center"]`), so a
   * description and the evidence line under it name the attribute identically.
   * **Untrusted:** render escaped.
   */
  readonly path: string;
  /**
   * The transforms wrapped around {@link path}, **innermost first**:
   * `String.toLowerCase(String.removeSpaces(user.x))` is
   * `['removeSpaces', 'toLowerCase']`. Empty for a bare attribute read.
   */
  readonly transforms: readonly SubjectTransform[];
}

/** The comparison a `compare` predicate makes, normalised to subject-on-left. */
export type ComparisonOperator = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';

/**
 * What a leaf clause *says*, as data — the structured half of
 * {@link LeafClauseNode.expressionText}.
 *
 * Recognised purely syntactically off the very AST nodes the clause was
 * evaluated from, so a description can never disagree with the verdict beside
 * it, and **no evaluation is involved**: this states what the rule asks, never
 * what the answer was. Where recognition is uncertain the field is absent
 * rather than approximate (`docs/claims.md`) — a caller with no predicate falls
 * back to printing the clause text, which is always exact.
 *
 * Data, never prose: the wording lives in the UI, and nothing may branch on a
 * display string.
 */
export type LeafPredicate =
  | {
      readonly form: 'compare';
      readonly subject: SubjectDescription;
      readonly operator: ComparisonOperator;
      readonly operand: RuleExprValue;
    }
  | {
      readonly form: 'compare-subjects';
      readonly left: SubjectDescription;
      readonly operator: ComparisonOperator;
      readonly right: SubjectDescription;
    }
  | {
      readonly form: 'contains' | 'starts-with' | 'ends-with';
      readonly subject: SubjectDescription;
      readonly operand: string;
      readonly negated: boolean;
    }
  | {
      readonly form: 'array-contains';
      readonly subject: SubjectDescription;
      readonly operand: RuleExprValue;
      readonly negated: boolean;
    }
  | { readonly form: 'empty'; readonly subject: SubjectDescription; readonly negated: boolean }
  | {
      readonly form: 'boolean-attribute';
      readonly subject: SubjectDescription;
      readonly negated: boolean;
    };

/**
 * A leaf of {@link RuleExplanation.tree}: one indivisible clause of a rule
 * condition, explained against one user.
 *
 * A disjunction is a {@link ConnectiveNode} here rather than a leaf carrying a
 * list of alternatives, so the parts of an `||` are reached by descending into
 * `children` like any other group — there is no second, flatter way to ask.
 */
export interface LeafClauseNode {
  /** Discriminant of {@link ClauseTreeNode}. */
  readonly node: 'leaf';
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
   *
   * Read {@link groupRequirement} before acting on these: under `non-member` it
   * is the **satisfied** entries that explain a failure.
   */
  readonly groupReferences?: readonly ClauseGroupReference[];
  /**
   * Which way round the clause asks — present exactly when
   * {@link groupReferences} is.
   *
   * Carried on the clause rather than on each reference because every argument of
   * one call shares it: `!isMemberOfAnyGroup(a, b)` negates the whole call, not
   * individual groups.
   */
  readonly groupRequirement?: ClauseGroupRequirement;
  /**
   * Every `user.*` attribute read anywhere under this leaf, in source order and
   * deduplicated by {@link AttributeRead.path}.
   *
   * A read whose value could not be resolved for a reason **other** than absence
   * — an object-valued attribute, say — is omitted rather than recorded as
   * absent: "the profile does not have this" is a claim, and it would be false.
   * Empty for a clause that reads no attribute at all.
   */
  readonly reads: readonly AttributeRead[];
  /**
   * What this clause asks, structurally — present only when the clause is one
   * of the shapes {@link LeafPredicate} recognises, so a caller can compose a
   * sentence instead of printing `String.toLowerCase(user.department) ==
   * "sales"` at the reader.
   *
   * **Absent is the normal case for anything unusual**, and absent means
   * "describe this clause by its text", never "this clause is simple". A
   * group-membership clause never carries one: it is described from
   * {@link groupRequirement} and {@link groupReferences} instead.
   */
  readonly predicate?: LeafPredicate;
}

/** Whether a {@link ConnectiveNode} joins its children with `&&` or with `||`. */
export type ClauseConnectiveKind = 'and' | 'or';

/**
 * **Which** bound dropped something under a {@link ConnectiveNode}.
 *
 * Two different losses, and a reader can act on only one of them, so they are
 * not collapsed into a bare `true`:
 *
 * - `depth` — a child group nested past {@link MAX_TREE_DEPTH} was folded into a
 *   single leaf. Nothing is missing from the list; the leaf carries the whole
 *   sub-expression's text and its verdict. Only the *structure* below it is gone.
 * - `clause-cap` — sibling clauses past the `maxClauses` budget were dropped
 *   outright. Those clauses are **not on screen at all**, and
 *   {@link RuleExplanationSummary.totalClauses} is the count that was kept.
 *
 * A node that suffered both reports `clause-cap`: losing whole clauses is the
 * larger claim about what the reader is not seeing.
 */
export type ClauseTruncation = 'depth' | 'clause-cap';

/**
 * An interior node of {@link RuleExplanation.tree}: an `&&` or `||` group.
 *
 * Adjacent connectives of the same kind flatten into one n-ary node, so
 * `a && b && c` is a single AND over three children rather than a chain.
 */
export interface ConnectiveNode {
  /** Discriminant of {@link ClauseTreeNode}. */
  readonly node: 'connective';
  /** Which connective joins the children. */
  readonly kind: ClauseConnectiveKind;
  /** The operands, in source order. Never empty. */
  readonly children: readonly ClauseTreeNode[];
  /**
   * This group's own outcome, from the **same two gates** every other verdict in
   * this module passes: `ruleEvaluator`'s grammar allow-list over the whole
   * sub-expression, then its eager three-valued walk.
   *
   * For children that all resolve to booleans this is exactly the Kleene answer
   * read off {@link children} — an OR passes when any child passes and fails only
   * when every child failed; an AND is the dual. It is taken from the evaluator
   * rather than derived from the children so that it cannot disagree with
   * {@link RuleExplanationSummary.result}: the grammar gate rejects a whole
   * sub-expression for one unsupported fragment, and a child that resolved to a
   * non-boolean is `not-evaluated` here while the evaluator still reads its
   * truthiness. In both cases the evaluator's answer is the one the rest of the
   * app acts on.
   */
  readonly verdict: ClauseStatus;
  /**
   * Which children carry a `pass`/`fail` verdict — the structured basis for
   * "one alternative passes, so the unevaluated check cannot change the answer".
   *
   * Indices into {@link children}: the passing children of a passing OR, the
   * failing children of a failing AND. Empty for a failing OR and a passing AND
   * (every child carries those) and for a `not-evaluated` verdict. **May also be
   * empty for a pass/fail verdict** the evaluator reached without any child
   * resolving to a boolean — never assume it is non-empty.
   *
   * Data, not prose: this module states no sentence, and a caller's copy can be
   * rewritten without moving a gate.
   */
  readonly decidedByChildIndices: readonly number[];
  /** How many children are themselves `not-evaluated`. */
  readonly undecidedChildCount: number;
  /** Nesting depth, `0` at the root. Bounded by {@link MAX_TREE_DEPTH}. */
  readonly depth: number;
  /**
   * Present exactly when something under this node was dropped, naming **which**
   * bound dropped it — see {@link ClauseTruncation}. Absent means nothing was
   * lost here.
   *
   * Set on the nearest **surviving** ancestor, and always accompanied by
   * {@link RuleExplanationSummary.truncated}.
   */
  readonly truncation?: ClauseTruncation;
}

/** One node of {@link RuleExplanation.tree}: a connective group, or a clause. */
export type ClauseTreeNode = ConnectiveNode | LeafClauseNode;

/**
 * How deeply {@link RuleExplanation.tree} nests connectives before it stops.
 *
 * A condition is untrusted input, and nesting is the cheap half of making a walk
 * expensive. Past this depth the whole sub-expression becomes **one** leaf: its
 * text is the sub-expression, its status is that sub-expression evaluated whole
 * (so no verdict is lost, only structure), and the nearest surviving ancestor
 * carries `truncated`.
 */
export const MAX_TREE_DEPTH = 8;

/**
 * Per-rule counts the UI renders above the ledger.
 *
 * Every count below is over the condition's **top-level requirements**: the
 * conjuncts of the root, with a disjunction counted as ONE requirement whatever
 * its width. That is the unit the sentence above the ledger speaks in ("3 of 4
 * clauses evaluated"), and counting an `||` group's alternatives individually
 * would state that every one of them has to hold.
 */
export interface RuleExplanationSummary {
  /** Top-level requirements counted. `0` when the expression never parsed. */
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
   * then carry a real verdict. It does **not** count a clause the safe regex
   * engine declined (`regex-unsupported-syntax`, `regex-too-complex`), which is
   * unevaluated for a different reason and would not be fixed by any group
   * list.
   */
  readonly needsGroupContext: number;
  /**
   * The whole-expression verdict, from the same engine every other consumer uses
   * (three-valued, so it is **not** derivable by counting the rows above — an
   * `||` can match with most of its clauses failing).
   */
  readonly result: RuleMatchResult;
  /**
   * Whether anything was dropped: clause rows past the `maxClauses` cap, or a
   * sub-expression collapsed into one leaf by {@link MAX_TREE_DEPTH}. The counts
   * above describe the rows actually returned; {@link result} is always computed
   * over the whole expression.
   */
  readonly truncated: boolean;
}

/** A rule condition explained against one user: the clause tree plus its summary. */
export interface RuleExplanation {
  /**
   * The explanation itself — connective groups nested as written, one
   * {@link LeafClauseNode} per indivisible clause.
   *
   * The root of a rule with no top-level connective is a {@link LeafClauseNode};
   * so is `!(a && b)`, whose negation applies to the combination and whose parts
   * would invert if reported separately. An expression that never parsed roots at
   * a leaf with empty text carrying the reason code — there is always a root to
   * render.
   */
  readonly tree: ClauseTreeNode;
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
   * `isMemberOfGroupNameRegex` is answered from the same list (ADR-0002 runs the
   * pattern in linear time rather than refusing it). It stays unevaluated only
   * when the safe engine declines that particular pattern, under
   * `regex-unsupported-syntax` or `regex-too-complex`.
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
// One walk
// ---------------------------------------------------------------------------

/**
 * A clause's own facts, without the {@link AttributeRead}s a leaf also carries.
 *
 * The memoised unit: the summary tallies these for the top-level requirements
 * and every leaf of the tree is one of them plus its reads, so a count and a node
 * can never be two different evaluations of the same clause.
 */
type ClauseCore = Omit<LeafClauseNode, 'node' | 'reads'>;

/**
 * Everything one call to {@link explainRuleExpression} carries, including the
 * memos that make the tree and the summary **one** walk.
 *
 * The caches are per call, never module-level: `parseRuleExpression` memoises the
 * AST, so the very same node objects come back for a later call against a
 * different user, and a cache outliving the call would answer about that user.
 */
interface ExplainContext {
  readonly user: OktaUser;
  readonly groups: RuleGroupContext | undefined;
  /** Node → its explained facts. Keyed by node identity, so every reader shares it. */
  readonly clauseCache: WeakMap<jsep.Expression, ClauseCore>;
  /** Node → its value against the user alone, shared by `resolvedValue` and by the reads. */
  readonly valueCache: WeakMap<jsep.Expression, RuleNodeEvaluation>;
}

/**
 * One node's value against the user's profile, evaluated at most once per call.
 *
 * Deliberately without the group context: this feeds
 * {@link LeafClauseNode.resolvedValue} and {@link AttributeRead.value}, both
 * of which are profile reads. The clause *verdict* is a separate, group-aware
 * evaluation.
 */
function evaluateNodeValue(node: jsep.Expression, ctx: ExplainContext): RuleNodeEvaluation {
  const cached = ctx.valueCache.get(node);
  if (cached) return cached;
  const evaluation = evaluateRuleNode(node, { user: ctx.user });
  ctx.valueCache.set(node, evaluation);
  return evaluation;
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
 * Split a condition into its **top-level requirements** by descending through
 * **conjunctions only** — the unit {@link RuleExplanationSummary} counts in.
 *
 * `a && (b || c)` yields TWO clauses, `a` and `b || c`; `!(a && b)` yields one,
 * because the negation applies to the *combination* and reporting its parts
 * separately would invert their meaning.
 *
 * Descending through `||` as well used to yield three, and that was wrong in a
 * way that reached the screen. The parts of a disjunction are alternatives, not
 * requirements, so listing them as siblings of a conjunct states that all of
 * them must hold. A real tenant rule of the shape
 *
 *     user.employeeType == "CONTRACTOR" && (countryCode == "GB" || "DE" || "IE")
 *
 * rendered as four flat failing clauses including `countryCode == "GB"` and
 * `countryCode == "DE"` side by side, which describes a rule that can never
 * match anybody. It also inflated every failing-clause count by the width of
 * each OR group — which is why the counts still stop here even though the tree
 * goes on to nest that group's alternatives underneath.
 */
function collectClauseNodes(
  node: jsep.Expression,
  collection: ClauseCollection,
  limit: number,
): void {
  const binary = asBinaryExpression(node);
  if (binary && RULE_CONJUNCTIVE_OPERATORS.has(binary.operator)) {
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
 * {@link LeafClauseNode.resolvedValue}. A clause that is itself an operand
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
function resolveClauseValue(node: jsep.Expression, ctx: ExplainContext): RuleExprValue | undefined {
  for (const operand of operandsOf(node)) {
    if (asLiteral(operand)) continue;
    const evaluation = evaluateNodeValue(operand, ctx);
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
  ['isMemberOfGroupNameRegex', 'nameRegex'],
]);

/**
 * Which of the user's groups satisfies one reference — or the fact that the
 * question could not be answered at all.
 *
 * Only the regex form can decline: `shared/rules/safeRegex` refuses a pattern
 * outside its subset or past its caps, and a declined pattern is not a "no
 * group matched". Reporting it as one would print `satisfied: false` beside a
 * check that never ran.
 */
type ReferenceResolution =
  | { readonly kind: 'resolved'; readonly matched?: RuleGroupContextEntry }
  | { readonly kind: 'declined' };

/** Which of the user's groups satisfies one reference, if any. */
function findMatchingGroup(
  match: ClauseGroupMatch,
  value: string,
  groups: RuleGroupContext,
): ReferenceResolution {
  if (match === 'nameRegex') return findMatchingGroupByRegex(value, groups);
  const matched = groups.find((group) => {
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
  return { kind: 'resolved', ...(matched ? { matched } : {}) };
}

/**
 * The regex form, compiled **once** and matched against each name in full.
 *
 * Mirrors `ruleEvaluator`'s own eagerness: a name that matches answers the
 * question whatever the rest of the list did, but an unmatched pass in which
 * some name could not be read is a decline, not a `false`.
 */
function findMatchingGroupByRegex(pattern: string, groups: RuleGroupContext): ReferenceResolution {
  const program = compileSafeRegex(pattern);
  if (program.kind === 'declined') return { kind: 'declined' };
  let declined = false;
  for (const group of groups) {
    const result = matchCompiled(program, group.name);
    if (result.kind === 'declined') {
      declined = true;
      continue;
    }
    if (result.matched) return { kind: 'resolved', matched: group };
  }
  return declined ? { kind: 'declined' } : { kind: 'resolved' };
}

/** What one group-membership clause asks about, and which way round. */
interface GroupClauseFacts {
  readonly requirement: ClauseGroupRequirement;
  readonly references: readonly ClauseGroupReference[];
}

/**
 * The groups an `isMemberOf*` clause asks about and its polarity, read off the
 * AST — or `undefined` when the clause is not one of those calls.
 *
 * **A negation is looked through.** `!isMemberOfAnyGroup(a, b)` names the same
 * groups as the bare call; only the meaning of a match flips. Missing that was a
 * real bug: the clause node is a `UnaryExpression`, so a plain `asCallExpression`
 * found nothing, the clause carried no references at all, and a twenty-group
 * exclusion was reported to the admin as a profile attribute to fix.
 *
 * Only `!` is unwrapped — no other unary operator expresses polarity — and only
 * one level, so `!!isMemberOfGroup(x)` is declined rather than guessed at.
 *
 * Returns `undefined` rather than a partial list for any argument that is not a
 * string literal: naming the wrong group is worse than naming none.
 */
function groupClauseFactsOf(
  node: jsep.Expression,
  groups: RuleGroupContext | undefined,
): GroupClauseFacts | undefined {
  // Without a group list there is no `satisfied` to report — only "not known to
  // be satisfied", which reads identically and is not the same fact. The clause
  // is `not-evaluated` in that case anyway, so there is nothing to act on.
  if (!groups) return undefined;

  const unary = asUnaryExpression(node);
  const negated = unary?.operator === '!';
  const call = asCallExpression(negated && unary ? unary.argument : node);
  if (!call) return undefined;
  const match = GROUP_MATCH_BY_FUNCTION.get(asIdentifier(call.callee)?.name ?? '');
  if (!match) return undefined;

  const references: ClauseGroupReference[] = [];
  for (const argument of call.arguments) {
    const value = asLiteral(argument)?.value;
    if (typeof value !== 'string') return undefined;
    const resolution = findMatchingGroup(match, value, groups);
    // A reference whose `satisfied` is not known is dropped along with the whole
    // clause: `false` there reads as a definite "they are not in one of these",
    // which is the claim a declined pattern has not earned.
    if (resolution.kind === 'declined') return undefined;
    const { matched } = resolution;
    references.push({
      match,
      value,
      satisfied: matched !== undefined,
      ...(matched ? { matchedGroupName: matched.name } : {}),
    });
  }
  if (references.length === 0) return undefined;
  return { requirement: negated ? 'non-member' : 'member', references };
}

// ---------------------------------------------------------------------------
// Predicate description
//
// Purely syntactic recognition over the same AST nodes the clause is evaluated
// from. Nothing here evaluates anything, so a description cannot disagree with
// the verdict printed beside it; anything not recognised exactly yields no
// description at all.
// ---------------------------------------------------------------------------

/** Fully-qualified callee name — `String.toLowerCase`, or a bare `isMemberOfGroup`. */
function calleeNameOf(call: jsep.CallExpression): string | undefined {
  const identifier = asIdentifier(call.callee);
  if (identifier) return identifier.name;
  const member = asMemberExpression(call.callee);
  if (!member || member.computed) return undefined;
  const object = asIdentifier(member.object);
  const property = asIdentifier(member.property);
  return object && property ? `${object.name}.${property.name}` : undefined;
}

/** Okta EL function → the {@link SubjectTransform} it applies to its one argument. */
const SUBJECT_TRANSFORM_BY_FUNCTION = new Map<string, SubjectTransform>([
  ['String.toLowerCase', 'toLowerCase'],
  ['String.toUpperCase', 'toUpperCase'],
  ['String.removeSpaces', 'removeSpaces'],
  ['String.len', 'len'],
  ['Arrays.size', 'size'],
  ['Arrays.toCsvString', 'toCsvString'],
]);

/** Binary operator (symbolic and Okta's word forms) → {@link ComparisonOperator}. */
const COMPARISON_OPERATORS = new Map<string, ComparisonOperator>([
  ['==', 'eq'],
  ['===', 'eq'],
  ['eq', 'eq'],
  ['!=', 'ne'],
  ['!==', 'ne'],
  ['ne', 'ne'],
  ['<', 'lt'],
  ['<=', 'lte'],
  ['>', 'gt'],
  ['>=', 'gte'],
]);

/**
 * A `user.*` read, optionally wrapped in {@link SUBJECT_TRANSFORM_BY_FUNCTION}
 * calls — or `undefined` for anything else.
 *
 * Transforms come back **innermost first**, which is the order they are applied
 * in and therefore the order they read in.
 */
function subjectDescriptionOf(node: jsep.Expression): SubjectDescription | undefined {
  const path = attributePathOf(node);
  if (path !== undefined) return { path, transforms: [] };

  const call = asCallExpression(node);
  if (!call || call.arguments.length !== 1) return undefined;
  const name = calleeNameOf(call);
  const transform = name === undefined ? undefined : SUBJECT_TRANSFORM_BY_FUNCTION.get(name);
  if (!transform) return undefined;

  const argument = call.arguments[0];
  const inner = argument ? subjectDescriptionOf(argument) : undefined;
  if (!inner) return undefined;
  return { path: inner.path, transforms: [...inner.transforms, transform] };
}

/** A scalar literal's value, or `undefined` for any other node. `null` is a value. */
function scalarLiteralValueOf(node: jsep.Expression): RuleExprValue | undefined {
  const literal = asLiteral(node);
  if (!literal) return undefined;
  const { value } = literal;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

/** The mirror of a comparison, for normalising a literal-on-the-left clause. */
function mirrorOperator(operator: ComparisonOperator): ComparisonOperator {
  switch (operator) {
    case 'lt':
      return 'gt';
    case 'lte':
      return 'gte';
    case 'gt':
      return 'lt';
    case 'gte':
      return 'lte';
    default:
      return operator;
  }
}

/**
 * The **exact complement** of a comparison, for describing `!(…)`.
 *
 * Sound because the evaluator's relational operators resolve only when both
 * operands are genuine numbers (`evaluateRelational`), so trichotomy holds for
 * every verdict that exists to be described: if `a < b` resolved to `false`
 * then `a >= b` is `true`, with no third case where both are false. Equality is
 * strict `===`/`!==`, whose complement is likewise total.
 */
function complementOperator(operator: ComparisonOperator): ComparisonOperator {
  switch (operator) {
    case 'eq':
      return 'ne';
    case 'ne':
      return 'eq';
    case 'lt':
      return 'gte';
    case 'gte':
      return 'lt';
    case 'gt':
      return 'lte';
    case 'lte':
      return 'gt';
  }
}

/** `!p` as a predicate of its own: comparisons invert, flag-carrying forms flip. */
function negatePredicate(predicate: LeafPredicate): LeafPredicate {
  switch (predicate.form) {
    case 'compare':
      return { ...predicate, operator: complementOperator(predicate.operator) };
    case 'compare-subjects':
      return { ...predicate, operator: complementOperator(predicate.operator) };
    default:
      return { ...predicate, negated: !predicate.negated };
  }
}

/** The `compare` / `compare-subjects` forms, normalised to subject-on-the-left. */
function comparisonPredicateOf(binary: jsep.BinaryExpression): LeafPredicate | undefined {
  const operator = COMPARISON_OPERATORS.get(binary.operator);
  if (!operator) return undefined;

  const left = subjectDescriptionOf(binary.left);
  const right = subjectDescriptionOf(binary.right);
  if (left && right) return { form: 'compare-subjects', left, operator, right };

  if (left) {
    const operand = scalarLiteralValueOf(binary.right);
    return operand === undefined
      ? undefined
      : { form: 'compare', subject: left, operator, operand };
  }
  if (right) {
    // `"sales" == user.department` says the same thing the other way round; the
    // relational operators mirror so the sentence still reads subject-first.
    const operand = scalarLiteralValueOf(binary.left);
    return operand === undefined
      ? undefined
      : { form: 'compare', subject: right, operator: mirrorOperator(operator), operand };
  }
  return undefined;
}

/** The call forms — `String.stringContains`, `Arrays.contains`, `Arrays.isEmpty`. */
function callPredicateOf(call: jsep.CallExpression): LeafPredicate | undefined {
  const name = calleeNameOf(call);
  if (name === undefined) return undefined;

  const [first, second] = call.arguments;
  const subject = first ? subjectDescriptionOf(first) : undefined;
  if (!subject) return undefined;

  if (name === 'Arrays.isEmpty' && call.arguments.length === 1) {
    return { form: 'empty', subject, negated: false };
  }
  if (call.arguments.length !== 2 || !second) return undefined;

  if (name === 'Arrays.contains') {
    const operand = scalarLiteralValueOf(second);
    return operand === undefined
      ? undefined
      : { form: 'array-contains', subject, operand, negated: false };
  }

  const stringForm =
    name === 'String.stringContains'
      ? 'contains'
      : name === 'String.startsWith'
        ? 'starts-with'
        : name === 'String.endsWith'
          ? 'ends-with'
          : undefined;
  if (!stringForm) return undefined;
  const operand = scalarLiteralValueOf(second);
  if (typeof operand !== 'string') return undefined;
  return { form: stringForm, subject, operand, negated: false };
}

/**
 * A clause's predicate **without** looking through a negation — the positive
 * shapes only.
 *
 * Kept separate from {@link leafPredicateOf} so that `!!x` describes nothing:
 * the inner `!` is a unary expression, which is not a positive shape, exactly
 * as `ruleEvaluator` declines to reason about double negation.
 */
function positivePredicateOf(node: jsep.Expression): LeafPredicate | undefined {
  const binary = asBinaryExpression(node);
  if (binary) return comparisonPredicateOf(binary);

  const call = asCallExpression(node);
  if (call) return callPredicateOf(call);

  // A bare attribute standing as a whole clause is a boolean question about it.
  // The evaluator resolves such a clause only when the attribute really is a
  // boolean, so "is true"/"is false" is the whole of what it can say.
  const subject = subjectDescriptionOf(node);
  return subject && subject.transforms.length === 0
    ? { form: 'boolean-attribute', subject, negated: false }
    : undefined;
}

/**
 * What one leaf clause asks, or `undefined` when it is not a shape this module
 * can state exactly.
 *
 * One level of negation is looked through and folded into the predicate — see
 * {@link negatePredicate}. Group-membership calls are never described here:
 * their arguments are groups, not attributes, so `subjectDescriptionOf` finds
 * no subject and they keep their existing
 * {@link LeafClauseNode.groupRequirement} treatment.
 */
function leafPredicateOf(node: jsep.Expression): LeafPredicate | undefined {
  const unary = asUnaryExpression(node);
  if (unary && RULE_NEGATION_OPERATORS.has(unary.operator)) {
    const inner = positivePredicateOf(unary.argument);
    return inner ? negatePredicate(inner) : undefined;
  }
  return positivePredicateOf(node);
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
function clauseCore(node: jsep.Expression, ctx: ExplainContext): ClauseCore {
  const cached = ctx.clauseCache.get(node);
  if (cached) return cached;
  const core = computeClauseCore(node, ctx);
  ctx.clauseCache.set(node, core);
  return core;
}

/** {@link clauseCore} on a cache miss. Never called twice for the same node. */
function computeClauseCore(node: jsep.Expression, ctx: ExplainContext): ClauseCore {
  const { groups } = ctx;
  // Group facts are attached to every outcome, including the unevaluated ones:
  // naming the groups a clause asks about is useful even when we could not
  // answer it.
  const groupFacts = groupClauseFactsOf(node, groups);
  // Syntactic, and independent of both gates below: a clause the evaluator
  // could not resolve is still worth stating in words, and the description says
  // only what the rule asks, never what the answer was.
  const predicate = leafPredicateOf(node);
  const base = {
    expressionText: stringifyNode(node),
    resolvedValue: resolveClauseValue(node, ctx),
    ...(predicate ? { predicate } : {}),
    ...(groupFacts
      ? { groupReferences: groupFacts.references, groupRequirement: groupFacts.requirement }
      : {}),
  };

  const support = checkRuleNodeSupport(node, { hasGroupContext: groups !== undefined });
  if (!support.supported) {
    return { ...base, status: 'not-evaluated', reasonCode: support.reasonCode };
  }

  const evaluation = evaluateRuleNode(node, { user: ctx.user, groups });
  if (!evaluation.resolved) {
    return { ...base, status: 'not-evaluated', reasonCode: evaluation.reasonCode };
  }
  if (typeof evaluation.value !== 'boolean') {
    return { ...base, status: 'not-evaluated', reasonCode: 'not-a-boolean' };
  }

  return { ...base, status: evaluation.value ? 'pass' : 'fail' };
}

// ---------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------

/**
 * The sub-expressions a node encloses — a generic child walk used to find the
 * attribute reads under a leaf.
 *
 * Every shape {@link stringifyNode} can print is descended; anything else has no
 * children worth reading (a literal, an identifier, `this`).
 */
function childExpressions(node: jsep.Expression): readonly jsep.Expression[] {
  const member = asMemberExpression(node);
  if (member) return member.computed ? [member.object, member.property] : [member.object];

  const call = asCallExpression(node);
  if (call) return [call.callee, ...call.arguments];

  const unary = asUnaryExpression(node);
  if (unary) return [unary.argument];

  const binary = asBinaryExpression(node);
  if (binary) return [binary.left, binary.right];

  const conditional = asConditionalExpression(node);
  if (conditional) return [conditional.test, conditional.consequent, conditional.alternate];

  const compound = asCompound(node);
  if (compound) return compound.body;

  const array = asArrayExpression(node);
  if (array) {
    return array.elements.filter((element): element is jsep.Expression => Boolean(element));
  }

  return [];
}

/**
 * The display path of a `user.*` read, or `undefined` for any other node.
 *
 * Normalises the computed form to double quotes (`user["cost center"]`) so the
 * path is a stable dedupe key whichever quoting the tenant wrote. A computed key
 * that is not a string literal (`user[x]`) has no nameable path and is not a read
 * this module will claim to have read.
 */
function attributePathOf(node: jsep.Expression): string | undefined {
  const member = asMemberExpression(node);
  if (!member) return undefined;
  if (asIdentifier(member.object)?.name !== 'user') return undefined;

  if (member.computed) {
    const key = asLiteral(member.property)?.value;
    return typeof key === 'string' ? `user[${JSON.stringify(key)}]` : undefined;
  }
  const property = asIdentifier(member.property);
  return property ? `user.${property.name}` : undefined;
}

/**
 * Every `user.*` attribute read under one node, in source order, deduplicated by
 * path.
 *
 * An attribute the profile does not carry records {@link ATTRIBUTE_ABSENT}; one
 * present and explicitly `null` records `null`. A read that failed to resolve for
 * any other reason is **omitted** — there is no value to state, and recording it
 * as absent would assert something false about the profile.
 */
function collectAttributeReads(
  node: jsep.Expression,
  ctx: ExplainContext,
): readonly AttributeRead[] {
  const reads: AttributeRead[] = [];
  const seen = new Set<string>();

  const visit = (current: jsep.Expression): void => {
    const path = attributePathOf(current);
    if (path !== undefined) {
      // The object and the key of a read are parts of the path, not reads of
      // their own, so the walk stops here.
      if (seen.has(path)) return;
      const evaluation = evaluateNodeValue(current, ctx);
      if (evaluation.resolved) {
        seen.add(path);
        reads.push({ path, value: evaluation.value });
      } else if (evaluation.reasonCode === 'attribute-absent') {
        seen.add(path);
        reads.push({ path, value: ATTRIBUTE_ABSENT });
      }
      return;
    }
    for (const child of childExpressions(current)) visit(child);
  };

  visit(node);
  return reads;
}

/** Which connective a node is, or `undefined` for anything the tree keeps whole. */
function connectiveKindOf(node: jsep.Expression): ClauseConnectiveKind | undefined {
  const binary = asBinaryExpression(node);
  if (!binary) return undefined;
  if (RULE_CONJUNCTIVE_OPERATORS.has(binary.operator)) return 'and';
  if (RULE_DISJUNCTIVE_OPERATORS.has(binary.operator)) return 'or';
  return undefined;
}

/**
 * The operands of one connective group, flattening an adjacent chain of the
 * **same** kind into one n-ary list.
 *
 * `a && b && c` is three operands, not a nested pair; `a && (b || c)` is two,
 * the second of which is the OR group. This is the same flattening
 * {@link collectClauseNodes} applies to the conjunctive half.
 */
function collectConnectiveOperands(
  node: jsep.Expression,
  kind: ClauseConnectiveKind,
  into: jsep.Expression[],
): void {
  const binary = asBinaryExpression(node);
  if (binary && connectiveKindOf(node) === kind) {
    collectConnectiveOperands(binary.left, kind, into);
    collectConnectiveOperands(binary.right, kind, into);
    return;
  }
  into.push(node);
}

/** A node's own outcome, whichever kind of node it is. */
function treeNodeStatus(node: ClauseTreeNode): ClauseStatus {
  return node.node === 'leaf' ? node.status : node.verdict;
}

/**
 * The children that carry a decided verdict — see
 * {@link ConnectiveNode.decidedByChildIndices}.
 *
 * A passing OR is carried by its passing children and a failing AND by its
 * failing ones; the other two combinations are carried by every child, and are
 * reported as an empty list rather than as "all of them" so a caller cannot
 * mistake one for the other.
 */
function decidedByChildIndices(
  kind: ClauseConnectiveKind,
  verdict: ClauseStatus,
  children: readonly ClauseTreeNode[],
): readonly number[] {
  let decisive: ClauseStatus | undefined;
  if (kind === 'or' && verdict === 'pass') decisive = 'pass';
  else if (kind === 'and' && verdict === 'fail') decisive = 'fail';
  if (decisive === undefined) return [];

  const indices: number[] = [];
  children.forEach((child, index) => {
    if (treeNodeStatus(child) === decisive) indices.push(index);
  });
  return indices;
}

/** Mutable accumulator for {@link buildTreeNode}: the leaf budget and what it dropped. */
interface TreeBuildState {
  /** Leaves still affordable. Bounds the tree the same way `maxClauses` bounds the rows. */
  leafBudget: number;
  /** Whether anything — a collapsed subtree or a dropped sibling — was lost. */
  truncated: boolean;
}

/** A built node, and whether it is a connective subtree collapsed by the depth cap. */
interface BuiltTreeNode {
  readonly node: ClauseTreeNode;
  readonly collapsed: boolean;
}

/** One leaf: the memoised clause facts, plus the attribute reads under it. */
function buildLeafNode(node: jsep.Expression, ctx: ExplainContext): LeafClauseNode {
  return { node: 'leaf', ...clauseCore(node, ctx), reads: collectAttributeReads(node, ctx) };
}

/**
 * Build one node of the tree, or `undefined` when the leaf budget is spent.
 *
 * Connectives nest until {@link MAX_TREE_DEPTH}, below which the whole
 * sub-expression becomes one leaf whose status is that sub-expression evaluated
 * whole — structure is lost, never a verdict. Statuses come from
 * {@link clauseCore}, the same memo the summary counts, so a node and the count
 * above it cannot disagree.
 */
function buildTreeNode(
  node: jsep.Expression,
  depth: number,
  ctx: ExplainContext,
  state: TreeBuildState,
): BuiltTreeNode | undefined {
  const kind = connectiveKindOf(node);

  if (kind !== undefined && depth < MAX_TREE_DEPTH) {
    const operands: jsep.Expression[] = [];
    collectConnectiveOperands(node, kind, operands);

    const children: ClauseTreeNode[] = [];
    // `clause-cap` outranks `depth`: see {@link ClauseTruncation}.
    let truncation: ClauseTruncation | undefined;
    for (const operand of operands) {
      const built = buildTreeNode(operand, depth + 1, ctx, state);
      if (!built) {
        truncation = 'clause-cap';
        state.truncated = true;
        continue;
      }
      if (built.collapsed) {
        truncation ??= 'depth';
        state.truncated = true;
      }
      children.push(built.node);
    }
    // Every operand was dropped, so there is no group left to report: the parent
    // records the loss instead.
    if (children.length === 0) return undefined;

    const verdict = clauseCore(node, ctx).status;
    return {
      node: {
        node: 'connective',
        kind,
        children,
        verdict,
        decidedByChildIndices: decidedByChildIndices(kind, verdict, children),
        undecidedChildCount: children.filter((child) => treeNodeStatus(child) === 'not-evaluated')
          .length,
        depth,
        ...(truncation ? { truncation } : {}),
      },
      collapsed: false,
    };
  }

  if (state.leafBudget <= 0) {
    state.truncated = true;
    return undefined;
  }
  state.leafBudget -= 1;
  // `collapsed` when this leaf is a connective the depth cap folded up: the
  // parent needs to say so, because the structure below it is not on screen.
  return { node: buildLeafNode(node, ctx), collapsed: kind !== undefined };
}

/**
 * The root of {@link RuleExplanation.tree}.
 *
 * The root is never dropped: the budget is at least one leaf, and the first leaf
 * built is always affordable.
 */
function buildTree(
  ast: jsep.Expression,
  ctx: ExplainContext,
  state: TreeBuildState,
): ClauseTreeNode {
  return buildTreeNode(ast, 0, ctx, state)?.node ?? buildLeafNode(ast, ctx);
}

/**
 * Tally the top-level requirements into the summary the UI renders above the
 * ledger.
 *
 * Takes the memoised {@link ClauseCore} facts, not the tree: the tree's leaves go
 * one level further into every disjunction, and counting those would report an
 * `||` group's alternatives as separate requirements — the exact
 * over-count {@link collectClauseNodes} exists to prevent.
 */
function summarise(
  clauses: readonly ClauseCore[],
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

/**
 * An explanation with no clauses to count — the expression never became an AST.
 *
 * The tree still has a root, because every consumer has one to render: a leaf
 * with **empty** text carrying the reason code. The expression's own text is not
 * echoed into it — there is no clause to name, and an unparsed 4KB blob is not
 * one.
 */
function unparsedExplanation(reasonCode: RuleUnevaluableReason): RuleExplanation {
  return {
    tree: {
      node: 'leaf',
      expressionText: '',
      resolvedValue: undefined,
      status: 'not-evaluated',
      reasonCode,
      reads: [],
    },
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
 * @returns The clause {@link RuleExplanation.tree} plus a
 *   {@link RuleExplanationSummary}. Both `expressionText` and `resolvedValue` are
 *   untrusted/PII: render them escaped, never log them, and run them through
 *   `csvUtils.escapeCSV` before export.
 *
 * @example
 * const { tree, summary } = explainRuleExpression(
 *   'user.department == "Engineering" && user.title != "Intern"',
 *   user,
 * );
 * // tree    → { node: 'connective', kind: 'and', verdict: 'fail', children: [
 * //              { node: 'leaf', expressionText: 'user.department == "Engineering"',
 * //                resolvedValue: 'Engineering', status: 'pass', reads: […] }, … ] }
 * // summary → { evaluatedClauses: 2, failedClauses: 1, … }
 */
export function explainRuleExpression(
  expression: string,
  user: OktaUser,
  options?: ExplainRuleOptions,
): RuleExplanation {
  const parsed = parseRuleExpression(expression);
  if (!parsed.ok) return unparsedExplanation(parsed.reasonCode);

  try {
    const limit = clauseLimit(options?.maxClauses);
    const collection: ClauseCollection = { nodes: [], truncated: false };
    collectClauseNodes(parsed.ast, collection, limit);

    const ctx: ExplainContext = {
      user,
      groups: options?.groups,
      clauseCache: new WeakMap(),
      valueCache: new WeakMap(),
    };
    const clauses = collection.nodes.map((node) => clauseCore(node, ctx));

    // Built second, off the same memos: every status below is an evaluation the
    // counts above already paid for.
    const treeState: TreeBuildState = { leafBudget: limit, truncated: false };
    const tree = buildTree(parsed.ast, ctx, treeState);

    return {
      tree,
      summary: summarise(
        clauses,
        evaluateParsedRule(parsed.ast, { user, groups: ctx.groups }),
        collection.truncated || treeState.truncated,
      ),
    };
  } catch {
    // Defensive, mirroring the evaluator: a pathologically nested expression can
    // exhaust the stack. Degrade to "cannot tell", never to a verdict.
    return unparsedExplanation('walk-failed');
  }
}
