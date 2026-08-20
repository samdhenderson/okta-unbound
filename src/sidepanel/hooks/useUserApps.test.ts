/**
 * @module sidepanel/hooks/useUserApps.test
 * @description What the Apps pane's loader is allowed to conclude, and what it must not.
 *
 * Mocked at the `useOktaApi` facade (this repo has no MSW), so every assertion is
 * about the hook's own decisions: when it loads, when it spends the fallback,
 * what it refuses to infer from a narrowed candidate set, and how a partial walk
 * reaches the surface.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { GroupMembership } from '../../shared/types';
import type { UserAppAssignment } from './useOktaApi/userOperations';

const api = vi.hoisted(() => ({
  getUserApps: vi.fn(),
  getAppGroupAssignments: vi.fn(),
  // A faithful stand-in for coreApi.runOperation: same signature, same
  // per-item outcome shape, so the hook's result handling is genuinely exercised.
  runOperation: vi.fn(
    async <T, R>(_name: string, items: T[], task: (item: T, index: number) => Promise<R>) => {
      const results = [];
      let failed = 0;
      for (const [index, item] of items.entries()) {
        try {
          results.push({
            item,
            index,
            status: 'fulfilled' as const,
            value: await task(item, index),
          });
        } catch (error) {
          failed += 1;
          results.push({ item, index, status: 'rejected' as const, error });
        }
      }
      return {
        results,
        total: items.length,
        completed: items.length - failed,
        failed,
        skipped: 0,
        stoppedByError: false,
        cancelled: false,
      };
    },
  ),
}));

vi.mock('./useOktaApi', () => ({ useOktaApi: () => api }));

import { useUserApps } from './useUserApps';
import { resetEntityCache } from '../cache/entityCache';

const USER_ID = '00uFAKE00000000000001';
const APP_ID = '0oaFAKEapp000001';
const GROUP_ID = '00gFAKE00000000000001';
const OTHER_GROUP_ID = '00gFAKE00000000000002';

const app = (over: Partial<UserAppAssignment> = {}): UserAppAssignment => ({
  id: APP_ID,
  label: 'Salesforce',
  ...over,
});

const membership = (id: string, name: string): GroupMembership => ({
  group: { id, type: 'OKTA_GROUP', profile: { name } },
  membershipType: 'DIRECT',
  rules: [],
  attribution: 'exact',
});

const MEMBERSHIPS = [membership(GROUP_ID, 'sales.emea')];

/** Mount the hook and let the query plus any fallback settle. */
const load = async (
  apps: UserAppAssignment[],
  {
    complete = true,
    memberships = MEMBERSHIPS,
    enabled = true,
    userId = USER_ID as string | null,
  } = {},
) => {
  api.getUserApps.mockResolvedValue({ apps, complete });
  const hook = renderHook(
    (props: { enabled: boolean }) =>
      useUserApps(userId, { targetTabId: 1, memberships, enabled: props.enabled }),
    { initialProps: { enabled } },
  );
  await act(async () => {});
  return hook;
};

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
});

describe('useUserApps — when it loads', () => {
  it('does not fetch while the Apps pane is not the visible one', async () => {
    await load([app()], { enabled: false });
    expect(api.getUserApps).not.toHaveBeenCalled();
  });

  it('defers the load rather than dropping it, running on first entry to the pane', async () => {
    // The deferred re-arm: `enabled` is in the guard AND the deps, so arriving at
    // the pane late still runs the work that was skipped.
    const { rerender } = await load([app()], { enabled: false });
    expect(api.getUserApps).not.toHaveBeenCalled();

    await act(async () => rerender({ enabled: true }));

    await waitFor(() => expect(api.getUserApps).toHaveBeenCalledTimes(1));
  });

  it('does not refetch on a return to the pane', async () => {
    const { rerender } = await load([app()]);
    expect(api.getUserApps).toHaveBeenCalledTimes(1);

    await act(async () => rerender({ enabled: false }));
    await act(async () => rerender({ enabled: true }));

    expect(api.getUserApps).toHaveBeenCalledTimes(1);
  });

  it('never fetches without a user id', async () => {
    await load([app()], { userId: null });
    expect(api.getUserApps).not.toHaveBeenCalled();
  });
});

describe('useUserApps — a partial walk', () => {
  it('surfaces an unfinished walk instead of presenting it as the whole list', async () => {
    const { result } = await load([app()], { complete: false });
    expect(result.current.complete).toBe(false);
    // The rows a partial walk did return are still real, and are kept.
    expect(result.current.apps).toHaveLength(1);
  });

  it('reports complete before anything has loaded, since nothing has failed', async () => {
    const { result } = await load([app()], { enabled: false });
    expect(result.current.complete).toBe(true);
  });
});

