/**
 * Tests for the rule-impact capture: zod validation at the response boundary
 * (ADR-0006) — malformed rule rows are dropped leniently by `parseOktaList`, so
 * they cannot skew the "who loses access" set math.
 *
 * Fixtures use only fake placeholders (`0prFAKE…`, `00gFAKE…`, `00uFAKE…`,
 * `example.com`) per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRuleImpactOperations } from './ruleImpact';
import type { CoreApi } from './core';
import type { OktaUser } from '../../../shared/types';

/** Build a fake CoreApi whose transport is fully mocked. */
function makeCore(overrides: Partial<CoreApi> = {}): CoreApi {
  return {
    targetTabId: 1,
    sendMessage: vi.fn(),
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [], headers: {} }),
    getCurrentUser: vi.fn().mockResolvedValue({ email: 'admin@example.com', id: 'admin' }),
    checkCancelled: vi.fn(),
    resetCancellation: vi.fn(),
    runOperation: vi.fn(),
    callbacks: {},
    ...overrides,
  } as CoreApi;
}

/** A member of the analyzed target group. */
const member: OktaUser = {
  id: '00uFAKE1',
  status: 'ACTIVE',
  profile: {
    login: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Fake',
  },
};

describe('captureRuleImpact boundary validation', () => {
  it('drops a malformed rule row leniently so it cannot skew the impact math', async () => {
    const analyzedRule = {
      id: '0prFAKE1',
      name: 'Rule One',
      status: 'ACTIVE',
      actions: { assignUserToGroups: { groupIds: ['00gFAKE1'] } },
    };
    // Numeric `id` fails the schema — the lenient list parser drops the row. If
    // it were NOT dropped, it would read as a second active rule targeting the
    // group and wrongly flip the member from "losing" to "retaining".
    const malformedRule = {
      id: 999,
      name: 'Broken Rule',
      status: 'ACTIVE',
      actions: { assignUserToGroups: { groupIds: ['00gFAKE1'] } },
    };
    const makeApiRequest = vi.fn(async (endpoint: string) => {
      if (endpoint.startsWith('/api/v1/groups/rules')) {
        return { success: true, data: [analyzedRule, malformedRule], headers: {} };
      }
      if (endpoint === '/api/v1/groups/00gFAKE1') {
        return {
          success: true,
          data: { id: '00gFAKE1', profile: { name: 'Target Group' }, type: 'OKTA_GROUP' },
        };
      }
      throw new Error(`Unrouted test endpoint: ${endpoint}`);
    });
    const core = makeCore({ makeApiRequest });
    const getAllGroupMembers = vi.fn().mockResolvedValue([member]);
    const { captureRuleImpact } = createRuleImpactOperations(core, getAllGroupMembers);

    const summary = await captureRuleImpact({
      id: '0prFAKE1',
      name: 'Rule One',
      groupIds: ['00gFAKE1'],
      groupNames: ['Target Group'],
    });

    // The malformed rule was dropped, so the analyzed rule is the sole managing
    // rule and the member loses access on deactivation.
    expect(summary.targetGroups).toHaveLength(1);
    expect(summary.targetGroups[0].losingCount).toBe(1);
    expect(summary.totalLosing).toBe(1);
  });
});
