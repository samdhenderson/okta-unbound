/**
 * Tests for {@link useGroupMerge}: audit attribution, and the progress/undo/
 * failure bookkeeping the `D-034` refactor had to carry across unchanged.
 *
 * The second and third suites were written **before** that refactor (the copy
 * and emptying legs moving off hand-rolled `for` loops onto
 * `coreApi.runOperation`) and pass against both shapes: they assert what the
 * admin can observe — the writes issued, the counts, the undo entries, the audit
 * entries, the progress text, the end phase — never which loop produced them.
 * The cancellation case is the one genuinely new behaviour, and is impossible to
 * satisfy with the old loops.
 *
 * These pin that a merge run records the REAL signed-in admin as the
 * `performedBy` on BOTH audit entries (the survivor add + the aggregate source
 * remove), taken from the facade's `getCurrentUser()` — the same mechanism
 * `useRuleLifecycle` uses — and that an actor the facade could not resolve is
 * recorded on both entries as `performedBy: null` /
 * `actorResolution: 'unavailable'`, never a placeholder identity and never a
 * reason to abort the merge (`D-013`/`D-013b`) — but is surfaced to the admin at
 * the time as a non-blocking `actorNotice` (`D-013c`). The Okta API (`useOktaApi`),
 * the progress context, the audit store, and the undo manager are fully mocked;
 * the pure `planGroupMerge` runs for real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGroupMerge } from './useGroupMerge';
import { auditStore } from '../../shared/storage/auditStore';
import { logAction } from '../../shared/undoManager';
import { runBatch, type BatchProgress } from '../../shared/scheduler/runBatch';
import { createCancellation } from '../../shared/scheduler/cancellation';
import type { GroupSummary, OktaUser } from '../../shared/types';

vi.mock('../../shared/storage/auditStore', () => ({
  auditStore: { logOperation: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../shared/undoManager', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

/**
 * One ordered log of everything the merge told the progress context, whichever
 * API it used to say it. `startProgress`/`updateProgress` (the hook's own bar)
 * and `updateBatch` (what `coreApi.runOperation` drives through `useOktaApi`'s
 * bridge) both land here, so a progress assertion describes what the admin sees
 * rather than which function produced it.
 */
const progressMock = vi.hoisted(() => {
  const log: Array<{
    kind: 'start' | 'tick' | 'complete';
    total?: number;
    current?: number;
    message?: string;
  }> = [];
  return {
    log,
    ctx: {
      startProgress: vi.fn((_name: string, message: string, total?: number) => {
        log.push({ kind: 'start', total, message });
      }),
      updateProgress: vi.fn((current: number, total?: number, message?: string) => {
        log.push({ kind: 'tick', current, total, message });
      }),
      updateBatch: vi.fn((p: BatchProgress, message?: string) => {
        log.push({ kind: 'tick', current: p.completed + p.failed, total: p.total, message });
      }),
      completeProgress: vi.fn(() => {
        log.push({ kind: 'complete' });
      }),
    },
  };
});

vi.mock('../contexts/ProgressContext', () => ({
  useProgress: () => progressMock.ctx,
}));

/**
 * The cancellation token the fake `runOperation` polls — the stand-in for the
 * one `ProgressContext` shares with `useOktaApi`. A test cancels by tripping it.
 */
const cancellation = createCancellation();

/** Options the fake `runOperation` honours, mirroring `RunOperationOptions`. */
interface FakeRunOperationOptions<T> {
  concurrency?: number;
  stopOnError?: (error: unknown, item: T, index: number) => boolean;
  message?: (progress: BatchProgress) => string;
  plan?: { endpoint: string; method?: string };
}

/**
 * A faithful stand-in for `coreApi.runOperation`: the real {@link runBatch} plus
 * the progress/cancellation wiring `createCoreApi` puts around it (reset the
 * token, start the bar, report every batch tick, complete on every exit path).
 * Hand-rolling the batch semantics would let a test pass against a runner that
 * does not cancel or halt the way the real one does — which is precisely what
 * these tests exist to check.
 */
