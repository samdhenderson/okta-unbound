/**
 * Unit tests for the per-user read + lifecycle operations.
 *
 * Each operation is driven through a fully-mocked `CoreApi` (see `makeCore`), so we
 * assert both the request shape passed to `makeApiRequest` (endpoint/method/body/
 * priority) and the transformed result — including the error/`success:false`
 * branches. Behavior is pinned as-is; no production source is changed.
 *
 * Fixtures use only fake placeholders (`00uFAKE…`, `example.okta.com`) per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { createUserOperations } from './userOperations';
import type { CoreApi } from './core';
import type { RequestResult } from '@/shared/scheduler/types';
import { makeFakeCore } from '@/test/factories/coreApi';

/** Build a fake CoreApi whose transport is fully mocked. */
const makeCore = (overrides: Partial<CoreApi> = {}): CoreApi =>
  makeFakeCore({
    makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: {} }),
    // This suite's default runOperation actually invokes the task for each item
    // so operations built on it (scanGroupMfa) exercise their inner logic.
    runOperation: vi.fn(
      async (_name, items: unknown[], task: (i: unknown, n: number) => unknown) => {
        for (let i = 0; i < items.length; i++) await task(items[i], i);
        return { results: [], completed: items.length, failed: 0, cancelled: false };
      },
    ),
    ...overrides,
  });

describe('getUserLastLogin', () => {
  it('returns a Date when lastLogin is present', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: { lastLogin: '2026-01-02T03:04:05.000Z' },
      }),
    });
    const { getUserLastLogin } = createUserOperations(core);

    const result = await getUserLastLogin('00uFAKE1');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/users/00uFAKE1', {
      reason: 'Load user last login',
    });
    expect(result).toEqual(new Date('2026-01-02T03:04:05.000Z'));
  });

  it('returns null when the user never logged in (no lastLogin)', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: {} }),
    });
    const { getUserLastLogin } = createUserOperations(core);
    expect(await getUserLastLogin('00uFAKE1')).toBeNull();
  });

  it('returns null when the request is unsuccessful', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false }),
    });
    const { getUserLastLogin } = createUserOperations(core);
    expect(await getUserLastLogin('00uFAKE1')).toBeNull();
  });

  it('returns null and swallows a thrown error', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const { getUserLastLogin } = createUserOperations(core);
    expect(await getUserLastLogin('00uFAKE1')).toBeNull();
  });
});

describe('getUserApps', () => {
  it('walks Link pagination and flattens id + label/name/id fallback', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: 'a1', label: 'App One' }],
        headers: { link: '<https://example.okta.com/api/v1/apps?after=cur>; rel="next"' },
      })
      // Second page: one app uses `name` fallback, one falls back to its id; no next link.
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: 'a2', name: 'App Two' }, { id: 'a3' }],
        headers: {},
      });
    const core = makeCore({ makeApiRequest });
    const { getUserApps } = createUserOperations(core);

    const { apps, complete } = await getUserApps('00uFAKE1');

    expect(makeApiRequest).toHaveBeenCalledTimes(2);
    expect(apps).toEqual([
      { id: 'a1', label: 'App One', isProfileSource: false },
      { id: 'a2', label: 'App Two', isProfileSource: false },
      { id: 'a3', label: 'a3', isProfileSource: false },
    ]);
    expect(complete).toBe(true);
  });

  it('reports the walk as incomplete when a page is unsuccessful', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockResolvedValue({ success: false }) });
    const { getUserApps } = createUserOperations(core);

    // Previously characterized as "returns []", which made a transport failure
    // indistinguishable from a user with no apps. The rows collected so far still
    // come back; `complete: false` is what says they are not the whole answer.
    expect(await getUserApps('00uFAKE1')).toEqual({ apps: [], complete: false });
  });

  it('keeps the pages it collected before a mid-walk failure, and flags them as partial', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: 'a1', label: 'App One' }],
        headers: { link: '<https://example.okta.com/api/v1/apps?after=cur>; rel="next"' },
      })
      .mockResolvedValueOnce({ success: false, error: '500 from Okta' });
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    // The distinction the flag exists for: one real app in hand, and an unknown
    // number missing. Neither "1 app" nor "0 apps" is the truth.
    expect(await getUserApps('00uFAKE1')).toEqual({
      apps: [{ id: 'a1', label: 'App One', scope: undefined, isProfileSource: false }],
      complete: false,
    });
  });

  it('reports the walk as incomplete on a thrown error', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockRejectedValue(new Error('offline')) });
    const { getUserApps } = createUserOperations(core);
    expect(await getUserApps('00uFAKE1')).toEqual({ apps: [], complete: false });
  });
});

