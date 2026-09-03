/**
 * @module sidepanel/components/members/MemberExplorer
 * @description Orchestrator for in-group member search, faceting, composition, MFA, and listing.
 *
 * Owns the explorer's client-side state — debounced search, sort
 * field/direction, and the paged visible window — and derives the
 * filtered/sorted list via the pure helpers in `memberAnalytics`. The facet
 * filter set is the exception: it lives in
 * {@link module:sidepanel/hooks/useMemberFilters}, because it is the one piece
 * of this state a neighbouring surface has a reason to reach. Composes the search bar, filter panel, MFA scan panel,
 * composition reports, member list, and the details/copy modals. MFA scan results
 * are owned by the parent overview and passed in.
 *
 * ## Two surfaces, one explorer
 *
 * `overview/GroupOverview` and the Group Detail Members tab both mount this. Every
 * prop the detail surface needs beyond the overview's set is **optional, and its
 * absence is the overview's correct behaviour** — not a degraded one:
 *
 * - No `memberSource` ⇒ no meter, no source pills. The overview never loads
 *   feeding rules, and labelling an unclassified roster "Manual" would manufacture
 *   a fact (`users/GroupMembershipsList` states the same rule for the sibling case).
 * - No `onRemoveMember` ⇒ rows render no remove control. Never a disabled one
 *   (ADR-0039).
 *
 * So adding a surface never costs the other one a dead control.
 */
import React, { useCallback, useId, useMemo, useState } from 'react';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../shared/types';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { mfaScanNeedsConfirm } from '../../hooks/useMemberMfaScan';
import Button from '../shared/Button';
import FilterToggle from '../shared/FilterToggle';
import Modal from '../shared/Modal';
import MemberSearchBar from './MemberSearchBar';
import MemberFilterDrawer from './MemberFilterDrawer';
import ActiveFilterChips from './ActiveFilterChips';
import CopyMembersModal from './CopyMembersModal';
import BreakdownDetailsModal from './BreakdownDetailsModal';
import MemberList from './MemberList';
import { useMembershipProofs } from '../users/GroupMembershipsListProof';
import { useMemberFilters } from '../../hooks/useMemberFilters';
import type { MemberRuleAttribution } from '../../../shared/membership/memberRuleAttribution';
import type { GroupMembership } from '../../../shared/types';
import type { MemberSourceIndex } from '../../../shared/membership/memberSourceIndex';
import type { MemberSourceBucket } from '../groups/memberSourceBuckets';
import {
  type SortField,
  computeDimensionBreakdown,
  discoverAttributeBreakdowns,
  filterMembers,
  sortMembers,
  getObservedFactorLabels,
  dimensionTitle,
} from './memberAnalytics';

/**
 * Everything the explorer needs to show — and filter by — where each member's
 * membership came from.
 *
 * One bundle rather than flat props because the feature is present or absent as a
 * whole: an index with no segments has nothing to draw, and segments with no index
 * would draw a meter whose pills could not resolve to anyone.
 */
export interface MemberSourceContext {
  /** Per-member source classification, from `buildMemberSourceIndex`. */
  index: MemberSourceIndex;
  /**
   * The exclusive display segments, in render order, from
   * `toMemberSourceSegments`. The caller owns this because how many rules earn a
   * named segment is a presentation decision the index deliberately does not make.
   */
  segments: MemberSourceBucket[];
}

/** Props for {@link MemberExplorer}. */
interface MemberExplorerProps {
  /** The group's full member set (the explorer filters/sorts locally). */
  members: OktaUser[];
  /**
   * True while the member set is being re-fetched behind an already-rendered
   * explorer (after a bulk removal, or a retry). The rows below are stale, so the
   * list swaps to skeleton placeholders rather than showing figures that are about
   * to change. Defaults to `false`.
   */
  isReloading?: boolean;
  /** Per-member MFA scan results, or null before a scan has run. */
  mfaResults: Map<string, MemberMfaResult> | null;
  /** Current MFA scan lifecycle status. */
  scanStatus: MfaScanStatus;
  /** Start the MFA scan. */
  onRunScan: () => void;
  /** Request the confirmation gate (used for large groups). */
  onRequestConfirm: () => void;
  /** Dismiss the confirmation gate. */
  onCancelConfirm: () => void;
  /** Okta org origin for member Admin Console links (null when unknown). */
  oktaOrigin?: string | null;
  /**
   * Per-member membership source. Absent ⇒ no meter and no source pills — see the
   * module doc for why that is the overview's correct rendering, not a fallback.
   */
  memberSource?: MemberSourceContext;
  /**
   * Commentary about *this* group's split, rendered directly under the source
   * strip — the indeterminate correction and the per-rule accounting. Owned by
   * the caller because it is about one group, not about how a roster is faceted;
   * see `groups/detail/MemberSourceNotes`. Ignored when `memberSource` is absent,
   * since there is no strip for it to sit under.
   */
  sourceDetail?: React.ReactNode;
  /**
   * Request removal of a member from the group. Absent ⇒ rows render no remove
   * control (ADR-0039: an unimplemented verb is omitted, not shipped `disabled`).
   */
  onRemoveMember?: (user: OktaUser) => void;
  /**
   * Asks Okta which rules manage one member's membership (ADR-0031). Absent ⇒ no
   * row offers the action.
   *
   * **One API call per member**, so it is invoked from a click on an already-open
   * row only — never for the list, and never on mount. Rows whose roster embed
   * already carried Okta's answer never offer it at all; see
   * {@link MemberRow}.
   */
  onProveMemberSource?: (
    membership: GroupMembership,
    userId: string,
  ) => Promise<MemberRuleAttribution>;
  /**
   * Moves to the group's Insights tab, where the composition reports now live.
   * Absent ⇒ no pointer is drawn, because a surface with no way to reach
   * Insights should not claim there is one (ADR-0039).
   */
  onOpenInsights?: () => void;
}

