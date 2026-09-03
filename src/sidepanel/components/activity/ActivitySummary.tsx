/**
 * @module sidepanel/components/activity/ActivitySummary
 * @description The activity bar's one-line summary: queue depth, rate-limit
 * headroom, and the time-remaining range.
 *
 * This replaces a 2×2 grid of four boxed metric tiles. Three of those four were
 * one number each, and the fourth — **Active** — was the least informative of
 * them: in-flight count is a scheduler-internal that changes several times a
 * second, it is already drawn as the filled part of every lane in the rack
 * below, and no decision a user makes depends on it. It is dropped rather than
 * shrunk.
 *
 * Each slot stays mounted whether or not it has a value, printing an em dash
 * when it does not, so a value arriving never adds DOM and never reflows the row
 * (ADR-0008).
 */
import React from 'react';
import type { ActivityView } from '../../hooks/useActivityBar';

/** Props for {@link ActivitySummary}. */
export interface ActivitySummaryProps {
  /** Merged, display-ready activity state. */
  view: ActivityView;
}

/** One labelled figure on the summary line. Always mounted; empty prints a dash. */
const Slot: React.FC<{
  /** Stable hook for tests and stories. */
  testId: string;
  /** The word before the figure, e.g. `Queue`. */
  label: string;
  /** Marks a figure the user should act on — currently only low headroom. */
  emphasis?: 'default' | 'low';
  /** The figure itself, or `null` when there is nothing to report. */
  children: React.ReactNode;
}> = ({ testId, label, emphasis = 'default', children }) => (
  <span
    data-testid={testId}
    data-low={emphasis === 'low' ? 'true' : undefined}
    className="flex shrink-0 items-baseline gap-1"
  >
    <span className="text-neutral-600">{label}</span>
    <span
      className={`font-semibold tabular-nums ${
        children === null
          ? 'text-neutral-400'
          : emphasis === 'low'
            ? 'text-danger-text'
            : 'text-neutral-900'
      }`}
    >
      {children ?? '—'}
    </span>
  </span>
);

/** A hairline separator between slots. */
const Dot: React.FC = () => (
  <span aria-hidden="true" className="shrink-0 text-neutral-300">
    ·
  </span>
);

/**
 * Render the summary line.
 *
 * The ETA slot shows the operation's remaining-time **range** while one is
 * running, and the global cooldown countdown (as `Resuming`) when one is not.
 * Its `unknown` form is words — never a number — because a made-up optimistic
 * figure is the failure the range exists to remove.
 *
 * @param props - See {@link ActivitySummaryProps}.
 */
const ActivitySummary: React.FC<ActivitySummaryProps> = ({ view }) => {
  const resuming = Boolean(view.cooldownLabel) && !view.operationActive;
  const etaValue = view.operationActive ? (view.eta?.label ?? null) : (view.cooldownLabel ?? null);

  return (
    <div
      data-testid="activity-summary"
      className="flex min-w-0 items-baseline gap-(--sp-inline) text-xs"
    >
      <Slot testId="activity-queue" label="Queue">
        {view.queueLength > 0 ? view.queueLength : null}
      </Slot>
      <Dot />
      <Slot
        testId="activity-rate-limit"
        label="Rate"
        emphasis={view.rateLimit?.low ? 'low' : 'default'}
      >
        {view.rateLimit ? `${view.rateLimit.remaining}/${view.rateLimit.limit}` : null}
      </Slot>
      <Dot />
      <Slot testId="activity-eta" label={resuming ? 'Resuming' : 'ETA'}>
        {etaValue}
      </Slot>
    </div>
  );
};

export default ActivitySummary;
