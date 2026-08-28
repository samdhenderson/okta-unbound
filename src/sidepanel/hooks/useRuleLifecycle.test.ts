/**
 * Tests for {@link useRuleLifecycle} — the security-sensitive audit path behind
 * rule activate/deactivate (`DEBT.md` D-004, D-013b).
 *
 * Four branches are pinned here:
 *
 * 1. Attribution comes from the facade's `getCurrentUser()`. A resolved admin is
 *    recorded verbatim; every `kind: 'unavailable'` answer is recorded as
 *    `performedBy: null` / `actorResolution: 'unavailable'` — never a
 *    placeholder identity — and the rule change still goes ahead (`D-013`).
 *    Which failure produced the non-answer (`threw` / `failed` / `no-email`) is
 *    the facade's business, pinned in `useOktaApi/core.getCurrentUser.test.ts`.
 * 2. A `response.success === false` mutation surfaces an error to the caller and
 *    writes a `failed` audit entry without reloading the rule list.
 * 3. A thrown error surfaces its message and writes a `failed` audit entry with
 *    the placeholder group identifiers.
 * 4. An unresolved actor also raises the non-blocking `actorNotice` so the admin
 *    is told at the time — and the rule change still happens (`D-013c`).
 *
 * The Okta API (`useOktaApi`), the audit store, and the undo manager are fully
 * mocked; all identifiers are fake placeholders.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRuleLifecycle } from './useRuleLifecycle';
import { auditStore } from '../../shared/storage/auditStore';
import type { FormattedRule } from '../../shared/types';

vi.mock('../../shared/storage/auditStore', () => ({
  auditStore: { logOperation: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../shared/undoManager', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

const api = {
  getCurrentUser: vi.fn(),
  activateGroupRule: vi.fn(),
  deactivateGroupRule: vi.fn(),
};

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => api,
}));

const mockedAuditStore = vi.mocked(auditStore);

const RULE_ID = '0prFAKERULE001';

const rules: FormattedRule[] = [
  {
    id: RULE_ID,
    name: 'Engineering auto-assign',
    status: 'INACTIVE',
    condition: 'user.department == "Eng"',
    groupIds: ['00gFAKEGROUP01'],
    groupNames: ['Engineering'],
    userAttributes: ['department'],
    created: '2026-01-01T00:00:00.000Z',
    lastUpdated: '2026-01-02T00:00:00.000Z',
  },
];

/** Render the hook with mockable collaborators and drive one lifecycle call. */
function setup() {
  const reload = vi.fn().mockResolvedValue(undefined);
  const onError = vi.fn();
  const { result } = renderHook(() => useRuleLifecycle({ targetTabId: 1, rules, reload, onError }));
  return { result, reload, onError };
}

/** The single audit entry written by the run under test. */
function onlyAuditEntry() {
  expect(mockedAuditStore.logOperation).toHaveBeenCalledTimes(1);
  return mockedAuditStore.logOperation.mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getCurrentUser.mockResolvedValue({
    kind: 'resolved',
    email: 'admin@example.com',
    id: '00uFAKEADMIN01',
  });
  api.activateGroupRule.mockResolvedValue({ success: true });
  api.deactivateGroupRule.mockResolvedValue({ success: true });
  mockedAuditStore.logOperation.mockResolvedValue(undefined);
});

