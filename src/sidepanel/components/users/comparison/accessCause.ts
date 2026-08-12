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
} from '../../../../shared/rules/explainExpression';
import { isDeducedAttribution } from '../../../../shared/utils/membershipAnalysis';
import type { GroupMembership, MembershipRule, OktaUser } from '../../../../shared/types';

/**
 * What an admin would DO to close an access difference.
 *
 * Ordered from most to least actionable. Grouping by remedy rather than by cause
 * is deliberate: "their department is wrong" and "their title is wrong" are
 * different causes needing the same action, and belong together on a worklist.
 *
 * - `blocked-by-attribute` — a rule feeds the group and the user's profile fails
 *   at least one clause that was **actually evaluated**. Remedy: fix the profile
 *   value (or the rule). Only ever assigned on a `fail`, never on a
 *   `not-evaluated`.
 * - `excluded-by-rule` — the user is on a targeting rule's explicit exclusion
 *   list, so they would otherwise qualify. Remedy: remove the exclusion.
 * - `manual-add` — no rule accounts for the other user's membership either; they
 *   were added by hand. Remedy: add this user by hand too.
 * - `cannot-determine` — at least one relevant clause could not be evaluated, the
 *   attribution was `ambiguous`, or the rule inventory was unavailable. Remedy:
 *   none that can be named — investigate. **Never** merged into another bucket,
 *   and never presented as a failure.
 */
export type AccessRemedy =
  'blocked-by-attribute' | 'excluded-by-rule' | 'manual-add' | 'cannot-determine';

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
   * The clauses that actually failed, for `blocked-by-attribute`. Empty for every
   * other remedy. **Never** populated from `not-evaluated` rows — that is the
   * distinction this module exists to preserve.
   *
   * **PII:** `resolvedValue` is profile data. Render escaped, never log, and
   * escape for CSV.
   */
  readonly failingClauses: readonly ClauseExplanation[];
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
  const { onlyCompared, contextUser, rules } = input;
  return onlyCompared.map((membership) => classifyOne(membership, contextUser, rules));
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
function assessRule(rule: MembershipRule, contextUser: OktaUser): RuleAssessment {
  if (isUserExcludedFromRule(rule, contextUser.id)) return { kind: 'excluded', rule };

  const expression = conditionExpressionOf(rule);
  if (expression.trim() === '') return { kind: 'unknown', rule, reason: 'no-condition' };

  const { clauses, summary } = explainRuleExpression(expression, contextUser);
  if (summary.result.outcome === 'match') return { kind: 'grants', rule };

  const failingClauses = clauses.filter((clause) => clause.status === 'fail');
  // `truncated` needs no special case: the verdict is computed over the whole
  // expression, and every clause carried here still genuinely failed.
  if (summary.result.outcome === 'no-match' && failingClauses.length > 0) {
    return { kind: 'blocked', rule, failingClauses };
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
 * The answer when no ACTIVE rule in the inventory targets the group.
 *
 * `manual-add` is a **confident** claim ("nothing but a person put them here"),
 * so it is licensed only by a membership the classifier proved: `DIRECT` with
 * fact-grade evidence, read through `membershipAnalysis`'s table rather than
 * re-derived here. Every deduction stays undetermined, as does a `RULE_BASED`
 * membership no supplied rule accounts for — an app-mastered group, a rule since
 * deactivated, or an inventory narrower than the groups it was asked about.
 */
function untargetedCause(membership: GroupMembership): AccessCause {
  const { attribution, membershipType } = membership;
  if (isDeducedAttribution(attribution)) {
    return undetermined(membership, 'ambiguous-attribution');
  }
  if (membershipType === 'DIRECT') {
    return { ...causeFor(membership), remedy: 'manual-add', failingClauses: [] };
  }
  return undetermined(membership, 'no-rule-inventory');
}

/**
 * Classify one membership. Priority order, highest first: no inventory →
 * exclusion → a proven attribute block → manual add → undetermined.
 */
function classifyOne(
  membership: GroupMembership,
  contextUser: OktaUser,
  rules: readonly MembershipRule[] | null,
): AccessCause {
  // 1. "We could not fetch the rules" is not "nobody was added by a rule".
  //    Without the inventory nothing below can be asked, let alone answered.
  if (rules === null) return undetermined(membership, 'no-rule-inventory');

  const targeting = rulesTargeting(rules, membership.group.id);
  if (targeting.length === 0) return untargetedCause(membership);

  const assessments = targeting.map((rule) => assessRule(rule, contextUser));

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
    return {
      ...causeFor(membership),
      remedy: 'blocked-by-attribute',
      ...(blocked.length === 1 ? ruleRef(blocked[0].rule) : {}),
      failingClauses: blocked.flatMap((b) => b.failingClauses),
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
    'excluded-by-rule',
    'manual-add',
    'cannot-determine',
  ];
  return order
    .map((remedy) => ({ remedy, causes: causes.filter((c) => c.remedy === remedy) }))
    .filter((entry) => entry.causes.length > 0);
}
