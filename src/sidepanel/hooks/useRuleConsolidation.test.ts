/**
 * Tests for {@link useRuleConsolidation}, focused on audit attribution.
 *
 * These pin that a consolidation run records the REAL signed-in admin as the
 * audit entry's `performedBy`, taken from the facade's `getCurrentUser()` (the
 * same mechanism `useRuleLifecycle` and `useGroupMerge` use), and that an actor
 * the facade could not resolve is recorded as `performedBy: null` /
 * `actorResolution: 'unavailable'` — never a placeholder identity, and never a
 * reason to abort the consolidation (`D-013`/`D-013b`) — but is surfaced to the
 * admin at the time as a non-blocking `actorNotice` (`D-013c`). The Okta API
 * (`useOktaApi`), the audit store, and the undo manager are fully mocked.
 *
 * Rules-cache invalidation is no longer sequenced by this hook (ADR-0064): it
 * happens inside each write, below the mocked facade, so the `D-089` assertions
 * that used to live here are retargeted onto `useOktaApi/ruleWrites.test.ts`
 * ("drops the org-wide snapshot when a rule is created", the same for a created
 * rule whose response failed validation — the abort path — and "leaves the
 * snapshot alone when the create is rejected"). What stays here is the ordering
 * those assertions depended on: which writes this hook issues before it aborts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRuleConsolidation, type RetireRuleRef } from './useRuleConsolidation';
import { auditStore } from '../../shared/storage/auditStore';
import type { OktaGroupRule } from '../../shared/types';

vi.mock('../../shared/storage/auditStore', () => ({
  auditStore: { logOperation: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../shared/undoManager', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

const api = {
  getRawGroupRule: vi.fn(),
  createGroupRule: vi.fn(),
  deleteGroupRule: vi.fn(),
  activateGroupRule: vi.fn(),
  deactivateGroupRule: vi.fn(),
  getCurrentUser: vi.fn(),
};

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => api,
}));

const mockedAuditStore = vi.mocked(auditStore);

/** A minimal raw source rule the builder + retire loop can operate on. */
const rawRule: OktaGroupRule = {
  id: 'r1',
  name: 'Eng',
  type: 'group_rule',
  status: 'ACTIVE',
  conditions: { expression: { value: 'user.department=="Eng"' } },
  actions: { assignUserToGroups: { groupIds: ['g1'] } },
} as OktaGroupRule;

const cluster: RetireRuleRef[] = [{ id: 'r1', name: 'Eng', status: 'ACTIVE' }];

/** Drive openMerge → execute, returning the hook result for assertions. */
async function runMerge() {
  const { result } = renderHook(() =>
    useRuleConsolidation({
      targetTabId: 1,
      reload: vi.fn().mockResolvedValue(undefined),
      onError: vi.fn(),
    }),
  );

  act(() => {
    result.current.openMerge('r1', cluster, ['g1', 'g2']);
  });
  await waitFor(() => expect(result.current.phase).toBe('preview'));

  await act(async () => {
    await result.current.execute();
  });
  await waitFor(() => expect(result.current.phase).toBe('done'));
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getRawGroupRule.mockResolvedValue(rawRule);
  api.createGroupRule.mockResolvedValue({
    success: true,
    rule: { id: 'new', name: 'Eng (consolidated)' },
  });
  api.activateGroupRule.mockResolvedValue({ success: true });
  api.deactivateGroupRule.mockResolvedValue({ success: true });
  api.deleteGroupRule.mockResolvedValue({ success: true });
  api.getCurrentUser.mockResolvedValue({
    kind: 'resolved',
    email: 'admin@example.com',
    id: '00uFAKEADMIN',
  });
  mockedAuditStore.logOperation.mockResolvedValue(undefined);
});

