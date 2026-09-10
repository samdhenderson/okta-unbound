/**
 * The rule inventory a memberships **cache hit** ends up holding.
 *
 * `loadMemberships` serves a cached analysis through an early return that skips
 * the fetcher entirely. The inventory is per-hook-instance state written by that
 * fetcher, so the cache-hit path used to leave it unset forever — and every
 * downstream "why does this user not have that group" answer degraded into "the
 * rules targeting this group could not be loaded", a failure that never happened.
 *
 * Two things are pinned here:
 *
 * 1. An inventory already in hand is adopted with **no** request at all — the
 *    entity cache and the org snapshot are both local reads, so a cache hit
 *    still costs nothing.
 * 2. Nothing in hand no longer ends the story. The path asks for the rules
 *    listing and publishes what the attempt returned.
 *
 * RETARGETED twice. First for D-029b: "already in hand" used to mean the
 * `shared/rulesCache` storage slot and now means the background-owned org
 * snapshot's `rules` collection (which store answers is pinned by
 * `useUserMemberships.ruleSource.test.tsx`).
 *
 * Then for the certainty ladder's third rung. The second case used to assert
 * that nothing in hand left the inventory `unresolved`, on the reasoning that
 * this path is forbidden from fetching and `unresolved` is the honest answer for
 * an attempt nobody made. Both halves were true and the outcome was still wrong:
 * nothing else on this path ever resolved the state, so a user opened from a
 * warm memberships cache with a cold snapshot reported "not computed" for every
 * membership, permanently, on a fully-loaded screen. The assertion is retargeted
 * to the new boundary rather than relaxed — the fetch is now expected, and its
 * result is what gets published. `unresolved` surviving an attempt would be the
 * bug now.
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
/**
 * The background scheduler's transport. Answers the one paginated rules listing
 * with the same raw row the snapshot fixture uses, so the two cases below differ
 * only in *where* the inventory came from.
 */
const runtimeSendMessage = vi.fn(async (_message: unknown) => ({
  success: true,
  data: [rawRule],
  headers: {},
}));

globalThis.chrome = {
  tabs: { sendMessage: tabsSendMessage },
  runtime: { sendMessage: runtimeSendMessage, lastError: undefined },
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

  it('asks for the rules listing when neither local source holds one', async () => {
    setEntry(['userMemberships', user.id], []);

    const { result } = renderHook(() => useUserMemberships({ targetTabId: 1, oktaOrigin: ORIGIN }));

    await act(async () => {
      await result.current.loadMemberships(user);
    });

    // The rules listing is scheduler-routed, so the request goes to the
    // background rather than straight to the tab.
    await waitFor(() =>
      expect(runtimeSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'scheduleApiRequest' }),
      ),
    );
    expect(runtimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: expect.stringContaining('/api/v1/groups/rules') }),
    );
    expect(tabsSendMessage).not.toHaveBeenCalled();

    // And the attempt's outcome is published. It stays `unresolved` only while
    // nobody has tried; somebody has now.
    await waitFor(() => expect(result.current.rules.status).not.toBe('unresolved'));
    // Identity, not the whole row: the fetched path additionally stamps the
    // group-name fields the snapshot-derived path leaves off, and which of the
    // two shapes arrives is `fetchGroupRulesRequest`'s contract, not this one's.
    expect(result.current.rules).toMatchObject({
      status: 'available',
      rules: [{ id: rule.id, conditionExpression: rule.conditionExpression }],
    });
  });
});
