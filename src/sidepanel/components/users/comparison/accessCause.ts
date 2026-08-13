/**
 * @module sidepanel/components/users/comparison/accessCause
 * @description Why does one user have access the other does not — grouped by what you would DO about it.
 *
 * The comparison can already say *what* differs. This module answers *why*, and
 * deliberately organises the answer by **remedy** rather than by cause: an admin
 * reading a comparison is deciding what to change, and two different causes that
 * need the same action belong on the same worklist line.
 *
 * ## `cannot-determine` never folds into the others
 *
 * The whole point of this seam is that "we could not work it out" is a first-class
 * answer, never quietly rounded to the nearest confident one. An unevaluable
 * clause (`isMemberOfGroup(...)`, an unsupported operator, an unparseable
 * expression) means the user *might* qualify — reporting that as
 * `blocked-by-attribute` would tell an admin to go change a profile value that was
 * never the problem. See {@link AccessRemedy.cannot-determine}.
 *
 * @see {@link module:shared/rules/explainExpression} — the clause-level engine this builds on.
 * @see {@link module:shared/utils/membershipAnalysis} — `ATTRIBUTION_SEMANTICS`, the exhaustive attribution table.
 */

import {
  explainRuleExpression,
  type ClauseExplanation,
  type ClauseGroupReference,
} from '../../../../shared/rules/explainExpression';
import type { RuleGroupContext } from '../../../../shared/ruleEvaluator';
import { isDeducedAttribution } from '../../../../shared/utils/membershipAnalysis';
import type { GroupMembership, MembershipRule, OktaUser } from '../../../../shared/types';

/**
 * What an admin would DO to close an access difference.
 *
 * Ordered from most to least actionable. Grouping by remedy rather than by cause
 * is deliberate: "their department is wrong" and "their title is wrong" are
 * different causes needing the same action, and belong together on a worklist.
 *
 * ## The remedy follows the PROVENANCE, not merely the rules
 *
 * The first cut asked only "does a rule target this group, and does the context
 * user fail it?". That reported `blocked-by-attribute` for a group the other user
 * had been **added to by hand** — telling an admin to go change a profile value
 * when no rule granted the access in the first place, so no attribute fix could
 * reproduce it. How the compared user actually holds the membership
 * (`membershipType`, `attribution`, `group.type`) is therefore consulted *first*,
 * and rule assessment only refines the rule-based case.
 *
 * - `blocked-by-attribute` — a rule grants the other user the group, and this
 *   user's profile fails at least one clause that was **actually evaluated**.
 *   Remedy: fix the profile value (or the rule). Only ever assigned on a `fail`,
 *   never on a `not-evaluated`.
 * - `needs-group-membership` — the failing clause is an `isMemberOf*` call: they
 *   qualify once they are in one of the groups it names. Remedy: grant the
 *   prerequisite group. Distinguished from `blocked-by-attribute` because no
 *   profile edit closes it.
 * - `excluded-by-rule` — the user is on a targeting rule's explicit exclusion
 *   list, so they would otherwise qualify. Remedy: remove the exclusion.
 * - `manual-add` — the other user was added by hand. Remedy: add this user by hand
 *   too. Claimed **whether or not** a rule also targets the group: a rule that did
 *   not grant their access is not the thing to reproduce.
 * - `app-managed` — the group is mastered by an application, which manages its own
 *   members. Remedy: neither a profile edit nor a manual add — assign the app.
 * - `cannot-determine` — at least one relevant clause could not be evaluated, the
 *   attribution was `ambiguous`, or the rule inventory was unavailable. Remedy:
 *   none that can be named — investigate. **Never** merged into another bucket,
 *   and never presented as a failure.
 */
export type AccessRemedy =
  | 'blocked-by-attribute'
  | 'needs-group-membership'
  | 'excluded-by-rule'
  | 'manual-add'
  | 'app-managed'
  | 'cannot-determine';

/**
 * Why `cannot-determine` was reached, so the UI can say something more useful
 * than a shrug. Codes only — never interpolate expression text or profile values.
 */
