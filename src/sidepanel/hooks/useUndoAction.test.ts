/**
 * Tests for {@link useUndoAction} — the extension's first undo executor.
 *
 * What these pin, in order of how badly getting them wrong would hurt:
 *
 * - **Only `UPDATE_USER_PROFILE` is undoable.** Table-driven over all seven other
 *   `ActionType`s, each of which must come back with a reason rather than an
 *   attempt.
 * - **Drift refuses, and reports names only.** Including the subtle case: a third
 *   party set the attribute *back* to its old value, so it differs from what we
 *   wrote while matching what it was before. "Is it still what we wrote?" catches
 *   that; "does it still differ from before?" does not.
 * - **The write order.** `updateUserProfile` → `logProfileUpdateAction` →
 *   `markActionUndone`, recorded through a shared call-order array. Reversing the
 *   last two lets the log's stale read clobber the status flag.
 * - **An evicted original is not a failure**, and an already-undone entry costs
 *   no API call at all.
 *
 * The Okta API is mocked at the `useOktaApi` facade (this repo does not use MSW —
 * the side panel never calls `fetch`; see `docs/component-explorer.md`), and the
 * undo manager is mocked so history writes are observable without storage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUndoAction, type UndoOutcome } from './useUndoAction';
import { logProfileUpdateAction, markActionUndone } from '../../shared/undoManager';
import type {
  ActionType,
  CapturedAttribute,
  UndoAction,
  UndoActionMetadata,
} from '../../shared/undoTypes';
import type { OktaUser } from '../../shared/types';

/** Every mutating call, in the order it happened. The order is the assertion. */
const calls: string[] = [];

const api = {
  getUserRaw: vi.fn(),
  updateUserProfile: vi.fn(),
};

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => api,
}));

vi.mock('../../shared/undoManager', () => ({
  logProfileUpdateAction: vi.fn(),
  markActionUndone: vi.fn(),
}));

const mockedLog = vi.mocked(logProfileUpdateAction);
const mockedMark = vi.mocked(markActionUndone);

/** A restorable captured change. */
const captured = (name: string, before: string, after: string): CapturedAttribute => ({
  name,
  label: name,
  beforeDisplay: before,
  beforeRaw: before,
  afterDisplay: after,
  restorable: true,
});

/**
 * An unrestorable one: `beforeDisplay`/`beforeRaw` are **absent**, not empty —
 * the capture policy dropped an over-cap value rather than truncating it.
 */
const omitted = (name: string, after: string): CapturedAttribute => ({
  name,
  label: name,
  afterDisplay: after,
  restorable: false,
  omitted: 'too-large',
});

/** A profile-update entry with the given changes. */
const profileAction = (
  changes: CapturedAttribute[],
  status: UndoAction['status'] = 'completed',
): UndoAction => ({
  id: 'action_original',
  type: 'UPDATE_USER_PROFILE',
  timestamp: 1_700_000_000_000,
  description: 'Updated department on Ada Lovelace',
  status,
  metadata: {
    type: 'UPDATE_USER_PROFILE',
    userId: '00uFAKE0000000000001',
    userLogin: 'user@example.com',
    userName: 'Ada Lovelace',
    changes,
  },
});

/** A live user whose profile carries the given attributes. */
const liveUser = (profile: Record<string, unknown>): OktaUser =>
  ({
    id: '00uFAKE0000000000001',
    status: 'ACTIVE',
    profile: {
      login: 'user@example.com',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      ...profile,
    },
  }) as OktaUser;

const renderUndo = () => renderHook(() => useUndoAction({ targetTabId: 1 })).result;

/**
 * Drive one undo to completion inside `act`, so the `undoingActionId` flag's
 * flip and flip-back are both settled before the assertions run.
 */
