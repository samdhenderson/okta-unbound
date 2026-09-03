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
 * 1. **Attribute spread** — {@link AttributeSpreadSection}: a ranked card per
 *    discovered profile attribute over the group's already-loaded roster, with
 *    the feeding rules layered on as an **annotation and a ranking input**, never
 *    as the filter deciding which cards exist. The ordering rules and the
 *    flagged/quiet split live in that component's own header.
 *
 *    Gated behind the same roster load the Members tab uses
 *    (`memberStatus`/`onAnalyzeMembers` are `useGroupSource`'s
 *    `memberStatus`/`analyzeMembers`, passed straight through) — opening this tab
 *    before ever visiting Members renders its own small idle/loading/error/done
 *    gate that calls the identical `analyzeMembers()`, which `getOrFetch` already
 *    coalesces against a concurrent call from the Members tab. Not a second fetch.
 *
 *    A card discloses in three stages: collapsed (badges, spread bar, value
 *    count), expanded (the value list, in place), then the same
 *    {@link BreakdownDetailsModal} the Members tab uses, over the full
 *    distribution {@link computeDimensionBreakdown} re-derives from the roster
 *    already in hand — no second fetch, and the long list is only paid for when
 *    somebody opens it. A row in that modal *leaves* for the Members tab, so it
 *    runs in `navigate` intent and names its destination before it is clicked;
 *    with no `onFilterMembers` wired the rows stay inert instead.
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
import React, { useCallback, useMemo, useState } from 'react';
import { Button, CollapsibleSection, DetailSection } from '../../shared';
import GroupMetadataSection from './GroupMetadataSection';
import AttributeSpreadSection from './AttributeSpreadSection';
import GroupMfaCoverageSection from './GroupMfaCoverageSection';
import BreakdownDetailsModal from '../../members/BreakdownDetailsModal';
import CompositionReports from '../../members/CompositionReports';
import { mfaScanNeedsConfirm } from '../../../hooks/useMemberMfaScan';
import {
  computeDimensionBreakdown,
  computeMfaBreakdown,
  dimensionTitle,
  discoverAttributeBreakdowns,
  type MemberFilter,
} from '../../members/memberAnalytics';
import type { AttributeReferencingRule } from '../../../../shared/rules/groupAttributeIndex';
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
  /**
   * Applies one value as a member filter and moves to the Members tab.
   *
   * **Omit and the reveal stays read-only** — this pane has no member list of its
   * own, so without a caller able to honour it the rows would offer a filter that
   * goes nowhere. When it *is* wired, every row says where it goes and what it
   * will apply before it is clicked (see `BreakdownReport`'s `rowIntent`).
   */
  onFilterMembers?: (filter: MemberFilter) => void;

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

/** Same reason, in the shape the composition reports read. */
const NO_ACTIVE_FILTERS: MemberFilter[] = [];

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
  onFilterMembers,
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

  /*
    The composition reports, moved off the Members tab. They are a distribution
    of the roster, not a control over it, and the Members tab was stacking them
    between a reader and the first member row.

    Here every value is a *jump*: this pane has no member list, so a click
    applies the filter over there and moves. That is why the whole section is
    gated on `onFilterMembers` rather than rendered inert — the reports are
    entirely made of value clicks, and a grid of them that does nothing is worse
    than the section being absent (ADR-0039).
  */
  const attributes = useMemo(
    () => (members ? discoverAttributeBreakdowns(members) : []),
    [members],
  );
  const mfaRows = useMemo(
    () => computeMfaBreakdown(members ?? [], mfaResults),
    [members, mfaResults],
  );

  const jumpToMembers = useCallback(
    (dimension: string, value: string, label: string) => {
      onFilterMembers?.({ dimension, value, label });
    },
    [onFilterMembers],
  );

  const handleScanClick = useCallback(() => {
    if (mfaScanNeedsConfirm(memberCount)) onRequestConfirm();
    else onRunScan();
  }, [memberCount, onRequestConfirm, onRunScan]);

  return (
    <div className="space-y-(--sp-rung)">
      <AttributeSpreadSection
        memberCount={memberCount}
        members={members}
        memberStatus={memberStatus}
        error={error}
        onAnalyzeMembers={onAnalyzeMembers}
        canAnalyze={canAnalyze}
        feedingRules={feedingRules}
        onNavigateToRule={onNavigateToRule}
        onShowAll={setDetailKey}
      />

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

      {rosterReady && onFilterMembers && (
        <CompositionReports
          attributes={attributes}
          filters={NO_ACTIVE_FILTERS}
          onToggle={(dimension, row) =>
            jumpToMembers(dimension, row.value, `${dimensionTitle(dimension)}: ${row.label}`)
          }
          onExpand={setDetailKey}
          mfaRows={mfaRows}
          mfaResults={mfaResults}
          scanStatus={scanStatus}
          memberCount={memberCount}
          onToggleMfa={(row) => jumpToMembers('mfa', row.value, row.label)}
          onRunScanClick={handleScanClick}
        />
      )}

      {/* Stage three: every value, including the ones a card's tail folded away.
        A row here *leaves* — it filters the Members tab — so it runs in
        `navigate` intent, where each row names its destination and its filter
        before it is taken. Without `onFilterMembers` the pane has nothing that
        could honour a click, and the rows stay inert rather than promising it. */}
      <BreakdownDetailsModal
        isOpen={detailKey !== null}
        onClose={() => setDetailKey(null)}
        title={detailKey ? dimensionTitle(detailKey) : ''}
        rows={detailRows}
        activeValues={EMPTY_ACTIVE_VALUES}
        rowIntent="navigate"
        onRowClick={
          onFilterMembers && detailKey
            ? (row) => {
                onFilterMembers({
                  dimension: detailKey,
                  value: row.value,
                  label: `${dimensionTitle(detailKey)}: ${row.label}`,
                });
                setDetailKey(null);
              }
            : undefined
        }
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
