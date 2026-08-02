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
