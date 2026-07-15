/**
 * Tests for ApiScheduler's in-flight GET coalescing.
 *
 * Identical GETs that are queued/in-flight at the same time must share a single
 * content-script fetch; mutations (PUT/POST/DELETE) must never be coalesced. The
 * scheduler dispatches via `chrome.tabs.sendMessage` and runs a 50ms processing
 * loop, so tests await the returned promises under real timers.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiScheduler } from './apiScheduler';

let scheduler: ApiScheduler;
const sendMessage = vi.fn();

/** Count of actual content-script fetches issued (`makeApiRequest`). */
function apiCallCount(): number {
  return sendMessage.mock.calls.filter((c) => c[1]?.action === 'makeApiRequest').length;
}

beforeEach(() => {
  vi.clearAllMocks();
  (chrome as unknown as { tabs: { sendMessage: typeof sendMessage } }).tabs = {
    sendMessage,
  };
});

afterEach(() => {
  scheduler?.stop();
});

describe('ApiScheduler GET coalescing', () => {
  it('coalesces two concurrent identical GETs into a single fetch', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();

    const [a, b] = await Promise.all([
      scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1),
      scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1),
    ]);

    expect(a.data).toBe('ok');
    expect(b.data).toBe('ok');
    expect(apiCallCount()).toBe(1);
    expect(scheduler.getMetrics().coalescedRequests).toBe(1);
  });

  it('does not coalesce distinct endpoints', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();

    await Promise.all([
      scheduler.scheduleRequest('/api/v1/users/u1', 'GET', undefined, 1),
      scheduler.scheduleRequest('/api/v1/users/u2', 'GET', undefined, 1),
    ]);

    expect(apiCallCount()).toBe(2);
  });

  it('does not coalesce non-GET (mutating) requests', async () => {
    sendMessage.mockResolvedValue({ success: true });
    scheduler = new ApiScheduler();

    await Promise.all([
      scheduler.scheduleRequest('/api/v1/groups/g/users/u', 'PUT', undefined, 1),
      scheduler.scheduleRequest('/api/v1/groups/g/users/u', 'PUT', undefined, 1),
    ]);

    expect(apiCallCount()).toBe(2);
  });

  it('rejects every coalesced caller when the shared GET fails', async () => {
    sendMessage.mockRejectedValue(new Error('net down'));
    scheduler = new ApiScheduler({ maxRetries: 0 });

    const results = await Promise.allSettled([
      scheduler.scheduleRequest('/x', 'GET', undefined, 1),
      scheduler.scheduleRequest('/x', 'GET', undefined, 1),
    ]);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect(apiCallCount()).toBe(1);
  });

  it('does not coalesce a GET issued after the first already settled', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();

    await scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1);
    await scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1);

    // Sequential (not concurrent) — each is its own fetch; coalescing only merges
    // requests that overlap in flight.
    expect(apiCallCount()).toBe(2);
    expect(scheduler.getMetrics().coalescedRequests).toBe(0);
  });
});
