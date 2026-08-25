/**
 * Tests for the group-rule write operations factory.
 *
 * These pin the request shape (endpoint / method / body) each operation sends
 * through the scheduler path, plus the transformed result on success, on
 * `success: false`, and on a zod-validation failure at the boundary (ADR-0006).
 */
import { describe, it, expect, vi } from 'vitest';
import { createRuleWriteOperations } from './ruleWrites';
import type { CoreApi } from './core';
import type { CreateRulePayload } from '../../../shared/rules/consolidation';
import { makeFakeCore } from '@/test/factories/coreApi';

/** Build a fake CoreApi whose transport is fully mocked. */
const makeCore = (overrides: Partial<CoreApi> = {}): CoreApi =>
  makeFakeCore({
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: {} }),
    ...overrides,
  });

/** A schema-valid raw group rule with obviously-fake identifiers. */
function validRule(overrides: Record<string, unknown> = {}) {
  return {
    id: '0prFAKERULE',
    name: 'Contractors',
    status: 'INACTIVE',
    type: 'group_rule',
    conditions: {
      expression: { value: 'user.department=="Eng"', type: 'urn:okta:expression:1.0' },
    },
    actions: { assignUserToGroups: { groupIds: ['00gFAKEGROUP'] } },
    ...overrides,
  };
}

/** A valid CreateRulePayload with fake data. */
function createPayload(): CreateRulePayload {
  return {
    type: 'group_rule',
    name: 'Contractors (consolidated)',
    conditions: {
      expression: { value: 'user.department=="Eng"', type: 'urn:okta:expression:1.0' },
    },
    actions: { assignUserToGroups: { groupIds: ['00gFAKEGROUP'] } },
  };
}

describe('getRawGroupRule', () => {
  it('requests the rule by id and returns the validated rule on success', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: validRule() }),
    });
    const { getRawGroupRule } = createRuleWriteOperations(core);

    const rule = await getRawGroupRule('0prFAKERULE');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/groups/rules/0prFAKERULE', {
      reason: 'Fetch raw group rule for consolidation',
    });
    expect(rule).toMatchObject({ id: '0prFAKERULE', name: 'Contractors', status: 'INACTIVE' });
  });

  it('returns null when the request is unsuccessful', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'nope' }),
    });
    const { getRawGroupRule } = createRuleWriteOperations(core);

    expect(await getRawGroupRule('0prFAKERULE')).toBeNull();
  });

  it('returns null when the response has no data', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    });
    const { getRawGroupRule } = createRuleWriteOperations(core);

    expect(await getRawGroupRule('0prFAKERULE')).toBeNull();
  });

  it('returns null when the payload fails zod validation', async () => {
    const core = makeCore({
      // Missing required `status` → schema rejects it.
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: { id: 'x', name: 'y' } }),
    });
    const { getRawGroupRule } = createRuleWriteOperations(core);

    expect(await getRawGroupRule('0prFAKERULE')).toBeNull();
  });
});

describe('createGroupRule', () => {
  it('POSTs the payload and returns the created rule on success', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: validRule() }),
    });
    const { createGroupRule } = createRuleWriteOperations(core);
    const payload = createPayload();

    const result = await createGroupRule(payload);

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/groups/rules', {
      method: 'POST',
      body: payload,
      reason: 'Create consolidated group rule',
    });
    expect(result.success).toBe(true);
    expect(result.rule).toMatchObject({ id: '0prFAKERULE', name: 'Contractors' });
  });

  it('returns the transport error when creation fails', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'duplicate name' }),
    });
    const { createGroupRule } = createRuleWriteOperations(core);

    const result = await createGroupRule(createPayload());

    expect(result).toEqual({ success: false, error: 'duplicate name' });
  });

  it('falls back to a default error message when none is provided', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false }),
    });
    const { createGroupRule } = createRuleWriteOperations(core);

    const result = await createGroupRule(createPayload());

    expect(result).toEqual({ success: false, error: 'Failed to create rule' });
  });

  it('returns a shape error when the created-rule response fails validation', async () => {
    const core = makeCore({
      // success but malformed body → zod rejects, caught and surfaced.
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: { id: 'x' } }),
    });
    const { createGroupRule } = createRuleWriteOperations(core);

    const result = await createGroupRule(createPayload());

    expect(result).toEqual({
      success: false,
      error: 'Created rule response was not in the expected shape',
    });
  });
});

describe('deleteGroupRule', () => {
  it('DELETEs the rule and passes through success/error', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true }),
    });
    const { deleteGroupRule } = createRuleWriteOperations(core);

    const result = await deleteGroupRule('0prFAKERULE');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/groups/rules/0prFAKERULE', {
      method: 'DELETE',
      reason: 'Delete group rule',
    });
    expect(result).toEqual({ success: true, error: undefined });
  });

  it('surfaces the error on failure', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'rule is ACTIVE' }),
    });
    const { deleteGroupRule } = createRuleWriteOperations(core);

    expect(await deleteGroupRule('0prFAKERULE')).toEqual({
      success: false,
      error: 'rule is ACTIVE',
    });
  });
});

describe('activateGroupRule', () => {
  it('POSTs to the activate lifecycle endpoint and passes through the result', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true }),
    });
    const { activateGroupRule } = createRuleWriteOperations(core);

    const result = await activateGroupRule('0prFAKERULE');

    expect(core.makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/groups/rules/0prFAKERULE/lifecycle/activate',
      { method: 'POST', reason: 'Activate group rule' },
    );
    expect(result).toEqual({ success: true, error: undefined });
  });

  it('surfaces the error on failure', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'boom' }),
    });
    const { activateGroupRule } = createRuleWriteOperations(core);

    expect(await activateGroupRule('0prFAKERULE')).toEqual({ success: false, error: 'boom' });
  });
});

describe('deactivateGroupRule', () => {
  it('POSTs to the deactivate lifecycle endpoint and passes through the result', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true }),
    });
    const { deactivateGroupRule } = createRuleWriteOperations(core);

    const result = await deactivateGroupRule('0prFAKERULE');

    expect(core.makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/groups/rules/0prFAKERULE/lifecycle/deactivate',
      { method: 'POST', reason: 'Deactivate group rule' },
    );
    expect(result).toEqual({ success: true, error: undefined });
  });

  it('surfaces the error on failure', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'boom' }),
    });
    const { deactivateGroupRule } = createRuleWriteOperations(core);

    expect(await deactivateGroupRule('0prFAKERULE')).toEqual({ success: false, error: 'boom' });
  });
});
