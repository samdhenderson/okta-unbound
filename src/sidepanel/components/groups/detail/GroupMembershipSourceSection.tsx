/**
 * @module sidepanel/components/groups/detail/GroupMembershipSourceSection
 * @description "Where do these members come from?" — the gated member-source analysis.
 *
 * Section 2 of the Group Detail view, and the reason the old
 * `GroupSourceModal` existed. Presentational: the caller owns
 * {@link sidepanel/hooks/useGroupSource.useGroupSource} and passes its state
 * through, so this component can be storied in every state without a network.
 *
 * The analysis is **opt-in** — it costs one paginated read of the group's
 * members — so the idle state explains the cost and offers a button rather than
 * fetching on mount.
 *
 * The meter's *indeterminate* segment is named for what it is: members whose
 * feeding rule's condition the client-side evaluator could not resolve. That is a
 * limit of the evaluator, **not** a failed match, so it is spelled out in words
 * next to the meter and pointed at the surface that breaks the same condition down
 * clause by clause ({@link ClauseChecklist}, rendered per membership in the Users
 * tab).
 */
import React from 'react';
import { AlertMessage, Button, DetailSection, LoadingSpinner } from '../../shared';
import MemberSourceMeter from './MemberSourceMeter';
import RuleLinkRow from './RuleLinkRow';
import { toRuleAttributionRows } from '../memberSourceBuckets';
import type { SourceStatus } from '../../../hooks/useGroupSource';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';

/** Props for {@link GroupMembershipSourceSection}. */
interface GroupMembershipSourceSectionProps {
  /** The group's member count, used for the cost estimate on the gate button. */
  memberCount: number;
  /** The analyzed split, once the analysis has completed. */
  breakdown: MemberSourceBreakdown | null;
  /** Status of the gated analysis. */
  status: SourceStatus;
  /** Error message when the analysis failed. */
  error: string | null;
  /** Runs the gated member-source analysis. */
  onAnalyze: () => void;
  /** `false` when no Okta tab is connected, which disables the gate button. */
  canAnalyze?: boolean;
  /** Deep-links a contributing rule in the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
}

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
 * chip naming it an inference, so a guess never reads as a fact.
 */
const RuleAttributionList: React.FC<RuleAttributionListProps> = ({
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

/**
 * Explains the meter's indeterminate segment: those members are ones a feeding
 * rule's condition could not be **evaluated** for in the panel, which is a limit
 * of the client-side evaluator — not a failed match, and not a member who does
 * not belong. Says so in words so the segment is never read as a fault, and
 * points at the surface where the same condition is broken down clause by clause
 * ({@link sidepanel/components/groups/detail/ClauseChecklist}, rendered per
 * membership in the Users tab).
 */
const IndeterminateNote: React.FC<{ count: number }> = ({ count }) => (
  <p className="text-xs text-neutral-600">
    {count.toLocaleString()} member{count === 1 ? '' : 's'} could not be checked against a feeding
    rule&apos;s condition here — that is a limit of the client-side evaluator, not a failed match.
    Open one of them in the Users tab to see the rule explained clause by clause.
  </p>
);

/**
 * Renders the manual-vs-rule membership split for a group: a gate button while
 * idle, then the {@link MemberSourceMeter} plus each feeding rule's contribution.
 */
const GroupMembershipSourceSection: React.FC<GroupMembershipSourceSectionProps> = ({
  memberCount,
  breakdown,
  status,
  error,
  onAnalyze,
  canAnalyze = true,
  onNavigateToRule,
}) => {
  const hasMembers = memberCount > 0;

  return (
    <DetailSection
      title="Membership source"
      description="Splits the current members into rule-managed and manual."
      actions={
        status === 'idle' && hasMembers ? (
          <Button
            variant="secondary"
            size="sm"
            icon="chart"
            onClick={onAnalyze}
            disabled={!canAnalyze}
          >
            Analyze
          </Button>
        ) : undefined
      }
    >
      {!hasMembers ? (
        <p className="text-sm text-neutral-500">
          This group has no members, so there is nothing to attribute.
        </p>
      ) : status === 'idle' ? (
        <p className="text-sm text-neutral-500">
          Not analyzed yet. Reads all {memberCount.toLocaleString()} member
          {memberCount === 1 ? '' : 's'} once, then classifies each against the rules that assign
          into this group.
        </p>
      ) : status === 'loading' ? (
        <LoadingSpinner size="sm" message="Analyzing members…" centered />
      ) : status === 'error' ? (
        <AlertMessage
          message={{ text: error || 'Failed to analyze members.', type: 'danger' }}
          action={{ label: 'Retry', onClick: onAnalyze }}
        />
      ) : breakdown ? (
        <div className="space-y-4">
          <MemberSourceMeter breakdown={breakdown} />
          {breakdown.unattributed > 0 && <IndeterminateNote count={breakdown.unattributed} />}
          <RuleAttributionList breakdown={breakdown} onNavigateToRule={onNavigateToRule} />
        </div>
      ) : null}
    </DetailSection>
  );
};

export default GroupMembershipSourceSection;
