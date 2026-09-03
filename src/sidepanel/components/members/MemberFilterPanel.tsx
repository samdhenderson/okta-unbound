/**
 * @module sidepanel/components/members/MemberFilterPanel
 * @description Expandable panel of status, MFA-factor, and sort controls for the member list.
 *
 * Presentational: it reflects the active {@link MemberFilter} set into pressed
 * pill states and reports every change (status toggles, per-factor has/missing
 * modes, quick MFA counts, sort field/direction) via callbacks. Hosts the MFA
 * scan trigger inline — scanning lives here, next to the factor filters it
 * enables — and the factor controls stay hidden until scan results are supplied.
 *
 * ## The active-filter chips are not here
 *
 * They used to head this panel, which put the answer to "what is filtering this
 * list?" *inside* the thing you have to open to find out. The chips now sit in
 * the explorer's always-visible control line ({@link ActiveFilterChips}), and
 * this panel keeps only the controls. A filter you cannot see is worse than a
 * control you cannot reach.
 */
import React from 'react';
import type { MemberMfaResult, MfaScanStatus } from '../../../shared/types';
import FilterPill from '../shared/FilterPill';
import SortPill from '../shared/SortPill';
import MfaScanButton from './MfaScanButton';
import type { FactorMode } from '../../hooks/useMemberFilters';
import { type BreakdownRow, type MemberFilter, type SortField } from './memberAnalytics';

/** Props for {@link MemberFilterPanel}. */
interface MemberFilterPanelProps {
  /** Active facet filters, reflected into pressed pill states. */
  filters: MemberFilter[];
  /** Status distribution (value + count) used to build status pills. */
  statusRows: BreakdownRow[];
  /** Per-member MFA scan results, or null before a scan has run. */
  mfaResults: Map<string, MemberMfaResult> | null;
  /** Observed factor labels across the group, for per-factor toggles. */
  factorLabels: string[];
  /** Member count; drives the scan button's disabled/confirm behaviour. */
  memberCount: number;
  /** Current MFA scan lifecycle status. */
  scanStatus: MfaScanStatus;
  /** Start (or confirm) the MFA scan. */
  onRunScanClick: () => void;
  /** Current sort field. */
  sortBy: SortField;
  /** Whether the current sort is descending. */
  sortDesc: boolean;
  /** Toggle a status value as a filter. */
  onToggleStatus: (row: BreakdownRow) => void;
  /** Clear all status filters. */
  onClearStatus: () => void;
  /** Toggle a count-based MFA value (e.g. 'none', 'multiple'). */
  onToggleMfaValue: (value: string, label: string) => void;
  /** Set a per-factor has/missing/off mode. */
  onSetFactorMode: (label: string, mode: FactorMode) => void;
  /** Toggle the sort field (or flip direction if already selected). */
  onToggleSort: (field: SortField) => void;
}

/** Renders the status / MFA-factor / sort controls for the member explorer. */
const MemberFilterPanel: React.FC<MemberFilterPanelProps> = ({
  filters,
  statusRows,
  mfaResults,
  factorLabels,
  memberCount,
  scanStatus,
  onRunScanClick,
  sortBy,
  sortDesc,
  onToggleStatus,
  onClearStatus,
  onToggleMfaValue,
  onSetFactorMode,
  onToggleSort,
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
    /* No card chrome and no entrance of its own: this is a section *inside* the
       explorer's filter drawer, which owns the box and the disclosure motion.
       Nesting a second bordered, separately-animating card inside it was the
       old always-visible panel's shape, not this one's. */
    <div className="space-y-(--sp-rung)">
      {/* Status filter */}
      {realStatusRows.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Status</label>
          <div className="flex flex-wrap gap-(--sp-inline)">
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

      {/* MFA factor filters — the scan is triggered here, next to the filters it enables */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="block text-xs font-medium text-neutral-600">MFA Factors</label>
          <MfaScanButton
            mfaResults={mfaResults}
            scanStatus={scanStatus}
            memberCount={memberCount}
            onScanClick={onRunScanClick}
          />
        </div>
        {scanStatus === 'error' && (
          <p className="text-xs text-danger-text mb-1.5">The MFA scan failed. Please try again.</p>
        )}
        {!mfaResults ? (
          <p className="text-xs text-neutral-500">
            Scan the group to filter by enrolled factors (1 API call per member).
          </p>
        ) : (
          <div className="space-y-(--sp-field)">
            {/* Quick count-based toggles */}
            <div className="flex flex-wrap gap-(--sp-inline)">
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
                      <div className="flex flex-shrink-0 gap-(--sp-inline)">
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
        <div className="flex flex-wrap gap-(--sp-inline)">
          <SortPill
            field="name"
            label="Name"
            activeField={sortBy}
            descending={sortDesc}
            onToggle={onToggleSort}
          />
          <SortPill
            field="status"
            label="Status"
            activeField={sortBy}
            descending={sortDesc}
            onToggle={onToggleSort}
          />
          {mfaResults && (
            <SortPill
              field="factors"
              label="Factor count"
              activeField={sortBy}
              descending={sortDesc}
              onToggle={onToggleSort}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberFilterPanel;