describe('batchGetUserDetails', () => {
  it('loads users in batches of 3 at low priority, omitting failures, and reports progress', async () => {
    const makeApiRequest = vi.fn(async (endpoint: string): Promise<RequestResult> => {
      if (endpoint.endsWith('/00uFAKE2')) return { success: true, data: null }; // omitted
      if (endpoint.endsWith('/00uFAKE4')) throw new Error('boom'); // omitted via catch
      const id = endpoint.split('/').pop();
      return { success: true, data: { id, profile: {} } };
    });
    const core = makeCore({ makeApiRequest });
    const { batchGetUserDetails } = createUserOperations(core);
    const onProgress = vi.fn();

    const map = await batchGetUserDetails(
      ['00uFAKE1', '00uFAKE2', '00uFAKE3', '00uFAKE4'],
      onProgress,
    );

    // 1 and 3 loaded; 2 (null data) and 4 (threw) omitted.
    expect([...map.keys()].sort()).toEqual(['00uFAKE1', '00uFAKE3']);
    // low priority passed through.
    expect(makeApiRequest).toHaveBeenCalledWith('/api/v1/users/00uFAKE1', {
      method: 'GET',
      priority: 'low',
      reason: 'Load user details',
    });
    // Two batches (3 + 1) → progress capped at total.
    expect(onProgress).toHaveBeenNthCalledWith(1, 3, 4);
    expect(onProgress).toHaveBeenNthCalledWith(2, 4, 4);
  });

  it('works without an onProgress callback', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, data: { id: 'x', profile: {} } }),
    });
    const { batchGetUserDetails } = createUserOperations(core);
    const map = await batchGetUserDetails(['00uFAKE1']);
    expect(map.size).toBe(1);
  });

  // The batch now runs through coreApi.runOperation (ADR-0009), which makes it
  // cancellable: a cancel mid-run resolves with the users loaded so far rather
  // than throwing or losing them.
  it('returns the partially-loaded map when the run is cancelled midway', async () => {
    const runOperation = vi.fn(
      async (_name: string, items: unknown[], task: (item: unknown, index: number) => unknown) => {
        // Only the first item runs before the cancel trips.
        await task(items[0], 0);
        return {
          results: [],
          total: items.length,
          completed: 1,
          failed: 0,
          skipped: items.length - 1,
          stoppedByError: false,
          cancelled: true,
        };
      },
    ) as unknown as CoreApi['runOperation'];
    const core = makeCore({
      makeApiRequest: vi.fn(async (endpoint: string): Promise<RequestResult> => ({
        success: true,
        data: { id: endpoint.split('/').pop(), profile: {} },
      })),
      runOperation,
    });
    const { batchGetUserDetails } = createUserOperations(core);

    const map = await batchGetUserDetails(['00uFAKE1', '00uFAKE2', '00uFAKE3']);

    expect([...map.keys()]).toEqual(['00uFAKE1']);
  });
});

describe('scanGroupMfa', () => {
  it('summarizes factors per user, treating non-array/failed data as no factors', async () => {
    const makeApiRequest = vi.fn(async (endpoint: string): Promise<RequestResult> => {
      if (endpoint.includes('00uFAKE1')) {
        return { success: true, data: [{ factorType: 'sms', status: 'ACTIVE' }] };
      }
      if (endpoint.includes('00uFAKE2')) return { success: true, data: null }; // non-array
      throw new Error('factors down'); // 00uFAKE3 → catch
    });
    const core = makeCore({ makeApiRequest });
    const { scanGroupMfa } = createUserOperations(core);

    const map = await scanGroupMfa(['00uFAKE1', '00uFAKE2', '00uFAKE3']);

    expect(core.runOperation).toHaveBeenCalled();
    expect([...map.keys()].sort()).toEqual(['00uFAKE1', '00uFAKE2', '00uFAKE3']);
    expect(makeApiRequest).toHaveBeenCalledWith('/api/v1/users/00uFAKE1/factors', {
      method: 'GET',
      priority: 'low',
      reason: 'MFA scan',
    });
    // The enrolled user reports at least one factor; the others summarize as none.
    expect(map.get('00uFAKE1')?.enrolled).toBe(true);
    expect(map.get('00uFAKE1')?.factorCount).toBe(1);
    expect(map.get('00uFAKE2')?.enrolled).toBe(false);
    expect(map.get('00uFAKE3')?.enrolled).toBe(false);
  });
});

