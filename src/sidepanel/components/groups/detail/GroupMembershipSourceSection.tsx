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
 */
import React from 'react';
import { AlertMessage, Button, LoadingSpinner } from '../../shared';
import DetailSection from './DetailSection';
import MemberSourceMeter from './MemberSourceMeter';
import RuleLinkRow from './RuleLinkRow';
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

          <div>
            <h3 className="text-xs font-medium text-neutral-600">Attributed to</h3>
            {breakdown.byRule.length === 0 ? (
              <p className="mt-1.5 text-sm text-neutral-500">
                No member was attributed to a specific rule.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {breakdown.byRule.map((contribution) => (
                  <li key={contribution.ruleId}>
                    <RuleLinkRow
                      name={contribution.ruleName}
                      onSelect={
                        onNavigateToRule ? () => onNavigateToRule(contribution.ruleId) : undefined
                      }
                      trailing={
                        <span className="text-xs font-semibold text-neutral-600">
                          {contribution.count.toLocaleString()} member
                          {contribution.count === 1 ? '' : 's'}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </DetailSection>
  );
};

export default GroupMembershipSourceSection;
