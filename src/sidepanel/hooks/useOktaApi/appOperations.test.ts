/**
 * @module hooks/useOktaApi/appOperations.test
 * @description Unit tests for the app read operations.
 *
 * Drives `searchApps` through a fully-mocked `CoreApi`, asserting the request
 * shape, the `label || name || id` fallback, the short-query and error
 * short-circuits, and that malformed rows are dropped by boundary validation.
 * Also covers the Applications-tab reads: `getAppById` (the four `AppLookup`
 * outcomes), `getAppAssignmentCounts`, and the `getAppGroupAssignments` fallback
 * (pagination, `[]` vs `null`, lenient rows).
 * Fixtures use fake placeholders (`0oaFAKE…`) per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAppOperations } from './appOperations';
import type { CoreApi } from './core';
import { makeFakeCore } from '@/test/factories/coreApi';
import { NO_HTTP_STATUS } from '@/shared/scheduler/requestResult';

/** Build a fake CoreApi whose transport is fully mocked. */
const makeCore = (overrides: Partial<CoreApi> = {}): CoreApi =>
  makeFakeCore({
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getCurrentUser: vi.fn(),
    ...overrides,
  });

describe('searchApps', () => {
  it('returns [] for queries shorter than 2 chars without calling the API', async () => {
    const core = makeCore();
    const { searchApps } = createAppOperations(core);

    expect(await searchApps('a')).toEqual([]);
    expect(core.makeApiRequest).not.toHaveBeenCalled();
  });

  it('queries /api/v1/apps with an encoded q and maps label||name||id', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { id: '0oaFAKE1', label: 'Salesforce', name: 'salesforce', status: 'ACTIVE' },
          { id: '0oaFAKE2', name: 'okta_org2org', status: 'INACTIVE' },
          { id: '0oaFAKE3' },
        ],
      }),
    });
    const { searchApps } = createAppOperations(core);

    const result = await searchApps('sales force');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/apps?q=sales%20force&limit=20', {
      reason: 'Search apps by name',
    });
    expect(result).toEqual([
      { id: '0oaFAKE1', label: 'Salesforce', status: 'ACTIVE' },
      { id: '0oaFAKE2', label: 'okta_org2org', status: 'INACTIVE' },
      { id: '0oaFAKE3', label: '0oaFAKE3', status: undefined },
    ]);
  });

  it('drops rows failing validation (missing id) but keeps valid ones', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [{ label: 'no id' }, { id: '0oaFAKE9', label: 'Good' }],
      }),
    });
    const { searchApps } = createAppOperations(core);

    expect(await searchApps('good')).toEqual([
      { id: '0oaFAKE9', label: 'Good', status: undefined },
    ]);
  });

  it('returns [] when the request fails', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'boom' }),
    });
    const { searchApps } = createAppOperations(core);
    expect(await searchApps('anything')).toEqual([]);
  });

  it('returns [] (never throws) when the transport rejects', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockRejectedValue(new Error('network')),
    });
    const { searchApps } = createAppOperations(core);
    expect(await searchApps('anything')).toEqual([]);
  });
});

// REMOVED (ADR-0022, "the subject was deleted"): the three `getAllApps` cases —
// Link-header pagination, lenient row dropping, and throwing on a failed page —
// went with the operation itself. ADR-0040 moved the app inventory to the
// background-owned snapshot, and `shared/snapshot/snapshotSync.test.ts` pins the
// same three properties on the walk that replaced it: pages accumulate, malformed
// rows drop rather than fail the walk, and a failed page leaves the collection
// marked incomplete instead of passing a prefix off as the org.

/**
 * `getAppById` used to answer `OktaAppListItem | null`, which made "Okta says
 * there is no such app" and "we never got an answer" the same value — a
 * throttled or unauthenticated lookup rendered as an authoritative absence.
 * These cases pin the four outcomes that replaced it (D-007a); the three that
 * previously asserted `toBeNull()` are the same three scenarios, re-pointed at
 * the answer each one now gives.
 */
