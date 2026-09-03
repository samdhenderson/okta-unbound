/**
 * @module sidepanel/hooks/activityEta
 * @description The activity bar's time-remaining estimate, as a **range** rather
 * than a point.
 *
 * The bar used to divide elapsed time by items done, multiply by the total, and
 * print one number. That number ignores every gate the scheduler has already
 * armed, so an operation that is about to sit out a ninety-second cooldown was
 * told "~20s left" — a claim the user catches falsifying itself within seconds,
 * after which they stop believing the bar at all.
 *
 * So the estimate says what it knows and admits what it does not:
 *
 * - **Throughput sets the floor.** The observed per-item cost extrapolated over
 *   the items left is the *best* case: no gate blocks any of the remainder.
 * - **Known cooldowns widen the ceiling.** Gates are served concurrently, so the
 *   ceiling adds the *longest* armed gate, never the sum — summing would
 *   overstate a delay that elapses in parallel.
 * - **Too few samples is not "fast".** Under {@link MIN_SAMPLES} settled items
 *   there is no throughput to extrapolate, and the estimate reports
 *   {@link EtaUnknown} rather than an optimistic number.
 */

/**
 * Settled items required before throughput is extrapolated at all.
 *
 * Below this the sample is one or two round-trips, whose variance swamps the
 * signal — an early fast pair would promise a finish time the rest of the run
 * cannot keep.
 */
export const MIN_SAMPLES = 3;

/** The estimate has no throughput sample yet and declines to guess. */
export interface EtaUnknown {
  kind: 'unknown';
  /** Words, deliberately not a number — see the module description. */
  label: string;
}

/** Throughput is known and no gate is armed, so the bounds coincide. */
export interface EtaPoint {
  kind: 'point';
  /** Best-case milliseconds remaining. */
  lowerMs: number;
  /** Display label, e.g. `~1:20 left`. */
  label: string;
}

/** Throughput is known and an armed gate widens the upper bound. */
export interface EtaRange {
  kind: 'range';
  /** Best case: the remaining work meets no gate. */
  lowerMs: number;
  /** Worst case the scheduler can already see: best case plus the longest armed gate. */
  upperMs: number;
  /** Display label, e.g. `1:20–2:50 left`. */
  label: string;
}

/**
 * What the bar knows about the time left, in a form that can never render an
 * unknown as an optimistic number.
 */
export type EtaEstimate = EtaUnknown | EtaPoint | EtaRange;

/** Format seconds as `m:ss`. */
export function clock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Format milliseconds as a coarse `Xm Ys` / `Xs` cooldown label. */
export function cooldownClock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * The widest gate the scheduler currently has armed, as a duration from `now`.
 *
 * `max`, never `sum`: gates elapse concurrently, so the work resumes when the
 * last of them lifts. Summing them would overstate a delay that is already
 * running in parallel, which is the mirror image of the point estimate's error
 * and no more honest.
 *
 * @param gatedUntil - Each bucket's gate deadline in epoch milliseconds, `null`
 * when that bucket is not gated.
 * @param globalCooldownMs - Milliseconds left on the scheduler-wide cooldown.
 * @param now - Current time in epoch milliseconds.
 * @returns A non-negative duration in milliseconds; `0` when nothing is gated.
 */
export function longestArmedGateMs(
  gatedUntil: readonly (number | null)[],
  globalCooldownMs: number,
  now: number,
): number {
  return gatedUntil.reduce<number>(
    (widest, deadline) => Math.max(widest, deadline === null ? 0 : deadline - now),
    Math.max(0, globalCooldownMs),
  );
}

/** Inputs to {@link estimateEta}. All times in milliseconds. */
export interface EtaInput {
  /** Items settled so far in the running operation. */
  done: number;
  /** Items the operation declared in total. */
  total: number;
  /** Wall-clock elapsed since the operation started. */
  elapsedMs: number;
  /**
   * The longest gate the scheduler currently has armed, as a duration from now.
   * Zero when nothing is gated. Callers pass a duration rather than a deadline
   * so the estimate stays a pure function of its inputs.
   */
  longestGateMs: number;
}

/**
 * Estimate the time remaining in an operation as a range.
 *
 * @param input - See {@link EtaInput}.
 * @returns An {@link EtaEstimate}. The `unknown` form is returned whenever
 * throughput cannot be measured, and it carries words rather than a number so it
 * is never mistaken for a fast finish.
 *
 * @example
 * estimateEta({ done: 10, total: 20, elapsedMs: 20_000, longestGateMs: 0 });
 * // => { kind: 'point', lowerMs: 20_000, label: '~0:20 left' }
 */
export function estimateEta(input: EtaInput): EtaEstimate {
  const { done, total, elapsedMs, longestGateMs } = input;
  const left = Math.max(0, total - done);

  if (done < MIN_SAMPLES || elapsedMs <= 0 || left === 0) {
    return { kind: 'unknown', label: 'estimating…' };
  }

  const lowerMs = Math.round((elapsedMs / done) * left);
  if (lowerMs <= 0) return { kind: 'unknown', label: 'estimating…' };

  const gate = Math.max(0, Math.round(longestGateMs));
  if (gate === 0) {
    return { kind: 'point', lowerMs, label: `~${clock(Math.round(lowerMs / 1000))} left` };
  }

  const upperMs = lowerMs + gate;
  return {
    kind: 'range',
    lowerMs,
    upperMs,
    label: `${clock(Math.round(lowerMs / 1000))}–${clock(Math.round(upperMs / 1000))} left`,
  };
}
