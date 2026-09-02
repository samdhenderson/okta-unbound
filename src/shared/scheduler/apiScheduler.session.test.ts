/**
 * Tests for the two statuses the scheduler must stop treating as ordinary
 * results: **401** (the session is gone — `D-007b`, ADR-0054) and **429** (the
 * session is fine and Okta is asking us to slow down — `D-007c`).
 *
 * They are tested together because the interesting property is the *contrast*:
 * a 429 is retried with backoff, and a 401 is never retried, because retrying an
 * expired session is only a slower way to fail.
 *
 * All cases run under fake timers; retry backoff is advanced explicitly.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiScheduler } from './apiScheduler';

let scheduler: ApiScheduler;
const sendMessage = vi.fn();

/** Count of actual content-script fetches issued (`makeApiRequest`). */
function apiCallCount(): number {
  return sendMessage.mock.calls.filter((c) => c[1]?.action === 'makeApiRequest').length;
}

/** Let every pending microtask and timer up to `ms` settle. */
async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
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

describe('ApiScheduler · a 429 is retried (D-007c)', () => {
  it('routes a resolved 429 into retry backoff instead of the success path', async () => {
    sendMessage.mockResolvedValue({ success: false, status: 429, error: 'Too many requests' });
    scheduler = new ApiScheduler({ maxRetries: 2, retryDelay: 1000 });

    const settled = scheduler.scheduleRequest('/api/v1/users', 'GET', undefined, 1);
    await settle();
    expect(apiCallCount()).toBe(1);

    // Backoff is 1000ms then 2000ms; nothing goes out before the first elapses.
    await settle(999);
    expect(apiCallCount()).toBe(1);
    await settle(3500);

    const result = await settled;
    expect(result.success).toBe(false);
    // Initial attempt + two retries, then the failure is finally reported.
    expect(apiCallCount()).toBe(3);
    expect(scheduler.getMetrics().retriedRequests).toBe(2);
    // A resolved failure is a failure. It used to land in `successfulRequests`
    // purely because it arrived resolved rather than thrown (`D-007c`).
    expect(scheduler.getMetrics().successfulRequests).toBe(0);
    expect(scheduler.getMetrics().failedRequests).toBe(1);
  });

  it('stops retrying as soon as the 429 clears, and counts that as the success', async () => {
    sendMessage
      .mockResolvedValueOnce({ success: false, status: 429, error: 'Too many requests' })
      .mockResolvedValue({ success: true, data: { ok: true } });
    scheduler = new ApiScheduler({ maxRetries: 2, retryDelay: 1000 });

    const settled = scheduler.scheduleRequest('/api/v1/users', 'GET', undefined, 1);
    await settle(1500);

    await expect(settled).resolves.toMatchObject({ success: true });
    expect(apiCallCount()).toBe(2);
    expect(scheduler.getMetrics().successfulRequests).toBe(1);
    expect(scheduler.getMetrics().failedRequests).toBe(0);
  });

  it('does not revive a retrying request when the queue is cleared mid-backoff', async () => {
    sendMessage.mockResolvedValue({ success: false, status: 429, error: 'Too many requests' });
    scheduler = new ApiScheduler({ maxRetries: 2, retryDelay: 1000 });

    const settled = scheduler.scheduleRequest('/api/v1/users', 'GET', undefined, 1);
    const rejected = settled.catch((e: Error) => e.name);
    await settle();
    // Cancel while the retry sleeps: `cancelGeneration` must still be honoured
    // on this new route into `retryRequest`, exactly as on the transport-throw
    // route it already covered.
    scheduler.clearQueue();
    await settle(5000);

    await expect(rejected).resolves.toBe('OperationCancelledError');
    expect(apiCallCount()).toBe(1);
  });

  it('never retries a status that is not retryable', async () => {
    sendMessage.mockResolvedValue({ success: false, status: 404, error: 'Not found' });
    scheduler = new ApiScheduler({ maxRetries: 2, retryDelay: 1000 });

    const result = await scheduler.scheduleRequest('/api/v1/users/u1', 'GET', undefined, 1);
    await settle(10_000);

    expect(result).toMatchObject({ success: false, status: 404 });
    expect(apiCallCount()).toBe(1);
    expect(scheduler.getMetrics().successfulRequests).toBe(0);
  });
});

