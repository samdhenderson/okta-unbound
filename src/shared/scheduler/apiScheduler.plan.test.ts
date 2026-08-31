/**
 * Tests for the scheduler's plan ledger — the declared-but-unspent side of
 * `SchedulerState`.
 *
 * `PlanRegistry` is unit-tested in isolation (`plan.test.ts`). What these pin is
 * the seam: that the scheduler charges plans from its single settle path, that
 * `getState()` publishes a bucket view an operation can be read against, and
 * that cancelling one plan drops that plan's work and nothing else.
 *
 * Like its sibling suites, this runs under real timers because the scheduler
 * dispatches on a 50ms loop.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiScheduler } from './apiScheduler';
import { OperationCancelledError } from './cancellation';
import type { BucketState } from './types';

let scheduler: ApiScheduler;
const sendMessage = vi.fn();

/** Okta rate-limit headers leaving `remaining` of `limit`, resetting in 60s. */
function rateLimitHeaders(remaining: number, limit = 100): Record<string, string> {
  return {
    'x-rate-limit-limit': String(limit),
    'x-rate-limit-remaining': String(remaining),
    'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 60),
  };
}

/** A transport that answers everything with plenty of headroom left. */
function respondHealthy() {
  return vi.fn(async (_tabId: number, msg: { endpoint: string }) => ({
    success: true,
    data: msg.endpoint,
    headers: rateLimitHeaders(95),
  }));
}

function bucket(states: BucketState[], name: string): BucketState {
  const found = states.find((state) => state.bucket === name);
  if (!found) throw new Error(`No bucket state for ${name}. Saw: ${states.map((s) => s.bucket)}`);
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
  (chrome as unknown as { tabs: { sendMessage: typeof sendMessage } }).tabs = { sendMessage };
});

afterEach(() => {
  scheduler?.stop();
});

