/**
 * @module shared/membership/blastRadius
 * @description **What does this profile edit do to this user's group access?**
 *
 * A pure, synchronous, zero-API-call engine. It takes the user as Okta holds
 * them, a proposed patch, their complete membership list and the org's rule
 * inventory, and returns a {@link BlastRadiusReport}: the groups the edit adds
 * or removes, the rules whose verdict moves, and — with equal
 * standing — everything it declined to predict and why.
 *
 * ## It logs nothing. At all.
 *
 * There is no logger import in this file and there must never be one. Every
 * string it touches is end-user-controllable tenant data or PII: rule names,
 * condition expressions, group names, and the drafted attribute values
 * themselves. The report carries **reason codes** (`WithheldReason`,
 * `RuleUnevaluableReason`) rather than rendered sentences precisely so that the
 * only things a caller could reasonably log are compile-time constants. The
 * sentences live in `shared/rules/unevaluableReasonText`.
 *
 * ## The one asymmetry: predicting a gain is cheap, predicting a loss is not
 *
 * An addition needs a rule to start matching and the user not to already hold
 * the group. A **removal** must clear six independent gates
 * ({@link removalEffect}), because taking access away is the claim that costs an
 * admin something if it is wrong — and because the way to get it wrong is
 * always the same: quietly reading "we could not evaluate that other rule" as
 * "that other rule does not hold them". `rule-unevaluable-after` exists to make
 * that impossible (ADR-0017, ADR-0020).
 *
 * ## Three known gaps behind a prediction
 *
 * The report states its predictions. Three structural gaps sit behind that
 * statement and are tracked as engine work, not as report copy:
 *
 * 1. A `MembershipRule` carries no exclusion list — a cache-served
 *    `FormattedRule` drops `conditions.people` entirely — so an exclusion is
 *    invisible here, exactly as `accessCause` documents. It can only ever make
 *    this module over-predict, never under-predict.
 * 2. `ruleEvaluator` is a client-side reimplementation of a documented subset of
 *    Okta EL, not Okta EL.
 * 3. Rule application is asynchronous. Even a correct prediction describes a
 *    state Okta has not reached yet.
 *
 * ## Second-order effects are reported, not resolved
 *
 * Gaining or losing a group can flip an `isMemberOf*` clause in some *other*
 * rule. This engine makes a **single pass** and then merely scans for that
 * possibility ({@link cascadeScan}). It deliberately does not iterate to a
 * fixed point:
 *
 * - an `added` group fed back into a round two is consumed by
 *   `isMemberOf*` as **fact** — those functions are two-valued over the list
 *   they are given (ADR-0021) — so each extra round compounds one round's error
 *   into the next with nothing to bound it;
 * - rule application is scheduled per rule, not transactional, so there is no
 *   moment at which the round-two input state is guaranteed to exist.
 *
 * What ships instead is {@link BlastRadiusReport.cascades}: per affected group,
 * the rules whose condition **reads** that group, and which way this edit turns
 * each of those membership tests. Every part of that is structure, read off the
 * rule text — the direction comes from the clause's own `member`/`non-member`
 * sense, not from evaluating anything a second time. No cascade rule has been
 * evaluated against the post-draft user, and none is claimed to fire.
 *
 * Naming those rules is the honest answer, and it is the one an admin can act on.
 * Two things follow, and both are load-bearing rather than incidental:
 *
 * - the scan under-reports (see {@link cascadeScan}), so a surface may render
 *   what a cascade holds but **never** its absence — "nothing reads this group"
 *   is a claim the scan cannot back;
 * - a count of cascade rules is the same claim in numeric form, so the UI does
 *   not print one.
 *
 * @see {@link module:shared/membership/ruleImpact} — the rule-centric mirror of the removal test.
 * @see {@link module:sidepanel/components/users/comparison/accessCause} — the "why does this user NOT have it" seam.
 * @see {@link module:sidepanel/components/users/membershipVerdict} — the single membership classifier reused here.
 */

