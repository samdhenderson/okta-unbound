/**
 * Tests for {@link useUsersTabProfileEdit} — the Users tab's profile-edit wiring.
 *
 * The hook composes three tested hooks and adds four decisions of its own. Those
 * decisions are what this file pins, in order of how badly getting them wrong
 * would hurt:
 *
 * - **`'unknown'` is a `warning`, never a `danger`.** A non-GET is never retried,
 *   so a transport error means the write may have applied. Calling that "failed"
 *   is a false statement about somebody's directory — and no Undo may be offered
 *   for a write we cannot confirm happened.
 * - **A confirmed save lifts the refreshed user and offers Undo.** There is no
 *   `user` cache key, so a missing lift leaves the pane showing values Okta no
 *   longer has. The Undo comes from reading the history entry `confirmSave` just
 *   wrote, and every guard on that read is a reason not to offer the button.
 * - **Drift is reported by name only.** Never a value; the same rule
 *   `useUndoAction` keeps, because a constructed message eventually reaches a log.
 * - **Edit is offered only when something is editable**, decided through the real
 *   `attributeEditability` gate — with the locked-verdict-wins tie-break
 *   `useProfileEdit` uses for a duplicated attribute name.
 *
 * The three composed hooks are mocked at their own module boundary so an outcome
 * can be declared rather than staged through a write; `attributeEditability` is
 * deliberately **not** mocked, because "is the Edit button offered?" is only
 * worth asserting against the real gate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUsersTabProfileEdit } from './useUsersTabProfileEdit';
import type { ProfileSaveOutcome, UseProfileEditReturn } from './useProfileEdit';
import type { DraftChange } from '../components/users/profileDraft';
import type { UndoOutcome } from './useUndoAction';
import { getUndoHistory } from '../../shared/undoManager';
import type { AttributeDescriptor } from '../components/users/profileAttributes';
import type { AlertAction, AlertMessageData } from '../components/shared/AlertMessage';
import type { OktaUser } from '../../shared/types';
import type { UndoAction } from '../../shared/undoTypes';

// ---------------------------------------------------------------------------
// Test doubles for the three composed hooks
// ---------------------------------------------------------------------------

const confirmSave = vi.fn<() => Promise<ProfileSaveOutcome>>();
const undo = vi.fn<(action: UndoAction) => Promise<UndoOutcome>>();
const getUserRaw = vi.fn();
const resetReport = vi.fn();
const analyze = vi.fn();

/** One diffed change, as `useProfileEdit` would hand it to the confirmation. */
const change = (
  name: string,
  label: string,
  before = 'PRIOR_VALUE',
  after = 'NEW_VALUE',
): DraftChange => ({
  name,
  label,
  beforeDisplay: before,
  afterDisplay: after,
  afterRaw: after,
  changesSignIn: false,
});

/** Mutable so a test can declare the edit state the mapping runs against. */
const editState = {
  isEditing: false,
  changeCount: 0,
  hasInvalid: false,
  pendingSave: null as UseProfileEditReturn['pendingSave'],
  draftPatch: {} as Readonly<Record<string, unknown>>,
};

vi.mock('./useProfileEdit', () => ({
  useProfileEdit: (): UseProfileEditReturn => ({
    isEditing: editState.isEditing,
    begin: vi.fn(),
    cancel: vi.fn(),
    cells: {},
    changes: Array.from({ length: editState.changeCount }, (_, index) =>
      change(`attr${index}`, `Attr ${index}`),
    ),
    hasChanges: editState.changeCount > 0,
    hasInvalid: editState.hasInvalid,
    pendingSave: editState.pendingSave,
    requestSave: vi.fn(),
    dismissSave: vi.fn(),
    confirmSave,
    isSaving: false,
    draftPatch: editState.draftPatch,
  }),
}));

vi.mock('./useBlastRadius', () => ({
  useBlastRadius: () => ({
    report: { status: 'not-computed' },
    analyze,
    reset: resetReport,
    isAnalyzing: false,
  }),
}));

