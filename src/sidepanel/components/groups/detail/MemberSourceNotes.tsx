/**
 * @module sidepanel/components/groups/detail/MemberSourceNotes
 * @description The two things the Members tab's source strip says that a meter
 * cannot: what "indeterminate" actually means, and which rule accounts for whom.
 *
 * Both moved here verbatim from `GroupMembershipSourceSection`, which is deleted.
 * That section's readout is now the strip inside the member explorer
 * ({@link module:sidepanel/components/members/MemberSourceFilterBar}) — a control
 * as well as a readout — but these two are *commentary about this group*, not a
 * split of it, so they do not belong inside a component two surfaces share.
 *
 * ## Why the indeterminate note is text and not a tooltip
 *
 * The meter's indeterminate segment is members whose feeding rule's condition the
 * client-side evaluator could not resolve. That is a limit of the evaluator,
 * **not** a failed match and not a member who does not belong — so it is spelled
 * out in words next to the strip and points at the surface that breaks the same
 * condition down clause by clause ({@link ClauseChecklist}). Demoting it to a
 * segment `title` would make the correction invisible to anyone not hovering, and
 * ADR-0023 rules tooltip-only content out of tests for exactly that reason.
 *
 * ## Security
 *
 * Rule names are untrusted, end-user-controllable Okta data: rendered as escaped
 * React text, never logged.
 */
import React from 'react';
import RuleLinkRow from './RuleLinkRow';
import { toRuleAttributionRows } from '../memberSourceBuckets';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';

/** Props for {@link IndeterminateNote}. */
interface IndeterminateNoteProps {
  /** How many members could not be checked against a condition. */
  count: number;
}

/**
 * Explains the strip's indeterminate slice as unevaluated rather than as a failed
 * match.
 *
 * @param props - See {@link IndeterminateNoteProps}.
 */
export const IndeterminateNote: React.FC<IndeterminateNoteProps> = ({ count }) => (
  <p className="text-xs text-neutral-600">
    {count.toLocaleString()} member{count === 1 ? '' : 's'} could not be checked against a feeding
    rule&apos;s condition here — that is a limit of the client-side evaluator, not a failed match.
    Open one of them in the Users tab to see the rule explained clause by clause.
  </p>
);

/** Props for {@link RuleAttributionList}. */
interface RuleAttributionListProps {
  /** The analyzed split whose `byRule` contributions are listed. */
  breakdown: MemberSourceBreakdown;
  /** Deep-links a contributing rule in the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
}

/**
 * The "Attributed to" list: one deep-linkable row per feeding rule, each
 * carrying how many members it accounts for.
 *
 * A row that Okta itself attributed and one the client-side heuristic deduced
 * are **not** rendered with the same weight — the deduced row carries a warning
 * chip naming it an inference, so a guess never reads as a fact (ADR-0020).
 *
 * @param props - See {@link RuleAttributionListProps}.
 */
export const RuleAttributionList: React.FC<RuleAttributionListProps> = ({
  breakdown,
  onNavigateToRule,
}) => {
  const rows = toRuleAttributionRows(breakdown);

  return (
    <div>
      <h3 className="text-xs font-medium text-neutral-600">Attributed to</h3>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-sm text-neutral-500">
          No member was attributed to a specific rule.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {rows.map((row) => (
            <li key={row.ruleId}>
              <RuleLinkRow
                name={row.ruleName}
                onSelect={onNavigateToRule ? () => onNavigateToRule(row.ruleId) : undefined}
                trailing={
                  <span className="flex items-center gap-2">
                    {row.provenanceLabel && (
                      <span
                        title={row.provenanceTitle}
                        className={`rounded-md border px-2 py-0.5 text-xs font-medium ${row.provenanceClass}`}
                      >
                        {row.provenanceLabel}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-neutral-600">
                      {row.count.toLocaleString()} member{row.count === 1 ? '' : 's'}
                    </span>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Props for {@link MemberSourceNotes}. */
export interface MemberSourceNotesProps {
  /** The analyzed split this commentary is about. */
  breakdown: MemberSourceBreakdown;
  /** Deep-links a contributing rule in the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
}

/**
 * Both notes, in the order the strip wants them: the correction first, then the
 * per-rule accounting.
 *
 * @param props - See {@link MemberSourceNotesProps}.
 */
const MemberSourceNotes: React.FC<MemberSourceNotesProps> = ({ breakdown, onNavigateToRule }) => (
  <div className="space-y-3">
    {breakdown.unattributed > 0 && <IndeterminateNote count={breakdown.unattributed} />}
    <RuleAttributionList breakdown={breakdown} onNavigateToRule={onNavigateToRule} />
  </div>
);

export default MemberSourceNotes;
