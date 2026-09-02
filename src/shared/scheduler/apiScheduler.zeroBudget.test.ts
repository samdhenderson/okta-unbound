/**
 * Tests for `D-094`: a rate-limit budget of `0` must not read as spare capacity.
 *
 * `D-086` guards the *parse* — a header that is not a finite number is not
 * recorded. `X-Rate-Limit-Limit: 0` parses finitely and is recorded, and the
 * fail-open then happens one step later, at the **division**: `(n / 0) * 100` is
 * `Infinity` or `NaN`, and neither is `<= threshold`. `ApiScheduler` computes
 * that ratio independently of `RateLimitDetector`, so it needs its own guard;
 * this file pins the scheduler's half (the detector's is in
 * `rateLimitDetector.test.ts`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiScheduler } from './apiScheduler';

let scheduler: ApiScheduler;
const sendMessage = vi.fn();

/** Okta rate-limit headers, resetting 60s from now. */
function rateLimitHeaders(remaining: number, limit: number): Record<string, string> {
  return {
    'x-rate-limit-limit': String(limit),
    'x-rate-limit-remaining': String(remaining),
    'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 60),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  (chrome as unknown as { tabs: { sendMessage: typeof sendMessage } }).tabs = {
    sendMessage,
  };
});

afterEach(() => {
  scheduler?.stop();
  vi.useRealTimers();
});

describe('ApiScheduler.shouldEnterCooldown with a zero budget', () => {
  it('does not treat a zero-limit response as headroom', async () => {
    scheduler = new ApiScheduler({ maxConcurrent: 5, minRemainingThreshold: 10 });

    // A readable, genuinely low budget somewhere: 5 of 100 left on apps.
    sendMessage.mockResolvedValue({ success: true, data: {}, headers: rateLimitHeaders(5, 100) });
    await scheduler.scheduleRequest('/api/v1/apps', 'GET', undefined, 1);
    await vi.advanceTimersByTimeAsync(0);

    // Now a groups response quoting a budget of zero. Sent `interactive` so the
    // soft gate the apps observation armed does not hold it back — the point
    // under test is what its *own* response does, not whether it dispatches.
    sendMessage.mockResolvedValue({ success: true, data: {}, headers: rateLimitHeaders(0, 0) });
    await scheduler.scheduleRequest('/api/v1/groups', 'GET', undefined, 1, 'interactive');
    await vi.advanceTimersByTimeAsync(0);

    const groups = scheduler.getState().buckets.find((b) => b.bucket === '/api/v1/groups');
    // The zero budget is unknown, so the scheduler falls back to the
    // most-restrictive usable observation (apps, under 10%) and gates groups
    // rather than reading the division's NaN as headroom.
    expect(groups?.gatedUntil).toEqual(expect.any(Number));
  });
});