describe('getAppById', () => {
  it('returns the validated entity when Okta answers', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        status: 200,
        data: { id: '0oaFAKE1', label: 'Salesforce', signOnMode: 'SAML_2_0', created: null },
      }),
    });
    const { getAppById } = createAppOperations(core);

    const lookup = await getAppById('0oaFAKE1');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/apps/0oaFAKE1', {
      reason: 'Load app details',
    });
    expect(lookup.kind).toBe('found');
    if (lookup.kind !== 'found') throw new Error('expected a found lookup');
    expect(lookup.app.label).toBe('Salesforce');
    expect(lookup.app.signOnMode).toBe('SAML_2_0');
  });

  it('reports 404 — and only 404 — as missing', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValue({ success: false, status: 404, error: 'Not found' }),
    });
    const { getAppById } = createAppOperations(core);

    expect(await getAppById('0oaFAKE1')).toEqual({ kind: 'missing' });
  });

  it('reports a rate-limited lookup as failed, not missing', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValue({ success: false, status: 429, error: 'Too many requests' }),
    });
    const { getAppById } = createAppOperations(core);

    // The defect this item names: 429 used to be indistinguishable from a
    // deleted app, so a throttled jump reported the app did not exist.
    expect(await getAppById('0oaFAKE1')).toEqual({ kind: 'failed', status: 429 });
  });

  it('reports 401 as an expired session', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValue({ success: false, status: 401, error: 'Invalid session' }),
    });
    const { getAppById } = createAppOperations(core);

    expect(await getAppById('0oaFAKE1')).toEqual({ kind: 'session-expired' });
  });

  it('does not mistake 403 for an expired session', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValue({ success: false, status: 403, error: 'Forbidden' }),
    });
    const { getAppById } = createAppOperations(core);

    // Re-authenticating is the wrong remedy for a permission wall.
    expect(await getAppById('0oaFAKE1')).toEqual({ kind: 'failed', status: 403 });
  });

  it('reports a response that fails validation as failed, not missing', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValue({ success: true, status: 200, data: { label: 'no id' } }),
    });
    const { getAppById } = createAppOperations(core);

    expect(await getAppById('0oaFAKE1')).toEqual({ kind: 'failed', status: 200 });
  });

  it('reports a transport rejection as failed with the no-HTTP-response sentinel', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockRejectedValue(new Error('network')) });
    const { getAppById } = createAppOperations(core);

    // Still never throws — the contract that changed is the return, not that.
    expect(await getAppById('0oaFAKE1')).toEqual({ kind: 'failed', status: NO_HTTP_STATUS });
  });
});

