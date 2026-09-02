/**
 * Unit tests for `useAppsData` — the Applications tab's load pipeline.
 *
 * RETARGETED for ADR-0040. The inventory used to be paged by `getAllApps` into
 * the session-scoped entity cache; it now comes from the background-owned org
 * snapshot. Every assertion below that still has a subject is kept: the org
 * scoping, the auto-load deferral, the missing-tab guard, the forced refresh,
 * and a fatal load reaching the caller's banner rather than being swallowed into
 * an empty list. What moved is the seam they are asserted against — the store
 * and the `syncSnapshot` message, instead of a fetch function and an in-memory
 * map.
 *
 * One case was REMOVED because what it pinned no longer has a mechanism:
 *
 *   - 'serves a second load from the entity cache without refetching' pinned
 *     `getOrFetch`'s de-duplication. The hook no longer decides whether a load
 *     costs a request — the freshness ladder does, in the background — and that
 *     decision is covered directly by `shared/snapshot/snapshotSync.test.ts`
 *     ('does nothing for a snapshot that is complete, fresh and has no
 *     watermark', plus the delta and drift-check cases) and by
 *     `shared/snapshot/syncMeta.test.ts` (`nextSyncMode`). The property that
 *     matters to *this* hook — a warm org paints with no request at all — is
 *     pinned below by 'paints a seeded org without asking the background for
 *     anything'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { OktaAppListItem } from '../../shared/schemas/okta';

// ---------------------------------------------------------------------------
// IndexedDB fake
// ---------------------------------------------------------------------------
// jsdom has no IndexedDB and `fake-indexeddb` is not a dependency, so `idb` is
// faked with a Map, exactly as `shared/snapshot/orgSnapshotStore.test.ts` does.
const { fakeDB, idbTables } = await vi.hoisted(async () => {
  const { createFakeIdb } = await import('@/test/factories/idb');
  const { fakeDB, tables } = createFakeIdb();
  return { fakeDB, idbTables: tables };
});

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

import { useAppsData } from './useAppsData';

const appsA: OktaAppListItem[] = [
  { id: '0oaFAKE000000000001', label: 'Payroll', status: 'ACTIVE', signOnMode: 'SAML_2_0' },
];
const appsB: OktaAppListItem[] = [
  { id: '0oaFAKE000000000002', label: 'Helpdesk', status: 'ACTIVE', signOnMode: 'SAML_2_0' },
];

const ORIGIN = 'https://example.okta.com';
const OTHER_ORIGIN = 'https://other.okta.com';
const WALKED_AT = 1_800_000_000_000;

const onError = vi.fn();
const sendMessage = vi.fn();

globalThis.chrome = {
  runtime: {
    sendMessage,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
} as unknown as typeof chrome;

/** Write app rows into the snapshot the panel reads, as a completed walk would. */
function seedApps(apps: OktaAppListItem[], origin = ORIGIN) {
  const table = (idbTables.get('apps') ?? new Map()) as Map<string, unknown>;
  for (const entity of apps) {
    table.set(`${origin}::${entity.id}`, { origin, id: entity.id, entity, syncedAt: WALKED_AT });
  }
  idbTables.set('apps', table);
  const meta = (idbTables.get('syncMeta') ?? new Map()) as Map<string, unknown>;
  meta.set(`${origin}::apps`, {
    origin,
    collection: 'apps',
    complete: true,
    lastFullWalkAt: WALKED_AT,
    lastDeltaAt: null,
    watermark: null,
    itemCount: apps.length,
    cursor: null,
    walkStartedAt: null,
    deltaSupported: null,
  });
  idbTables.set('syncMeta', meta);
}

/** The `syncSnapshot` messages the panel sent to the background. */
function syncCalls() {
  return sendMessage.mock.calls
    .map((call) => call[0])
    .filter((msg) => msg?.action === 'syncSnapshot');
}

beforeEach(() => {
  vi.clearAllMocks();
  idbTables.clear();
  // The background's default: a walk that succeeds and fills the store.
  sendMessage.mockImplementation(async (msg: { action?: string; origin?: string }) => {
    if (msg?.action !== 'syncSnapshot') return undefined;
    seedApps(appsA, msg.origin);
    return { success: true };
  });
});

/**
 * Render with the auto-load disabled, so each test drives `loadApps` itself.
 *
 * `enabled: false` also makes `sync()` a no-op (ADR-0018), so the cases that
 * exercise a real load pass `enabled: true` and account for the auto-load.
 */
const renderIdle = (over: Partial<Parameters<typeof useAppsData>[0]> = {}) =>
  renderHook(() =>
    useAppsData({ onError, targetTabId: 1, oktaOrigin: ORIGIN, enabled: false, ...over }),
  );