import {
  tryEvaluateRuleExpressionDetailed,
  type RuleGroupContext,
  type RuleMatchResult,
} from '../ruleEvaluator';
import {
  explainRuleExpression,
  userAttributeNamesRead,
  type ClauseGroupMatch,
  type ClauseGroupReference,
  type ClauseGroupRequirement,
  type ClauseTreeNode,
  type LeafClauseNode,
} from '../rules/explainExpression';
import { matchSafeRegex } from '../rules/safeRegex';
import { groupContextOf } from './groupContext';
import { conditionExpressionOf } from './ruleExpression';
import {
  isMembershipAttributionDeduced,
  membershipBucket,
} from '../../sidepanel/components/users/membershipVerdict';
import type { GroupMembership, MembershipRule, OktaUser } from '../types';
import type {
  BlastRadiusCounts,
  BlastRadiusInput,
  BlastRadiusReport,
  CascadeDirection,
  GroupCascade,
  GroupCascadeRule,
  GroupEffect,
  GroupEffectKind,
  RuleEffect,
  RuleTransition,
  WithheldReason,
} from './blastRadiusTypes';

// ---------------------------------------------------------------------------
// Shape helpers — each one deliberately mirrors an existing module.
// ---------------------------------------------------------------------------

/**
 * The groups a rule assigns matched users into, from either rule shape. Same
 * accessor as `accessCause.rulesTargeting` and `ruleImpact.toImpactRule`.
 */
function targetGroupIdsOf(rule: MembershipRule): readonly string[] {
  return rule.groupIds || rule.actions?.assignUserToGroups?.groupIds || [];
}

/**
 * The user as they would be after the draft lands.
 *
 * The cast is the narrow one this needs: `draft` is `Record<string, unknown>`
 * because it comes from form state, while `OktaUser['profile']` pins four
 * required strings. Spreading widens those to `unknown` and TypeScript rejects
 * the result even though the runtime object is correct. Nothing downstream trusts
 * the types anyway — `ruleEvaluator` type-checks every operand at evaluation time
 * and answers `operand-type` rather than throwing, which is exactly the honest
 * outcome for a draft that sets `department` to a number.
 *
 * A key present with `undefined` clears the attribute, and reads the same as an
 * absent one — both resolve to `null` (ADR-0004).
 *
 * **Exported so a surface can explain the same user the engine judged.** The
 * Clause Ledger on a rule row re-evaluates the condition to break it into clauses,
 * and it has to do that against byte-identical input or the breakdown could
 * contradict the badge above it. Two spread expressions in two files would be one
 * refactor away from disagreeing.
 */
export function draftedUser(user: OktaUser, draft: Readonly<Record<string, unknown>>): OktaUser {
  return { ...user, profile: { ...user.profile, ...draft } as OktaUser['profile'] };
}

/**
 * Whether this draft could possibly move the rule's verdict.
 *
 * `true` unless the expression's reads are **exactly enumerable** and disjoint from
 * the drafted keys. Both halves of that are deliberate:
 *
 * - The read set comes from the parsed AST, never from the regex scan behind
 *   {@link RuleEffect.touchedAttributes} — a display aid is allowed to miss a read,
 *   and a miss here would claim an edit cannot reach a rule it does reach.
 * - An expression whose reads cannot be listed (unparseable, or a computed key like
 *   `user[x]`) answers `true`. "We cannot enumerate the reads" must never be read as
 *   "there are none", which would silently hide a real effect.
 *
 * A rule the draft *can* reach is still reported however its evaluation turns out;
 * this only decides whether an unreadable pair is a finding.
 */
function draftCouldMove(expression: string, draftKeys: ReadonlySet<string>): boolean {
  const reads = userAttributeNamesRead(expression);
  if (reads === undefined) return true;
  for (const name of reads) if (draftKeys.has(name)) return true;
  return false;
}

/** `user.<name>` reads in an expression — a display aid only. See {@link RuleEffect.touchedAttributes}. */
const USER_ATTRIBUTE_PATTERN = /\buser\.([A-Za-z_$][A-Za-z0-9_$]*)/g;

/**
 * Which drafted attribute names this rule appears to read.
 *
 * Approximate on purpose, and used for **nothing but display**. The union of the
 * rule's derived `userAttributes` and a textual scan of the expression is
 * intersected with the draft's keys. The engine never pre-filters rules on it:
 * `userAttributes` is derived data and a miss there would drop a real effect,
 * whereas a miss here only costs a label.
 */
function touchedAttributesOf(
  rule: MembershipRule,
  expression: string,
  draftKeys: ReadonlySet<string>,
): readonly string[] {
  const named = new Set(rule.userAttributes ?? []);
  for (const match of expression.matchAll(USER_ATTRIBUTE_PATTERN)) named.add(match[1]);
  return [...named].filter((name) => draftKeys.has(name)).sort();
}

/**
 * The two verdicts, paired.
 *
 * `undetermined` absorbs an `unevaluable` on **either** side, and it is checked
 * first: a pair with one unknown half cannot be compared, and calling such a
 * pair `unchanged-no-match` would be the exact "unevaluable became a no" this
 * module exists to prevent.
 */
