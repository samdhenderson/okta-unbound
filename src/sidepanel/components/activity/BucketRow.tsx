/**
 * @module sidepanel/components/activity/BucketRow
 * @description One lane in the activity bar's bucket **rack**: an Okta
 * rate-limit family drawn as a label line above a full-width track, where the
 * track is that family's *remaining rate-limit budget*.
 *
 * Okta enforces quotas per endpoint family, so "the rate limit" was never one
 * number — `/api/v1/apps` can be exhausted while `/api/v1/groups` sits untouched
 * (ADR-0059). Stacking the families as lanes of identical geometry is what makes
 * them comparable at a glance; a column of differently-shaped cards is not.
 *
 * ## The track is the budget, not the shape of the work
 *
 * This is the whole point of the lane, and it is the thing an earlier build got
 * backwards (ADR-0072). The fill used to be `n / (active + queued + planned)` —
 * a composition of the *current work*, which meant the track read 100% full
 * whenever anything was running, whether that was four requests against an
 * untouched quota or four hundred against an exhausted one. Headroom, the only
 * quantity a reader can act on, appeared as text riding on the bar.
 *
 * Now the denominator is `remaining`. Running requests fill from the left in
 * solid indigo, queued and planned work continues as a dashed extension, and the
 * pale tail is the headroom that will still be there once this work drains. When
 * the declared work exceeds the remaining budget the track saturates and the
 * tail disappears — which is exactly the picture worth having, because it says
 * *this will not fit*, before the cooldown says it for you.
 *
 * ## A memory must never pass for a reading
 *
 * ADR-0070 keeps a bucket's lane alive for ten minutes after its work drains and
 * retains **only the lane's existence** — a remembered-idle bucket reports true
 * zero counts and a `null` budget. So there are four mutually exclusive forms
 * here, and two of them draw no scale at all:
 *
 * | Form                    | Track                              | Words                         |
 * | ----------------------- | ---------------------------------- | ----------------------------- |
 * | gated                   | {@link COOLDOWN_HATCH}, whole      | `cooling down · 24s`          |
 * | working, budget known   | running → queued → pale headroom   | `4 running · 61 queued`       |
 * | working, budget unknown | {@link UNKNOWN_HATCH}, whole       | `2 running · 8 queued`        |
 * | at rest                 | empty                              | `at rest · 40s ago`           |
 *
 * No lane ever prints a `remaining/limit` pair. The track carries the budget;
 * the exact figures are on the track's accessible name, where they inform
 * without competing with the shape.
 *
 * ## Colour is not the carrier
 *
 * A gated lane is hatched *and* carries a countdown in words; a low lane carries
 * a literal `low` badge; queued work is separated from running work by pattern
 * axis rather than by tint; and every magnitude on the track is also stated in
 * words on the label line. Nothing here needs hue to be legible, and every
 * pattern is static — one form, no reduced-motion variant.
 *
 * @see `ADR-0060` — the per-bucket state this renders.
 * @see `ADR-0070` — remembered buckets and `lastActiveAt`.
 * @see `ADR-0072` — why the denominator is `remaining`.
 */
import React from 'react';
import type { BucketState } from '@/shared/scheduler/types';
import { Badge } from '../shared';
import { COOLDOWN_HATCH, QUEUED_DASHES, UNKNOWN_HATCH } from './hatches';

