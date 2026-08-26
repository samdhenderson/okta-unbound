/**
 * Tests for {@link useRuleConsolidation}, focused on audit attribution.
 *
 * These pin that a consolidation run records the REAL signed-in admin as the
 * audit entry's `performedBy`, taken from the facade's `getCurrentUser()` (the
 * same mechanism `useRuleLifecycle` and `useGroupMerge` use), and that an actor
 * the facade could not resolve is recorded as `performedBy: null` /
 * `actorResolution: 'unavailable'` — never a placeholder identity, and never a
 * reason to abort the consolidation (`D-013`/`D-013b`). The Okta API
 * (`useOktaApi`), the audit store, and the undo manager are fully mocked.
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
