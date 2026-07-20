/**
 * Tests for the group-member export operation.
 *
 * These pin CURRENT behavior of {@link createExportOperations.exportMembers}: it
 * delegates the fetch-and-serialize to the content script via
 * `sendMessage({ action: 'exportGroupMembers' })`, surfaces progress/result lines
 * through `callbacks.onResult`, and records a fire-and-forget audit entry on
 * success, on `success:false`, and on a thrown error. The transport (`CoreApi`)
 * and the audit store are fully mocked. Both sides of every conditional are
 * exercised (audit-user present/absent, success/failure/throw, count/error
 * present/absent, Error vs non-Error throw) for branch coverage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExportOperations } from './exportOperations';
import type { CoreApi } from './core';
import type { MessageResponse } from './types';
import { auditStore } from '../../../shared/storage/auditStore';

// The audit trail is fire-and-forget; mock it so we can assert (and control) the
// logged entries without touching IndexedDB.
vi.mock('../../../shared/storage/auditStore', () => ({
  auditStore: {
    logOperation: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockedAuditStore = vi.mocked(auditStore);

/** Build a fake CoreApi whose transport is fully mocked. */
function makeCore(overrides: Partial<CoreApi> = {}): CoreApi {
  return {
    targetTabId: 1,
    sendMessage: vi.fn().mockResolvedValue({ success: true, count: 3 }),
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getCurrentUser: vi
      .fn()
      .mockResolvedValue({ email: 'admin@example.okta.com', id: '00uFAKEADMIN' }),
    checkCancelled: vi.fn(),
    resetCancellation: vi.fn(),
    runOperation: vi.fn(),
    callbacks: {},
    ...overrides,
  } as CoreApi;
}

