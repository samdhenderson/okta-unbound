/**
 * Tests for the scheduler-routed group-rules fetch (§8).
 *
 * Pins the four-stage pipeline ported from the old content-script
 * `fetchGroupRules` handler: paginate `/api/v1/groups/rules`, resolve referenced
 * group names (cached), detect active-rule conflicts, and format each rule
 * (`groupNames`, `allGroupNamesMap`, `affectsCurrentGroup`, `conflicts`). The
 * `{ success, rules, stats, conflicts }` top-level shape is preserved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGroupRulesRequest } from './fetchGroupRulesRequest';
import type { RequestResult } from '../../shared/scheduler/types';

// Isolate the helper from chrome.storage-backed group-name caching.
const getCacheEntry = vi.fn();
const setCacheEntry = vi.fn();
vi.mock('../../shared/cache', () => ({
  getCacheEntry: (...args: unknown[]) => getCacheEntry(...args),
  setCacheEntry: (...args: unknown[]) => setCacheEntry(...args),
}));

const ok = (data: unknown, headers?: Record<string, string>): RequestResult => ({
  success: true,
  data,
  headers,
});

/** A raw Okta group rule. */
function rawRule(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Rule 1',
    status: 'ACTIVE',
    conditions: { expression: { value: 'user.department=="Eng"' } },
    actions: { assignUserToGroups: { groupIds: ['gX'] } },
    created: '2020-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    ...over,
  };
}

/** Route a fetch by endpoint prefix. */
function router(handlers: Array<[RegExp, () => RequestResult]>) {
  return vi.fn(async (endpoint: string) => {
    for (const [pattern, respond] of handlers) {
      if (pattern.test(endpoint)) return respond();
    }
    return { success: true, data: [] } as RequestResult;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCacheEntry.mockResolvedValue(null); // cache miss → resolve names via fetch
  setCacheEntry.mockResolvedValue(undefined);
});

describe('fetchGroupRulesRequest', () => {
  it('formats rules with resolved group names, stats, and conflicts', async () => {
    const ruleA = rawRule({ id: 'rA', name: 'A' });
    const ruleB = rawRule({ id: 'rB', name: 'B' }); // same group + attribute → conflict
    const makeApiRequest = router([
      [/^\/api\/v1\/groups\/rules/, () => ok([ruleA, ruleB])],
      [/^\/api\/v1\/groups\/gX$/, () => ok({ profile: { name: 'Group X' } })],
    ]);

    const result = await fetchGroupRulesRequest(makeApiRequest, 'gX');

    expect(result.success).toBe(true);
    expect(result.stats).toEqual({ total: 2, active: 2, inactive: 0, conflicts: 1 });
    expect(result.conflicts).toHaveLength(1);
    // Group name resolved for the target group, and flagged as the current group.
    expect(result.rules?.[0].groupNames).toEqual(['Group X']);
    expect(result.rules?.[0].allGroupNamesMap).toEqual({ gX: 'Group X' });
    expect(result.rules?.[0].affectsCurrentGroup).toBe(true);
    // The group name was fetched once and cached (both rules share gX).
    expect(makeApiRequest.mock.calls.filter((c) => c[0] === '/api/v1/groups/gX')).toHaveLength(1);
    expect(setCacheEntry).toHaveBeenCalledWith('group_name_gX', 'Group X', { ttl: 5 * 60 * 1000 });
  });

  it('serves a cached group name without fetching it', async () => {
    getCacheEntry.mockResolvedValue('Cached X');
    const makeApiRequest = router([[/^\/api\/v1\/groups\/rules/, () => ok([rawRule()])]]);

    const result = await fetchGroupRulesRequest(makeApiRequest);

    expect(result.rules?.[0].groupNames).toEqual(['Cached X']);
    expect(makeApiRequest.mock.calls.filter((c) => c[0] === '/api/v1/groups/gX')).toHaveLength(0);
  });

  it('follows Link rel="next" across rule pages', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce(
        ok([rawRule({ id: 'rA', actions: { assignUserToGroups: { groupIds: [] } } })], {
          link: '<https://acme.okta.com/api/v1/groups/rules?after=CUR&limit=200>; rel="next"',
        }),
      )
      .mockResolvedValueOnce(
        ok([
          rawRule({
            id: 'rB',
            status: 'INACTIVE',
            actions: { assignUserToGroups: { groupIds: [] } },
          }),
        ]),
      );

    const result = await fetchGroupRulesRequest(makeApiRequest);

    expect(makeApiRequest).toHaveBeenNthCalledWith(2, '/api/v1/groups/rules?after=CUR&limit=200');
    expect(result.stats).toEqual({ total: 2, active: 1, inactive: 1, conflicts: 0 });
  });

  it('returns a failed rules page verbatim', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'boom' } as RequestResult);

    const result = await fetchGroupRulesRequest(makeApiRequest);

    expect(result).toEqual({ success: false, error: 'boom' });
  });

  it('reports a failure (does not throw) when a request rejects', async () => {
    const makeApiRequest = vi.fn().mockRejectedValue(new Error('scheduler down'));

    const result = await fetchGroupRulesRequest(makeApiRequest);

    expect(result).toEqual({ success: false, error: 'scheduler down' });
  });
});
