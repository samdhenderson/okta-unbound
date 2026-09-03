/**
 * @module sidepanel/components/activity/BucketList
 * @description The bucket **rack** of the expanded activity bar: every Okta
 * rate-limit family that has actually been exercised, as parallel lanes of
 * identical geometry.
 *
 * ## Why the filter is no longer "strained only"
 *
 * The rack used to admit a bucket only while it was under strain, because a
 * bucket that finished its work stopped being emitted by the scheduler seconds
 * later anyway — the row was going to vanish regardless, and the filter merely
 * chose which of three unrelated clocks it vanished on.
 *
 * ADR-0070 removed that: a bucket's row now survives for ten minutes after its
 * queue drains, its plan is reaped and its header observation expires. Keeping a
 * strained-only filter on top of that would defeat the feature exactly, because
 * a bucket stops being strained on its **last settle** — the precise instant the
 * memory exists to cover. The user would watch a family work and then watch its
 * row disappear the moment it finished, which is the behaviour the ADR was
 * written to end.
 *
 * So a lane is earned by strain **or by recent use** ({@link deservesTrack}).
 * What still collapses to one line is a bucket the scheduler is merely aware of
 * and that has never settled a request in this worker's lifetime — the rack
 * lists what has been exercised, not everything reachable. Retention is the
 * scheduler's decision, on one clock, and the rack simply renders it.
 *
 * @see `ADR-0060` §4 — the per-bucket state, already sorted by pressure.
 * @see `ADR-0070` §5–6 — remembered buckets, and what they are allowed to say.
 */
import React from 'react';
import type { BucketState } from '@/shared/scheduler/types';
import BucketRow, { deservesTrack } from './BucketRow';

/** Props for {@link BucketList}. */
export interface BucketListProps {
  /** Buckets as published by the scheduler, most-pressured first. */
  buckets: BucketState[];
  /** The org-learned back-off line the lanes mark against. */
  lowThresholdPercent: number;
  /** Shared clock tick, so every countdown in the bar moves together. */
  now: number;
  /**
   * Cap on lanes. The scheduler already bounds its memory at twelve buckets, but
   * twelve lanes would be half the panel; the overflow is **named** in the
   * summary line rather than dropped silently, and because the list arrives in
   * pressure order the lanes that survive the cap are the ones under strain.
   */
  maxRows?: number;
}

/** Short bucket label: `/api/v1/users` reads as `users`. */
function bucketLabel(bucket: string): string {
  return bucket.replace(/^\/api\/v1\//, '');
}

/** Comma-joined short labels, for the summary line. */
function names(buckets: BucketState[]): string {
  return buckets.map((bucket) => bucketLabel(bucket.bucket)).join(', ');
}

/**
 * Render the bucket rack, or nothing at all when no bucket has been observed.
 *
 * @param props - See {@link BucketListProps}.
 */
const BucketList: React.FC<BucketListProps> = ({
  buckets,
  lowThresholdPercent,
  now,
  maxRows = 6,
}) => {
  if (buckets.length === 0) return null;

  const earned = buckets.filter((bucket) => deservesTrack(bucket, lowThresholdPercent));
  const shown = earned.slice(0, maxRows);
  // Two distinct remainders, and they must not be conflated: buckets that earned
  // a lane but lost it to the cap, and buckets that never did anything. Calling
  // the first group "idle" would be the same class of error as letting a memory
  // pass for a reading.
  const overflow = earned.slice(maxRows);
  const untouched = buckets.filter((bucket) => !earned.includes(bucket));

  return (
    <div data-testid="activity-buckets" className="flex flex-col border-t border-neutral-100 py-1">
      {shown.map((bucket) => (
        <BucketRow
          key={bucket.bucket}
          bucket={bucket}
          lowThresholdPercent={lowThresholdPercent}
          now={now}
        />
      ))}

      {(overflow.length > 0 || untouched.length > 0) && (
        <div
          data-testid="activity-buckets-quiet"
          className="flex items-baseline gap-2 px-(--sp-gutter) py-1 text-xs text-neutral-500"
        >
          {overflow.length > 0 && (
            <span className="truncate">
              {overflow.length} more · {names(overflow)}
            </span>
          )}
          {untouched.length > 0 && (
            <span className="truncate">
              {untouched.length} {untouched.length === 1 ? 'bucket' : 'buckets'} idle ·{' '}
              {names(untouched)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default BucketList;
