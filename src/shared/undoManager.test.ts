/**
 * Unit tests for the profile-update additions to the action history.
 *
 * Focused on the two rules that are easy to regress and expensive to get wrong:
 * the **capture policy** (an over-cap prior value is omitted *entirely*, never
 * truncated and never stored as `''`, which would be indistinguishable from a
 * genuinely empty value) and `markActionUndone`'s `false` for an evicted entry,
 * which is bookkeeping, not failure.
 *
 * `chrome.storage.local` is the global `vi.fn()` mock from `src/test/setup.ts`,
 * backed here by a tiny in-memory store so a write is readable by the next read.
 *
 * Fixtures use only fake placeholders (`00uFAKE…`, `user@example.com`) per CLAUDE.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  captureAttribute,
  captureAttributes,
  logProfileUpdateAction,
  markActionUndone,
  logAction,
  getUndoHistory,
  MAX_CAPTURED_ATTRIBUTES,
  MAX_CAPTURED_VALUE_CHARS,
  type AttributeChange,
} from './undoManager';
import type { UpdateUserProfileMetadata } from './undoTypes';

const storage = chrome.storage.local as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

/** An in-memory `chrome.storage.local` so writes are visible to later reads. */
let store: Record<string, unknown> = {};

beforeEach(() => {
  vi.clearAllMocks();
  store = {};
  storage.get.mockImplementation(async (keys: string[]) =>
    Object.fromEntries(keys.filter((key) => key in store).map((key) => [key, store[key]])),
  );
  storage.set.mockImplementation(async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  });
});

/** A change whose prior value is well within the caps. */
const change = (overrides: Partial<AttributeChange> = {}): AttributeChange => ({
  name: 'department',
  label: 'Department',
  beforeDisplay: 'Support',
  beforeRaw: 'Support',
  afterDisplay: 'Engineering',
  ...overrides,
});

describe('captureAttribute', () => {
  it('captures prior state for an ordinary change', () => {
    const captured = captureAttribute(change(), 0);

    expect(captured).toMatchObject({
      name: 'department',
      label: 'Department',
      beforeDisplay: 'Support',
      beforeRaw: 'Support',
      afterDisplay: 'Engineering',
      restorable: true,
    });
    expect(captured.omitted).toBeUndefined();
  });

  it('captures a genuinely empty prior value as an empty string', () => {
    // The counterpart to the omission cases below: '' means "was empty", and
    // must stay distinguishable from "not captured".
    const captured = captureAttribute(change({ beforeDisplay: '', beforeRaw: '' }), 0);

    expect(captured.beforeDisplay).toBe('');
    expect(captured.restorable).toBe(true);
  });

  it('omits an over-long prior value entirely rather than truncating it', () => {
    const captured = captureAttribute(
      change({
        beforeDisplay: 'x'.repeat(MAX_CAPTURED_VALUE_CHARS + 1),
        beforeRaw: 'x'.repeat(MAX_CAPTURED_VALUE_CHARS + 1),
      }),
      0,
    );

    expect(captured.beforeDisplay).toBeUndefined();
    expect(captured.beforeRaw).toBeUndefined();
    expect(captured.restorable).toBe(false);
    expect(captured.omitted).toBe('too-large');
    // What the write *set* is still recorded — the admin typed it.
    expect(captured.afterDisplay).toBe('Engineering');
  });

  it('keeps a prior value exactly at the cap', () => {
    const captured = captureAttribute(
      change({ beforeDisplay: 'x'.repeat(MAX_CAPTURED_VALUE_CHARS) }),
      0,
    );

    expect(captured.restorable).toBe(true);
    expect(captured.beforeDisplay).toHaveLength(MAX_CAPTURED_VALUE_CHARS);
  });

  it('omits prior state for changes past the attribute cap', () => {
    const captured = captureAttribute(change(), MAX_CAPTURED_ATTRIBUTES);

    expect(captured.beforeDisplay).toBeUndefined();
    expect(captured.beforeRaw).toBeUndefined();
    expect(captured.restorable).toBe(false);
    expect(captured.omitted).toBe('too-many');
  });
});

