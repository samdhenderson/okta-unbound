/**
 * Tests for ApiScheduler.clearQueue cancellation semantics.
 *
 * "Cancel" must actually stop pending work: clearing the queue has to REJECT every
 * dropped request (and every caller coalesced onto it) with OperationCancelledError
 * so the awaiting operation loops unwind, rather than silently dropping the queue
 * and leaving callers hanging while the driver keeps enqueuing the next request.
 *
 * The scheduler is paused before scheduling so requests sit in the queue (never
 * dispatched) and we can assert on the queued → rejected transition deterministically.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiScheduler } from './apiScheduler';
import { OperationCancelledError } from './cancellation';

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

describe('ApiScheduler.clearQueue cancellation', () => {
  it('rejects every queued request with OperationCancelledError', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();
    scheduler.pause(); // keep requests parked in the queue

    const p1 = scheduler.scheduleRequest('/api/v1/groups/a', 'DELETE', undefined, 1);
    const p2 = scheduler.scheduleRequest('/api/v1/groups/b', 'DELETE', undefined, 1);

    scheduler.clearQueue();

    await expect(p1).rejects.toBeInstanceOf(OperationCancelledError);
    await expect(p2).rejects.toBeInstanceOf(OperationCancelledError);
    // Nothing was ever dispatched to the content script.
    expect(apiCallCount()).toBe(0);
  });

  it('rejects coalesced waiters too, not just the leader', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();
    scheduler.pause();

    const leader = scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1);
    const waiter = scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1);

    scheduler.clearQueue();

    await expect(leader).rejects.toBeInstanceOf(OperationCancelledError);
    await expect(waiter).rejects.toBeInstanceOf(OperationCancelledError);
  });

  it('empties the queue and clears coalescing so a later identical GET re-fetches', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();
    scheduler.pause();

    const dropped = scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1);
    scheduler.clearQueue();
    await expect(dropped).rejects.toBeInstanceOf(OperationCancelledError);

    expect(scheduler.getState().queueLength).toBe(0);

    // A fresh identical GET after the clear must not be coalesced onto the dropped
    // leader — it should issue its own fetch and resolve normally.
    scheduler.resume();
    const fresh = await scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1);
    expect(fresh.data).toBe('ok');
    expect(apiCallCount()).toBe(1);
  });

  it('returns the number of requests it dropped', async () => {
    sendMessage.mockResolvedValue({ success: true });
    scheduler = new ApiScheduler();
    scheduler.pause();

    const a = scheduler.scheduleRequest('/api/v1/groups/a', 'DELETE', undefined, 1);
    const b = scheduler.scheduleRequest('/api/v1/groups/b', 'DELETE', undefined, 1);
    const c = scheduler.scheduleRequest('/api/v1/groups/c', 'DELETE', undefined, 1);

    expect(scheduler.clearQueue()).toBe(3);

    await expect(Promise.allSettled([a, b, c])).resolves.toHaveLength(3);
  });

  it('rejects a request that is sleeping in retry backoff, without re-dispatching it', async () => {
    // First dispatch fails (network error) → the request enters retry backoff,
    // parked in activeRequests (not the queue). A Cancel during that window must
    // stop it: the promise rejects and it never re-hits the content script.
    let call = 0;
    sendMessage.mockImplementation(async () => {
      call++;
      if (call === 1) throw new Error('net down');
      return { success: true, data: 'ok' };
    });
    scheduler = new ApiScheduler({ retryDelay: 200, maxRetries: 2 });

    const p = scheduler.scheduleRequest('/api/v1/groups/a', 'GET', undefined, 1);

    // Wait past the first dispatch+failure so the request is mid-backoff.
    await new Promise((r) => setTimeout(r, 120));
    expect(apiCallCount()).toBe(1);

    scheduler.clearQueue();

    await expect(p).rejects.toBeInstanceOf(OperationCancelledError);
    // The retry never fired — no second fetch after the Cancel.
    await new Promise((r) => setTimeout(r, 250));
    expect(apiCallCount()).toBe(1);
    expect(scheduler.getMetrics().failedRequests).toBe(0);
  });

  it('does not count cancelled requests as failures in metrics', async () => {
    sendMessage.mockResolvedValue({ success: true });
    scheduler = new ApiScheduler();
    scheduler.pause();

    const p = scheduler.scheduleRequest('/api/v1/groups/a', 'DELETE', undefined, 1);
    scheduler.clearQueue();
    await expect(p).rejects.toBeInstanceOf(OperationCancelledError);

    expect(scheduler.getMetrics().failedRequests).toBe(0);
  });
});
