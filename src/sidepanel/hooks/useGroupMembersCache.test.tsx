/**
 * Tests for `useGroupMembersCache`: the fetch path is backed by the shared
 * entity cache (same `['groupMembers', groupId]` key GroupOverview uses), so a
 * second fetch for the same group is served from memory with no network call,
 * and a bulk removal invalidates the affected entries.
 *
 * Fixtures use only fake placeholders (`00uFAKE…`, `00gFAKE…`, `example.com`)
 * per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGroupMembersCache } from './useGroupMembersCache';
import type { useOktaApi } from './useOktaApi';
import { peek } from '../cache/entityCache';
import type { OktaUser } from '../../shared/types';
import type { BatchOutcome } from '../../shared/scheduler/runBatch';

type OktaApi = ReturnType<typeof useOktaApi>;

/** A schema-valid member fixture. */
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

/** An all-fulfilled removal outcome for the given group ids. */
function fulfilledOutcome(groupIds: string[]): BatchOutcome<string, void> {
  return {
    results: groupIds.map((item, index) => ({ item, index, status: 'fulfilled' as const })),
    total: groupIds.length,
    completed: groupIds.length,
    failed: 0,
    skipped: 0,
    stoppedByError: false,
    cancelled: false,
  };
}

/** Build a fake useOktaApi surface with just the operations this hook touches. */
function makeApi(overrides: Partial<Record<keyof OktaApi, unknown>> = {}): OktaApi {
  return {
    getAllGroupMembers: vi.fn().mockResolvedValue([member]),
    removeUserFromGroups: vi.fn().mockResolvedValue(fulfilledOutcome([])),
    ...overrides,
  } as unknown as OktaApi;
}

describe('useGroupMembersCache', () => {
  it('serves a second fetch for the same group from the entity cache (one network call)', async () => {
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const api = makeApi({ getAllGroupMembers });
    const { result } = renderHook(() => useGroupMembersCache(api, []));

    await act(async () => {
      await result.current.fetchMembers('00gFAKE1');
    });
    await act(async () => {
      await result.current.fetchMembers('00gFAKE1');
    });

    expect(getAllGroupMembers).toHaveBeenCalledTimes(1);
    expect(result.current.groupMembersCache.get('00gFAKE1')).toEqual([member]);
  });

  it('writes under the same key GroupOverview reads (["groupMembers", groupId])', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useGroupMembersCache(api, []));

    await act(async () => {
      await result.current.fetchMembers('00gFAKE1');
    });

    expect(peek<OktaUser[]>(['groupMembers', '00gFAKE1'])).toEqual([member]);
  });

  it('removal invalidates the entity-cache entry for each affected group', async () => {
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const removeUserFromGroups = vi.fn().mockResolvedValue(fulfilledOutcome(['00gFAKE1']));
    const api = makeApi({ getAllGroupMembers, removeUserFromGroups });
    const { result } = renderHook(() => useGroupMembersCache(api, []));

    await act(async () => {
      await result.current.fetchMembers('00gFAKE1');
    });
    await act(async () => {
      await result.current.removeUserFromGroups('00uFAKE1', ['00gFAKE1']);
    });

    expect(removeUserFromGroups).toHaveBeenCalledWith('00uFAKE1', ['00gFAKE1']);
    expect(peek(['groupMembers', '00gFAKE1'])).toBeNull();

    // The next fetch goes back to the network.
    await act(async () => {
      await result.current.fetchMembers('00gFAKE1');
    });
    expect(getAllGroupMembers).toHaveBeenCalledTimes(2);
  });

  it('re-raises the first rejection but still invalidates groups removed before it', async () => {
    const outcome: BatchOutcome<string, void> = {
      results: [
        { item: '00gFAKE1', index: 0, status: 'fulfilled' },
        { item: '00gFAKE2', index: 1, status: 'rejected', error: new Error('boom') },
        { item: '00gFAKE3', index: 2, status: 'skipped' },
      ],
      total: 3,
      completed: 1,
      failed: 1,
      skipped: 1,
      stoppedByError: true,
      cancelled: false,
    };
    const removeUserFromGroups = vi.fn().mockResolvedValue(outcome);
    const api = makeApi({ removeUserFromGroups });
    const { result } = renderHook(() => useGroupMembersCache(api, []));

    await act(async () => {
      await result.current.fetchMembers('00gFAKE1');
    });
    await expect(
      result.current.removeUserFromGroups('00uFAKE1', ['00gFAKE1', '00gFAKE2', '00gFAKE3']),
    ).rejects.toThrow('boom');

    expect(peek(['groupMembers', '00gFAKE1'])).toBeNull();
  });
});
