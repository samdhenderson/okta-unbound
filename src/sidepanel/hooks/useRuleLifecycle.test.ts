/**
 * Tests for {@link useRuleLifecycle} — the security-sensitive audit path behind
 * rule activate/deactivate (`DEBT.md` D-004).
 *
 * Three branches are pinned here, all as *observed current behaviour* so a later
 * fix has something to move:
 *
 * 1. The `/api/v1/users/me` lookup failing still writes an audit entry, but
 *    attributes it to the `unknown@unknown.com` placeholder — i.e. the entry
 *    misattributes who performed the rule change, and nothing is surfaced to the
 *    user. These cases assert today's behaviour, not the desired one.
 * 2. A `response.success === false` mutation surfaces an error to the caller and
 *    writes a `failed` audit entry without reloading the rule list.
 * 3. A thrown error surfaces its message and writes a `failed` audit entry with
 *    the placeholder group identifiers.
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
  makeApiRequest: vi.fn(),
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
  api.makeApiRequest.mockResolvedValue({
    success: true,
    data: { id: '00uFAKEADMIN01', profile: { email: 'admin@example.com' } },
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
    expect(entry.groupId).toBe('00gFAKEGROUP01');
    expect(entry.groupName).toBe('Engineering');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('CURRENT BEHAVIOUR: misattributes the entry to unknown@unknown.com when the /users/me lookup throws, and tells the user nothing', async () => {
    api.makeApiRequest.mockRejectedValue(new Error('me lookup failed'));
    const { result, reload, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    // The rule change still succeeds and is still audited — but the audit trail
    // records a placeholder instead of the admin who performed it, with no
    // signal to the user. This pins the misattribution, it does not endorse it.
    const entry = onlyAuditEntry();
    expect(entry.result).toBe('success');
    expect(entry.performedBy).toBe('unknown@unknown.com');
    expect(onError).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('CURRENT BEHAVIOUR: misattributes the entry to unknown@unknown.com when /users/me returns an unsuccessful response', async () => {
    api.makeApiRequest.mockResolvedValue({ success: false, error: 'Unauthorized' });
    const { result, onError } = setup();

    await act(async () => {
      await result.current.deactivateRule(RULE_ID);
    });

    expect(onlyAuditEntry().performedBy).toBe('unknown@unknown.com');
    expect(onError).not.toHaveBeenCalled();
  });

  it('CURRENT BEHAVIOUR: misattributes the entry to unknown@unknown.com when /users/me returns a profile without an email', async () => {
    api.makeApiRequest.mockResolvedValue({
      success: true,
      data: { id: '00uFAKEADMIN01', profile: {} },
    });
    const { result } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    expect(onlyAuditEntry().performedBy).toBe('unknown@unknown.com');
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

  it('CURRENT BEHAVIOUR: still attributes the failure entry to unknown@unknown.com when the /users/me lookup also failed', async () => {
    api.makeApiRequest.mockRejectedValue(new Error('me lookup failed'));
    api.activateGroupRule.mockRejectedValue(new Error('boom'));
    const { result, onError } = setup();

    await act(async () => {
      await result.current.activateRule(RULE_ID);
    });

    expect(onError).toHaveBeenCalledWith('boom');
    expect(onlyAuditEntry().performedBy).toBe('unknown@unknown.com');
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