async function runUndo(action: UndoAction): Promise<UndoOutcome> {
  const result = renderUndo();
  let outcome!: UndoOutcome;
  await act(async () => {
    outcome = await result.current.undo(action);
  });
  return outcome;
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;

  api.getUserRaw.mockImplementation(async () => liveUser({ department: 'Platform' }));
  api.updateUserProfile.mockImplementation(async () => {
    calls.push('updateUserProfile');
    return { kind: 'saved', user: liveUser({ department: 'Engineering' }) };
  });
  mockedLog.mockImplementation(async () => {
    calls.push('logProfileUpdateAction');
    return { id: 'action_undo' } as UndoAction;
  });
  mockedMark.mockImplementation(async () => {
    calls.push('markActionUndone');
    return true;
  });
});

describe('undoability — only profile writes have an undo path', () => {
  /** One representative entry per non-profile action type. */
  const otherTypes: Array<[Exclude<ActionType, 'UPDATE_USER_PROFILE'>, UndoActionMetadata]> = [
    [
      'REMOVE_USER_FROM_GROUP',
      {
        type: 'REMOVE_USER_FROM_GROUP',
        userId: '00uFAKE1',
        userEmail: 'user@example.com',
        userName: 'Ada',
        groupId: '00gFAKE1',
        groupName: 'Engineering',
      },
    ],
    [
      'ADD_USER_TO_GROUP',
      {
        type: 'ADD_USER_TO_GROUP',
        userId: '00uFAKE1',
        userEmail: 'user@example.com',
        userName: 'Ada',
        groupId: '00gFAKE1',
        groupName: 'Engineering',
      },
    ],
    [
      'BULK_REMOVE_USERS_FROM_GROUP',
      {
        type: 'BULK_REMOVE_USERS_FROM_GROUP',
        users: [],
        groupId: '00gFAKE1',
        groupName: 'Engineering',
        operationType: 'deprovisioned',
      },
    ],
    [
      'BULK_ADD_USERS_TO_GROUP',
      {
        type: 'BULK_ADD_USERS_TO_GROUP',
        users: [],
        groupId: '00gFAKE1',
        groupName: 'Engineering',
      },
    ],
    ['ACTIVATE_RULE', { type: 'ACTIVATE_RULE', ruleId: '0prFAKE1', ruleName: 'Auto-add' }],
    ['DEACTIVATE_RULE', { type: 'DEACTIVATE_RULE', ruleId: '0prFAKE1', ruleName: 'Auto-add' }],
    [
      'CONSOLIDATE_RULE',
      {
        type: 'CONSOLIDATE_RULE',
        createdRuleId: '0prFAKE9',
        createdRuleName: 'Merged',
        createdGroupIds: ['00gFAKE1'],
        retiredRules: [],
      },
    ],
  ];

  it.each(otherTypes)('%s is not undoable, with a reason', async (type, metadata) => {
    const action: UndoAction = {
      id: `action_${type}`,
      type,
      timestamp: 1_700_000_000_000,
      description: 'Something happened',
      status: 'completed',
      metadata,
    };

    const result = renderUndo();

    const verdict = result.current.undoability(action);
    expect(verdict.undoable).toBe(false);
    expect(verdict.undoable === false && verdict.reason.length).toBeGreaterThan(20);

    expect(await runUndo(action)).toEqual({ kind: 'not-undoable', reason: expect.any(String) });
    expect(api.getUserRaw).not.toHaveBeenCalled();
    expect(api.updateUserProfile).not.toHaveBeenCalled();
  });

  it('refuses a `partial` entry — an unconfirmed write is not a known prior state', async () => {
    const action = profileAction([captured('department', 'Platform', 'Engineering')], 'partial');
    const result = renderUndo();

    expect(result.current.undoability(action).undoable).toBe(false);
    expect(await runUndo(action)).toEqual({
      kind: 'not-undoable',
      reason: expect.stringContaining('never confirmed'),
    });
    expect(api.updateUserProfile).not.toHaveBeenCalled();
  });

  it('refuses a `failed` entry', () => {
    const action = profileAction([captured('department', 'Platform', 'Engineering')], 'failed');
    expect(renderUndo().current.undoability(action).undoable).toBe(false);
  });

  it('refuses when no change captured a prior value', () => {
    const action = profileAction([omitted('bio', 'a very long value')]);
    const verdict = renderUndo().current.undoability(action);

    expect(verdict.undoable).toBe(false);
    expect(verdict.undoable === false && verdict.reason).toContain('nothing to restore');
  });

  it('counts restorable against total for a mixed entry', () => {
    const action = profileAction([
      captured('department', 'Platform', 'Engineering'),
      omitted('bio', 'a very long value'),
      captured('title', 'Intern', 'Engineer'),
    ]);

    expect(renderUndo().current.undoability(action)).toEqual({
      undoable: true,
      restorable: 2,
      total: 3,
    });
  });
});

