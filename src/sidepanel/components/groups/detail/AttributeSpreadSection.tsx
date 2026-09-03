/**
 * @module sidepanel/components/groups/detail/AttributeSpreadSection
 * @description The Insights tab's ranked stack of attribute cards, and the gate
 * in front of the roster it needs.
 *
 * Split out of {@link module:sidepanel/components/groups/detail/GroupInsightsPane}
 * once ranking joined the load gate in one section: the pane owns the three
 * sections and the one reveal modal, and this owns which card is worth reading
 * first.
 *
 * ## Rule coupling ranks, it does not partition
 *
 * {@link rankAttributes} orders by three signals — near-duplicate spellings
 * (weight 4), a hidden tail carrying a fifth of the group or more (2), and rule
 * coupling (1). Coupling is deliberately the lightest. An attribute spelled two
 * ways outranks an immaculate one that merely feeds a rule, because the drift is
 * what will break the rule; the partition this replaced sorted the mis-spelled
 * attribute *last*, precisely because nobody had written a rule against it yet.
 *
 * ## One anatomy on both sides of the split
 *
 * Attributes with no signal still render, in the identical card, under a
 * **Nothing flagged** rule. The rule is a label on the *order*, not a second
 * card shape: a reader learns one anatomy and reads the stack top to bottom, and
 * nothing about the quiet attributes is asserted beyond "today, nothing here is
 * worth your attention".
 */
import React, { useId, useMemo } from 'react';
import { AlertMessage, Button, DetailSection, Eyebrow, LoadingSpinner } from '../../shared';
import AttributeHealthCard from './AttributeHealthCard';
import {
  discoverAttributeBreakdowns,
  rankAttributes,
  type RankedAttribute,
} from '../../members/memberAnalytics';
import {
  indexRulesByAttribute,
  type AttributeReferencingRule,
} from '../../../../shared/rules/groupAttributeIndex';
import type { SourceStatus } from '../../../hooks/useGroupSource';
import type { OktaUser } from '../../../../shared/types';

/** Props for {@link AttributeSpreadSection}. */
export interface AttributeSpreadSectionProps {
  /** The group's member count, used for the gate's cost estimate. */
  memberCount: number;
  /** The group's roster once the shared member analysis has populated it; `null` before then. */
  members: OktaUser[] | null;
  /** Status of the gated member analysis (shared with the Members tab). */
  memberStatus: SourceStatus;
  /** Error message when the member analysis failed. */
  error: string | null;
  /** Runs the gated member-source analysis — the exact function the Members tab calls. */
  onAnalyzeMembers: () => void;
  /** `false` when no Okta tab is connected, which disables the gate button. */
  canAnalyze?: boolean;
  /**
   * The group's feeding rules. An **annotation and a ranking input**, never the
   * filter deciding which cards exist.
   */
  feedingRules: readonly AttributeReferencingRule[];
  /** Deep-links a dependent rule into the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
  /** Opens the pane's full-distribution reveal for one attribute key. */
  onShowAll: (attributeKey: string) => void;
}

/**
 * Ranks every discovered profile attribute and renders one card each, behind the
 * same roster gate the Members tab uses.
 *
 * @param props - See {@link AttributeSpreadSectionProps}.
 */
const AttributeSpreadSection: React.FC<AttributeSpreadSectionProps> = ({
  memberCount,
  members,
  memberStatus,
  error,
  onAnalyzeMembers,
  canAnalyze = true,
  feedingRules,
  onNavigateToRule,
  onShowAll,
}) => {
  const quietLabelId = useId();

  const summaries = useMemo(() => (members ? discoverAttributeBreakdowns(members) : []), [members]);
  const ruleIndex = useMemo(() => indexRulesByAttribute(feedingRules), [feedingRules]);

  /*
    `discoverAttributeBreakdowns`' own order ("common organizational attributes
    first, then fill rate") still decides ties: `rankAttributes` sorts stably.
  */
  const ranked = useMemo(
    () => rankAttributes(summaries, (key) => (ruleIndex.get(key) ?? []).length),
    [summaries, ruleIndex],
  );
  const flagged = ranked.filter((entry) => entry.flagged);
  const quiet = ranked.filter((entry) => !entry.flagged);

  const renderCards = (entries: RankedAttribute[]) => (
    <div className="grid grid-cols-1 gap-(--sp-rung) sm:grid-cols-2">
      {entries.map(({ summary, signals }) => (
        <AttributeHealthCard
          key={summary.key}
          summary={summary}
          signals={signals}
          rules={ruleIndex.get(summary.key) ?? []}
          onNavigateToRule={onNavigateToRule}
          onShowOther={() => onShowAll(summary.key)}
        />
      ))}
    </div>
  );

  return (
    <DetailSection
      title="Attribute spread"
      description="How each profile attribute is populated across this group's members. Flagged first: drift, a hidden long tail, or a rule that depends on it."
      actions={
        memberStatus === 'idle' && memberCount > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            icon="chart"
            onClick={onAnalyzeMembers}
            disabled={!canAnalyze}
          >
            Analyze
          </Button>
        ) : undefined
      }
    >
      {memberCount === 0 ? (
        <p className="text-sm text-neutral-500">
          This group has no members, so there is nothing to profile.
        </p>
      ) : memberStatus === 'idle' ? (
        <p className="text-sm text-neutral-500">
          Not analyzed yet. Reads all {memberCount.toLocaleString()} member
          {memberCount === 1 ? '' : 's'} once to compute every profile attribute&apos;s blank rate
          and value spread.
        </p>
      ) : memberStatus === 'loading' ? (
        <LoadingSpinner size="sm" message="Analyzing members…" centered />
      ) : memberStatus === 'error' ? (
        <AlertMessage
          message={{ text: error || 'Failed to analyze members.', type: 'danger' }}
          action={{ label: 'Retry', onClick: onAnalyzeMembers }}
        />
      ) : ranked.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No profile attribute in this group has a meaningful spread — every one is either blank or
          unique per member.
        </p>
      ) : (
        <div className="space-y-(--sp-rung)">
          {flagged.length > 0 && renderCards(flagged)}

          {/* The rule labels the *order*, not a different kind of card. Without
            it the stack below the last flagged card looks arbitrary. */}
          {quiet.length > 0 && flagged.length > 0 && (
            <div role="group" aria-labelledby={quietLabelId} className="space-y-(--sp-rung) pt-1">
              <div className="flex items-center gap-(--sp-inline)">
                <Eyebrow id={quietLabelId}>Nothing flagged</Eyebrow>
                <span aria-hidden="true" className="h-px flex-1 bg-neutral-200" />
              </div>
              {renderCards(quiet)}
            </div>
          )}
          {quiet.length > 0 && flagged.length === 0 && renderCards(quiet)}
        </div>
      )}
    </DetailSection>
  );
};

export default AttributeSpreadSection;
