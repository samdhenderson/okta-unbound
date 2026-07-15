/**
 * @module sidepanel/components/overview/members/MemberExplorer
 * @description Orchestrator for in-group member search, faceting, composition, MFA, and listing.
 *
 * Owns the explorer's client-side state — debounced search, the active
 * {@link MemberFilter} set, sort field/direction, and the paged visible window —
 * and derives the filtered/sorted list via the pure helpers in
 * `memberAnalytics`. Composes the search bar, filter panel, MFA scan panel,
 * composition reports, member list, and the details/copy modals. MFA scan results
 * are owned by the parent overview and passed in.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../../shared/types';
import Button from '../../shared/Button';
import MemberSearchBar from './MemberSearchBar';
import MemberFilterPanel from './MemberFilterPanel';
import CopyMembersModal from './CopyMembersModal';
import CompositionReports from './CompositionReports';
import BreakdownDetailsModal from './BreakdownDetailsModal';
import MfaScanPanel from './MfaScanPanel';
import MemberList from './MemberList';
import {
  type BreakdownRow,
  type Dimension,
  type MemberFilter,
  type SortField,
  computeDimensionBreakdown,
  discoverAttributeBreakdowns,
  filterMembers,
  sortMembers,
  getObservedFactorLabels,
  dimensionTitle,
} from './memberAnalytics';

/** Per-factor filter intent: unset, require-present, or require-absent. */
type FactorMode = 'off' | 'has' | 'missing';

/** Props for {@link MemberExplorer}. */
interface MemberExplorerProps {
  /** The group's full member set (the explorer filters/sorts locally). */
  members: OktaUser[];
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
}

/** Number of member rows revealed per page / "Load more". */
const PAGE = 50;

/**
 * Renders the member explorer and owns its search/filter/sort/pagination state.
 * All list derivation is delegated to the pure `memberAnalytics` helpers.
 */
const MemberExplorer: React.FC<MemberExplorerProps> = ({
  members,
  mfaResults,
  scanStatus,
  onRunScan,
  onRequestConfirm,
  onCancelConfirm,
  oktaOrigin,
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState<MemberFilter[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDesc, setSortDesc] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  // Debounce the search query so filtering runs at most a few times per second.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  // Distributions are computed over the full member set (stable while faceting).
  const attributes = useMemo(() => discoverAttributeBreakdowns(members), [members]);
  const statusRows = useMemo(() => computeDimensionBreakdown(members, 'status'), [members]);
  const factorLabels = useMemo(() => getObservedFactorLabels(mfaResults), [mfaResults]);

  const filtered = useMemo(
    () => filterMembers(members, debouncedQuery, filters, mfaResults),
    [members, debouncedQuery, filters, mfaResults],
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
    <div className="space-y-4">
      {/* Search + Filters toggle */}
      <div className="flex gap-2">
        <div className="flex-1">
          <MemberSearchBar value={query} onChange={setQuery} />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className={`px-4 py-2 rounded-md border text-sm font-medium transition-all duration-100 flex items-center gap-2 ${
            showFilters || activeFilterCount > 0
              ? 'bg-primary-light border-primary text-primary-text'
              : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400'
          }`}
          title="Toggle filters"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-primary text-white min-w-[20px] text-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <MemberFilterPanel
          filters={filters}
          statusRows={statusRows}
          mfaResults={mfaResults}
          factorLabels={factorLabels}
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

      {/* MFA scan trigger + distribution report */}
      <MfaScanPanel
        members={members}
        mfaResults={mfaResults}
        scanStatus={scanStatus}
        filters={filters}
        onRunScan={onRunScan}
        onRequestConfirm={onRequestConfirm}
        onCancelConfirm={onCancelConfirm}
        onToggleMfaFilter={(row) => handleMfaValueToggle(row.value, row.label)}
      />

      {/* Composition: distribution of every browseable profile attribute */}
      <CompositionReports
        attributes={attributes}
        filters={filters}
        onToggle={handleCompositionToggle}
        onExpand={setDetailKey}
      />

      {/* Member list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">
            Members
            <span className="ml-2 text-xs font-normal text-neutral-500">
              {sorted.length.toLocaleString()}
              {sorted.length !== members.length && ` of ${members.length.toLocaleString()}`}
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
          mfaResults={mfaResults}
          mfaScanned={mfaScanned}
          visibleCount={visibleCount}
          onLoadMore={loadMore}
          oktaOrigin={oktaOrigin}
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
    </div>
  );
};

export default MemberExplorer;