vi.mock('./useUndoAction', () => ({
  useUndoAction: () => ({ undo, undoingActionId: null, undoability: vi.fn() }),
}));

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => ({ getUserRaw }),
}));

vi.mock('../../shared/undoManager', () => ({
  getUndoHistory: vi.fn(),
}));

const mockedHistory = vi.mocked(getUndoHistory);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const user = {
  id: '00uFAKE0001',
  status: 'ACTIVE',
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'L',
  },
  credentials: { provider: { type: 'OKTA' } },
} as unknown as OktaUser;

/** A profile attribute the org's schema describes as plainly writable. */
const writable = (name: string): AttributeDescriptor => ({
  key: `profile.${name}`,
  name,
  label: name,
  kind: 'base',
  value: '',
  raw: '',
  isEmpty: true,
  property: { type: 'string', mutability: 'READ_WRITE' },
});

/** The same attribute, but read-only per the schema. */
const readOnly = (name: string): AttributeDescriptor => ({
  ...writable(name),
  property: { type: 'string', mutability: 'READ_ONLY' },
});

/** A top-level account field — locked by the gate's first branch. */
const systemField = (name: string): AttributeDescriptor => ({
  key: name,
  name,
  label: name,
  kind: 'system',
  value: '',
  raw: '',
  isEmpty: true,
});

/** The history entry `confirmSave` writes for a completed profile save. */
const savedEntry = (over: Partial<UndoAction> = {}): UndoAction =>
  ({
    id: 'action_1',
    type: 'UPDATE_USER_PROFILE',
    timestamp: 1,
    description: 'Updated department on Ada L',
    status: 'completed',
    metadata: {
      type: 'UPDATE_USER_PROFILE',
      userId: user.id,
      userLogin: user.profile.login,
      userName: 'Ada L',
      changes: [],
    },
    ...over,
  }) as UndoAction;

interface Published {
  message: AlertMessageData;
  action?: AlertAction;
}

/** Render the hook, recording everything it publishes to the tab's banner. */
function setup(attributes: AttributeDescriptor[] = [writable('department')]) {
  const published: Published[] = [];
  const lifted: OktaUser[] = [];
  const refreshed: OktaUser[] = [];

  const rendered = renderHook(() =>
    useUsersTabProfileEdit({
      user,
      attributes,
      memberships: [],
      rules: { status: 'unresolved' },
      targetTabId: 7,
      enabled: true,
      onUserUpdated: (next) => lifted.push(next),
      onMembershipsChanged: (next) => refreshed.push(next),
      onResult: (message, action) => published.push({ message, action }),
    }),
  );

  return { ...rendered, published, lifted, refreshed };
}

/** The banner the hook published last. */
function last(published: Published[]): Published {
  const entry = published.at(-1);
  if (!entry) throw new Error('nothing was published');
  return entry;
}

