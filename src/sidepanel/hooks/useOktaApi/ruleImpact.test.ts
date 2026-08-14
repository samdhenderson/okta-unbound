/**
 * Tests for the rule-impact capture: zod validation at the response boundary
 * (ADR-0006) — malformed rule rows are dropped leniently by `parseOktaList`, so
 * they cannot skew the "who loses access" set math — and the RulesCache-first
 * raw-rules read (a fresh cache entry with raw rules means no re-pagination of
 * `/api/v1/groups/rules`).
 *
 * Fixtures use only fake placeholders (`0prFAKE…`, `00gFAKE…`, `00uFAKE…`,
 * `example.com`) per CLAUDE.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuleImpactOperations } from './ruleImpact';
import type { CoreApi } from './core';
import type { OktaGroupRule, OktaUser } from '../../../shared/types';
import { OperationCancelledError } from '../../../shared/scheduler/cancellation';
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
    const makeApiRequest = vi.fn(async (endpoint: string) => {
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
// RulesCache-first raw-rules read
// ---------------------------------------------------------------------------

const RULES_CACHE_KEY = 'global_rules_cache';

/** The analyzed rule, raw, as a RulesCache entry would carry it. */
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

/** makeApiRequest that serves group meta but rejects any rules pagination. */
function routeMetaOnly() {
  return vi.fn(async (endpoint: string) => {
    if (endpoint === '/api/v1/groups/00gFAKE1') {
      return {
        success: true,
        data: { id: '00gFAKE1', profile: { name: 'Target Group' }, type: 'OKTA_GROUP' },
      };
    }
    throw new Error(`Unrouted test endpoint: ${endpoint}`);
  });
}

describe('fetchRawRules RulesCache consultation', () => {
  const analyzedInput = {
    id: '0prFAKE1',
    name: 'Rule One',
    groupIds: ['00gFAKE1'],
    groupNames: ['Target Group'],
  };

  it('serves raw rules from a fresh cache entry with no rules pagination', async () => {
    seedRulesCache([cachedRawRule]);
    const makeApiRequest = routeMetaOnly();
    const core = makeCore({ makeApiRequest });
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers);

    const summary = await captureRuleImpact(analyzedInput);

    const rulesListings = makeApiRequest.mock.calls.filter((c) =>
      String(c[0]).startsWith('/api/v1/groups/rules'),
    );
    expect(rulesListings).toHaveLength(0);
    // The cached rule drove the set math: sole managing rule → member loses.
    expect(summary.totalLosing).toBe(1);
  });

  it('still paginates when the cache entry is expired', async () => {
    seedRulesCache([cachedRawRule], 10 * 60 * 1000); // older than the 5-min TTL
    const makeApiRequest = vi.fn(async (endpoint: string) => {
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
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers);

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
    seedRulesCache([cachedRawRule]); // rules come from cache; no rules fetch
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
    const { captureRuleImpact } = createRuleImpactOperations(core, vi.fn());

    await expect(captureRuleImpact(analyzedInput)).rejects.toBeInstanceOf(OperationCancelledError);
  });

  it('still paginates on a missing entry or a legacy entry without raw rules', async () => {
    // Legacy entry: fresh, but written before raw rules were cached.
    seedRulesCache([]);
    const makeApiRequest = vi.fn(async (endpoint: string) => {
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
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers);

    await captureRuleImpact(analyzedInput);

    const rulesListings = makeApiRequest.mock.calls.filter((c) =>
      String(c[0]).startsWith('/api/v1/groups/rules'),
    );
    expect(rulesListings).toHaveLength(1);
  });
});
