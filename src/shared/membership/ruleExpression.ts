/**
 * @module shared/membership/ruleExpression
 * @description The one place a rule's condition expression is read off its two
 * possible shapes.
 *
 * `MembershipRule` arrives in two forms depending on which surface fetched it —
 * a `FormattedRule` (Users tab) carries `conditionExpression` and no
 * `conditions` at all, while a raw Okta group rule carries
 * `conditions.expression.value` and no `conditionExpression`. Four call sites
 * (the blast-radius engine, the membership classifier, the comparison's
 * access-cause classifier, and the Groups-pane rule evidence panel) each
 * hand-rolled the same two-source fallback (D-012); this module exists so
 * that read has exactly one implementation.
 *
 * @see {@link module:shared/membership/groupContext} — the sibling module this
 *   mirrors for the same kind of shape-normalizing read.
 */

import type { MembershipRule } from '../types';

/**
 * A rule's condition expression, whichever shape the rule arrived in.
 *
 * An empty result means the rule carries **no** condition — the evaluator
 * reports that as `unevaluable`, never as "matches nothing". Note what is
 * **not** consulted: a `FormattedRule.condition` display string has `user.`
 * stripped off, so it does not parse and reading it here would silently turn
 * every formatted rule into a `parse-error`.
 *
 * @param rule - The rule, in either shape.
 * @returns The raw condition expression, or `''` if the rule carries none.
 */
export function conditionExpressionOf(rule: MembershipRule): string {
  return rule.conditionExpression || rule.conditions?.expression?.value || '';
}