const fakeRunOperation = vi.fn(
  async <T, R>(
    name: string,
    items: T[],
    task: (item: T, index: number, planId?: string) => Promise<R>,
    options: FakeRunOperationOptions<T> = {},
  ) => {
    cancellation.reset();
    progressMock.ctx.startProgress(name, `${name}…`, items.length);
    try {
      // The real runOperation only supplies a planId when a plan was declared.
      const planId = options.plan ? 'fake-plan' : undefined;
      return await runBatch(items, (item, index) => task(item, index, planId), {
        concurrency: options.concurrency,
        stopOnError: options.stopOnError,
        throwIfCancelled: () => cancellation.throwIfCancelled(),
        onProgress: (p) => progressMock.ctx.updateBatch(p, options.message?.(p)),
      });
    } finally {
      progressMock.ctx.completeProgress();
    }
  },
);

const api = {
  getAllGroupMembers: vi.fn(),
  getGroupRulesForGroup: vi.fn(),
  getCurrentUser: vi.fn(),
  makeApiRequest: vi.fn(),
  removeUserFromGroup: vi.fn(),
  runOperation: fakeRunOperation,
};

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => api,
}));

const mockedAuditStore = vi.mocked(auditStore);
const mockedLogAction = vi.mocked(logAction);

const user1: OktaUser = {
  id: 'u1',
  status: 'ACTIVE',
  profile: { login: 'u1@example.com', email: 'u1@example.com', firstName: 'U', lastName: 'One' },
} as OktaUser;

const user2: OktaUser = {
  id: 'u2',
  status: 'ACTIVE',
  profile: { login: 'u2@example.com', email: 'u2@example.com', firstName: 'U', lastName: 'Two' },
} as OktaUser;

const survivor: GroupSummary = { id: 'surv', name: 'Survivor' } as GroupSummary;
const source: GroupSummary = { id: 's1', name: 'Source' } as GroupSummary;

/** Drive preview → execute, without waiting for any particular end phase. */
async function previewThenExecute() {
  const { result } = renderHook(() => useGroupMerge(1));

  await act(async () => {
    await result.current.preview(survivor, [source]);
  });
  await waitFor(() => expect(result.current.phase).toBe('preview'));

  await act(async () => {
    await result.current.execute();
  });
  return result;
}

/** Drive preview → execute, returning the hook result for assertions. */
async function runMerge() {
  const result = await previewThenExecute();
  await waitFor(() => expect(result.current.phase).toBe('done'));
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  progressMock.log.length = 0;
  cancellation.reset();
  // Survivor empty; source has one member → one copy, one removal, not blocked.
  api.getAllGroupMembers.mockImplementation(async (id: string) => (id === 's1' ? [user1] : []));
  api.getGroupRulesForGroup.mockResolvedValue([]);
  api.removeUserFromGroup.mockResolvedValue({ success: true });
  api.getCurrentUser.mockResolvedValue({
    kind: 'resolved',
    email: 'admin@example.com',
    id: '00uFAKEADMIN',
  });
  // The merge's own PUTs (copying members into the survivor) still go through
  // `makeApiRequest`; only the actor lookup moved to the facade.
  api.makeApiRequest.mockResolvedValue({ success: true });
  mockedAuditStore.logOperation.mockResolvedValue(undefined);
});

describe('useGroupMerge audit attribution', () => {
  it('records the real signed-in admin as performedBy on both entries', async () => {
    await runMerge();

    expect(mockedAuditStore.logOperation).toHaveBeenCalledTimes(2);
    for (const [entry] of mockedAuditStore.logOperation.mock.calls) {
      expect(entry.performedBy).toBe('admin@example.com');
      expect(entry.actorResolution).toBe('resolved');
    }
    // One facade lookup for the whole run, not one hand-rolled `/users/me`
    // request per merge, and never `/api/v1/users/me` through `makeApiRequest`.
    expect(api.getCurrentUser).toHaveBeenCalledTimes(1);
    for (const [path] of api.makeApiRequest.mock.calls) {
      expect(path).not.toBe('/api/v1/users/me');
    }
  });

  it('records no actor on either entry, and still merges, when the lookup comes back unavailable', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'threw' });

    const result = await runMerge();

    expect(mockedAuditStore.logOperation).toHaveBeenCalledTimes(2);
    for (const [entry] of mockedAuditStore.logOperation.mock.calls) {
      expect(entry.performedBy).toBeNull();
      expect(entry.actorResolution).toBe('unavailable');
    }
    // The merge itself still completed — an unnamed actor is a labelled gap in
    // the trail, not a reason to refuse the operation (D-013).
    expect(result.current.phase).toBe('done');
  });
});

