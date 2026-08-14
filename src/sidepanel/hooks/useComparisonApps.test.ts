/**
 * @module sidepanel/hooks/useComparisonApps.test
 * @description The one branch the end-to-end comparison tests cannot reach: an
 * app read that fails for **one** of the two users.
 *
 * `UserComparisonModal.test.tsx` drives the whole surface through a single
 * `appsResponse` stub, so it can only fail both walks together. The buckets are a
 * set difference, though, so a short list on one side alone is enough to invent a
 * "only the other user has this" row — which makes the asymmetric case the one
 * that actually needs pinning.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { OktaUser } from '../../shared/types';

const api = vi.hoisted(() => ({
  getUserApps: vi.fn(),
}));

vi.mock('./useOktaApi', () => ({ useOktaApi: () => api }));

import { useComparisonApps } from './useComparisonApps';

const CONTEXT_ID = '00uFAKEcontext';

const comparedUser = {
  id: '00uFAKEcompared',
  status: 'ACTIVE',
  profile: { login: 'bob@example.com', email: 'bob@example.com' },
} as OktaUser;

/** One `getUserApps` outcome, in the shape `userOperations` returns. */
const result = (complete: boolean, labels: string[] = []) => ({
  apps: labels.map((label, i) => ({ id: `0oaFAKE${i}`, label })),
  complete,
});

/**
 * Mount the hook with a compared user selected and let the two loads settle.
 *
 * `getUserApps` is stubbed per call in the order the hook issues them — context
 * user first, then compared user — which is what lets a test fail exactly one side.
 */
const load = async (context: ReturnType<typeof result>, compared: ReturnType<typeof result>) => {
  api.getUserApps.mockImplementation(async (userId: string) =>
    userId === CONTEXT_ID ? context : compared,
  );

  const hook = renderHook(() =>
    useComparisonApps({ targetTabId: 1, contextUserId: CONTEXT_ID, comparedUser }),
  );
  await act(async () => {});
  return hook;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useComparisonApps', () => {
  it('reports a complete read when both walks finished', async () => {
    const { result: hook } = await load(result(true, ['Slack']), result(true, ['Slack', 'Zoom']));

    expect(hook.current.appsIncomplete).toBe(false);
    expect(hook.current.contextApps).toHaveLength(1);
    expect(hook.current.comparedApps).toHaveLength(2);
  });

  it('reports incomplete when only the CONTEXT user’s walk failed', async () => {
    // Otherwise every app the compared user holds looks unique to them.
    const { result: hook } = await load(result(false), result(true, ['Slack']));

    expect(hook.current.appsIncomplete).toBe(true);
  });

  it('reports incomplete when only the COMPARED user’s walk failed', async () => {
    const { result: hook } = await load(result(true, ['Slack']), result(false));

    expect(hook.current.appsIncomplete).toBe(true);
  });

  it('keeps the rows a partial walk did return', async () => {
    // A partial answer is still an answer: the apps in hand are real, and
    // discarding them would lose information the flag already qualifies.
    const { result: hook } = await load(result(false, ['Slack']), result(true, ['Zoom']));

    expect(hook.current.appsIncomplete).toBe(true);
    expect(hook.current.contextApps.map((a) => a.label)).toEqual(['Slack']);
  });

  it('clears the flag along with the lists on reset', async () => {
    // The flag describes the lists. Left set after a reset it would caveat a
    // comparison that has not been made yet.
    const { result: hook } = await load(result(false), result(false));
    expect(hook.current.appsIncomplete).toBe(true);

    act(() => hook.current.resetApps());

    expect(hook.current.appsIncomplete).toBe(false);
    expect(hook.current.contextApps).toEqual([]);
  });

  it('does not fetch until a user is selected', async () => {
    renderHook(() =>
      useComparisonApps({ targetTabId: 1, contextUserId: CONTEXT_ID, comparedUser: null }),
    );
    await act(async () => {});

    expect(api.getUserApps).not.toHaveBeenCalled();
  });
});
