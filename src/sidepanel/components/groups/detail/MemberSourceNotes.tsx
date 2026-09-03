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
import React, { useState } from 'react';
import { Button, Modal, ScrollableList } from '../../shared';
import RuleLinkRow from './RuleLinkRow';
import { toRuleAttributionRows, type RuleAttributionRow } from '../memberSourceBuckets';
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

/** How many rules the inline list names before it defers to the reveal. */
const INLINE_RULE_CAP = 3;

/** Props for {@link RuleAttributionRows}. */
interface RuleAttributionRowsProps {
  /** The rows to render, already sliced by the caller. */
  rows: readonly RuleAttributionRow[];
  /** Deep-links a contributing rule in the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
}

/**
 * The rows themselves, shared verbatim between the capped inline list and the
 * reveal that shows every one of them.
 *
 * One renderer rather than two, because the provenance chip is the part that
 * must not diverge: a rule Okta itself attributed and one the client-side
 * heuristic deduced are never drawn with the same weight (ADR-0020), and a
 * second copy of this markup is exactly where that would quietly stop being
 * true for the rules past the cap.
 *
 * @param props - See {@link RuleAttributionRowsProps}.
 */
const RuleAttributionRows: React.FC<RuleAttributionRowsProps> = ({ rows, onNavigateToRule }) => (
  <ul className="space-y-1.5">
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
 * ## Why it stops at three
 *
 * The list was unbounded, and it sits inside the Members tab's filter drawer
 * where it competes with the controls a reader opened the drawer to reach. A
 * group fed by a dozen rules put a dozen rows there, which is a report, not a
 * note. The top three answer "who feeds this group, mostly"; **+N more** opens
 * the rest in a reveal, and the count is stated rather than implied — the tail
 * is deferred, never silently dropped, which is the same rule
 * `memberSourceBuckets` applies to the meter's aggregated segment.
 *
 * The reveal renders {@link RuleAttributionRows}, the same rows with the same
 * chips and the same deep-links, so nothing about a rule past the third is a
 * weaker statement than one above it.
 *
 * @param props - See {@link RuleAttributionListProps}.
 */
export const RuleAttributionList: React.FC<RuleAttributionListProps> = ({
  breakdown,
  onNavigateToRule,
}) => {
  const rows = toRuleAttributionRows(breakdown);
  const [revealOpen, setRevealOpen] = useState(false);
  const hidden = Math.max(rows.length - INLINE_RULE_CAP, 0);

  return (
    <div>
      {/*
        `h5`, not `h3`. This renders as the explorer drawer's `sourceDetail`,
        directly under that drawer's `<h4>Source</h4>` — and the outline
        algorithm reads rank in document order, not DOM nesting, so an `h3` here
        pops back up to the rank of the list's own "Members" heading and
        misrepresents a subsection as a peer of the roster. One below its
        parent section is what it actually is.
      */}
      <h5 className="text-xs font-medium text-neutral-600">Attributed to</h5>
      {rows.length === 0 ? (
        <p className="mt-1.5 text-sm text-neutral-500">
          No member was attributed to a specific rule.
        </p>
      ) : (
        <div className="mt-1.5 space-y-1.5">
          <RuleAttributionRows
            rows={rows.slice(0, INLINE_RULE_CAP)}
            onNavigateToRule={onNavigateToRule}
          />
          {hidden > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRevealOpen(true)}
              title={`Show all ${rows.length.toLocaleString()} rules feeding this group`}
            >
              +{hidden.toLocaleString()} more rule{hidden === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      )}

      <Modal
        isOpen={revealOpen}
        onClose={() => setRevealOpen(false)}
        title="Attributed to"
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setRevealOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-(--sp-rung)">
          <p className="text-sm text-neutral-600">
            All {rows.length.toLocaleString()} rule{rows.length === 1 ? '' : 's'} that account for
            members of this group.
          </p>
          <ScrollableList maxHeight="50vh" fillAvailable={false}>
            <RuleAttributionRows rows={rows} onNavigateToRule={onNavigateToRule} />
          </ScrollableList>
        </div>
      </Modal>
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
