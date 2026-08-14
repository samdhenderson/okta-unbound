/**
 * Unit tests for `usePoliciesData` — the Auth Policies tab's load/cache pipeline.
 *
 * Pins the four behaviors the tab depends on: the read is scoped to
 * `ACCESS_POLICY`, a second load is served from the session entity cache, `force`
 * bypasses that cache, and a missing Okta tab reports an error instead of fetching.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { OktaPolicyListItem } from '../../shared/schemas/okta';

const policies: OktaPolicyListItem[] = [
  { id: 'rstFAKE000000000001', name: 'Any two factors', status: 'ACTIVE', type: 'ACCESS_POLICY' },
];

const api = vi.hoisted(() => ({
  listPolicies: vi.fn(async () => [] as OktaPolicyListItem[]),
  getPolicyRules: vi.fn(async () => []),
}));

vi.mock('./useOktaApi', () => ({ useOktaApi: () => api }));

import { usePoliciesData, AUTH_POLICY_TYPE, POLICIES_CACHE_KEY } from './usePoliciesData';
import { resetEntityCache, setEntry } from '../cache/entityCache';

const onError = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
  api.listPolicies.mockResolvedValue(policies);
});

describe('usePoliciesData', () => {
  it('reports the cached entry fetch time when it paints from a cache hit', () => {
    // The hook seeds `policies` from the cache so a revisit paints instantly. It
    // used to leave `lastFetchTime` null while doing so, i.e. real policies shown
    // under "never fetched". The time belongs to the entry, not to this hook's
    // own load history.
    setEntry(POLICIES_CACHE_KEY, policies);

    const { result } = renderHook(() => usePoliciesData({ targetTabId: 1, onError }));

    expect(result.current.policies).toEqual(policies);
    expect(result.current.lastFetchTime).not.toBeNull();
    expect(api.listPolicies).not.toHaveBeenCalled();
  });

  it('loads ACCESS_POLICY policies and records the fetch time', async () => {
    const { result } = renderHook(() => usePoliciesData({ targetTabId: 1, onError }));

    expect(result.current.policies).toEqual([]);
    expect(result.current.lastFetchTime).toBeNull();

    await act(async () => {
      await result.current.loadPolicies();
    });

    expect(api.listPolicies).toHaveBeenCalledWith(AUTH_POLICY_TYPE);
    expect(result.current.policies).toEqual(policies);
    expect(result.current.lastFetchTime).not.toBeNull();
    expect(result.current.isLoading).toBe(false);
    // The banner is cleared at the start of a successful load.
    expect(onError).toHaveBeenCalledWith('');
  });

  it('serves a second load from the entity cache without refetching', async () => {
    const { result } = renderHook(() => usePoliciesData({ targetTabId: 1, onError }));

    await act(async () => {
      await result.current.loadPolicies();
    });
    await act(async () => {
      await result.current.loadPolicies();
    });

    expect(api.listPolicies).toHaveBeenCalledTimes(1);
    expect(result.current.policies).toEqual(policies);
  });

  it('bypasses the cache when forced', async () => {
    const { result } = renderHook(() => usePoliciesData({ targetTabId: 1, onError }));

    await act(async () => {
      await result.current.loadPolicies();
    });
    await act(async () => {
      await result.current.loadPolicies(true);
    });

    expect(api.listPolicies).toHaveBeenCalledTimes(2);
  });

  it('reports a missing Okta tab instead of fetching', async () => {
    const { result } = renderHook(() => usePoliciesData({ onError }));

    await act(async () => {
      await result.current.loadPolicies();
    });

    expect(api.listPolicies).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('No Okta tab connected');
    expect(result.current.policies).toEqual([]);
  });

  it('surfaces a rejected list read through onError', async () => {
    api.listPolicies.mockRejectedValue(new Error('scheduler unavailable'));
    const { result } = renderHook(() => usePoliciesData({ targetTabId: 1, onError }));

    await act(async () => {
      await result.current.loadPolicies();
    });

    expect(onError).toHaveBeenCalledWith('scheduler unavailable');
    expect(result.current.isLoading).toBe(false);
  });
});
