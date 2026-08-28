/**
 * @module sidepanel/components/groups/detail/ClauseChecklist
 * @description Renders a rule condition clause by clause against one user — *why*
 * a rule does (or does not) place this person in that group.
 *
 * A pure view over
 * {@link module:shared/rules/explainExpression.explainRuleExpression}: no I/O, no
 * logging, no second parser. It replaces the flat `<code>` condition dump an admin
 * had to read by eye with one row per clause, each carrying the profile value that
 * drove it and its outcome.
 *
 * ## `not-evaluated` is never a failure
 *
 * A clause the evaluator could not resolve — a group-membership call, an
 * unsupported operator, an ungrammatical fragment — renders **neutrally**, with a
 * plain-language reason. It never borrows the `danger` treatment reserved for a
 * clause that genuinely resolved to `false`. Presenting "we could not check this"
 * as "this person does not qualify" would be a worse bug than the one this view
 * exists to fix, because an administrator acts on the answer.
 *
 * A caller that already holds the user's **complete** group list can pass it as
 * {@link ClauseChecklistProps.groupContext}, and the `isMemberOf*` clauses then
 * carry a real verdict instead of that neutral row. A *partial* list must never be
 * passed: see the prop's own doc comment.
 *
 * ## `undefined` and `null` are different facts
 *
 * {@link ClauseExplanation.resolvedValue} distinguishes "nothing was resolvable"
 * (`undefined`) from "the attribute resolved, and its value is Okta's null"
 * (`null`), so this view renders them as two different sentences. Collapsing them
 * into one dash would re-introduce the same confident-wrong-answer problem.
 *
 * ## Group ids in the clause text are named where they can be
 *
 * `isMemberOfAnyGroup("00gFAKE1")` tells an admin nothing on its own. Where
 * {@link ClauseChecklistProps.groupContext} names that id — the same list the
 * explainer was already given, so nothing is fetched — {@link RuleExpressionText}
 * renders the literal as a badge. An id it cannot name keeps its raw quoted form.
 *
 * ## Security
 *
 * `expressionText` and `resolvedValue` are untrusted, end-user-controllable tenant
 * data (rule text and profile attributes). They are rendered through React's
 * escaping — never `dangerouslySetInnerHTML`, never a hand-built HTML string — and
 * are **never logged**; this component logs nothing at all.
 */
import React, { useMemo } from 'react';
import Icon, { type IconType } from '../../shared/Icon';
import { AlertMessage } from '../../shared';
import RuleExpressionText, { type GroupNameResolver } from './RuleExpressionText';
import {
  explainRuleExpression,
  type ClauseExplanation,
  type ClauseStatus,
  type RuleExplanationSummary,
} from '../../../../shared/rules/explainExpression';
import type { RuleExprValue, RuleGroupContext } from '../../../../shared/ruleEvaluator';
import { UNEVALUABLE_REASON_TEXT } from '../../../../shared/rules/unevaluableReasonText';
import type { OktaUser } from '../../../../shared/types';

/** Props for {@link ClauseChecklist}. */
interface ClauseChecklistProps {
  /**
   * The rule's condition expression — untrusted Okta rule text. Callers must read
   * it through the same fallback the classifier uses
   * (`rule.conditionExpression || rule.conditions?.expression?.value || ''`), and
   * may pass an empty string: an absent condition is reported as *not evaluated*,
   * never as "no conditions, so everything passes".
   */
  expression: string;
  /** The user the condition is explained against. Their profile values drive every row. */
  user: OktaUser;
  /**
   * Cap on the clause rows rendered. Defaults to the explainer's
   * `DEFAULT_MAX_CLAUSES`; when the cap drops clauses, the checklist says so
   * rather than showing a silent partial list.
   */
  maxClauses?: number;
  /**
   * The user's **complete** group list, which turns every `isMemberOf*` clause
   * from a neutral "Not evaluated" into a real `pass` or `fail`. Build it with
   * `shared/membership/groupContext.groupContextOf`.
   *
   * **Omit it rather than passing a subset.** `isMemberOf*` is two-valued over
   * the list it is given (ADR-0021): a group missing from here is not "unknown",
   * it is a confident "they are not in it". A filtered or still-loading list
   * would therefore report groups the user *is* in as clauses they failed —
   * worse than the honest "Cannot be determined" this prop replaces.
   *
   * Absent, this view behaves exactly as it did before the prop existed.
   * `isMemberOfGroupNameRegex` stays unevaluated either way, under its own
   * `group-name-regex` reason.
   */
  groupContext?: RuleGroupContext;
}