function transitionOf(
  before: RuleMatchResult,
  after: RuleMatchResult,
  movable: boolean,
): RuleTransition {
  if (before.outcome === 'unevaluable' || after.outcome === 'unevaluable') {
    // An unreadable rule the edit provably cannot reach is settled, even though its
    // verdict is not: whatever that verdict is, this draft does not move it. Saying
    // so is a claim about the edit and not about the rule — it never becomes
    // `unchanged-no-match`, which would assert the user fails a condition nobody
    // read. See {@link RuleTransition}.
    return movable ? 'undetermined' : 'unchanged-unevaluable';
  }
  if (before.outcome === after.outcome) {
    return before.outcome === 'match' ? 'unchanged-match' : 'unchanged-no-match';
  }
  return after.outcome === 'match' ? 'starts-matching' : 'stops-matching';
}

// ---------------------------------------------------------------------------
// The rule pass
// ---------------------------------------------------------------------------

/** One rule, its report row, and the post-draft verdict the group pass re-reads. */
interface RuleEvaluation {
  readonly effect: RuleEffect;
  /** The post-draft verdict, kept so the blocking-rule test needs no re-evaluation. */
  readonly after: RuleMatchResult;
  readonly targetGroupIds: readonly string[];
}

/**
 * Evaluate one rule twice against the **same** group context.
 *
 * The context is deliberately the *pre-draft* membership list on both sides: a
 * profile patch does not move the user between groups, and feeding a predicted
 * membership back in is the fixed-point iteration this module refuses to do.
 */
function evaluateRule(
  rule: MembershipRule,
  user: OktaUser,
  drafted: OktaUser,
  context: RuleGroupContext,
  groupNames: ReadonlyMap<string, string>,
  draftKeys: ReadonlySet<string>,
): RuleEvaluation {
  const expression = conditionExpressionOf(rule);
  const before = tryEvaluateRuleExpressionDetailed(expression, user, context);
  const after = tryEvaluateRuleExpressionDetailed(expression, drafted, context);
  const targetGroupIds = targetGroupIdsOf(rule);

  return {
    after,
    targetGroupIds,
    effect: {
      ruleId: rule.id,
      ruleName: rule.name,
      expression,
      transition: transitionOf(before, after, draftCouldMove(expression, draftKeys)),
      ...(before.outcome === 'unevaluable' ? { beforeReason: before.reasonCode } : {}),
      ...(after.outcome === 'unevaluable' ? { afterReason: after.reasonCode } : {}),
      targetGroupIds,
      targetGroupNames: targetGroupIds.map((id) => groupNames.get(id) ?? id),
      touchedAttributes: touchedAttributesOf(rule, expression, draftKeys),
      active: rule.status === 'ACTIVE',
      status: rule.status,
    },
  };
}

// ---------------------------------------------------------------------------
// The group pass
// ---------------------------------------------------------------------------

/** Everything both group decisions read, gathered once. */
interface GroupPassContext {
  readonly evaluations: readonly RuleEvaluation[];
  readonly membershipByGroupId: ReadonlyMap<string, GroupMembership>;
  readonly groupNames: ReadonlyMap<string, string>;
}

/** The fields every {@link GroupEffect} carries, whatever the verdict. */
function baseEffect(
  groupId: string,
  candidates: readonly RuleEvaluation[],
  context: GroupPassContext,
): Omit<GroupEffect, 'kind'> {
  const held = context.membershipByGroupId.get(groupId);
  return {
    groupId,
    groupName: held?.group.profile.name ?? context.groupNames.get(groupId) ?? groupId,
    contributingRuleIds: candidates.map((candidate) => candidate.effect.ruleId),
    // A single implicated rule is a fact worth naming; two or more would make
    // `ruleId` an artefact of inventory order, so it is left absent.
    ...(candidates.length === 1
      ? { ruleId: candidates[0].effect.ruleId, ruleName: candidates[0].effect.ruleName }
      : {}),
    ...(held ? { currentBucket: membershipBucket(held) } : {}),
    currentlyHeld: held !== undefined,
  };
}

/** A withheld verdict — `not-predicted` always names why. */
function withheld(
  groupId: string,
  candidates: readonly RuleEvaluation[],
  context: GroupPassContext,
  withheldReason: WithheldReason,
  blockingRuleName?: string,
): GroupEffect {
  return {
    ...baseEffect(groupId, candidates, context),
    kind: 'not-predicted',
    withheldReason,
    ...(blockingRuleName === undefined ? {} : { blockingRuleName }),
  };
}

