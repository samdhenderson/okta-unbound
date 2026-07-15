/**
 * @module sidepanel/components/overview/members/AttributeFacet
 * @description Compact card visualizing one profile attribute's value distribution as clickable filters.
 *
 * Shows a segmented "spread bar" plus a short legend of the leading values; every
 * segment/legend entry toggles a member-list filter, and "View all" opens the
 * full distribution. Named values use an indigo ramp; "(none)"/"Other" use neutrals.
 */
import React from 'react';
import type { AttributeSummary, BreakdownRow } from './memberAnalytics';
import { NONE_VALUE, OTHER_VALUE } from './memberAnalytics';
import { INDIGO_RAMP, CHART_NONE_COLOR, CHART_OTHER_COLOR } from '../../../theme/chartPalette';

/** Props for {@link AttributeFacet}. */
interface AttributeFacetProps {
  /** The attribute and its precomputed value distribution. */
  summary: AttributeSummary;
  /** Canonical values currently active as filters for this attribute. */
  activeValues: Set<string>;
  /** Toggle a value as a member-list filter. */
  onToggleValue: (row: BreakdownRow) => void;
  /** Open the full value distribution for this attribute. */
  onExpand: () => void;
}

/** Assign a segment color to a row given its position among the named values. */
function rowColor(row: BreakdownRow, namedIndex: number): string {
  if (row.value === NONE_VALUE) return CHART_NONE_COLOR;
  if (row.value === OTHER_VALUE) return CHART_OTHER_COLOR;
  return INDIGO_RAMP[Math.min(namedIndex, INDIGO_RAMP.length - 1)];
}

/**
 * A compact card summarizing one profile attribute's value distribution: a single
 * segmented "spread bar" plus a short legend of the leading values. Every part is a
 * quick filter; "View all" opens the complete distribution.
 */
const AttributeFacet: React.FC<AttributeFacetProps> = ({
  summary,
  activeValues,
  onToggleValue,
  onExpand,
}) => {
  const { label, distinct, fillRate, rows } = summary;
  const hasActive = activeValues.size > 0;

  // Precompute a stable color per row. Named values consume the indigo ramp in
  // order; "(none)" / "Other" always take a neutral tone.
  const isNamedRow = (row: BreakdownRow) => row.value !== NONE_VALUE && row.value !== OTHER_VALUE;
  const colored = rows.map((row, i) => {
    const isNamed = isNamedRow(row);
    const namedIndex = rows.slice(0, i).filter(isNamedRow).length;
    return { row, color: rowColor(row, isNamed ? namedIndex : 0), isNamed };
  });

  // Legend: the three leading rows, plus a "+N more" affordance for the rest.
  const legend = colored.slice(0, 3);
  const shownDistinct = legend.filter((c) => c.isNamed).length;
  const moreCount = distinct - shownDistinct;

  return (
    <div
      className={`group rounded-lg border bg-white p-3 transition-colors duration-100 ${
        hasActive
          ? 'border-primary-highlight ring-1 ring-primary-highlight'
          : 'border-neutral-200 hover:border-neutral-300'
      }`}
    >
      {/* Header: attribute name + count, which doubles as the "view all" control */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {hasActive && (
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" aria-hidden />
          )}
          <span className="truncate text-xs font-semibold text-neutral-900" title={label}>
            {label}
          </span>
        </div>
        <button
          type="button"
          onClick={onExpand}
          className="flex-shrink-0 text-[11px] font-medium text-neutral-500 hover:text-primary-text transition-colors tabular-nums"
          title={`Browse all ${distinct.toLocaleString()} values`}
        >
          {distinct.toLocaleString()} {distinct === 1 ? 'value' : 'values'}
          {fillRate < 99.5 && (
            <span className="text-neutral-400"> · {Math.round(fillRate)}% set</span>
          )}
        </button>
      </div>

      {/* Segmented spread bar — the whole distribution at a glance */}
      <div className="mt-2 flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-neutral-100">
        {colored.map(({ row, color }) => {
          const isActive = activeValues.has(row.value);
          const dimmed = hasActive && !isActive;
          const clickable = row.value !== OTHER_VALUE;
          return (
            <button
              key={row.value}
              type="button"
              disabled={!clickable}
              onClick={() => (clickable ? onToggleValue(row) : onExpand())}
              title={`${row.label} — ${row.count.toLocaleString()} (${row.pct.toFixed(0)}%)`}
              aria-label={`${label}: ${row.label}, ${row.count.toLocaleString()} members`}
              className={`h-full min-w-[3px] transition-opacity duration-100 focus:outline-none focus:relative focus:z-10 focus:ring-2 focus:ring-primary ${
                clickable ? 'cursor-pointer' : 'cursor-default'
              } ${dimmed ? 'opacity-35 hover:opacity-70' : 'hover:opacity-80'}`}
              style={{ flexGrow: row.count, flexBasis: 0, background: color }}
            />
          );
        })}
      </div>

      {/* Legend: leading values as quick filters */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {legend.map(({ row, color }) => {
          const isActive = activeValues.has(row.value);
          const clickable = row.value !== OTHER_VALUE;
          return (
            <button
              key={row.value}
              type="button"
              disabled={!clickable}
              onClick={() => onToggleValue(row)}
              className={`inline-flex items-center gap-1.5 text-[11px] transition-colors ${
                clickable ? 'cursor-pointer' : 'cursor-default'
              }`}
              aria-pressed={clickable ? isActive : undefined}
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-[3px]"
                style={{ background: color }}
                aria-hidden
              />
              <span
                className={`max-w-[9rem] truncate ${
                  isActive ? 'font-semibold text-primary-text' : 'text-neutral-700'
                } ${row.value === NONE_VALUE || row.value === OTHER_VALUE ? 'italic text-neutral-500' : ''}`}
                title={row.label}
              >
                {row.label}
              </span>
              <span className="flex-shrink-0 tabular-nums text-neutral-400">
                {row.pct.toFixed(0)}%
              </span>
            </button>
          );
        })}
        {moreCount > 0 && (
          <button
            type="button"
            onClick={onExpand}
            className="text-[11px] font-medium text-primary-text hover:underline"
          >
            +{moreCount.toLocaleString()} more
          </button>
        )}
      </div>
    </div>
  );
};

export default AttributeFacet;
