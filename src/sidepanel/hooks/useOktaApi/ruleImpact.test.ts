/**
 * Tests for the rule-impact capture: zod validation at the response boundary
 * (ADR-0006) — malformed rule rows are dropped leniently by `parseOktaList`, so
 * they cannot skew the "who loses access" set math — and the snapshot-first
 * raw-rules read (rows stored for the connected org mean no re-pagination of
 * `/api/v1/groups/rules`).
 *
 * RETARGETED for D-029a. The raw-rules read moved from `shared/rulesCache` to
 * the background-owned org snapshot, so the four cases that pinned the
 * cache-first read are retargeted assertion-by-assertion onto the new source
 * rather than dropped (ADR-0022): "serves from a fresh cache entry with no
 * pagination" → "serves from the org snapshot with no pagination"; "still
 * paginates when the cache entry is expired" → "ignores a RulesCache entry now
 * that the snapshot is the source of rules" (the TTL it pinned no longer
 * exists, and the property that replaced it — the second source is not
 * consulted at all — is what makes the two sources unable to disagree); "still
 * paginates on a missing/legacy entry" → "still paginates on a cold snapshot".
 * Two cases the old source had no equivalent for are added: no origin yet, and
 * a snapshot holding a different org.
 *
 * D-038 changed the gate from "the snapshot returned rows" to "the collection's
 * walk completed", so `seedSnapshotRules` now also records the completion a real
 * walk would, and two cases pin the two directions the row count got wrong: a
 * mid-walk snapshot must not be served, and a complete-but-empty one must be.
 *
 * Fixtures use only fake placeholders (`0prFAKE…`, `00gFAKE…`, `00uFAKE…`,
 * `example.com`) per CLAUDE.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { createRuleImpactOperations } from './ruleImpact';
import type { CoreApi } from './core';
import { emptySyncMeta } from '../../../shared/snapshot/syncMeta';
import type { SyncMeta } from '../../../shared/snapshot/types';
import type { OktaGroupRule, OktaUser } from '../../../shared/types';
import { OperationCancelledError } from '../../../shared/scheduler/cancellation';
import type { RequestResult } from '../../../shared/scheduler/types';
import { makeFakeCore, sequentialRunOperation } from '@/test/factories/coreApi';

/** Build a fake CoreApi whose runOperation actually drives the per-item task. */
const makeCore = (overrides: Partial<CoreApi> = {}): CoreApi =>
  makeFakeCore({ runOperation: sequentialRunOperation(), ...overrides });

/** A member of the analyzed target group. */
const member: OktaUser = {
  id: '00uFAKE1',
  status: 'ACTIVE',
  profile: {
    login: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Fake',
  },
};

beforeEach(() => {
  // The RulesCache reads chrome.storage.local; default every test to an absent
  // entry (a cache miss) so only the cache-specific tests below seed one.
  vi.mocked(chrome.storage.local.get).mockReset();
  vi.mocked(chrome.storage.local.remove).mockReset();
  idbTables.clear();
});

