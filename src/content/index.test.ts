/**
 * Characterization tests for the Okta content script (`src/content/index.ts`).
 *
 * These pin behavior EXACTLY AS IT EXISTS TODAY — including quirks and bugs — so
 * the §7 decomposition has a safety net. Where a test looks like it encodes a bug,
 * it does: see the `BUG (pinned)` comments. Do not "fix" these expectations while
 * extracting modules; a behavior change must be its own reviewed commit.
 *
 * Harness notes:
 * - The content script registers its `chrome.runtime.onMessage` listener and mounts
 *   the indicator at IMPORT time, so every test re-imports it via `loadContentScript()`
 *   after `vi.resetModules()` and captures the listener from the addListener mock.
 * - Network is stubbed at `globalThis.fetch` rather than via MSW (a deviation from
 *   docs/testing.md). Reason: MSW has no `setupServer` anywhere in this repo today,
 *   and several load-bearing behaviors here are properties of the `RequestInit`
 *   (`credentials: 'include'`, `cache: 'no-store'`, `mode: 'cors'`, XSRF header
 *   presence-vs-absence) and of fetch rejecting outright — none of which are
 *   observable through an MSW handler.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { MessageRequest, MessageResponse, OktaUser } from '../shared/types';

// ============================================================================
// Harness
// ============================================================================

type Listener = (
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void,
) => unknown;

const ORIGIN = window.location.origin;

/** chrome.storage.local backed by a real Map so the cache actually caches. */
const store = new Map<string, unknown>();

const storageGet = vi.fn(async (keys: string[]) => {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (store.has(key)) out[key] = store.get(key);
  }
  return out;
});
const storageSet = vi.fn(async (items: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(items)) store.set(key, value);
});
const storageRemove = vi.fn(async (keys: string[]) => {
  for (const key of keys) store.delete(key);
});

const addListener = vi.fn();

let listener: Listener;

async function loadContentScript(): Promise<void> {
  vi.resetModules();
  addListener.mockClear();
  await import('./index');
  expect(addListener).toHaveBeenCalledTimes(1);
  listener = addListener.mock.calls[0][0] as Listener;
}

/**
 * Dispatch a message the way Chrome does. Returns the listener's SYNCHRONOUS
 * return value (must be `true`) plus a promise for the sendResponse payload.
 */
/** Deliberately widened so an unknown action can be dispatched (the default branch). */
type AnyRequest = Omit<Partial<MessageRequest>, 'action'> & { action: string };

function send(request: AnyRequest): {
  returned: unknown;
  response: Promise<MessageResponse>;
  sendResponse: Mock;
} {
  let resolve!: (value: MessageResponse) => void;
  const response = new Promise<MessageResponse>((r) => {
    resolve = r;
  });
  const sendResponse = vi.fn((value: MessageResponse) => resolve(value));
  const returned = listener(
    request as MessageRequest,
    { id: 'test-extension' } as chrome.runtime.MessageSender,
    sendResponse,
  );
  return { returned, response, sendResponse };
}

const fetchMock = globalThis.fetch as unknown as Mock;

/** Build a fetch Response double. Header keys go through a real Headers object. */
function res(
  body: unknown,
  opts: { status?: number; headers?: Record<string, string>; json?: boolean } = {},
): Response {
  const status = opts.status ?? 200;
  const headers = new Headers({
    ...(opts.json === false ? {} : { 'content-type': 'application/json' }),
    ...opts.headers,
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => body,
  } as unknown as Response;
}

/** A Response whose .json() rejects, to exercise the swallowed-parse-failure path. */
function badJsonRes(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => {
      throw new SyntaxError('Unexpected token');
    },
  } as unknown as Response;
}

