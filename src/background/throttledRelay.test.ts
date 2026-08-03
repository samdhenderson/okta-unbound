/**
 * Tests for createThrottledRelay — the leading-edge + trailing-flush throttle
 * used to rate-limit `schedulerStateChanged` rebroadcasts.
 *
 * Contract: first value after a quiet period sends immediately; values inside
 * the window coalesce into one trailing flush carrying only the latest value;
 * an urgent value (per `isUrgent`, e.g. a status transition) flushes
 * immediately even mid-window.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createThrottledRelay } from './throttledRelay';

interface Snapshot {
  status: string;
  queueLength: number;
}

const send = vi.fn<(value: Snapshot) => void>();

function makeRelay(intervalMs = 150) {
  return createThrottledRelay<Snapshot>(send, {
    intervalMs,
    isUrgent: (previous, next) => previous.status !== next.status,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  send.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createThrottledRelay', () => {
  it('sends the first value immediately (leading edge)', () => {
    const relay = makeRelay();
    relay({ status: 'idle', queueLength: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ status: 'idle', queueLength: 0 });
  });

  it('coalesces volume-only changes inside the window into one trailing flush of the latest value', () => {
    const relay = makeRelay();
    relay({ status: 'processing', queueLength: 10 });
    relay({ status: 'processing', queueLength: 9 });
    relay({ status: 'processing', queueLength: 8 });
    relay({ status: 'processing', queueLength: 7 });

    // Only the leading send so far.
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(150);

    // Trailing flush delivers the latest coalesced value, nothing in between.
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ status: 'processing', queueLength: 7 });
  });

  it('flushes a status change immediately, even mid-window', () => {
    const relay = makeRelay();
    relay({ status: 'processing', queueLength: 5 });
    relay({ status: 'processing', queueLength: 4 }); // coalesces
    relay({ status: 'cooldown', queueLength: 4 }); // status change → urgent

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ status: 'cooldown', queueLength: 4 });

    // The superseded volume-only value is dropped — no stale trailing flush.
    vi.advanceTimersByTime(300);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('re-arms the leading edge once the window closes quietly', () => {
    const relay = makeRelay();
    relay({ status: 'processing', queueLength: 5 });
    vi.advanceTimersByTime(150); // window closes with nothing pending

    relay({ status: 'processing', queueLength: 4 });
    // Same status (not urgent) — still sent immediately as a fresh leading edge.
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ status: 'processing', queueLength: 4 });
  });

  it('settles a steady stream into one send per window', () => {
    const relay = makeRelay();
    // 10 windows' worth of updates every 10ms.
    for (let t = 0; t < 300; t += 10) {
      relay({ status: 'processing', queueLength: 300 - t });
      vi.advanceTimersByTime(10);
    }
    // Leading send + one trailing flush per 150ms window (each flush re-opens
    // the window): 1 at t=0, then t=150, then t=300-worth pending. Well under
    // the 30 raw updates.
    expect(send.mock.calls.length).toBeLessThanOrEqual(3);
    expect(send.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