describe('getAppAssignmentCounts', () => {
  it('counts users and groups across all pages at low priority', async () => {
    const makeApiRequest = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/apps/0oaFAKE1/users?limit=200') {
        return Promise.resolve({
          success: true,
          data: [{ id: '00uFAKE1' }, { id: '00uFAKE2' }],
          headers: {
            link: '<https://example.okta.com/api/v1/apps/0oaFAKE1/users?after=2>; rel="next"',
          },
        });
      }
      if (url === '/api/v1/apps/0oaFAKE1/users?after=2') {
        return Promise.resolve({ success: true, data: [{ id: '00uFAKE3' }], headers: {} });
      }
      if (url === '/api/v1/apps/0oaFAKE1/groups?limit=200') {
        return Promise.resolve({ success: true, data: [{ id: '00gFAKE1' }], headers: {} });
      }
      return Promise.resolve({ success: true, data: [], headers: {} });
    });
    const core = makeCore({ makeApiRequest });
    const { getAppAssignmentCounts } = createAppOperations(core);

    expect(await getAppAssignmentCounts('0oaFAKE1')).toEqual({ users: 3, groups: 1 });
    // Bulk walks yield to interactive work.
    for (const call of makeApiRequest.mock.calls) {
      expect(call[1]).toMatchObject({ priority: 'low', reason: 'Count app assignments' });
    }
  });

  it('counts validated rows only (malformed assignments are dropped)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const core = makeCore({
      makeApiRequest: vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          success: true,
          data: url.includes('/users')
            ? [{ id: '00uFAKE1' }, { status: 'ACTIVE' }]
            : [{ id: '00gFAKE1' }],
          headers: {},
        }),
      ),
    });
    const { getAppAssignmentCounts } = createAppOperations(core);

    expect(await getAppAssignmentCounts('0oaFAKE1')).toEqual({ users: 1, groups: 1 });
    vi.restoreAllMocks();
  });

  it('returns null when either walk fails', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockImplementation((url: string) =>
          url.includes('/groups')
            ? Promise.resolve({ success: false, error: 'boom' })
            : Promise.resolve({ success: true, data: [{ id: '00uFAKE1' }], headers: {} }),
        ),
    });
    const { getAppAssignmentCounts } = createAppOperations(core);

    expect(await getAppAssignmentCounts('0oaFAKE1')).toBeNull();
  });

  it('returns null (never throws) when the transport rejects', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockRejectedValue(new Error('network')) });
    const { getAppAssignmentCounts } = createAppOperations(core);

    expect(await getAppAssignmentCounts('0oaFAKE1')).toBeNull();
  });

  /**
   * The `x-total-count` probe. The cases above all answer with `headers: {}`,
   * so they already pin the fallback half — an org that withholds the header
   * behaves exactly as it did before the probe existed. These pin the half that
   * saves the requests, and the boundary between them.
   */
  describe('x-total-count probe', () => {
    /** A transport that answers the two `limit=1` probes with the given headers. */
    const probing = (users: Record<string, string>, groups: Record<string, string>) =>
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/v1/apps/0oaFAKE1/users?limit=1') {
          return Promise.resolve({ success: true, data: [{ id: '00uFAKE1' }], headers: users });
        }
        if (url === '/api/v1/apps/0oaFAKE1/groups?limit=1') {
          return Promise.resolve({ success: true, data: [{ id: '00gFAKE1' }], headers: groups });
        }
        // Any full walk reaching here is the fallback, and returns a length that
        // could never be mistaken for a probed total.
        return Promise.resolve({ success: true, data: [{ id: '00uWALKED' }], headers: {} });
      });

    it('reads both totals from the header and issues exactly one request each', async () => {
      const makeApiRequest = probing({ 'x-total-count': '9814' }, { 'x-total-count': '12' });
      const { getAppAssignmentCounts } = createAppOperations(makeCore({ makeApiRequest }));

      expect(await getAppAssignmentCounts('0oaFAKE1')).toEqual({ users: 9814, groups: 12 });
      // Two requests total: the walk this replaced would have been 50 for the
      // users collection alone.
      expect(makeApiRequest).toHaveBeenCalledTimes(2);
      expect(makeApiRequest.mock.calls.map((call) => call[0])).toEqual([
        '/api/v1/apps/0oaFAKE1/users?limit=1',
        '/api/v1/apps/0oaFAKE1/groups?limit=1',
      ]);
      for (const call of makeApiRequest.mock.calls) {
        expect(call[1]).toMatchObject({ priority: 'low', reason: 'Count app assignments' });
      }
    });

    it('reads a header casing Okta did not promise', async () => {
      const makeApiRequest = probing({ 'X-Total-Count': '7' }, { 'x-total-count': '0' });
      const { getAppAssignmentCounts } = createAppOperations(makeCore({ makeApiRequest }));

      // 0 is a real total, not a missing one — it must not trigger the fallback.
      expect(await getAppAssignmentCounts('0oaFAKE1')).toEqual({ users: 7, groups: 0 });
      expect(makeApiRequest).toHaveBeenCalledTimes(2);
    });

    it('falls back per collection, so one may probe while the other walks', async () => {
      const makeApiRequest = probing({ 'x-total-count': '9814' }, {});
      const { getAppAssignmentCounts } = createAppOperations(makeCore({ makeApiRequest }));

      // Users probed; groups fell back to the single-page walk (one row).
      expect(await getAppAssignmentCounts('0oaFAKE1')).toEqual({ users: 9814, groups: 1 });
      expect(makeApiRequest.mock.calls.map((call) => call[0])).toContain(
        '/api/v1/apps/0oaFAKE1/groups?limit=200',
      );
      expect(makeApiRequest.mock.calls.map((call) => call[0])).not.toContain(
        '/api/v1/apps/0oaFAKE1/users?limit=200',
      );
    });

    // An unusable header is "count unknown", never a number. Each of these
    // would produce a confidently wrong figure if it were parsed leniently:
    // `''` and `'   '` both `Number()` to 0, `'12.5'` is not a row count, and a
    // negative total is not a count at all.
    it.each([[''], ['   '], ['12.5'], ['-1'], ['many']])(
      'treats %j as unknown and walks instead',
      async (header) => {
        const makeApiRequest = probing({ 'x-total-count': header }, { 'x-total-count': '12' });
        const { getAppAssignmentCounts } = createAppOperations(makeCore({ makeApiRequest }));

        expect(await getAppAssignmentCounts('0oaFAKE1')).toEqual({ users: 1, groups: 12 });
        expect(makeApiRequest.mock.calls.map((call) => call[0])).toContain(
          '/api/v1/apps/0oaFAKE1/users?limit=200',
        );
      },
    );

    it('falls back when the probe itself fails, so a blip is not a count', async () => {
      const makeApiRequest = vi
        .fn()
        .mockImplementation((url: string) =>
          url.endsWith('limit=1')
            ? Promise.resolve({ success: false, error: 'blip', status: 500 })
            : Promise.resolve({ success: true, data: [{ id: '00uFAKE1' }], headers: {} }),
        );
      const { getAppAssignmentCounts } = createAppOperations(makeCore({ makeApiRequest }));

      expect(await getAppAssignmentCounts('0oaFAKE1')).toEqual({ users: 1, groups: 1 });
    });
  });
});

