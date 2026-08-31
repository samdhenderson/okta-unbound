/**
 * @module sidepanel/components/activity/BucketList
 * @description The bucket section of the expanded activity bar.
 *
 * The rule that keeps the bar short: only buckets under strain get a row, and
 * every bucket at full headroom with nothing queued collapses into one line.
 * Without it the bar would grow with the org — an extension that has touched
 * nine endpoint families would show nine rows to say nothing at all.
 *
 * @see `ADR-0060` §4 — the per-bucket state, already sorted by pressure.
 */
import React from 'react';
import type { BucketState } from '@/shared/scheduler/types';
import BucketRow, { isStrained } from './BucketRow';

/** Props for {@link BucketList}. */
export interface BucketListProps {
  /** Buckets as published by the scheduler, most-pressured first. */
  buckets: BucketState[];
  /** The org-learned back-off line the rows colour against. */
  lowThresholdPercent: number;
  /** Shared clock tick, so every countdown in the bar moves together. */
  now: number;
  /**
   * Cap on full rows. A very strained org could otherwise push the bar to half
   * the panel; the overflow is named in the summary line rather than dropped
   * silently.
   */
  maxRows?: number;
}

/** Short bucket label: `/api/v1/users` reads as `users`. */
function bucketLabel(bucket: string): string {
  return bucket.replace(/^\/api\/v1\//, '');
}

/**
 * Render the bucket section, or nothing at all when no bucket has been observed.
 *
 * @param props - See {@link BucketListProps}.
 */
const BucketList: React.FC<BucketListProps> = ({
  buckets,
  lowThresholdPercent,
  now,
  maxRows = 4,
}) => {
  if (buckets.length === 0) return null;

  const strained = buckets.filter((bucket) => isStrained(bucket, lowThresholdPercent));
  const shown = strained.slice(0, maxRows);
  // Everything not given a row: quiet buckets, plus any strained ones past the
  // cap. Both are named in the summary, so nothing is silently truncated.
  const rest = buckets.filter((bucket) => !shown.includes(bucket));

  return (
    <div data-testid="activity-buckets" className="border-t border-neutral-100">
      {shown.map((bucket) => (
        <BucketRow
          key={bucket.bucket}
          bucket={bucket}
          lowThresholdPercent={lowThresholdPercent}
          now={now}
        />
      ))}

      {rest.length > 0 && (
        <div
          data-testid="activity-buckets-quiet"
          className="flex items-baseline gap-2 px-(--sp-gutter) py-1.5 text-xs text-neutral-500"
        >
          <span className="truncate">
            {rest.length} {rest.length === 1 ? 'bucket' : 'buckets'} idle ·{' '}
            {rest.map((bucket) => bucketLabel(bucket.bucket)).join(', ')}
          </span>
          <span className="ml-auto shrink-0">full headroom</span>
        </div>
      )}
    </div>
  );
};

export default BucketList;
