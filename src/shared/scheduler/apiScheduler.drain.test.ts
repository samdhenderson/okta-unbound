/**
 * Tests for event-driven queue draining.
 *
 * The scheduler must not be limited to one dispatch per 50ms tick: scheduling a
 * request kicks the drain directly (the interval is only a fallback), and a
 * drain fills every free `maxConcurrent` slot in one pass. The rate-limit gates
 * (cooldown / approaching-limit) are re-evaluated per dispatch so an event-driven
 * drain can never blow past them.
 *
 * All cases run under fake timers: nothing here may depend on the 50ms interval
 * actually ticking. The schedule-time drain is deferred by one microtask (so a
 * synchronous burst is priority-ordered before dispatch), hence the
 * `Promise.resolve()` flushes before asserting.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiScheduler } from './apiScheduler';

let scheduler: ApiScheduler;
const sendMessage = vi.fn();

/** Count of actual content-script fetches issued (`makeApiRequest`). */
function apiCallCount(): number {
  return sendMessage.mock.calls.filter((c) => c[1]?.action === 'makeApiRequest').length;
}

/** Okta rate-limit headers with `remaining` of `limit` left, resetting in 60s. */
function rateLimitHeaders(remaining: number, limit = 100): Record<string, string> {
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

describe('ApiScheduler event-driven drain', () => {
  it('dispatches maxConcurrent queued requests in one drain, not one per 50ms tick', async () => {
    // Hold every request in flight so the five dispatches are all observable.
    sendMessage.mockImplementation(() => new Promise(() => {}));
    scheduler = new ApiScheduler({ maxConcurrent: 5 });

    for (let i = 0; i < 5; i++) {
      void scheduler.scheduleRequest(`/api/v1/users/u${i}`, 'GET', undefined, 1).catch(() => {});
    }

    // Flush microtasks only — the timers never advance, so under the old
    // one-dispatch-per-tick loop at most one request could have gone out.
    await Promise.resolve();

    expect(apiCallCount()).toBe(5);
    expect(scheduler.getState().activeRequests).toBe(5);
    expect(scheduler.getState().queueLength).toBe(0);
  });

  it('dispatches a request scheduled while idle without waiting for the 50ms interval', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();

    const result = scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1);
    await Promise.resolve();

    // Dispatched purely event-driven — no timer was ever advanced.
    expect(apiCallCount()).toBe(1);
    await expect(result).resolves.toMatchObject({ success: true, data: 'ok' });
  });

  it('does not drain past the cooldown / approaching-limit gates', async () => {
    // Every response reports 5% remaining → cooldown arms after the first settle.
    sendMessage.mockResolvedValue({ success: true, data: 'ok', headers: rateLimitHeaders(5) });
    scheduler = new ApiScheduler({ maxRetries: 0 });

    await scheduler.scheduleRequest('/prime', 'GET', undefined, 1, 'high');
    expect(scheduler.getState().cooldownEndsAt).toBeTruthy();

    // Two more requests: the event-driven drain must hold them at the gate.
    void scheduler.scheduleRequest('/a', 'GET', undefined, 1).catch(() => {});
    void scheduler.scheduleRequest('/b', 'GET', undefined, 1).catch(() => {});
    await Promise.resolve();
    expect(apiCallCount()).toBe(1);

    // Several fallback ticks later (still well inside the 30s cooldown) the
    // queue has not drained past the gate.
    await vi.advanceTimersByTimeAsync(500);
    expect(apiCallCount()).toBe(1);
    expect(scheduler.getState().queueLength).toBe(2);
  });
});

describe('ApiScheduler idle interval stop', () => {
  it('stops the fallback interval once the queue fully drains, and restarts on schedule', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();

    await scheduler.scheduleRequest('/api/v1/users/u1', 'GET', undefined, 1);

    // Fully idle (queue empty, nothing in flight, no cooldown): the interval
    // and the per-request timeout are both cleared, so no timers remain.
    expect(scheduler.getState().status).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);

    // Scheduling again restarts processing: the request dispatches and settles.
    const second = await scheduler.scheduleRequest('/api/v1/users/u2', 'GET', undefined, 1);
    expect(second.data).toBe('ok');
    expect(apiCallCount()).toBe(2);
  });

  it('still drains queued work after pause/resume', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();

    scheduler.pause();
    const parked = scheduler.scheduleRequest('/api/v1/users/u1', 'GET', undefined, 1);
    await Promise.resolve();
    expect(apiCallCount()).toBe(0); // parked while paused

    scheduler.resume();
    await expect(parked).resolves.toMatchObject({ success: true, data: 'ok' });
    expect(apiCallCount()).toBe(1);
  });
});
