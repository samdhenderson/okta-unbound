/**
 * Tests for the read-only group discovery/search operations.
 *
 * These pin CURRENT behavior of {@link createGroupDiscoveryOperations}: the
 * `Link`-header pagination walk in `getAllGroups`, the first-page member-count
 * approximation, the cache-then-fetch rules lookup, and the lightweight search /
 * by-id lookups. The transport (`CoreApi`) is fully mocked, and every paginating
 * loop is fed a TERMINATING sequence (a page with a `rel="next"` link followed by
 * a page with none) so the loop always ends.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGroupDiscoveryOperations } from './groupDiscovery';
import type { CoreApi } from './core';
import { RulesCache } from '../../../shared/rulesCache';

// Control the rules cache directly so we can exercise both the cache-hit and
// cache-miss branches of getGroupRulesForGroup deterministically.
vi.mock('../../../shared/rulesCache', () => ({
  RulesCache: {
    getRulesForGroup: vi.fn(),
    isFresh: vi.fn(),
  },
}));

// Per-method mocks (typed): vi.mocked on the class itself does not deep-type the
// static methods, so wrap each method to expose the mock control surface.
const getRulesForGroupMock = vi.mocked(RulesCache.getRulesForGroup);
const isFreshMock = vi.mocked(RulesCache.isFresh);

/** Build a fake CoreApi whose transport is fully mocked. */
function makeCore(overrides: Partial<CoreApi> = {}): CoreApi {
  return {
    targetTabId: 1,
    sendMessage: vi.fn(),
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getCurrentUser: vi.fn().mockResolvedValue({ email: 'admin@example.com', id: 'admin' }),
    checkCancelled: vi.fn(),
    resetCancellation: vi.fn(),
    runOperation: vi.fn(),
    callbacks: {},
    ...overrides,
  } as CoreApi;
}

/** A `rel="next"` Link header pointing at a fake, origin-relative next page. */
const NEXT_LINK =
  '<https://fake.okta.example.com/api/v1/groups?after=CURSOR2&limit=200&expand=stats>; rel="next"';

beforeEach(() => {
  vi.clearAllMocks();
  getRulesForGroupMock.mockResolvedValue([]);
  isFreshMock.mockResolvedValue(false);
});

describe('getAllGroups', () => {
  it('follows Link pagination and concatenates every page, reporting progress', async () => {
    const makeApiRequest = vi
      .fn()
      // Page 1: two groups + a next link.
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: 'g1' }, { id: 'g2' }],
        headers: { link: NEXT_LINK },
      })
      // Page 2: one group + NO next link -> loop terminates.
      .mockResolvedValueOnce({ success: true, data: [{ id: 'g3' }], headers: {} });
    const core = makeCore({ makeApiRequest });
    const onProgress = vi.fn();

    const groups = await createGroupDiscoveryOperations(core).getAllGroups(onProgress);

    expect(groups.map((g) => g.id)).toEqual(['g1', 'g2', 'g3']);
    // First page uses the seed URL; second uses the parsed relative next URL.
    expect(makeApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/groups?limit=200&expand=stats');
    expect(makeApiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/v1/groups?after=CURSOR2&limit=200&expand=stats',
    );
    expect(onProgress).toHaveBeenNthCalledWith(1, 2, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 3, 3);
  });

  it('returns a single page when there is no next link, and works without onProgress', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [{ id: 'only' }] }),
    });

    const groups = await createGroupDiscoveryOperations(core).getAllGroups();

    expect(groups.map((g) => g.id)).toEqual(['only']);
  });

  it('treats a missing data array as an empty page', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true }),
    });

    const groups = await createGroupDiscoveryOperations(core).getAllGroups();

    expect(groups).toEqual([]);
  });

  it('throws with the server error message when a page fails', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'boom' }),
    });

    await expect(createGroupDiscoveryOperations(core).getAllGroups()).rejects.toThrow('boom');
  });

  it('throws a default message when a failed page carries no error', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false }),
    });

    await expect(createGroupDiscoveryOperations(core).getAllGroups()).rejects.toThrow(
      'Failed to fetch groups',
    );
  });
});

describe('getGroupMemberCount', () => {
  it('returns the first-page count when there are more pages', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue({
      success: true,
      data: new Array(200).fill({ id: 'u' }),
      headers: { link: '<https://fake.okta.example.com/next>; rel="next"' },
    });
    const core = makeCore({ makeApiRequest });

    const count = await createGroupDiscoveryOperations(core).getGroupMemberCount('g1');

    expect(count).toBe(200);
    expect(makeApiRequest).toHaveBeenCalledWith('/api/v1/groups/g1/users?limit=200');
  });

  it('returns the first-page count when there is only one page (capital-L header)', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [{ id: 'a' }, { id: 'b' }],
        headers: { Link: '<https://fake.okta.example.com/self>; rel="self"' },
      }),
    });

    const count = await createGroupDiscoveryOperations(core).getGroupMemberCount('g1');

    expect(count).toBe(2);
  });

  it('returns 0 when the request is unsuccessful', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false }),
    });

    expect(await createGroupDiscoveryOperations(core).getGroupMemberCount('g1')).toBe(0);
  });

  it('returns 0 when the transport throws', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockRejectedValue(new Error('network down')),
    });

    expect(await createGroupDiscoveryOperations(core).getGroupMemberCount('g1')).toBe(0);
  });
});

