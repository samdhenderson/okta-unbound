import React from 'react';
import type { MemberMfaResult } from '../../../../shared/types';
import FilterPill from './FilterPill';
import ActiveFilterChips from './ActiveFilterChips';
import { type BreakdownRow, type MemberFilter, type SortField } from './memberAnalytics';

type FactorMode = 'off' | 'has' | 'missing';

interface MemberFilterPanelProps {
  filters: MemberFilter[];
  statusRows: BreakdownRow[]; // status distribution (value + count)
  mfaResults: Map<string, MemberMfaResult> | null;
  factorLabels: string[]; // observed factor labels
  sortBy: SortField;
  sortDesc: boolean;
  onToggleStatus: (row: BreakdownRow) => void;
  onClearStatus: () => void;
  onToggleMfaValue: (value: string, label: string) => void;
  onSetFactorMode: (label: string, mode: FactorMode) => void;
  onToggleSort: (field: SortField) => void;
  onRemoveFilter: (filter: MemberFilter) => void;
  onClearAll: () => void;
}

const SortButton: React.FC<{
  field: SortField;
  label: string;
  sortBy: SortField;
  sortDesc: boolean;
  onToggle: (f: SortField) => void;
}> = ({ field, label, sortBy, sortDesc, onToggle }) => {
  const active = sortBy === field;
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
        active
          ? 'bg-primary text-white'
          : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
      }`}
    >
      {label}
      {active && (
        <svg
          className={`w-3 h-3 transition-transform ${sortDesc ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      )}
    </button>
  );
};

const MemberFilterPanel: React.FC<MemberFilterPanelProps> = ({
  filters,
  statusRows,
  mfaResults,
  factorLabels,
  sortBy,
  sortDesc,
  onToggleStatus,
  onClearStatus,
  onToggleMfaValue,
  onSetFactorMode,
  onToggleSort,
  onRemoveFilter,
  onClearAll,
}) => {
  const statusActive = new Set(filters.filter((f) => f.dimension === 'status').map((f) => f.value));
  const mfaActive = new Set(filters.filter((f) => f.dimension === 'mfa').map((f) => f.value));

  const factorMode = (label: string): FactorMode => {
    if (mfaActive.has(`has:${label}`)) return 'has';
    if (mfaActive.has(`missing:${label}`)) return 'missing';
    return 'off';
  };

  const realStatusRows = statusRows.filter((r) => r.count > 0);

  return (
    <div className="p-4 bg-white rounded-md border border-neutral-200 space-y-4 animate-in slide-in-from-top-2 duration-100">
      {/* Active filter chips */}
      <ActiveFilterChips filters={filters} onRemove={onRemoveFilter} onClearAll={onClearAll} />

      {/* Status filter */}
      {realStatusRows.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Status</label>
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={statusActive.size === 0} onClick={onClearStatus}>
              All
            </FilterPill>
            {realStatusRows.map((row) => (
              <FilterPill
                key={row.value}
                active={statusActive.has(row.value)}
                onClick={() => onToggleStatus(row)}
              >
                {row.label} ({row.count.toLocaleString()})
              </FilterPill>
            ))}
          </div>
        </div>
      )}

      {/* MFA factor filters */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">MFA Factors</label>
        {!mfaResults ? (
          <p className="text-xs text-neutral-500">
            Run the MFA scan above to filter by enrolled factors.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Quick count-based toggles */}
            <div className="flex flex-wrap gap-1.5">
              <FilterPill
                active={mfaActive.has('none')}
                onClick={() => onToggleMfaValue('none', 'No factors enrolled')}
              >
                No factors
              </FilterPill>
              <FilterPill
                active={mfaActive.has('multiple')}
                onClick={() => onToggleMfaValue('multiple', 'Multiple factors (2+)')}
              >
                Multiple (2+)
              </FilterPill>
            </div>

            {/* Per-factor has / missing toggles */}
            {factorLabels.length === 0 ? (
              <p className="text-xs text-neutral-500">No factors enrolled across this group.</p>
            ) : (
              <div className="space-y-1.5">
                {factorLabels.map((label) => {
                  const mode = factorMode(label);
                  return (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-neutral-700 truncate" title={label}>
                        {label}
                      </span>
                      <div className="flex flex-shrink-0 gap-1.5">
                        <FilterPill
                          active={mode === 'has'}
                          onClick={() => onSetFactorMode(label, mode === 'has' ? 'off' : 'has')}
                          title={`Show only members with ${label}`}
                          inactiveClassName="bg-neutral-50 text-success-text border border-neutral-200 hover:border-success-text"
                        >
                          Has
                        </FilterPill>
                        <FilterPill
                          active={mode === 'missing'}
                          onClick={() =>
                            onSetFactorMode(label, mode === 'missing' ? 'off' : 'missing')
                          }
                          title={`Show only members missing ${label}`}
                          inactiveClassName="bg-neutral-50 text-danger-text border border-neutral-200 hover:border-danger-text"
                        >
                          Missing
                        </FilterPill>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sort controls */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Sort by</label>
        <div className="flex flex-wrap gap-1.5">
          <SortButton
            field="name"
            label="Name"
            sortBy={sortBy}
            sortDesc={sortDesc}
            onToggle={onToggleSort}
          />
          <SortButton
            field="status"
            label="Status"
            sortBy={sortBy}
            sortDesc={sortDesc}
            onToggle={onToggleSort}
          />
          {mfaResults && (
            <SortButton
              field="factors"
              label="Factor count"
              sortBy={sortBy}
              sortDesc={sortDesc}
              onToggle={onToggleSort}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberFilterPanel;