export type UndeterminedReason =
  | 'unevaluable-clause'
  | 'needs-group-context'
  | 'ambiguous-attribution'
  | 'no-rule-inventory'
  | 'no-condition';

/**
 * One access difference, classified by what would close it.
 *
 * Carries the evidence rather than a pre-rendered sentence, so the UI decides
 * wording and the module stays free of copy. Nothing here may be logged: clause
 * text and resolved values are tenant data and PII respectively.
 */
export interface AccessCause {
  /** The group the compared user has and the context user does not. */
  readonly groupId: string;
  /** Group display name. **Untrusted** — render escaped, never log. */
  readonly groupName: string;
  /** What to do about it. */
  readonly remedy: AccessRemedy;
  /**
   * Present exactly when `remedy` is `cannot-determine` — why we could not say.
   * Absent otherwise.
   */
  readonly undeterminedReason?: UndeterminedReason;
  /** The rule this hinges on, when exactly one is implicated. */
  readonly ruleId?: string;
  /** Rule display name. **Untrusted** — render escaped, never log. */
  readonly ruleName?: string;
  /**
   * The clauses that actually failed, for `blocked-by-attribute` and
   * `needs-group-membership`. Empty for every other remedy. **Never** populated
   * from `not-evaluated` rows — that is the distinction this module exists to
   * preserve.
   *
   * **PII:** `resolvedValue` is profile data. Render escaped, never log, and
   * escape for CSV.
   */
  readonly failingClauses: readonly ClauseExplanation[];
  /**
   * The groups a failing `isMemberOf*` clause asks about — "they would need to be
   * in one of these to qualify".
   *
   * Every candidate is listed with its own `satisfied` flag rather than only the
   * unsatisfied ones, because an `isMemberOfAnyGroup` that failed did so with
   * *none* satisfied, and showing the whole set is what makes that legible.
   * Non-empty exactly when a failing clause named groups, which is usually — but
   * not only — the `needs-group-membership` remedy: a rule that fails on both a
   * profile clause and a group clause reports `blocked-by-attribute` and still
   * lists them here.
   *
   * Optional rather than always-an-array so that every existing `AccessCause`
   * literal stays valid: absent and empty mean the same thing here — no failing
   * clause named a group — unlike the `[]`-vs-`null` distinctions elsewhere in
   * this module, where the difference is knowledge versus ignorance.
   *
   * **Untrusted:** ids and names are tenant data. Render escaped, never log.
   */
  readonly requiredGroups?: readonly ClauseGroupReference[];
}

/** Input for {@link classifyAccessCauses}. */
export interface AccessCauseInput {
  /**
   * Memberships the compared user has that the context user does not — the
   * `onlyCompared` bucket from `bucketGroups`.
   */
  readonly onlyCompared: readonly GroupMembership[];
  /** The user who LACKS the access — the one whose profile is evaluated. */
  readonly contextUser: OktaUser;
  /**
   * **All** of the context user's group memberships, which turn `isMemberOf*`
   * clauses from unevaluable shrugs into real verdicts.
   *
   * Must be their complete membership set — the same list the comparison bucketed
   * — because a rule clause finding no match here is reported as a failure the
   * admin can act on. Omit it rather than passing a subset; see
   * {@link RuleGroupContext}.
   */
  readonly contextGroups?: readonly GroupMembership[];
  /**
   * Every rule known to target the groups in question. `null` means the rule
   * inventory could not be obtained, which yields `cannot-determine` /
   * `no-rule-inventory` for every row rather than a confident `manual-add`.
   */
  readonly rules: readonly MembershipRule[] | null;
}

/**
 * Classify each access difference by the action that would close it.
 *
 * Pure: no API calls, no logging, no I/O. Evaluates the context user's profile
 * against the rules feeding each group the compared user is in.
 *
 * @param input - See {@link AccessCauseInput}.
 * @returns One {@link AccessCause} per input membership, in input order.
 */