describe('getUserGroupMemberships', () => {
  it('reads the exact count from the x-total-count header', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        headers: { 'x-total-count': '42' },
      }),
    });
    const { getUserGroupMemberships } = createUserOperations(core);

    const count = await getUserGroupMemberships('00uFAKE1');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/users/00uFAKE1/groups?limit=1', {
      reason: 'Count user group memberships',
    });
    expect(count).toBe(42);
  });

  it('returns 0 when the header is absent', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true, headers: {} }),
    });
    const { getUserGroupMemberships } = createUserOperations(core);
    expect(await getUserGroupMemberships('00uFAKE1')).toBe(0);
  });

  it('returns 0 on a thrown error', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockRejectedValue(new Error('nope')) });
    const { getUserGroupMemberships } = createUserOperations(core);
    expect(await getUserGroupMemberships('00uFAKE1')).toBe(0);
  });
});

describe('searchUsers', () => {
  it('short-circuits to [] for queries shorter than 2 chars', async () => {
    const core = makeCore();
    const { searchUsers } = createUserOperations(core);

    expect(await searchUsers('a')).toEqual([]);
    expect(await searchUsers('')).toEqual([]);
    expect(core.makeApiRequest).not.toHaveBeenCalled();
  });

  it('URL-encodes the query and flattens results, defaulting missing fields', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: '00uFAKE1',
            status: 'ACTIVE',
            profile: {
              email: 'jane@example.com',
              firstName: 'Jane',
              lastName: 'Doe',
              login: 'jane@example.com',
            },
          },
          { id: '00uFAKE2', profile: {} }, // missing status + profile fields → defaults
        ],
      }),
    });
    const { searchUsers } = createUserOperations(core);

    const results = await searchUsers('jane doe');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/users?q=jane%20doe&limit=20', {
      reason: 'Search users',
    });
    expect(results[0]).toEqual({
      id: '00uFAKE1',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      login: 'jane@example.com',
      status: 'ACTIVE',
    });
    expect(results[1]).toEqual({
      id: '00uFAKE2',
      email: '',
      firstName: '',
      lastName: '',
      login: '',
      status: 'UNKNOWN',
    });
  });

  it('returns [] when the response has no data', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockResolvedValue({ success: false }) });
    const { searchUsers } = createUserOperations(core);
    expect(await searchUsers('jane')).toEqual([]);
  });

  it('returns [] on a thrown error', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockRejectedValue(new Error('down')) });
    const { searchUsers } = createUserOperations(core);
    expect(await searchUsers('jane')).toEqual([]);
  });
});

describe('getUserById', () => {
  it('flattens a found user, defaulting missing fields', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        data: { id: '00uFAKE1', profile: {} },
      }),
    });
    const { getUserById } = createUserOperations(core);

    const result = await getUserById('00uFAKE1');

    expect(result).toEqual({
      id: '00uFAKE1',
      email: '',
      firstName: '',
      lastName: '',
      login: '',
      status: 'UNKNOWN',
    });
  });

  it('returns null when the user is not found', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockResolvedValue({ success: false }) });
    const { getUserById } = createUserOperations(core);
    expect(await getUserById('00uFAKE1')).toBeNull();
  });

  it('returns null on a thrown error', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockRejectedValue(new Error('boom')) });
    const { getUserById } = createUserOperations(core);
    expect(await getUserById('00uFAKE1')).toBeNull();
  });
});

