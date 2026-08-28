/**
 * @module sidepanel/hooks/useUserMemberships.attribution.test
 * @description The user path must never manufacture a *fact* out of a failed load.
 *
 * `analyzeMemberships` classifies a group as `DIRECT` / `attribution: 'exact'`
 * when no active rule targets it. That is correct given a complete rule
 * inventory — and a confident lie without one: if the rules fetch fails, every
 * group looks untargeted and the whole screen reads "added manually, exactly
 * known". The group view cannot make this mistake, because Okta's own
 * `_embedded['group-rules']` answers first, so this was a way for the two views
 * to contradict each other with no visible reason (ADR-0020).
 *
 * These pin the replacement behaviour: no rule inventory → `UNKNOWN` /
 * `ambiguous`, and the degraded answer is not banked in the entity cache.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserMemberships } from './useUserMemberships';
import { peek, resetEntityCache } from '../cache/entityCache';
import type { GroupMembership, OktaUser } from '../../shared/types';

vi.mock('./getUserGroupsRequest', () => ({
  getUserGroupsRequest: vi.fn(),
}));
vi.mock('./fetchGroupRulesRequest', () => ({
  fetchGroupRulesRequest: vi.fn(),
}));

import { getUserGroupsRequest } from './getUserGroupsRequest';
import { fetchGroupRulesRequest } from './fetchGroupRulesRequest';

globalThis.chrome = {
  tabs: { sendMessage: vi.fn() },
} as unknown as typeof chrome;

const user = { id: '00uFAKEuser' } as OktaUser;

/** One group the user is in, with no rule the fixture will admit to. */
const groupsResponse = {
  success: true,
  count: 1,
  data: [
    {
      group: { id: '00gFAKEeng', type: 'OKTA_GROUP', profile: { name: 'Engineering' } },
      membershipType: 'UNKNOWN',
      addedDate: undefined,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
  vi.mocked(getUserGroupsRequest).mockResolvedValue(
    groupsResponse as unknown as Awaited<ReturnType<typeof getUserGroupsRequest>>,
  );
});

async function load(): Promise<GroupMembership[]> {
  const { result } = renderHook(() => useUserMemberships({ targetTabId: 1 }));
  await act(async () => {
    await result.current.loadMemberships(user);
  });
  return result.current.memberships;
}

describe('useUserMemberships when the rule inventory is unavailable', () => {
  it('reports memberships as unclassified rather than as exact manual adds', async () => {
    vi.mocked(fetchGroupRulesRequest).mockResolvedValue({
      success: false,
      error: 'rate limited',
    } as unknown as Awaited<ReturnType<typeof fetchGroupRulesRequest>>);

    const [membership] = await load();

    // The bug this replaces: `DIRECT` + `exact` — a fact claim invented from a
    // failed fetch, and one the group view would flatly contradict.
    expect(membership.membershipType).toBe('UNKNOWN');
    expect(membership.attribution).toBe('ambiguous');
    expect(membership.rules).toEqual([]);
  });

  it('does not bank the degraded answer, so the next load retries', async () => {
    vi.mocked(fetchGroupRulesRequest).mockResolvedValue({
      success: false,
      error: 'rate limited',
    } as unknown as Awaited<ReturnType<typeof fetchGroupRulesRequest>>);

    await load();

    expect(peek(['userMemberships', user.id])).toBeNull();
  });

  it('still classifies normally when the org genuinely has no rules', async () => {
    // The distinction the fix rests on: an empty *successful* rules response is
    // an answer ("no rules exist"), not a failure, and must stay `exact`.
    vi.mocked(fetchGroupRulesRequest).mockResolvedValue({
      success: true,
      rules: [],
    } as unknown as Awaited<ReturnType<typeof fetchGroupRulesRequest>>);

    const [membership] = await load();

    expect(membership.membershipType).toBe('DIRECT');
    expect(membership.attribution).toBe('exact');
    expect(peek(['userMemberships', user.id])).not.toBeNull();
  });
});
