/**
 * @module sidepanel/hooks/useUserMemberships.ruleSource.test
 * @description Where the rule inventory behind "why is this user in this group"
 * comes from (D-029b).
 *
 * The hook used to read `shared/rulesCache`, a `chrome.storage.local` slot with
 * its own five-minute TTL, while every other rule-derived surface reads the
 * background-owned org snapshot. Two stores, one screen, and up to five minutes
 * of legal disagreement that nothing detected and nothing showed.
 *
 * Two kinds of case below, deliberately:
 *
 * - **Characterisation.** When the two stores agree, the inventory is the
 *   derived display shape — `detectConflicts` once, then `formatRuleForDisplay`
 *   per raw row, with no `currentGroupId` because the inventory is org-wide.
 *   These pin the *output*, not the source, so they passed before the migration
 *   and after it, which is what makes them evidence the fix changed only what it
 *   claimed to.
 * - **Disagreement.** When the two stores hold different rules, the snapshot —
 *   the collection the background walks and every other surface reads — is the
 *   answer. These are the cases that fail on the old code.
 *
 * Fixtures use fake placeholders only (`0prFAKE…`, `00gFAKE…`, `00uFAKE…`,
 * `example.okta.com`) per CLAUDE.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// IndexedDB fake
// ---------------------------------------------------------------------------
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

vi.mock('./getUserGroupsRequest', () => ({ getUserGroupsRequest: vi.fn() }));
vi.mock('./fetchGroupRulesRequest', () => ({ fetchGroupRulesRequest: vi.fn() }));

import { useUserMemberships } from './useUserMemberships';
import { getUserGroupsRequest } from './getUserGroupsRequest';
import { fetchGroupRulesRequest } from './fetchGroupRulesRequest';
import { setEntry, resetEntityCache } from '../cache/entityCache';
import { detectConflicts, formatRuleForDisplay } from '../../shared/ruleUtils';
import { emptySyncMeta } from '../../shared/snapshot/syncMeta';
import type { SyncMeta } from '../../shared/snapshot/types';
import type { FormattedRule, OktaGroupRule, OktaUser } from '../../shared/types';

const ORIGIN = 'https://example.okta.com';
const WALKED_AT = 1_800_000_000_000;
const RULES_CACHE_KEY = 'global_rules_cache';

const storageGet = vi.fn();
globalThis.chrome = {
  tabs: { sendMessage: vi.fn() },
  storage: { local: { get: storageGet, set: vi.fn(), remove: vi.fn() } },
} as unknown as typeof chrome;

const user = { id: '00uFAKEuser00001' } as OktaUser;

/** The rule the org actually has right now, raw, as the snapshot stores it. */
const currentRawRule: OktaGroupRule = {
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

/** A rule that no longer exists in the org — only a stale second store has it. */
const staleRawRule: OktaGroupRule = {
  ...currentRawRule,
  id: '0prFAKErule00002',
  name: 'Interns → VPN Access',
  conditions: {
    expression: { value: 'user.userType == "Intern"', type: 'urn:okta:expression:1.0' },
  },
};

/**
 * The display shape a raw inventory derives to.
 *
 * The same two calls `useGroupsLoader` makes: conflicts detected once across the
 * whole inventory, then each row formatted with no `currentGroupId` (the
 * inventory is org-wide, so one group's `affectsCurrentGroup` flag would be
 * wrong for every other consumer).
 */
const derive = (rawRules: OktaGroupRule[]): FormattedRule[] => {
  const conflicts = detectConflicts(rawRules);
  return rawRules.map((rule) => formatRuleForDisplay(rule, undefined, conflicts));
};

/** Seed the legacy `chrome.storage.local` rules slot, un-expired. */
function primeRulesCache(rawRules: OktaGroupRule[]): void {
  storageGet.mockResolvedValue({
    [RULES_CACHE_KEY]: {
      rules: derive(rawRules),
      rawRules,
      groupNames: {},
      stats: { total: rawRules.length, active: rawRules.length, inactive: 0, conflicts: 0 },
      conflicts: [],
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000,
    },
  });
}

/** Write the `rules` collection's sync bookkeeping, as the background walk would. */
function seedRulesMeta(patch: Partial<SyncMeta>): void {
  const table = (idbTables.get('syncMeta') ?? new Map()) as Map<string, unknown>;
  table.set(`${ORIGIN}::rules`, { ...emptySyncMeta(ORIGIN, 'rules'), ...patch });
  idbTables.set('syncMeta', table);
}

/** Seed the org snapshot's `rules` collection as a completed walk would. */
function primeSnapshotRules(rawRules: OktaGroupRule[], complete = true): void {
  const table = (idbTables.get('rules') ?? new Map()) as Map<string, unknown>;
  for (const entity of rawRules) {
    table.set(`${ORIGIN}::${entity.id}`, {
      origin: ORIGIN,
      id: entity.id,
      entity,
      syncedAt: WALKED_AT,
    });
  }
  idbTables.set('rules', table);
  seedRulesMeta({
    complete,
    lastFullWalkAt: complete ? WALKED_AT : null,
    itemCount: rawRules.length,
  });
}

/** Render the hook for the connected org and run a full (uncached) load. */
async function loadFresh(): Promise<FormattedRule[] | undefined> {
  const { result } = renderHook(() => useUserMemberships({ targetTabId: 1, oktaOrigin: ORIGIN }));
  await act(async () => {
    await result.current.loadMemberships(user);
  });
  const inventory = result.current.rules;
  return inventory.status === 'available' ? inventory.rules : undefined;
}

/** Render the hook and take the memberships-cache-hit (adopt-only) path. */
async function loadFromCacheHit(): Promise<FormattedRule[] | undefined> {
  setEntry(['userMemberships', user.id], []);
  const { result } = renderHook(() => useUserMemberships({ targetTabId: 1, oktaOrigin: ORIGIN }));
  await act(async () => {
    await result.current.loadMemberships(user);
  });
  // Adoption is fire-and-forget so the cached analysis still renders instantly.
  await waitFor(() => expect(result.current.rules.status).toBe('available'));
  const inventory = result.current.rules;
  return inventory.status === 'available' ? inventory.rules : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
  idbTables.clear();
  storageGet.mockResolvedValue({});
  vi.mocked(getUserGroupsRequest).mockResolvedValue({
    success: true,
    count: 0,
    data: [],
  } as unknown as Awaited<ReturnType<typeof getUserGroupsRequest>>);
  vi.mocked(fetchGroupRulesRequest).mockResolvedValue({
    success: false,
    error: 'the test did not expect a rules listing',
  } as unknown as Awaited<ReturnType<typeof fetchGroupRulesRequest>>);
});

