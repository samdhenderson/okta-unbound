/**
 * Tests for the per-bucket concurrency cap and for remembered buckets
 * (ADR-0070).
 *
 * ADR-0059 split the rate-limit *gate* by Okta bucket but left the *slots*
 * global, so five in-flight requests to one family occupied every seat the
 * extension had and a request to a family with a full budget waited — not
 * because Okta would refuse it, but because the scheduler had run out of seats.
 * `maxConcurrentPerBucket` is the seat limit that fixes it; `maxConcurrent`
 * keeps its name and its meaning as the global ceiling.
 *
 * The second half pins the memory. A bucket used to stop being reported once
 * its queue, its plan and its header observation had all gone quiet — on three
 * unrelated clocks. It is now retained for a bounded time, and what is retained
 * is **the row's existence, never a number**: a remembered-but-idle bucket
 * reports true zeros and a `null` budget, exactly like a bucket Okta has never
 * spoken about.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiScheduler } from './apiScheduler';
import type { BucketState } from './types';

let scheduler: ApiScheduler;
const sendMessage = vi.fn();

/** Endpoints dispatched to the content script, in order. */
function dispatchedEndpoints(): string[] {
  return sendMessage.mock.calls
    .filter((c) => c[1]?.action === 'makeApiRequest')
    .map((c) => c[1].endpoint as string);
}

/** Okta rate-limit headers with `remaining` of `limit` left, resetting in 60s. */
function rateLimitHeaders(remaining: number, limit = 100): Record<string, string> {
  return {
    'x-rate-limit-limit': String(limit),
    'x-rate-limit-remaining': String(remaining),
    'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 60),
  };
}

/** The scheduler's own view of one bucket, or `undefined` when it lists none. */
function bucketState(bucket: string): BucketState | undefined {
  return scheduler.getState().buckets.find((state) => state.bucket === bucket);
}

/** How many in-flight requests the scheduler attributes to a bucket. */
function activeIn(bucket: string): number {
  return bucketState(bucket)?.active ?? 0;
}

beforeEach(() => {
  vi.clearAllMocks();
  (chrome as unknown as { tabs: { sendMessage: typeof sendMessage } }).tabs = {
    sendMessage,
  };
});

afterEach(() => {
  scheduler?.stop();
  vi.useRealTimers();
});

