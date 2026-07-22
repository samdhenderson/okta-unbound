/**
 * @module sidepanel/components/ActivityBarView
 * @description Pure presentation of the unified activity bar.
 *
 * Renders the merged scheduler + operation state ({@link ActivityView}) as one
 * fixed bottom bar with a deliberately STABLE layout: the status region, the four
 * metric slots (queue / active / rate-limit / eta) and the action area are always
 * mounted, so values coming and going swap text in place instead of adding and
 * removing DOM (which is what made the old two-bar design reflow). All state comes
 * in as props; timers and context wiring live in {@link useActivityBar}.
 *
 * On a narrow side panel the full row does not fit, so the bar can collapse to a
 * condensed line — status, rate-limit and a processed/progress tally — with a
 * chevron the user clicks to reveal the rest. Whether it is currently condensed
 * (`collapsed`) and whether the toggle is offered at all (`collapsible`) are
 * decided by the container from the panel width; this view just renders them.
 */
import React from 'react';
import { Button, IconButton } from './shared';
import type { ActivityView } from '../hooks/useActivityBar';

/** Props for {@link ActivityBarView}. */
export interface ActivityBarViewProps {
  /** Merged, display-ready activity state. */
  view: ActivityView;
  /** Invoked when the user confirms cancellation of the current work. */
  onCancel: () => void;
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

/** A fixed-width metric slot that keeps its place in the row even when empty. */
const MetricSlot: React.FC<{
  testId: string;
  label: string;
  children: React.ReactNode;
  emphasis?: 'default' | 'low';
  present: boolean;
}> = ({ testId, label, children, emphasis = 'default', present }) => (
  <div
    data-testid={testId}
    data-low={emphasis === 'low' ? 'true' : undefined}
    className={`flex min-w-[5.5rem] items-center gap-1.5 rounded-md border px-2.5 py-1 ${
      !present
        ? 'border-neutral-200 bg-neutral-50 text-neutral-400'
        : emphasis === 'low'
          ? 'border-danger/20 bg-danger-light text-danger-text'
          : 'border-neutral-200 bg-neutral-50 text-neutral-900'
    }`}
  >
    <span className="text-neutral-600">{label}</span>
    {present ? (
      <span className="font-bold">{children}</span>
    ) : (
      <span aria-hidden="true" className="font-bold">
        –
      </span>
    )}
  </div>
);

/** Chevron glyph that points right when collapsed and down when expanded. */
const CollapseChevron: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <svg
    aria-hidden="true"
    className={`h-4 w-4 transition-transform duration-100 ${collapsed ? '' : 'rotate-90'}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

/**
 * Render the unified activity bar from already-merged {@link ActivityView} state.
 *
 * @param props - See {@link ActivityBarViewProps}.
 */
const ActivityBarView: React.FC<ActivityBarViewProps> = ({
  view,
  onCancel,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
}) => {
  const etaContent = view.operationActive ? view.etaLabel : view.cooldownLabel;
  const etaLabel = view.cooldownLabel && !view.operationActive ? 'Resuming' : 'ETA';

  const statusDot = (
    <div
      aria-hidden="true"
      className={`h-2 w-2 shrink-0 rounded-full shadow-sm ${view.busy ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: view.statusColorVar }}
    />
  );

  const cancelButton = (
    <Button
      variant="danger"
      size="sm"
      disabled={!view.canCancel || view.isCancelling}
      onClick={onCancel}
      title="Cancel the current operation and clear the queue"
    >
      {view.isCancelling ? 'Cancelling…' : 'Cancel'}
    </Button>
  );

  const collapseToggle = collapsible ? (
    <IconButton
      label={collapsed ? 'Show all activity stats' : 'Hide extra activity stats'}
      variant="subtle"
      size="sm"
      active={!collapsed}
      onClick={onToggleCollapse}
    >
      <CollapseChevron collapsed={collapsed} />
    </IconButton>
  ) : null;

  const progressTrack = (
    <div
      role="progressbar"
      aria-valuenow={Math.round(view.percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1 w-full bg-neutral-100"
    >
      <div
        className="h-full bg-primary transition-all duration-150"
        style={{ width: `${view.percentage}%` }}
      />
    </div>
  );

  const barClasses = 'fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white';

  // Condensed line for a narrow panel: status + rate + a processed/progress
  // tally, with the chevron to reveal the full stats and the always-present
  // Cancel affordance. Everything else lives behind the toggle.
  if (collapsed) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={barClasses}
        style={{ fontFamily: 'var(--font-primary)' }}
      >
        <div className="flex items-center gap-3 px-5 py-2.5 text-xs">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {statusDot}
            {view.operationActive && view.operationName ? (
              <span
                data-testid="activity-operation-name"
                className="truncate font-bold text-neutral-900"
              >
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
            </span>
          )}

          {view.operationActive ? (
            <span data-testid="activity-progress-compact" className="shrink-0 text-neutral-600">
              <span className="font-bold text-neutral-900">
                {view.current}/{view.total}
              </span>
              {view.opFailed > 0 && (
                <span className="ml-1 font-semibold text-danger-text">
                  ({view.opFailed} failed)
                </span>
              )}
            </span>
          ) : (
            view.processed > 0 && (
              <span data-testid="activity-processed-compact" className="shrink-0 text-neutral-600">
                Processed <span className="font-bold text-neutral-900">{view.processed}</span>
                {view.failed > 0 && (
                  <span className="ml-1 font-semibold text-danger-text">
                    ({view.failed} failed)
                  </span>
                )}
              </span>
            )
          )}

          <div data-testid="activity-actions" className="flex shrink-0 items-center gap-1.5">
            {collapseToggle}
            {cancelButton}
          </div>
        </div>

        {progressTrack}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={barClasses}
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      <div
        className={`flex items-center gap-3 px-5 py-2.5 text-xs ${collapsible ? 'flex-wrap' : ''}`}
      >
        {/* Status region — always present */}
        <div className="flex min-w-[8rem] items-center gap-2">
          {statusDot}
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

        {/* Metric slots — always mounted so the row never reflows */}
        <MetricSlot testId="activity-queue" label="Queue" present={view.queueLength > 0}>
          {view.queueLength}
        </MetricSlot>
        <MetricSlot testId="activity-active" label="Active" present={view.activeRequests > 0}>
          {view.activeRequests}
        </MetricSlot>
        <MetricSlot
          testId="activity-rate-limit"
          label="Rate"
          present={view.rateLimit !== null}
          emphasis={view.rateLimit?.low ? 'low' : 'default'}
        >
          {view.rateLimit ? `${view.rateLimit.remaining}/${view.rateLimit.limit}` : null}
        </MetricSlot>
        <MetricSlot testId="activity-eta" label={etaLabel} present={Boolean(etaContent)}>
          {etaContent}
        </MetricSlot>

        {/* Operation breakdown — the full "removing X · Y done · Z active" story */}
        {view.operationActive && view.total > 0 && (
          <div
            data-testid="activity-op-breakdown"
            className="ml-auto flex items-center gap-2 font-medium text-neutral-600"
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
          <div className="ml-auto flex items-center gap-1.5 text-neutral-600">
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
            view.operationActive || view.processed > 0 ? '' : 'ml-auto'
          }`}
        >
          {collapseToggle}
          {cancelButton}
        </div>
      </div>

      {/* Progress track — stays mounted at 0% when idle */}
      {progressTrack}
    </div>
  );
};

export default ActivityBarView;