describe('useAppsData', () => {
  it('loads the inventory and reports the walk that produced it', async () => {
    const { result } = renderIdle({ enabled: true });

    await waitFor(() => expect(result.current.apps).toEqual(appsA));
    expect(syncCalls()).toHaveLength(1);
    // The timestamp is the walk's, not a `new Date()` at the call site — an
    // origin-scoped snapshot may have been filled by another session entirely.
    expect(result.current.lastFetchTime).toBe(new Date(WALKED_AT).toISOString());
    expect(result.current.complete).toBe(true);
    expect(result.current.isLoading).toBe(false);
    // The banner is cleared at the start of a successful load.
    expect(onError).toHaveBeenCalledWith('');
  });

  it('paints a seeded org without asking the background for anything', async () => {
    seedApps(appsA);

    const { result } = renderIdle();

    // The whole point of the snapshot: a warm org costs no request, and there is
    // no empty-list flash before the rows arrive from disk.
    await waitFor(() => expect(result.current.apps).toEqual(appsA));
    expect(syncCalls()).toHaveLength(0);
    expect(result.current.lastFetchTime).toBe(new Date(WALKED_AT).toISOString());
  });

  it('forces a full walk when refreshed', async () => {
    const { result } = renderIdle({ enabled: true });
    await waitFor(() => expect(result.current.apps).toEqual(appsA));

    await act(async () => {
      await result.current.loadApps(true);
    });

    // An unforced load takes the cheapest honest mode; Refresh means Refresh.
    expect(syncCalls().map((msg) => msg.force)).toEqual([false, true]);
  });

  it('keeps each org in its own rows, and blanks the previous one immediately', async () => {
    seedApps(appsA, ORIGIN);
    seedApps(appsB, OTHER_ORIGIN);

    const { result, rerender } = renderHook(
      ({ origin }: { origin: string }) =>
        useAppsData({ onError, targetTabId: 1, oktaOrigin: origin, enabled: false }),
      { initialProps: { origin: ORIGIN } },
    );
    await waitFor(() => expect(result.current.apps).toEqual(appsA));

    // Showing one org's app names beside another org's deep links is a real
    // defect, not just a stale read.
    rerender({ origin: OTHER_ORIGIN });
    expect(result.current.apps).toEqual([]);
    await waitFor(() => expect(result.current.apps).toEqual(appsB));
  });

  it('carries the fetch time back when returning to an org already on disk', async () => {
    // `lastFetchTime` used to be blanked to null on every org change, so a
    // re-seeded inventory appeared beside "never fetched" — data on screen that
    // the UI claimed it had never loaded.
    seedApps(appsA, ORIGIN);

    const { result, rerender } = renderHook(
      ({ origin }: { origin: string }) =>
        useAppsData({ onError, targetTabId: 1, oktaOrigin: origin, enabled: false }),
      { initialProps: { origin: ORIGIN } },
    );
    await waitFor(() => expect(result.current.lastFetchTime).not.toBeNull());
    const firstFetch = result.current.lastFetchTime;

    // Genuinely unwalked: no inventory, and no fetch time to claim.
    rerender({ origin: OTHER_ORIGIN });
    await waitFor(() => expect(result.current.lastFetchTime).toBeNull());
    expect(result.current.apps).toEqual([]);

    rerender({ origin: ORIGIN });
    await waitFor(() => expect(result.current.apps).toEqual(appsA));
    expect(result.current.lastFetchTime).toBe(firstFetch);
    expect(syncCalls()).toHaveLength(0);
  });

  it('reports a missing Okta tab instead of syncing', async () => {
    const { result } = renderIdle({ targetTabId: null });

    await act(async () => {
      await result.current.loadApps();
    });

    // The background cannot fetch Okta without a live tab to route through.
    expect(syncCalls()).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith('No Okta tab connected');
    expect(result.current.apps).toEqual([]);
  });

  it('surfaces a fatal inventory read through onError', async () => {
    sendMessage.mockResolvedValue({ success: false, error: 'scheduler unavailable' });
    const { result } = renderIdle({ enabled: true });

    await waitFor(() => expect(onError).toHaveBeenCalledWith('scheduler unavailable'));
    // A failed walk is never rendered as an empty org.
    expect(result.current.apps).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('defers the auto-load while the tab is hidden and pays it on the next show', async () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAppsData({ onError, targetTabId: 1, oktaOrigin: ORIGIN, enabled }),
      { initialProps: { enabled: false } },
    );

    // ADR-0018: the tab stays mounted when hidden, so the load is gated instead.
    expect(syncCalls()).toHaveLength(0);

    rerender({ enabled: true });
    await waitFor(() => expect(syncCalls()).toHaveLength(1));
  });

  it('re-arms the auto-load when the org changes under a stable tab id', async () => {
    const { rerender } = renderHook(
      ({ origin }: { origin: string }) =>
        useAppsData({ onError, targetTabId: 1, oktaOrigin: origin, enabled: true }),
      { initialProps: { origin: ORIGIN } },
    );

    await waitFor(() => expect(syncCalls()).toHaveLength(1));

    // Same Chrome tab, different org — the tab id alone cannot detect this,
    // which is why the auto-load is armed on the (tab id, origin) pair.
    rerender({ origin: OTHER_ORIGIN });

    await waitFor(() => expect(syncCalls()).toHaveLength(2));
    expect(syncCalls().map((msg) => msg.origin)).toEqual([ORIGIN, OTHER_ORIGIN]);
  });
});