beforeEach(() => {
  vi.clearAllMocks();
  editState.isEditing = false;
  editState.changeCount = 0;
  editState.hasInvalid = false;
  editState.pendingSave = null;
  editState.draftPatch = {};
  mockedHistory.mockResolvedValue({ actions: [], maxSize: 50 });
  getUserRaw.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Whether Edit is offered at all
// ---------------------------------------------------------------------------

describe('the Edit affordance', () => {
  it('is offered when at least one attribute is writable', () => {
    const { result } = setup([systemField('id'), readOnly('created'), writable('department')]);
    expect(result.current.controls.canEdit).toBe(true);
  });

  it('is withheld when nothing on the profile can be edited', () => {
    const { result } = setup([systemField('id'), readOnly('department')]);
    expect(result.current.controls.canEdit).toBe(false);
  });

  it('withholds it for a duplicated name whose other descriptor is locked', () => {
    // `useProfileEdit` resolves a duplicated name to the LOCKED verdict, so the
    // button must not promise a control the cells will not build.
    const { result } = setup([writable('status'), systemField('status')]);
    expect(result.current.controls.canEdit).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Save outcomes
// ---------------------------------------------------------------------------

describe('confirming a save', () => {
  it('reports an unconfirmed write as a warning, never as a failure, and offers no undo', async () => {
    editState.pendingSave = [change('department', 'Department')];
    confirmSave.mockResolvedValue({ kind: 'unknown' });

    const { result, published } = setup();
    await act(async () => {
      result.current.save.onConfirm();
    });

    expect(last(published).message.type).toBe('warning');
    expect(last(published).message.text).toBe(
      'The result of this change is unknown. Reload to check.',
    );
    expect(last(published).action).toBeUndefined();
  });

  it('reports a rejected write as danger, carrying Okta’s reason', async () => {
    editState.pendingSave = [change('department', 'Department')];
    confirmSave.mockResolvedValue({ kind: 'failed', error: 'Okta rejected the update.' });

    const { result, published } = setup();
    await act(async () => {
      result.current.save.onConfirm();
    });

    expect(last(published).message).toEqual({
      type: 'danger',
      text: 'Okta rejected the update.',
    });
    expect(last(published).action).toBeUndefined();
  });

  it('names the count on success and offers Undo from the recorded entry', async () => {
    editState.pendingSave = [change('department', 'Department'), change('title', 'Title')];
    confirmSave.mockResolvedValue({ kind: 'saved', user });
    mockedHistory.mockResolvedValue({ actions: [savedEntry()], maxSize: 50 });

    const { result, published } = setup();
    await act(async () => {
      result.current.save.onConfirm();
    });

    expect(last(published).message.type).toBe('success');
    expect(last(published).message.text).toContain('2 attributes');
    expect(last(published).action?.label).toBe('Undo');
  });

  it('re-reads the memberships, because a profile write can move them', async () => {
    editState.pendingSave = [change('department', 'Department')];
    confirmSave.mockResolvedValue({ kind: 'saved', user });
    mockedHistory.mockResolvedValue({ actions: [savedEntry()], maxSize: 50 });

    const { result, refreshed } = setup();
    await act(async () => {
      result.current.save.onConfirm();
    });

    expect(refreshed).toHaveLength(1);
    // The user the write produced, not the one the render closed over. Rules are
    // evaluated against attributes, so a reload classifying the old profile
    // fetches the right groups and then calls none of them rule-fed.
    expect(refreshed[0]).toBe(user);
  });

  it('leaves the memberships alone when the write did not land', async () => {
    editState.pendingSave = [change('department', 'Department')];
    confirmSave.mockResolvedValue({ kind: 'failed', error: 'Okta rejected the update.' });

    const { result, refreshed } = setup();
    await act(async () => {
      result.current.save.onConfirm();
    });

    // Not a detail. A refresh here would re-fetch and re-render the pane over a
    // write that never happened, which reads on screen as the edit taking
    // effect.
    expect(refreshed).toHaveLength(0);
  });

  it('still reports the save when the history entry cannot be identified', async () => {
    editState.pendingSave = [change('department', 'Department')];
    confirmSave.mockResolvedValue({ kind: 'saved', user });
    // An entry that is itself an undo must never be offered as this save's undo.
    mockedHistory.mockResolvedValue({
      actions: [
        savedEntry({
          metadata: {
            type: 'UPDATE_USER_PROFILE',
            userId: user.id,
            userLogin: user.profile.login,
            userName: 'Ada L',
            changes: [],
            undoOfActionId: 'action_0',
          },
        }),
      ],
      maxSize: 50,
    });

    const { result, published } = setup();
    await act(async () => {
      result.current.save.onConfirm();
    });

    expect(last(published).message.type).toBe('success');
    expect(last(published).action).toBeUndefined();
  });

  it('offers no undo for an entry recorded as partial', async () => {
    editState.pendingSave = [change('department', 'Department')];
    confirmSave.mockResolvedValue({ kind: 'saved', user });
    mockedHistory.mockResolvedValue({ actions: [savedEntry({ status: 'partial' })], maxSize: 50 });

    const { result, published } = setup();
    await act(async () => {
      result.current.save.onConfirm();
    });

    expect(last(published).action).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

describe('undoing a save', () => {
  /** Run a save, then press the Undo the banner offered. */
  async function saveThenUndo(outcome: UndoOutcome) {
    // `change()` uses distinctive sentinel values, so "no value ever reaches a
    // message" is assertable rather than merely plausible.
    editState.pendingSave = [change('department', 'Department')];
    confirmSave.mockResolvedValue({ kind: 'saved', user });
    mockedHistory.mockResolvedValue({ actions: [savedEntry()], maxSize: 50 });
    undo.mockResolvedValue(outcome);

    const harness = setup();
    await act(async () => {
      harness.result.current.save.onConfirm();
    });

    const action = last(harness.published).action;
    if (!action) throw new Error('no Undo was offered');
    await act(async () => {
      action.onClick();
    });

    return harness;
  }

  it('lifts the re-read user so the pane stops showing the replaced values', async () => {
    const restored = { ...user, lastUpdated: '2026-01-01T00:00:00.000Z' } as OktaUser;
    getUserRaw.mockResolvedValue(restored);

    const { published, lifted } = await saveThenUndo({
      kind: 'undone',
      restored: 1,
      skipped: 0,
      actionId: 'action_2',
    });

    expect(lifted).toContain(restored);
    expect(last(published).message.type).toBe('success');
    expect(last(published).message.text).toContain('1 attribute');
  });

  it('re-reads the memberships again, because putting the value back moves them back', async () => {
    getUserRaw.mockResolvedValue(user);

    const { refreshed } = await saveThenUndo({
      kind: 'undone',
      restored: 1,
      skipped: 0,
      actionId: 'action_2',
    });

    // Once for the save, once for the undo.
    expect(refreshed).toHaveLength(2);
  });

  it('says how many attributes were left alone when some were never captured', async () => {
    const { published } = await saveThenUndo({
      kind: 'undone',
      restored: 2,
      skipped: 1,
      actionId: 'action_2',
    });

    expect(last(published).message.text).toContain('2 attributes');
    expect(last(published).message.text).toContain('1 attribute had no previous value recorded');
  });

  it('reports drift as a warning naming the attributes and nothing else', async () => {
    const { published } = await saveThenUndo({
      kind: 'drifted',
      attributeNames: ['department', 'title'],
    });

    const { message } = last(published);
    expect(message.type).toBe('warning');
    expect(message.text).toContain('department, title');
    // Names only — no before/after value ever reaches a message.
    expect(message.text).not.toContain('PRIOR_VALUE');
    expect(message.text).not.toContain('NEW_VALUE');
  });

  it('reports a failed restore as danger', async () => {
    const { published } = await saveThenUndo({ kind: 'failed', error: 'The write was refused.' });

    expect(last(published).message).toEqual({ type: 'danger', text: 'The write was refused.' });
  });

  it('withdraws the Undo button the moment it is pressed', async () => {
    const { published } = await saveThenUndo({
      kind: 'undone',
      restored: 1,
      skipped: 0,
      actionId: 'action_2',
    });

    // The interim banner replaced the one carrying the button, so a second press
    // is not possible — and none of the banners after it carries an action.
    expect(published.filter((entry) => entry.action !== undefined)).toHaveLength(1);
    expect(published.map((entry) => entry.message.text)).toContain(
      'Putting the previous values back…',
    );
  });
});

// ---------------------------------------------------------------------------
// The blast-radius report
// ---------------------------------------------------------------------------

describe('the blast-radius report', () => {
  it('is retracted whenever the draft moves', () => {
    const { rerender } = setup();
    resetReport.mockClear();

    editState.draftPatch = { department: 'Platform' };
    rerender();

    expect(resetReport).toHaveBeenCalled();
  });

  it('is not retracted on a render that leaves the draft alone', () => {
    const { rerender } = setup();
    resetReport.mockClear();

    rerender();

    expect(resetReport).not.toHaveBeenCalled();
  });
});
