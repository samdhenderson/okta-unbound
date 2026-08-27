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
 *
 * RETARGETED for D-029b. "Already in hand" used to mean the `shared/rulesCache`
 * storage slot; it now means the background-owned org snapshot's `rules`
 * collection. Both assertions are unchanged — adopt without issuing a request,
 * and nothing in hand stays `unresolved` — only the store they are seeded
 * against moved (ADR-0022). Which store answers is pinned by
 * `useUserMemberships.ruleSource.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// jsdom has no IndexedDB and `fake-indexeddb` is not a dependency, so `idb` is
// faked with a Map, exactly as `shared/snapshot/orgSnapshotStore.test.ts` does.
const { fakeDB, idbTables } = vi.hoisted(() => {
  const idbTables = new Map<string, Map<string, unknown>>();
  const keyOf = (key: unknown) => (Array.isArray(key) ? key.join('::') : String(key));
  const table = (name: string) => {
    if (!idbTables.has(name)) idbTables.set(name, new Map());
    return idbTables.get(name) as Map<string, unknown>;
  };
  const fakeDB = {
    get: async (name: string, key: unknown) => table(name).get(keyOf(key)),
    put: async () => {},
    delete: async () => {},
    getAllFromIndex: async (name: string, _i: string, origin: string) =>
      [...table(name).values()].filter((v) => (v as { origin: string }).origin === origin),
    getAllKeysFromIndex: async () => [],
    transaction: () => ({
      store: { put: async () => {}, delete: async () => {} },
      done: Promise.resolve(),
    }),
  };
  return { fakeDB, idbTables };
});

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

import { useUserMemberships } from './useUserMemberships';
import { setEntry, resetEntityCache } from '../cache/entityCache';
import { detectConflicts, formatRuleForDisplay } from '../../shared/ruleUtils';
import { emptySyncMeta } from '../../shared/snapshot/syncMeta';
import type { OktaGroupRule, OktaUser } from '../../shared/types';

const tabsSendMessage = vi.fn();

globalThis.chrome = {
  tabs: { sendMessage: tabsSendMessage },
  storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
} as unknown as typeof chrome;

const ORIGIN = 'https://example.okta.com';
const WALKED_AT = 1_800_000_000_000;
const user = { id: 'u1' } as OktaUser;

/** An obviously-fake rule; only its identity matters to these assertions. */
const rawRule: OktaGroupRule = {
  id: '0prFAKErule00001',
  name: 'Contractors → VPN Access',
  status: 'ACTIVE',
  type: 'group_rule',
  created: '2026-01-01T00:00:00.000Z',
  lastUpdated: '2026-01-01T00:00:00.000Z',
  conditions: {
    expression: { value: 'user.userType == "Contractor"', type: 'urn:okta:expression:1.0' },
  },
  actions: { assignUserToGroups: { groupIds: ['00gFAKEgroup0001'] } },
};

/** The display shape the hook derives that raw row into. */
const rule = formatRuleForDisplay(rawRule, undefined, detectConflicts([rawRule]));

/**
 * Seed the org snapshot's `rules` collection as a completed walk would.
 *
 * The snapshot is IndexedDB the background already filled, so it can be served
 * without any content-script traffic — which is what makes adopt-on-cache-hit
 * legal.
 */
const primeSnapshotRules = (rawRules: OktaGroupRule[]): void => {
  const rows = new Map<string, unknown>(
    rawRules.map((entity) => [
      `${ORIGIN}::${entity.id}`,
      { origin: ORIGIN, id: entity.id, entity, syncedAt: WALKED_AT },
    ]),
  );
  idbTables.set('rules', rows);
  idbTables.set(
    'syncMeta',
    new Map([
      [
        `${ORIGIN}::rules`,
        {
          ...emptySyncMeta(ORIGIN, 'rules'),
          complete: true,
          lastFullWalkAt: WALKED_AT,
          itemCount: rawRules.length,
        },
      ],
    ]),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
  idbTables.clear();
});

describe('useUserMemberships rule inventory on a memberships cache hit', () => {
  it('adopts an already-cached inventory without issuing a request', async () => {
    setEntry(['userMemberships', user.id], []);
    primeSnapshotRules([rawRule]);

    const { result } = renderHook(() => useUserMemberships({ targetTabId: 1, oktaOrigin: ORIGIN }));
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

    const { result } = renderHook(() => useUserMemberships({ targetTabId: 1, oktaOrigin: ORIGIN }));

    await act(async () => {
      await result.current.loadMemberships(user);
    });

    // `unavailable` would say an attempt was made and failed. None was: this path
    // is forbidden from fetching, so the honest answer stays "not resolved".
    expect(result.current.rules).toEqual({ status: 'unresolved' });
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });
});