describe('lifecycle actions', () => {
  it('suspendUser POSTs the suspend endpoint and passes success/error through', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'not active' }),
    });
    const { suspendUser } = createUserOperations(core);

    const result = await suspendUser('00uFAKE1');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/users/00uFAKE1/lifecycle/suspend', {
      method: 'POST',
      reason: 'Suspend user',
    });
    expect(result).toEqual({ success: false, error: 'not active' });
  });

  it('unsuspendUser POSTs the unsuspend endpoint', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockResolvedValue({ success: true }) });
    const { unsuspendUser } = createUserOperations(core);

    const result = await unsuspendUser('00uFAKE1');

    expect(core.makeApiRequest).toHaveBeenCalledWith('/api/v1/users/00uFAKE1/lifecycle/unsuspend', {
      method: 'POST',
      reason: 'Unsuspend user',
    });
    expect(result).toEqual({ success: true, error: undefined });
  });

  it('resetPassword POSTs the reset endpoint with sendEmail=true', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockResolvedValue({ success: true }) });
    const { resetPassword } = createUserOperations(core);

    const result = await resetPassword('00uFAKE1');

    expect(core.makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/users/00uFAKE1/lifecycle/reset_password?sendEmail=true',
      { method: 'POST', reason: 'Reset user password' },
    );
    expect(result).toEqual({ success: true, error: undefined });
  });
});

describe('getUserApps boundary validation', () => {
  it('drops malformed app rows (missing id) leniently instead of failing', async () => {
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({
        success: true,
        // The second row lacks the required `id` — the lenient list parser
        // (ADR-0006) drops it rather than failing the whole fetch.
        data: [{ id: '0oaFAKE1', label: 'App One' }, { label: 'No Id App' }],
        headers: {},
      }),
    });
    const { getUserApps } = createUserOperations(core);

    // A dropped row is not an incomplete walk: every page was fetched, so the
    // answer is complete even though one malformed row did not survive validation.
    expect(await getUserApps('00uFAKE1')).toEqual({
      apps: [{ id: '0oaFAKE1', label: 'App One', isProfileSource: false }],
      complete: true,
    });
  });
});

/**
 * Phase 4.1: the app-assignment `scope` (direct vs group-granted) rides along on
 * the app list Okta already returns, via `expand=user/{userId}` on the SAME
 * `/api/v1/apps?filter=user.id eq …` endpoint — so it must cost zero extra
 * requests, and a missing or malformed embed must never cost us an app.
 */
