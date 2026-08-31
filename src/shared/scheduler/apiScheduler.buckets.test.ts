/**
 * Tests for per-bucket rate-limit gating.
 *
 * Okta enforces its quotas per endpoint family, so `/api/v1/apps` can be
 * exhausted while `/api/v1/groups` still has its full budget. The scheduler used
 * to hold **one** cooldown and check only the head of the queue against it,
 * which meant an app fan-out running low stalled every unrelated request behind
 * it for the full cooldown.
 *
 * These pin both halves of the replacement, and the seam between them. A bucket
 * Okta has reported on answers for itself, so a healthy family runs while an
 * exhausted one waits. A bucket Okta has said **nothing** about falls back to
 * the most-restrictive observation anywhere — not because that is the real
 * constraint, but because an unobserved family has no budget of its own to
 * plead, and that fallback is what keeps this from ever being weaker than the
 * single cooldown it replaced.
 *
 * The scheduler dispatches via `chrome.tabs.sendMessage` on a 50ms loop, so
 * these run under real timers like their sibling suites.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiScheduler } from './apiScheduler';

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

/**
 * A transport that answers each endpoint with the budget its own family has
 * left, keyed by the bucket prefix. An endpoint matching no prefix answers with
 * no rate-limit headers at all — Okta not saying anything about that family.
 */
function respondPerBucket(budgets: Record<string, number>) {
  return vi.fn(async (_tabId: number, msg: { endpoint: string }) => {
    const prefix = Object.keys(budgets).find((key) => msg.endpoint.startsWith(key));
    return {
      success: true,
      data: msg.endpoint,
      headers: prefix === undefined ? {} : rateLimitHeaders(budgets[prefix]),
    };
  });
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

describe('ApiScheduler per-bucket gating', () => {
  it('lets a healthy bucket through while an exhausted one cools down', async () => {
    // Apps is nearly gone (2%); groups is untouched (95%). Both families are
    // primed, because only an *observed* bucket answers for itself — that is
    // precisely the distinction under test, and the unobserved case is covered
    // by the global-backstop test below.
    sendMessage.mockImplementation(respondPerBucket({ '/api/v1/apps': 2, '/api/v1/groups': 95 }));
    scheduler = new ApiScheduler({ maxRetries: 0 });

    // Prime both families so each has a live observation.
    await scheduler.scheduleRequest('/api/v1/groups?limit=200', 'GET', undefined, 1, 'high');
    await scheduler.scheduleRequest('/api/v1/apps?limit=200', 'GET', undefined, 1, 'high');
    expect(scheduler.getState().cooldownEndsAt).toBeTruthy();

    // The apps request must wait; the groups request must not.
    let appsResolved = false;
    void scheduler
      .scheduleRequest('/api/v1/apps/0oaFAKE1/groups?limit=200', 'GET', undefined, 1, 'normal')
      .then(() => {
        appsResolved = true;
      })
      .catch(() => {});

    const groups = await scheduler.scheduleRequest(
      '/api/v1/groups/00gFAKE1/users?limit=200',
      'GET',
      undefined,
      1,
      'normal',
    );

    // Several ticks for the gated apps request to wrongly dispatch.
    await new Promise((r) => setTimeout(r, 200));

    expect(groups.data).toBe('/api/v1/groups/00gFAKE1/users?limit=200');
    expect(appsResolved).toBe(false);
    expect(dispatchedEndpoints()).toEqual([
      '/api/v1/groups?limit=200',
      '/api/v1/apps?limit=200',
      '/api/v1/groups/00gFAKE1/users?limit=200',
    ]);
  });

  it('skips past a gated request rather than stopping the drain at it', async () => {
    sendMessage.mockImplementation(respondPerBucket({ '/api/v1/apps': 2, '/api/v1/groups': 95 }));
    // One at a time, so "skipped past" is observable in the dispatch order
    // rather than hidden by concurrency.
    scheduler = new ApiScheduler({ maxConcurrent: 1, maxRetries: 0 });

    await scheduler.scheduleRequest('/api/v1/groups?limit=200', 'GET', undefined, 1, 'high');
    await scheduler.scheduleRequest('/api/v1/apps?limit=200', 'GET', undefined, 1, 'high');

    // The apps request is enqueued FIRST and at a HIGHER priority. Priority
    // order is untouched — it is skipped only because its own bucket says no.
    void scheduler
      .scheduleRequest('/api/v1/apps/0oaFAKE1/users?limit=200', 'GET', undefined, 1, 'high')
      .catch(() => {});
    const groups = await scheduler.scheduleRequest(
      '/api/v1/groups/00gFAKE1/users?limit=200',
      'GET',
      undefined,
      1,
      'low',
    );

    expect(groups.data).toBe('/api/v1/groups/00gFAKE1/users?limit=200');
    expect(dispatchedEndpoints()).not.toContain('/api/v1/apps/0oaFAKE1/users?limit=200');
  });

  it('still stops everything when the global backstop is what tripped', async () => {
    // Only one family is ever observed, and it is nearly gone. Nothing may run:
    // an unobserved bucket has no budget of its own to plead, and the
    // most-restrictive-anywhere gate is exactly what covers that case.
    sendMessage.mockImplementation(respondPerBucket({ '/api/v1/apps': 2 }));
    scheduler = new ApiScheduler({ maxRetries: 0 });

    await scheduler.scheduleRequest('/api/v1/apps?limit=200', 'GET', undefined, 1, 'high');
    expect(scheduler.getState().cooldownEndsAt).toBeTruthy();

    let usersResolved = false;
    void scheduler
      .scheduleRequest('/api/v1/users?limit=200', 'GET', undefined, 1, 'normal')
      .then(() => {
        usersResolved = true;
      })
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 200));

    expect(usersResolved).toBe(false);
    expect(dispatchedEndpoints()).toEqual(['/api/v1/apps?limit=200']);
  });

  it('reports the latest gate end, so the countdown never promises a clear queue early', async () => {
    sendMessage.mockImplementation(respondPerBucket({ '/api/v1/apps': 2, '/api/v1/groups': 95 }));
    scheduler = new ApiScheduler({ maxRetries: 0, cooldownDuration: 30_000 });

    await scheduler.scheduleRequest('/api/v1/groups?limit=200', 'GET', undefined, 1, 'high');
    await scheduler.scheduleRequest('/api/v1/apps?limit=200', 'GET', undefined, 1, 'high');

    const { cooldownEndsAt } = scheduler.getState();
    expect(cooldownEndsAt).toBeTruthy();
    // Capped at the configured duration, and never past the reset 60s out.
    expect(cooldownEndsAt! - Date.now()).toBeLessThanOrEqual(30_000);
    expect(cooldownEndsAt! - Date.now()).toBeGreaterThan(0);
  });

  it('reports no cooldown once every gate has expired', async () => {
    // A 60ms cooldown so the expiry is observable without faking timers, which
    // the 50ms dispatch loop does not survive.
    sendMessage.mockImplementation(respondPerBucket({ '/api/v1/apps': 2 }));
    scheduler = new ApiScheduler({ maxRetries: 0, cooldownDuration: 60 });

    await scheduler.scheduleRequest('/api/v1/apps?limit=200', 'GET', undefined, 1, 'high');
    expect(scheduler.getState().cooldownEndsAt).toBeTruthy();

    await new Promise((r) => setTimeout(r, 150));

    expect(scheduler.getState().cooldownEndsAt).toBeNull();
  });
});