/** A predicted verdict, attributed to the rules that actually drive it. */
function predicted(
  groupId: string,
  candidates: readonly RuleEvaluation[],
  context: GroupPassContext,
  kind: Extract<GroupEffectKind, 'added' | 'removed'>,
): GroupEffect {
  return { ...baseEffect(groupId, candidates, context), kind };
}

/**
 * What a set of `starts-matching` rules does to one group the rules target.
 *
 * Gate order:
 *
 * 1. **The user already holds the group → nothing is emitted.** You cannot gain
 *    what you have; there is no effect to report, hedged or otherwise. This gate
 *    runs *before* the `rule-inactive` one, inverting the order the brief listed
 *    them in, because "already a member" is a fact about the world while
 *    `rule-inactive` is a hedge — and hedging about a group the user is already
 *    in states nothing.
 * 2. **No ACTIVE rule among the candidates → `rule-inactive`.** An `INACTIVE`
 *    rule places nobody, so its verdict flipping grants nothing.
 * 3. Otherwise → `added`.
 *
 * **The table's `app-mastered-group` row is deliberately absent here, and it is
 * a known gap rather than an omission.** A group's `type` reaches this module
 * only on a `GroupMembership`; {@link BlastRadiusInput.groupNames} carries names
 * and a `MembershipRule` carries no type at all. So for a group the user does
 * *not* hold — the only groups that survive gate 1 — the type is simply unknown,
 * and gate 1 has already consumed every case where it would have been knowable.
 * If a future input supplies types for unheld groups, the row belongs between
 * gates 2 and 3. The removal path, where a membership is in hand by definition,
 * enforces it fully.
 */
function additionEffect(
  groupId: string,
  candidates: readonly RuleEvaluation[],
  context: GroupPassContext,
): GroupEffect | undefined {
  if (context.membershipByGroupId.has(groupId)) return undefined;

  const active = candidates.filter((candidate) => candidate.effect.active);
  if (active.length === 0) return withheld(groupId, candidates, context, 'rule-inactive');

  return predicted(groupId, active, context, 'added');
}

/**
 * What a set of `stops-matching` rules does to one group the user holds — the
 * user-centric mirror of `ruleImpact.classifyGroupImpact`'s
 * `heldSolelyByRule`/`unaffected` split, asked one member at a time.
 *
 * **`removed` requires all six gates to clear.** Each failure names its
 * own reason rather than falling through to a quiet "no change":
 *
 * 1. The user does not hold the group → nothing is emitted. A removal is
 *    meaningless for a group they are not in, and this runs first for the same
 *    reason gate 1 of {@link additionEffect} does — it is the existence question,
 *    and every gate below it is about evidence.
 * 2. No ACTIVE rule among the candidates → `rule-inactive`.
 * 3. `APP_GROUP` → `app-mastered-group`. The application owns the roster;
 *    `classifyGroupImpact` returns the identical answer from the rule side.
 * 4. `membershipBucket(m) !== 'rule'` → `membership-not-credited-to-rule`. A
 *    manual add is not taken away by a rule ceasing to match.
 * 5. `isMembershipAttributionDeduced(m)` → `membership-attribution-deduced`.
 *    Past gate 4 the membership is rule-bucketed, but its rule may only have been
 *    *worked out* — `inferred` names a best guess and `ambiguous` names a
 *    candidate set. A deduced cause cannot carry an asserted consequence
 *    (ADR-0020).
 *
 *    **This gate asks the classifier a structural question and must keep doing
 *    so.** It once read `membershipVerdict(m).label !== 'Rule'`, which made a
 *    correctness decision out of badge copy: `inferred` declined only because
 *    its badge then said `Rule?`, and the day that badge stopped hedging, the
 *    gate started asserting removals it was written to withhold — silently,
 *    because no test covered `inferred` here. `blastRadius.test.ts` §3 now pins
 *    both deducing classes.
 * 6. Another ACTIVE rule targeting the group **still matches** the drafted user
 *    → `another-active-rule-still-matches`, naming it; or another ACTIVE rule
 *    targeting the group is **unevaluable** against the drafted user →
 *    `rule-unevaluable-after`.
 *
 * **6b is the gate that gets missed, and it is the whole point.** If a rule
 * feeding this group cannot be evaluated, we do not know that it fails to hold
 * them. Predicting removal anyway converts an `unevaluable` into a "no" — the
 * single conversion ADR-0017 and ADR-0020 forbid. A definite blocker is checked
 * first only because naming the rule is more useful than shrugging at it.
 *
 * Gates 4 and 5 both go through `membershipVerdict`'s classifier rather than
 * re-reading `membershipType`/`attribution`/`provenance` here. A second reading
 * of those three fields is precisely the drift that module exists to prevent —
 * and it is what would let this engine predict a removal for a membership the
 * Groups pane is displaying as `Direct`.
 *
 * **Exclusion lists are not consulted.** A `FormattedRule` does not carry one,
 * so the check would be vacuous for the inventory this normally runs on; and
 * where it is present, counting an excluding-but-matching rule as a blocker
 * merely withholds a prediction. That is the safe direction, so the cheap
 * reading is also the conservative one.
 */
