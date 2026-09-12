/**
 * @module sidepanel/components/shared/ClauseLedger
 * @description Explains a rule condition against one user as a **tree**, not a
 * flattened clause list — `explainRuleExpression`'s `tree` projection rendered
 * with its `&&`/`||` structure intact, so a nested `isMemberOfAnyGroup(...) ||
 * (user.department == "Engineering" && user.title != "Intern")` reads as the
 * grouping the tenant actually wrote rather than three flattened rows that lose
 * which alternative goes with which.
 *
 * This is a new, additive component family
 * (`ClauseLedger`/`ClauseLedgerBranch`/`ClauseLedgerClause`/`GroupReferenceChip`/
 * `RawExpressionWell`). No existing surface adopts it yet —
 * {@link module:sidepanel/components/groups/detail/ClauseChecklist} is
 * unchanged and remains the flat-list view in production.
 *
 * ## `not-evaluated` is never a failure
 *
 * Exactly `ClauseChecklist`'s own rule: a clause the evaluator could not
 * resolve renders neutrally, with a plain-language reason. It never borrows the
 * `danger` treatment reserved for a clause that genuinely resolved to `false`.
 *
 * ## Raw view never rounds "cannot tell" to `false`
 *
 * The raw-expression footer states `true`, `false`, or — for an unevaluable
 * expression — the reason sentence in its place. It never prints `false` for a
 * condition nobody could evaluate (`docs/claims.md`).
 *
 * ## Security
 *
 * `expression` and every value the tree carries are untrusted, end-user-
 * controllable tenant data (rule text and Okta profile attributes). Rendered
 * through React's escaping only, via the same child components `ClauseChecklist`
 * uses; this module logs nothing.
 */
import React from 'react';
import StableWidth from './StableWidth';
import { ClauseTreeNodeView } from './ClauseLedgerBranch';
import RawExpressionWell from './RawExpressionWell';
import { useClauseLedger } from './useClauseLedger';
import type { GroupNameResolver } from './RuleExpressionText';
import type { RuleExplanationSummary } from '../../../shared/rules/explainExpression';
import type { RuleGroupContext } from '../../../shared/ruleEvaluator';
import type { OktaUser } from '../../../shared/types';

/** Props for {@link ClauseLedger}. */
export interface ClauseLedgerProps {
  /**
   * The rule's condition expression — untrusted Okta rule text. Callers read it
   * through the same fallback `ClauseChecklist` documents
   * (`rule.conditionExpression || rule.conditions?.expression?.value || ''`).
   */
  expression: string;
  /** The user the condition is explained against. Their profile values drive every leaf. */
  user: OktaUser;
  /**
   * The user's **complete** group list — turns every `isMemberOf*` clause from a
   * neutral "not evaluated" into a real pass/fail. **Omit it rather than
   * passing a subset**: see
   * {@link module:sidepanel/components/groups/detail/ClauseChecklist}'s
   * `groupContext` doc for why a partial list is worse than none.
   */
  groupContext?: RuleGroupContext;
  /** Cap on the clause rows / tree leaves. Defaults to the explainer's own default. */
  maxClauses?: number;
  /**
   * Names group ids the {@link groupContext} cannot — see `ClauseChecklist`'s
   * own doc for the two-source merge this feeds.
   */
  resolveGroupName?: GroupNameResolver;
  /** Initial state of the raw/tree toggle. Defaults to `false` (tree view). */
  defaultShowRaw?: boolean;
}

/** Whole-expression verdict → its chip label and token classes. Verbatim from `ClauseChecklist`. */
const resultPresentation = {
  match: { label: 'Rule matches this user', chipClass: 'bg-success-light text-success-text' },
  'no-match': { label: 'Rule does not match', chipClass: 'bg-danger-light text-danger-text' },
  unevaluable: { label: 'Cannot be determined', chipClass: 'bg-neutral-100 text-neutral-700' },
} as const;

const WIDEST_RESULT = Object.values(resultPresentation).reduce((a, b) =>
  b.label.length > a.label.length ? b : a,
);

/** The counts line above the tree, plus the authoritative whole-rule verdict. */
const LedgerSummary: React.FC<{ summary: RuleExplanationSummary }> = ({ summary }) => {
  const result = resultPresentation[summary.result.outcome];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 flex-1 text-xs text-neutral-600">
        {summary.evaluatedClauses} of {summary.totalClauses} clause
        {summary.totalClauses === 1 ? '' : 's'} evaluated
        {summary.notEvaluatedClauses > 0 && <> · {summary.notEvaluatedClauses} not evaluated</>}
        {summary.needsGroupContext > 0 && <> ({summary.needsGroupContext} needs group context)</>}
      </p>
      <StableWidth
        reserve={
          <span className="rounded-md px-2 py-0.5 text-xs font-medium">{WIDEST_RESULT.label}</span>
        }
        align="end"
        className="shrink-0"
      >
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${result.chipClass}`}
        >
          {result.label}
        </span>
      </StableWidth>
    </div>
  );
};

/**
 * The raw-expression view toggle.
 *
 * §3 exception (`docs/components.md`): this copies `FilterToggle`'s raw-button
 * pattern rather than reusing it. `FilterToggle` hardcodes a funnel glyph and an
 * applied-filter count badge, neither of which fits a plain view toggle with no
 * icon in the shared registry that reads as "raw text" — so the shape is copied,
 * not the component.
 */
const RawToggleButton: React.FC<{ pressed: boolean; onToggle: () => void }> = ({
  pressed,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={pressed}
    className={`press shrink-0 rounded-md border px-4 py-2 text-sm font-medium ${
      pressed
        ? 'border-primary bg-primary-light text-primary-text'
        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
    }`}
  >
    Raw expression
  </button>
);

/**
 * Explains one rule condition against one user as a tree: the counts sentence
 * and whole-rule verdict, a raw/tree view toggle, and either the nested
 * `&&`/`||` structure or the raw EL text.
 *
 * @example
 * ```tsx
 * <ClauseLedger
 *   expression={rule.conditionExpression || rule.conditions?.expression?.value || ''}
 *   user={user}
 * />
 * ```
 */
const ClauseLedger: React.FC<ClauseLedgerProps> = ({
  expression,
  user,
  groupContext,
  maxClauses,
  resolveGroupName,
  defaultShowRaw,
}) => {
  const {
    explanation,
    resolveGroupName: mergedResolveGroupName,
    showRaw,
    toggleRaw,
  } = useClauseLedger(expression, user, {
    groupContext,
    maxClauses,
    resolveGroupName,
    defaultShowRaw,
  });

  return (
    <div className="space-y-2">
      <LedgerSummary summary={explanation.summary} />

      <div className="flex justify-end">
        <RawToggleButton pressed={showRaw} onToggle={toggleRaw} />
      </div>

      {showRaw ? (
        <RawExpressionWell
          expression={expression}
          result={explanation.summary.result}
          resolveGroupName={mergedResolveGroupName}
        />
      ) : (
        <ClauseTreeNodeView node={explanation.tree} resolveGroupName={mergedResolveGroupName} />
      )}
    </div>
  );
};

export default ClauseLedger;
