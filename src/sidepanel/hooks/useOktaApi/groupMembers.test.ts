/**
 * Tests for the group-member operations' paginated member fetch: zod validation
 * at the response boundary (ADR-0006) — malformed rows are dropped leniently by
 * `parseOktaList`, never thrown on.
 *
 * Fixtures use only fake placeholders (`00uFAKE…`, `00gFAKE…`, `example.com`)
 * per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { createGroupMemberOperations } from './groupMembers';
import type { CoreApi } from './core';

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

/** A schema-valid group member row. */
const validMember = {
  id: '00uFAKE1',
  status: 'ACTIVE',
  profile: {
    login: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Fake',
  },
};

describe('getAllGroupMembers boundary validation', () => {
  it('drops malformed member rows leniently instead of failing the fetch', async () => {
    // Missing the required `profile` — the lenient list parser drops it.
    const malformed = { id: '00uFAKE2', status: 'ACTIVE' };
    const makeApiRequest = vi.fn().mockResolvedValue({
      success: true,
      data: [validMember, malformed],
      headers: {},
    });
    const core = makeCore({ makeApiRequest });
    const { getAllGroupMembers } = createGroupMemberOperations(core);

    const members = await getAllGroupMembers('00gFAKE1');

    expect(makeApiRequest).toHaveBeenCalledWith('/api/v1/groups/00gFAKE1/users?limit=200');
    expect(members.map((m) => m.id)).toEqual(['00uFAKE1']);
  });
});
