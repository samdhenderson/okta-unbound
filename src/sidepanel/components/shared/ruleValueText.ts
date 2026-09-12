/**
 * @module sidepanel/components/shared/ruleValueText
 * @description Display text for one rule value — the operand inside a clause
 * sentence ({@link ClausePhrase}) and the value on a clause's evidence line
 * ({@link ClauseLedgerClause}) are the same fact rendered the same way, so they
 * share one formatter rather than two recipes free to drift.
 *
 * ## Security
 *
 * Values are untrusted, end-user-controllable tenant data (Okta profile
 * attributes and rule literals). The output is plain text rendered through
 * React's escaping — never markup, never logged.
 */
import type { RuleExprValue } from '../../../shared/ruleEvaluator';

/**
 * Render one rule value: strings keep their quotes, `null` prints as the word
 * `null`, and a multi-valued attribute joins its entries — never through
 * `String(value)`, which would make `["a","b"]` indistinguishable from the
 * single string `"a,b"`.
 *
 * @param value - The value to render. **Untrusted/PII:** render escaped, never log.
 * @returns The display text for the value.
 */
export function formatRuleValue(value: RuleExprValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.map(formatRuleValue).join(', ');
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}