/** Number of member rows revealed per page / "Load more". */
const PAGE = 50;

/**
 * Renders the member explorer and owns its search/filter/sort/pagination state.
 * All list derivation is delegated to the pure `memberAnalytics` helpers.
 */
const MemberExplorer: React.FC<MemberExplorerProps> = ({
  members,
  isReloading = false,
  mfaResults,
  scanStatus,
  onRunScan,
  onRequestConfirm,
  onCancelConfirm,
  oktaOrigin,
  memberSource,
  sourceDetail,
  onRemoveMember,
  onProveMemberSource,
  onOpenInsights,
}) => {
  const drawerId = useId();
  const [query, setQuery] = useState('');
  /*
    The filter set is the one piece of this component's state a neighbouring
    surface has a reason to reach, so it is the piece that lives in a hook —
    see `hooks/useMemberFilters` for the grammar it owns.
  */
  const memberFilters = useMemberFilters();
  const { filters } = memberFilters;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDesc, setSortDesc] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  // Debounce the search query so filtering runs at most a few times per second.
  const debouncedQuery = useDebouncedValue(query, 200);

  // Distributions are computed over the full member set (stable while faceting).
  const attributes = useMemo(() => discoverAttributeBreakdowns(members), [members]);
  const statusRows = useMemo(() => computeDimensionBreakdown(members, 'status'), [members]);
  const factorLabels = useMemo(() => getObservedFactorLabels(mfaResults), [mfaResults]);

  /*
    Resolve the meter's aggregated tail.

    `memberSourceIndex` deliberately assigns nobody to `otherRules`: which rules
    get folded into it depends on how many named segments the meter drew, which is
    presentation and not a fact about a member. The surface that did the
    aggregating is the one that can resolve it — so the `rule:<id>` buckets the
    segments did *not* name are unioned here into the `otherRules` key the pill
    filters on. Everything else passes through untouched.
  */
  const sourceBuckets = useMemo(() => {
    if (!memberSource) return null;
    const named = new Set(memberSource.segments.map((segment) => segment.key));
    const merged = new Map<string, ReadonlySet<string>>(memberSource.index.userIdsByBucket);
    const tail = new Set<string>();
    for (const [key, userIds] of memberSource.index.userIdsByBucket) {
      if (key.startsWith('rule:') && !named.has(key)) {
        for (const userId of userIds) tail.add(userId);
      }
    }
    if (tail.size > 0) merged.set('otherRules', tail);
    return merged;
  }, [memberSource]);

  // Rows key their own answers by user id — see `useMembershipProofs` on why a
  // roster cannot use the default group key.
  const proofs = useMembershipProofs(onProveMemberSource);

  const filtered = useMemo(
    () => filterMembers(members, debouncedQuery, filters, mfaResults, sourceBuckets),
    [members, debouncedQuery, filters, mfaResults, sourceBuckets],
  );
  const sorted = useMemo(
    () => sortMembers(filtered, sortBy, sortDesc, mfaResults),
    [filtered, sortBy, sortDesc, mfaResults],
  );

  // Reset the visible window whenever the result set / order changes. Done during
  // render (not in an effect) per the React pattern for deriving state.
  const resetKey = `${debouncedQuery}__${memberFilters.key}__${members.length}__${sortBy}__${sortDesc}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setVisibleCount(PAGE);
  }

  const toggleSort = useCallback((field: SortField) => {
    setSortBy((prevField) => {
      if (prevField === field) {
        setSortDesc((d) => !d);
        return prevField;
      }
      setSortDesc(false);
      return field;
    });
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE, sorted.length));
  }, [sorted.length]);

  // A single scan entry point (used by the filter panel and the Composition MFA
  // tab): large groups route through the confirmation gate, small ones scan now.
  const handleScanClick = useCallback(() => {
    if (mfaScanNeedsConfirm(members.length)) onRequestConfirm();
    else onRunScan();
  }, [members.length, onRequestConfirm, onRunScan]);

  const mfaScanned = mfaResults !== null && scanStatus === 'complete';

  // Full value distribution for the attribute details modal.
  const detailRows = useMemo(
    () => (detailKey ? computeDimensionBreakdown(members, detailKey) : []),
    [detailKey, members],
  );
  const detailActiveValues = memberFilters.valuesFor(detailKey);

  /* Which attributes currently contribute a filter — the drawer rows say so. */
  const filteredDimensions = useMemo(
    () => new Set(filters.map((filter) => filter.dimension)),
    [filters],
  );

  return (
    <div className="space-y-(--sp-rung)">
      {/*
        The control line — one band, and the only one above the roster.

        Row one is the two things a reader reaches for without thinking: the
        search field, and the trigger for everything else. Row two is what is
        currently filtering the list, stated in chips, because a filter you
        cannot see is worse than a control you cannot reach. Row three is how
        much of the roster survived it, beside the one verb that operates on
        that surviving set.

        Everything else — the membership-source strip and its notes, the
        status/MFA/sort controls, the routes into each profile attribute — is in
        the drawer below. Somebody who opened the Members tab came to see
        members.
      */}
      <div className="space-y-(--sp-field)">
        <div className="flex gap-(--sp-field)">
          <div className="flex-1">
            <MemberSearchBar value={query} onChange={setQuery} />
          </div>
          <FilterToggle
            open={drawerOpen}
            activeCount={memberFilters.activeCount}
            onToggle={() => setDrawerOpen((prev) => !prev)}
            controls={drawerId}
          />
        </div>

        {/* Renders nothing at all when the set is empty. */}
        <ActiveFilterChips
          filters={filters}
          onRemove={memberFilters.remove}
          onClearAll={memberFilters.clearAll}
        />

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">
            Members
            {/*
              Both parts from first paint — `250 of 250` rather than `250` that
              becomes `47 of 250` the moment a filter applies. The heading sits in
              a `justify-between` row, so the old form grew in place and pushed
              the Copy button beside it (D-053f). `tabular-nums` keeps it still as
              the digits themselves change.
            */}
            <span className="ml-2 text-xs font-normal tabular-nums text-neutral-500">
              {sorted.length.toLocaleString()} of {members.length.toLocaleString()}
            </span>
          </h3>
          <Button
            variant="secondary"
            size="sm"
            icon="clipboard"
            onClick={() => setCopyOpen(true)}
            disabled={sorted.length === 0}
            title="Copy the listed members as names or emails"
          >
            Copy members
          </Button>
        </div>
      </div>

      <MemberFilterDrawer
        id={drawerId}
        open={drawerOpen}
        memberFilters={memberFilters}
        memberSource={memberSource}
        sourceDetail={sourceDetail}
        statusRows={statusRows}
        mfaResults={mfaResults}
        factorLabels={factorLabels}
        memberCount={members.length}
        scanStatus={scanStatus}
        onRunScanClick={handleScanClick}
        sortBy={sortBy}
        sortDesc={sortDesc}
        onToggleSort={toggleSort}
        attributes={attributes}
        filteredDimensions={filteredDimensions}
        onSelectAttribute={setDetailKey}
        onOpenInsights={onOpenInsights}
      />

      <MemberList
        members={sorted}
        loading={isReloading}
        mfaResults={mfaResults}
        mfaScanned={mfaScanned}
        visibleCount={visibleCount}
        onLoadMore={loadMore}
        oktaOrigin={oktaOrigin}
        onRemoveMember={onRemoveMember}
        memberSourceIndex={memberSource?.index}
        proofs={proofs}
      />

      {/* Full attribute distribution modal */}
      <BreakdownDetailsModal
        isOpen={detailKey !== null}
        onClose={() => setDetailKey(null)}
        title={detailKey ? dimensionTitle(detailKey) : ''}
        rows={detailRows}
        activeValues={detailActiveValues}
        onRowClick={(row) => detailKey && memberFilters.toggleRow(detailKey, row)}
      />

      {/* Copy members (name / email / username) modal */}
      <CopyMembersModal isOpen={copyOpen} onClose={() => setCopyOpen(false)} members={sorted} />

      {/* MFA scan confirmation gate for large groups (triggered from the filter panel
          or the Composition MFA tab; kept here so it renders regardless of either). */}
      <Modal
        isOpen={scanStatus === 'confirming'}
        onClose={onCancelConfirm}
        title="Run MFA scan?"
        footer={
          <>
            <Button variant="secondary" onClick={onCancelConfirm}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onRunScan}>
              Scan anyway
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          This group has <strong>{members.length.toLocaleString()}</strong> members. Scanning makes
          roughly <strong>{members.length.toLocaleString()}</strong> API calls (one per member) and
          may take a while on large groups. Results are cached until you reload the panel.
        </p>
      </Modal>
    </div>
  );
};

export default MemberExplorer;
