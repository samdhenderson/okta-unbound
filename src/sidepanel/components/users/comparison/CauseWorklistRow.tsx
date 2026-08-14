/**
 * @module sidepanel/components/users/comparison/CauseWorklistRow
 * @description One row of the cause worklist: a group, the rule it hinges on, the
 * evidence, and the way into the full clause checklist.
 *
 * Extracted from {@link module:sidepanel/components/users/comparison/CauseWorklist}
 * to keep both files under the ~300-line component bar. Pure: no I/O, no logging.
 *
 * ## `cannot-determine` says why, and says it neutrally
 *
 * An undetermined row renders its {@link UndeterminedReason} as a sentence in the
 * neutral palette. It never borrows the `danger` or `warning` treatment: nothing
 * here resolved to false, and nothing is wrong — we simply could not tell.
 *
 * ## Security
 *
 * `groupName`, `ruleName`, `expressionText` and `resolvedValue` are untrusted,
 * end-user-controllable tenant data and PII. Rendered through React's escaping —
 * never `dangerouslySetInnerHTML` — and **never logged**; this module logs nothing.
 */
import React from 'react';
import { Button, ListRow } from '../../shared';
import ClauseGroupList from './ClauseGroupList';
import type { AccessCause, UndeterminedReason } from './accessCause';
import type {
  ClauseExplanation,
  ClauseGroupReference,
  ClauseGroupRequirement,
} from '../../../../shared/rules/explainExpression';
import type { RuleExprValue } from '../../../../shared/ruleEvaluator';

/**
 * Reason code → plain language, phrased so no sentence reads as "the user does not
 * qualify". Reason codes are non-sensitive constants, unlike the group and rule
 * names beside them.
 */
const undeterminedReasonText: Record<UndeterminedReason, string> = {
  'unevaluable-clause':
    'A clause in the rule could not be evaluated here, so this user may still qualify.',
  'needs-group-context':
    'The rule depends on other group memberships, which this panel does not have.',
  'ambiguous-attribution':
    'More than one rule could account for this membership, so no single cause can be named.',
  'no-rule-inventory':
    'The rules targeting this group could not be loaded, so nothing could be checked.',
  'no-condition': 'The rule carries no condition to check, so there was nothing to evaluate.',
};

/** Said when the remedy is `cannot-determine` but no reason code came with it. */
const UNDETERMINED_FALLBACK = 'We could not work this one out.';

/** Clauses shown inline before the row defers to the full checklist. */
const CLAUSE_PREVIEW_LIMIT = 3;

/** Props for {@link CauseWorklistRow}. */
interface CauseWorklistRowProps {
  /** The classified difference. Its group and rule names are untrusted — render only. */
  cause: AccessCause;
  /**
   * Opens the full clause checklist for this cause. Omitted (the host cannot
   * navigate there), the row still previews its failing clauses but offers no jump.
   */
  onViewClauses?: (cause: AccessCause) => void;
  /** Display name of the user who LACKS the access, for the prerequisite copy. */
  contextName?: string;
  /**
   * Optional per-prerequisite-group action — the "Add" that grants the group a
   * failing `isMemberOf*` clause asks for.
   *
   * A render prop because only the host can turn a rule's group *reference* into
   * something actionable: the rule names an id or a name, and granting it needs a
   * real `OktaGroup` plus the copy hook's single-flight state. Returning `null`
   * for a group the host cannot resolve is expected, and the row still names it.
   */
  renderGroupAction?: (reference: ClauseGroupReference) => React.ReactNode;
  /**
   * Optional per-blocking-group action — for a group the user must *leave*.
   * Separate from {@link renderGroupAction} because the two are opposite
   * operations and must never be wired to the same handler by accident.
   */
  renderBlockingGroupAction?: (reference: ClauseGroupReference) => React.ReactNode;
  /**
   * Turns a group id embedded in a rule condition into its name. Without it the
   * row falls back to showing the raw id, as the Rules tab does.
   */
  resolveGroupName?: (groupId: string) => string | undefined;
}

/**
 * Every group reference of one polarity across a cause's failing clauses.
 *
 * Read off the clauses rather than the cause's own `blockingGroups`, which is
 * deliberately filtered down to the satisfied entries: the list needs the whole
 * excluded set so it can say how many others the rule excludes.
 */