describe('drift', () => {
  it('refuses when an attribute is no longer what the write set', async () => {
    api.getUserRaw.mockResolvedValue(liveUser({ department: 'Finance' }));
    const action = profileAction([captured('department', 'Platform', 'Engineering')]);

    const outcome = await runUndo(action);

    expect(outcome).toEqual({ kind: 'drifted', attributeNames: ['department'] });
    expect(api.updateUserProfile).not.toHaveBeenCalled();
  });

  it('reports attribute names only — no value reaches the outcome', async () => {
    api.getUserRaw.mockResolvedValue(liveUser({ department: 'Finance' }));
    const action = profileAction([captured('department', 'Platform', 'Engineering')]);

    const outcome = await runUndo(action);

    // Every value involved — the prior, the written, and the drifted current one
    // — must be absent from anything the hook hands back.
    const serialized = JSON.stringify(outcome);
    expect(serialized).not.toContain('Finance');
    expect(serialized).not.toContain('Platform');
    expect(serialized).not.toContain('Engineering');
  });

  it('detects drift even when the live value equals the value before the edit', async () => {
    // The subtle one: someone else set `department` back to `Platform`. It
    // "matches before", but it is no longer what our write set — so the
    // attribute is theirs now, and undoing would overwrite their change.
    api.getUserRaw.mockResolvedValue(liveUser({ department: 'Platform' }));
    const action = profileAction([captured('department', 'Platform', 'Engineering')]);

    const outcome = await runUndo(action);

    expect(outcome).toEqual({ kind: 'drifted', attributeNames: ['department'] });
    expect(api.updateUserProfile).not.toHaveBeenCalled();
  });

  it('compares through `toDisplay`, so 5 and "5" agree', async () => {
    api.getUserRaw.mockResolvedValue(liveUser({ employeeNumber: 5 }));
    const action = profileAction([captured('employeeNumber', '4', '5')]);

    const outcome = await runUndo(action);

    expect(outcome).toMatchObject({ kind: 'undone' });
  });
});