describe('ApiScheduler per-bucket concurrency cap', () => {
  it('holds one family to its cap while another family keeps draining', async () => {
    // Every request stays in flight, so each dispatch is observable.
    sendMessage.mockImplementation(() => new Promise(() => {}));
    scheduler = new ApiScheduler({ maxConcurrent: 10, maxConcurrentPerBucket: 4 });

    // Eight groups requests queued ahead of two users requests. Under one
    // global pool the groups fan-out would take eight of the ten seats and the
    // users lookups would take the rest; the point of the cap is that groups
    // takes four and yields the rest of its turn.
    for (let i = 0; i < 8; i++) {
      void scheduler
        .scheduleRequest(`/api/v1/groups/00gFAKE${i}/users?limit=200`, 'GET', undefined, 1)
        .catch(() => {});
    }
    for (let i = 0; i < 2; i++) {
      void scheduler
        .scheduleRequest(`/api/v1/users/00uFAKE${i}`, 'GET', undefined, 1)
        .catch(() => {});
    }
    await Promise.resolve();

    expect(activeIn('/api/v1/groups')).toBe(4);

    // Both users requests went out without waiting for the groups queue to
    // drain — they were queued *behind* four groups requests that could not run.
    expect(activeIn('/api/v1/users')).toBe(2);
    expect(dispatchedEndpoints()).toContain('/api/v1/users/00uFAKE0');
    expect(dispatchedEndpoints()).toContain('/api/v1/users/00uFAKE1');

    // Six seats used of ten: the four groups requests still queued are held by
    // their own family's cap, not by the ceiling.
    expect(scheduler.getState().activeRequests).toBe(6);
    expect(scheduler.getState().queueLength).toBe(4);
  });

  it('does not end the drain pass at a bucket that is at its cap', async () => {
    sendMessage.mockImplementation(() => new Promise(() => {}));
    scheduler = new ApiScheduler({ maxConcurrent: 6, maxConcurrentPerBucket: 4 });

    // The fifth groups request sits at index 4, ahead of the users request. A
    // pass that stopped at the first non-dispatchable request would never reach
    // the users request at all — the ADR-0059 §1 property, re-asserted against
    // the seat cap rather than against the gate.
    for (let i = 0; i < 5; i++) {
      void scheduler
        .scheduleRequest(`/api/v1/groups/00gFAKE${i}/users?limit=200`, 'GET', undefined, 1)
        .catch(() => {});
    }
    void scheduler.scheduleRequest('/api/v1/users/00uFAKE0', 'GET', undefined, 1).catch(() => {});
    await Promise.resolve();

    expect(dispatchedEndpoints()).toContain('/api/v1/users/00uFAKE0');
    expect(activeIn('/api/v1/groups')).toBe(4);
    expect(scheduler.getState().queueLength).toBe(1);
  });

  it('still binds the global ceiling above the sum of the per-bucket caps', async () => {
    sendMessage.mockImplementation(() => new Promise(() => {}));
    scheduler = new ApiScheduler({ maxConcurrent: 10, maxConcurrentPerBucket: 4 });

    // Four families, four requests each: sixteen requests wanting sixteen seats
    // that four caps alone would allow.
    for (const family of ['users', 'groups', 'apps', 'idps']) {
      for (let i = 0; i < 4; i++) {
        void scheduler
          .scheduleRequest(`/api/v1/${family}/FAKE${i}`, 'GET', undefined, 1)
          .catch(() => {});
      }
    }
    await Promise.resolve();

    expect(scheduler.getState().activeRequests).toBe(10);
    for (const family of ['users', 'groups', 'apps', 'idps']) {
      expect(activeIn(`/api/v1/${family}`)).toBeLessThanOrEqual(4);
    }

    // The fourth family is seat-limited despite being nowhere near its own cap:
    // the ceiling, not the cap, is what is holding it.
    expect(activeIn('/api/v1/idps')).toBe(0);
    expect(scheduler.getState().queueLength).toBe(6);
  });

  it('does not exempt an interactive request from the cap', async () => {
    sendMessage.mockImplementation(() => new Promise(() => {}));
    scheduler = new ApiScheduler({ maxConcurrent: 10, maxConcurrentPerBucket: 4 });

    for (let i = 0; i < 4; i++) {
      void scheduler
        .scheduleRequest(`/api/v1/groups/00gFAKE${i}/users?limit=200`, 'GET', undefined, 1)
        .catch(() => {});
    }
    await Promise.resolve();

    // A user's click into a saturated family still waits for a seat. The cap is
    // the one guarantee that no Okta family is hit harder than before, and an
    // exemption would put a hole in it (ADR-0070's open question, answered no).
    void scheduler
      .scheduleRequest('/api/v1/groups/00gFAKE9', 'GET', undefined, 1, 'interactive')
      .catch(() => {});
    await Promise.resolve();

    expect(dispatchedEndpoints()).not.toContain('/api/v1/groups/00gFAKE9');
    expect(activeIn('/api/v1/groups')).toBe(4);
  });
});

describe('ApiScheduler config validation', () => {
  it('rejects a per-bucket cap at or above the global ceiling', () => {
    // A cap that cannot bind is a config lying about what governs.
    expect(() => new ApiScheduler({ maxConcurrent: 4, maxConcurrentPerBucket: 4 })).toThrow(
      /maxConcurrentPerBucket/,
    );
    expect(() => new ApiScheduler({ maxConcurrent: 4, maxConcurrentPerBucket: 9 })).toThrow(
      /maxConcurrentPerBucket/,
    );
  });

  it('rejects a per-bucket cap of zero or less', () => {
    expect(() => new ApiScheduler({ maxConcurrentPerBucket: 0 })).toThrow(/maxConcurrentPerBucket/);
    expect(() => new ApiScheduler({ maxConcurrentPerBucket: -1 })).toThrow(
      /maxConcurrentPerBucket/,
    );
  });

  it('lets a caller who moves only the ceiling keep an unbound per-bucket cap', async () => {
    // A caller that moves the ceiling and says nothing about the cap has not
    // asked for one: the default 4 is stated relative to the default ceiling of
    // 10, so carrying it onto a ceiling of 5 would impose a cap nobody wrote —
    // and would break callers that predate the field. The cap follows the
    // ceiling instead, which is exactly the behaviour they had before it.
    sendMessage.mockImplementation(() => new Promise(() => {}));
    scheduler = new ApiScheduler({ maxConcurrent: 5 });

    for (let i = 0; i < 5; i++) {
      void scheduler
        .scheduleRequest(`/api/v1/users/00uFAKE${i}`, 'GET', undefined, 1)
        .catch(() => {});
    }
    await Promise.resolve();

    expect(activeIn('/api/v1/users')).toBe(5);
  });

  it('never lets a raised ceiling widen one bucket past what has ever shipped', async () => {
    // The companion to the case above, and the reason it is a clamp rather than
    // a follow. Tracking the ceiling upward would mean a one-line config edit —
    // raising maxConcurrent while re-tuning, which ADR-0070 explicitly invites —
    // silently seating twenty concurrent requests against a single Okta bucket:
    // four times the ADR's number and four times anything this extension has
    // ever run, with no throw and no log. The clamp holds it at the pre-field
    // ceiling of 5, so a raised ceiling buys parallelism across buckets only.
    sendMessage.mockImplementation(() => new Promise(() => {}));
    scheduler = new ApiScheduler({ maxConcurrent: 20 });

    for (let i = 0; i < 20; i++) {
      void scheduler
        .scheduleRequest(`/api/v1/users/00uFAKE${i}`, 'GET', undefined, 1)
        .catch(() => {});
    }
    await Promise.resolve();

    expect(activeIn('/api/v1/users')).toBe(5);
    expect(activeIn('/api/v1/users')).toBeLessThan(20);
  });
});

