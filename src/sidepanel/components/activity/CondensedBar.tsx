/**
 * @module sidepanel/components/activity/CondensedBar
 * @description The activity bar's condensed line, for a panel too narrow to fit
 * the full row.
 *
 * Status, rate-limit headroom, and a processed/progress tally — and **no bars**.
 * The rack, the reset timeline and the operation ledger are expanded-only, not
 * shrunk-down: a lane at this width is a few pixels of colour that can be read
 * as anything, and the bucket rack is the one section of the bar whose height
 * grows with what the org has been doing. The condensed line is a fixed height
 * by construction.
 *
 * This is a **separate tree** from the full layout, swapped rather than
 * cross-faded (ADR-0008) — see {@link module:sidepanel/components/activity/barParts}.
 */
import React from 'react';
import { StatusDot } from './barParts';
import type { ActivityView } from '../../hooks/useActivityBar';

/** Props for {@link CondensedBar}. */
export interface CondensedBarProps {
  /** Merged, display-ready activity state. */
  view: ActivityView;
  /** The toggle + Cancel cluster, built by the bar so both trees share one instance shape. */
  actions: React.ReactNode;
}

/**
 * Render the condensed line.
 *
 * @param props - See {@link CondensedBarProps}.
 */
const CondensedBar: React.FC<CondensedBarProps> = ({ view, actions }) => (
  <div className="flex items-center gap-(--sp-inline) px-(--sp-gutter) py-2.5 text-xs">
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <StatusDot busy={view.busy} colorVar={view.statusColorVar} />
      {view.operationActive && view.operationName ? (
        <span data-testid="activity-operation-name" className="truncate font-bold text-neutral-900">
          {view.operationName}
        </span>
      ) : (
        <span className="truncate font-bold text-neutral-900">{view.statusLabel}</span>
      )}
    </div>

    {view.rateLimit && (
      <span
        data-testid="activity-rate-compact"
        data-low={view.rateLimit.low ? 'true' : undefined}
        className={`shrink-0 ${view.rateLimit.low ? 'text-danger-text' : 'text-neutral-600'}`}
      >
        Rate{' '}
        <span className="font-bold">
          {view.rateLimit.remaining}/{view.rateLimit.limit}
        </span>
        {/* The word, not only the colour — a red figure and a black one are the
            same figure to a share of readers, and this is the one thing on the
            condensed line worth acting on. */}
        {view.rateLimit.low && <span className="ml-1 font-semibold">low</span>}
      </span>
    )}

    {view.operationActive ? (
      <span data-testid="activity-progress-compact" className="shrink-0 text-neutral-600">
        <span className="font-bold text-neutral-900">
          {view.current}/{view.total}
        </span>
        {view.opFailed > 0 && (
          <span className="ml-1 font-semibold text-danger-text">({view.opFailed} failed)</span>
        )}
      </span>
    ) : (
      view.processed > 0 && (
        <span data-testid="activity-processed-compact" className="shrink-0 text-neutral-600">
          Processed <span className="font-bold text-neutral-900">{view.processed}</span>
          {view.failed > 0 && (
            <span className="ml-1 font-semibold text-danger-text">({view.failed} failed)</span>
          )}
        </span>
      )
    )}

    <div data-testid="activity-actions" className="flex shrink-0 items-center gap-1.5">
      {actions}
    </div>
  </div>
);

export default CondensedBar;
