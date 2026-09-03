/**
 * @module sidepanel/components/activity/BucketList
 * @description The bucket **rack** of the expanded activity bar: every Okta
 * rate-limit family the scheduler is tracking, as parallel lanes of identical
 * geometry.
 *
 * ## Every known bucket is a lane, always
 *
 * The rack used to filter. First to buckets under strain, then — once ADR-0070
 * gave a bucket ten minutes of memory after its work drained — to strain *or*
 * recent use, with the remainder collapsed onto a "3 buckets idle · meta, zones"
 * summary line.
 *
 * Both filters were solving a problem that no longer exists. The scheduler's
 * published set is already the answer to "which buckets matter": `getState()`
 * emits a lane only for a family that has been observed, has work against it, is
 * planned for, or settled a request inside the memory window, and ADR-0070 §5
 * bounds that at twelve with LRU eviction. Filtering it again in the view meant
 * the rack answered a *second*, differently-shaped question, and the two answers
 * disagreed at exactly the wrong moment — a bucket stops being strained on its
 * last settle, so a strain filter deleted the row at the precise instant the
 * memory existed to preserve it.
 *
 * So: no filter, no row cap, no summary line. A lane appears when the scheduler
 * starts tracking a bucket and disappears when the scheduler forgets it, on one
 * clock, decided in one place. The rack renders retention; it does not have a
 * retention policy of its own (ADR-0072).
 *
 * ## Why the height is bounded anyway
 *
 * Twelve two-line lanes would be most of a side panel. The rack is therefore
 * scrollable rather than truncated: every lane stays reachable, and none is
 * hidden behind a line of prose that a reader has to expand something to
 * resolve. Truncating would reintroduce exactly the filter this module just
 * removed, one layer down.
 *
 * The expanded bar is opt-in on a panel this narrow — `ActivityBar` collapses
 * below 640px and a Chrome side panel is ~400px — so a reader who has the rack
 * on screen asked for it.
 *
 * @see `ADR-0060` §4 — the per-bucket state, already sorted by pressure.
 * @see `ADR-0070` §5–6 — remembered buckets, and what they are allowed to say.
 * @see `ADR-0072` — the lane's denominator, and why the rack stopped filtering.
 */
import React from 'react';
import type { BucketState } from '@/shared/scheduler/types';
import BucketRow from './BucketRow';
import RackLegend from './RackLegend';

/** Props for {@link BucketListProps}. */
export interface BucketListProps {
  /** Buckets as published by the scheduler, most-pressured first. */
  buckets: BucketState[];
  /** The org-learned back-off line the lanes mark against. */
  lowThresholdPercent: number;
  /** Shared clock tick, so every countdown in the bar moves together. */
  now: number;
}

/**
 * Render the bucket rack, or nothing at all when no bucket is being tracked.
 *
 * The empty case stays `null` rather than becoming an empty-state message: a
 * scheduler that has not touched Okta yet is not a condition to report, and
 * mounting a placeholder would grow the bar for no information (ADR-0008).
 *
 * @param props - See {@link BucketListProps}.
 */
const BucketList: React.FC<BucketListProps> = ({ buckets, lowThresholdPercent, now }) => {
  if (buckets.length === 0) return null;

  return (
    <div data-testid="activity-buckets" className="flex flex-col border-t border-neutral-100 py-1">
      <div className="flex max-h-56 flex-col overflow-y-auto">
        {buckets.map((bucket) => (
          <BucketRow
            key={bucket.bucket}
            bucket={bucket}
            lowThresholdPercent={lowThresholdPercent}
            now={now}
          />
        ))}
      </div>

      <RackLegend />
    </div>
  );
};

export default BucketList;
