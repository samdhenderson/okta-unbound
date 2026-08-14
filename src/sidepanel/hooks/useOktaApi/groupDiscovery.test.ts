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
import { formatRuleForDisplay } from '../../../shared/ruleUtils';
import { makeFakeCore } from '@/test/factories/coreApi';

// Control the rules cache directly so we can exercise both the cache-hit and
// cache-miss branches of getGroupRulesForGroup deterministically.
vi.mock('../../../shared/rulesCache', () => ({
  RulesCache: {
    get: vi.fn(),
    getRulesForGroup: vi.fn(),
    isFresh: vi.fn(),
    set: vi.fn(),
  },
}));

// Per-method mocks (typed): vi.mocked on the class itself does not deep-type the
// static methods, so wrap each method to expose the mock control surface.
const getMock = vi.mocked(RulesCache.get);
const getRulesForGroupMock = vi.mocked(RulesCache.getRulesForGroup);
const isFreshMock = vi.mocked(RulesCache.isFresh);
const setMock = vi.mocked(RulesCache.set);

/** Build a fake CoreApi whose transport is fully mocked. */
const makeCore = (overrides: Partial<CoreApi> = {}): CoreApi =>
  makeFakeCore({
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: {} }),
    ...overrides,
  });

/** A `rel="next"` Link header pointing at a fake, origin-relative next page. */
const NEXT_LINK =
  '<https://fake.okta.example.com/api/v1/groups?after=CURSOR2&limit=200&expand=stats>; rel="next"';

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue(null);
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

  it('populates userAttributes on the cache-miss path', async () => {
    // `userAttributes` is NOT an Okta field: it is synthesised client-side by
    // `formatRuleForDisplay`. Returning raw rules here strands every downstream
    // consumer with `userAttributes === undefined`, which collapses
    // `membershipAnalysis.inferBestMatchRule` into a positional guess.
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'r1',
            name: 'Engineering feeder',
            status: 'ACTIVE',
            conditions: {
              expression: {
                value: 'user.department == "Engineering" && user.title == "Engineer"',
                type: 'urn:okta:expression:1.0',
              },
            },
            actions: { assignUserToGroups: { groupIds: ['g1'] } },
          },
        ],
      }),
    });

    const rules = await createGroupDiscoveryOperations(core).getGroupRulesForGroup('g1');

    expect(rules).toHaveLength(1);
    expect(rules[0].userAttributes).toEqual(['department', 'title']);
  });

  it('returns the same shape from the cache-hit and cache-miss paths', async () => {
    const raw = {
      id: 'r1',
      name: 'Engineering feeder',
      status: 'ACTIVE' as const,
      type: 'group_rule',
      created: '2020-01-01T00:00:00.000Z',
      lastUpdated: '2024-01-01T00:00:00.000Z',
      conditions: {
        expression: {
          value: 'user.department == "Engineering"',
          type: 'urn:okta:expression:1.0',
        },
      },
      actions: { assignUserToGroups: { groupIds: ['g1'] } },
    };

    // Cache miss: fetched, formatted, filtered.
    const missCore = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [raw] }),
    });
    const missRules = await createGroupDiscoveryOperations(missCore).getGroupRulesForGroup('g1');

    // Cache hit: served straight from RulesCache, which stores exactly what
    // `formatRuleForDisplay` produced (see fetchAndCacheAllGroupRules).
    getRulesForGroupMock.mockResolvedValue([formatRuleForDisplay(raw, undefined, [])]);
    const hitCore = makeCore();
    const hitRules = await createGroupDiscoveryOperations(hitCore).getGroupRulesForGroup('g1');
    expect(hitCore.makeApiRequest).not.toHaveBeenCalled();

    expect(missRules).toHaveLength(1);
    expect(hitRules).toHaveLength(1);
    expect(Object.keys(missRules[0]).sort()).toEqual(Object.keys(hitRules[0]).sort());
    expect(missRules[0]).toEqual(hitRules[0]);
  });

  it('selects exactly the formatted rules targeting the requested group', async () => {
    const withGroups = (id: string, groupIds: string[]) => ({
      id,
      name: `rule ${id}`,
      status: 'ACTIVE',
      conditions: { expression: { value: `user.department == "${id}"` } },
      actions: { assignUserToGroups: { groupIds } },
    });
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [
          withGroups('r1', ['g1', 'g9']),
          withGroups('r2', ['g2']),
          withGroups('r3', ['g9', 'g1']),
          { id: 'r4', name: 'no actions', status: 'ACTIVE' },
        ],
      }),
    });

    const rules = await createGroupDiscoveryOperations(core).getGroupRulesForGroup('g1');

    expect(rules.map((r) => r.id)).toEqual(['r1', 'r3']);
    // Filtering happens on the FORMATTED shape, whose target ids live on
    // `groupIds` rather than `actions.assignUserToGroups.groupIds`.
    expect(rules.every((r) => r.groupIds.includes('g1'))).toBe(true);
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