/** Props for {@link ClauseRow}. */
interface ClauseRowProps {
  /** The explained clause to render. Its text and value are untrusted — render only. */
  clause: ClauseExplanation;
  /** Names the group ids inside the clause text; absent, they stay raw. */
  resolveGroupName?: GroupNameResolver;
}

/** How one {@link ClauseStatus} is presented: label, glyph, and token classes. */
interface StatusPresentation {
  /** The visible status text. Status is never conveyed by colour alone. */
  readonly label: string;
  /** Decorative glyph beside the label. */
  readonly icon: IconType;
  /** Chip surface/border/text tokens. */
  readonly chipClass: string;
  /** Glyph colour token. */
  readonly iconClass: string;
}

/**
 * Clause status → presentation.
 *
 * `not-evaluated` deliberately maps to the **neutral** palette: it is not a
 * `danger` (that is reserved for a clause that resolved to `false`), and not a
 * `warning` either — nothing is wrong, we simply cannot tell.
 */
const statusPresentation: Record<ClauseStatus, StatusPresentation> = {
  pass: {
    label: 'Pass',
    icon: 'check',
    chipClass: 'border-success-light bg-success-light text-success-text',
    iconClass: 'text-success',
  },
  fail: {
    label: 'Fail',
    icon: 'alert',
    chipClass: 'border-danger-light bg-danger-light text-danger-text',
    iconClass: 'text-danger',
  },
  'not-evaluated': {
    label: 'Not evaluated',
    icon: 'minus',
    chipClass: 'border-neutral-200 bg-neutral-100 text-neutral-700',
    iconClass: 'text-neutral-500',
  },
};

/** Whole-expression verdict → its chip label and token classes. */
const resultPresentation = {
  match: { label: 'Rule matches this user', chipClass: 'bg-success-light text-success-text' },
  'no-match': { label: 'Rule does not match', chipClass: 'bg-danger-light text-danger-text' },
  unevaluable: { label: 'Cannot be determined', chipClass: 'bg-neutral-100 text-neutral-700' },
} as const;

/**
 * Render a resolved value as plain text: strings keep their quotes (so a trailing
 * space or an empty string is visible), everything else prints as itself.
 * `null` is handled by the caller, which says so in words.
 */