function removalEffect(
  groupId: string,
  candidates: readonly RuleEvaluation[],
  context: GroupPassContext,
): GroupEffect | undefined {
  const held = context.membershipByGroupId.get(groupId);
  if (!held) return undefined;

  const active = candidates.filter((candidate) => candidate.effect.active);
  if (active.length === 0) return withheld(groupId, candidates, context, 'rule-inactive');

  const decline = (reason: WithheldReason, blockingRuleName?: string): GroupEffect =>
    withheld(groupId, active, context, reason, blockingRuleName);

  if (held.group.type === 'APP_GROUP') return decline('app-mastered-group');
  if (membershipBucket(held) !== 'rule') return decline('membership-not-credited-to-rule');
  if (isMembershipAttributionDeduced(held)) return decline('membership-attribution-deduced');

  const stopping = new Set(active.map((candidate) => candidate.effect.ruleId));
  const others = context.evaluations.filter(
    (evaluation) =>
      evaluation.effect.active &&
      !stopping.has(evaluation.effect.ruleId) &&
      evaluation.targetGroupIds.includes(groupId),
  );

  const blocker = others.find((evaluation) => evaluation.after.outcome === 'match');
  if (blocker) {
    return decline('another-active-rule-still-matches', blocker.effect.ruleName);
  }
  if (others.some((evaluation) => evaluation.after.outcome === 'unevaluable')) {
    return decline('rule-unevaluable-after');
  }

  return predicted(groupId, active, context, 'removed');
}

// ---------------------------------------------------------------------------
// Second order
// ---------------------------------------------------------------------------

/**
 * The affected groups, as the `isMemberOf*` arguments would have to name them.
 *
 * {@link kind} is load-bearing, not decoration: the cascade's direction is the
 * XOR of it and the reading clause's own `member`/`non-member` sense, so a group
 * that lost its kind here would lose the direction downstream.
 */
interface AffectedGroup {
  readonly id: string;
  readonly name: string;
  /** Whether this edit adds the group or takes it away. Never `not-predicted`. */
  readonly kind: 'added' | 'removed';
}

/**
 * Whether one `isMemberOf*` argument names an affected group.
 *
 * The same switch `explainExpression.findMatchingGroup` and `ruleEvaluator`'s
 * `GROUP_MEMBERSHIP_IMPLEMENTATIONS` use, both module-private. Name comparisons
 * are case-sensitive for the reason stated there: two groups differing only in
 * case are two different groups.
 *
 * `nameRegex` runs the tenant pattern through the linear-time engine (ADR-0002),
 * full-match, never a `RegExp`. A decline there reads as "does not name this
 * group", which under-reports a possible cascade rather than inventing one — the
 * same safe direction as this scan's other blind spot, documented on
 * {@link cascadeScan}.
 */
function referenceNames(reference: ClauseGroupReference, group: AffectedGroup): boolean {
  switch (reference.match) {
    case 'id':
      return group.id === reference.value;
    case 'name':
      return group.name === reference.value;
    case 'nameStartsWith':
      return group.name.startsWith(reference.value);
    case 'nameContains':
      return group.name.includes(reference.value);
    case 'nameRegex': {
      const result = matchSafeRegex(reference.value, group.name);
      return result.kind === 'match' && result.matched;
    }
  }
}

/**
 * Every leaf anywhere in one rule's explanation that names groups, in source
 * order.
 *
 * Walks the whole clause tree rather than its top level. A membership call nested
 * inside an `||` — `user.department == "Sales" || isMemberOfGroup("…")` — is a
 * leaf of that group, and a flat top-level projection cannot see it.
 *
 * Collects **leaves**, not bare references, because a reference alone cannot say
 * which way its clause asks: `groupRequirement` lives on the leaf and is what
 * separates "this rule wants the group" from "this rule excludes it". Reading the
 * references without it is the conflation {@link directionOf} exists to end.
 */