describe('ApiScheduler in-flight charging', () => {
  it('charges an observed bucket its own in-flight count, and the global backstop the total', async () => {
    // Apps answers once with a healthy budget and then hangs, so three apps
    // requests can sit in flight against a *known* family.
    let appsCalls = 0;
    sendMessage.mockImplementation(async (_tabId: number, msg: { endpoint: string }) => {
      if (msg.endpoint.startsWith('/api/v1/groups')) {
        return { success: true, data: msg.endpoint, headers: rateLimitHeaders(12) };
      }
      if (msg.endpoint.startsWith('/api/v1/apps')) {
        appsCalls++;
        if (appsCalls === 1) {
          return { success: true, data: msg.endpoint, headers: rateLimitHeaders(95) };
        }
        return new Promise(() => {});
      }
      return { success: true, data: msg.endpoint, headers: {} };
    });
    scheduler = new ApiScheduler({ maxRetries: 0 });

    // Groups sits at 12% remaining, three points above the 10% threshold.
    await scheduler.scheduleRequest('/api/v1/groups?limit=200', 'GET', undefined, 1, 'high');
    await scheduler.scheduleRequest('/api/v1/apps?limit=200', 'GET', undefined, 1, 'high');
    expect(scheduler.getState().cooldownEndsAt).toBeFalsy();

    // Three apps requests, none of which will ever settle.
    for (let i = 0; i < 3; i++) {
      void scheduler
        .scheduleRequest(`/api/v1/apps/0oaFAKE${i}/groups?limit=200`, 'GET', undefined, 1)
        .catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 100));
    expect(activeIn('/api/v1/apps')).toBe(3);

    // Groups has nothing of its own in flight, so it is judged on 12% and runs.
    // Charged the global total instead — the approximation this replaces — it
    // would read 12 - 3 = 9%, cross the threshold and cool down for traffic it
    // never carried.
    const groups = await scheduler.scheduleRequest(
      '/api/v1/groups/00gFAKE1/users?limit=200',
      'GET',
      undefined,
      1,
    );
    expect(groups.data).toBe('/api/v1/groups/00gFAKE1/users?limit=200');

    // A family Okta has said nothing about keeps the pessimistic charge: it has
    // no budget of its own to plead, and it really might be the one paying. The
    // same three in-flight requests therefore do hold it back.
    void scheduler.scheduleRequest('/api/v1/idps/FAKE1', 'GET', undefined, 1).catch(() => {});
    await new Promise((r) => setTimeout(r, 200));
    expect(dispatchedEndpoints()).not.toContain('/api/v1/idps/FAKE1');
  });
});

