/**
 * Tests for the scheduler-routed group-rules fetch (§8).
 *
 * Pins the four-stage pipeline ported from the old content-script
 * `fetchGroupRules` handler: paginate `/api/v1/groups/rules`, label referenced
 * group ids with names from the Groups-tab cache (no API calls), detect
 * active-rule conflicts, and format each rule (`groupNames`, `allGroupNamesMap`,
 * `affectsCurrentGroup`, `conflicts`). The `{ success, rules, stats, conflicts }`
 * top-level shape is preserved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGroupRulesRequest } from './fetchGroupRulesRequest';
import { GROUPS_CACHE_KEY } from '../components/groups/groupsCache';
import type { RequestResult } from '../../shared/scheduler/types';

/** Seed the Groups-tab `chrome.storage.local` cache with an id→name list. */
function stubGroupsCache(groups: Array<{ id: string; name: string }>) {
  const payload = JSON.stringify({ groups, timestamp: Date.now() });
  vi.mocked(chrome.storage.local.get).mockResolvedValue({ [GROUPS_CACHE_KEY]: payload } as never);
}

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
  // Default: an empty/absent Groups cache (names fall back to ids).
  vi.mocked(chrome.storage.local.get).mockResolvedValue({} as never);
});

describe('fetchGroupRulesRequest', () => {
  it('labels rules with group names from the Groups cache, plus stats and conflicts', async () => {
    stubGroupsCache([{ id: 'gX', name: 'Group X' }]);
    const ruleA = rawRule({ id: 'rA', name: 'A' });
    const ruleB = rawRule({ id: 'rB', name: 'B' }); // same group + attribute → conflict
    const makeApiRequest = router([[/^\/api\/v1\/groups\/rules/, () => ok([ruleA, ruleB])]]);

    const result = await fetchGroupRulesRequest(makeApiRequest, 'gX');

    expect(result.success).toBe(true);
    expect(result.stats).toEqual({ total: 2, active: 2, inactive: 0, conflicts: 1 });
    expect(result.conflicts).toHaveLength(1);
    // Name taken from the Groups cache, and flagged as the current group.
    expect(result.rules?.[0].groupNames).toEqual(['Group X']);
    expect(result.rules?.[0].allGroupNamesMap).toEqual({ gX: 'Group X' });
    expect(result.rules?.[0].affectsCurrentGroup).toBe(true);
    // No per-group GET is issued — names come from the cache, not the API.
    expect(makeApiRequest.mock.calls.filter((c) => c[0] === '/api/v1/groups/gX')).toHaveLength(0);
  });

  it('falls back to the group id when the group is absent from the cache', async () => {
    // Default beforeEach stub: empty cache.
    const makeApiRequest = router([[/^\/api\/v1\/groups\/rules/, () => ok([rawRule()])]]);

    const result = await fetchGroupRulesRequest(makeApiRequest);

    expect(result.rules?.[0].groupNames).toEqual(['gX']);
    // Never fans out to resolve the unknown id.
    expect(makeApiRequest.mock.calls.filter((c) => c[0] === '/api/v1/groups/gX')).toHaveLength(0);
  });

  it('does not read the Groups cache when resolveGroupNames is false', async () => {
    // Two rules referencing three distinct groups (targets + an id in the
    // expression). With names skipped, none of them should be fetched.
    const ruleA = rawRule({
      id: 'rA',
      actions: { assignUserToGroups: { groupIds: ['00gAAAAAAAAAAAAAAAAA'] } },
      conditions: { expression: { value: 'isMemberOfAnyGroup("00gBBBBBBBBBBBBBBBBB")' } },
    });
    const ruleB = rawRule({
      id: 'rB',
      actions: { assignUserToGroups: { groupIds: ['00gCCCCCCCCCCCCCCCCC'] } },
    });
    const makeApiRequest = router([[/^\/api\/v1\/groups\/rules/, () => ok([ruleA, ruleB])]]);

    const result = await fetchGroupRulesRequest(makeApiRequest, undefined, {
      resolveGroupNames: false,
    });

    expect(result.success).toBe(true);
    // No per-group GET /api/v1/groups/{id} was issued — only the rules pages.
    const groupGets = makeApiRequest.mock.calls.filter((c) =>
      /^\/api\/v1\/groups\/00g/.test(c[0] as string),
    );
    expect(groupGets).toHaveLength(0);
    // The Groups cache is never even read for analysis-oriented callers.
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
    // Names fall back to ids; analysis-oriented callers never read them anyway.
    expect(result.rules?.[0].groupNames).toEqual(['00gAAAAAAAAAAAAAAAAA']);
  });

  it('stops paginating when Okta returns a next link on an empty page', async () => {
    // A non-terminating cursor: every page hands back the same rel="next". The
    // empty-page guard must stop the loop instead of looping forever.
    const nextHeader = {
      link: '<https://acme.okta.com/api/v1/groups/rules?after=STUCK&limit=200>; rel="next"',
    };
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce(
        ok([rawRule({ actions: { assignUserToGroups: { groupIds: [] } } })], nextHeader),
      )
      // Second page: empty, but STILL advertises a next link.
      .mockResolvedValue(ok([], nextHeader));

    const result = await fetchGroupRulesRequest(makeApiRequest);

    expect(result.success).toBe(true);
    // One rules page + one empty page, then it stops — not an unbounded flood.
    const rulePageCalls = makeApiRequest.mock.calls.filter((c) =>
      /^\/api\/v1\/groups\/rules/.test(c[0] as string),
    );
    expect(rulePageCalls).toHaveLength(2);
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