describe('getGroupRulesForGroup', () => {
  it('serves non-empty cached rules without fetching', async () => {
    const cached = [{ id: 'r1', groupIds: ['g1'] }] as never;
    getRulesForGroupMock.mockResolvedValue(cached);
    const core = makeCore();

    const rules = await createGroupDiscoveryOperations(core).getGroupRulesForGroup('g1');

    expect(rules).toBe(cached);
    expect(core.makeApiRequest).not.toHaveBeenCalled();
  });

  it('serves empty cached rules when the cache is fresh (no fetch)', async () => {
    getRulesForGroupMock.mockResolvedValue([]);
    isFreshMock.mockResolvedValue(true);
    const core = makeCore();

    const rules = await createGroupDiscoveryOperations(core).getGroupRulesForGroup('g1');

    expect(rules).toEqual([]);
    expect(core.makeApiRequest).not.toHaveBeenCalled();
  });

  it('fetches on a cache miss and returns only rules targeting the group', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { id: 'r1', actions: { assignUserToGroups: { groupIds: ['g1', 'g9'] } } },
          { id: 'r2', actions: { assignUserToGroups: { groupIds: ['g2'] } } },
          { id: 'r3' }, // no actions at all -> filtered out
        ],
      }),
    });

    const rules = await createGroupDiscoveryOperations(core).getGroupRulesForGroup('g1');

    expect(rules.map((r) => (r as { id: string }).id)).toEqual(['r1']);
    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/groups/rules?limit=200');
  });

  it('treats missing data as no rules on a cache-miss fetch', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true }),
    });

    expect(await createGroupDiscoveryOperations(core).getGroupRulesForGroup('g1')).toEqual([]);
  });

  it('returns [] when the rules fetch is unsuccessful', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false }),
    });

    expect(await createGroupDiscoveryOperations(core).getGroupRulesForGroup('g1')).toEqual([]);
  });

  it('returns [] when the transport throws', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockRejectedValue(new Error('offline')),
    });

    expect(await createGroupDiscoveryOperations(core).getGroupRulesForGroup('g1')).toEqual([]);
  });
});

describe('searchGroups', () => {
  it('short-circuits to [] for empty or too-short queries without fetching', async () => {
    const core = makeCore();
    const ops = createGroupDiscoveryOperations(core);

    expect(await ops.searchGroups('')).toEqual([]);
    expect(await ops.searchGroups('a')).toEqual([]);
    expect(core.makeApiRequest).not.toHaveBeenCalled();
  });

  it('maps hits and applies fallbacks for missing profile fields', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { id: 'g1', type: 'APP_GROUP', profile: { name: 'Admins', description: 'desc' } },
          { id: 'g2', profile: {} }, // name falls back to id, type to OKTA_GROUP
        ],
      }),
    });

    const results = await createGroupDiscoveryOperations(core).searchGroups('adm');

    expect(results).toEqual([
      { id: 'g1', name: 'Admins', description: 'desc', type: 'APP_GROUP' },
      { id: 'g2', name: 'g2', description: '', type: 'OKTA_GROUP' },
    ]);
    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/groups?q=adm&limit=20');
  });

  it('encodes the query in the request URL', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [] }),
    });

    await createGroupDiscoveryOperations(core).searchGroups('a b&c');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/groups?q=a%20b%26c&limit=20');
  });

  it('returns [] when the response is unsuccessful', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false }),
    });

    expect(await createGroupDiscoveryOperations(core).searchGroups('adm')).toEqual([]);
  });

  it('returns [] when the transport throws', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockRejectedValue(new Error('down')),
    });

    expect(await createGroupDiscoveryOperations(core).searchGroups('adm')).toEqual([]);
  });
});

describe('getGroupById', () => {
  it('returns a mapped record on success', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'g1', type: 'OKTA_GROUP', profile: { name: 'Eng', description: 'team' } },
      }),
    });

    const group = await createGroupDiscoveryOperations(core).getGroupById('g1');

    expect(group).toEqual({ id: 'g1', name: 'Eng', description: 'team', type: 'OKTA_GROUP' });
    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/groups/g1');
  });

  it('applies fallbacks when profile fields and type are missing', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: { id: 'g2' } }),
    });

    expect(await createGroupDiscoveryOperations(core).getGroupById('g2')).toEqual({
      id: 'g2',
      name: 'g2',
      description: '',
      type: 'OKTA_GROUP',
    });
  });

  it('returns null when the response is unsuccessful', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false }),
    });

    expect(await createGroupDiscoveryOperations(core).getGroupById('g1')).toBeNull();
  });

  it('returns null when the transport throws', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockRejectedValue(new Error('boom')),
    });

    expect(await createGroupDiscoveryOperations(core).getGroupById('g1')).toBeNull();
  });
});
