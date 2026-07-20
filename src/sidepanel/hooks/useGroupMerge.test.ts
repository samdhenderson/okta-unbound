/**
 * Tests for {@link useGroupMerge}, focused on audit attribution.
 *
 * These pin that a merge run records the REAL signed-in admin as the
 * `performedBy` on BOTH audit entries (the survivor add + the aggregate source
 * remove), resolved via `/api/v1/users/me` — the same mechanism
 * `useRuleLifecycle` uses — and that it falls back to the labeled
 * `unknown@unknown.com` placeholder only when that lookup fails. The Okta API
 * (`useOktaApi`), the progress context, the audit store, and the undo manager
 * are fully mocked; the pure `planGroupMerge` runs for real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGroupMerge } from './useGroupMerge';
import { auditStore } from '../../shared/storage/auditStore';
import type { GroupSummary, OktaUser } from '../../shared/types';

vi.mock('../../shared/storage/auditStore', () => ({
  auditStore: { logOperation: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../shared/undoManager', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../contexts/ProgressContext', () => ({
  useProgress: () => ({
    startProgress: vi.fn(),
    updateProgress: vi.fn(),
    completeProgress: vi.fn(),
  }),
}));

const api = {
  getAllGroupMembers: vi.fn(),
  getGroupRulesForGroup: vi.fn(),
  makeApiRequest: vi.fn(),
  removeUserFromGroup: vi.fn(),
};

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => api,
}));

const mockedAuditStore = vi.mocked(auditStore);

const user1: OktaUser = {
  id: 'u1',
  status: 'ACTIVE',
  profile: { login: 'u1@example.com', email: 'u1@example.com', firstName: 'U', lastName: 'One' },
} as OktaUser;

const survivor: GroupSummary = { id: 'surv', name: 'Survivor' } as GroupSummary;
const source: GroupSummary = { id: 's1', name: 'Source' } as GroupSummary;

/** Drive preview → execute, returning the hook result for assertions. */
async function runMerge() {
  const { result } = renderHook(() => useGroupMerge(1));

  await act(async () => {
    await result.current.preview(survivor, [source]);
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
  // Survivor empty; source has one member → one copy, one removal, not blocked.
  api.getAllGroupMembers.mockImplementation(async (id: string) => (id === 's1' ? [user1] : []));
  api.getGroupRulesForGroup.mockResolvedValue([]);
  api.removeUserFromGroup.mockResolvedValue({ success: true });
  api.makeApiRequest.mockImplementation(async (path: string) =>
    path === '/api/v1/users/me'
      ? { success: true, data: { id: '00uFAKEADMIN', profile: { email: 'admin@example.com' } } }
      : { success: true },
  );
  mockedAuditStore.logOperation.mockResolvedValue(undefined);
});

describe('useGroupMerge audit attribution', () => {
  it('records the real signed-in admin as performedBy on both entries', async () => {
    await runMerge();

    expect(mockedAuditStore.logOperation).toHaveBeenCalledTimes(2);
    for (const [entry] of mockedAuditStore.logOperation.mock.calls) {
      expect(entry.performedBy).toBe('admin@example.com');
      expect(entry.performedBy).not.toBe('unknown@unknown.com');
    }
  });

  it('falls back to the placeholder only when the current-user lookup fails', async () => {
    api.makeApiRequest.mockImplementation(async (path: string) => {
      if (path === '/api/v1/users/me') throw new Error('me failed');
      return { success: true };
    });

    await runMerge();

    for (const [entry] of mockedAuditStore.logOperation.mock.calls) {
      expect(entry.performedBy).toBe('unknown@unknown.com');
    }
  });
});
