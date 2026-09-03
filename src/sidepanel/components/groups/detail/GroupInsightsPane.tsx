/**
 * @module sidepanel/components/groups/detail/GroupInsightsPane
 * @description Group Detail's fifth tab — what this group's data actually looks
 * like, and where it has drifted.
 *
 * Three sections, all presentational: the caller owns every load and hands its
 * state through, so this pane can be storied in every state without a network.
 *
 * ## Why it is not called "Health"
 *
 * "Health" names a verdict, and the pane does not deliver one — it delivers
 * *material* a reader draws a verdict from, and it will hold more of it over time
 * (staleness, orphaned assignments, rule overlap). Naming it for the subject
 * rather than the judgement is what lets those land here without the label going
 * stale. `AttributeHealthCard` keeps its own name: one card genuinely is about
 * one attribute's health.
 *
 * 1. **Attribute spread** — {@link discoverAttributeBreakdowns}'s per-attribute
 *    blank-rate/distribution report over the group's already-loaded roster, with
 *    {@link indexRulesByAttribute}'s reverse index over the feeding rules layered
 *    on as an **annotation**.
 *
 *    That layering used to be a *filter*: a card existed only for an attribute
 *    some feeding rule referenced. It hid exactly the drift worth catching —
 *    a `department` nobody's rule reads, spelled four different ways, is
 *    invisible until the day someone writes a rule against it and it silently
 *    grants the wrong people. So every discovered attribute gets a card, and the
 *    rule-referenced ones sort first because they are the ones that grant access
 *    today.
 *
 *    Gated behind the same roster load the Members tab uses
 *    (`memberStatus`/`onAnalyzeMembers` are `useGroupSource`'s
 *    `memberStatus`/`analyzeMembers`, passed straight through) — opening this tab
 *    before ever visiting Members renders its own small idle/loading/error/done
 *    gate that calls the identical `analyzeMembers()`, which `getOrFetch` already
 *    coalesces against a concurrent call from the Members tab. Not a second fetch.
 *
 *    A card's aggregated `Other (N values)` row opens the same
 *    {@link BreakdownDetailsModal} the Members tab uses, over the full
 *    distribution {@link computeDimensionBreakdown} re-derives from the roster
 *    already in hand — no second fetch there either, and the long list is only
 *    paid for when somebody opens it. Read-only: this pane has no member list,
 *    so no `onRowClick` is wired and the rows stay inert.
 * 2. **MFA coverage** — the group's opt-in, explicit MFA-enrollment scan
 *    ({@link module:sidepanel/hooks/useMemberMfaScan}, owned by the caller and
 *    passed through the same way `useGroupSource` is). Never auto-runs. Disabled
 *    with a "load members first" nudge until the roster above has loaded, since
 *    the scan needs the same member set.
 * 3. **About this group** — the group's own reference facts
 *    ({@link GroupMetadataSection}), folded into a `CollapsibleSection` default
 *    closed. Moved here (and out of its old always-visible position below the tab
 *    card) because it answers the rarest questions of the five tabs.
 */
import React, { useMemo, useState } from 'react';
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
import BreakdownDetailsModal from '../../members/BreakdownDetailsModal';
import {
  computeDimensionBreakdown,
  dimensionTitle,
  discoverAttributeBreakdowns,
  type AttributeSummary,
} from '../../members/memberAnalytics';
import {
  indexRulesByAttribute,
  type AttributeReferencingRule,
  type AttributeRuleRef,
} from '../../../../shared/rules/groupAttributeIndex';
import type { SourceStatus } from '../../../hooks/useGroupSource';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../../shared/types';

/** Props for {@link GroupInsightsPane}. */
interface GroupInsightsPaneProps {
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
  /**
   * The group's feeding rules. Layered onto the attribute cards as an annotation
   * — which attributes currently grant access — never as the filter deciding
   * which cards exist.
   */
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
  /** When the group's membership last changed, if the payload carried it. */
  lastMembershipUpdated?: Date;
}

/** No value can be an active filter here — this pane has no member list. */
const EMPTY_ACTIVE_VALUES: Set<string> = new Set();

/**
 * Renders the attribute-spread cards, the gated MFA-coverage scan, and the
 * folded "About this group" metadata for one group.
 */
const GroupInsightsPane: React.FC<GroupInsightsPaneProps> = ({
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
  lastMembershipUpdated,
}) => {
  const rosterReady = memberStatus === 'done' && members !== null;

  /*
    Which attribute's hidden "Other" tail is open, if any. The tail is
    re-derived on demand rather than carried through `AttributeSummary`:
    `computeDimensionBreakdown` defaults to unlimited rows, is pure, and runs
    over the roster this pane already holds — so the summary shape stays
    untouched and the full list costs nothing until it is asked for.
  */
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const detailRows = useMemo(
    () => (detailKey && members ? computeDimensionBreakdown(members, detailKey) : []),
    [detailKey, members],
  );

  const summaries = useMemo(() => (members ? discoverAttributeBreakdowns(members) : []), [members]);
  const ruleIndex = useMemo(() => indexRulesByAttribute(feedingRules), [feedingRules]);

  /*
    Every discovered attribute gets a card; the rule index only decides the
    *order*. Rule-referenced attributes come first because those are the ones
    granting access today — but the ones no rule reads are where undetected drift
    lives, so they are below the fold, not absent.

    `discoverAttributeBreakdowns` already orders by "common organizational
    attributes first, then fill rate", and that order is preserved inside each
    half: a stable partition, not a re-sort.
  */
  const cards = useMemo(() => {
    const withRules: Array<{ summary: AttributeSummary; rules: AttributeRuleRef[] }> = [];
    const withoutRules: Array<{ summary: AttributeSummary; rules: AttributeRuleRef[] }> = [];
    for (const summary of summaries) {
      const rules = ruleIndex.get(summary.key) ?? [];
      (rules.length > 0 ? withRules : withoutRules).push({ summary, rules });
    }
    return [...withRules, ...withoutRules];
  }, [summaries, ruleIndex]);

  return (
    <div className="space-y-(--sp-rung)">
      <DetailSection
        title="Attribute spread"
        description="Blank rate and value spread for every profile attribute across this group's members. The ones a feeding rule depends on come first."
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
        ) : cards.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No profile attribute in this group has a meaningful spread — every one is either blank
            or unique per member.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-(--sp-rung) sm:grid-cols-2">
            {cards.map(({ summary, rules }) => (
              <AttributeHealthCard
                key={summary.key}
                summary={summary}
                rules={rules}
                onNavigateToRule={onNavigateToRule}
                onShowOther={() => setDetailKey(summary.key)}
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

      {/* The values a card's "Other (N values)" row folded away. Read-only: no
        member list lives on this tab, so no row-click filter is wired. */}
      <BreakdownDetailsModal
        isOpen={detailKey !== null}
        onClose={() => setDetailKey(null)}
        title={detailKey ? dimensionTitle(detailKey) : ''}
        rows={detailRows}
        activeValues={EMPTY_ACTIVE_VALUES}
      />

      <CollapsibleSection title="About this group" defaultOpen={false}>
        <GroupMetadataSection
          groupId={groupId}
          description={description}
          created={created}
          lastUpdated={lastUpdated}
          lastMembershipUpdated={lastMembershipUpdated}
        />
      </CollapsibleSection>
    </div>
  );
};

export default GroupInsightsPane;