describe('useUserMemberships rule inventory shape', () => {
  it('publishes the derived display shape on a full load', async () => {
    primeRulesCache([currentRawRule]);
    primeSnapshotRules([currentRawRule]);

    expect(await loadFresh()).toEqual(derive([currentRawRule]));
    expect(fetchGroupRulesRequest).not.toHaveBeenCalled();
  });

  it('publishes the derived display shape on a memberships cache hit', async () => {
    primeRulesCache([currentRawRule]);
    primeSnapshotRules([currentRawRule]);

    expect(await loadFromCacheHit()).toEqual(derive([currentRawRule]));
    expect(fetchGroupRulesRequest).not.toHaveBeenCalled();
  });
});

describe('useUserMemberships when the two rule stores disagree', () => {
  it('answers from the org snapshot on a full load', async () => {
    // The org has one rule; the legacy slot still holds a rule that was deleted
    // from Okta within its TTL. Attribution must not be derived from the deleted
    // one while the rest of the panel derives from the live collection.
    primeRulesCache([staleRawRule]);
    primeSnapshotRules([currentRawRule]);

    expect(await loadFresh()).toEqual(derive([currentRawRule]));
  });

  it('answers from the org snapshot on a memberships cache hit', async () => {
    primeRulesCache([staleRawRule]);
    primeSnapshotRules([currentRawRule]);

    expect(await loadFromCacheHit()).toEqual(derive([currentRawRule]));
  });
});

describe('useUserMemberships when the snapshot cannot answer', () => {
  it('lists the rules when the org has no completed walk', async () => {
    // A mid-walk snapshot is a prefix of the org, not the org (ADR-0040 §7): a
    // rule missing from it makes its target group look untargeted, which the
    // classifier reports as a confident "added by hand". So it is not served.
    primeSnapshotRules([currentRawRule], false);
    vi.mocked(fetchGroupRulesRequest).mockResolvedValue({
      success: true,
      rules: derive([currentRawRule, staleRawRule]),
    } as unknown as Awaited<ReturnType<typeof fetchGroupRulesRequest>>);

    expect(await loadFresh()).toEqual(derive([currentRawRule, staleRawRule]));
    expect(fetchGroupRulesRequest).toHaveBeenCalled();
  });

  it('reports an empty completed walk as an answer, not as a failure', async () => {
    // "The org genuinely has no rules" is a fact; degrading it into a fetch (or
    // into `unavailable`) is what turns a real answer into a wrong one.
    primeSnapshotRules([]);

    expect(await loadFresh()).toEqual([]);
    expect(fetchGroupRulesRequest).not.toHaveBeenCalled();
  });
});