function formatResolvedValue(value: RuleExprValue): string {
  if (value === null) return 'null';
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

/** The "Resolved value" line, which tells `undefined` and `null` apart. */
const ResolvedValue: React.FC<{ value: RuleExprValue | undefined }> = ({ value }) => (
  <p className="mt-2 text-xs text-neutral-600">
    <span className="font-medium">Resolved value: </span>
    {value === undefined ? (
      <span>no value could be read for this clause</span>
    ) : (
      <>
        <code className="font-mono break-words text-neutral-900">{formatResolvedValue(value)}</code>
        {value === null && <span>, and the attribute resolved to null</span>}
      </>
    )}
  </p>
);

/** One clause: its text, the value that drove it, its outcome, and any reason. */
const ClauseRow: React.FC<ClauseRowProps> = ({ clause, resolveGroupName }) => {
  const presentation = statusPresentation[clause.status];

  return (
    <li className="rounded-md border border-neutral-200 bg-white p-(--sp-card)">
      <div className="flex items-start justify-between gap-3">
        <RuleExpressionText
          text={clause.expressionText}
          resolveGroupName={resolveGroupName}
          className="min-w-0 flex-1 font-mono text-xs break-words whitespace-pre-wrap text-neutral-900"
        />
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${presentation.chipClass}`}
        >
          <span aria-hidden="true" className="inline-flex">
            <Icon type={presentation.icon} size="sm" className={presentation.iconClass} />
          </span>
          {presentation.label}
        </span>
      </div>

      <ResolvedValue value={clause.resolvedValue} />

      {clause.reasonCode && (
        <p className="mt-1 text-xs text-neutral-600">
          {UNEVALUABLE_REASON_TEXT[clause.reasonCode]}
        </p>
      )}

      {clause.alternatives && (
        <div className="mt-2 border-l-2 border-neutral-200 pl-3">
          <p className="text-xs font-medium text-neutral-600">Any one of these satisfies it:</p>
          <ul className="mt-1 space-y-1">
            {clause.alternatives.map((alternative, index) => (
              <li
                key={`${index}-${alternative.expressionText}`}
                className="flex items-start justify-between gap-2"
              >
                <RuleExpressionText
                  text={alternative.expressionText}
                  resolveGroupName={resolveGroupName}
                  className="min-w-0 flex-1 font-mono text-xs break-words whitespace-pre-wrap text-neutral-700"
                />
                <span className="shrink-0 text-xs text-neutral-600">
                  {statusPresentation[alternative.status].label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
};

/** The counts line above the rows, plus the authoritative whole-rule verdict. */
const ChecklistSummary: React.FC<{ summary: RuleExplanationSummary }> = ({ summary }) => {
  const result = resultPresentation[summary.result.outcome];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-neutral-600">
        {summary.evaluatedClauses} of {summary.totalClauses} clause
        {summary.totalClauses === 1 ? '' : 's'} evaluated
        {summary.notEvaluatedClauses > 0 && <> · {summary.notEvaluatedClauses} not evaluated</>}
        {summary.needsGroupContext > 0 && <> ({summary.needsGroupContext} needs group context)</>}
      </p>
      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${result.chipClass}`}>
        {result.label}
      </span>
    </div>
  );
};

/**
 * Explains one rule condition against one user, clause by clause: the clause text
 * in mono, the profile value that drove it, and a pass / fail / **not evaluated**
 * outcome that is always spelled out in words as well as colour.
 *
 * A condition that never parsed (including an absent one) renders as a neutral
 * "could not be checked" note with its reason — never as an empty checklist, and
 * never as a rule that matches nothing.
 *
 * @example
 * ```tsx
 * <ClauseChecklist
 *   expression={rule.conditionExpression || rule.conditions?.expression?.value || ''}
 *   user={user}
 * />
 * ```
 */
const ClauseChecklist: React.FC<ClauseChecklistProps> = ({
  expression,
  user,
  maxClauses,
  groupContext,
}) => {
  const { clauses, summary } = useMemo(
    () => explainRuleExpression(expression, user, { maxClauses, groups: groupContext }),
    [expression, user, maxClauses, groupContext],
  );

  // No list means no resolver — today's raw-id rendering, rather than one that
  // answers `undefined` to everything.
  const resolveGroupName = useMemo<GroupNameResolver | undefined>(() => {
    if (!groupContext || groupContext.length === 0) return undefined;
    const namesById = new Map(groupContext.map((entry) => [entry.id, entry.name]));
    return (groupId) => namesById.get(groupId);
  }, [groupContext]);

  if (clauses.length === 0) {
    const reasonCode =
      summary.result.outcome === 'unevaluable' ? summary.result.reasonCode : undefined;
    return (
      <div className="rounded-md border border-neutral-200 bg-white p-(--sp-card)">
        <p className="text-xs text-neutral-700">
          This condition could not be checked clause by clause, so no part of it is shown as
          failing.
        </p>
        {reasonCode && (
          <p className="mt-1 text-xs text-neutral-600">{UNEVALUABLE_REASON_TEXT[reasonCode]}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ChecklistSummary summary={summary} />

      {summary.truncated && (
        <AlertMessage
          message={{
            text: `Only the first ${summary.totalClauses} clause${
              summary.totalClauses === 1 ? ' is' : 's are'
            } shown — this condition has more.`,
            type: 'warning',
          }}
        />
      )}

      <ul className="space-y-2">
        {clauses.map((clause, index) => (
          <ClauseRow
            key={`${index}-${clause.expressionText}`}
            clause={clause}
            resolveGroupName={resolveGroupName}
          />
        ))}
      </ul>
    </div>
  );
};

export default ClauseChecklist;
