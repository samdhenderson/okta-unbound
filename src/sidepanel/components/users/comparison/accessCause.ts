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

import type { ClauseExplanation } from '../../../../shared/rules/explainExpression';
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
  // NOTE: implementation lands with phase 3.7. This honest-unknown default is the
  // safe failure mode — if it ever shipped unimplemented it would say "we don't
  // know", never invent a remedy an admin would act on.
  return input.onlyCompared.map((m) => ({
    groupId: m.group.id,
    groupName: m.group.profile.name,
    remedy: 'cannot-determine' as const,
    undeterminedReason: 'no-rule-inventory' as const,
    failingClauses: [],
  }));
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
