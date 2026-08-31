/**
 * @module sidepanel/components/activity/BucketRow
 * @description One Okta rate-limit bucket in the expanded activity bar: how much
 * headroom is left, how much is already spoken for, and whether it is gated.
 *
 * Okta enforces quotas per endpoint family, so "the rate limit" was never one
 * number — `/api/v1/apps` can be exhausted while `/api/v1/groups` sits untouched
 * (ADR-0059). This row is where that finally reaches the screen.
 *
 * @see `ADR-0060` — the per-bucket state this renders.
 */
import React from 'react';
import type { BucketState } from '@/shared/scheduler/types';
import PipelineMeter from './PipelineMeter';

/** Props for {@link BucketRow}. */
export interface BucketRowProps {
  bucket: BucketState;
  /**
   * The remaining-percentage at or below which the scheduler starts backing off,
   * learned from the org's own setting. Passed in rather than hardcoded so the
   * row's "low" colour is the line the scheduler actually acts on.
   */
  lowThresholdPercent: number;
  /** Milliseconds since the epoch, supplied by the bar's clock so every row ticks together. */
  now: number;
}

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
 * How much of this bucket's quota is left, as a percentage — or `null` when Okta
 * has not reported on it.
 *
 * `null` is not zero. An unobserved bucket has an unknown budget, and colouring
 * it as exhausted would be a lie the user might act on.
 */
export function headroomPercent(bucket: BucketState): number | null {
  if (bucket.limit === null || bucket.limit <= 0 || bucket.remaining === null) return null;
  return (bucket.remaining / bucket.limit) * 100;
}

/**
 * Whether a bucket is under enough strain to deserve a full row.
 *
 * A bucket earns one by being gated, by having work against it, or by sitting at
 * or below the org's warning threshold. Everything else collapses into a single
 * summary line, which is what keeps the bar from growing with the org.
 */
export function isStrained(bucket: BucketState, lowThresholdPercent: number): boolean {
  if (bucket.gatedUntil !== null) return true;
  if (bucket.queued > 0 || bucket.active > 0 || bucket.planned > 0) return true;
  const percent = headroomPercent(bucket);
  return percent !== null && percent <= lowThresholdPercent;
}

/**
 * Render one bucket's row.
 *
 * @param props - See {@link BucketRowProps}.
 */
const BucketRow: React.FC<BucketRowProps> = ({ bucket, lowThresholdPercent, now }) => {
  const percent = headroomPercent(bucket);
  const low = percent !== null && percent <= lowThresholdPercent;
  const gatedFor = bucket.gatedUntil !== null ? Math.max(0, bucket.gatedUntil - now) : 0;
  const gated = gatedFor > 0;

  const headroom =
    bucket.limit === null || bucket.remaining === null
      ? // Never "0/0": an unreported bucket is unknown, not empty.
        'not reported'
      : `${bucket.remaining}/${bucket.limit}`;

  const tone = gated ? 'bg-danger-light' : low ? 'bg-warning-light' : '';

  return (
    <div
      data-testid={`activity-bucket-${bucket.bucket}`}
      data-low={low ? 'true' : undefined}
      data-gated={gated ? 'true' : undefined}
      className={`flex flex-col gap-1 px-(--sp-gutter) py-1.5 ${tone}`}
    >
      <div className="flex items-baseline gap-2 text-xs">
        <span className="truncate font-medium text-neutral-900">{bucketLabel(bucket.bucket)}</span>
        {gated && (
          <span
            data-testid={`activity-bucket-cooldown-${bucket.bucket}`}
            className="shrink-0 rounded-sm border border-danger px-1 text-[0.625rem] font-medium tracking-wide text-danger-text uppercase"
          >
            {countdown(gatedFor)}
          </span>
        )}
        <span
          className={`ml-auto shrink-0 tabular-nums ${low ? 'text-danger-text' : 'text-neutral-600'}`}
        >
          {headroom}
        </span>
        {bucket.planned > 0 && (
          <span className="shrink-0 tabular-nums text-neutral-600">· {bucket.planned} planned</span>
        )}
      </div>
      <PipelineMeter
        counts={{
          spent: 0,
          active: bucket.active,
          queued: bucket.queued,
          planned: bucket.planned,
        }}
        label={`${bucketLabel(bucket.bucket)}: ${bucket.active} in flight, ${bucket.queued} queued, ${bucket.planned} planned`}
      />
    </div>
  );
};

export default BucketRow;