/** Route fetch by pathname+search (the part after the origin). */
function routeFetch(routes: Array<[RegExp | string, () => Response | Promise<Response>]>): void {
  fetchMock.mockImplementation(async (url: string) => {
    const endpoint = String(url).replace(ORIGIN, '');
    for (const [pattern, respond] of routes) {
      const hit = typeof pattern === 'string' ? endpoint === pattern : pattern.test(endpoint);
      if (hit) return respond();
    }
    throw new Error(`Unrouted fetch: ${endpoint}`);
  });
}

/** Endpoints (origin-stripped) passed to fetch, in call order. */
function fetchedEndpoints(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]).replace(ORIGIN, ''));
}

function setPageUrl(path: string): void {
  window.history.replaceState({}, '', path);
}

const USER_ID = '00u1234567890abcdefg';
const GROUP_ID = '00g1234567890abcdefg';
const APP_ID = '0oa1234567890abcdefg';

function makeUser(overrides: Partial<OktaUser> = {}): OktaUser {
  return {
    id: USER_ID,
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
    ...overrides,
  } as OktaUser;
}

beforeEach(async () => {
  vi.clearAllMocks();
  store.clear();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  setPageUrl('/');

  globalThis.chrome = {
    runtime: {
      id: 'test-extension',
      onMessage: { addListener, removeListener: vi.fn() },
      sendMessage: vi.fn(),
      getURL: vi.fn((p: string) => `chrome-extension://mock-id/${p}`),
    },
    storage: {
      local: { get: storageGet, set: storageSet, remove: storageRemove },
    },
  } as any;

  fetchMock.mockReset();
  fetchMock.mockResolvedValue(res({}));

  await loadContentScript();
  // The import mounts the indicator; drop it so DOM-scrape tests start clean.
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================================
// 1. Router contract (the single most likely silent break)
// ============================================================================

describe('message router', () => {
  const allActions: Array<Partial<MessageRequest> & { action: string }> = [
    { action: 'getGroupInfo' },
    { action: 'getUserInfo' },
    { action: 'getAppInfo' },
    { action: 'makeApiRequest', endpoint: '/api/v1/users/me' },
    { action: 'getOktaOrigin' },
  ];

  it.each(allActions.map((r) => [r.action, r] as const))(
    'returns literal true synchronously for %s',
    async (_action, request) => {
      fetchMock.mockResolvedValue(res([]));
      // Anchors will be clicked by the export path; keep jsdom quiet.
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const { returned, response } = send(request);

      expect(returned).toBe(true);
      // Not merely truthy, and NOT a promise — MV3 closes the channel on a Promise.
      expect(returned).not.toBeInstanceOf(Promise);
      await response;
    },
  );

  it('ignores a message whose sender.id differs from chrome.runtime.id', () => {
    const sendResponse = vi.fn();
    // A foreign extension / web page sender must be dropped before any branch:
    // no sendResponse, and a synchronous `false` so the channel closes.
    const returned = listener(
      { action: 'getOktaOrigin' } as MessageRequest,
      { id: 'some-other-extension' } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(returned).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles a same-extension message normally (sender.id matches chrome.runtime.id)', () => {
    const sendResponse = vi.fn();
    const returned = listener(
      { action: 'getOktaOrigin' } as MessageRequest,
      { id: 'test-extension' } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(returned).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: ORIGIN });
  });

  it('returns true and reports Unknown action for an unrecognized action', async () => {
    const { returned, response, sendResponse } = send({ action: 'somethingElse' });

    expect(returned).toBe(true);
    expect(sendResponse).toHaveBeenCalledTimes(1);
    await expect(response).resolves.toEqual({ success: false, error: 'Unknown action' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls sendResponse exactly once with the handler result', async () => {
    const { response, sendResponse } = send({ action: 'getOktaOrigin' });
    await response;
    expect(sendResponse).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: ORIGIN });
  });

  it('getOktaOrigin answers synchronously without a fetch', () => {
    const { returned, sendResponse } = send({ action: 'getOktaOrigin' });
    expect(returned).toBe(true);
    // Already resolved before the listener returned — no await needed.
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: ORIGIN });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('missing-field guards', () => {
    const guards: Array<[string, Partial<MessageRequest> & { action: string }, string]> = [
      ['makeApiRequest without endpoint', { action: 'makeApiRequest' }, 'Missing endpoint'],
    ];

    it.each(guards)('%s short-circuits with the exact error', (_name, request, error) => {
      const { returned, sendResponse } = send(request);

      expect(returned).toBe(true);
      expect(sendResponse).toHaveBeenCalledTimes(1);
      expect(sendResponse).toHaveBeenCalledWith({ success: false, error });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// 2. makeApiRequest response-shape matrix
// ============================================================================

describe('makeApiRequest response shapes', () => {
  async function call(endpoint = '/api/v1/test', method?: string, body?: unknown) {
    const { response } = send({ action: 'makeApiRequest', endpoint, method, body });
    return response;
  }

  it('200 JSON → success with data, lowercase headers and status', async () => {
    fetchMock.mockResolvedValue(
      res({ hello: 'world' }, { headers: { 'X-Rate-Limit-Remaining': '99' } }),
    );

    const result = await call();

    expect(result).toEqual({
      success: true,
      data: { hello: 'world' },
      headers: expect.objectContaining({
        'content-type': 'application/json',
        'x-rate-limit-remaining': '99',
      }),
      status: 200,
    });
    // The background rateLimitDetector indexes lowercase keys — casing is load-bearing.
    expect(Object.keys(result.headers!)).toEqual(
      Object.keys(result.headers!).map((k) => k.toLowerCase()),
    );
  });

  it('200 non-JSON content-type → data stays null (body never read)', async () => {
    const response = res('<html/>', { json: false, headers: { 'content-type': 'text/html' } });
    const jsonSpy = vi.spyOn(response, 'json');
    fetchMock.mockResolvedValue(response);

    const result = await call();

    expect(result).toEqual({
      success: true,
      data: null,
      headers: expect.objectContaining({ 'content-type': 'text/html' }),
      status: 200,
    });
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('200 JSON that fails to parse → data null, still success (failure swallowed)', async () => {
    fetchMock.mockResolvedValue(badJsonRes(200));

    const result = await call();

    // BUG (pinned): a corrupt body is indistinguishable from an empty one.
    expect(result).toEqual({
      success: true,
      data: null,
      headers: expect.any(Object),
      status: 200,
    });
  });

  it('DELETE + ok → data null and the JSON parse is skipped entirely', async () => {
    const response = res({ should: 'not be read' });
    const jsonSpy = vi.spyOn(response, 'json');
    fetchMock.mockResolvedValue(response);

    const result = await call('/api/v1/groups/x/users/y', 'DELETE');

    expect(result).toEqual({ success: true, data: null, headers: expect.any(Object), status: 200 });
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('DELETE + non-ok → falls through to the normal error path (no short-circuit)', async () => {
    fetchMock.mockResolvedValue(res({ errorSummary: 'Nope' }, { status: 404 }));

    const result = await call('/api/v1/groups/x/users/y', 'DELETE');

    expect(result).toEqual({
      success: false,
      error: 'Nope',
      status: 404,
      data: { errorSummary: 'Nope' },
    });
  });

  it('4xx with errorSummary → errorSummary wins', async () => {
    fetchMock.mockResolvedValue(
      res({ errorSummary: 'Not found', message: 'ignored' }, { status: 404 }),
    );

    await expect(call()).resolves.toEqual({
      success: false,
      error: 'Not found',
      status: 404,
      data: { errorSummary: 'Not found', message: 'ignored' },
    });
  });

  it('4xx with only message → message is used', async () => {
    fetchMock.mockResolvedValue(res({ message: 'Bad thing' }, { status: 400 }));

    await expect(call()).resolves.toMatchObject({
      success: false,
      error: 'Bad thing',
      status: 400,
    });
  });

  it('4xx with neither → "Request failed with status N"', async () => {
    fetchMock.mockResolvedValue(res({}, { status: 429 }));

    await expect(call()).resolves.toEqual({
      success: false,
      error: 'Request failed with status 429',
      status: 429,
      data: {},
    });
  });

  it('non-ok response omits headers entirely — the scheduler cannot read rate-limit headers on 429', async () => {
    fetchMock.mockResolvedValue(
      res({}, { status: 429, headers: { 'x-rate-limit-reset': '1700000000' } }),
    );

    const result = await call();

    // BUG (pinned): headers ARE collected but not returned on the error path.
    expect(result).not.toHaveProperty('headers');
    expect(result.status).toBe(429);
  });

  it('fetch rejects → success:false with the message, and NO status, NO headers, NO data', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await call();

    expect(result).toEqual({ success: false, error: 'Failed to fetch' });
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('headers');
    expect(result).not.toHaveProperty('data');
  });

  it('fetch rejects with a non-Error → "Unknown error"', async () => {
    fetchMock.mockRejectedValue('a string');

    await expect(call()).resolves.toEqual({ success: false, error: 'Unknown error' });
  });
});

// ============================================================================
// 3. Request construction
// ============================================================================

describe('makeApiRequest request construction', () => {
  function lastInit(): RequestInit {
    return fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1] as RequestInit;
  }

  it('builds url as origin + endpoint with the fixed RequestInit options', async () => {
    fetchMock.mockResolvedValue(res({}));

    const { response } = send({ action: 'makeApiRequest', endpoint: '/api/v1/users?limit=20' });
    await response;

    expect(fetchMock.mock.calls[0][0]).toBe(`${ORIGIN}/api/v1/users?limit=20`);
    expect(lastInit()).toMatchObject({
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      mode: 'cors',
      redirect: 'follow',
    });
  });

  it('defaults method to GET when the request omits it', async () => {
    fetchMock.mockResolvedValue(res({}));
    const { response } = send({ action: 'makeApiRequest', endpoint: '/api/v1/x' });
    await response;
    expect(lastInit().method).toBe('GET');
  });

  it('includes X-Okta-Xsrftoken when #_xsrfToken has text', async () => {
    document.body.innerHTML = '<span id="_xsrfToken">tok-abc-123</span>';
    fetchMock.mockResolvedValue(res({}));

    const { response } = send({ action: 'makeApiRequest', endpoint: '/api/v1/x' });
    await response;

    expect(lastInit().headers).toMatchObject({
      'X-Okta-Xsrftoken': 'tok-abc-123',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store',
      'X-Requested-With': 'XMLHttpRequest',
    });
  });

  it('OMITS the XSRF header (key absent, not empty string) when the element is missing', async () => {
    fetchMock.mockResolvedValue(res({}));

    const { response } = send({ action: 'makeApiRequest', endpoint: '/api/v1/x' });
    await response;

    expect(lastInit().headers).not.toHaveProperty('X-Okta-Xsrftoken');
  });

  it('OMITS the XSRF header when #_xsrfToken exists but is empty', async () => {
    document.body.innerHTML = '<span id="_xsrfToken"></span>';
    fetchMock.mockResolvedValue(res({}));

    const { response } = send({ action: 'makeApiRequest', endpoint: '/api/v1/x' });
    await response;

    expect(lastInit().headers).not.toHaveProperty('X-Okta-Xsrftoken');
  });

  it('serializes the body only when method !== GET', async () => {
    fetchMock.mockResolvedValue(res({}));

    const post = send({
      action: 'makeApiRequest',
      endpoint: '/api/v1/x',
      method: 'POST',
      body: { a: 1 },
    });
    await post.response;
    expect(lastInit().body).toBe('{"a":1}');

    const get = send({ action: 'makeApiRequest', endpoint: '/api/v1/x', body: { a: 1 } });
    await get.response;
    // BUG (pinned): a body on a GET is silently dropped.
    expect(lastInit().body).toBeUndefined();
  });

  it('never passes the XSRF token or a request/response body to the logger', async () => {
    document.body.innerHTML = '<span id="_xsrfToken">super-secret-token</span>';
    fetchMock.mockResolvedValue(res({ ssn: '123-45-6789' }));
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { response } = send({
      action: 'makeApiRequest',
      endpoint: '/api/v1/x',
      method: 'POST',
      body: { password: 'hunter2' },
    });
    await response;

    const logged = [...debug.mock.calls, ...info.mock.calls, ...logSpy.mock.calls]
      .flat()
      .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');
    expect(logged).not.toContain('super-secret-token');
    expect(logged).not.toContain('hunter2');
    expect(logged).not.toContain('123-45-6789');
  });
});

// ============================================================================
// 7. Page-context handlers: precedence + degrade paths
// ============================================================================

describe('getGroupInfo', () => {
  it('is scrape-first: a page name means zero API calls', async () => {
    setPageUrl(`/admin/group/${GROUP_ID}`);
    document.body.innerHTML = '<h1 data-se="group-name"> Engineering </h1>';

    const { response } = send({ action: 'getGroupInfo' });

    await expect(response).resolves.toEqual({
      success: true,
      data: { groupId: GROUP_ID, groupName: 'Engineering' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the API when the page has no name', async () => {
    setPageUrl(`/admin/group/${GROUP_ID}`);
    routeFetch([
      [
        `/api/v1/groups/${GROUP_ID}`,
        () => res({ id: GROUP_ID, type: 'OKTA_GROUP', profile: { name: 'From API' } }),
      ],
    ]);

    await expect(send({ action: 'getGroupInfo' }).response).resolves.toEqual({
      success: true,
      data: { groupId: GROUP_ID, groupName: 'From API' },
    });
    expect(fetchedEndpoints()).toEqual([`/api/v1/groups/${GROUP_ID}`]);
  });

  it('degrades to "Unknown" (success:true) when the API payload fails the zod schema', async () => {
    setPageUrl(`/admin/group/${GROUP_ID}`);
    routeFetch([[`/api/v1/groups/${GROUP_ID}`, () => res({ nope: true })]]);

    await expect(send({ action: 'getGroupInfo' }).response).resolves.toEqual({
      success: true,
      data: { groupId: GROUP_ID, groupName: 'Unknown' },
    });
  });

  it('degrades to "Unknown" when the API call itself fails (success:false is silently ignored)', async () => {
    setPageUrl(`/admin/group/${GROUP_ID}`);
    routeFetch([[`/api/v1/groups/${GROUP_ID}`, () => res({}, { status: 500 })]]);

    await expect(send({ action: 'getGroupInfo' }).response).resolves.toEqual({
      success: true,
      data: { groupId: GROUP_ID, groupName: 'Unknown' },
    });
  });

  it('errors when not on a group page', async () => {
    setPageUrl('/admin/dashboard');

    await expect(send({ action: 'getGroupInfo' }).response).resolves.toEqual({
      success: false,
      error: 'Not on a group page. Please navigate to a specific group page.',
    });
  });

  it('scrape selector precedence: data-se="group-name" beats .content-container h1', async () => {
    setPageUrl(`/admin/group/${GROUP_ID}`);
    document.body.innerHTML =
      '<div class="content-container"><h1>Lower Priority</h1></div><h1 data-se="group-name">Winner</h1>';

    await expect(send({ action: 'getGroupInfo' }).response).resolves.toMatchObject({
      data: { groupName: 'Winner' },
    });
  });

  it('an empty matched element short-circuits the selector loop and forces the API fallback', async () => {
    setPageUrl(`/admin/group/${GROUP_ID}`);
    // BUG (pinned): the group scraper returns null on the FIRST match even if blank,
    // never trying later selectors — unlike the user/app scrapers which continue.
    document.body.innerHTML =
      '<h1 data-se="group-name">   </h1><div class="content-container"><h1>Would Have Matched</h1></div>';
    routeFetch([
      [
        `/api/v1/groups/${GROUP_ID}`,
        () => res({ id: GROUP_ID, type: 'OKTA_GROUP', profile: { name: 'API Name' } }),
      ],
    ]);

    await expect(send({ action: 'getGroupInfo' }).response).resolves.toMatchObject({
      data: { groupName: 'API Name' },
    });
  });

  it('the /groups/(id) pattern over-matches: /api/v1/groups/rules yields groupId "rules"', async () => {
    setPageUrl('/api/v1/groups/rules');
    // BUG (pinned): extractGroupIdFromUrl does not validate the 00g prefix.
    routeFetch([['/api/v1/groups/rules', () => res({}, { status: 404 })]]);

    await expect(send({ action: 'getGroupInfo' }).response).resolves.toEqual({
      success: true,
      data: { groupId: 'rules', groupName: 'Unknown' },
    });
  });

  it('/admin/group/{id} takes precedence over the generic /groups/{id} pattern', async () => {
    setPageUrl(`/admin/group/${GROUP_ID}/groups/00gOTHER`);
    document.body.innerHTML = '<h1 data-se="group-name">X</h1>';

    await expect(send({ action: 'getGroupInfo' }).response).resolves.toMatchObject({
      data: { groupId: GROUP_ID },
    });
  });
});

describe('getUserInfo', () => {
  it('is API-first: the page scraper is never consulted when the API returns a name', async () => {
    setPageUrl(`/admin/user/profile/view/${USER_ID}`);
    document.body.innerHTML = '<div class="subheader-fullname">Scraped Name</div>';
    routeFetch([[`/api/v1/users/${USER_ID}`, () => res(makeUser())]]);

    await expect(send({ action: 'getUserInfo' }).response).resolves.toEqual({
      success: true,
      data: {
        userId: USER_ID,
        userName: 'Ada Lovelace',
        userEmail: 'ada@example.com',
        userStatus: 'ACTIVE',
      },
    });
  });

  it('a zod failure drops email and status too, not just the name', async () => {
    setPageUrl(`/admin/user/profile/view/${USER_ID}`);
    document.body.innerHTML = '<div class="subheader-fullname">Scraped Name</div>';
    // status is not in the enum → whole parse throws
    routeFetch([
      [
        `/api/v1/users/${USER_ID}`,
        () =>
          res({
            id: USER_ID,
            status: 'BOGUS',
            profile: { login: 'a', email: 'a@b.c', firstName: 'A', lastName: 'B' },
          }),
      ],
    ]);

    await expect(send({ action: 'getUserInfo' }).response).resolves.toEqual({
      success: true,
      data: {
        userId: USER_ID,
        userName: 'Scraped Name',
        userEmail: undefined,
        userStatus: undefined,
      },
    });
  });

  it('empty first+last name falls through to the scraper but keeps the API email/status', async () => {
    setPageUrl(`/admin/user/profile/view/${USER_ID}`);
    document.body.innerHTML = '<div class="subheader-fullname">Scraped Name</div>';
    routeFetch([
      [
        `/api/v1/users/${USER_ID}`,
        () =>
          res(
            makeUser({
              profile: { login: 'a@b.c', email: 'a@b.c', firstName: '', lastName: '' },
            } as Partial<OktaUser>),
          ),
      ],
    ]);

    // BUG-ADJACENT (pinned): `${''} ${''}`.trim() === '' is falsy → scrape fallback.
    await expect(send({ action: 'getUserInfo' }).response).resolves.toEqual({
      success: true,
      data: {
        userId: USER_ID,
        userName: 'Scraped Name',
        userEmail: 'a@b.c',
        userStatus: 'ACTIVE',
      },
    });
  });

  it('only a firstName still counts as a name (trimmed, no scrape)', async () => {
    setPageUrl(`/admin/user/profile/view/${USER_ID}`);
    document.body.innerHTML = '<div class="subheader-fullname">Scraped Name</div>';
    routeFetch([
      [
        `/api/v1/users/${USER_ID}`,
        () =>
          res(
            makeUser({
              profile: { login: 'a@b.c', email: 'a@b.c', firstName: 'Ada', lastName: '' },
            } as Partial<OktaUser>),
          ),
      ],
    ]);

    await expect(send({ action: 'getUserInfo' }).response).resolves.toMatchObject({
      data: { userName: 'Ada' },
    });
  });

  it('API failure plus no page name → "Unknown" with success:true', async () => {
    setPageUrl(`/admin/user/profile/view/${USER_ID}`);
    routeFetch([[`/api/v1/users/${USER_ID}`, () => res({}, { status: 500 })]]);

    await expect(send({ action: 'getUserInfo' }).response).resolves.toEqual({
      success: true,
      data: { userId: USER_ID, userName: 'Unknown', userEmail: undefined, userStatus: undefined },
    });
  });

  it('errors when not on a user page', async () => {
    setPageUrl('/admin/dashboard');

    await expect(send({ action: 'getUserInfo' }).response).resolves.toEqual({
      success: false,
      error: 'Not on a user page. Please navigate to a specific user page.',
    });
  });

  it('skips denylisted generic scrape text and continues to the next selector', async () => {
    setPageUrl(`/admin/user/profile/view/${USER_ID}`);
    document.body.innerHTML =
      '<div class="subheader-fullname">User Profile</div><main><h1>Real Name</h1></main>';
    routeFetch([[`/api/v1/users/${USER_ID}`, () => res({}, { status: 500 })]]);

    await expect(send({ action: 'getUserInfo' }).response).resolves.toMatchObject({
      data: { userName: 'Real Name' },
    });
  });

  it('skips the /users/{id} keyword denylist (e.g. /users/search)', async () => {
    setPageUrl('/users/search');
    // 'search' is denylisted, and no later pattern matches → not a user page.
    await expect(send({ action: 'getUserInfo' }).response).resolves.toMatchObject({
      success: false,
    });
  });

  it('accepts a non-Okta-shaped id from ?userId= (no prefix validation)', async () => {
    setPageUrl('/admin/whatever?userId=abc123');
    // BUG (pinned): no 00u prefix check — the extractor is deliberately loose.
    routeFetch([['/api/v1/users/abc123', () => res({}, { status: 404 })]]);

    await expect(send({ action: 'getUserInfo' }).response).resolves.toMatchObject({
      data: { userId: 'abc123' },
    });
  });
});

describe('getAppInfo', () => {
  it('is page-WINS: a scraped name beats the API name (opposite of getUserInfo)', async () => {
    setPageUrl(`/admin/app/${APP_ID}`);
    document.body.innerHTML = '<span data-se="app-name">Page App</span>';
    routeFetch([[`/api/v1/apps/${APP_ID}`, () => res({ name: 'api_app', label: 'API Label' })]]);

    await expect(send({ action: 'getAppInfo' }).response).resolves.toEqual({
      success: true,
      data: { appId: APP_ID, appName: 'Page App', appLabel: 'API Label' },
    });
    // The API is still called even though the page already won.
    expect(fetchedEndpoints()).toEqual([`/api/v1/apps/${APP_ID}`]);
  });

  it('falls back to the API name, then label, then "Unknown" (no zod validation here)', async () => {
    setPageUrl(`/admin/app/${APP_ID}`);
    routeFetch([[`/api/v1/apps/${APP_ID}`, () => res({ label: 'Only Label' })]]);

    await expect(send({ action: 'getAppInfo' }).response).resolves.toEqual({
      success: true,
      data: { appId: APP_ID, appName: 'Only Label', appLabel: 'Only Label' },
    });
  });

  it('API success with an empty payload → appName "Unknown"', async () => {
    setPageUrl(`/admin/app/${APP_ID}`);
    routeFetch([[`/api/v1/apps/${APP_ID}`, () => res({ unrelated: 1 })]]);

    await expect(send({ action: 'getAppInfo' }).response).resolves.toEqual({
      success: true,
      data: { appId: APP_ID, appName: 'Unknown', appLabel: undefined },
    });
  });

  it('errors when not on an app page', async () => {
    setPageUrl('/admin/dashboard');

    await expect(send({ action: 'getAppInfo' }).response).resolves.toEqual({
      success: false,
      error: 'Not on an app page. Please navigate to a specific app page.',
    });
  });

  it('rejects a short non-0oa segment: /admin/app/salesforce/instance/{id} finds NO app id', async () => {
    setPageUrl(`/admin/app/salesforce/instance/${APP_ID}`);
    // BUG (pinned): the instance pattern captures the app *name* in group 1 and the
    // real 0oa id in group 2, which is never read — so a real Okta app-instance URL
    // yields "Not on an app page".
    await expect(send({ action: 'getAppInfo' }).response).resolves.toEqual({
      success: false,
      error: 'Not on an app page. Please navigate to a specific app page.',
    });
  });

  it('accepts any segment >= 18 chars even without the 0oa prefix', async () => {
    const loose = 'abcdefghijklmnopqrstuv';
    setPageUrl(`/admin/apps/${loose}`);
    routeFetch([[`/api/v1/apps/${loose}`, () => res({ name: 'Loose' })]]);

    await expect(send({ action: 'getAppInfo' }).response).resolves.toMatchObject({
      data: { appId: loose, appName: 'Loose' },
    });
  });
});

// ============================================================================
// 16. Bootstrap: listener registration order + indicator lifecycle
// ============================================================================

describe('bootstrap', () => {
  it('registers the message listener exactly once, before touching the DOM', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    addListener.mockClear();
    appendSpy.mockClear();

    vi.resetModules();
    await import('./index');

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalled();
    expect(addListener.mock.invocationCallOrder[0]).toBeLessThan(
      appendSpy.mock.invocationCallOrder[0],
    );
    appendSpy.mockRestore();
  });

  it('injects the indicator immediately when the DOM is already loaded', async () => {
    document.body.innerHTML = '';
    vi.resetModules();
    await import('./index');

    const indicator = document.getElementById('okta-extension-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator!.textContent).toBe('Okta Unbound Active');
  });

  it('waits for DOMContentLoaded when readyState is "loading"', async () => {
    document.body.innerHTML = '';
    const spy = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');

    vi.resetModules();
    await import('./index');

    expect(document.getElementById('okta-extension-indicator')).toBeNull();

    spy.mockRestore();
    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(document.getElementById('okta-extension-indicator')).not.toBeNull();
  });

  it('fades after 3000ms then removes itself 300ms later', async () => {
    document.body.innerHTML = '';
    vi.useFakeTimers();

    vi.resetModules();
    await import('./index');

    const indicator = document.getElementById('okta-extension-indicator')!;
    expect(indicator.style.opacity).toBe('');

    vi.advanceTimersByTime(2999);
    expect(document.getElementById('okta-extension-indicator')).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(indicator.style.opacity).toBe('0');
    expect(indicator.style.transition).toBe('opacity 0.3s');
    expect(document.getElementById('okta-extension-indicator')).not.toBeNull();

    vi.advanceTimersByTime(299);
    expect(document.getElementById('okta-extension-indicator')).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(document.getElementById('okta-extension-indicator')).toBeNull();
  });

  it('the indicator carries raw hex styling (ADR exception pending — see plan §7 blockers)', async () => {
    document.body.innerHTML = '';
    vi.resetModules();
    await import('./index');

    const indicator = document.getElementById('okta-extension-indicator')!;
    // Pinned so the extraction to content/ui/indicator.ts is provably byte-faithful.
    expect(indicator.style.position).toBe('fixed');
    expect(indicator.style.zIndex).toBe('999999');
    expect(indicator.style.cssText).toContain('rgb(26, 26, 26)');
  });
});
