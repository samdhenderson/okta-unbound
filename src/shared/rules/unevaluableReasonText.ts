/**
 * @module shared/rules/unevaluableReasonText
 * @description Plain-language sentences for the reasons a rule expression could
 * not be evaluated here.
 *
 * Extracted from `ClauseChecklist` so the blast-radius report says the *same*
 * thing about the *same* reason code. Two copies of this table would drift, and
 * the drift would land in the one place it does most harm: a surface predicting
 * someone's access telling them something different from the surface explaining
 * their membership.
 *
 * Every sentence is phrased so that **none of them reads as "the user did not
 * qualify"**. That is ADR-0017's honesty rule in copy form: a clause this panel
 * declines to evaluate is *not evaluated*, never *failed*. Rendering them in a
 * danger palette would restate in colour what the words carefully avoid saying.
 *
 * Reason codes are non-sensitive constants — unlike the expression text and
 * resolved values they sit beside, which are end-user-controllable tenant data
 * and must never be logged.
 */
import type { RuleUnevaluableReason } from '../ruleEvaluator';

/** Reason code → the sentence shown to an admin. */
export const UNEVALUABLE_REASON_TEXT: Record<RuleUnevaluableReason, string> = {
  empty: 'This rule carries no condition expression, so there was nothing to check.',
  'too-long': 'The condition is longer than this panel will analyze.',
  'parse-error': 'The condition could not be parsed here.',
  'unsupported-operator': 'Uses an operator this panel cannot evaluate.',
  'group-membership-fn': "Needs the user's full group list, which this panel does not have.",
  'group-name-regex':
    'Matches group names with a regular expression, which this panel does not run.',
  'unknown-fn': 'Calls a function this panel cannot evaluate.',
  'fn-arity': 'Calls a function with an unexpected number of arguments.',
  'unsupported-node': 'Uses a form of expression this panel cannot evaluate.',
  'operand-type': "A value's type does not fit the comparison, so no verdict was reached.",
  'not-a-boolean': 'Does not resolve to true or false on its own.',
  'walk-failed': 'The condition was too deeply nested to analyze.',
};

/**
 * The sentence for one reason code, with a fallback for a code this table has
 * not caught up with.
 *
 * The fallback exists because {@link RuleUnevaluableReason} can grow in
 * `ruleEvaluator` and a missing entry must degrade to a vague-but-true sentence
 * rather than rendering `undefined` at an admin.
 *
 * @param reason - The reason code, or `undefined` when none was reported.
 * @returns A complete sentence, always.
 *
 * @example
 * ```ts
 * unevaluableReasonText('group-name-regex');
 * // "Matches group names with a regular expression, which this panel does not run."
 * ```
 */
export function unevaluableReasonText(reason: RuleUnevaluableReason | undefined): string {
  if (reason === undefined) return 'This panel could not evaluate the condition.';
  return UNEVALUABLE_REASON_TEXT[reason] ?? 'This panel could not evaluate the condition.';
}