function membershipLeavesUnder(node: ClauseTreeNode): readonly LeafClauseNode[] {
  if (node.node === 'leaf') return node.groupReferences?.length ? [node] : [];
  return node.children.flatMap(membershipLeavesUnder);
}

/**
 * Which way this edit turns one clause's test of one affected group.
 *
 * The whole rule in one line: a clause wanting membership of a group the edit
 * *grants*, and a clause wanting non-membership of a group the edit *takes away*,
 * both move toward being satisfied. The other two pairings move away.
 *
 * A leaf carrying references always carries a requirement (the type pairs them),
 * so the `undefined` arm is unreachable in practice — it answers `undetermined`
 * rather than guessing a direction, because a missing sense is exactly the
 * half-known pair no caller may read a direction off.
 *
 * Note what this does **not** need: any correction for negation nesting. A
 * directly negated call folds into the leaf's own `non-member`, and a negated
 * *connective* (`!(a || b)`) yields no group references at all — so a reference
 * that exists is always already correctly signed.
 */
function directionOf(
  kind: AffectedGroup['kind'],
  requirement: ClauseGroupRequirement | undefined,
): CascadeDirection {
  if (!requirement) return 'undetermined';
  return (kind === 'added') === (requirement === 'member') ? 'toward-match' : 'away-from-match';
}

/** Transitions worth scanning: a rule already moving is reported on its own row. */
const SECOND_ORDER_TRANSITIONS: ReadonlySet<RuleTransition> = new Set<RuleTransition>([
  'unchanged-match',
  'unchanged-no-match',
  'undetermined',
  // Out of the edit's reach, but still standing: its condition can name a group
  // this edit moves, which is exactly what a one-hop cascade reports.
  'unchanged-unevaluable',
]);

/**
 * The one-hop cascade: per affected group, the rules whose condition reads it.
 *
 * Single pass, by design — see the module header for why a round two would
 * compound its own error. This names structure; it resolves nothing.
 *
 * Three exclusions, each for its own reason. A rule already moving is skipped
 * ({@link SECOND_ORDER_TRANSITIONS}) because it has its own report row. An
 * inactive rule is skipped because it places nobody, so its verdict flipping
 * changes nothing — the same ground the `rule-inactive` withheld reason stands
 * on. And a group we declined to predict never reaches here at all, because a
 * change we would not assert cannot seed a consequence.
 *
 * Two blind spots remain, both inherited and both in the safe direction — they
 * under-report a possibility rather than inventing one:
 *
 * 1. a negated **connective** (`!(isMemberOfGroup("…") || …)`) carries no
 *    structured group references, so its membership tests are invisible here;
 * 2. an `isMemberOfGroupNameRegex` pattern the linear-time engine declines
 *    (ADR-0002) likewise carries none — a runnable one does.
 *
 * Both are why {@link BlastRadiusReport.cascades} may only ever be rendered as
 * what it holds, never as an absence: a surface that printed "nothing reads this
 * group" would convert either gap into a false claim.
 *
 * @param evaluations - Every rule's report row.
 * @param affected - The groups predicted to be added or removed, with their kind.
 * @param drafted - The post-draft user, so the clause rows describe the state the cascade would start from.
 * @param context - The user's group list, for `isMemberOf*`.
 * @returns One entry per affected group that any rule reads, in `affected` order.
 */
