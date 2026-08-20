/**
 * @module sidepanel/hooks/useProfileEdit.test
 * @description What the profile editor is allowed to write, and what it must
 * refuse to write.
 *
 * Mocked at the `useOktaApi` facade (this repo has no MSW), plus the undo history
 * and the entity cache, so every assertion is about the hook's own decisions:
 * which keys reach the request body, which of the three write outcomes reaches
 * the caller, what survives a rejection, and when a draft is thrown away.
 *
 * The two that matter most are the ones a green suite would otherwise let slip:
 * a locked attribute leaking into the patch, and an `'unknown'` outcome being
 * recorded as though nothing had happened.
 *
 * Security: every fixture uses fake identifiers (`00uFAKE…`, `@example.com`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { OktaUser } from '../../shared/types';
import type { OktaUserSchemaProperty } from '../../shared/schemas/okta';

const api = vi.hoisted(() => ({
  updateUserProfile: vi.fn(),
}));

const undo = vi.hoisted(() => ({
  logProfileUpdateAction: vi.fn(),
}));

const cache = vi.hoisted(() => ({
  invalidate: vi.fn(),
}));

vi.mock('./useOktaApi', () => ({ useOktaApi: () => api }));
vi.mock('../../shared/undoManager', () => ({
  logProfileUpdateAction: undo.logProfileUpdateAction,
}));
vi.mock('../cache/entityCache', () => ({ invalidate: cache.invalidate }));

import { useProfileEdit, type UseProfileEditOptions } from './useProfileEdit';
import type { AttributeDescriptor } from '../components/users/profileAttributes';

const USER_ID = '00uFAKE00000000000001';

/** A `READ_WRITE`, Okta-mastered string property — the editable case. */
const writable: OktaUserSchemaProperty = {
  type: 'string',
  mutability: 'READ_WRITE',
  master: { type: 'OKTA' },
};

/** The same attribute reported as read-only — the gate locks it. */
const readOnly: OktaUserSchemaProperty = {
  type: 'string',
  mutability: 'READ_ONLY',
  master: { type: 'OKTA' },
};

const makeUser = (over: Partial<OktaUser> = {}): OktaUser =>
  ({
    id: USER_ID,
    status: 'ACTIVE',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    credentials: { provider: { type: 'OKTA' } },
    profile: {
      login: 'jane@example.com',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      department: 'Sales',
      employeeNumber: 'E-1',
    },
    ...over,
  }) as OktaUser;

/** One profile-attribute descriptor, as `allProfileAttributes` would emit it. */
const attribute = (
  name: string,
  raw: unknown,
  property: OktaUserSchemaProperty,
): AttributeDescriptor => ({
  key: `profile.${name}`,
  name,
  label: name,
  kind: 'custom',
  value: String(raw),
  raw,
  isEmpty: raw === '',
  property,
});

/** `department` is writable; `employeeNumber` is locked. */
const ATTRIBUTES: AttributeDescriptor[] = [
  attribute('department', 'Sales', writable),
  attribute('employeeNumber', 'E-1', readOnly),
];

/** The same inventory with `employeeNumber` still writable. */
const ALL_WRITABLE: AttributeDescriptor[] = [
  attribute('department', 'Sales', writable),
  attribute('employeeNumber', 'E-1', writable),
];

const mount = (over: Partial<UseProfileEditOptions> = {}) => {
  const onUserUpdated = vi.fn();
  const options: UseProfileEditOptions = {
    user: makeUser(),
    attributes: ATTRIBUTES,
    targetTabId: 1,
    onUserUpdated,
    enabled: true,
    ...over,
  };
  const hook = renderHook((props: UseProfileEditOptions) => useProfileEdit(props), {
    initialProps: options,
  });
  return { ...hook, onUserUpdated, options };
};

/** Enter edit mode, type into each named cell, then arm and confirm the save. */
const editAndSave = async (hook: ReturnType<typeof mount>, edits: Record<string, string>) => {
  act(() => hook.result.current.begin());
  act(() => {
    for (const [name, value] of Object.entries(edits)) {
      hook.result.current.cells[name]?.onChange?.(value);
    }
  });
  act(() => hook.result.current.requestSave());

  let outcome: Awaited<ReturnType<typeof hook.result.current.confirmSave>> | undefined;
  await act(async () => {
    outcome = await hook.result.current.confirmSave();
  });
  return outcome;
};

/** The patch body of the nth `updateUserProfile` call. */
const patchOf = (call = 0): Record<string, unknown> =>
  api.updateUserProfile.mock.calls[call]?.[1] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  undo.logProfileUpdateAction.mockResolvedValue({ id: 'act-1' });
  api.updateUserProfile.mockResolvedValue({ kind: 'saved', user: makeUser() });
});