describe('the restoring write', () => {
  it('writes the prior values and reports what it restored', async () => {
    api.getUserRaw.mockResolvedValue(liveUser({ department: 'Engineering', title: 'Engineer' }));
    const action = profileAction([
      captured('department', 'Platform', 'Engineering'),
      captured('title', 'Intern', 'Engineer'),
    ]);

    const outcome = await runUndo(action);

    expect(api.updateUserProfile).toHaveBeenCalledWith('00uFAKE0000000000001', {
      department: 'Platform',
      title: 'Intern',
    });
    expect(outcome).toEqual({
      kind: 'undone',
      restored: 2,
      skipped: 0,
      actionId: 'action_undo',
    });
  });

  it('records the undo entry before marking the original undone', async () => {
    api.getUserRaw.mockResolvedValue(liveUser({ department: 'Engineering' }));
    const action = profileAction([captured('department', 'Platform', 'Engineering')]);

    await runUndo(action);

    // Both history calls are read-modify-write over one storage key. Reversed,
    // the log's already-stale read would save over the status flag.
    expect(calls).toEqual(['updateUserProfile', 'logProfileUpdateAction', 'markActionUndone']);
  });

  it('links the new entry to the original in both directions', async () => {
    api.getUserRaw.mockResolvedValue(liveUser({ department: 'Engineering' }));
    const action = profileAction([
      captured('department', 'Platform', 'Engineering'),
      omitted('bio', 'a very long value'),
    ]);

    await runUndo(action);

    expect(mockedLog).toHaveBeenCalledWith(
      '00uFAKE0000000000001',
      'user@example.com',
      'Ada Lovelace',
      expect.any(Array),
      { undoOfActionId: 'action_original', originalAttributeCount: 2 },
    );
    expect(mockedMark).toHaveBeenCalledWith('action_original', 'action_undo');
  });

  it('restores what it can and announces what it skipped', async () => {
    api.getUserRaw.mockResolvedValue(
      liveUser({ department: 'Engineering', title: 'Engineer', city: 'Berlin' }),
    );
    const action = profileAction([
      captured('department', 'Platform', 'Engineering'),
      omitted('bio', 'a very long value'),
      captured('title', 'Intern', 'Engineer'),
      omitted('notes', 'another very long value'),
      captured('city', 'London', 'Berlin'),
    ]);

    const outcome = await runUndo(action);

    // The patch carries the three restorable keys and nothing else — an omitted
    // attribute has no prior value to write, and `undefined` would blank it.
    expect(api.updateUserProfile).toHaveBeenCalledWith('00uFAKE0000000000001', {
      department: 'Platform',
      title: 'Intern',
      city: 'London',
    });
    expect(outcome).toEqual({
      kind: 'undone',
      restored: 3,
      skipped: 2,
      actionId: 'action_undo',
    });
  });

  it('still reports success when the original was evicted by the history cap', async () => {
    api.getUserRaw.mockResolvedValue(liveUser({ department: 'Engineering' }));
    mockedMark.mockResolvedValue(false);
    const action = profileAction([captured('department', 'Platform', 'Engineering')]);

    const outcome = await runUndo(action);

    expect(outcome).toMatchObject({ kind: 'undone', restored: 1 });
  });

  it('fails when the user cannot be re-read, without writing anything', async () => {
    api.getUserRaw.mockResolvedValue(null);
    const action = profileAction([captured('department', 'Platform', 'Engineering')]);

    const outcome = await runUndo(action);

    expect(outcome).toMatchObject({ kind: 'failed' });
    expect(api.updateUserProfile).not.toHaveBeenCalled();
    expect(mockedLog).not.toHaveBeenCalled();
  });

  it('does not mark the original undone when Okta rejects the write', async () => {
    api.getUserRaw.mockResolvedValue(liveUser({ department: 'Engineering' }));
    api.updateUserProfile.mockResolvedValue({ kind: 'failed', error: 'Okta said no' });
    const action = profileAction([captured('department', 'Platform', 'Engineering')]);

    const outcome = await runUndo(action);

    expect(outcome).toEqual({ kind: 'failed', error: 'Okta said no' });
    expect(mockedMark).not.toHaveBeenCalled();
    expect(mockedLog).not.toHaveBeenCalled();
  });

  it('records an unconfirmed write as `partial` but never marks the original undone', async () => {
    api.getUserRaw.mockResolvedValue(liveUser({ department: 'Engineering' }));
    api.updateUserProfile.mockResolvedValue({
      kind: 'unknown',
      error: 'The update could not be confirmed.',
    });
    const action = profileAction([captured('department', 'Platform', 'Engineering')]);

    const outcome = await runUndo(action);

    expect(outcome).toMatchObject({ kind: 'failed' });
    expect(mockedLog).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ status: 'partial' }),
    );
    expect(mockedMark).not.toHaveBeenCalled();
  });
});

describe('an already-undone entry', () => {
  it('short-circuits before any request', async () => {
    const action = profileAction([captured('department', 'Platform', 'Engineering')], 'undone');

    const outcome = await runUndo(action);

    expect(outcome).toEqual({ kind: 'already-undone' });
    expect(api.getUserRaw).not.toHaveBeenCalled();
    expect(api.updateUserProfile).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});