function referencesOfPolarity(
  cause: AccessCause,
  requirement: ClauseGroupRequirement,
): readonly ClauseGroupReference[] {
  return cause.failingClauses
    .filter((clause) => clause.groupRequirement === requirement)
    .flatMap((clause) => clause.groupReferences ?? []);
}

/**
 * One group on the worklist. Long group and rule names wrap rather than overflow,
 * and carry a `title` so the full value stays readable.
 *
 * @param props - See {@link CauseWorklistRowProps}.
 */
const CauseWorklistRow: React.FC<CauseWorklistRowProps> = ({
  cause,
  onViewClauses,
  contextName,
  renderGroupAction,
  renderBlockingGroupAction,
  resolveGroupName,
}) => (
  // `compact` rather than `comfortable`: `p-3` sits between the two, and
  // `compact`'s `px-3` matches the old horizontal padding exactly while
  // `comfortable` would move both axes (ADR-0029).
  <ListRow as="li" density="compact">
    <p className="text-sm font-semibold break-words text-neutral-900" title={cause.groupName}>
      {cause.groupName}
    </p>

    {cause.ruleName && (
      <p className="mt-0.5 text-xs break-words text-neutral-600" title={cause.ruleName}>
        Rule: <span className="font-medium text-neutral-700">{cause.ruleName}</span>
      </p>
    )}

    {cause.remedy === 'cannot-determine' && (
      <p className="mt-2 text-xs text-neutral-700">
        {cause.undeterminedReason
          ? undeterminedReasonText[cause.undeterminedReason]
          : UNDETERMINED_FALLBACK}
      </p>
    )}

    {/* Groups to LEAVE come first: while the user holds an excluded membership
        the rule rejects them whatever else they join. */}
    <ClauseGroupList
      references={referencesOfPolarity(cause, 'non-member')}
      requirement="non-member"
      contextName={contextName}
      resolveGroupName={resolveGroupName}
      renderGroupAction={renderBlockingGroupAction}
    />

    <ClauseGroupList
      references={cause.requiredGroups ?? []}
      requirement="member"
      contextName={contextName}
      resolveGroupName={resolveGroupName}
      renderGroupAction={renderGroupAction}
    />

    <FailingClauses clauses={cause.failingClauses} />

    {onViewClauses && (
      <Button
        variant="ghost"
        size="sm"
        icon="link"
        className="mt-2"
        title={`Open the clause checklist for ${cause.groupName}`}
        onClick={() => onViewClauses(cause)}
      >
        Open clause checklist
      </Button>
    )}
  </ListRow>
);

/**
 * Render a resolved value as plain text, keeping quotes on strings so a trailing
 * space or an empty string stays visible. Mirrors `ClauseChecklist`'s formatting;
 * `null` prints as `null`, which is a different fact from "no value".
 */
const formatResolvedValue = (value: RuleExprValue): string =>
  typeof value === 'string' ? JSON.stringify(value) : String(value);

/** The failing-clause evidence, capped — the checklist jump carries the rest. */
const FailingClauses: React.FC<{ clauses: readonly ClauseExplanation[] }> = ({ clauses }) => {
  if (clauses.length === 0) return null;
  const hidden = clauses.length - CLAUSE_PREVIEW_LIMIT;

  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-neutral-600">
        {clauses.length} failing {clauses.length === 1 ? 'clause' : 'clauses'}
      </p>
      <ul className="mt-1 space-y-1">
        {clauses.slice(0, CLAUSE_PREVIEW_LIMIT).map((clause, index) => (
          <li
            key={`${index}-${clause.expressionText}`}
            className="rounded-md bg-neutral-50 px-2 py-1"
          >
            <code className="block font-mono text-xs break-words whitespace-pre-wrap text-neutral-900">
              {clause.expressionText}
            </code>
            {/* A group-membership call takes only string literals, and
                `resolveClauseValue` skips literals by design — so "no value could
                be read" is structurally guaranteed on these clauses and reads as
                an error that has not occurred. The group list above already says
                everything this line could. */}
            {clause.groupReferences === undefined && (
              <span className="mt-0.5 block text-xs text-neutral-600">
                Resolved value:{' '}
                {clause.resolvedValue === undefined
                  ? 'no value could be read for this clause'
                  : formatResolvedValue(clause.resolvedValue)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="mt-1 text-xs text-neutral-600">
          +{hidden} more failing {hidden === 1 ? 'clause' : 'clauses'}
        </p>
      )}
    </div>
  );
};

export default CauseWorklistRow;
