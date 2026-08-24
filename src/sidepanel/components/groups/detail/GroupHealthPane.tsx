/**
 * @module sidepanel/components/groups/detail/GroupHealthPane
 * @description Group Detail's fourth tab — "is this group's data trustworthy?"
 *
 * Three sections, all presentational: the caller owns every load and hands its
 * state through, so this pane can be storied in every state without a network.
 *
 * 1. **Attribute health** — intersects {@link discoverAttributeBreakdowns}'s
 *    per-attribute blank-rate/distribution report (over the group's already-loaded
 *    roster) with {@link indexRulesByAttribute}'s reverse index (over the group's
 *    feeding rules), so a card renders only for an attribute at least one feeding
 *    rule actually references — "attributes the rules depend on," not every
 *    attribute the org happens to populate. Gated behind the same roster load the
 *    Members tab uses (`memberStatus`/`onAnalyzeMembers` are `useGroupSource`'s
 *    `memberStatus`/`analyzeMembers`, passed straight through) — opening this tab
 *    before ever visiting Members renders its own small idle/loading/error/done
 *    gate that calls the identical `analyzeMembers()`, which `getOrFetch` already
 *    coalesces against a concurrent call from the Members tab. Not a second fetch.
 * 2. **MFA coverage** — the group's opt-in, explicit MFA-enrollment scan
 *    ({@link module:sidepanel/hooks/useMemberMfaScan}, owned by the caller and
 *    passed through the same way `useGroupSource` is). Never auto-runs. Disabled
 *    with a "load members first" nudge until the roster above has loaded, since
 *    the scan needs the same member set.
 * 3. **About this group** — the group's own reference facts
 *    ({@link GroupMetadataSection}), folded into a `CollapsibleSection` default
 *    closed. Moved here (and out of its old always-visible position below the tab
 *    card) because it answers the rarest questions of the four tabs.
 */
import React, { useMemo } from 'react';
import {
  AlertMessage,
  Button,
  CollapsibleSection,
  DetailSection,
  LoadingSpinner,
} from '../../shared';
import GroupMetadataSection from './GroupMetadataSection';
import AttributeHealthCard from './AttributeHealthCard';
import GroupMfaCoverageSection from './GroupMfaCoverageSection';
import {
  discoverAttributeBreakdowns,
  type AttributeSummary,
} from '../../overview/members/memberAnalytics';
import {
  indexRulesByAttribute,
  type AttributeReferencingRule,
  type AttributeRuleRef,
} from '../../../../shared/rules/groupAttributeIndex';
import type { SourceStatus } from '../../../hooks/useGroupSource';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../../shared/types';

/** Props for {@link GroupHealthPane}. */
interface GroupHealthPaneProps {
  /** The group's Okta id — used by the folded "About this group" section. */
  groupId: string;
  /** The group's member count, used for the attribute gate's cost estimate. */
  memberCount: number;
  /** The group's roster, once `useGroupSource`'s member analysis has populated it; `null` before then. */
  members: OktaUser[] | null;
  /** Status of the gated member analysis (shared with the Members tab). */
  memberStatus: SourceStatus;
  /** Error message when the member analysis failed. */
  error: string | null;
  /** Runs the gated member-source analysis — the exact function the Members tab calls. */
  onAnalyzeMembers: () => void;
  /** `false` when no Okta tab is connected, which disables both gate buttons. */
  canAnalyze?: boolean;
  /** The group's feeding rules, intersected with the attribute breakdown to build each card. */
  feedingRules: readonly AttributeReferencingRule[];
  /** Deep-links a dependent rule into the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;

  /** Per-member MFA scan results, or `null` before a scan has run/restored. */
  mfaResults: Map<string, MemberMfaResult> | null;
  /** Current MFA scan lifecycle status. */
  scanStatus: MfaScanStatus;
  /** Run the MFA scan now. */
  onRunScan: () => void;
  /** Move the MFA scan to its confirmation gate (large groups). */
  onRequestConfirm: () => void;
  /** Dismiss the MFA scan's confirmation gate. */
  onCancelConfirm: () => void;

  /** The group's description, for the folded "About this group" section. */
  description?: string;
  /** When Okta created the group, if the payload carried it. */
  created?: Date;
  /** When Okta last updated the group profile, if the payload carried it. */
  lastUpdated?: Date;
}

/**
 * Renders the attribute-health cards, the gated MFA-coverage scan, and the
 * folded "About this group" metadata for one group.
 */
const GroupHealthPane: React.FC<GroupHealthPaneProps> = ({
  groupId,
  memberCount,
  members,
  memberStatus,
  error,
  onAnalyzeMembers,
  canAnalyze = true,
  feedingRules,
  onNavigateToRule,
  mfaResults,
  scanStatus,
  onRunScan,
  onRequestConfirm,
  onCancelConfirm,
  description,
  created,
  lastUpdated,
}) => {
  const rosterReady = memberStatus === 'done' && members !== null;

  const summaries = useMemo(() => (members ? discoverAttributeBreakdowns(members) : []), [members]);
  const ruleIndex = useMemo(() => indexRulesByAttribute(feedingRules), [feedingRules]);
  const cards = useMemo(
    () =>
      summaries
        .map((summary) => ({ summary, rules: ruleIndex.get(summary.key) }))
        .filter(
          (card): card is { summary: AttributeSummary; rules: AttributeRuleRef[] } =>
            !!card.rules && card.rules.length > 0,
        ),
    [summaries, ruleIndex],
  );

  return (
    <div className="space-y-6">
      <DetailSection
        title="Attribute health"
        description="Blank rate and value spread for every attribute a feeding rule in this group depends on."
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
            {memberCount === 1 ? '' : 's'} once to compute each dependent attribute&apos;s blank
            rate and value spread.
          </p>
        ) : memberStatus === 'loading' ? (
          <LoadingSpinner size="sm" message="Analyzing members…" centered />
        ) : memberStatus === 'error' ? (
          <AlertMessage
            message={{ text: error || 'Failed to analyze members.', type: 'danger' }}
            action={{ label: 'Retry', onClick: onAnalyzeMembers }}
          />
        ) : cards.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No feeding rule assigning into this group references a user attribute.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cards.map(({ summary, rules }) => (
              <AttributeHealthCard
                key={summary.key}
                summary={summary}
                rules={rules}
                onNavigateToRule={onNavigateToRule}
              />
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection
        title="MFA coverage"
        description="Opt-in scan of each member's enrolled MFA factors. Never runs automatically."
      >
        {!rosterReady ? (
          <div className="space-y-2">
            <p className="text-sm text-neutral-500">
              Load members first — the scan needs the same roster as the cards above.
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon="chart"
              onClick={onAnalyzeMembers}
              disabled={!canAnalyze || memberCount === 0}
            >
              Load members
            </Button>
          </div>
        ) : (
          <GroupMfaCoverageSection
            members={members}
            mfaResults={mfaResults}
            scanStatus={scanStatus}
            onRunScan={onRunScan}
            onRequestConfirm={onRequestConfirm}
            onCancelConfirm={onCancelConfirm}
          />
        )}
      </DetailSection>

      <CollapsibleSection title="About this group" defaultOpen={false}>
        <GroupMetadataSection
          groupId={groupId}
          description={description}
          created={created}
          lastUpdated={lastUpdated}
        />
      </CollapsibleSection>
    </div>
  );
};

export default GroupHealthPane;