describe('useRuleConsolidation audit attribution', () => {
  it('records the real signed-in admin as performedBy', async () => {
    await runMerge();

    expect(mockedAuditStore.logOperation).toHaveBeenCalledTimes(1);
    const entry = mockedAuditStore.logOperation.mock.calls[0][0];
    expect(entry.performedBy).toBe('admin@example.com');
    expect(entry.actorResolution).toBe('resolved');
    // One facade lookup per run, not a hand-rolled `/api/v1/users/me` request.
    expect(api.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('records no actor, and still consolidates, when the lookup comes back unavailable', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'threw' });

    const result = await runMerge();

    const entry = mockedAuditStore.logOperation.mock.calls[0][0];
    expect(entry.performedBy).toBeNull();
    expect(entry.actorResolution).toBe('unavailable');
    // The consolidation itself still completed — an unnamed actor is a labelled
    // gap in the trail, not a reason to refuse the operation (D-013).
    expect(result.current.phase).toBe('done');
  });
});

describe('useRuleConsolidation write ordering', () => {
  /*
    D-089/ADR-0064: the org-wide snapshot is dropped by the create write itself.
    What this hook is still responsible for is issuing that write before anything
    that can abort the run, so these pin which writes each path reaches — the
    invalidation they imply is pinned at the write layer.
  */
  it('creates the replacement rule before any source is retired', async () => {
    await runMerge();

    expect(api.createGroupRule).toHaveBeenCalledTimes(1);
    expect(api.createGroupRule.mock.invocationCallOrder[0]).toBeLessThan(
      api.deleteGroupRule.mock.invocationCallOrder[0],
    );
  });

  it('has already created the rule when the run aborts at the activate step', async () => {
    // Activation fails, so no source is retired — but the created rule is real,
    // and the snapshot went with the create that made it.
    api.activateGroupRule.mockResolvedValue({ success: false, error: 'Activation failed' });

    const { result } = renderHook(() =>
      useRuleConsolidation({
        targetTabId: 1,
        reload: vi.fn().mockResolvedValue(undefined),
        onError: vi.fn(),
      }),
    );
    act(() => {
      result.current.openMerge('r1', cluster, ['g1', 'g2']);
    });
    await waitFor(() => expect(result.current.phase).toBe('preview'));
    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.phase).toBe('error');
    expect(api.createGroupRule).toHaveBeenCalledTimes(1);
    expect(api.deleteGroupRule).not.toHaveBeenCalled();
  });

  it('writes nothing at all when the create is rejected', async () => {
    api.createGroupRule.mockResolvedValue({ success: false, error: 'Rule name already in use' });

    const { result } = renderHook(() =>
      useRuleConsolidation({
        targetTabId: 1,
        reload: vi.fn().mockResolvedValue(undefined),
        onError: vi.fn(),
      }),
    );
    act(() => {
      result.current.openMerge('r1', cluster, ['g1', 'g2']);
    });
    await waitFor(() => expect(result.current.phase).toBe('preview'));
    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.phase).toBe('error');
    expect(api.activateGroupRule).not.toHaveBeenCalled();
    expect(api.deactivateGroupRule).not.toHaveBeenCalled();
    expect(api.deleteGroupRule).not.toHaveBeenCalled();
  });
});

describe('useRuleConsolidation actor-unavailable notice', () => {
  // D-013c: the admin is told, once and non-blockingly, that the run they just
  // performed was recorded without an actor.
  const NOTICE_TEXT =
    "Couldn't confirm your signed-in identity. This action will be recorded without an actor.";

  it('raises the notice and still consolidates when the actor is unavailable', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'no-email' });

    const result = await runMerge();

    expect(result.current.actorNotice).toEqual({ text: NOTICE_TEXT, type: 'warning' });
    // Non-blocking: the replacement rule was created, activated and the source
    // retired, exactly as with a resolved actor.
    expect(api.createGroupRule).toHaveBeenCalledTimes(1);
    expect(api.deleteGroupRule).toHaveBeenCalledWith('r1');
    expect(result.current.phase).toBe('done');
    expect(result.current.result?.retired).toBe(1);
  });

  it('raises no notice when the actor resolved', async () => {
    const result = await runMerge();

    expect(result.current.actorNotice).toBeNull();
  });

  it('clears the notice when the wizard is closed', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'failed' });

    const result = await runMerge();
    expect(result.current.actorNotice).not.toBeNull();

    act(() => {
      result.current.close();
    });
    expect(result.current.actorNotice).toBeNull();
  });
});