export function classifyAccessCauses(input: AccessCauseInput): AccessCause[] {
  const { onlyCompared, contextUser, rules, contextGroups } = input;
  // Built once for the whole batch: it is the same user's group list for every
  // membership, and rebuilding it per row would re-map it dozens of times.
  const groupContext = contextGroups ? groupContextOf(contextGroups) : undefined;
  return onlyCompared.map((membership) =>
    classifyOne(membership, contextUser, rules, groupContext),
  );
}

/** The context user's memberships in the shape the evaluator matches against. */
function groupContextOf(memberships: readonly GroupMembership[]): RuleGroupContext {
  return memberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.profile.name,
  }));
}

/**
 * A rule's condition expression, whichever shape the rule arrived in. Mirrors
 * `membershipAnalysis`'s module-private helper. An empty result means the rule
 * carries **no** condition — `unevaluable`, never "matches nothing".
 */
function conditionExpressionOf(rule: MembershipRule): string {
  return rule.conditionExpression || rule.conditions?.expression?.value || '';
}

/**
 * ACTIVE rules that assign users into `groupId`, in inventory order.
 *
 * Same targeting test as `membershipAnalysis.classify`: an INACTIVE rule grants
 * nothing, so it can neither block a user nor explain a membership.
 */
function rulesTargeting(rules: readonly MembershipRule[], groupId: string): MembershipRule[] {
  return rules.filter((rule) => {
    if (rule.status !== 'ACTIVE') return false;
    const groupIds = rule.groupIds || rule.actions?.assignUserToGroups?.groupIds || [];
    return groupIds.includes(groupId);
  });
}

/**
 * Whether the user is on a rule's explicit exclusion list. Only a **raw** Okta
 * rule carries `conditions.people`; a cache-served `FormattedRule` drops it, so
 * this answers `false` there — the same known hole as
 * `membershipAnalysis.isUserExcludedFromRule`, which can only ever miss an
 * exclusion, never invent one.
 */
function isUserExcludedFromRule(rule: MembershipRule, userId: string): boolean {
  return (rule.conditions?.people?.users?.exclude || []).includes(userId);
}

/**
 * What one targeting rule says about the context user. `grants` is the
 * contradictory case — the rule matches a user who is not in the group — and is
 * deliberately *not* an answer: an attribute fix cannot be the remedy for a rule
 * that already accepts them.
 */
type RuleAssessment =
  | { readonly kind: 'excluded'; readonly rule: MembershipRule }
  | {
      readonly kind: 'blocked';
      readonly rule: MembershipRule;
      readonly failingClauses: readonly ClauseExplanation[];
      /**
       * Whether **every** failing clause was a group-membership call. Decides
       * `needs-group-membership` over `blocked-by-attribute`: a rule that also
       * fails a profile clause needs the profile fixed, so it keeps the attribute
       * remedy and merely lists the groups alongside.
       */
      readonly onlyGroupClausesFailed: boolean;
      /** The groups those failing clauses named, in clause order. */
      readonly requiredGroups: readonly ClauseGroupReference[];
    }
  | { readonly kind: 'grants'; readonly rule: MembershipRule }
  | {
      readonly kind: 'unknown';
      readonly rule: MembershipRule;
      readonly reason: UndeterminedReason;
    };

/**
 * Assess one targeting rule against the user who lacks the access.
 *
 * The pivotal line is the `no-match` gate. `blocked` is claimed only when the
 * engine's three-valued verdict for the **whole** condition is `no-match` — the
 * authoritative answer — *and* at least one clause actually resolved to `false`.
 * A `not-evaluated` clause therefore never produces `blocked` on its own and
 * never enters `failingClauses`:
 *
 * - `a && b` with `a` failed and `b` unevaluable → Kleene conjunction proves
 *   `false`, so the verdict is knowable and the failed clause really is the
 *   blocker: `blocked`, carrying `a` alone.
 * - `a || b` with the same rows → the verdict is `unevaluable`, because `b` may
 *   yet be true. Counting rows would call that "blocked by `a`" and send an
 *   admin to change a value that was never the problem, so it is `unknown`.
 */
