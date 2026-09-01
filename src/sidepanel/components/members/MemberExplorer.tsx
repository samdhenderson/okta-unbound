/**
 * @module sidepanel/components/members/MemberExplorer
 * @description Orchestrator for in-group member search, faceting, composition, MFA, and listing.
 *
 * Owns the explorer's client-side state — debounced search, the active
 * {@link MemberFilter} set, sort field/direction, and the paged visible window —
 * and derives the filtered/sorted list via the pure helpers in
 * `memberAnalytics`. Composes the search bar, filter panel, MFA scan panel,
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
import React, { useState, useMemo, useCallback } from 'react';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../shared/types';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { mfaScanNeedsConfirm } from '../../hooks/useMemberMfaScan';
import Button from '../shared/Button';
import FilterToggle from '../shared/FilterToggle';
import Modal from '../shared/Modal';
import MemberSearchBar from './MemberSearchBar';
import MemberFilterPanel from './MemberFilterPanel';
import CopyMembersModal from './CopyMembersModal';
import CompositionReports from './CompositionReports';
import BreakdownDetailsModal from './BreakdownDetailsModal';
import MemberList from './MemberList';
import MemberSourceFilterBar from './MemberSourceFilterBar';
import { useMembershipProofs } from '../users/GroupMembershipsListProof';
import type { MemberRuleAttribution } from '../../../shared/membership/memberRuleAttribution';
import type { GroupMembership } from '../../../shared/types';
import type { MemberSourceIndex } from '../../../shared/membership/memberSourceIndex';
import type { MemberSourceBucket } from '../groups/memberSourceBuckets';
import {
  type BreakdownRow,
  type Dimension,
  type MemberFilter,
  type SortField,
  computeDimensionBreakdown,
  computeMfaBreakdown,
  discoverAttributeBreakdowns,
  filterMembers,
  sortMembers,
  getObservedFactorLabels,
  dimensionTitle,
  SOURCE_DIMENSION,
} from './memberAnalytics';

/** Per-factor filter intent: unset, require-present, or require-absent. */
type FactorMode = 'off' | 'has' | 'missing';

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
}) => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<MemberFilter[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [showFilters, setShowFilters] = useState(false);
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
  const mfaRows = useMemo(() => computeMfaBreakdown(members, mfaResults), [members, mfaResults]);

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

  const activeSourceKeys = useMemo(
    () => new Set(filters.filter((f) => f.dimension === SOURCE_DIMENSION).map((f) => f.value)),
    [filters],
  );

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
  const resetKey = `${debouncedQuery}__${filters
    .map((f) => `${f.dimension}:${f.value}`)
    .join('|')}__${members.length}__${sortBy}__${sortDesc}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setVisibleCount(PAGE);
  }

  // --- Filter mutation helpers ------------------------------------------------
  const toggleFilter = useCallback((dimension: Dimension, value: string, label: string) => {
    setFilters((prev) => {
      const existing = prev.find((f) => f.dimension === dimension && f.value === value);
      if (existing) return prev.filter((f) => f !== existing);
      return [...prev, { dimension, value, label }];
    });
  }, []);

  const handleCompositionToggle = useCallback(
    (dimension: Dimension, row: BreakdownRow) => {
      toggleFilter(dimension, row.value, `${dimensionTitle(dimension)}: ${row.label}`);
    },
    [toggleFilter],
  );

  const handleStatusToggle = useCallback(
    (row: BreakdownRow) => toggleFilter('status', row.value, `Status: ${row.label}`),
    [toggleFilter],
  );

  const handleClearStatus = useCallback(
    () => setFilters((prev) => prev.filter((f) => f.dimension !== 'status')),
    [],
  );

  const handleMfaValueToggle = useCallback(
    (value: string, label: string) => toggleFilter('mfa', value, label),
    [toggleFilter],
  );

  const handleSetFactorMode = useCallback((label: string, mode: FactorMode) => {
    setFilters((prev) => {
      const without = prev.filter(
        (f) =>
          !(
            f.dimension === 'mfa' &&
            (f.value === `has:${label}` || f.value === `missing:${label}`)
          ),
      );
      if (mode === 'off') return without;
      const value = mode === 'has' ? `has:${label}` : `missing:${label}`;
      const chip = `${mode === 'has' ? 'Has' : 'Missing'} ${label}`;
      return [...without, { dimension: 'mfa', value, label: chip }];
    });
  }, []);

  const handleSourceToggle = useCallback(
    (key: string, label: string) => toggleFilter(SOURCE_DIMENSION, key, `Source: ${label}`),
    [toggleFilter],
  );

  const clearSourceFilters = useCallback(
    () => setFilters((prev) => prev.filter((f) => f.dimension !== SOURCE_DIMENSION)),
    [],
  );

  const removeFilter = useCallback(
    (filter: MemberFilter) => setFilters((prev) => prev.filter((f) => f !== filter)),
    [],
  );
  const clearAll = useCallback(() => setFilters([]), []);

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
  const activeFilterCount = filters.length;

  // Full value distribution for the attribute details modal.
  const detailRows = useMemo(
    () => (detailKey ? computeDimensionBreakdown(members, detailKey) : []),
    [detailKey, members],
  );
  const detailActiveValues = useMemo(
    () => new Set(filters.filter((f) => f.dimension === detailKey).map((f) => f.value)),
    [filters, detailKey],
  );

  return (
    <div className="space-y-(--sp-rung)">
      {/* Where these members came from — proportion at a glance, and a filter per
          slice. Above the search bar because it is the question this roster
          answers first: not "who is in here" but "why". */}
      {memberSource && (
        <div className="space-y-3">
          <MemberSourceFilterBar
            segments={memberSource.segments}
            activeKeys={activeSourceKeys}
            onToggle={handleSourceToggle}
            onClearAll={clearSourceFilters}
            total={memberSource.index.byUserId.size}
          />
          {sourceDetail}
        </div>
      )}

      {/* Search + Filters toggle — two form controls side by side. */}
      <div className="flex gap-(--sp-field)">
        <div className="flex-1">
          <MemberSearchBar value={query} onChange={setQuery} />
        </div>
        <FilterToggle
          open={showFilters}
          activeCount={activeFilterCount}
          onToggle={() => setShowFilters((prev) => !prev)}
        />
      </div>

      {/* Expandable filter panel — also hosts the MFA scan trigger */}
      {showFilters && (
        <MemberFilterPanel
          filters={filters}
          statusRows={statusRows}
          mfaResults={mfaResults}
          factorLabels={factorLabels}
          memberCount={members.length}
          scanStatus={scanStatus}
          onRunScanClick={handleScanClick}
          sortBy={sortBy}
          sortDesc={sortDesc}
          onToggleStatus={handleStatusToggle}
          onClearStatus={handleClearStatus}
          onToggleMfaValue={handleMfaValueToggle}
          onSetFactorMode={handleSetFactorMode}
          onToggleSort={toggleSort}
          onRemoveFilter={removeFilter}
          onClearAll={clearAll}
        />
      )}

      {/* Composition: attribute distribution + MFA factor breakdown, sectioned together */}
      <CompositionReports
        attributes={attributes}
        filters={filters}
        onToggle={handleCompositionToggle}
        onExpand={setDetailKey}
        mfaRows={mfaRows}
        mfaResults={mfaResults}
        scanStatus={scanStatus}
        memberCount={members.length}
        onToggleMfa={(row) => handleMfaValueToggle(row.value, row.label)}
        onRunScanClick={handleScanClick}
      />

      {/* Member list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">
            Members
            {/*
              Both parts from first paint — `250 of 250` rather than `250` that
              becomes `47 of 250` the moment a filter applies. The heading sits in a
              `justify-between` row, so the old form grew in place and pushed the
              Copy button beside it (D-053f). `tabular-nums` keeps it still as the
              digits themselves change.
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
      </div>

      {/* Full attribute distribution modal */}
      <BreakdownDetailsModal
        isOpen={detailKey !== null}
        onClose={() => setDetailKey(null)}
        title={detailKey ? dimensionTitle(detailKey) : ''}
        rows={detailRows}
        activeValues={detailActiveValues}
        onRowClick={(row) => detailKey && handleCompositionToggle(detailKey, row)}
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
