/**
 * Tests for `useRulesData`'s cache population: a rules load stores the REAL raw
 * rules (from the same single fetch that produced the formatted ones) in the
 * RulesCache entry, so raw-rule consumers (rule-impact analysis) stop
 * re-paginating `/api/v1/groups/rules`.
 *
 * Fixtures use only fake placeholders (`0prFAKE…`, `00gFAKE…`) per CLAUDE.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useRulesData } from './useRulesData';
import { ProgressProvider } from '../contexts/ProgressContext';
import { RulesCache } from '../../shared/rulesCache';
import type { RulesCacheEntry } from '../../shared/rulesCache';
import { formatRuleForDisplay } from '../../shared/ruleUtils';
import { fetchGroupRulesRequest } from './fetchGroupRulesRequest';
import type { FormattedRule, OktaGroupRule, RuleStats } from '../../shared/types';

vi.mock('../../shared/rulesCache', () => ({
  RulesCache: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./fetchGroupRulesRequest', () => ({
  fetchGroupRulesRequest: vi.fn(),
}));

const rulesCacheGet = vi.mocked(RulesCache.get);
const rulesCacheSet = vi.mocked(RulesCache.set);
const fetchRules = vi.mocked(fetchGroupRulesRequest);

/** The raw rule exactly as Okta returned it. */
const rawRule: OktaGroupRule = {
  id: '0prFAKE1',
  name: 'Rule One',
  status: 'ACTIVE',
  type: 'group_rule',
  created: '2020-01-01T00:00:00.000Z',
  lastUpdated: '2024-01-01T00:00:00.000Z',
  actions: { assignUserToGroups: { groupIds: ['00gFAKE1'] } },
};

/** The same rule shaped for display. */
const formattedRule: FormattedRule = {
  id: '0prFAKE1',
  name: 'Rule One',
  status: 'ACTIVE',
  condition: 'Everyone',
  groupIds: ['00gFAKE1'],
  userAttributes: [],
  created: '2020-01-01T00:00:00.000Z',
  lastUpdated: '2024-01-01T00:00:00.000Z',
};

const stats: RuleStats = { total: 1, active: 1, inactive: 0, conflicts: 0 };

const wrapper = ({ children }: { children: ReactNode }) => (
  <ProgressProvider>{children}</ProgressProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  rulesCacheGet.mockResolvedValue(null); // cache miss → loadRules fetches
  rulesCacheSet.mockResolvedValue(undefined);
});

describe('useRulesData cache population', () => {
  it('stores the real raw rules in the RulesCache entry after a rules load', async () => {
    fetchRules.mockResolvedValue({
      success: true,
      rules: [formattedRule],
      rawRules: [rawRule],
      stats,
      conflicts: [],
    });
    const { result } = renderHook(
      () => useRulesData({ targetTabId: 1, onError: vi.fn(), currentGroupId: undefined }),
      { wrapper },
    );

    await act(async () => {
      await result.current.loadRules();
    });

    // ONE fetch produced both shapes — and the raw rules land in the cache.
    expect(fetchRules).toHaveBeenCalledTimes(1);
    expect(rulesCacheSet).toHaveBeenCalledWith([formattedRule], [rawRule], stats, []);
  });

  it('still writes an empty raw list when the response carries none', async () => {
    fetchRules.mockResolvedValue({
      success: true,
      rules: [formattedRule],
      stats,
      conflicts: [],
    });
    const { result } = renderHook(() => useRulesData({ targetTabId: 1, onError: vi.fn() }), {
      wrapper,
    });

    await act(async () => {
      await result.current.loadRules();
    });

    expect(rulesCacheSet).toHaveBeenCalledWith([formattedRule], [], stats, []);
  });
});

/**
 * The cache-HIT branch (`useRulesData.ts` — `RulesCache.get()` → `setRules(...)`).
 * The suite's `beforeEach` forces a MISS, so this block re-stubs the getter.
 *
 * These are characterization tests: they pin what the hit branch produces TODAY,
 * including the fact that rules served from the cache carry a falsy
 * `affectsCurrentGroup` regardless of `currentGroupId`. That is the WRITE side
 * behaving correctly and deliberately — `groupDiscovery.fetchAndCacheAllGroupRules`
 * formats with `formatRuleForDisplay(rule, undefined, conflicts)` because the cache
 * entry is org-wide, and baking one group's flag into a shared entry would be
 * wrong. Any later fix belongs in the READER; the writer's contract pinned here
 * stays true either way.
 */