describe('useProfileEdit', () => {
  it('discards every draft when the edit is cancelled', () => {
    const hook = mount();

    act(() => hook.result.current.begin());
    act(() => hook.result.current.cells.department?.onChange?.('Marketing'));
    expect(hook.result.current.hasChanges).toBe(true);

    act(() => hook.result.current.cancel());
    expect(hook.result.current.isEditing).toBe(false);

    act(() => hook.result.current.begin());
    expect(hook.result.current.cells.department?.draft).toBeUndefined();
    expect(hook.result.current.hasChanges).toBe(false);
  });

  it('does not arm Save when a draft has been typed back to the saved value', () => {
    const hook = mount();

    act(() => hook.result.current.begin());
    act(() => hook.result.current.cells.department?.onChange?.('Sale'));
    expect(hook.result.current.hasChanges).toBe(true);

    act(() => hook.result.current.cells.department?.onChange?.('Sales'));
    expect(hook.result.current.hasChanges).toBe(false);
    expect(hook.result.current.changes).toHaveLength(0);

    act(() => hook.result.current.requestSave());
    expect(hook.result.current.pendingSave).toBeNull();
  });

  it('sends one sparse patch carrying only the changed attribute', async () => {
    const hook = mount({ attributes: ALL_WRITABLE });

    await editAndSave(hook, { department: 'Marketing' });

    expect(api.updateUserProfile).toHaveBeenCalledTimes(1);
    expect(api.updateUserProfile).toHaveBeenCalledWith(USER_ID, { department: 'Marketing' });
    expect(patchOf()).not.toHaveProperty('employeeNumber');
  });

  it('never lets a locked attribute reach the request body', async () => {
    // The draft is typed while both attributes are writable, and the inventory
    // is then re-derived with `employeeNumber` read-only — a stale schema
    // arriving, or the other surface's save landing a fresh one. The draft key
    // survives; the write must not.
    const hook = mount({ attributes: ALL_WRITABLE });

    act(() => hook.result.current.begin());
    act(() => {
      hook.result.current.cells.department?.onChange?.('Marketing');
      hook.result.current.cells.employeeNumber?.onChange?.('E-999');
    });
    expect(hook.result.current.changes).toHaveLength(2);

    hook.rerender({ ...hook.options, attributes: ATTRIBUTES });
    expect(hook.result.current.cells.employeeNumber?.onChange).toBeUndefined();
    expect(hook.result.current.cells.employeeNumber?.draft).toBe('E-999');

    act(() => hook.result.current.requestSave());
    await act(async () => {
      await hook.result.current.confirmSave();
    });

    expect(patchOf()).toEqual({ department: 'Marketing' });
  });

  it('lifts the saved user, invalidates its memberships and records history', async () => {
    const saved = makeUser({ lastUpdated: '2026-02-02T00:00:00.000Z' });
    api.updateUserProfile.mockResolvedValue({ kind: 'saved', user: saved });
    const hook = mount();

    const outcome = await editAndSave(hook, { department: 'Marketing' });

    expect(outcome).toEqual({ kind: 'saved', user: saved });
    expect(hook.onUserUpdated).toHaveBeenCalledWith(saved);
    expect(cache.invalidate).toHaveBeenCalledWith(['userMemberships', USER_ID]);
    expect(undo.logProfileUpdateAction).toHaveBeenCalledTimes(1);

    const [userId, login, name, changes, options] = undo.logProfileUpdateAction.mock.calls[0] as [
      string,
      string,
      string,
      unknown[],
      unknown,
    ];
    expect(userId).toBe(USER_ID);
    expect(login).toBe('jane@example.com');
    expect(name).toBe('Jane Doe');
    expect(changes).toEqual([
      expect.objectContaining({
        name: 'department',
        beforeDisplay: 'Sales',
        beforeRaw: 'Sales',
        afterDisplay: 'Marketing',
      }),
    ]);
    expect(options).toEqual({ status: 'completed' });
  });

  it('records an unconfirmed write as partial rather than reporting a failure', async () => {
    api.updateUserProfile.mockResolvedValue({ kind: 'unknown', error: 'port closed' });
    const hook = mount();

    const outcome = await editAndSave(hook, { department: 'Marketing' });

    expect(outcome).toEqual({ kind: 'unknown' });
    expect(undo.logProfileUpdateAction).toHaveBeenCalledTimes(1);
    const options = undo.logProfileUpdateAction.mock.calls[0]?.[4] as unknown;
    expect(options).toEqual({ status: 'partial' });
    // The write may have landed, so the draft must not be re-offered.
    expect(hook.result.current.isEditing).toBe(false);
    expect(hook.onUserUpdated).not.toHaveBeenCalled();
  });

  it('keeps the draft and edit mode when Okta rejects the write, and records nothing', async () => {
    api.updateUserProfile.mockResolvedValue({ kind: 'failed', error: 'Okta said no' });
    const hook = mount();

    const outcome = await editAndSave(hook, { department: 'Marketing' });

    expect(outcome).toEqual({ kind: 'failed', error: 'Okta said no' });
    expect(hook.result.current.isEditing).toBe(true);
    expect(hook.result.current.cells.department?.draft).toBe('Marketing');
    expect(hook.result.current.hasChanges).toBe(true);
    expect(undo.logProfileUpdateAction).not.toHaveBeenCalled();
  });

  it('throws the draft away when the user changes underneath it', () => {
    const hook = mount();

    act(() => hook.result.current.begin());
    act(() => hook.result.current.cells.department?.onChange?.('Marketing'));
    expect(hook.result.current.hasChanges).toBe(true);

    // The same person, saved by the other surface: a new `lastUpdated` means
    // this draft was typed against values that no longer exist.
    hook.rerender({
      ...hook.options,
      user: makeUser({ lastUpdated: '2026-03-03T00:00:00.000Z' }),
    });

    expect(hook.result.current.isEditing).toBe(false);
    expect(hook.result.current.hasChanges).toBe(false);
    expect(hook.result.current.cells).toEqual({});
  });

  it('issues no request when the surface is not active', async () => {
    const hook = mount();

    act(() => hook.result.current.begin());
    act(() => hook.result.current.cells.department?.onChange?.('Marketing'));
    act(() => hook.result.current.requestSave());

    hook.rerender({ ...hook.options, enabled: false });
    await act(async () => {
      await hook.result.current.confirmSave();
    });

    expect(api.updateUserProfile).not.toHaveBeenCalled();
  });
});
