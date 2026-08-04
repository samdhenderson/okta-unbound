/**
 * Unit tests for `useAppsData` — the Applications tab's load/cache pipeline.
 *
 * Pins what the tab depends on: the whole-org inventory is served from the session
 * entity cache on a second load, `force` bypasses it, the cache is scoped by org
 * origin so one org's apps are never shown for another's, the auto-load is deferred
 * (not dropped) while the tab is hidden, and a fatal `getAllApps` failure reaches the
 * caller's banner rather than being swallowed into an empty list.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { OktaAppListItem } from '../../shared/schemas/okta';

const appsA: OktaAppListItem[] = [
  { id: '0oaFAKE000000000001', label: 'Payroll', status: 'ACTIVE', signOnMode: 'SAML_2_0' },
];
const appsB: OktaAppListItem[] = [
  { id: '0oaFAKE000000000002', label: 'Helpdesk', status: 'ACTIVE', signOnMode: 'SAML_2_0' },
];

const getAllApps = vi.fn(async () => [] as OktaAppListItem[]);
const api = { getAllApps } as unknown as Parameters<typeof useAppsData>[0]['api'];

import { useAppsData } from './useAppsData';
import { resetEntityCache } from '../cache/entityCache';

const onError = vi.fn();
const ORIGIN = 'https://example.okta.com';

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
  getAllApps.mockResolvedValue(appsA);
});

/** Render the hook with the auto-load disabled, so each test drives `loadApps`. */
const renderIdle = (over: Partial<Parameters<typeof useAppsData>[0]> = {}) =>
  renderHook(() =>
    useAppsData({
      api,
      onError,
      targetTabId: 1,
      oktaOrigin: ORIGIN,
      enabled: false,
      ...over,
    }),
  );

describe('useAppsData', () => {
  it('loads the inventory and records the fetch time', async () => {
    const { result } = renderIdle();

    expect(result.current.apps).toEqual([]);
    expect(result.current.lastFetchTime).toBeNull();

    await act(async () => {
      await result.current.loadApps();
    });

    expect(getAllApps).toHaveBeenCalledTimes(1);
    expect(result.current.apps).toEqual(appsA);
    expect(result.current.lastFetchTime).not.toBeNull();
    expect(result.current.isLoading).toBe(false);
    // The banner is cleared at the start of a successful load.
    expect(onError).toHaveBeenCalledWith('');
  });

  it('serves a second load from the entity cache without refetching', async () => {
    const { result } = renderIdle();

    await act(async () => {
      await result.current.loadApps();
    });
    await act(async () => {
      await result.current.loadApps();
    });

    expect(getAllApps).toHaveBeenCalledTimes(1);
    expect(result.current.apps).toEqual(appsA);
    // Deferred, not dropped: the load still ran, it just cost no request.
    expect(result.current.lastFetchTime).not.toBeNull();
  });

  it('bypasses the cache when forced', async () => {
    const { result } = renderIdle();

    await act(async () => {
      await result.current.loadApps();
    });
    await act(async () => {
      await result.current.loadApps(true);
    });

    expect(getAllApps).toHaveBeenCalledTimes(2);
  });

  it('seeds a fresh consumer from the cache without fetching', async () => {
    const first = renderIdle();
    await act(async () => {
      await first.result.current.loadApps();
    });

    // A second consumer on the same org paints immediately — no request, no
    // empty-list flash.
    const second = renderIdle();
    expect(second.result.current.apps).toEqual(appsA);
    expect(getAllApps).toHaveBeenCalledTimes(1);
  });

  it('keeps each org in its own cache entry', async () => {
    const { result, rerender } = renderHook(
      ({ origin }: { origin: string }) =>
        useAppsData({ api, onError, targetTabId: 1, oktaOrigin: origin, enabled: false }),
      { initialProps: { origin: ORIGIN } },
    );

    await act(async () => {
      await result.current.loadApps();
    });
    expect(result.current.apps).toEqual(appsA);

    // Moving to another org must drop the previous org's inventory immediately —
    // showing one org's app names beside another org's deep links is a real defect,
    // not just a stale read.
    getAllApps.mockResolvedValue(appsB);
    rerender({ origin: 'https://other.okta.com' });
    expect(result.current.apps).toEqual([]);

    await act(async () => {
      await result.current.loadApps();
    });
    expect(getAllApps).toHaveBeenCalledTimes(2);
    expect(result.current.apps).toEqual(appsB);
  });

  it('reports a missing Okta tab instead of fetching', async () => {
    const { result } = renderIdle({ targetTabId: null });

    await act(async () => {
      await result.current.loadApps();
    });

    expect(getAllApps).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('No Okta tab connected');
    expect(result.current.apps).toEqual([]);
  });

  it('surfaces a fatal inventory read through onError', async () => {
    // `getAllApps` throws on a failed page on purpose, so a truncated inventory is
    // never rendered as if it were complete.
    getAllApps.mockRejectedValue(new Error('scheduler unavailable'));
    const { result } = renderIdle();

    await act(async () => {
      await result.current.loadApps();
    });

    expect(onError).toHaveBeenCalledWith('scheduler unavailable');
    expect(result.current.apps).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('defers the auto-load while the tab is hidden and pays it on the next show', async () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAppsData({ api, onError, targetTabId: 1, oktaOrigin: ORIGIN, enabled }),
      { initialProps: { enabled: false } },
    );

    expect(getAllApps).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(getAllApps).toHaveBeenCalledTimes(1));
  });

  it('re-arms the auto-load when the org changes under a stable tab id', async () => {
    const { rerender } = renderHook(
      ({ origin }: { origin: string }) =>
        useAppsData({ api, onError, targetTabId: 1, oktaOrigin: origin, enabled: true }),
      { initialProps: { origin: ORIGIN } },
    );

    await waitFor(() => expect(getAllApps).toHaveBeenCalledTimes(1));

    // Same Chrome tab, different org — the tab id alone cannot detect this, which is
    // why the auto-load is armed on the (tab id, origin) pair.
    getAllApps.mockResolvedValue(appsB);
    rerender({ origin: 'https://other.okta.com' });

    await waitFor(() => expect(getAllApps).toHaveBeenCalledTimes(2));
  });
});