describe('getUserApps assignment scope', () => {
  /** A single successful page with no next link. */
  const onePage = (data: unknown[]) => ({ success: true, data, headers: {} });

  it('expands the app-user on the same endpoint, for the same id it filters on', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(onePage([{ id: '0oaFAKE1', label: 'One' }]));
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    await getUserApps('00uFAKE1');

    const url = String(makeApiRequest.mock.calls[0][0]);
    expect(url).toBe('/api/v1/apps?filter=user.id+eq+"00uFAKE1"&limit=200&expand=user/00uFAKE1');
    // The expanded user must be the filtered user — expanding a different id would
    // silently report someone else's assignment scope.
    expect(url.match(/user\.id\+eq\+"([^"]+)"/)?.[1]).toBe(url.match(/expand=user\/([^&]+)/)?.[1]);
  });

  it('costs no extra requests: the paginated walk issues one call per page, as before', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [
          { id: '0oaFAKE1', label: 'One', _embedded: { user: { id: '00uFAKE1', scope: 'USER' } } },
        ],
        // Okta echoing the expand back on the cursor link (as it does for
        // `expand=stats` — see groupDiscovery.test.ts).
        headers: {
          link: '<https://example.okta.com/api/v1/apps?after=cur&limit=200&expand=user%2F00uFAKE1>; rel="next"',
        },
      })
      .mockResolvedValueOnce(
        onePage([
          { id: '0oaFAKE2', label: 'Two', _embedded: { user: { id: '00uFAKE1', scope: 'GROUP' } } },
        ]),
      );
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    const { apps } = await getUserApps('00uFAKE1');

    // Two pages → exactly two calls, identical to the un-expanded walk asserted by
    // the "walks Link pagination and flattens id + label/name/id fallback" case
    // above (same endpoint, same page size, same cursor follow). `expand` adds
    // fields to each page, never a request.
    expect(makeApiRequest).toHaveBeenCalledTimes(2);
    expect(apps).toEqual([
      { id: '0oaFAKE1', label: 'One', scope: 'USER', isProfileSource: false },
      { id: '0oaFAKE2', label: 'Two', scope: 'GROUP', isProfileSource: false },
    ]);
  });

  it('maps _embedded.user.scope USER → direct-assignment scope', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValue(
        onePage([
          { id: '0oaFAKE1', label: 'One', _embedded: { user: { id: '00uFAKE1', scope: 'USER' } } },
        ]),
      );
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    expect((await getUserApps('00uFAKE1')).apps[0].scope).toBe('USER');
  });

  it('maps _embedded.user.scope GROUP → group-granted scope', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValue(
        onePage([
          { id: '0oaFAKE1', label: 'One', _embedded: { user: { id: '00uFAKE1', scope: 'GROUP' } } },
        ]),
      );
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    expect((await getUserApps('00uFAKE1')).apps[0].scope).toBe('GROUP');
  });

  it('keeps the app (scope undefined) when _embedded is absent entirely', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(onePage([{ id: '0oaFAKE1', label: 'One' }]));
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    const { apps } = await getUserApps('00uFAKE1');

    // The app must NOT be dropped: under-reporting a user's access is far worse
    // than a missing scope (ADR-0006 degrades, it does not fail closed).
    expect(apps).toHaveLength(1);
    expect(apps[0]).toEqual({
      id: '0oaFAKE1',
      label: 'One',
      scope: undefined,
      isProfileSource: false,
    });
  });

  it.each([
    ['a string', 'nonsense'],
    ['null', null],
    ['an array', [{ scope: 'USER' }]],
    ['a user that is a string', { user: 'nonsense' }],
    ['a user with no id', { user: { scope: 'USER' } }],
    ['an unrecognized scope value', { user: { id: '00uFAKE1', scope: 'SOMETHING_NEW' } }],
    ['a non-string scope', { user: { id: '00uFAKE1', scope: 7 } }],
  ])('keeps the app (scope undefined) when _embedded is %s', async (_label, embedded) => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValue(onePage([{ id: '0oaFAKE1', label: 'One', _embedded: embedded }]));
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    // Never throws, never guesses, never drops.
    const { apps } = await getUserApps('00uFAKE1');

    expect(apps).toHaveLength(1);
    expect(apps[0].scope).toBeUndefined();
  });

  it('returns every app on a page where only some rows carry the embed', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(
      onePage([
        { id: '0oaFAKE1', label: 'One', _embedded: { user: { id: '00uFAKE1', scope: 'USER' } } },
        { id: '0oaFAKE2', label: 'Two' },
        { id: '0oaFAKE3', label: 'Three', _embedded: 'nonsense' },
        { id: '0oaFAKE4', label: 'Four', _embedded: { user: { id: '00uFAKE1', scope: 'GROUP' } } },
      ]),
    );
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    expect((await getUserApps('00uFAKE1')).apps).toEqual([
      { id: '0oaFAKE1', label: 'One', scope: 'USER', isProfileSource: false },
      { id: '0oaFAKE2', label: 'Two', scope: undefined, isProfileSource: false },
      { id: '0oaFAKE3', label: 'Three', scope: undefined, isProfileSource: false },
      { id: '0oaFAKE4', label: 'Four', scope: 'GROUP', isProfileSource: false },
    ]);
  });
});

/**
 * Task A4: name the group that grants an app, on load, for **zero** extra
 * requests. The grant group rides the SAME `expand=user/{userId}` response the
 * `scope` is read from, so these cases pin that the field is populated from the
 * embed, that a hostile or malformed link never becomes an answer, and that a
 * `USER` scope and a grant group can coexist on one row.
 */