describe('useRulesData cache hit', () => {
  /** A second raw rule that targets a DIFFERENT group, so filtering is observable. */
  const otherRawRule: OktaGroupRule = {
    id: '0prFAKE2',
    name: 'Rule Two',
    status: 'INACTIVE',
    type: 'group_rule',
    created: '2021-01-01T00:00:00.000Z',
    lastUpdated: '2024-06-01T00:00:00.000Z',
    actions: { assignUserToGroups: { groupIds: ['00gFAKE2'] } },
  };

  /**
   * Exactly how the writer builds the cached entry: the real formatter, called
   * with `undefined` for `currentGroupId` (see `groupDiscovery.ts`).
   */
  const cachedRules: FormattedRule[] = [rawRule, otherRawRule].map((r) =>
    formatRuleForDisplay(r, undefined, []),
  );
  const cachedStats: RuleStats = { total: 2, active: 1, inactive: 1, conflicts: 0 };
  const CACHED_AT = Date.parse('2026-05-01T12:00:00.000Z');

  const cacheEntry: RulesCacheEntry = {
    rules: cachedRules,
    rawRules: [rawRule, otherRawRule],
    stats: cachedStats,
    conflicts: [],
    timestamp: CACHED_AT,
    ttl: 5 * 60 * 1000,
  };

  beforeEach(() => {
    rulesCacheGet.mockResolvedValue(cacheEntry);
  });

  it('serves rules and stats from the cache without touching the network', async () => {
    const { result } = renderHook(
      () => useRulesData({ targetTabId: 1, onError: vi.fn(), currentGroupId: '00gFAKE1' }),
      { wrapper },
    );

    await act(async () => {
      await result.current.loadRules();
    });

    expect(rulesCacheGet).toHaveBeenCalledTimes(1);
    expect(fetchRules).not.toHaveBeenCalled();
    expect(rulesCacheSet).not.toHaveBeenCalled();
    expect(result.current.rules).toEqual(cachedRules);
    expect(result.current.stats).toEqual(cachedStats);
    expect(result.current.isLoading).toBe(false);
  });

  it('reports a zero API cost and the cache entry timestamp as the last fetch time', async () => {
    const { result } = renderHook(() => useRulesData({ targetTabId: 1, onError: vi.fn() }), {
      wrapper,
    });

    await act(async () => {
      await result.current.loadRules();
    });

    expect(result.current.apiCost).toBe(0);
    expect(result.current.lastFetchTime).toBe(new Date(CACHED_AT).toISOString());
  });

  it('clears any previous error banner on a cache hit', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useRulesData({ targetTabId: 1, onError }), { wrapper });

    await act(async () => {
      await result.current.loadRules();
    });

    expect(onError).toHaveBeenCalledWith('');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('serves rules with a falsy affectsCurrentGroup even when currentGroupId targets them', async () => {
    // 00gFAKE1 IS the group `Rule One` assigns to, yet the org-wide cache entry
    // was formatted without a currentGroupId — so the flag is false for every
    // rule the cache serves. Pinning the writer's contract (groupDiscovery.ts).
    const { result } = renderHook(
      () => useRulesData({ targetTabId: 1, onError: vi.fn(), currentGroupId: '00gFAKE1' }),
      { wrapper },
    );

    await act(async () => {
      await result.current.loadRules();
    });

    const ruleOne = result.current.rules.find((r) => r.id === '0prFAKE1');
    expect(ruleOne?.groupIds).toContain('00gFAKE1');
    expect(ruleOne?.affectsCurrentGroup).toBeFalsy();
    expect(result.current.rules.every((r) => !r.affectsCurrentGroup)).toBe(true);
  });

  it('bypasses the cache entirely when loadRules is forced', async () => {
    fetchRules.mockResolvedValue({
      success: true,
      rules: [formattedRule],
      rawRules: [rawRule],
      stats,
      conflicts: [],
    });
    const { result } = renderHook(
      () => useRulesData({ targetTabId: 1, onError: vi.fn(), currentGroupId: '00gFAKE1' }),
      { wrapper },
    );

    await act(async () => {
      await result.current.loadRules(true);
    });

    expect(rulesCacheGet).not.toHaveBeenCalled();
    expect(fetchRules).toHaveBeenCalledTimes(1);
    expect(result.current.rules).toEqual([formattedRule]);
    expect(result.current.apiCost).toBe(1);
  });
});
