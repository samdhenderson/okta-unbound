/**
 * @module sidepanel/components/ActivityBarView
 * @description Pure presentation of the unified activity bar.
 *
 * Renders the merged scheduler + operation state ({@link ActivityView}) as one
 * fixed bottom bar with a deliberately STABLE layout: the status region, the
 * summary line and the action area are always mounted, so values coming and
 * going swap text in place instead of adding and removing DOM (which is what
 * made the old two-bar design reflow). All state comes in as props; timers and
 * context wiring live in {@link useActivityBar}.
 *
 * On a narrow side panel the full row does not fit, so the bar can collapse to a
 * condensed line — status, rate-limit and a processed/progress tally, and **no
 * bars at all** ({@link CondensedBar}). Whether it is currently condensed
 * (`collapsed`) and whether the toggle is offered (`collapsible`) are decided by
 * the container from the panel width; this view just renders them.
 *
 * ## What the expanded bar is, top to bottom
 *
 * One status/summary row, then the operation ledger, then the reset timeline,
 * then the **bucket rack** — every rate-limit family that has been exercised, as
 * parallel lanes of identical geometry (`activity/BucketList`). Four boxed
 * metric tiles used to sit where the summary line is; three of them held one
 * number each and the fourth, **Active**, held a scheduler-internal that changed
 * several times a second and that the rack already draws. It is gone.
 *
 * ## Motion policy: values animate, layout does not
 *
 * ADR-0008 exists because this bar used to reflow. So the only motion here is on
 * things that cannot move their neighbours: the progress track's `width` and the
 * collapse chevron's `rotate`. Both the busy pulse dot and the progress width
 * carry `.motion-exempt` — they encode live state, so they keep animating under
 * `prefers-reduced-motion`. The rack's lanes do not animate at all: their fills
 * are static and the cooldown hatch is a still pattern, so there is no
 * reduced-motion form to switch to.
 *
 * The condensed and full layouts are deliberately **not** cross-faded into one
 * another. A crossfade needs both trees in the DOM at once, and each tree
 * carries a Cancel button, the collapse toggle and the bar's `role="status"`
 * live region: overlapping them would duplicate two interactive controls in the
 * tab order and announce the bar's state twice, while the two trees' differing
 * heights would move the bar's top edge — the exact reflow ADR-0008 forbids.
 *
 * The bar's own horizontal inset consumes `--sp-gutter` and the gap between its
 * clusters consumes `--sp-inline` (ADR-0048), so the docked band narrows and
 * widens with the same rule the scrolling content follows.
 */
import React from 'react';
import { Button, IconButton } from './shared';
import ActivitySummary from './activity/ActivitySummary';
import BucketList from './activity/BucketList';
import CondensedBar from './activity/CondensedBar';
import OperationList from './activity/OperationList';
import ResetTimeline from './activity/ResetTimeline';
import { CollapseChevron, ProgressTrack, StatusDot } from './activity/barParts';
import type { ActivityView } from '../hooks/useActivityBar';

/** Props for {@link ActivityBarView}. */
export interface ActivityBarViewProps {
  /** Merged, display-ready activity state. */
  view: ActivityView;
  /** Invoked when the user confirms cancellation of the current work. */
  onCancel: () => void;
  /**
   * Stops one declared operation, leaving every other one running. Omit to
   * render the operation ledger read-only.
   */
  onCancelOperation?: (planId: string) => void;
  /**
   * Whether the panel is narrow enough to offer collapsing. When `true` the
   * chevron toggle is shown; when `false` the bar always renders its full row.
   * Defaults to `false`.
   */
  collapsible?: boolean;
  /**
   * Whether the bar is currently condensed to its essentials (status + rate +
   * processed/progress). Only meaningful when `collapsible`. Defaults to `false`.
   */
  collapsed?: boolean;
  /** Toggles between the condensed and full layouts. */
  onToggleCollapse?: () => void;
}

const BAR_CLASSES = 'fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white';

/**
 * Render the unified activity bar from already-merged {@link ActivityView} state.
 *
 * @param props - See {@link ActivityBarViewProps}.
 */