describe('ApiScheduler plan ledger', () => {
  describe('declaration reaches the published state', () => {
    it('lists a planned bucket before a single request has been sent', () => {
      sendMessage.mockImplementation(respondHealthy());
      scheduler = new ApiScheduler({ maxRetries: 0 });

      scheduler.declarePlan({
        id: 'plan-1',
        name: 'Export all users',
        tabId: 1,
        legs: [{ endpoint: '/api/v1/users?limit=200', estimate: { kind: 'exact', requests: 8 } }],
      });

      const state = scheduler.getState();
      // The whole point: work that is coming, visible before it is spent.
      expect(bucket(state.buckets, '/api/v1/users')).toMatchObject({
        planned: 8,
        queued: 0,
        active: 0,
        limit: null,
        remaining: null,
      });
      expect(state.plans).toHaveLength(1);
      expect(state.plans[0]).toMatchObject({ name: 'Export all users', spent: 0, remaining: 8 });
    });

    it('publishes the scheduler-s own cooldown threshold rather than a UI guess', () => {
      sendMessage.mockImplementation(respondHealthy());
      scheduler = new ApiScheduler({ minRemainingThreshold: 22 });

      expect(scheduler.getState().minRemainingThresholdPercent).toBe(22);

      scheduler.setMinRemainingThreshold(37);

      expect(scheduler.getState().minRemainingThresholdPercent).toBe(37);
    });
  });

  describe('attribution', () => {
    it('charges a settled request to its plan and shrinks what is planned', async () => {
      sendMessage.mockImplementation(respondHealthy());
      scheduler = new ApiScheduler({ maxRetries: 0 });

      scheduler.declarePlan({
        id: 'plan-1',
        name: 'Export all users',
        tabId: 1,
        legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 3 } }],
      });

      await scheduler.scheduleRequest(
        '/api/v1/users?limit=200',
        'GET',
        undefined,
        1,
        'normal',
        'Export all users',
        'plan-1',
      );

      const state = scheduler.getState();
      expect(state.plans[0]).toMatchObject({ spent: 1, estimated: 3, remaining: 2 });
      expect(bucket(state.buckets, '/api/v1/users').planned).toBe(2);
    });

    it('charges a coalesced GET once, to the leader', async () => {
      // Two callers ask for the same URL concurrently; Okta sees one request, so
      // the ledger must record one. Anything else would make `spent` a count of
      // callers rather than of budget actually consumed.
      let release: (value: unknown) => void = () => {};
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      sendMessage.mockImplementation(async (_tabId: number, msg: { endpoint: string }) => {
        await gate;
        return { success: true, data: msg.endpoint, headers: rateLimitHeaders(95) };
      });
      scheduler = new ApiScheduler({ maxRetries: 0 });

      scheduler.declarePlan({
        id: 'plan-1',
        name: 'Load group members',
        tabId: 1,
        legs: [{ endpoint: '/api/v1/groups', estimate: { kind: 'exact', requests: 2 } }],
      });

      const first = scheduler.scheduleRequest(
        '/api/v1/groups/00gFAKE1/users?limit=200',
        'GET',
        undefined,
        1,
        'normal',
        'Load group members',
        'plan-1',
      );
      // Give the first one a tick to register as the coalescing leader.
      await new Promise((resolve) => setTimeout(resolve, 20));
      const second = scheduler.scheduleRequest(
        '/api/v1/groups/00gFAKE1/users?limit=200',
        'GET',
        undefined,
        1,
        'normal',
        'Load group members',
        'plan-1',
      );

      release(undefined);
      await Promise.all([first, second]);

      expect(scheduler.getMetrics().coalescedRequests).toBe(1);
      expect(scheduler.getState().plans[0].spent).toBe(1);
    });

    it('surfaces an under-declared bucket instead of losing the request', async () => {
      sendMessage.mockImplementation(respondHealthy());
      scheduler = new ApiScheduler({ maxRetries: 0 });

      scheduler.declarePlan({
        id: 'plan-1',
        name: 'Scan MFA',
        tabId: 1,
        legs: [{ endpoint: '/api/v1/groups', estimate: { kind: 'exact', requests: 1 } }],
      });

      await scheduler.scheduleRequest(
        '/api/v1/users/00uFAKE1/factors',
        'GET',
        undefined,
        1,
        'normal',
        'Scan MFA',
        'plan-1',
      );

      const [plan] = scheduler.getState().plans;
      expect(plan.spent).toBe(1);
      const appended = plan.legs.find((leg) => leg.bucket === '/api/v1/users');
      expect(appended).toMatchObject({ spent: 1, estimated: null });
    });

    it('leaves an undeclared request out of every plan but still counts its bucket', async () => {
      sendMessage.mockImplementation(respondHealthy());
      scheduler = new ApiScheduler({ maxRetries: 0 });

      await scheduler.scheduleRequest('/api/v1/zones', 'GET', undefined, 1, 'normal', 'List zones');

      const state = scheduler.getState();
      expect(state.plans).toEqual([]);
      // Advisory means undeclared traffic is still fully visible.
      expect(bucket(state.buckets, '/api/v1/zones').remaining).toBe(95);
    });
  });

  describe('bucket states', () => {
    it('reports headroom, the reset in milliseconds, and in-flight counts per bucket', async () => {
      sendMessage.mockImplementation(async (_tabId: number, msg: { endpoint: string }) => ({
        success: true,
        data: msg.endpoint,
        headers: msg.endpoint.startsWith('/api/v1/apps')
          ? rateLimitHeaders(20, 300)
          : rateLimitHeaders(480, 600),
      }));
      scheduler = new ApiScheduler({ maxRetries: 0, minRemainingThreshold: 1 });

      await scheduler.scheduleRequest('/api/v1/apps?limit=200', 'GET', undefined, 1, 'high');
      await scheduler.scheduleRequest('/api/v1/groups?limit=200', 'GET', undefined, 1, 'high');

      const state = scheduler.getState();
      const apps = bucket(state.buckets, '/api/v1/apps');
      expect(apps).toMatchObject({ limit: 300, remaining: 20 });
      // Okta reports seconds; everything crossing to the UI is milliseconds.
      expect(apps.resetAt).toBeGreaterThan(Date.now());
      expect(apps.resetAt! - Date.now()).toBeLessThan(61_000);
      expect(bucket(state.buckets, '/api/v1/groups')).toMatchObject({ limit: 600, remaining: 480 });
    });

    it('sorts by fraction remaining, so a small quota under strain outranks a large one', async () => {
      // Deliberately chosen so pressure order is the *reverse* of alphabetical
      // order — otherwise this test would pass against a plain name sort and
      // prove nothing about the comparator.
      //
      //   /api/v1/zones  →  20/300  (6.7% left, most pressured)
      //   /api/v1/apps   → 480/600  (80% left)
      //   /api/v1/groups →  unobserved, planned only
      sendMessage.mockImplementation(async (_tabId: number, msg: { endpoint: string }) => ({
        success: true,
        data: msg.endpoint,
        headers: msg.endpoint.startsWith('/api/v1/zones')
          ? rateLimitHeaders(20, 300)
          : rateLimitHeaders(480, 600),
      }));
      scheduler = new ApiScheduler({ maxRetries: 0, minRemainingThreshold: 1 });

      await scheduler.scheduleRequest('/api/v1/apps?limit=200', 'GET', undefined, 1, 'high');
      await scheduler.scheduleRequest('/api/v1/zones?limit=200', 'GET', undefined, 1, 'high');
      scheduler.declarePlan({
        id: 'plan-1',
        name: 'Load groups',
        tabId: 1,
        legs: [{ endpoint: '/api/v1/groups', estimate: { kind: 'exact', requests: 4 } }],
      });

      expect(scheduler.getState().buckets.map((state) => state.bucket)).toEqual([
        '/api/v1/zones',
        '/api/v1/apps',
        // Unobserved: no fraction to rank, so it sorts last rather than being guessed at.
        '/api/v1/groups',
      ]);
    });

    it('breaks a tie on fraction by name, so the row order does not jitter', async () => {
      // Same fraction, different quota sizes: without the name tiebreak the
      // order would depend on Set insertion order and reshuffle between pushes.
      sendMessage.mockImplementation(async (_tabId: number, msg: { endpoint: string }) => ({
        success: true,
        data: msg.endpoint,
        headers: msg.endpoint.startsWith('/api/v1/zones')
          ? rateLimitHeaders(50, 100)
          : rateLimitHeaders(300, 600),
      }));
      scheduler = new ApiScheduler({ maxRetries: 0, minRemainingThreshold: 1 });

      await scheduler.scheduleRequest('/api/v1/zones?limit=200', 'GET', undefined, 1, 'high');
      await scheduler.scheduleRequest('/api/v1/apps?limit=200', 'GET', undefined, 1, 'high');

      expect(scheduler.getState().buckets.map((state) => state.bucket)).toEqual([
        '/api/v1/apps',
        '/api/v1/zones',
      ]);
    });

    it('reports a gated bucket-s lift time', async () => {
      sendMessage.mockImplementation(async (_tabId: number, msg: { endpoint: string }) => ({
        success: true,
        data: msg.endpoint,
        headers: rateLimitHeaders(2, 100),
      }));
      scheduler = new ApiScheduler({ maxRetries: 0, minRemainingThreshold: 10 });

      await scheduler.scheduleRequest('/api/v1/apps?limit=200', 'GET', undefined, 1, 'high');

      expect(bucket(scheduler.getState().buckets, '/api/v1/apps').gatedUntil).toBeGreaterThan(
        Date.now(),
      );
    });
  });

  describe('cancelPlan', () => {
    it('drops only the cancelled plan-s queued requests', async () => {
      // Hold the transport open so everything after the concurrency cap stays queued.
      let release: (value: unknown) => void = () => {};
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      sendMessage.mockImplementation(async (_tabId: number, msg: { endpoint: string }) => {
        await gate;
        return { success: true, data: msg.endpoint, headers: rateLimitHeaders(95) };
      });
      scheduler = new ApiScheduler({ maxRetries: 0, maxConcurrent: 1 });

      const schedule = (endpoint: string, planId?: string) =>
        scheduler.scheduleRequest(endpoint, 'GET', undefined, 1, 'normal', 'work', planId);

      // One in flight to occupy the single slot, then two queued behind it.
      const inFlight = schedule('/api/v1/meta/schemas/user/default');
      await new Promise((resolve) => setTimeout(resolve, 20));

      const exportPage = schedule('/api/v1/users?limit=200', 'export');
      const search = schedule('/api/v1/groups?q=eng', 'search');

      const exportOutcome = exportPage.then(
        () => 'resolved',
        (error) => error,
      );

      const dropped = scheduler.cancelPlan('export');

      expect(dropped).toBe(1);
      await expect(exportOutcome).resolves.toBeInstanceOf(OperationCancelledError);

      release(undefined);
      // The unrelated operation survives — the whole reason this is not clearQueue.
      await expect(search).resolves.toMatchObject({ success: true });
      await expect(inFlight).resolves.toMatchObject({ success: true });
    });

    it('removes the plan from the published state', () => {
      sendMessage.mockImplementation(respondHealthy());
      scheduler = new ApiScheduler({ maxRetries: 0 });

      scheduler.declarePlan({
        id: 'plan-1',
        name: 'Export all users',
        tabId: 1,
        legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 9 } }],
      });

      scheduler.cancelPlan('plan-1');

      const state = scheduler.getState();
      expect(state.plans).toEqual([]);
      expect(state.buckets.find((b) => b.bucket === '/api/v1/users')?.planned ?? 0).toBe(0);
    });

    it('is a no-op for a plan that was never declared', () => {
      sendMessage.mockImplementation(respondHealthy());
      scheduler = new ApiScheduler({ maxRetries: 0 });

      expect(scheduler.cancelPlan('never-declared')).toBe(0);
    });
  });

  describe('completePlan', () => {
    it('stops the plan promising work once it is done', async () => {
      sendMessage.mockImplementation(respondHealthy());
      scheduler = new ApiScheduler({ maxRetries: 0 });

      scheduler.declarePlan({
        id: 'plan-1',
        name: 'Export all users',
        tabId: 1,
        legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 5 } }],
      });
      await scheduler.scheduleRequest(
        '/api/v1/users?limit=200',
        'GET',
        undefined,
        1,
        'normal',
        'Export all users',
        'plan-1',
      );

      scheduler.completePlan('plan-1');

      const state = scheduler.getState();
      expect(state.plans).toEqual([]);
      // The bucket is still listed — Okta reported on it — but promises nothing.
      expect(bucket(state.buckets, '/api/v1/users').planned).toBe(0);
    });
  });

  describe('refinePlan', () => {
    it('raises a walk-s floor as more pages are discovered', () => {
      sendMessage.mockImplementation(respondHealthy());
      scheduler = new ApiScheduler({ maxRetries: 0 });

      scheduler.declarePlan({
        id: 'plan-1',
        name: 'Export all users',
        tabId: 1,
        legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'atLeast', requests: 1 } }],
      });

      scheduler.refinePlan('plan-1', '/api/v1/users?after=cursor', {
        kind: 'atLeast',
        requests: 6,
      });

      expect(scheduler.getState().plans[0]).toMatchObject({ estimated: 6, approximate: true });
      expect(bucket(scheduler.getState().buckets, '/api/v1/users').planned).toBe(6);
    });
  });

  describe('clearQueue', () => {
    it('forgets every plan, so no row survives promising discarded work', () => {
      sendMessage.mockImplementation(respondHealthy());
      scheduler = new ApiScheduler({ maxRetries: 0 });

      scheduler.declarePlan({
        id: 'plan-1',
        name: 'Export all users',
        tabId: 1,
        legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 9 } }],
      });

      scheduler.clearQueue();

      expect(scheduler.getState().plans).toEqual([]);
    });
  });
});