describe('ApiScheduler remembered buckets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /** Settle one request in `bucket`'s family, with optional rate-limit headers. */
  async function settle(endpoint: string): Promise<void> {
    await scheduler.scheduleRequest(endpoint, 'GET', undefined, 1, 'high');
  }

  it('still lists a settled bucket after its queue, plan and observation have all gone', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok', headers: rateLimitHeaders(95) });
    scheduler = new ApiScheduler({ maxRetries: 0 });

    await settle('/api/v1/groups?limit=200');
    const settledAt = Date.now();

    // Past the observation's own reset, so the detector has expired it. Before
    // this, the row simply stopped being reconstructed.
    await vi.advanceTimersByTimeAsync(120_000);

    const state = bucketState('/api/v1/groups');
    expect(state).toBeDefined();

    // True zeros from the live sources, not a retained snapshot of the work.
    expect(state?.queued).toBe(0);
    expect(state?.active).toBe(0);
    expect(state?.planned).toBe(0);

    // And no budget at all: the memory never resurrects a lapsed header
    // reading. A remembered bucket whose window has reset reads exactly like a
    // bucket Okta has never spoken about.
    expect(state?.limit).toBeNull();
    expect(state?.remaining).toBeNull();
    expect(state?.resetAt).toBeNull();

    // The one thing the memory does carry: when the bucket was last active.
    expect(state?.lastActiveAt).toBe(settledAt);
  });

  it('drops a remembered bucket once its memory has aged out', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok', headers: rateLimitHeaders(95) });
    scheduler = new ApiScheduler({ maxRetries: 0 });

    await settle('/api/v1/groups?limit=200');
    await vi.advanceTimersByTimeAsync(9 * 60 * 1000);
    expect(bucketState('/api/v1/groups')).toBeDefined();

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(bucketState('/api/v1/groups')).toBeUndefined();
  });

  it('evicts the least-recently-active bucket when a thirteenth arrives', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler({ maxRetries: 0 });

    // Twelve distinct families, oldest first.
    for (let i = 0; i < 12; i++) {
      await settle(`/api/v1/family${i}/FAKE`);
    }
    expect(scheduler.getState().buckets).toHaveLength(12);
    expect(bucketState('/api/v1/family0')).toBeDefined();

    await settle('/api/v1/family12/FAKE');

    expect(scheduler.getState().buckets).toHaveLength(12);
    expect(bucketState('/api/v1/family0')).toBeUndefined();
    expect(bucketState('/api/v1/family1')).toBeDefined();
    expect(bucketState('/api/v1/family12')).toBeDefined();
  });

  it('never evicts a bucket that still has work in flight', async () => {
    let calls = 0;
    sendMessage.mockImplementation(async () => {
      calls++;
      // The second request to the oldest family never comes back, so that
      // family has live work while twelve others settle behind it.
      if (calls === 2) return new Promise(() => {});
      return { success: true, data: 'ok' };
    });
    scheduler = new ApiScheduler({ maxRetries: 0, maxConcurrent: 20, maxConcurrentPerBucket: 4 });

    await settle('/api/v1/family0/FAKE');
    void scheduler.scheduleRequest('/api/v1/family0/BUSY', 'GET', undefined, 1).catch(() => {});
    await vi.advanceTimersByTimeAsync(100);
    expect(activeIn('/api/v1/family0')).toBe(1);

    for (let i = 1; i <= 12; i++) {
      await settle(`/api/v1/family${i}/FAKE`);
    }

    // The oldest bucket is also the busiest, so the count cap is met by
    // evicting the next *quiet* one instead. Eviction only ever removes a row
    // that already reports nothing happening.
    expect(bucketState('/api/v1/family0')?.lastActiveAt).toEqual(expect.any(Number));
    expect(bucketState('/api/v1/family0')?.active).toBe(1);
    expect(bucketState('/api/v1/family1')).toBeUndefined();
    expect(bucketState('/api/v1/family2')).toBeDefined();
    expect(scheduler.getState().buckets).toHaveLength(12);
  });

  it('never ages out the memory of a bucket whose gate is armed', async () => {
    sendMessage.mockImplementation(async (_tabId: number, msg: { endpoint: string }) => ({
      success: true,
      data: 'ok',
      // family0 comes back nearly exhausted, against a window that does not
      // reset for an hour — so its gate is still armed well past the ten-minute
      // memory. family1 comes back healthy and quiet.
      headers: msg.endpoint.startsWith('/api/v1/family0')
        ? {
            ...rateLimitHeaders(2),
            'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          }
        : rateLimitHeaders(95),
    }));
    scheduler = new ApiScheduler({ maxRetries: 0, cooldownDuration: 60 * 60 * 1000 });

    // family1 first: it primes an observation, so family0's later request is
    // not held by the global backstop family0's own low reading would set.
    await settle('/api/v1/family1/FAKE');
    await settle('/api/v1/family0/FAKE');
    expect(bucketState('/api/v1/family0')?.gatedUntil).toEqual(expect.any(Number));

    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

    // Both memories are older than BUCKET_MEMORY_MS. The quiet one is dropped;
    // the gated one is kept, because eviction may only ever remove a row that
    // already reports nothing happening.
    expect(bucketState('/api/v1/family1')).toBeUndefined();
    expect(bucketState('/api/v1/family0')?.lastActiveAt).toEqual(expect.any(Number));
    expect(bucketState('/api/v1/family0')?.gatedUntil).toEqual(expect.any(Number));
  });
});