const ActivityBarView: React.FC<ActivityBarViewProps> = ({
  view,
  onCancel,
  onCancelOperation,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
}) => {
  // Once the ledger shows more than one operation, each with its own ✕, a bare
  // "Cancel" no longer says which. It becomes "Cancel all" — the button's
  // behaviour has always been to drain the whole queue.
  const cancelsEverything = view.operations.length > 1;

  const actions = (
    <>
      {collapsible && (
        <IconButton
          label={collapsed ? 'Show all activity stats' : 'Hide extra activity stats'}
          variant="subtle"
          size="sm"
          active={!collapsed}
          onClick={onToggleCollapse}
        >
          <CollapseChevron collapsed={collapsed} />
        </IconButton>
      )}
      <Button
        variant="danger"
        size="sm"
        disabled={!view.canCancel || view.isCancelling}
        onClick={onCancel}
        title={
          cancelsEverything
            ? 'Cancel every running operation and clear the queue'
            : 'Cancel the current operation and clear the queue'
        }
      >
        {view.isCancelling ? 'Cancelling…' : cancelsEverything ? 'Cancel all' : 'Cancel'}
      </Button>
    </>
  );

  if (collapsed) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={BAR_CLASSES}
        style={{ fontFamily: 'var(--font-primary)' }}
      >
        <CondensedBar view={view} actions={actions} />
        <ProgressTrack percentage={view.percentage} />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={BAR_CLASSES}
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      <div
        className={`flex items-center gap-(--sp-inline) px-(--sp-gutter) py-2.5 text-xs ${collapsible ? 'flex-wrap' : ''}`}
      >
        {/* Status region — always present */}
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot busy={view.busy} colorVar={view.statusColorVar} />
          {view.operationActive && view.operationName ? (
            <span
              data-testid="activity-operation-name"
              className="truncate font-bold text-neutral-900"
            >
              {view.operationName}
            </span>
          ) : (
            <span className="font-bold text-neutral-900">{view.statusLabel}</span>
          )}
        </div>

        {/* One summary line, not a grid of tiles. Always mounted. */}
        <ActivitySummary view={view} />

        {/* Operation breakdown — the full "X done · Y active" story */}
        {view.operationActive && view.total > 0 && (
          <div
            data-testid="activity-op-breakdown"
            className="ms-auto flex items-center gap-2 font-medium text-neutral-600"
          >
            <span data-testid="activity-progress-counter" className="text-neutral-900">
              {view.current} / {view.total}
            </span>
            <span aria-hidden="true" className="text-neutral-300">
              |
            </span>
            <span className="text-success-text">{view.opCompleted} done</span>
            <span className="text-info">{view.opActive} active</span>
            {view.opFailed > 0 && <span className="text-danger-text">{view.opFailed} failed</span>}
          </div>
        )}

        {/* Processed tally — fills the flexible gap when idle */}
        {!view.operationActive && view.processed > 0 && (
          <div className="ms-auto flex items-center gap-1.5 text-neutral-600">
            <span>Processed:</span>
            <span className="font-bold text-neutral-900">{view.processed}</span>
            {view.failed > 0 && (
              <span className="font-semibold text-danger-text">({view.failed} failed)</span>
            )}
          </div>
        )}

        {/* Action area — always present so the right edge never shifts */}
        <div
          data-testid="activity-actions"
          className={`flex items-center gap-1.5 ${
            view.operationActive || view.processed > 0 ? '' : 'ms-auto'
          }`}
        >
          {actions}
        </div>
      </div>

      {/* The ledger: every operation that declared a budget, with its own stop
          control. Absent entirely when nothing has been declared. */}
      <OperationList operations={view.operations} onCancelOperation={onCancelOperation} />

      {/* Only while a gate is armed: when each bucket comes back, on one axis. */}
      <ResetTimeline buckets={view.buckets} now={view.now} />

      {/* The rack: one lane per exercised bucket. A bucket the scheduler has
          never seen settle collapses into the summary line. */}
      <BucketList
        buckets={view.buckets}
        lowThresholdPercent={view.lowThresholdPercent}
        now={view.now}
      />

      <ProgressTrack percentage={view.percentage} />
    </div>
  );
};

export default ActivityBarView;
