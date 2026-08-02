/**
 * @module background/throttledRelay
 * @description Leading-edge + trailing-flush throttle for high-frequency relays.
 *
 * The background worker rebroadcasts every scheduler state change over
 * `chrome.runtime.sendMessage`. With event-driven draining the scheduler can
 * settle many requests within a few milliseconds, and relaying each change
 * individually floods the messaging channel. This helper throttles a relay to
 * one send per window while keeping it lossless where it matters:
 *
 * - the first value after a quiet period sends immediately (leading edge);
 * - values arriving inside the window coalesce — only the latest is sent by a
 *   trailing flush when the window closes;
 * - a value the caller marks *urgent* (e.g. a status transition) always sends
 *   immediately, restarting the window.
 */

/** Options for {@link createThrottledRelay}. */
export interface ThrottledRelayOptions<T> {
  /** Throttle window in milliseconds. Defaults to 150. */
  intervalMs?: number;
  /**
   * Marks `next` as urgent relative to `previous` (the last value actually
   * sent): urgent values flush immediately even mid-window. Typical use:
   * detect a status transition while letting volume-only changes coalesce.
   */
  isUrgent?: (previous: T, next: T) => boolean;
}

const DEFAULT_INTERVAL_MS = 150;

/**
 * Build a throttled relay around `send`.
 *
 * @param send - The underlying delivery function (e.g. a `chrome.runtime.sendMessage` wrapper).
 * @param options - See {@link ThrottledRelayOptions}.
 * @returns A function accepting values to relay; safe to call at any frequency.
 */
export function createThrottledRelay<T>(
  send: (value: T) => void,
  options: ThrottledRelayOptions<T> = {},
): (value: T) => void {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  let lastSent: T | undefined;
  let hasSent = false;
  let pending: T | undefined;
  let hasPending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const doSend = (value: T): void => {
    lastSent = value;
    hasSent = true;
    pending = undefined;
    hasPending = false;
    send(value);
    // (Re)open the throttle window; its close triggers the trailing flush.
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(onWindowClosed, intervalMs);
  };

  const onWindowClosed = (): void => {
    timer = null;
    if (hasPending) {
      // Trailing flush: deliver the latest coalesced value (which re-opens a
      // window, so a steady stream settles into one send per interval).
      doSend(pending as T);
    }
  };

  return (value: T): void => {
    // Leading edge: nothing sent yet, or the previous window has closed.
    if (!hasSent || timer === null) {
      doSend(value);
      return;
    }
    // Urgent mid-window value (e.g. a status change): flush immediately.
    if (options.isUrgent?.(lastSent as T, value)) {
      doSend(value);
      return;
    }
    // Volume-only change inside the window: coalesce for the trailing flush.
    pending = value;
    hasPending = true;
  };
}
