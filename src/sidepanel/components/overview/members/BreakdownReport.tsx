import React from 'react';
import type { BreakdownRow } from './memberAnalytics';
import { OTHER_VALUE } from './memberAnalytics';

interface BreakdownReportProps {
  /** Pre-computed, sorted rows (top-N + optional "Other"). */
  rows: BreakdownRow[];
  /** Canonical values currently selected as filters (for highlight). */
  activeValues: Set<string>;
  /** Called when a clickable row is toggled. The "Other" row is not clickable. */
  onRowClick: (row: BreakdownRow) => void;
  /** Optional empty-state message when there are no rows. */
  emptyMessage?: string;
}

/**
 * A labeled list of horizontal proportion bars. Each row is clickable to toggle a
 * facet filter (except the aggregated "Other" row). Dependency-free — bars are
 * just divs sized by percentage using existing color tokens.
 */
const BreakdownReport: React.FC<BreakdownReportProps> = ({
  rows,
  activeValues,
  onRowClick,
  emptyMessage = 'No data',
}) => {
  if (rows.length === 0) {
    return <p className="text-xs text-neutral-500 py-1">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row) => {
        const isOther = row.value === OTHER_VALUE;
        const isActive = activeValues.has(row.value);
        const clickable = !isOther;

        return (
          <button
            key={row.value}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onRowClick(row)}
            className={`
              relative w-full text-left rounded-md px-2.5 py-1.5
              transition-colors duration-100
              ${clickable ? 'cursor-pointer hover:bg-neutral-50' : 'cursor-default'}
              ${isActive ? 'ring-1 ring-primary bg-primary-light/40' : ''}
            `.trim().replace(/\s+/g, ' ')}
            aria-pressed={clickable ? isActive : undefined}
          >
            {/* Proportion bar background */}
            <div className="absolute inset-y-0 left-0 rounded-md bg-neutral-100" style={{ width: '100%' }} />
            <div
              className={`absolute inset-y-0 left-0 rounded-md ${isActive ? 'bg-primary-highlight' : 'bg-primary-light'}`}
              style={{ width: `${Math.max(row.pct, 1.5)}%` }}
            />
            {/* Foreground content */}
            <div className="relative flex items-center justify-between gap-3">
              <span
                className={`truncate text-xs ${isActive ? 'font-semibold text-primary-text' : 'text-neutral-800'} ${isOther ? 'italic text-neutral-500' : ''}`}
                title={row.label}
              >
                {row.label}
              </span>
              <span className="flex-shrink-0 text-xs font-medium text-neutral-600 tabular-nums">
                {row.count.toLocaleString()}
                <span className="ml-1 text-neutral-400">{row.pct.toFixed(0)}%</span>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default BreakdownReport;