describe('useRuleLifecycle current-user attribution', () => {
  it('attributes a successful activation to the signed-in admin', async () => {
    const { result, reload, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    const entry = onlyAuditEntry();
    expect(entry.action).toBe('activate_rule');
    expect(entry.result).toBe('success');
    expect(entry.performedBy).toBe('admin@example.com');
    expect(entry.actorResolution).toBe('resolved');
    expect(entry.groupId).toBe('00gFAKEGROUP01');
    expect(entry.groupName).toBe('Engineering');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('records no actor when the lookup itself threw, and still performs the rule change', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'threw' });
    const { result, reload, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    // The rule change still succeeds and is still audited — the entry says it
    // could not name the actor rather than inventing one, and a failed metadata
    // lookup never blocks a legitimate admin action (D-013).
    const entry = onlyAuditEntry();
    expect(entry.result).toBe('success');
    expect(entry.performedBy).toBeNull();
    expect(entry.actorResolution).toBe('unavailable');
    expect(onError).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('records no actor when the lookup returned an unsuccessful response', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'failed' });
    const { result, onError } = setup();

    await act(async () => {
      await result.current.deactivateRule(RULE_ID);
    });

    const entry = onlyAuditEntry();
    expect(entry.performedBy).toBeNull();
    expect(entry.actorResolution).toBe('unavailable');
    expect(onError).not.toHaveBeenCalled();
  });

  it('records no actor when the profile carried no email', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'no-email' });
    const { result } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    const entry = onlyAuditEntry();
    expect(entry.performedBy).toBeNull();
    expect(entry.actorResolution).toBe('unavailable');
  });

  it('asks the facade for the actor instead of hand-rolling the /users/me request', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    // One lookup per run, through the cached facade path. The mocked facade
    // deliberately exposes no `makeApiRequest`: a hook that still hand-rolled
    // `/api/v1/users/me` would throw here instead of auditing a success
    // (D-013b/D-014).
    expect(api.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(onlyAuditEntry().result).toBe('success');
  });

  it('keeps a successful activation working when the audit write itself rejects', async () => {
    mockedAuditStore.logOperation.mockRejectedValue(new Error('idb unavailable'));
    const { result, reload, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('useRuleLifecycle failed mutation response', () => {
  it("surfaces the API error and records a 'failed' audit entry without reloading", async () => {
    api.activateGroupRule.mockResolvedValue({ success: false, error: 'Rule is already active' });
    const { result, reload, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    expect(onError).toHaveBeenCalledWith('Rule is already active');
    expect(reload).not.toHaveBeenCalled();

    const entry = onlyAuditEntry();
    expect(entry.action).toBe('activate_rule');
    expect(entry.result).toBe('failed');
    expect(entry.performedBy).toBe('admin@example.com');
    expect(entry.groupId).toBe('00gFAKEGROUP01');
    expect(entry.details.errorMessages).toEqual(['Rule is already active']);
  });

  it('falls back to the deactivate-specific message when the failed response carries no error', async () => {
    api.deactivateGroupRule.mockResolvedValue({ success: false });
    const { result, onError } = setup();

    await act(async () => {
      await result.current.deactivateRule(RULE_ID);
    });

    expect(onError).toHaveBeenCalledWith('Failed to deactivate rule');

    const entry = onlyAuditEntry();
    expect(entry.action).toBe('deactivate_rule');
    expect(entry.result).toBe('failed');
    expect(entry.details.errorMessages).toEqual(['Unknown error']);
  });

  it('still surfaces the error to the user when the failure audit write itself rejects', async () => {
    api.activateGroupRule.mockResolvedValue({ success: false, error: 'Rule is already active' });
    mockedAuditStore.logOperation.mockRejectedValue(new Error('idb unavailable'));
    const { result, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    expect(onError).toHaveBeenCalledWith('Rule is already active');
  });

  it("records 'multiple' as the group id when the rule is not in the loaded list", async () => {
    api.activateGroupRule.mockResolvedValue({ success: false, error: 'Not found' });
    const { result } = setup();

    await act(async () => {
      await result.current.activateRule('0prFAKEMISSING');
    });

    const entry = onlyAuditEntry();
    expect(entry.groupId).toBe('multiple');
    expect(entry.groupName).toBe('Unknown Rule');
  });
});

describe('useRuleLifecycle thrown error', () => {
  it("surfaces the thrown message and records a 'failed' audit entry without reloading", async () => {
    api.activateGroupRule.mockRejectedValue(new Error('Network unreachable'));
    const { result, reload, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    expect(onError).toHaveBeenCalledWith('Network unreachable');
    expect(reload).not.toHaveBeenCalled();

    const entry = onlyAuditEntry();
    expect(entry.action).toBe('activate_rule');
    expect(entry.result).toBe('failed');
    expect(entry.performedBy).toBe('admin@example.com');
    expect(entry.groupId).toBe('00gFAKEGROUP01');
    expect(entry.groupName).toBe('Engineering');
    expect(entry.details.errorMessages).toEqual(['Network unreachable']);
  });

  it("records 'Unknown error' when a non-Error value is thrown during deactivation", async () => {
    api.deactivateGroupRule.mockRejectedValue('just a string');
    const { result, onError } = setup();

    await act(async () => {
      await result.current.deactivateRule(RULE_ID);
    });

    expect(onError).toHaveBeenCalledWith('Unknown error');

    const entry = onlyAuditEntry();
    expect(entry.action).toBe('deactivate_rule');
    expect(entry.details.errorMessages).toEqual(['Unknown error']);
  });

  it('still surfaces the thrown message when the failure audit write itself rejects', async () => {
    api.activateGroupRule.mockRejectedValue(new Error('Network unreachable'));
    mockedAuditStore.logOperation.mockRejectedValue(new Error('idb unavailable'));
    const { result, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    expect(onError).toHaveBeenCalledWith('Network unreachable');
  });

  it("records 'unknown' group identifiers when the throwing rule is not in the loaded list", async () => {
    api.activateGroupRule.mockRejectedValue(new Error('boom'));
    const { result } = setup();

    await act(async () => {
      await result.current.activateRule('0prFAKEMISSING');
    });

    const entry = onlyAuditEntry();
    expect(entry.groupId).toBe('unknown');
    expect(entry.groupName).toBe('Unknown');
  });

  it('records no actor on the failure entry when the actor lookup also came back unavailable', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'threw' });
    api.activateGroupRule.mockRejectedValue(new Error('boom'));
    const { result, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    expect(onError).toHaveBeenCalledWith('boom');
    const entry = onlyAuditEntry();
    expect(entry.performedBy).toBeNull();
    expect(entry.actorResolution).toBe('unavailable');
  });
});

describe('useRuleLifecycle actor-unavailable notice', () => {
  // D-013c: the trail already stops lying (D-013a/b); these pin that the admin
  // is *told* at the time, once, and that the telling never gates the write.
  const NOTICE_TEXT =
    "Couldn't confirm your signed-in identity. This action will be recorded without an actor.";

  it('raises the notice and still performs the rule change when the actor is unavailable', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'no-email' });
    const { result, reload, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    expect(result.current.actorNotice).toEqual({ text: NOTICE_TEXT, type: 'warning' });
    // Non-blocking: the mutation ran, was audited, reloaded the list, and no
    // error was surfaced — the notice is the only difference.
    expect(api.activateGroupRule).toHaveBeenCalledWith(RULE_ID);
    expect(onlyAuditEntry().result).toBe('success');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('raises no notice when the actor resolved', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.deactivateRule(RULE_ID);
    });

    expect(result.current.actorNotice).toBeNull();
  });

  it('clears the notice when the admin dismisses it', async () => {
    api.getCurrentUser.mockResolvedValue({ kind: 'unavailable', reason: 'threw' });
    const { result } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });
    expect(result.current.actorNotice).not.toBeNull();

    act(() => {
      result.current.dismissActorNotice();
    });
    expect(result.current.actorNotice).toBeNull();
  });
});

describe('useRuleLifecycle without a connected tab', () => {
  it('no-ops: no mutation, no audit entry, no error', async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    const { result } = renderHook(() => useRuleLifecycle({ rules, reload, onError }));

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    expect(api.activateGroupRule).not.toHaveBeenCalled();
    expect(mockedAuditStore.logOperation).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
