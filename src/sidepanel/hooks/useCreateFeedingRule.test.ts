/**
 * `useCreateFeedingRule` — the Group Detail rung's create-a-feeding-rule state machine.
 *
 * Mocked at the `useOktaApi` facade (docs/testing.md) for the one write, and at
 * `RulesCache` because it is `chrome.storage`-backed. What is pinned here is
 * what this hook adds on top of the already-tested `createGroupRule` POST: the
 * payload it builds, the draft checks that gate the confirm, the deliberate
 * refusal to gate on an expression this panel merely cannot parse, and the
 * success step's created-rule handles.
 *
 * Fixtures use fake placeholders (`00gFAKE…`, `0prFAKE…`) only.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { GroupSummary } from '../../shared/types';

const api = vi.hoisted(() => ({
  createGroupRule: vi.fn(),
}));

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => api,
}));

const rulesCache = vi.hoisted(() => ({ clear: vi.fn() }));

vi.mock('../../shared/rulesCache', () => ({
  RulesCache: rulesCache,
}));

import { useCreateFeedingRule, MAX_RULE_NAME_LENGTH } from './useCreateFeedingRule';

const group: GroupSummary = {
  id: '00gFAKEGROUP',
  name: 'Fake Engineering',
  type: 'OKTA_GROUP',
  memberCount: 12,
  hasRules: false,
  ruleCount: 0,
};

/** Render the hook with a connected tab unless a test says otherwise. */
function renderCreateRule(targetTabId: number | null = 1) {
  return renderHook(() => useCreateFeedingRule({ targetTabId, group }));
}

/** Fill in a complete, parseable draft. */
function draft(
  result: { current: ReturnType<typeof useCreateFeedingRule> },
  name = 'Engineering intake',
  expression = 'user.department == "Engineering"',
) {
  act(() => {
    result.current.setName(name);
  });
  act(() => {
    result.current.setExpression(expression);
  });
}

describe('useCreateFeedingRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rulesCache.clear.mockResolvedValue(undefined);
    api.createGroupRule.mockResolvedValue({
      success: true,
      rule: { id: '0prFAKE1', name: 'Engineering intake', status: 'INACTIVE' },
    });
  });

  it('posts a rule whose single target group is the one being browsed', async () => {
    const { result } = renderCreateRule();
    draft(result);

    await act(async () => {
      await result.current.confirm();
    });

    expect(api.createGroupRule).toHaveBeenCalledWith({
      type: 'group_rule',
      name: 'Engineering intake',
      conditions: {
        expression: {
          value: 'user.department == "Engineering"',
          type: 'urn:okta:expression:1.0',
        },
      },
      actions: { assignUserToGroups: { groupIds: [group.id] } },
    });
  });

  it('reports the created rule so the caller can offer the jump that activates it', async () => {
    const { result } = renderCreateRule();
    draft(result);

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.createdRuleName).toBe('Engineering intake');
    expect(result.current.createdRuleId).toBe('0prFAKE1');
    expect(result.current.error).toBeNull();
  });

  /*
    The org-wide rule snapshot has a 5-minute TTL, so leaving it in place after a
    write would hide the new rule from every surface that reads it.
  */
  it('drops the org-wide rules cache once the write lands', async () => {
    const { result } = renderCreateRule();
    draft(result);

    await act(async () => {
      await result.current.confirm();
    });

    expect(rulesCache.clear).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft and reports the message when Okta rejects the create', async () => {
    api.createGroupRule.mockResolvedValue({ success: false, error: 'Rule name already in use' });
    const { result } = renderCreateRule();
    draft(result);

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.error).toBe('Rule name already in use');
    expect(result.current.createdRuleName).toBeNull();
    expect(result.current.name).toBe('Engineering intake');
    expect(rulesCache.clear).not.toHaveBeenCalled();
  });

  it('reports a thrown transport failure rather than leaving the confirm spinning', async () => {
    api.createGroupRule.mockRejectedValue(new Error('Tab disconnected'));
    const { result } = renderCreateRule();
    draft(result);

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.error).toBe('Tab disconnected');
    expect(result.current.isCreating).toBe(false);
  });

  describe('what gates the confirm', () => {
    it('needs both a name and an expression', () => {
      const { result } = renderCreateRule();
      expect(result.current.canSubmit).toBe(false);

      act(() => result.current.setName('Engineering intake'));
      expect(result.current.canSubmit).toBe(false);

      act(() => result.current.setExpression('user.department == "Engineering"'));
      expect(result.current.canSubmit).toBe(true);
    });

    it('treats a whitespace-only draft as empty', () => {
      const { result } = renderCreateRule();
      draft(result, '   ', '   ');
      expect(result.current.canSubmit).toBe(false);
    });

    it('needs a connected Okta tab', () => {
      const { result } = renderCreateRule(null);
      draft(result);
      expect(result.current.canSubmit).toBe(false);
    });

    it("names Okta's rule-name limit rather than letting the write be rejected for it", () => {
      const { result } = renderCreateRule();
      draft(result, 'x'.repeat(MAX_RULE_NAME_LENGTH + 1));

      expect(result.current.nameError).toContain(String(MAX_RULE_NAME_LENGTH));
      expect(result.current.canSubmit).toBe(false);
    });

    it('says nothing about an empty name — a field nobody has filled in is not an error', () => {
      const { result } = renderCreateRule();
      expect(result.current.nameError).toBeNull();
    });

    it('refuses to fire a second write from the success step', async () => {
      const { result } = renderCreateRule();
      draft(result);

      await act(async () => {
        await result.current.confirm();
      });
      expect(result.current.canSubmit).toBe(false);

      await act(async () => {
        await result.current.confirm();
      });
      expect(api.createGroupRule).toHaveBeenCalledTimes(1);
    });
  });

  /*
    ADR-0017: this panel parses a documented *subset* of Okta EL, so "we could
    not read that" is a fact about the panel, never a verdict on the rule.
    Reporting it must not turn into refusing to write it.
  */
  describe('the expression check', () => {
    it('notices an expression it cannot parse without blocking the write', () => {
      const { result } = renderCreateRule();
      draft(result, 'Engineering intake', 'user.department ?? ');

      expect(result.current.expressionNotice).toContain('could not be parsed here');
      expect(result.current.canSubmit).toBe(true);
    });

    it('stays quiet on an expression it can parse', () => {
      const { result } = renderCreateRule();
      draft(result);
      expect(result.current.expressionNotice).toBeNull();
    });

    it('stays quiet on an empty field', () => {
      const { result } = renderCreateRule();
      expect(result.current.expressionNotice).toBeNull();
    });
  });

  describe('opening and closing', () => {
    it('opens on a fresh draft, discarding whatever the last visit left', async () => {
      const { result } = renderCreateRule();
      draft(result);
      await act(async () => {
        await result.current.confirm();
      });

      act(() => result.current.open());

      expect(result.current.isOpen).toBe(true);
      expect(result.current.name).toBe('');
      expect(result.current.expression).toBe('');
      expect(result.current.createdRuleName).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('closes and discards the draft', () => {
      const { result } = renderCreateRule();
      act(() => result.current.open());
      draft(result);

      act(() => result.current.close());

      expect(result.current.isOpen).toBe(false);
      expect(result.current.name).toBe('');
      expect(result.current.expression).toBe('');
    });
  });
});
