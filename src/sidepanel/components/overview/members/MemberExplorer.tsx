import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../../shared/types';
import MemberSearchBar from './MemberSearchBar';
import MemberFilterPanel from './MemberFilterPanel';
import CompositionReports from './CompositionReports';
import BreakdownDetailsModal from './BreakdownDetailsModal';
import MfaScanPanel from './MfaScanPanel';
import MemberList from './MemberList';
import {
  type BreakdownRow,
  type Dimension,
  type MemberFilter,
  type ProfileDimension,
  type SortField,
  computeAllBreakdowns,
  computeDimensionBreakdown,
  filterMembers,
  sortMembers,
  getObservedFactorLabels,
  DIMENSION_TITLES,
} from './memberAnalytics';

type FactorMode = 'off' | 'has' | 'missing';

interface MemberExplorerProps {
  members: OktaUser[];
  mfaResults: Map<string, MemberMfaResult> | null;
  scanStatus: MfaScanStatus;
  onRunScan: () => void;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
  oktaOrigin?: string | null;
}

const PAGE = 50;

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
  const [otherDim, setOtherDim] = useState<ProfileDimension | null>(null);

  // Debounce the search query so filtering runs at most a few times per second.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  // Breakdowns are computed over the full member set (stable while faceting).
  const breakdowns = useMemo(() => computeAllBreakdowns(members), [members]);
  const factorLabels = useMemo(() => getObservedFactorLabels(mfaResults), [mfaResults]);

  const filtered = useMemo(
    () => filterMembers(members, debouncedQuery, filters, mfaResults),
    [members, debouncedQuery, filters, mfaResults]
  );
  const sorted = useMemo(
    () => sortMembers(filtered, sortBy, sortDesc, mfaResults),
    [filtered, sortBy, sortDesc, mfaResults]
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
      const title = DIMENSION_TITLES[dimension as ProfileDimension];
      toggleFilter(dimension, row.value, `${title}: ${row.label}`);
    },
    [toggleFilter]
  );

  const handleStatusToggle = useCallback(
    (row: BreakdownRow) => toggleFilter('status', row.value, `Status: ${row.label}`),
    [toggleFilter]
  );

  const handleClearStatus = useCallback(
    () => setFilters((prev) => prev.filter((f) => f.dimension !== 'status')),
    []
  );

  const handleMfaValueToggle = useCallback(
    (value: string, label: string) => toggleFilter('mfa', value, label),
    [toggleFilter]
  );

  const handleSetFactorMode = useCallback((label: string, mode: FactorMode) => {
    setFilters((prev) => {
      const without = prev.filter(
        (f) => !(f.dimension === 'mfa' && (f.value === `has:${label}` || f.value === `missing:${label}`))
      );
      if (mode === 'off') return without;
      const value = mode === 'has' ? `has:${label}` : `missing:${label}`;
      const chip = `${mode === 'has' ? 'Has' : 'Missing'} ${label}`;
      return [...without, { dimension: 'mfa', value, label: chip }];
    });
  }, []);

  const removeFilter = useCallback(
    (filter: MemberFilter) => setFilters((prev) => prev.filter((f) => f !== filter)),
    []
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

  // Full distribution for the "Other" details modal.
  const otherRows = useMemo(
    () => (otherDim ? computeDimensionBreakdown(members, otherDim) : []),
    [otherDim, members]
  );
  const otherActiveValues = useMemo(
    () => new Set(filters.filter((f) => f.dimension === otherDim).map((f) => f.value)),
    [filters, otherDim]
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
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
          statusRows={breakdowns.status}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Composition reports */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-900">Composition</h3>
          <CompositionReports
            breakdowns={breakdowns}
            filters={filters}
            onToggle={handleCompositionToggle}
            onShowOther={setOtherDim}
          />
        </div>

        {/* Member list */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-900">
            Members
            <span className="ml-2 text-xs font-normal text-neutral-500">
              {sorted.length.toLocaleString()}
              {sorted.length !== members.length && ` of ${members.length.toLocaleString()}`}
            </span>
          </h3>
          <MemberList
            members={sorted}
            mfaResults={mfaResults}
            mfaScanned={mfaScanned}
            visibleCount={visibleCount}
            onLoadMore={loadMore}
            oktaOrigin={oktaOrigin}
          />
        </div>
      </div>

      {/* "Other" details modal */}
      <BreakdownDetailsModal
        isOpen={otherDim !== null}
        onClose={() => setOtherDim(null)}
        title={otherDim ? DIMENSION_TITLES[otherDim] : ''}
        rows={otherRows}
        activeValues={otherActiveValues}
        onRowClick={(row) => otherDim && handleCompositionToggle(otherDim, row)}
      />
    </div>
  );
};

export default MemberExplorer;
