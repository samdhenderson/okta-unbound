/**
 * @module sidepanel/components/shared/RawExpressionWell
 * @description The raw-condition view {@link ClauseLedger} shows behind its
 * "Raw expression" toggle — the tenant's own EL text in a recessed well, plus the
 * whole-expression resolved value underneath it.
 *
 * ## The footer never rounds "cannot tell" to `false`
 *
 * {@link RawExpressionWellProps.result} is the same three-valued
 * {@link module:shared/ruleEvaluator.RuleMatchResult} every other verdict in this
 * codebase reads from — `docs/claims.md`'s rule that `unevaluable` is never
 * rounded to `no-match`. An unevaluable expression's footer states the reason
 * sentence in place of a value; it never prints `false` for a condition nobody
 * could evaluate.
 *
 * `result` is itself optional, for a caller with no user in scope to evaluate
 * against at all — `RuleDetailView`, browsing a rule with nobody picked. That is
 * a different fact than "unevaluable": there the whole-expression verdict was
 * attempted and came back without an answer; here no evaluation was attempted,
 * so there is no verdict of any kind to report. The well renders the same either
 * way; the footer row is simply absent — never a placeholder, never a dash.
 *
 * ## Security
 *
 * `expression` is untrusted, end-user-controllable Okta rule text. Rendered
 * through {@link RuleExpressionText}'s escaping, never `dangerouslySetInnerHTML`.
 * This module logs nothing.
 */
import React from 'react';
import RuleExpressionText, { type GroupNameResolver } from './RuleExpressionText';
import { UNEVALUABLE_REASON_TEXT } from '../../../shared/rules/unevaluableReasonText';
import type { RuleMatchResult } from '../../../shared/ruleEvaluator';

/** Props for {@link RawExpressionWell}. */
export interface RawExpressionWellProps {
  /** The rule's condition expression, exactly as `ClauseLedger` was given it. **Untrusted.** */
  expression: string;
  /**
   * The authoritative whole-expression verdict — the same value
   * {@link module:shared/rules/explainExpression.RuleExplanationSummary.result}
   * carries. Drives the footer; never derived by re-reading the tree.
   *
   * Omitted when the caller has no user to evaluate against — the footer then
   * renders nothing at all, not a placeholder, since there is no verdict to state.
   */
  result?: RuleMatchResult;
  /** Names group ids inside the expression; absent, ids stay in their raw quoted form. */
  resolveGroupName?: GroupNameResolver;
}

/** The footer's value column: a literal `true`/`false`, or the withheld reason. */
function resolvedValueText(result: RuleMatchResult): string {
  if (result.outcome === 'match') return 'true';
  if (result.outcome === 'no-match') return 'false';
  return UNEVALUABLE_REASON_TEXT[result.reasonCode];
}

/**
 * The raw expression, in a recessed well, with the resolved-value footer.
 *
 * @example
 * ```tsx
 * <RawExpressionWell
 *   expression={expression}
 *   result={summary.result}
 *   resolveGroupName={resolveGroupName}
 * />
 * ```
 */
const RawExpressionWell: React.FC<RawExpressionWellProps> = ({
  expression,
  result,
  resolveGroupName,
}) => {
  const unevaluable = result?.outcome === 'unevaluable';

  return (
    <div className="bg-canvas overflow-x-auto rounded-md p-(--sp-card)">
      <RuleExpressionText text={expression} resolveGroupName={resolveGroupName} />
      {result && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-600">
          <span className="font-medium">Resolved value</span>
          <span className={`font-mono ${unevaluable ? '' : 'text-neutral-900'}`}>
            {resolvedValueText(result)}
          </span>
        </div>
      )}
    </div>
  );
};

export default RawExpressionWell;