/** Flush pending microtasks so the fire-and-forget audit write settles. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuditStore.logOperation.mockResolvedValue(undefined);
});

describe('exportMembers request shape', () => {
  it('sends the exportGroupMembers message with the group + format + filter', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true, count: 5 } as MessageResponse);
    const core = makeCore({ sendMessage });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Engineering', 'csv', 'ACTIVE');

    expect(sendMessage).toHaveBeenCalledWith({
      action: 'exportGroupMembers',
      groupId: '00gFAKEGRP',
      groupName: 'Engineering',
      format: 'csv',
      statusFilter: 'ACTIVE',
    });
  });

  it('forwards an omitted status filter as undefined and json format', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true, count: 0 });
    const core = makeCore({ sendMessage });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Everyone', 'json');

    expect(sendMessage).toHaveBeenCalledWith({
      action: 'exportGroupMembers',
      groupId: '00gFAKEGRP',
      groupName: 'Everyone',
      format: 'json',
      statusFilter: undefined,
    });
  });
});

describe('exportMembers success path', () => {
  it('reports start + completion and logs a success audit entry', async () => {
    const onResult = vi.fn();
    const core = makeCore({
      sendMessage: vi.fn().mockResolvedValue({ success: true, count: 7 }),
      callbacks: { onResult },
    });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Engineering', 'csv', 'ACTIVE');
    await flush();

    // The status format is upper-cased in the start message.
    expect(onResult).toHaveBeenCalledWith('Starting export: CSV format', 'info');
    expect(onResult).toHaveBeenCalledWith('Export complete: 7 members exported', 'success');

    expect(mockedAuditStore.logOperation).toHaveBeenCalledTimes(1);
    const entry = mockedAuditStore.logOperation.mock.calls[0][0];
    expect(entry).toMatchObject({
      action: 'export',
      groupId: '00gFAKEGRP',
      groupName: 'Engineering',
      performedBy: 'admin@example.okta.com',
      affectedUsers: [],
      result: 'success',
    });
    expect(entry.details).toMatchObject({
      usersSucceeded: 7,
      usersFailed: 0,
      apiRequestCount: 1,
    });
  });

  it('defaults usersSucceeded to 0 when the response omits count', async () => {
    // Drives the `response.count || 0` fallback branch.
    const core = makeCore({
      sendMessage: vi.fn().mockResolvedValue({ success: true }),
    });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Engineering', 'json');
    await flush();

    const entry = mockedAuditStore.logOperation.mock.calls[0][0];
    expect(entry.details.usersSucceeded).toBe(0);
  });

  it('skips the audit write when no current user could be resolved', async () => {
    // getCurrentUser never resolves null in production, but the code guards for it;
    // this drives the `if (currentUser)` false branch on the success path.
    const onResult = vi.fn();
    const core = makeCore({
      getCurrentUser: vi.fn().mockResolvedValue(null),
      sendMessage: vi.fn().mockResolvedValue({ success: true, count: 2 }),
      callbacks: { onResult },
    });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Engineering', 'csv');
    await flush();

    expect(onResult).toHaveBeenCalledWith('Export complete: 2 members exported', 'success');
    expect(mockedAuditStore.logOperation).not.toHaveBeenCalled();
  });

  it('runs without a onResult callback provided', async () => {
    // Default makeCore callbacks is {}, so onResult is undefined: drives the
    // optional-chaining `onResult?.` absent branch. Should not throw.
    const core = makeCore({ sendMessage: vi.fn().mockResolvedValue({ success: true, count: 1 }) });
    const { exportMembers } = createExportOperations(core);

    await expect(exportMembers('00gFAKEGRP', 'Engineering', 'csv')).resolves.toBeUndefined();
    await flush();
    expect(mockedAuditStore.logOperation).toHaveBeenCalledTimes(1);
  });
});

describe('exportMembers failure path (success:false)', () => {
  it('reports the failure and logs a failed audit entry with the error', async () => {
    const onResult = vi.fn();
    const core = makeCore({
      sendMessage: vi.fn().mockResolvedValue({ success: false, error: 'No members' }),
      callbacks: { onResult },
    });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Engineering', 'csv');
    await flush();

    expect(onResult).toHaveBeenCalledWith('Export failed: No members', 'error');

    const entry = mockedAuditStore.logOperation.mock.calls[0][0];
    expect(entry.result).toBe('failed');
    expect(entry.details.errorMessages).toEqual(['No members']);
    expect(entry.details.usersSucceeded).toBe(0);
  });

  it('falls back to "Unknown error" when the failure response omits error', async () => {
    // Drives the `response.error || 'Unknown error'` fallback branch.
    const core = makeCore({
      sendMessage: vi.fn().mockResolvedValue({ success: false }),
    });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Engineering', 'csv');
    await flush();

    const entry = mockedAuditStore.logOperation.mock.calls[0][0];
    expect(entry.details.errorMessages).toEqual(['Unknown error']);
  });

  it('skips the audit write on failure when no current user was resolved', async () => {
    // Drives the `if (currentUser)` false branch on the failure path.
    const core = makeCore({
      getCurrentUser: vi.fn().mockResolvedValue(null),
      sendMessage: vi.fn().mockResolvedValue({ success: false, error: 'boom' }),
    });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Engineering', 'csv');
    await flush();

    expect(mockedAuditStore.logOperation).not.toHaveBeenCalled();
  });
});

describe('exportMembers thrown-error path', () => {
  it('captures an Error thrown by sendMessage and logs a failed audit entry', async () => {
    const onResult = vi.fn();
    const core = makeCore({
      sendMessage: vi.fn().mockRejectedValue(new Error('tab gone')),
      callbacks: { onResult },
    });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Engineering', 'csv');
    await flush();

    expect(onResult).toHaveBeenCalledWith('Error: tab gone', 'error');

    const entry = mockedAuditStore.logOperation.mock.calls[0][0];
    expect(entry.result).toBe('failed');
    expect(entry.details.errorMessages).toEqual(['Error: tab gone']);
  });

  it('uses "Unknown error" when a non-Error value is thrown', async () => {
    // Drives the `error instanceof Error ? ... : 'Unknown error'` false branch.
    const onResult = vi.fn();
    const core = makeCore({
      sendMessage: vi.fn().mockRejectedValue('string failure'),
      callbacks: { onResult },
    });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Engineering', 'csv');
    await flush();

    expect(onResult).toHaveBeenCalledWith('Error: Unknown error', 'error');
    const entry = mockedAuditStore.logOperation.mock.calls[0][0];
    expect(entry.details.errorMessages).toEqual(['Error: Unknown error']);
  });

  it('skips the audit write in the catch when no current user was resolved', async () => {
    // getCurrentUser rejects here, so the try never assigns currentUser and the
    // catch's `if (currentUser)` false branch is taken.
    const core = makeCore({
      getCurrentUser: vi.fn().mockRejectedValue(new Error('me failed')),
    });
    const { exportMembers } = createExportOperations(core);

    await exportMembers('00gFAKEGRP', 'Engineering', 'csv');
    await flush();

    expect(mockedAuditStore.logOperation).not.toHaveBeenCalled();
  });
});

describe('exportMembers audit-write failure is swallowed', () => {
  it('logs but does not throw when the audit store rejects', async () => {
    mockedAuditStore.logOperation.mockRejectedValueOnce(new Error('idb down'));
    const core = makeCore({ sendMessage: vi.fn().mockResolvedValue({ success: true, count: 1 }) });
    const { exportMembers } = createExportOperations(core);

    await expect(exportMembers('00gFAKEGRP', 'Engineering', 'csv')).resolves.toBeUndefined();
    await flush();
    expect(mockedAuditStore.logOperation).toHaveBeenCalledTimes(1);
  });
});