describe('getGroupRulesForGroup pagination + cache write-back', () => {
  const RULES_NEXT_LINK =
    '<https://fake.okta.example.com/api/v1/groups/rules?after=CURSOR2&limit=200>; rel="next"';

  it('accumulates rules across multiple pages on a cache miss', async () => {
    const makeApiRequest = vi
      .fn()
      // Page 1: one matching + one non-matching rule, with a next link.
      .mockResolvedValueOnce({
        success: true,
        data: [
          { id: 'r1', status: 'ACTIVE', actions: { assignUserToGroups: { groupIds: ['g1'] } } },
          { id: 'r2', status: 'ACTIVE', actions: { assignUserToGroups: { groupIds: ['g2'] } } },
        ],
        headers: { link: RULES_NEXT_LINK },
      })
      // Page 2: another matching rule, NO next link -> loop terminates.
      .mockResolvedValueOnce({
        success: true,
        data: [
          { id: 'r3', status: 'INACTIVE', actions: { assignUserToGroups: { groupIds: ['g1'] } } },
        ],
        headers: {},
      });
    const core = makeCore({ makeApiRequest });

    const rules = await createGroupDiscoveryOperations(core).getGroupRulesForGroup('g1');

    // Matching rules from BOTH pages are returned (no >200-rule truncation).
    expect(rules.map((r) => (r as { id: string }).id)).toEqual(['r1', 'r3']);
    expect(makeApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/groups/rules?limit=200');
    expect(makeApiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/v1/groups/rules?after=CURSOR2&limit=200',
    );
  });

  it('writes the full fetched list back to RulesCache with aggregate stats', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { id: 'r1', status: 'ACTIVE', actions: { assignUserToGroups: { groupIds: ['g1'] } } },
          { id: 'r2', status: 'INACTIVE', actions: { assignUserToGroups: { groupIds: ['g2'] } } },
        ],
      }),
    });

    await createGroupDiscoveryOperations(core).getGroupRulesForGroup('g1');

    expect(setMock).toHaveBeenCalledTimes(1);
    const [formattedRules, rawRules, stats, conflicts] = setMock.mock.calls[0];
    // ALL rules are cached (not just this group's) so any group can be served next.
    expect(formattedRules.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(rawRules.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(stats).toEqual({ total: 2, active: 1, inactive: 1, conflicts: 0 });
    expect(conflicts).toEqual([]);
  });

  it('serves a second call from the populated cache without a second fetch', async () => {
    // Wire the mock cache: once set() stores rules, getRulesForGroup serves them.
    setMock.mockImplementation(async (rules) => {
      isFreshMock.mockResolvedValue(true);
      getRulesForGroupMock.mockImplementation(async (gid) =>
        rules.filter((r) => r.groupIds.includes(gid)),
      );
    });
    const makeApiRequest = vi.fn().mockResolvedValue({
      success: true,
      data: [{ id: 'r1', status: 'ACTIVE', actions: { assignUserToGroups: { groupIds: ['g1'] } } }],
    });
    const ops = createGroupDiscoveryOperations(makeCore({ makeApiRequest }));

    const first = await ops.getGroupRulesForGroup('g1');
    expect(first.map((r) => (r as { id: string }).id)).toEqual(['r1']);
    expect(makeApiRequest).toHaveBeenCalledTimes(1);

    const second = await ops.getGroupRulesForGroup('g1');
    expect(second.map((r) => (r as { id: string }).id)).toEqual(['r1']);
    // No additional fetch: the second call was served from the cache write-back.
    expect(makeApiRequest).toHaveBeenCalledTimes(1);
  });
});

describe('ensureGroupRulesLoaded', () => {
  const RULES_NEXT_LINK =
    '<https://fake.okta.example.com/api/v1/groups/rules?after=CURSOR2&limit=200>; rel="next"';

  it('serves a warm cache without issuing any request', async () => {
    getMock.mockResolvedValue({
      rules: [{ id: 'r1' }],
      rawRules: [],
      stats: { total: 1, active: 1, inactive: 0, conflicts: 0 },
      conflicts: [],
      timestamp: Date.now(),
      ttl: 1000,
    } as unknown as Awaited<ReturnType<typeof RulesCache.get>>);
    const makeApiRequest = vi.fn();
    const core = makeCore({ makeApiRequest });

    const rules = await createGroupDiscoveryOperations(core).ensureGroupRulesLoaded();

    expect(rules?.map((r) => r.id)).toEqual(['r1']);
    expect(makeApiRequest).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it('on a cold cache fetches the org-wide listing ONCE and caches it', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [
          { id: 'r1', status: 'ACTIVE', actions: { assignUserToGroups: { groupIds: ['g1'] } } },
        ],
        headers: { link: RULES_NEXT_LINK },
      })
      .mockResolvedValueOnce({
        success: true,
        data: [
          { id: 'r2', status: 'INACTIVE', actions: { assignUserToGroups: { groupIds: ['g2'] } } },
        ],
        headers: {},
      });
    const core = makeCore({ makeApiRequest });

    const rules = await createGroupDiscoveryOperations(core).ensureGroupRulesLoaded();

    expect(rules?.map((r) => r.id)).toEqual(['r1', 'r2']);
    // One org-wide listing (paged), never one request per group.
    expect(makeApiRequest).toHaveBeenNthCalledWith(1, '/api/v1/groups/rules?limit=200');
    expect(makeApiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/v1/groups/rules?after=CURSOR2&limit=200',
    );
    expect(makeApiRequest).toHaveBeenCalledTimes(2);
    expect(setMock).toHaveBeenCalledTimes(1);
    const [, , stats] = setMock.mock.calls[0];
    expect(stats).toEqual({ total: 2, active: 1, inactive: 1, conflicts: 0 });
  });

  it('returns null (never throws) when the listing fails, so the group load can continue', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'boom' }),
    });

    await expect(createGroupDiscoveryOperations(core).ensureGroupRulesLoaded()).resolves.toBeNull();
    expect(setMock).not.toHaveBeenCalled();
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
