/**
 * Tests for the group-rule write operations factory.
 *
 * These pin the request shape (endpoint / method / body) each operation sends
 * through the scheduler path, plus the transformed result on success, on
 * `success: false`, and on a zod-validation failure at the boundary (ADR-0006).
 *
 * They also pin this layer's one non-transport effect (ADR-0064): a write that
 * reaches Okta drops the org-wide rules snapshot, and a write that does not
 * leaves it alone. `RulesCache` is `chrome.storage`-backed, so it is mocked here
 * the way the hook suites that used to own this assertion mocked it — what is
 * pinned is the invalidation call, not the storage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuleWriteOperations } from './ruleWrites';
import type { CoreApi } from './core';
import type { CreateRulePayload } from '../../../shared/rules/consolidation';
import { makeFakeCore } from '@/test/factories/coreApi';

const rulesCache = vi.hoisted(() => ({ clear: vi.fn() }));

vi.mock('../../../shared/rulesCache', () => ({
  RulesCache: rulesCache,
}));

beforeEach(() => {
  vi.clearAllMocks();
  rulesCache.clear.mockResolvedValue(undefined);
});

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

/*
  ADR-0064 moved rule-cache invalidation out of the three calling hooks and under
  the write itself, so that a rule write cannot silently skip it. These assertions
  are the retargeted versions of the ones `useCreateFeedingRule` and
  `useRuleConsolidation` used to own (`D-089`), plus the activate/deactivate pair
  nobody owned at all (`D-095`).
*/
describe('rule-write cache invalidation', () => {
  /** A core whose single request resolves to `response`. */
  const coreReturning = (response: unknown) =>
    makeCore({ makeApiRequest: vi.fn().mockResolvedValue(response) });

  it('drops the org-wide snapshot when a rule is created', async () => {
    const ops = createRuleWriteOperations(coreReturning({ success: true, data: validRule() }));

    await ops.createGroupRule(createPayload());

    expect(rulesCache.clear).toHaveBeenCalledTimes(1);
  });

  it('leaves the snapshot alone when the create is rejected', async () => {
    const ops = createRuleWriteOperations(
      coreReturning({ success: false, error: 'Rule name already in use' }),
    );

    await ops.createGroupRule(createPayload());

    expect(rulesCache.clear).not.toHaveBeenCalled();
  });

  /*
    The rule exists in Okta even though we could not read the response, so the
    snapshot is a rule short regardless of what this call returns. This is also
    what makes the consolidation flow's abort path safe (`D-089`): invalidation
    happens with the create, before the activate step that can abort the run.
  */
  it('drops the snapshot for a created rule whose response failed validation', async () => {
    const ops = createRuleWriteOperations(
      coreReturning({ success: true, data: { id: 'x', name: 'y' } }),
    );

    const result = await ops.createGroupRule(createPayload());

    expect(result.success).toBe(false);
    expect(rulesCache.clear).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['deleteGroupRule', (o: ReturnType<typeof createRuleWriteOperations>) => o.deleteGroupRule],
    ['activateGroupRule', (o: ReturnType<typeof createRuleWriteOperations>) => o.activateGroupRule],
    [
      'deactivateGroupRule',
      (o: ReturnType<typeof createRuleWriteOperations>) => o.deactivateGroupRule,
    ],
  ] as const)('drops the org-wide snapshot when %s succeeds', async (_name, pick) => {
    const ops = createRuleWriteOperations(coreReturning({ success: true }));

    await pick(ops)('0prFAKERULE');

    expect(rulesCache.clear).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['deleteGroupRule', (o: ReturnType<typeof createRuleWriteOperations>) => o.deleteGroupRule],
    ['activateGroupRule', (o: ReturnType<typeof createRuleWriteOperations>) => o.activateGroupRule],
    [
      'deactivateGroupRule',
      (o: ReturnType<typeof createRuleWriteOperations>) => o.deactivateGroupRule,
    ],
  ] as const)('leaves the snapshot alone when %s fails', async (_name, pick) => {
    const ops = createRuleWriteOperations(coreReturning({ success: false, error: 'boom' }));

    await pick(ops)('0prFAKERULE');

    expect(rulesCache.clear).not.toHaveBeenCalled();
  });

  it('never invalidates on a read', async () => {
    const ops = createRuleWriteOperations(coreReturning({ success: true, data: validRule() }));

    await ops.getRawGroupRule('0prFAKERULE');

    expect(rulesCache.clear).not.toHaveBeenCalled();
  });

  /*
    A stale snapshot expires on its own inside the TTL; a write reported as failed
    when Okta accepted it does not recover. So the cache is never allowed to
    decide the write's result.
  */
  it('still reports a successful write when invalidation itself fails', async () => {
    rulesCache.clear.mockRejectedValue(new Error('storage unavailable'));
    const ops = createRuleWriteOperations(coreReturning({ success: true }));

    await expect(ops.activateGroupRule('0prFAKERULE')).resolves.toEqual({ success: true });
  });
});