describe('useGroupMerge actor-unavailable notice', () => {
  // D-013c: the admin is told, once and non-blockingly, that the merge they just
  // ran was recorded without an actor.
  const NOTICE_TEXT =
    "Couldn't confirm your signed-in identity. This action will be recorded without an actor.";

  it('raises the notice and still merges when the actor is unavailable', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'no-email' });

    const result = await runMerge();

    expect(result.current.actorNotice).toEqual({ text: NOTICE_TEXT, type: 'warning' });
    // Non-blocking: the member copy and the source emptying both ran, and the
    // results are the same as with a resolved actor.
    expect(api.makeApiRequest).toHaveBeenCalledTimes(1);
    expect(api.removeUserFromGroup).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('done');
    expect(result.current.results).toEqual({
      copied: 1,
      copyFailed: 0,
      removed: 1,
      removeFailed: 0,
    });
  });

  it('raises no notice when the actor resolved', async () => {
    const result = await runMerge();

    expect(result.current.actorNotice).toBeNull();
  });

  it('clears the notice when the wizard is reset', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'failed' });

    const result = await runMerge();
    expect(result.current.actorNotice).not.toBeNull();

    act(() => {
      result.current.reset();
    });
    expect(result.current.actorNotice).toBeNull();
  });
});

describe('useGroupMerge progress, undo bookkeeping and failure paths', () => {
  // Characterization suite written before the D-034 refactor (the copy and
  // emptying legs moving from hand-rolled `for` loops onto
  // `coreApi.runOperation`). Every assertion here describes behaviour the admin
  // can observe — counts, undo entries, audit entries, progress text, end phase
  // — and is expected to survive that change unchanged.

  /** Two members in the source, none in the survivor: 2 copies, 2 removals. */
  beforeEach(() => {
    api.getAllGroupMembers.mockImplementation(async (id: string) =>
      id === 's1' ? [user1, user2] : [],
    );
  });

  it('copies every distinct source member into the survivor, then empties the source', async () => {
    const result = await runMerge();

    expect(api.makeApiRequest).toHaveBeenCalledTimes(2);
    expect(api.makeApiRequest).toHaveBeenNthCalledWith(
      1,
      '/api/v1/groups/surv/users/u1',
      expect.objectContaining({
        method: 'PUT',
        // A static label: `reason` is never redacted before storage, so a
        // tenant group name has no business in it.
        reason: 'Merge groups: copy member into survivor',
      }),
    );
    expect(api.makeApiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/v1/groups/surv/users/u2',
      expect.objectContaining({ method: 'PUT' }),
    );

    // The emptying leg goes through the membership primitive with the
    // per-user undo suppressed (`skipUndoLog: true`) — one bulk entry is
    // logged for the source instead — and carries the declared plan id so the
    // DELETEs are attributed to the operation that budgeted for them.
    expect(api.removeUserFromGroup).toHaveBeenCalledTimes(2);
    expect(api.removeUserFromGroup).toHaveBeenCalledWith('s1', 'Source', user1, true, 'fake-plan');
    expect(api.removeUserFromGroup).toHaveBeenCalledWith('s1', 'Source', user2, true, 'fake-plan');

    expect(result.current.results).toEqual({
      copied: 2,
      copyFailed: 0,
      removed: 2,
      removeFailed: 0,
    });
  });

  it('logs one bulk-add undo for the survivor and one bulk-remove undo per source', async () => {
    await runMerge();

    expect(mockedLogAction).toHaveBeenCalledTimes(2);
    expect(mockedLogAction).toHaveBeenNthCalledWith(1, 'Merged 2 members into Survivor', {
      type: 'BULK_ADD_USERS_TO_GROUP',
      users: [
        { userId: 'u1', userEmail: 'u1@example.com', userName: 'U One' },
        { userId: 'u2', userEmail: 'u2@example.com', userName: 'U Two' },
      ],
      groupId: 'surv',
      groupName: 'Survivor',
    });
    expect(mockedLogAction).toHaveBeenNthCalledWith(
      2,
      'Emptied 2 members from Source (merge into Survivor)',
      {
        type: 'BULK_REMOVE_USERS_FROM_GROUP',
        users: [
          { userId: 'u1', userEmail: 'u1@example.com', userName: 'U One' },
          { userId: 'u2', userEmail: 'u2@example.com', userName: 'U Two' },
        ],
        groupId: 's1',
        groupName: 'Source',
        operationType: 'custom_status',
      },
    );
  });

  it('records only the users that actually landed in each undo entry', async () => {
    // The second copy and the first removal are rejected by Okta.
    api.makeApiRequest.mockImplementation(async (endpoint: string) =>
      endpoint.endsWith('/u2') ? { success: false, error: 'nope' } : { success: true },
    );
    api.removeUserFromGroup.mockImplementation(async (_g: string, _n: string, user: OktaUser) =>
      user.id === 'u1' ? { success: false, error: 'nope' } : { success: true },
    );

    const result = await runMerge();

    expect(result.current.results).toEqual({
      copied: 1,
      copyFailed: 1,
      removed: 1,
      removeFailed: 1,
    });
    // A failed write is never offered as undoable.
    expect(mockedLogAction).toHaveBeenNthCalledWith(
      1,
      'Merged 1 member into Survivor',
      expect.objectContaining({
        users: [{ userId: 'u1', userEmail: 'u1@example.com', userName: 'U One' }],
      }),
    );
    expect(mockedLogAction).toHaveBeenNthCalledWith(
      2,
      'Emptied 1 member from Source (merge into Survivor)',
      expect.objectContaining({
        users: [{ userId: 'u2', userEmail: 'u2@example.com', userName: 'U Two' }],
      }),
    );

    // Both audit entries report the partial outcome.
    const [[addEntry], [removeEntry]] = mockedAuditStore.logOperation.mock.calls;
    expect(addEntry.result).toBe('partial');
    expect(addEntry.details).toMatchObject({
      usersSucceeded: 1,
      usersFailed: 1,
      apiRequestCount: 2,
    });
    expect(removeEntry.result).toBe('partial');
    expect(removeEntry.details).toMatchObject({
      usersSucceeded: 1,
      usersFailed: 1,
      apiRequestCount: 2,
    });
  });

  it('logs no undo entry for a leg in which nothing succeeded', async () => {
    api.makeApiRequest.mockResolvedValue({ success: false, error: 'nope' });

    const result = await runMerge();

    // CHARACTERIZED: a merge whose copies all failed still empties the source.
    // This is what the code does today; it is pinned so the D-034 refactor
    // cannot change it by accident, not because it is the desired design.
    expect(api.removeUserFromGroup).toHaveBeenCalledTimes(2);
    expect(result.current.results).toEqual({
      copied: 0,
      copyFailed: 2,
      removed: 2,
      removeFailed: 0,
    });
    // Only the emptying leg logged an undo entry.
    expect(mockedLogAction).toHaveBeenCalledTimes(1);
    expect(mockedLogAction).toHaveBeenCalledWith(
      'Emptied 2 members from Source (merge into Survivor)',
      expect.objectContaining({ type: 'BULK_REMOVE_USERS_FROM_GROUP' }),
    );
    const [[addEntry]] = mockedAuditStore.logOperation.mock.calls;
    expect(addEntry.result).toBe('failed');
  });

  it('reports live progress across both legs and clears the bar when it ends', async () => {
    await runMerge();

    const ticks = progressMock.log.filter((e) => e.kind === 'tick');
    // Every one of the four writes is accounted for in the bar.
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    const messages = ticks.map((t) => t.message);
    expect(messages).toContain('Copied 2/2 into Survivor');
    expect(messages).toContain('Emptying Source…');
    // The last thing the bar is told is that everything it was tracking is done
    // — never a run that trails off part-way through its own total.
    const lastTick = ticks.at(-1);
    expect(lastTick?.current).toBe(lastTick?.total);
    // The bar never stays up after the run.
    expect(progressMock.log.at(-1)).toEqual({ kind: 'complete' });
  });

  it('aborts the merge when a write throws, keeping the partial counts', async () => {
    // A transport failure (no target tab, extension reloaded) — not an Okta
    // rejection, which is counted and carried on from.
    api.makeApiRequest.mockImplementation(async (endpoint: string) => {
      if (endpoint.endsWith('/u2')) throw new Error('No target tab ID');
      return { success: true };
    });

    const result = await previewThenExecute();
    await waitFor(() => expect(result.current.phase).toBe('error'));

    expect(result.current.error).toBe('No target tab ID');
    expect(result.current.results).toMatchObject({ copied: 1, removed: 0 });
    // The source is never emptied by a run that could not finish copying.
    expect(api.removeUserFromGroup).not.toHaveBeenCalled();
    // Nothing is written to the audit trail for a run that threw.
    expect(mockedAuditStore.logOperation).not.toHaveBeenCalled();
    // The bar is cleared even on the failure path.
    expect(progressMock.log.at(-1)).toEqual({ kind: 'complete' });
  });

  it('does nothing when the plan is blocked by an active feeding rule', async () => {
    api.getGroupRulesForGroup.mockResolvedValue([{ name: 'Feeds Source', status: 'ACTIVE' }]);

    const { result } = renderHook(() => useGroupMerge(1));
    await act(async () => {
      await result.current.preview(survivor, [source]);
    });
    await waitFor(() => expect(result.current.plan?.blocked).toBe(true));
    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.phase).toBe('preview');
    expect(api.makeApiRequest).not.toHaveBeenCalled();
    expect(api.removeUserFromGroup).not.toHaveBeenCalled();
    expect(mockedLogAction).not.toHaveBeenCalled();
  });
});

