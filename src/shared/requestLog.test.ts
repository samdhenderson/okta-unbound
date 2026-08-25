/**
 * Unit tests for the verbose API request audit log.
 *
 * `recordRequest` folds settled requests into an open, in-memory batch keyed by
 * `reason`; `flushAllPending` (called by the scheduler at its idle transition,
 * not on a timer — see `shared/requestLog`'s module doc) is what actually
 * persists a batch as one {@link RequestLogEntry}. These pin the grouping,
 * redaction, truncation, and 50-entry cap behavior.
 *
 * `chrome.storage.local` is the global `vi.fn()` mock from `src/test/setup.ts`,
 * backed here by a tiny in-memory store so a write is readable by the next read
 * (same convention as `shared/undoManager.test.ts`).
 *
 * Fixtures use only fake placeholders (`00uFAKE…`, `user@example.com`) per CLAUDE.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordRequest,
  flushAllPending,
  getRequestLog,
  clearRequestLog,
  MAX_LOGGED_ENDPOINTS,
} from './requestLog';

const storage = chrome.storage.local as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

/** An in-memory `chrome.storage.local` so writes are visible to later reads. */
let store: Record<string, unknown> = {};

beforeEach(() => {
  vi.clearAllMocks();
  store = {};
  storage.get.mockImplementation(async (keys: string[]) =>
    Object.fromEntries(keys.filter((key) => key in store).map((key) => [key, store[key]])),
  );
  storage.set.mockImplementation(async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  });
});

/** A settled request with sensible defaults, overridable per test. */
function settled(overrides: Partial<Parameters<typeof recordRequest>[0]> = {}) {
  return {
    reason: 'Load group members',
    method: 'GET',
    endpoint: '/api/v1/groups/00gFAKEGROUP/users',
    timestamp: 1_000,
    durationMs: 50,
    success: true,
    ...overrides,
  };
}

describe('recordRequest + flushAllPending', () => {
  it('folds requests sharing a reason into one entry with the right count', async () => {
    recordRequest(settled());
    recordRequest(settled({ timestamp: 1_050, durationMs: 40 }));
    recordRequest(settled({ timestamp: 1_100, durationMs: 30 }));

    await flushAllPending();

    const history = await getRequestLog();
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0]).toMatchObject({
      reason: 'Load group members',
      requestCount: 3,
      outcome: 'all',
    });
  });

  it('keeps distinct reasons as separate entries', async () => {
    recordRequest(settled({ reason: 'Load group members' }));
    recordRequest(
      settled({ reason: 'Load group rules', endpoint: '/api/v1/groups/00gFAKE/rules' }),
    );

    await flushAllPending();

    const history = await getRequestLog();
    const reasons = history.entries.map((e) => e.reason).sort();
    expect(reasons).toEqual(['Load group members', 'Load group rules']);
  });

  it('falls back to a generic reason when none is given', async () => {
    recordRequest(settled({ reason: undefined }));
    await flushAllPending();

    const history = await getRequestLog();
    expect(history.entries[0].reason).toBe('Unlabeled request');
  });

  it('computes outcome as all/partial/none from success mix', async () => {
    recordRequest(settled({ reason: 'A', success: true }));
    recordRequest(settled({ reason: 'A', success: true }));
    await flushAllPending();

    recordRequest(settled({ reason: 'B', success: true }));
    recordRequest(settled({ reason: 'B', success: false }));
    await flushAllPending();

    recordRequest(settled({ reason: 'C', success: false }));
    await flushAllPending();

    const history = await getRequestLog();
    const byReason = Object.fromEntries(history.entries.map((e) => [e.reason, e.outcome]));
    expect(byReason).toEqual({ A: 'all', B: 'partial', C: 'none' });
  });

  it('dedupes identical endpoint+method pairs within a batch', async () => {
    recordRequest(settled());
    recordRequest(settled({ timestamp: 1_010 }));
    recordRequest(settled({ timestamp: 1_020 }));

    await flushAllPending();

    const history = await getRequestLog();
    expect(history.entries[0].requestCount).toBe(3);
    expect(history.entries[0].endpoints).toEqual([
      { method: 'GET', endpoint: '/api/v1/groups/00gFAKEGROUP/users' },
    ]);
    expect(history.entries[0].endpointsTruncated).toBe(false);
  });

  it('caps distinct endpoints at MAX_LOGGED_ENDPOINTS and flags truncation', async () => {
    for (let i = 0; i < MAX_LOGGED_ENDPOINTS + 5; i++) {
      recordRequest(settled({ endpoint: `/api/v1/groups/00gFAKE/users?page=${i}` }));
    }
    await flushAllPending();

    const history = await getRequestLog();
    expect(history.entries[0].requestCount).toBe(MAX_LOGGED_ENDPOINTS + 5);
    expect(history.entries[0].endpoints).toHaveLength(MAX_LOGGED_ENDPOINTS);
    expect(history.entries[0].endpointsTruncated).toBe(true);
  });

  it('redacts an admin-typed email in a query string before storage', async () => {
    recordRequest(
      settled({ endpoint: '/api/v1/users?search=profile.email eq "user@example.com"' }),
    );
    await flushAllPending();

    const history = await getRequestLog();
    expect(history.entries[0].endpoints[0].endpoint).not.toContain('user@example.com');
    expect(history.entries[0].endpoints[0].endpoint).toContain('<EMAIL>');
  });

  it('spans durationMs from the first request scheduled to the last settling', async () => {
    recordRequest(settled({ timestamp: 1_000, durationMs: 20 })); // settles at 1020
    recordRequest(settled({ timestamp: 1_100, durationMs: 200 })); // settles at 1300
    await flushAllPending();

    const history = await getRequestLog();
    expect(history.entries[0].timestamp).toBe(1_000);
    expect(history.entries[0].durationMs).toBe(300); // 1300 - 1000
  });

  it('is a no-op when nothing is pending', async () => {
    await flushAllPending();
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('caps the persisted log at 50 entries, evicting the oldest', async () => {
    for (let batch = 0; batch < 55; batch++) {
      recordRequest(settled({ reason: `Reason ${batch}`, timestamp: 1_000 + batch }));
      await flushAllPending();
    }

    const history = await getRequestLog();
    expect(history.entries).toHaveLength(50);
    // Newest-first: the most recent batch (54) survives, the oldest 5 (0-4) are evicted.
    expect(history.entries[0].reason).toBe('Reason 54');
    expect(history.entries.map((e) => e.reason)).not.toContain('Reason 0');
  });

  it('clearRequestLog empties the log', async () => {
    recordRequest(settled());
    await flushAllPending();
    expect((await getRequestLog()).entries).toHaveLength(1);

    await clearRequestLog();
    expect((await getRequestLog()).entries).toHaveLength(0);
  });
});
