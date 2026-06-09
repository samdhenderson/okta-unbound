import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../../shared/types';
import MemberSearchBar from './MemberSearchBar';
import ActiveFilterChips from './ActiveFilterChips';
import CompositionReports from './CompositionReports';
import MfaScanPanel from './MfaScanPanel';
import MemberList from './MemberList';
import {
  type BreakdownRow,
  type Dimension,
  type MemberFilter,
  computeAllBreakdowns,
  filterMembers,
  DIMENSION_TITLES,
} from './memberAnalytics';

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

  // Debounce the search query so filtering runs at most a few times per second.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  // Breakdowns are computed over the full member set (stable while faceting).
  const breakdowns = useMemo(() => computeAllBreakdowns(members), [members]);

  const filtered = useMemo(
    () => filterMembers(members, debouncedQuery, filters, mfaResults),
    [members, debouncedQuery, filters, mfaResults]
  );

  // Reset the visible window whenever the result set inputs change. Done during
  // render (not in an effect) per the React pattern for deriving state from props.
  const resetKey = `${debouncedQuery}__${filters
    .map((f) => `${f.dimension}:${f.value}`)
    .join('|')}__${members.length}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setVisibleCount(PAGE);
  }

  const toggleFilter = useCallback((dimension: Dimension, row: BreakdownRow, chipLabel: string) => {
    setFilters((prev) => {
      const existing = prev.find((f) => f.dimension === dimension && f.value === row.value);
      if (existing) return prev.filter((f) => f !== existing);
      return [...prev, { dimension, value: row.value, label: chipLabel }];
    });
  }, []);

  const handleCompositionToggle = useCallback(
    (dimension: Dimension, row: BreakdownRow) => {
      const prefix = dimension === 'mfa' ? '' : `${DIMENSION_TITLES[dimension as Exclude<Dimension, 'mfa'>]}: `;
      toggleFilter(dimension, row, `${prefix}${row.label}`);
    },
    [toggleFilter]
  );

  const handleMfaToggle = useCallback(
    (row: BreakdownRow) => {
      toggleFilter('mfa', row, row.label);
    },
    [toggleFilter]
  );

  const removeFilter = useCallback((filter: MemberFilter) => {
    setFilters((prev) => prev.filter((f) => f !== filter));
  }, []);

  const clearAll = useCallback(() => setFilters([]), []);

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE, filtered.length));
  }, [filtered.length]);

  const mfaScanned = mfaResults !== null && scanStatus === 'complete';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <MemberSearchBar value={query} onChange={setQuery} />
        <ActiveFilterChips filters={filters} onRemove={removeFilter} onClearAll={clearAll} />
      </div>

      <MfaScanPanel
        members={members}
        mfaResults={mfaResults}
        scanStatus={scanStatus}
        filters={filters}
        onRunScan={onRunScan}
        onRequestConfirm={onRequestConfirm}
        onCancelConfirm={onCancelConfirm}
        onToggleMfaFilter={handleMfaToggle}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Composition reports */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-900">Composition</h3>
          <CompositionReports
            breakdowns={breakdowns}
            filters={filters}
            onToggle={handleCompositionToggle}
          />
        </div>

        {/* Member list */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-900">
            Members
            <span className="ml-2 text-xs font-normal text-neutral-500">
              {filtered.length.toLocaleString()}
              {filtered.length !== members.length && ` of ${members.length.toLocaleString()}`}
            </span>
          </h3>
          <MemberList
            members={filtered}
            mfaResults={mfaResults}
            mfaScanned={mfaScanned}
            visibleCount={visibleCount}
            onLoadMore={loadMore}
            oktaOrigin={oktaOrigin}
          />
        </div>
      </div>
    </div>
  );
};

export default MemberExplorer;