describe('useGroupMerge runs its writes as tracked operations (D-034)', () => {
  beforeEach(() => {
    api.getAllGroupMembers.mockImplementation(async (id: string) =>
      id === 's1' ? [user1, user2] : [],
    );
  });

  it('declares the copy leg as one operation with its PUT budget', async () => {
    await runMerge();

    expect(fakeRunOperation).toHaveBeenCalledWith(
      'Merging groups',
      [user1, user2],
      expect.any(Function),
      expect.objectContaining({
        plan: { endpoint: '/api/v1/groups', method: 'PUT' },
      }),
    );
    // Every PUT is attributed to the plan the operation declared.
    for (const [, options] of api.makeApiRequest.mock.calls) {
      expect(options.planId).toBe('fake-plan');
    }
  });

  it('declares the emptying leg as one operation with its DELETE budget', async () => {
    await runMerge();

    expect(fakeRunOperation).toHaveBeenCalledWith(
      'Merging groups',
      [user1, user2],
      expect.any(Function),
      expect.objectContaining({
        plan: { endpoint: '/api/v1/groups', method: 'DELETE' },
      }),
    );
  });

  it('abandons a merge in flight when the admin cancels, keeping what already landed', async () => {
    // Eight members, so the run is still going when the cancel arrives.
    const members: OktaUser[] = Array.from(
      { length: 8 },
      (_, i) =>
        ({
          id: `u${i}`,
          status: 'ACTIVE',
          profile: {
            login: `u${i}@example.com`,
            email: `u${i}@example.com`,
            firstName: 'U',
            lastName: `${i}`,
          },
        }) as OktaUser,
    );
    api.getAllGroupMembers.mockImplementation(async (id: string) => (id === 's1' ? members : []));
    // The admin hits Cancel while the first copy is in flight.
    api.makeApiRequest.mockImplementation(async () => {
      cancellation.cancel();
      return { success: true };
    });

    const result = await previewThenExecute();
    await waitFor(() => expect(result.current.phase).toBe('error'));

    // Cancel is the capability this refactor adds: the run stops instead of
    // pushing all sixteen writes through.
    expect(api.makeApiRequest.mock.calls.length).toBeLessThan(8);
    expect(result.current.error).toBe('Merge cancelled. The source groups were not emptied.');
    // No source is emptied by a merge whose copies never finished.
    expect(api.removeUserFromGroup).not.toHaveBeenCalled();

    // What did land is still counted, still undoable, and still audited.
    const copied = api.makeApiRequest.mock.calls.length;
    expect(result.current.results).toEqual({
      copied,
      copyFailed: 0,
      removed: 0,
      removeFailed: 0,
    });
    expect(mockedLogAction).toHaveBeenCalledTimes(1);
    const [[, undoEntry]] = mockedLogAction.mock.calls;
    expect(undoEntry).toMatchObject({ type: 'BULK_ADD_USERS_TO_GROUP', groupId: 'surv' });
    expect((undoEntry as { users: unknown[] }).users).toHaveLength(copied);
    expect(mockedAuditStore.logOperation).toHaveBeenCalledTimes(2);
    const [[addEntry], [removeEntry]] = mockedAuditStore.logOperation.mock.calls;
    expect(addEntry.details).toMatchObject({ usersSucceeded: copied, usersFailed: 0 });
    expect(removeEntry.details).toMatchObject({ usersSucceeded: 0, usersFailed: 0 });

    // The bar does not stay up after a cancelled run.
    expect(progressMock.log.at(-1)).toEqual({ kind: 'complete' });
  });
});