describe('captureAttributes', () => {
  it('records every change, marking only the ones past the cap unrestorable', () => {
    const changes = Array.from({ length: MAX_CAPTURED_ATTRIBUTES + 2 }, (_, index) =>
      change({ name: `attr${index}` }),
    );

    const captured = captureAttributes(changes);

    expect(captured).toHaveLength(MAX_CAPTURED_ATTRIBUTES + 2);
    expect(captured.filter((entry) => entry.restorable)).toHaveLength(MAX_CAPTURED_ATTRIBUTES);
    expect(captured[MAX_CAPTURED_ATTRIBUTES].omitted).toBe('too-many');
    expect(captured[MAX_CAPTURED_ATTRIBUTES].beforeDisplay).toBeUndefined();
  });
});

describe('logProfileUpdateAction', () => {
  it('persists the capture policy, not the caller-supplied prior value', async () => {
    await logProfileUpdateAction('00uFAKE1', 'jane@example.com', 'Jane Doe', [
      change({ beforeDisplay: 'y'.repeat(MAX_CAPTURED_VALUE_CHARS + 1) }),
    ]);

    const history = await getUndoHistory();
    const metadata = history.actions[0].metadata as UpdateUserProfileMetadata;

    expect(metadata.changes[0].restorable).toBe(false);
    expect(metadata.changes[0].omitted).toBe('too-large');
    expect(metadata.changes[0].beforeDisplay).toBeUndefined();
    expect('beforeDisplay' in metadata.changes[0]).toBe(false);
  });

  it('describes up to three attributes and elides the rest', async () => {
    const names = ['department', 'title', 'division', 'costCenter', 'organization'];

    const action = await logProfileUpdateAction(
      '00uFAKE1',
      'jane@example.com',
      'Jane Doe',
      names.map((name) => change({ name })),
    );

    expect(action.description).toBe('Updated department, title, division and 2 more on Jane Doe');
    expect(action.status).toBe('completed');
  });

  it('describes an undo as a partial restore and records the link back', async () => {
    const action = await logProfileUpdateAction(
      '00uFAKE1',
      'jane@example.com',
      'Jane Doe',
      [change(), change({ name: 'title' }), change({ name: 'division' })],
      { undoOfActionId: 'action_original', originalAttributeCount: 5 },
    );

    expect(action.description).toBe('Restored 3 of 5 attributes on Jane Doe');
    expect((action.metadata as UpdateUserProfileMetadata).undoOfActionId).toBe('action_original');
  });

  it("records an unconfirmed write as 'partial' rather than completed", async () => {
    const action = await logProfileUpdateAction(
      '00uFAKE1',
      'jane@example.com',
      'Jane Doe',
      [change()],
      { status: 'partial' },
    );

    expect(action.status).toBe('partial');
    expect((await getUndoHistory()).actions[0].status).toBe('partial');
  });
});

describe('markActionUndone', () => {
  it('marks a known action undone', async () => {
    const original = await logProfileUpdateAction('00uFAKE1', 'jane@example.com', 'Jane Doe', [
      change(),
    ]);

    expect(await markActionUndone(original.id, 'action_undoing')).toBe(true);
    const history = await getUndoHistory();
    expect(history.actions.find((entry) => entry.id === original.id)?.status).toBe('undone');
  });

  it('returns false for an evicted action while leaving the history intact', async () => {
    const kept = await logAction('Something else', {
      type: 'ACTIVATE_RULE',
      ruleId: '0prFAKE1',
      ruleName: 'Rule',
    });

    // Not a failure: the write happened, only the entry it pointed at is gone.
    expect(await markActionUndone('action_evicted', 'action_undoing')).toBe(false);

    const history = await getUndoHistory();
    expect(history.actions).toHaveLength(1);
    expect(history.actions[0].id).toBe(kept.id);
    expect(history.actions[0].status).toBe('completed');
  });
});
