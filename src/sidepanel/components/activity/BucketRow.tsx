/**
 * @module sidepanel/components/activity/BucketRow
 * @description One track in the activity bar's bucket **rack**: an Okta
 * rate-limit family rendered as a single horizontal lane, with its state folded
 * onto the lane rather than sitting beside it.
 *
 * Okta enforces quotas per endpoint family, so "the rate limit" was never one
 * number — `/api/v1/apps` can be exhausted while `/api/v1/groups` sits untouched
 * (ADR-0059). Stacking the families as parallel lanes of identical geometry is
 * what makes them comparable at a glance; a column of differently-shaped cards
 * is not.
 *
 * ## A memory must never pass for a reading
 *
 * ADR-0070 keeps a bucket's row alive for ten minutes after its work drains, and
 * retains **only the row's existence** — a remembered-idle bucket reports true
 * zero counts and a `null` budget. So this row draws an *empty* lane, prints the
 * words **at rest**, and prints no budget figure at all. The one number it may
 * add is how long ago the bucket last settled a request, which is a duration and
 * is labelled as one. When `lastActiveAt` is `null` — the service worker was
 * evicted, and the activity a timestamp would describe did not survive it either
 * — the lane says "at rest" and nothing more. It never invents a timestamp.
 *
 * ## Colour is not the carrier
 *
 * A gated lane is hatched *and* carries a countdown in words; a low lane carries
 * a literal `low` chip; the planned share of a lane is hatched rather than
 * merely paler; and the in-flight / queued / planned magnitudes are printed on
 * the lane in words as well as drawn. Nothing here needs hue to be legible.
 *
 * Both hatches are static — there is no marching-ants animation to suppress
 * under `prefers-reduced-motion`, and no fill transition either, so the lane has
 * exactly one form.
 *
 * @see `ADR-0060` — the per-bucket state this renders.
 * @see `ADR-0070` — remembered buckets and `lastActiveAt`.
 */
import React from 'react';
import type { BucketState } from '@/shared/scheduler/types';

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

/**
 * Diagonal hatch marking a gated lane.
 *
 * Built from two existing Odyssey tokens rather than a literal, and deliberately
 * a *pattern*: a viewer who cannot separate the danger hue from the warning one
 * can still separate hatched from solid.
 */
const COOLDOWN_STRIPES =
  'repeating-linear-gradient(135deg, var(--color-danger) 0 3px, var(--color-danger-light) 3px 8px)';

/**
 * Hatch for the *planned* part of a lane — work a plan has declared but not yet
 * enqueued (ADR-0060).
 *
 * Hatched rather than tinted because every fill on this lane has to stay pale
 * enough for the badge text riding on top of it to remain legible, which leaves
 * too little tonal room to separate three solid fills. Form does the separating
 * instead, and it happens to say the right thing: hatched reads as provisional.
 */
const PLANNED_HATCH =
  'repeating-linear-gradient(135deg, var(--color-neutral-200) 0 3px, transparent 3px 6px)';

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
 * worker boundary — reads as `just now` rather than as a negative age.
 * @returns A label such as `2m ago`.
 */
export function sinceLabel(ms: number): string {
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
 * Whether a bucket is under enough strain to deserve a lane of its own.
 *
 * A bucket earns one by being gated, by having work against it, or by sitting at
 * or below the org's warning threshold.
 */
export function isStrained(bucket: BucketState, lowThresholdPercent: number): boolean {
  if (bucket.gatedUntil !== null) return true;
  if (bucket.queued > 0 || bucket.active > 0 || bucket.planned > 0) return true;
  const percent = headroomPercent(bucket);
  return percent !== null && percent <= lowThresholdPercent;
}

/**
 * Whether a bucket earns a lane in the rack.
 *
 * Strain earns one, and so does **recent use**: ADR-0070 keeps a bucket's row
 * alive for ten minutes after its queue drains precisely so a family the user
 * just watched work does not vanish from under them the instant it finishes.
 * Gating the rack on strain alone would throw that away — a bucket stops being
 * strained on its last settle, which is the exact moment the memory exists to
 * cover.
 *
 * A bucket that has never settled a request in this worker's lifetime and is
 * doing nothing now still collapses into the summary line, so the rack lists
 * what has actually been exercised rather than everything the scheduler is aware
 * of.
 */
export function deservesTrack(bucket: BucketState, lowThresholdPercent: number): boolean {
  return isStrained(bucket, lowThresholdPercent) || bucket.lastActiveAt !== null;
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
  const atRest = work === 0 && !gated;

  // Lane fill. Deliberately zero-width for a remembered-idle bucket: an empty
  // lane is the honest picture of true zero counts, not a missing reading.
  const share = (n: number) => (work > 0 ? `${(n / work) * 100}%` : '0%');

  const budget =
    bucket.limit === null || bucket.remaining === null
      ? // Never "0/0", and never a resurrected figure: a bucket whose window has
        // expired reads exactly like one Okta has never spoken about.
        'not reported'
      : `${bucket.remaining}/${bucket.limit}`;

  const lastActive =
    atRest && bucket.lastActiveAt !== null ? sinceLabel(now - bucket.lastActiveAt) : null;

  return (
    <div
      data-testid={`activity-bucket-${bucket.bucket}`}
      data-low={low ? 'true' : undefined}
      data-gated={gated ? 'true' : undefined}
      data-state={gated ? 'gated' : atRest ? 'at-rest' : 'working'}
      className="flex items-center gap-(--sp-inline) px-(--sp-gutter) py-0.5"
    >
      <span className="w-20 shrink-0 truncate text-xs font-medium text-neutral-900">
        {bucketLabel(bucket.bucket)}
      </span>

      <div
        className={`relative h-6 min-w-0 flex-1 overflow-hidden rounded-md ${
          atRest ? 'bg-neutral-50' : 'bg-white ring-1 ring-neutral-200 ring-inset'
        }`}
      >
        {gated ? (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ backgroundImage: COOLDOWN_STRIPES }}
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-y-0 left-0 flex w-full">
            <div
              className="h-full"
              style={{ width: share(bucket.active), backgroundColor: 'var(--color-info-light)' }}
            />
            <div
              className="h-full"
              style={{ width: share(bucket.queued), backgroundColor: 'var(--color-neutral-200)' }}
            />
            <div
              className="h-full"
              style={{ width: share(bucket.planned), backgroundImage: PLANNED_HATCH }}
            />
          </div>
        )}

        {/* Badges ride on the lane rather than beside it, so every family keeps
            the same geometry and the rack stays scannable down its columns. */}
        <div className="absolute inset-0 flex items-center gap-1.5 px-1.5 text-xs">
          {gated ? (
            <span
              data-testid={`activity-bucket-cooldown-${bucket.bucket}`}
              className="shrink-0 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-danger-text"
            >
              {countdown(gatedFor)}
            </span>
          ) : atRest ? (
            <span className="min-w-0 truncate text-neutral-600">
              at rest{lastActive ? ` · last active ${lastActive}` : ''}
            </span>
          ) : (
            <span className="min-w-0 truncate text-neutral-600">
              {bucket.active} in flight
              {bucket.queued > 0 ? ` · ${bucket.queued} queued` : ''}
              {bucket.planned > 0 ? ` · ${bucket.planned} planned` : ''}
            </span>
          )}

          <span
            className={`ms-auto shrink-0 tabular-nums ${low ? 'text-danger-text' : 'text-neutral-600'}`}
          >
            {budget}
          </span>
          {low && (
            <span className="shrink-0 rounded-md bg-danger-light px-2 py-0.5 text-xs font-medium text-danger-text">
              low
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BucketRow;
