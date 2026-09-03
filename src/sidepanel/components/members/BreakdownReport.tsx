/**
 * @module sidepanel/components/members/BreakdownReport
 * @description Dependency-free list of horizontal proportion bars for a value distribution.
 *
 * Each row is a clickable filter toggle (except the aggregated "Other" row, which
 * can instead reveal its hidden values). Bars are plain divs sized by percentage
 * using existing color tokens. Both handlers are optional and a row is
 * interactive only when its handler is wired, so a read-only surface renders the
 * same report without any dead affordances.
 *
 * ## A row that navigates says so before it navigates
 *
 * The same row means two different things depending on where it is rendered. On
 * the Members tab it toggles a facet on the list directly underneath it — the
 * consequence is visible, reversible, and announced by `aria-pressed`. On the
 * Insights tab it *leaves*: it switches to Members and applies the filter there,
 * and a reader who clicked expecting the first behaviour has just been moved to
 * another tab with no warning.
 *
 * {@link BreakdownReportProps.rowIntent} is what distinguishes them. In
 * `navigate` mode every row states its destination and the filter it will apply
 * **on the row itself** — visibly, and in the accessible name — rather than after
 * the fact. It is deliberately not a confirm step: applying a filter is
 * read-only and symmetrically undoable, and a dialog in front of every value
 * would make the reveal unusable. `aria-pressed` is dropped there too, because
 * the row is no longer a toggle and announcing a pressed state for a navigation
 * would be a lie.
 */
import React from 'react';
import type { BreakdownRow } from './memberAnalytics';
import { OTHER_VALUE } from './memberAnalytics';

/**
 * What activating a value row does.
 *
 * `toggle` — the row switches a facet on the member list rendered with it.
 * `navigate` — the row leaves this surface for the Members tab and applies the
 * filter there. See the module header for why the two cannot share an
 * affordance.
 */
export type BreakdownRowIntent = 'toggle' | 'navigate';

/** Props for {@link BreakdownReport}. */
interface BreakdownReportProps {
  /** Pre-computed, sorted rows (top-N + optional "Other"). */
  rows: BreakdownRow[];
  /** Canonical values currently selected as filters (for highlight). */
  activeValues: Set<string>;
  /**
   * Called when a clickable value row is toggled. **Omit to render the value
   * rows inert** — the same "clickable only when wired" contract
   * {@link BreakdownReportProps.onShowOther} uses, for surfaces that have no
   * member list to filter (the Insights tab's attribute cards).
   */
  onRowClick?: (row: BreakdownRow) => void;
  /** Called when the aggregated "Other" row is clicked, to reveal its values. */
  onShowOther?: () => void;
  /**
   * What a value row's activation does. Defaults to `toggle` — the behaviour
   * every existing caller has. Pass `navigate` when the click leaves this
   * surface, and each row will state where it goes before it goes there.
   */
  rowIntent?: BreakdownRowIntent;
  /** Optional empty-state message when there are no rows. */
  emptyMessage?: string;
}

/**
 * A labeled list of horizontal proportion bars. Each row is clickable to toggle a
 * facet filter when `onRowClick` is supplied (the aggregated "Other" row uses
 * `onShowOther` instead); rows whose handler is absent render inert.
 * Dependency-free — bars are just divs sized by percentage using existing color
 * tokens.
 */
const BreakdownReport: React.FC<BreakdownReportProps> = ({
  rows,
  activeValues,
  onRowClick,
  onShowOther,
  rowIntent = 'toggle',
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
        // Every row is clickable only when its handler is supplied: the "Other"
        // row needs a details handler, a value row needs a filter toggle.
        const clickable = isOther ? !!onShowOther : !!onRowClick;
        // A navigating row is not a toggle, so it neither carries nor claims a
        // pressed state — and it names its destination in its own accessible
        // name, before activation rather than after it.
        const navigates = clickable && !isOther && rowIntent === 'navigate';

        return (
          // A row-shaped raw <button> (§3 data-viz exception): a proportion bar
          // sized by percentage, not a plain list row — `ListRow` owns chrome
          // only and has no slot for the absolutely-positioned fill underneath
          // the label. `.press-subtle` for the same "wide target" reason
          // ADR-0046 gives `ListRow` itself.
          <button
            key={row.value}
            type="button"
            disabled={!clickable}
            onClick={() => {
              if (isOther) onShowOther?.();
              else onRowClick?.(row);
            }}
            className={`
              press-subtle relative w-full text-left rounded-md px-2.5 py-1.5
              transition-colors duration-(--dur-instant)
              ${clickable ? 'cursor-pointer hover:bg-neutral-50' : 'cursor-default'}
              ${isActive ? 'ring-1 ring-primary bg-primary-light/40' : ''}
            `
              .trim()
              .replace(/\s+/g, ' ')}
            aria-pressed={!isOther && clickable && !navigates ? isActive : undefined}
            aria-label={
              navigates
                ? `Filter Members by ${row.label} — ${row.count.toLocaleString()} members. Opens the Members tab.`
                : undefined
            }
          >
            {/* Proportion bar background */}
            <div
              className="absolute inset-y-0 left-0 rounded-md bg-neutral-100"
              style={{ width: '100%' }}
            />
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
                {isOther && clickable && (
                  <span className="ml-1.5 not-italic text-primary-text">View →</span>
                )}
              </span>
              {/* The destination, stated on the row rather than discovered by
                taking it. Visible, not hover-only, and not colour alone: the
                words "Filter Members" are the affordance. */}
              {navigates && (
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 text-xs font-medium text-primary-text"
                >
                  Filter Members →
                </span>
              )}
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