describe('ApiScheduler · a 401 suspends the session (D-007b)', () => {
  it('settles the rest of the queue against the first 401 instead of sending it', async () => {
    sendMessage.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' });
    scheduler = new ApiScheduler({ maxConcurrent: 5, maxRetries: 2, retryDelay: 1000 });

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        scheduler.scheduleRequest(`/api/v1/users/u${i}`, 'GET', undefined, 1),
      ),
    );
    await settle(10_000);

    // Every caller is answered, and answered with the session's own failure —
    // nobody is left hanging and nobody sees a different, generic error.
    expect(results).toHaveLength(12);
    for (const result of results) {
      expect(result).toMatchObject({ success: false, status: 401 });
    }
    // The queue is not drained into a session that cannot serve it: the first
    // concurrency window goes out, discovers the 401, and the rest is settled
    // against a fact already known.
    expect(apiCallCount()).toBeLessThanOrEqual(5);
    // And the panel is told once, by state, rather than by twelve error states.
    expect(scheduler.getState().expiredSessionTabIds).toEqual([1]);
  });

  it('never retries a 401 — an expired session is not a transient failure', async () => {
    sendMessage.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' });
    scheduler = new ApiScheduler({ maxConcurrent: 1, maxRetries: 2, retryDelay: 1000 });

    await scheduler.scheduleRequest('/api/v1/users/u1', 'GET', undefined, 1);
    await settle(10_000);

    expect(apiCallCount()).toBe(1);
    expect(scheduler.getMetrics().retriedRequests).toBe(0);
  });

  it('holds one tab without touching another tab’s session', async () => {
    sendMessage.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' });
    scheduler = new ApiScheduler({ maxConcurrent: 1 });
    await scheduler.scheduleRequest('/api/v1/users/u1', 'GET', undefined, 1);
    await settle();

    sendMessage.mockResolvedValue({ success: true, data: { id: 'u2' } });
    const other = await scheduler.scheduleRequest('/api/v1/users/u2', 'GET', undefined, 2);
    await settle();

    expect(other).toMatchObject({ success: true });
    expect(scheduler.getState().expiredSessionTabIds).toEqual([1]);
  });

  it('clears the suspension and resumes once the session answers again', async () => {
    sendMessage.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' });
    scheduler = new ApiScheduler({ maxConcurrent: 1 });
    await scheduler.scheduleRequest('/api/v1/users/u1', 'GET', undefined, 1);
    await settle();
    expect(scheduler.getState().expiredSessionTabIds).toEqual([1]);

    // The admin signs back in; the next request the panel makes is the probe
    // that proves it — no polling, no timer.
    sendMessage.mockResolvedValue({ success: true, data: { id: 'u2' } });
    const probe = await scheduler.scheduleRequest('/api/v1/users/u2', 'GET', undefined, 1);
    await settle();

    expect(probe).toMatchObject({ success: true });
    expect(scheduler.getState().expiredSessionTabIds).toEqual([]);

    // And normal scheduling is back: a following request is really sent.
    const before = apiCallCount();
    await scheduler.scheduleRequest('/api/v1/users/u3', 'GET', undefined, 1);
    await settle();
    expect(apiCallCount()).toBe(before + 1);
  });

  it('lets at most one request probe a suspended session at a time', async () => {
    sendMessage.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' });
    scheduler = new ApiScheduler({ maxConcurrent: 5 });
    await scheduler.scheduleRequest('/api/v1/users/u1', 'GET', undefined, 1);
    await settle();
    const afterSuspension = apiCallCount();

    // Hold the probe in flight so the burst behind it has to be short-circuited.
    sendMessage.mockImplementation(() => new Promise(() => {}));
    void scheduler.scheduleRequest('/api/v1/users/probe', 'GET', undefined, 1).catch(() => {});
    await settle();
    const shortCircuited = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        scheduler.scheduleRequest(`/api/v1/groups/g${i}`, 'GET', undefined, 1),
      ),
    );
    await settle();

    // One probe went out; the eight behind it were settled, not sent.
    expect(apiCallCount()).toBe(afterSuspension + 1);
    for (const result of shortCircuited) {
      expect(result).toMatchObject({ success: false, status: 401 });
      // Settled with a failure of their own, not with the observed 401's body:
      // that payload describes one particular request, and handing it to a
      // caller that asked for a different endpoint would spread an unvalidated
      // Okta response (ADR-0006) across call sites that never made it.
      expect(result).not.toHaveProperty('data');
      expect(result).not.toHaveProperty('headers');
    }
  });
});