function cascadeScan(
  evaluations: readonly RuleEvaluation[],
  affected: readonly AffectedGroup[],
  drafted: OktaUser,
  context: RuleGroupContext,
): GroupCascade[] {
  if (affected.length === 0) return [];

  // groupId -> ruleId -> what we know so far about that pair.
  const found = new Map<
    string,
    Map<string, { direction: CascadeDirection; matchedBy: ClauseGroupMatch }>
  >();

  for (const evaluation of evaluations) {
    if (!SECOND_ORDER_TRANSITIONS.has(evaluation.effect.transition)) continue;
    if (!evaluation.effect.active) continue;

    const { tree } = explainRuleExpression(evaluation.effect.expression, drafted, {
      groups: context,
    });

    for (const leaf of membershipLeavesUnder(tree)) {
      for (const reference of leaf.groupReferences ?? []) {
        for (const group of affected) {
          if (!referenceNames(reference, group)) continue;

          const direction = directionOf(group.kind, leaf.groupRequirement);
          let perRule = found.get(group.id);
          if (!perRule) {
            perRule = new Map();
            found.set(group.id, perRule);
          }
          const existing = perRule.get(evaluation.effect.ruleId);
          if (!existing) {
            perRule.set(evaluation.effect.ruleId, { direction, matchedBy: reference.match });
            continue;
          }
          // Absorbing, exactly as `transitionOf` treats a half-known pair: one
          // rule reading the group both ways has no single direction, and
          // picking either would be a coin-flip dressed as a finding.
          if (existing.direction !== direction) {
            perRule.set(evaluation.effect.ruleId, {
              direction: 'undetermined',
              matchedBy: existing.matchedBy,
            });
          }
        }
      }
    }
  }

  // Built once: the sort below needs a rule's display name per comparison, and
  // scanning `evaluations` inside a comparator would make this quadratic.
  const ruleNames = new Map(
    evaluations.map((evaluation) => [evaluation.effect.ruleId, evaluation.effect.ruleName]),
  );

  // `affected` is already in report order, so iterating it keeps the cascades
  // aligned with the group rows they belong to.
  const cascades: GroupCascade[] = [];
  for (const group of affected) {
    const perRule = found.get(group.id);
    if (!perRule || perRule.size === 0) continue;

    const rules: GroupCascadeRule[] = [...perRule.entries()]
      .map(([ruleId, pair]) => ({ ruleId, ...pair }))
      .sort((a, b) =>
        // Rank is meaningless inside one cascade, so a constant keeps
        // `compareRanked`'s name-then-id tie-break — which is what makes the
        // order total when two rules share a display name.
        compareRanked(
          { rank: 0, name: ruleNames.get(a.ruleId) ?? '', id: a.ruleId },
          { rank: 0, name: ruleNames.get(b.ruleId) ?? '', id: b.ruleId },
        ),
      );
    cascades.push({ groupId: group.id, rules });
  }
  return cascades;
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/** Report order for {@link BlastRadiusReport.groups}: what changed, then what we declined to call. */
const KIND_ORDER: Record<GroupEffectKind, number> = {
  added: 0,
  removed: 1,
  'not-predicted': 2,
};

/** Report order for {@link BlastRadiusReport.rules}: what moved, what we could not tell, then the rest. */
const TRANSITION_ORDER: Record<RuleTransition, number> = {
  'starts-matching': 0,
  'stops-matching': 1,
  undetermined: 2,
  'unchanged-match': 3,
  'unchanged-no-match': 4,
  // Last: the rule is out of this edit's reach, so it is the least of the "no
  // change" rows rather than one of the findings above.
  'unchanged-unevaluable': 5,
};

/** A sortable position: coarse rank first, then the human-facing label. */
interface Ranked {
  readonly rank: number;
  readonly name: string;
  readonly id: string;
}

/**
 * Rank, then name, then id. The id tie-break is what makes the order **total**:
 * two entries may legitimately share a display name, and without it their
 * relative order would depend on the input array and the sort's stability.
 */
function compareRanked(a: Ranked, b: Ranked): number {
  return a.rank - b.rank || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** All-zero tallies, for the two statuses that report nothing. */
const NO_COUNTS: BlastRadiusCounts = {
  added: 0,
  removed: 0,
  notPredicted: 0,
  starts: 0,
  stops: 0,
  undetermined: 0,
};

/** A report that states nothing — the shape both non-`computed` statuses take. */
function emptyReport(status: 'not-computed' | 'unavailable'): BlastRadiusReport {
  return {
    status,
    groups: [],
    rules: [],
    counts: NO_COUNTS,
    cascades: [],
  };
}

/** Append `value` to the list at `key`, creating it on first use. */
function push<T>(index: Map<string, T[]>, key: string, value: T): void {
  const existing = index.get(key);
  if (existing) existing.push(value);
  else index.set(key, [value]);
}

/**
 * Predict what a profile edit does to one user's group access.
 *
 * Pure and synchronous: no API calls, no storage, no logging, no code
 * execution. Every rule in the inventory is evaluated twice — once against the
 * user, once against the user with the draft applied — using the same group
 * context both times.
 *
 * **The inventory is never pre-filtered on `userAttributes`.** That field is
 * derived, and a miss in it would silently drop a real effect; it is used for
 * `touchedAttributes` labelling only.
 *
 * @param input - See {@link BlastRadiusInput}. `memberships` must be the user's
 *   complete list, or every `isMemberOf*` clause becomes a confident false
 *   (ADR-0021).
 * @returns A {@link BlastRadiusReport}. Under `not-computed` / `unavailable`
 *   every array is empty; only `computed` may be read as a finding. Every string
 *   in it is untrusted tenant data or PII: render escaped, escape for CSV, never
 *   log.
 *
 * @example
 * ```ts
 * const report = analyzeBlastRadius({
 *   user,
 *   draft: { department: 'Sales' },
 *   memberships,
 *   rules: ruleInventory,
 *   groupNames: await loadCachedGroupNames(),
 * });
 * report.counts.removed; // groups this edit takes away
 * report.groups.filter((g) => g.kind === 'not-predicted'); // and what we would not call
 * ```
 */
export function analyzeBlastRadius(input: BlastRadiusInput): BlastRadiusReport {
  // The three inventory states never collapse into two: "not yet" must not be
  // rendered as a finding, and "we tried and failed" must not be rendered as
  // "nothing to report".
  if (input.rules.status === 'unresolved') return emptyReport('not-computed');
  if (input.rules.status === 'unavailable') return emptyReport('unavailable');

  const groupContext = groupContextOf(input.memberships);
  const drafted = draftedUser(input.user, input.draft);
  const draftKeys = new Set(Object.keys(input.draft));

  const evaluations = input.rules.rules.map((rule) =>
    evaluateRule(rule, input.user, drafted, groupContext, input.groupNames, draftKeys),
  );

  const membershipByGroupId = new Map<string, GroupMembership>();
  for (const membership of input.memberships) {
    // First wins: a duplicated group id in the list is Okta repeating itself,
    // not two memberships, and the later copy carries no extra evidence.
    if (!membershipByGroupId.has(membership.group.id)) {
      membershipByGroupId.set(membership.group.id, membership);
    }
  }

  const context: GroupPassContext = {
    evaluations,
    membershipByGroupId,
    groupNames: input.groupNames,
  };

  // Candidates are gathered per group before any verdict is reached, so a group
  // fed by two rules is decided once rather than reported twice.
  const additions = new Map<string, RuleEvaluation[]>();
  const removals = new Map<string, RuleEvaluation[]>();
  for (const evaluation of evaluations) {
    const index =
      evaluation.effect.transition === 'starts-matching'
        ? additions
        : evaluation.effect.transition === 'stops-matching'
          ? removals
          : undefined;
    if (!index) continue;
    for (const groupId of evaluation.targetGroupIds) push(index, groupId, evaluation);
  }

  const groups: GroupEffect[] = [];
  for (const [groupId, candidates] of additions) {
    const effect = additionEffect(groupId, candidates, context);
    if (effect) groups.push(effect);
  }
  for (const [groupId, candidates] of removals) {
    const effect = removalEffect(groupId, candidates, context);
    if (effect) groups.push(effect);
  }
  // An addition and a removal can never both survive for the same group — one
  // requires the user to hold it and the other requires them not to — so no
  // de-duplication pass is needed here.

  const groupRank = (group: GroupEffect): Ranked => ({
    rank: KIND_ORDER[group.kind],
    name: group.groupName,
    id: group.groupId,
  });
  groups.sort((a, b) => compareRanked(groupRank(a), groupRank(b)));

  const ruleRank = (rule: RuleEffect): Ranked => ({
    rank: TRANSITION_ORDER[rule.transition],
    name: rule.ruleName,
    id: rule.ruleId,
  });
  const rules = evaluations
    .map((evaluation) => evaluation.effect)
    .sort((a, b) => compareRanked(ruleRank(a), ruleRank(b)));

  const affected: AffectedGroup[] = groups
    .filter(
      (group): group is GroupEffect & { kind: 'added' | 'removed' } =>
        group.kind !== 'not-predicted',
    )
    .map((group) => ({ id: group.groupId, name: group.groupName, kind: group.kind }));
  const cascades = cascadeScan(evaluations, affected, drafted, groupContext);

  const countKind = (kind: GroupEffectKind): number =>
    groups.filter((group) => group.kind === kind).length;
  const countTransition = (transition: RuleTransition): number =>
    rules.filter((rule) => rule.transition === transition).length;

  return {
    status: 'computed',
    groups,
    rules,
    counts: {
      added: countKind('added'),
      removed: countKind('removed'),
      notPredicted: countKind('not-predicted'),
      starts: countTransition('starts-matching'),
      stops: countTransition('stops-matching'),
      undetermined: countTransition('undetermined'),
    },
    cascades,
  };
}