/** Props for {@link BucketRow}. */
export interface BucketRowProps {
  /** The bucket state as published by the scheduler. */
  bucket: BucketState;
  /**
   * The remaining-percentage at or below which the scheduler starts backing off,
   * learned from the org's own setting. Passed in rather than hardcoded so the
   * lane's "low" treatment marks the line the scheduler actually acts on.
   */
  lowThresholdPercent: number;
  /** Milliseconds since the epoch, supplied by the bar's clock so every lane ticks together. */
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
 * How long ago something happened, coarsely.
 *
 * @param ms - Elapsed milliseconds. Negative input — clock skew across the
 * worker boundary — reads as `just now` rather than as a negative age, and a
 * non-finite input reads as `recently` rather than as `NaN`.
 * @returns A label such as `2m ago`.
 */
export function sinceLabel(ms: number): string {
  // `Math.max(0, NaN)` is NaN, so the clamp below does not catch a non-finite
  // input on its own — every comparison after it is false and the function
  // falls through to the hours branch, printing `NaNh ago`. Belt and braces
  // with {@link activeAt}: that guards the timestamp, this guards the clock.
  if (!Number.isFinite(ms)) return 'recently';
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
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
 * Whether this bucket carries an activity timestamp we can actually subtract.
 *
 * `BucketState.lastActiveAt` is typed `number | null`, so in this repo the only
 * two cases are a number and `null`. The value crosses the service-worker
 * boundary to get here, though, and a `!== null` test treats a **missing** field
 * as a present one: `undefined !== null` is `true`, `now - undefined` is `NaN`,
 * and the lane renders `last active NaNh ago`. That is what a panel running
 * ahead of a not-yet-restarted worker produces, and it is the shape any future
 * rename of the field would produce too.
 *
 * So the check is "is this a finite number", not "is this not null". A bucket
 * whose timestamp cannot be read says `at rest` and stops — the same answer as
 * one that never had a timestamp, and the same principle as the rest of this
 * lane: **a memory must never be able to pass for a reading**, and neither may
 * a broken one.
 */
export function activeAt(bucket: BucketState): number | null {
  return typeof bucket.lastActiveAt === 'number' && Number.isFinite(bucket.lastActiveAt)
    ? bucket.lastActiveAt
    : null;
}

/**
 * The denominator the track is drawn against, or `null` when there is none.
 *
 * Deliberately `remaining` and not `limit`: the question a reader is asking of
 * this lane is "will the work I have queued fit in what is left", and scaling to
 * the full quota would answer a different one. A non-positive or unreadable
 * remainder yields `null` — an exhausted bucket has no room to draw work
 * against, and drawing it against zero would divide by it.
 */
export function budgetDenominator(bucket: BucketState): number | null {
  const { remaining } = bucket;
  if (typeof remaining !== 'number' || !Number.isFinite(remaining) || remaining <= 0) return null;
  return remaining;
}

/** The four mutually exclusive forms a lane can take. */
export type LaneForm = 'gated' | 'working' | 'unmeasured' | 'at-rest';

/**
 * Widths of the two drawn segments, as CSS percentage strings.
 *
 * Clamped so the pair can never exceed the track: work that overruns the
 * remaining budget saturates the lane and leaves no pale tail, which is the
 * lane's way of saying the declared work does not fit. Returned as strings
 * because they are applied as inline styles — which is also what makes them
 * assertable, since the story runner loads no CSS and a Tailwind class would be
 * invisible to it.
 */
export function laneWidths(
  bucket: BucketState,
  denominator: number,
): { running: string; queued: string } {
  const running = Math.min(Math.max(bucket.active, 0) / denominator, 1);
  const queued = Math.min(
    (Math.max(bucket.queued, 0) + Math.max(bucket.planned, 0)) / denominator,
    1 - running,
  );
  return { running: `${running * 100}%`, queued: `${queued * 100}%` };
}

/**
 * Render one bucket's lane.
 *
 * @param props - See {@link BucketRowProps}.
 */
const BucketRow: React.FC<BucketRowProps> = ({ bucket, lowThresholdPercent, now }) => {
  const percent = headroomPercent(bucket);
  const low = percent !== null && percent <= lowThresholdPercent;
  const gatedFor = bucket.gatedUntil !== null ? Math.max(0, bucket.gatedUntil - now) : 0;
  const gated = gatedFor > 0;

  const work = bucket.active + bucket.queued + bucket.planned;
  const denominator = budgetDenominator(bucket);

  const form: LaneForm = gated
    ? 'gated'
    : work === 0
      ? 'at-rest'
      : denominator === null
        ? 'unmeasured'
        : 'working';

  const widths =
    form === 'working' && denominator !== null ? laneWidths(bucket, denominator) : null;

  const activeSince = activeAt(bucket);
  const label = bucketLabel(bucket.bucket);

  // The words. Every magnitude the track draws is also stated here, so the lane
  // is readable with the patterns ignored entirely.
  const words =
    form === 'gated'
      ? `cooling down · ${countdown(gatedFor)}`
      : form === 'at-rest'
        ? `at rest${activeSince !== null ? ` · ${sinceLabel(now - activeSince)}` : ''}`
        : [
            `${bucket.active} running`,
            bucket.queued > 0 ? `${bucket.queued} queued` : null,
            bucket.planned > 0 ? `${bucket.planned} planned` : null,
          ]
            .filter(Boolean)
            .join(' · ');

  // The exact figures live on the track's accessible name rather than on the
  // lane, so precision is available without a `480/600` pair competing with the
  // shape the track exists to show. "not reported" is never a resurrected
  // reading: a bucket whose window has expired reads exactly like one Okta has
  // never spoken about.
  const budgetPhrase =
    bucket.limit === null || bucket.remaining === null
      ? 'budget not reported'
      : `${bucket.remaining} of ${bucket.limit} requests remaining`;

  return (
    <div
      data-testid={`activity-bucket-${bucket.bucket}`}
      data-low={low ? 'true' : undefined}
      data-gated={gated ? 'true' : undefined}
      data-state={form}
      className="flex flex-col gap-1 px-(--sp-gutter) py-1.5"
    >
      <div className="flex items-baseline gap-2 text-xs">
        <span className="shrink-0 truncate font-medium text-neutral-900">{label}</span>
        <span
          data-testid={`activity-bucket-words-${bucket.bucket}`}
          className={`ms-auto min-w-0 truncate ${gated ? 'text-danger-text' : 'text-neutral-600'}`}
        >
          {words}
        </span>
        {low && (
          <Badge variant="danger" testId={`activity-bucket-low-${bucket.bucket}`}>
            low
          </Badge>
        )}
      </div>

      <div
        role="img"
        aria-label={`${label}: ${words}, ${budgetPhrase}`}
        data-testid={`activity-bucket-track-${bucket.bucket}`}
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-primary-light"
      >
        {form === 'gated' && (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ backgroundImage: COOLDOWN_HATCH }}
          />
        )}

        {form === 'unmeasured' && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-neutral-50"
            style={{ backgroundImage: UNKNOWN_HATCH }}
          />
        )}

        {form === 'at-rest' && (
          <div aria-hidden="true" className="absolute inset-0 bg-neutral-100" />
        )}

        {widths !== null && (
          <div aria-hidden="true" className="absolute inset-y-0 left-0 flex w-full">
            <div
              data-testid={`activity-bucket-running-${bucket.bucket}`}
              className="h-full bg-primary"
              style={{ width: widths.running }}
            />
            <div
              data-testid={`activity-bucket-queued-${bucket.bucket}`}
              className="h-full"
              style={{ width: widths.queued, backgroundImage: QUEUED_DASHES }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BucketRow;