describe('getUserApps grant group', () => {
  /** A single successful page with no next link. */
  const onePage = (data: unknown[]) => ({ success: true, data, headers: {} });

  /** An app row whose embedded app-user names `href` as its group link. */
  const rowWithGroupHref = (href: unknown, scope = 'GROUP') => ({
    id: '0oaFAKEapp000001',
    label: 'One',
    _embedded: { user: { id: '00uFAKE0001', scope, _links: { group: { href } } } },
  });

  it('reads grantGroupId off the embed without issuing a request per app', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValue(
        onePage([rowWithGroupHref('https://example.okta.com/api/v1/groups/00gFAKEgroup00000001')]),
      );
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    const { apps } = await getUserApps('00uFAKE0001');

    expect(apps).toEqual([
      {
        id: '0oaFAKEapp000001',
        label: 'One',
        scope: 'GROUP',
        grantGroupId: '00gFAKEgroup00000001',
        isProfileSource: false,
      },
    ]);
    // One page, one call — naming the group cost nothing.
    expect(makeApiRequest).toHaveBeenCalledTimes(1);
  });

  /*
   * The app row's `features` is what the profile-editability gate resolves a
   * `PROFILE_MASTER` attribute against (ADR-0037). Like `scope` and
   * `grantGroupId` it rides the page this walk already fetches, so the pin here
   * is on the read, not on a request count — and paired, because a reader that
   * hard-coded `false` would satisfy half of it.
   */
  it('reads PROFILE_MASTERING off features without issuing a request per app', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(
      onePage([
        {
          id: '0oaFAKEapp000001',
          label: 'Workday',
          features: ['IMPORT_PROFILE_UPDATES', 'PROFILE_MASTERING', 'IMPORT_NEW_USERS'],
        },
        { id: '0oaFAKEapp000002', label: 'Salesforce', features: ['SSO', 'GROUP_PUSH'] },
        { id: '0oaFAKEapp000003', label: 'Slack' },
      ]),
    );
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    const { apps } = await getUserApps('00uFAKE0001');

    expect(apps.map((app) => app.isProfileSource)).toEqual([true, false, false]);
    expect(makeApiRequest).toHaveBeenCalledTimes(1);
  });

  it('leaves grantGroupId undefined when the embed carries no _links', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(
      onePage([
        {
          id: '0oaFAKEapp000001',
          label: 'One',
          _embedded: { user: { id: '00uFAKE0001', scope: 'GROUP' } },
        },
      ]),
    );
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    const { apps } = await getUserApps('00uFAKE0001');

    // Okta named no group. That is "unknown", never "assigned directly".
    expect(apps[0].grantGroupId).toBeUndefined();
    expect(apps[0].scope).toBe('GROUP');
  });

  it.each([
    ['a user id', '/api/v1/users/00uFAKE00000000000001'],
    ['a path-traversal href', 'https://example.okta.com/api/v1/groups/00gFAKE/../../../users/me'],
    ['a bare traversal', '../../etc/passwd'],
    ['an empty href', ''],
    ['a query string with no path segment', '?groupId=00gFAKEgroup00000001'],
    ['a too-short id', '/api/v1/groups/00gFAKE'],
  ])('keeps the app but reports no grant group for %s', async (_label, href) => {
    const makeApiRequest = vi.fn().mockResolvedValue(onePage([rowWithGroupHref(href)]));
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    const { apps, complete } = await getUserApps('00uFAKE0001');

    expect(apps).toHaveLength(1);
    expect(apps[0].id).toBe('0oaFAKEapp000001');
    expect(apps[0].grantGroupId).toBeUndefined();
    expect(complete).toBe(true);
  });

  it('keeps BOTH scope USER and grantGroupId — a direct assignment does not exclude a group path', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValue(
        onePage([rowWithGroupHref('/api/v1/groups/00gFAKEgroup00000001', 'USER')]),
      );
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    const { apps } = await getUserApps('00uFAKE0001');

    // Okta reports one scope and prefers USER; the group path is still real.
    expect(apps[0].scope).toBe('USER');
    expect(apps[0].grantGroupId).toBe('00gFAKEgroup00000001');
  });

  it('a malformed _links never drops the app (and never costs its scope)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const makeApiRequest = vi.fn().mockResolvedValue(
      onePage([
        {
          id: '0oaFAKEapp000001',
          label: 'One',
          _embedded: { user: { id: '00uFAKE0001', scope: 'USER', _links: 'nonsense' } },
        },
        {
          id: '0oaFAKEapp000002',
          label: 'Two',
          _embedded: { user: { id: '00uFAKE0001', scope: 'GROUP', _links: { group: 42 } } },
        },
      ]),
    );
    const { getUserApps } = createUserOperations(makeCore({ makeApiRequest }));

    const { apps, complete } = await getUserApps('00uFAKE0001');

    // Under-reporting access is the failure mode that matters: both rows survive.
    expect(apps).toEqual([
      {
        id: '0oaFAKEapp000001',
        label: 'One',
        scope: 'USER',
        grantGroupId: undefined,
        isProfileSource: false,
      },
      {
        id: '0oaFAKEapp000002',
        label: 'Two',
        scope: 'GROUP',
        grantGroupId: undefined,
        isProfileSource: false,
      },
    ]);
    expect(complete).toBe(true);
    vi.restoreAllMocks();
  });
});
