/**
 * @module sidepanel/components/activity/ResetTimeline
 * @description When the scheduler is gated, the one thing worth knowing is *when
 * it stops being gated* — and, if several buckets are cooling down, in what
 * order they come back.
 *
 * A list of countdowns answers the first question and not the second. Laid out
 * on a shared axis, "users lifts long before apps does" is a glance rather than
 * a subtraction, which is what tells a user whether to wait or to go and do
 * something else.
 *
 * Rendered **only while a gate is armed**, so it costs nothing in the common
 * case and never changes the idle bar's height (ADR-0008).
 *
 * @see `ADR-0060` — the per-bucket state this reads.
 */
import React from 'react';
import type { BucketState } from '@/shared/scheduler/types';

/** Props for {@link ResetTimeline}. */
export interface ResetTimelineProps {
  /** Buckets as published by the scheduler. */
  buckets: BucketState[];
  /** Milliseconds since the epoch, from the bar's shared clock. */
  now: number;
}

/** One gate, placed on the axis. */
export interface ResetMark {
  /** The bucket key, e.g. `/api/v1/users`. */
  bucket: string;
  /** Milliseconds until this gate lifts. */
  inMs: number;
  /** Position along the axis, 0–100. */
  offsetPercent: number;
}

/** The narrowest axis we will draw, so a single 3-second gate does not fill the width. */
const MIN_WINDOW_MS = 60_000;

/** Short bucket label: `/api/v1/users` reads as `users`. */
function bucketLabel(bucket: string): string {
  return bucket.replace(/^\/api\/v1\//, '');
}

/** Format a millisecond duration as a coarse `Xm Ys` / `Xs` countdown. */
function countdown(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Place every armed gate on a shared axis, soonest first.
 *
 * The axis is at least {@link MIN_WINDOW_MS} wide so marks do not jump around as
 * the furthest gate ticks down, and gates that have already lifted are dropped
 * rather than pinned at zero.
 *
 * @param buckets - Buckets as published by the scheduler.
 * @param now - Current time in epoch milliseconds.
 * @returns The marks, ascending by time, and the axis width in milliseconds.
 */
export function resetMarks(
  buckets: BucketState[],
  now: number,
): { marks: ResetMark[]; windowMs: number } {
  const armed = buckets
    .filter((bucket) => bucket.gatedUntil !== null && bucket.gatedUntil > now)
    .map((bucket) => ({ bucket: bucket.bucket, inMs: (bucket.gatedUntil as number) - now }))
    .sort((a, b) => a.inMs - b.inMs);

  if (armed.length === 0) return { marks: [], windowMs: MIN_WINDOW_MS };

  const windowMs = Math.max(MIN_WINDOW_MS, armed[armed.length - 1].inMs);
  return {
    marks: armed.map((mark) => ({ ...mark, offsetPercent: (mark.inMs / windowMs) * 100 })),
    windowMs,
  };
}

/**
 * Render the reset timeline, or nothing when no gate is armed.
 *
 * @param props - See {@link ResetTimelineProps}.
 */
const ResetTimeline: React.FC<ResetTimelineProps> = ({ buckets, now }) => {
  const { marks, windowMs } = resetMarks(buckets, now);
  if (marks.length === 0) return null;

  const summary = marks
    .map((mark) => `${bucketLabel(mark.bucket)} in ${countdown(mark.inMs)}`)
    .join(', ');

  return (
    <div
      data-testid="activity-reset-timeline"
      className="flex flex-col gap-1 border-t border-neutral-100 px-(--sp-gutter) py-1.5"
    >
      <div className="flex items-baseline gap-2 text-xs">
        <span className="font-medium text-neutral-900">Rate limits lift</span>
        <span className="ml-auto shrink-0 tabular-nums text-neutral-600">{summary}</span>
      </div>

      <div role="img" aria-label={`Rate limits lift: ${summary}`} className="relative h-4">
        <div aria-hidden="true" className="absolute inset-x-0 top-1.5 h-px bg-neutral-200" />
        {marks.map((mark) => (
          <div
            key={mark.bucket}
            data-testid={`activity-reset-mark-${mark.bucket}`}
            aria-hidden="true"
            className="absolute top-0 h-3 w-px bg-danger"
            style={{ left: `${mark.offsetPercent}%` }}
          />
        ))}
      </div>

      <div aria-hidden="true" className="flex justify-between text-xs text-neutral-600">
        <span>now</span>
        <span className="tabular-nums">+{countdown(windowMs)}</span>
      </div>
    </div>
  );
};

export default ResetTimeline;