function assessRule(
  rule: MembershipRule,
  contextUser: OktaUser,
  groupContext: RuleGroupContext | undefined,
): RuleAssessment {
  if (isUserExcludedFromRule(rule, contextUser.id)) return { kind: 'excluded', rule };

  const expression = conditionExpressionOf(rule);
  if (expression.trim() === '') return { kind: 'unknown', rule, reason: 'no-condition' };

  // With the group list in hand, `isMemberOf*` clauses resolve instead of
  // reporting `needs-group-context` — which is what turns a whole class of rows
  // from "needs investigation" into a nameable prerequisite.
  const { clauses, summary } = explainRuleExpression(expression, contextUser, {
    groups: groupContext,
  });
  if (summary.result.outcome === 'match') return { kind: 'grants', rule };

  const failingClauses = clauses.filter((clause) => clause.status === 'fail');
  // `truncated` needs no special case: the verdict is computed over the whole
  // expression, and every clause carried here still genuinely failed.
  if (summary.result.outcome === 'no-match' && failingClauses.length > 0) {
    const requiredGroups = failingClauses.flatMap((clause) => clause.groupReferences ?? []);
    return {
      kind: 'blocked',
      rule,
      failingClauses,
      onlyGroupClausesFailed: failingClauses.every(
        (clause) => (clause.groupReferences?.length ?? 0) > 0,
      ),
      requiredGroups,
    };
  }

  return {
    kind: 'unknown',
    rule,
    // "needs the user's group list" is a diagnosis; "a clause was unevaluable" is
    // a shrug. Prefer the former whenever the rule contains one.
    reason: summary.needsGroupContext > 0 ? 'needs-group-context' : 'unevaluable-clause',
  };
}

/** An {@link AccessCause} shell for one membership, before the remedy is decided. */
function causeFor(membership: GroupMembership): Pick<AccessCause, 'groupId' | 'groupName'> {
  return { groupId: membership.group.id, groupName: membership.group.profile.name };
}

/** A cause with no clause evidence — every remedy decided from provenance alone. */
function plainCause(membership: GroupMembership, remedy: AccessRemedy): AccessCause {
  return { ...causeFor(membership), remedy, failingClauses: [] };
}

/** A `cannot-determine` cause — the only remedy that carries a reason. */
function undetermined(
  membership: GroupMembership,
  reason: UndeterminedReason,
  rule?: MembershipRule,
): AccessCause {
  return {
    ...causeFor(membership),
    remedy: 'cannot-determine',
    undeterminedReason: reason,
    ...(rule ? { ruleId: rule.id, ruleName: rule.name } : {}),
    failingClauses: [],
  };
}

/**
 * Classify one membership.
 *
 * **Provenance decides first.** How the compared user actually holds the group is
 * a fact already carried on the membership; what a rule would do to the *context*
 * user is a separate question that only matters once we know a rule is what
 * granted the access. Asking the second question first is what produced
 * "fix a profile attribute" for a group somebody had simply been added to.
 *
 * Order: app-mastered → no inventory → any deduction → proven manual add →
 * rule assessment (exclusion → block → undetermined).
 */
