/**
 * The rule inventory a memberships **cache hit** ends up holding.
 *
 * `loadMemberships` serves a cached analysis through an early return that skips
 * the fetcher entirely. The inventory is per-hook-instance state written by that
 * fetcher, so the cache-hit path used to leave it unset forever — and every
 * downstream "why does this user not have that group" answer degraded into "the
 * rules targeting this group could not be loaded", a failure that never happened.
 *
 * Two things are pinned here, and they pull against each other:
 *
 * 1. The path still issues **no** content-script request (the contract
 *    `useUserMemberships.test.tsx` pins for the same early return), so it may only
 *    adopt an inventory already in hand.
 * 2. Nothing in hand therefore leaves the inventory `unresolved` — "nobody has
 *    fetched these yet" — which is a different claim from the `unavailable` that
 *    only a real, failed attempt may write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserMemberships } from './useUserMemberships';
import { setEntry, resetEntityCache } from '../cache/entityCache';
import type { FormattedRule, OktaUser } from '../../shared/types';

const tabsSendMessage = vi.fn();
const storageGet = vi.fn();

// `RulesCache` is a chrome.storage.local slot, so it can be served without any
// content-script traffic — which is exactly what makes adopt-on-cache-hit legal.
globalThis.chrome = {
  tabs: { sendMessage: tabsSendMessage },
  storage: { local: { get: storageGet, set: vi.fn(), remove: vi.fn() } },
} as unknown as typeof chrome;

const user = { id: 'u1' } as OktaUser;

/** An obviously-fake rule; only its identity matters to these assertions. */
const rule: FormattedRule = {
  id: '0prFAKErule00001',
  name: 'Contractors → VPN Access',
  status: 'ACTIVE',
  condition: 'user.userType == "Contractor"',
  conditionExpression: 'user.userType == "Contractor"',
  groupIds: ['00gFAKEgroup0001'],
  userAttributes: ['userType'],
  created: '2026-01-01T00:00:00.000Z',
  lastUpdated: '2026-01-01T00:00:00.000Z',
};

/** A live (un-expired) RulesCache slot holding `rules`. */
const primeRulesCache = (rules: FormattedRule[]): void => {
  storageGet.mockResolvedValue({
    global_rules_cache: {
      rules,
      groupNames: {},
      conflicts: [],
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000,
    },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
  storageGet.mockResolvedValue({});
});

describe('useUserMemberships rule inventory on a memberships cache hit', () => {
  it('adopts an already-cached inventory without issuing a request', async () => {
    setEntry(['userMemberships', user.id], []);
    primeRulesCache([rule]);

    const { result } = renderHook(() => useUserMemberships({ targetTabId: 1 }));
    expect(result.current.rules).toEqual({ status: 'unresolved' });

    await act(async () => {
      await result.current.loadMemberships(user);
    });

    // Adoption is fire-and-forget so the cached analysis still renders instantly.
    await waitFor(() =>
      expect(result.current.rules).toEqual({ status: 'available', rules: [rule] }),
    );
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });

  it('leaves the inventory unresolved — never unavailable — when nothing is cached', async () => {
    setEntry(['userMemberships', user.id], []);

    const { result } = renderHook(() => useUserMemberships({ targetTabId: 1 }));

    await act(async () => {
      await result.current.loadMemberships(user);
    });

    // `unavailable` would say an attempt was made and failed. None was: this path
    // is forbidden from fetching, so the honest answer stays "not resolved".
    expect(result.current.rules).toEqual({ status: 'unresolved' });
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });
});