describe('captureRuleImpact boundary validation', () => {
  it('drops a malformed rule row leniently so it cannot skew the impact math', async () => {
    const analyzedRule = {
      id: '0prFAKE1',
      name: 'Rule One',
      status: 'ACTIVE',
      actions: { assignUserToGroups: { groupIds: ['00gFAKE1'] } },
    };
    // Numeric `id` fails the schema — the lenient list parser drops the row. If
    // it were NOT dropped, it would read as a second active rule targeting the
    // group and wrongly flip the member from "losing" to "retaining".
    const malformedRule = {
      id: 999,
      name: 'Broken Rule',
      status: 'ACTIVE',
      actions: { assignUserToGroups: { groupIds: ['00gFAKE1'] } },
    };
    const makeApiRequest = vi.fn(async (endpoint: string): Promise<RequestResult> => {
      if (endpoint.startsWith('/api/v1/groups/rules')) {
        return { success: true, data: [analyzedRule, malformedRule], headers: {} };
      }
      if (endpoint === '/api/v1/groups/00gFAKE1') {
        return {
          success: true,
          data: { id: '00gFAKE1', profile: { name: 'Target Group' }, type: 'OKTA_GROUP' },
        };
      }
      throw new Error(`Unrouted test endpoint: ${endpoint}`);
    });
    const core = makeCore({ makeApiRequest });
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers);

    const summary = await captureRuleImpact({
      id: '0prFAKE1',
      name: 'Rule One',
      groupIds: ['00gFAKE1'],
      groupNames: ['Target Group'],
    });

    // The malformed rule was dropped, so the analyzed rule is the sole managing
    // rule and the member loses access on deactivation.
    expect(summary.targetGroups).toHaveLength(1);
    expect(summary.targetGroups[0].losingCount).toBe(1);
    expect(summary.totalLosing).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Snapshot-first raw-rules read (D-029a)
// ---------------------------------------------------------------------------

const ORIGIN = 'https://example.okta.com';
const WALKED_AT = 1_800_000_000_000;
const RULES_CACHE_KEY = 'global_rules_cache';

/** The analyzed rule, raw, as the snapshot's `rules` collection carries it. */
const cachedRawRule: OktaGroupRule = {
  id: '0prFAKE1',
  name: 'Rule One',
  status: 'ACTIVE',
  type: 'group_rule',
  created: '2020-01-01T00:00:00.000Z',
  lastUpdated: '2024-01-01T00:00:00.000Z',
  actions: { assignUserToGroups: { groupIds: ['00gFAKE1'] } },
};

/** Seed chrome.storage.local with a RulesCache entry. */
function seedRulesCache(rawRules: OktaGroupRule[], ageMs = 0) {
  vi.mocked(chrome.storage.local.get).mockResolvedValue({
    [RULES_CACHE_KEY]: {
      rules: [],
      rawRules,
      stats: { total: rawRules.length, active: rawRules.length, inactive: 0, conflicts: 0 },
      conflicts: [],
      timestamp: Date.now() - ageMs,
      ttl: 5 * 60 * 1000,
    },
  } as never);
  vi.mocked(chrome.storage.local.remove).mockResolvedValue(undefined as never);
}

/**
 * Write the `rules` collection's sync bookkeeping, as the background walk would.
 *
 * Keyed `${origin}::rules` because the store reads it with the composite key
 * `[origin, collection]`, which the IndexedDB fake joins with `::`.
 */
function seedRulesMeta(patch: Partial<SyncMeta>, origin = ORIGIN) {
  const table = (idbTables.get('syncMeta') ?? new Map()) as Map<string, unknown>;
  table.set(`${origin}::rules`, { ...emptySyncMeta(origin, 'rules'), ...patch });
  idbTables.set('syncMeta', table);
}

/** Write rule rows into the snapshot the panel reads, as a completed walk would. */
function seedSnapshotRules(rules: OktaGroupRule[], origin = ORIGIN) {
  const table = (idbTables.get('rules') ?? new Map()) as Map<string, unknown>;
  for (const entity of rules) {
    table.set(`${origin}::${entity.id}`, { origin, id: entity.id, entity, syncedAt: WALKED_AT });
  }
  idbTables.set('rules', table);
  // A completed walk records its own completion; the rows alone are not the
  // contract a reader is allowed to trust (ADR-0040 §7, D-038).
  seedRulesMeta({ complete: true, lastFullWalkAt: WALKED_AT, itemCount: rules.length }, origin);
}

/** makeApiRequest that serves group meta but rejects any rules pagination. */
function routeMetaOnly() {
  return vi.fn(async (endpoint: string): Promise<RequestResult> => {
    if (endpoint === '/api/v1/groups/00gFAKE1') {
      return {
        success: true,
        data: { id: '00gFAKE1', profile: { name: 'Target Group' }, type: 'OKTA_GROUP' },
      };
    }
    throw new Error(`Unrouted test endpoint: ${endpoint}`);
  });
}

describe('fetchRawRules snapshot consultation', () => {
  const analyzedInput = {
    id: '0prFAKE1',
    name: 'Rule One',
    groupIds: ['00gFAKE1'],
    groupNames: ['Target Group'],
  };

  it('serves raw rules from the org snapshot with no rules pagination', async () => {
    seedSnapshotRules([cachedRawRule]);
    const makeApiRequest = routeMetaOnly();
    const core = makeCore({ makeApiRequest });
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers, ORIGIN);

    const summary = await captureRuleImpact(analyzedInput);

    const rulesListings = makeApiRequest.mock.calls.filter((c) =>
      String(c[0]).startsWith('/api/v1/groups/rules'),
    );
    expect(rulesListings).toHaveLength(0);
    // The snapshot's rule drove the set math: sole managing rule → member loses.
    expect(summary.totalLosing).toBe(1);
  });

  it('ignores a RulesCache entry now that the snapshot is the source of rules', async () => {
    // A warm legacy cache and a cold snapshot: the cache must not be consulted,
    // so the capture pays for the listing rather than reading a second source
    // that can disagree with the snapshot by up to its own TTL (D-029).
    seedRulesCache([cachedRawRule]);
    const makeApiRequest = vi.fn(async (endpoint: string): Promise<RequestResult> => {
      if (endpoint.startsWith('/api/v1/groups/rules')) {
        return { success: true, data: [cachedRawRule], headers: {} };
      }
      return {
        success: true,
        data: { id: '00gFAKE1', profile: { name: 'Target Group' }, type: 'OKTA_GROUP' },
      };
    });
    const core = makeCore({ makeApiRequest });
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers, ORIGIN);

    await captureRuleImpact(analyzedInput);

    const rulesListings = makeApiRequest.mock.calls.filter((c) =>
      String(c[0]).startsWith('/api/v1/groups/rules'),
    );
    expect(rulesListings).toHaveLength(1);
  });

  it('still paginates when no origin has resolved yet', async () => {
    // The snapshot holds this org's rules, but with no origin there is no way to
    // know they are *this* org's — degrade to the fetch, never throw.
    seedSnapshotRules([cachedRawRule]);
    const makeApiRequest = vi.fn(async (endpoint: string): Promise<RequestResult> => {
      if (endpoint.startsWith('/api/v1/groups/rules')) {
        return { success: true, data: [cachedRawRule], headers: {} };
      }
      return {
        success: true,
        data: { id: '00gFAKE1', profile: { name: 'Target Group' }, type: 'OKTA_GROUP' },
      };
    });
    const core = makeCore({ makeApiRequest });
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers, null);

    const summary = await captureRuleImpact(analyzedInput);

    const rulesListings = makeApiRequest.mock.calls.filter((c) =>
      String(c[0]).startsWith('/api/v1/groups/rules'),
    );
    expect(rulesListings).toHaveLength(1);
    expect(summary.totalLosing).toBe(1);
  });

  it('reads only the connected org, paginating when the snapshot holds another org', async () => {
    // Rows and meta both land under the *other* origin, so this org's snapshot
    // is cold: nothing stored and no completed walk recorded.
    seedSnapshotRules([cachedRawRule], 'https://other.okta.com');
    const makeApiRequest = vi.fn(async (endpoint: string): Promise<RequestResult> => {
      if (endpoint.startsWith('/api/v1/groups/rules')) {
        return { success: true, data: [cachedRawRule], headers: {} };
      }
      return {
        success: true,
        data: { id: '00gFAKE1', profile: { name: 'Target Group' }, type: 'OKTA_GROUP' },
      };
    });
    const core = makeCore({ makeApiRequest });
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers, ORIGIN);

    await captureRuleImpact(analyzedInput);

    const rulesListings = makeApiRequest.mock.calls.filter((c) =>
      String(c[0]).startsWith('/api/v1/groups/rules'),
    );
    expect(rulesListings).toHaveLength(1);
  });

  // The target-group loads now run through coreApi.runOperation (ADR-0009); a
  // cancel reported by the runner surfaces as an OperationCancelledError so the
  // caller's error path (not a bogus empty summary) handles it.
  it('raises OperationCancelledError when the target-group load is cancelled', async () => {
    seedSnapshotRules([cachedRawRule]); // rules come from the snapshot; no rules fetch
    const cancelledOutcome = {
      results: [],
      total: 1,
      completed: 0,
      failed: 0,
      skipped: 1,
      stoppedByError: false,
      cancelled: true,
    };
    const runOperation = vi
      .fn()
      .mockResolvedValue(cancelledOutcome) as unknown as CoreApi['runOperation'];
    const core = makeCore({ makeApiRequest: routeMetaOnly(), runOperation });
    const { captureRuleImpact } = createRuleImpactOperations(core, vi.fn(), ORIGIN);

    await expect(captureRuleImpact(analyzedInput)).rejects.toBeInstanceOf(OperationCancelledError);
  });

  it('still paginates on a cold snapshot', async () => {
    // Nothing stored for this org yet — the background walk has not landed.
    const makeApiRequest = vi.fn(async (endpoint: string): Promise<RequestResult> => {
      if (endpoint.startsWith('/api/v1/groups/rules')) {
        return { success: true, data: [cachedRawRule], headers: {} };
      }
      return {
        success: true,
        data: { id: '00gFAKE1', profile: { name: 'Target Group' }, type: 'OKTA_GROUP' },
      };
    });
    const core = makeCore({ makeApiRequest });
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers, ORIGIN);

    await captureRuleImpact(analyzedInput);

    const rulesListings = makeApiRequest.mock.calls.filter((c) =>
      String(c[0]).startsWith('/api/v1/groups/rules'),
    );
    expect(rulesListings).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // D-038: `complete`, not row count, is the gate
  // -------------------------------------------------------------------------

  it('does not serve a mid-walk snapshot as the org, paginating instead', async () => {
    // Rows are present but the walk was interrupted mid-cursor, so the rows are
    // a prefix of the org, not the org. Trusting them can leave a rule that Okta
    // has already deleted in the set — which reads as "another active rule still
    // covers this member" and understates the impact of a deactivation. The
    // partial snapshot below holds exactly that ghost (`0prFAKE1`, targeting the
    // same group) alongside the analyzed rule, while the authoritative listing
    // shows the analyzed rule alone.
    const analyzedRule: OktaGroupRule = { ...cachedRawRule, id: '0prFAKE9', name: 'Rule Nine' };
    const staleGhostRule: OktaGroupRule = { ...cachedRawRule, id: '0prFAKE1' };
    seedSnapshotRules([analyzedRule, staleGhostRule]);
    seedRulesMeta({
      complete: false,
      cursor: '/api/v1/groups/rules?after=0prFAKE1',
      lastFullWalkAt: null,
    });
    const makeApiRequest = vi.fn(async (endpoint: string): Promise<RequestResult> => {
      if (endpoint.startsWith('/api/v1/groups/rules')) {
        return { success: true, data: [analyzedRule], headers: {} };
      }
      return {
        success: true,
        data: { id: '00gFAKE1', profile: { name: 'Target Group' }, type: 'OKTA_GROUP' },
      };
    });
    const core = makeCore({ makeApiRequest });
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers, ORIGIN);

    const summary = await captureRuleImpact({ ...analyzedInput, id: '0prFAKE9' });

    const rulesListings = makeApiRequest.mock.calls.filter((c) =>
      String(c[0]).startsWith('/api/v1/groups/rules'),
    );
    expect(rulesListings).toHaveLength(1);
    // Served from the authoritative listing: the analyzed rule is the only one
    // covering the member, so deactivating it costs them access.
    expect(summary.totalLosing).toBe(1);
  });

  it('serves a complete-but-empty snapshot without re-paginating', async () => {
    // An org with genuinely zero group rules: the walk finished and stored
    // nothing. A row-count gate can never be satisfied by that, so it re-listed
    // `/api/v1/groups/rules` on every impact preview of a fully synced org.
    seedRulesMeta({ complete: true, lastFullWalkAt: WALKED_AT, itemCount: 0 });
    const makeApiRequest = routeMetaOnly();
    const core = makeCore({ makeApiRequest });
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers, ORIGIN);

    const summary = await captureRuleImpact(analyzedInput);

    const rulesListings = makeApiRequest.mock.calls.filter((c) =>
      String(c[0]).startsWith('/api/v1/groups/rules'),
    );
    expect(rulesListings).toHaveLength(0);
    // No rule manages the member, so the analyzed rule's deactivation costs
    // nobody access — the empty snapshot really was the answer used.
    expect(summary.totalLosing).toBe(0);
  });
});
