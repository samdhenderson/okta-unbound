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
 */
import React from 'react';
import { Button } from './shared';
import type { ActivityView } from '../hooks/useActivityBar';

/** Props for {@link ActivityBarView}. */
export interface ActivityBarViewProps {
  /** Merged, display-ready activity state. */
  view: ActivityView;
  /** Invoked when the user confirms cancellation of the current work. */
  onCancel: () => void;
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

/**
 * Render the unified activity bar from already-merged {@link ActivityView} state.
 *
 * @param props - See {@link ActivityBarViewProps}.
 */
const ActivityBarView: React.FC<ActivityBarViewProps> = ({ view, onCancel }) => {
  const etaContent = view.operationActive ? view.etaLabel : view.cooldownLabel;
  const etaLabel = view.cooldownLabel && !view.operationActive ? 'Resuming' : 'ETA';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white"
      style={{ fontFamily: 'var(--font-primary)' }}
    >
      <div className="flex items-center gap-3 px-5 py-2.5 text-xs">
        {/* Status region — always present */}
        <div className="flex min-w-[8rem] items-center gap-2">
          <div
            aria-hidden="true"
            className={`h-2 w-2 rounded-full shadow-sm ${view.busy ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: view.statusColorVar }}
          />
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

        {/* Progress counter — only meaningful mid-operation */}
        {view.operationActive && view.total > 0 && (
          <span
            data-testid="activity-progress-counter"
            className="ml-auto font-medium text-neutral-600"
          >
            {view.current} / {view.total}
          </span>
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
          className={view.operationActive || view.processed > 0 ? '' : 'ml-auto'}
        >
          <Button
            variant="danger"
            size="sm"
            disabled={!view.canCancel || view.isCancelling}
            onClick={onCancel}
            title="Cancel the current operation and clear the queue"
          >
            {view.isCancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        </div>
      </div>

      {/* Progress track — stays mounted at 0% when idle */}
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
    </div>
  );
};

export default ActivityBarView;
