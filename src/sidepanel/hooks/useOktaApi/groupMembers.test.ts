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

    expect(makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/groups/00gFAKE1/users?limit=200&expand=group-rules',
    );
    expect(members.map((m) => m.id)).toEqual(['00uFAKE1']);
  });
});

/**
 * The member listing asks Okta for its own per-member rule attribution via the
 * private `expand=group-rules` parameter — the same one the admin console uses.
 * It rides along on a request the app already makes, so it costs nothing; the
 * only subtlety is that Okta does NOT echo it into its `rel="next"` link, so it
 * has to be re-applied on every later page or attribution would be exact for the
 * first 200 members and inferred for everyone after them.
 */
describe('getAllGroupMembers rule attribution', () => {
  /** Wrap a path in an Okta-style `rel="next"` Link header. */
  function nextLink(path: string): string {
    return `<https://example.okta.com${path}>; rel="next"`;
  }

  it('requests expand=group-rules and preserves the embed on the row', async () => {
    const embedded = { 'group-rules': [{ id: '0prFAKE1', name: 'Eng feeder' }] };
    const makeApiRequest = vi.fn().mockResolvedValue({
      success: true,
      data: [{ ...validMember, _embedded: embedded }],
      headers: {},
    });
    const { getAllGroupMembers } = createGroupMemberOperations(makeCore({ makeApiRequest }));

    const members = await getAllGroupMembers('00gFAKE1');

    expect(makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/groups/00gFAKE1/users?limit=200&expand=group-rules',
    );
    expect(members[0]).toMatchObject({ _embedded: embedded });
  });

  it('re-applies the dropped expand on every page after the first', async () => {
    const page1 = '/api/v1/groups/00gFAKE1/users?limit=200&expand=group-rules';
    // Exactly what Okta hands back: the private expand is gone.
    const droppedNext = '/api/v1/groups/00gFAKE1/users?limit=200&after=cursor2';
    const makeApiRequest = vi.fn(async (url: string) => {
      const headers: Record<string, string> = url === page1 ? { link: nextLink(droppedNext) } : {};
      const data = url === page1 ? [validMember] : [{ ...validMember, id: '00uFAKE2' }];
      return { success: true, data, headers };
    });
    const { getAllGroupMembers } = createGroupMemberOperations(makeCore({ makeApiRequest }));

    const members = await getAllGroupMembers('00gFAKE1');

    expect(makeApiRequest).toHaveBeenNthCalledWith(2, `${droppedNext}&expand=group-rules`);
    expect(members.map((m) => m.id)).toEqual(['00uFAKE1', '00uFAKE2']);
  });
});