/**
 * `getAppGroupAssignments` is the **fallback** for naming an app's granting
 * group — used only where the `expand=user/{userId}` embed named none. The two
 * things it must never do are collapse "no groups assigned" into "no answer",
 * and fail a whole walk over one malformed row.
 */
describe('getAppGroupAssignments', () => {
  it('walks every page via the Link header and returns all assigned group ids', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: '00gFAKEgroup00000001' }, { id: '00gFAKEgroup00000002' }],
        headers: {
          link: '<https://example.okta.com/api/v1/apps/0oaFAKEapp000001/groups?after=2>; rel="next"',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: '00gFAKEgroup00000003' }],
        headers: {},
      });
    const core = makeCore({ makeApiRequest });
    const { getAppGroupAssignments } = createAppOperations(core);

    expect(await getAppGroupAssignments('0oaFAKEapp000001')).toEqual([
      '00gFAKEgroup00000001',
      '00gFAKEgroup00000002',
      '00gFAKEgroup00000003',
    ]);
    expect(makeApiRequest.mock.calls[0][0]).toBe('/api/v1/apps/0oaFAKEapp000001/groups?limit=200');
    expect(makeApiRequest.mock.calls[1][0]).toBe('/api/v1/apps/0oaFAKEapp000001/groups?after=2');
    // A bulk walk must yield to interactive work.
    for (const call of makeApiRequest.mock.calls) {
      expect(call[1]).toMatchObject({ priority: 'low', reason: 'Load app group assignments' });
    }
  });

  it('returns [] — not null — when Okta positively reports no assigned groups', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: [], headers: {} }),
    });
    const { getAppGroupAssignments } = createAppOperations(core);

    // "No groups assigned" is an answer; conflating it with "no answer" is the
    // defect ADR-0020 exists to prevent.
    expect(await getAppGroupAssignments('0oaFAKEapp000001')).toEqual([]);
  });

  it('returns null (never []) when a page of the walk fails', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'boom' }),
    });
    const { getAppGroupAssignments } = createAppOperations(core);

    const result = await getAppGroupAssignments('0oaFAKEapp000001');
    expect(result).toBeNull();
    expect(result).not.toEqual([]);
  });

  it('returns null when a later page fails after earlier pages succeeded', async () => {
    const core = makeCore({
      makeApiRequest: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          data: [{ id: '00gFAKEgroup00000001' }],
          headers: {
            link: '<https://example.okta.com/api/v1/apps/0oaFAKEapp000001/groups?after=1>; rel="next"',
          },
        })
        .mockResolvedValueOnce({ success: false, error: 'rate limited' }),
    });
    const { getAppGroupAssignments } = createAppOperations(core);

    // A truncated list rendered as complete would name the wrong grantor.
    expect(await getAppGroupAssignments('0oaFAKEapp000001')).toBeNull();
  });

  it('returns null (never throws) when the transport rejects', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockRejectedValue(new Error('network')) });
    const { getAppGroupAssignments } = createAppOperations(core);

    expect(await getAppGroupAssignments('0oaFAKEapp000001')).toBeNull();
  });

  it('drops a malformed row without failing the walk', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [{ id: '00gFAKEgroup00000001' }, { priority: 1 }, { id: '00gFAKEgroup00000002' }],
        headers: {},
      }),
    });
    const { getAppGroupAssignments } = createAppOperations(core);

    expect(await getAppGroupAssignments('0oaFAKEapp000001')).toEqual([
      '00gFAKEgroup00000001',
      '00gFAKEgroup00000002',
    ]);
    vi.restoreAllMocks();
  });

  it('encodes the app id into the request path', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue({ success: true, data: [], headers: {} });
    const { getAppGroupAssignments } = createAppOperations(makeCore({ makeApiRequest }));

    await getAppGroupAssignments('0oaFAKE app/001');

    expect(makeApiRequest.mock.calls[0][0]).toBe(
      '/api/v1/apps/0oaFAKE%20app%2F001/groups?limit=200',
    );
  });
});