describe('useUserApps — the granting-group fallback', () => {
  it('does not spend a walk when the embed already named the group', async () => {
    await load([app({ scope: 'GROUP', grantGroupId: GROUP_ID })]);
    expect(api.getAppGroupAssignments).not.toHaveBeenCalled();
  });

  it('does not spend a walk on a row whose scope Okta never reported', async () => {
    // `scope: undefined` is unknown. Narrowing candidates for an assignment Okta
    // never called group-granted would be paying for a guess.
    await load([app({ scope: undefined })]);
    expect(api.getAppGroupAssignments).not.toHaveBeenCalled();
  });

  it('does not spend a walk on a directly-scoped row with no group named', async () => {
    await load([app({ scope: 'USER' })]);
    expect(api.getAppGroupAssignments).not.toHaveBeenCalled();
  });

  it('runs as one tracked operation, never as a loose fan-out', async () => {
    // ADR-0009: the cost is linear in app count, so it belongs in the ActivityBar
    // with a working cancel rather than in N unattributed promises.
    api.getAppGroupAssignments.mockResolvedValue([GROUP_ID]);
    await load([app({ scope: 'GROUP' })]);

    await waitFor(() => expect(api.runOperation).toHaveBeenCalledTimes(1));
    expect(api.getAppGroupAssignments).toHaveBeenCalledWith(APP_ID);
  });

  it('names the group when exactly one member group is assigned the app', async () => {
    api.getAppGroupAssignments.mockResolvedValue([GROUP_ID, '00gFAKE00000000000009']);
    const { result } = await load([app({ scope: 'GROUP' })]);

    await waitFor(() => expect(result.current.apps[0].grantGroupId).toBe(GROUP_ID));
  });

  it('stays unresolved when two of the user’s groups are both assigned the app', async () => {
    // The intersection narrows the candidates; it does not name the grantor.
    // Choosing between them would be an attribution invented in the client.
    api.getAppGroupAssignments.mockResolvedValue([GROUP_ID, OTHER_GROUP_ID]);
    const { result } = await load([app({ scope: 'GROUP' })], {
      memberships: [
        membership(GROUP_ID, 'sales.emea'),
        membership(OTHER_GROUP_ID, 'all.employees'),
      ],
    });

    await waitFor(() => expect(api.getAppGroupAssignments).toHaveBeenCalled());
    expect(result.current.apps[0].grantGroupId).toBeUndefined();
  });

  it('treats a failed walk as no answer, never as "no group grants this"', async () => {
    api.getAppGroupAssignments.mockResolvedValue(null);
    const { result } = await load([app({ scope: 'GROUP' })]);

    await waitFor(() => expect(api.getAppGroupAssignments).toHaveBeenCalled());
    expect(result.current.apps[0].grantGroupId).toBeUndefined();
  });

  it('treats an empty walk as no answer about this user', async () => {
    api.getAppGroupAssignments.mockResolvedValue([]);
    const { result } = await load([app({ scope: 'GROUP' })]);

    await waitFor(() => expect(api.getAppGroupAssignments).toHaveBeenCalled());
    expect(result.current.apps[0].grantGroupId).toBeUndefined();
  });

  it('does not replay the walk when the pane is left and returned to', async () => {
    api.getAppGroupAssignments.mockResolvedValue([GROUP_ID]);
    const { rerender } = await load([app({ scope: 'GROUP' })]);
    await waitFor(() => expect(api.runOperation).toHaveBeenCalledTimes(1));

    await act(async () => rerender({ enabled: false }));
    await act(async () => rerender({ enabled: true }));

    expect(api.runOperation).toHaveBeenCalledTimes(1);
  });
});

describe('useUserApps — appsByGroupId', () => {
  it('indexes each app under the group that grants it', async () => {
    const { result } = await load([
      app({ id: '0oaFAKEapp000001', label: 'Salesforce', scope: 'GROUP', grantGroupId: GROUP_ID }),
      app({ id: '0oaFAKEapp000002', label: 'Figma', scope: 'USER', grantGroupId: GROUP_ID }),
    ]);

    expect(result.current.appsByGroupId).toEqual({ [GROUP_ID]: ['Salesforce', 'Figma'] });
  });

  it('files an unresolved row under no group at all', async () => {
    api.getAppGroupAssignments.mockResolvedValue(null);
    const { result } = await load([app({ scope: 'GROUP' })]);

    await waitFor(() => expect(api.getAppGroupAssignments).toHaveBeenCalled());
    expect(result.current.appsByGroupId).toEqual({});
  });

  it('picks up a group the fallback resolved', async () => {
    api.getAppGroupAssignments.mockResolvedValue([GROUP_ID]);
    const { result } = await load([app({ scope: 'GROUP' })]);

    await waitFor(() =>
      expect(result.current.appsByGroupId).toEqual({ [GROUP_ID]: ['Salesforce'] }),
    );
  });
});