function classifyOne(
  membership: GroupMembership,
  contextUser: OktaUser,
  rules: readonly MembershipRule[] | null,
  groupContext: RuleGroupContext | undefined,
): AccessCause {
  // 1. An app masters this group's roster. No rule assigns into it and no manual
  //    add reproduces it, so neither of those remedies may be offered — this is
  //    true regardless of what the rule inventory says, hence before the check.
  if (membership.group.type === 'APP_GROUP') return plainCause(membership, 'app-managed');

  // 2. "We could not fetch the rules" is not "nobody was added by a rule".
  if (rules === null) return undetermined(membership, 'no-rule-inventory');

  const deduced = isDeducedAttribution(membership.attribution);

  // 3. Proven added-by-hand. Reproduce it by hand — **whatever rules also target
  //    the group**. A rule that did not grant their access is not the thing to
  //    copy, and sending an admin to change a profile value to satisfy it would
  //    be acting on a rule nobody used. Gated on fact-grade evidence because
  //    `manual-add` claims "nothing but a person put them here".
  if (!deduced && membership.membershipType === 'DIRECT') {
    return plainCause(membership, 'manual-add');
  }

  // 4. Otherwise a rule is (or may be) what grants it, so what the targeting
  //    rules do to the CONTEXT user is the question worth asking. Note this is
  //    reached even on a deduced attribution: how the compared user came to hold
  //    the group says nothing about why this user is blocked, and a proven
  //    failing clause about them is a hard finding either way.
  const targeting = rulesTargeting(rules, membership.group.id);
  if (targeting.length === 0) {
    // Nothing to assess. A deduction can support no confident answer; a
    // membership no supplied rule accounts for is simply unexplained — an
    // app-mastered group, a rule since deactivated, or a narrow inventory.
    return undetermined(membership, deduced ? 'ambiguous-attribution' : 'no-rule-inventory');
  }

  const assessments = targeting.map((rule) => assessRule(rule, contextUser, groupContext));

  // 2. An exclusion is the one cause that is stated outright in the rule rather
  //    than deduced from a profile, so it outranks everything below it.
  const excluded = assessments.find((a) => a.kind === 'excluded');
  if (excluded) {
    return {
      ...causeFor(membership),
      remedy: 'excluded-by-rule',
      ...ruleRef(excluded.rule),
      failingClauses: [],
    };
  }

  // 3. Every clause here resolved to `false` inside a rule whose whole-condition
  //    verdict was `no-match`. Naming a single rule only when exactly one is
  //    implicated keeps `ruleId` a fact rather than array order.
  const blocked = assessments.filter((a) => a.kind === 'blocked');
  if (blocked.length > 0) {
    // A prerequisite group is a different job from a profile edit, so it gets its
    // own remedy — but only when nothing else failed. If a profile clause failed
    // too, the profile still needs fixing and the groups ride along as evidence.
    const onlyGroups = blocked.every((b) => b.onlyGroupClausesFailed);
    return {
      ...causeFor(membership),
      remedy: onlyGroups ? 'needs-group-membership' : 'blocked-by-attribute',
      ...(blocked.length === 1 ? ruleRef(blocked[0].rule) : {}),
      failingClauses: blocked.flatMap((b) => b.failingClauses),
      requiredGroups: blocked.flatMap((b) => b.requiredGroups),
    };
  }

  // 4. Rules feed this group but none of them could be resolved for this user.
  const unknown = assessments.filter((a) => a.kind === 'unknown');
  if (unknown.length > 0) {
    const reason =
      unknown.find((u) => u.reason === 'needs-group-context')?.reason ?? unknown[0].reason;
    return undetermined(membership, reason, unknown.length === 1 ? unknown[0].rule : undefined);
  }

  // 5. Every targeting rule accepts the context user, yet they are not in the
  //    group: Okta and this evaluation disagree (a rule not yet applied, stale
  //    membership data, an exclusion invisible on a cache-served rule). There is
  //    no attribute to fix, so the honest answer is that we cannot name one.
  return undetermined(membership, 'unevaluable-clause');
}

/** The rule identity fields, for a cause that hinges on exactly one rule. */
function ruleRef(rule: MembershipRule): Pick<AccessCause, 'ruleId' | 'ruleName'> {
  return { ruleId: rule.id, ruleName: rule.name };
}

/**
 * Group classified causes by remedy, preserving input order within each group.
 *
 * `cannot-determine` is returned as its own group and is **never** merged into
 * another, however few rows it holds.
 *
 * @param causes - Output of {@link classifyAccessCauses}.
 * @returns One entry per remedy that has at least one cause, in {@link AccessRemedy} order.
 */
export function groupCausesByRemedy(
  causes: readonly AccessCause[],
): { remedy: AccessRemedy; causes: AccessCause[] }[] {
  const order: AccessRemedy[] = [
    'blocked-by-attribute',
    'needs-group-membership',
    'excluded-by-rule',
    'manual-add',
    'app-managed',
    'cannot-determine',
  ];
  return order
    .map((remedy) => ({ remedy, causes: causes.filter((c) => c.remedy === remedy) }))
    .filter((entry) => entry.causes.length > 0);
}
