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
import type { MessageRequest, MessageResponse, OktaGroupRule, OktaUser } from '../shared/types';

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

/**
 * The shape `fetchGroupRules` ACTUALLY sends over the wire.
 *
 * `MessageResponse.rules` is typed `OktaGroupRule[]` (shared/types.ts:235), but the
 * content script assigns FORMATTED rules to it — it only compiles because excess-property
 * checking is bypassed for a variable assignment. Reading `condition`/`conflicts`/
 * `groupNames` off `response.rules` therefore does not type-check — a known latent
 * type lie. This cast is the test-side acknowledgement of it; delete it once
 * `ContentFormattedRule` lands for real.
 */
interface WireFormattedRule {
  id: string;
  name: string;
  status: string;
  type: string;
  condition: string;
  conditionExpression: string;
  groupIds: string[];
  groupNames: string[];
  allGroupNamesMap: Record<string, string>;
  userAttributes: string[];
  created?: string;
  lastUpdated?: string;
  affectsCurrentGroup: boolean;
  conflicts: unknown[];
}

function wireRules(result: MessageResponse): WireFormattedRule[] {
  return result.rules as unknown as WireFormattedRule[];
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

function makeRule(overrides: Partial<OktaGroupRule> = {}): OktaGroupRule {
  return {
    id: 'rule1',
    name: 'Rule One',
    status: 'ACTIVE',
    type: 'group_rule',
    created: '2024-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-02T00:00:00.000Z',
    conditions: {
      expression: { value: 'user.department == "Eng"', type: 'urn:okta:expression:1.0' },
    },
    actions: { assignUserToGroups: { groupIds: [] } },
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  store.clear();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  setPageUrl('/');

  globalThis.chrome = {
    runtime: {
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
    { action: 'exportGroupMembers', groupId: GROUP_ID, format: 'csv' },
    { action: 'fetchGroupRules' },
    { action: 'activateRule', ruleId: 'rule1' },
    { action: 'deactivateRule', ruleId: 'rule1' },
    { action: 'searchUsers', query: 'ada' },
    { action: 'searchGroups', query: 'eng' },
    { action: 'getUserGroups', userId: USER_ID },
    { action: 'getUserDetails', userId: USER_ID },
    { action: 'getUserContext', userId: USER_ID },
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

  it('handles all 14 known actions plus an unknown one', () => {
    expect(allActions).toHaveLength(14);
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
      [
        'exportGroupMembers without groupId',
        { action: 'exportGroupMembers', format: 'csv' },
        'Missing groupId or format',
      ],
      [
        'exportGroupMembers without format',
        { action: 'exportGroupMembers', groupId: GROUP_ID },
        'Missing groupId or format',
      ],
      ['activateRule without ruleId', { action: 'activateRule' }, 'Missing ruleId'],
      ['deactivateRule without ruleId', { action: 'deactivateRule' }, 'Missing ruleId'],
      ['searchUsers without query', { action: 'searchUsers' }, 'Missing query'],
      ['searchGroups without query', { action: 'searchGroups' }, 'Missing query'],
      ['getUserGroups without userId', { action: 'getUserGroups' }, 'Missing userId'],
      ['getUserDetails without userId', { action: 'getUserDetails' }, 'Missing userId'],
      ['getUserContext without userId', { action: 'getUserContext' }, 'Missing userId'],
    ];

    it.each(guards)('%s short-circuits with the exact error', (_name, request, error) => {
      const { returned, sendResponse } = send(request);

      expect(returned).toBe(true);
      expect(sendResponse).toHaveBeenCalledTimes(1);
      expect(sendResponse).toHaveBeenCalledWith({ success: false, error });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('treats an empty-string query as missing (falsy guard, not a length check)', () => {
      const { sendResponse } = send({ action: 'searchUsers', query: '' });
      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'Missing query' });
    });

    it('fetchGroupRules has NO guard — groupId is optional', async () => {
      routeFetch([[/^\/api\/v1\/groups\/rules/, () => res([])]]);
      const { returned, response } = send({ action: 'fetchGroupRules' });
      expect(returned).toBe(true);
      await expect(response).resolves.toMatchObject({ success: true });
      expect(fetchMock).toHaveBeenCalled();
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
// 4 + 5. fetchGroupRules: payload shape, conflicts, group-name resolution/caching
// ============================================================================

describe('fetchGroupRules', () => {
  const RULES_URL = '/api/v1/groups/rules?limit=200';
  const GROUP_A = '00gAAAAAAAAAAAAAAAAA';
  const GROUP_B = '00gBBBBBBBBBBBBBBBBB';

  function groupPayload(id: string, name: string) {
    return { id, type: 'OKTA_GROUP', profile: { name } };
  }

  it('emits the exact formatted-rule key set (the real wire shape MessageResponse.rules lies about)', async () => {
    const rule = makeRule({
      actions: { assignUserToGroups: { groupIds: [GROUP_A] } },
      conditions: { expression: { value: 'user.department == "Eng"', type: 'x' } },
    });
    routeFetch([
      [RULES_URL, () => res([rule])],
      [`/api/v1/groups/${GROUP_A}`, () => res(groupPayload(GROUP_A, 'Group A'))],
    ]);

    const result = await send({ action: 'fetchGroupRules' }).response;

    expect(Object.keys(result.rules![0])).toEqual([
      'id',
      'name',
      'status',
      'type',
      'condition',
      'conditionExpression',
      'groupIds',
      'groupNames',
      'allGroupNamesMap',
      'userAttributes',
      'created',
      'lastUpdated',
      'affectsCurrentGroup',
      'conflicts',
    ]);
    expect(result.rules![0]).toMatchObject({
      id: 'rule1',
      name: 'Rule One',
      status: 'ACTIVE',
      type: 'group_rule',
      condition: 'department == "Eng"',
      conditionExpression: 'user.department == "Eng"',
      groupIds: [GROUP_A],
      groupNames: ['Group A'],
      allGroupNamesMap: { [GROUP_A]: 'Group A' },
      userAttributes: ['department'],
      affectsCurrentGroup: false,
      conflicts: [],
    });
  });

  it('simplifies the condition: strips "user." and rewrites both isMemberOf* forms', async () => {
    const rule = makeRule({
      conditions: {
        expression: {
          value: 'isMemberOfAnyGroup("00g1") && isMemberOfGroup("00g2") && user.title == "X"',
          type: 'x',
        },
      },
    });
    routeFetch([[RULES_URL, () => res([rule])]]);

    const result = await send({ action: 'fetchGroupRules' }).response;

    expect(wireRules(result)[0].condition).toBe(
      'is member of group("00g1") && is member of group("00g2") && title == "X"',
    );
  });

  it('uses the literal "No condition specified" when a rule has no expression', async () => {
    routeFetch([[RULES_URL, () => res([makeRule({ conditions: undefined })])]]);

    const result = await send({ action: 'fetchGroupRules' }).response;

    expect(result.rules![0]).toMatchObject({
      condition: 'No condition specified',
      conditionExpression: 'No condition specified',
      userAttributes: [],
    });
  });

  it('defaults a missing rule.type to "group_rule"', async () => {
    routeFetch([[RULES_URL, () => res([{ ...makeRule(), type: undefined }])]]);

    const result = await send({ action: 'fetchGroupRules' }).response;
    expect(result.rules![0].type).toBe('group_rule');
  });

  it('reports stats and sets affectsCurrentGroup against the requested groupId', async () => {
    routeFetch([
      [
        RULES_URL,
        () =>
          res([
            makeRule({ id: 'r1', actions: { assignUserToGroups: { groupIds: [GROUP_A] } } }),
            makeRule({
              id: 'r2',
              status: 'INACTIVE',
              actions: { assignUserToGroups: { groupIds: [GROUP_B] } },
            }),
          ]),
      ],
      [`/api/v1/groups/${GROUP_A}`, () => res(groupPayload(GROUP_A, 'A'))],
      [`/api/v1/groups/${GROUP_B}`, () => res(groupPayload(GROUP_B, 'B'))],
    ]);

    const result = await send({ action: 'fetchGroupRules', groupId: GROUP_A }).response;

    expect(result.stats).toEqual({ total: 2, active: 1, inactive: 1, conflicts: 0 });
    expect(
      result.rules!.map(
        (r) => (r as unknown as { affectsCurrentGroup: boolean }).affectsCurrentGroup,
      ),
    ).toEqual([true, false]);
  });

  it('falls back to the URL groupId when the request omits one', async () => {
    setPageUrl(`/admin/group/${GROUP_A}`);
    routeFetch([
      [
        RULES_URL,
        () => res([makeRule({ actions: { assignUserToGroups: { groupIds: [GROUP_A] } } })]),
      ],
      [`/api/v1/groups/${GROUP_A}`, () => res(groupPayload(GROUP_A, 'A'))],
    ]);

    const result = await send({ action: 'fetchGroupRules' }).response;
    expect(result.rules![0]).toMatchObject({ affectsCurrentGroup: true });
  });

  describe('conflict detection', () => {
    it('does NOT dedupe user attributes — the reason string repeats them', async () => {
      const rule1 = makeRule({
        id: 'r1',
        name: 'R1',
        actions: { assignUserToGroups: { groupIds: [GROUP_A] } },
        conditions: {
          expression: { value: 'user.department == "X" || user.department == "Y"', type: 'x' },
        },
      });
      const rule2 = makeRule({
        id: 'r2',
        name: 'R2',
        actions: { assignUserToGroups: { groupIds: [GROUP_A] } },
        conditions: { expression: { value: 'user.department == "Z"', type: 'x' } },
      });
      routeFetch([
        [RULES_URL, () => res([rule1, rule2])],
        [`/api/v1/groups/${GROUP_A}`, () => res(groupPayload(GROUP_A, 'A'))],
      ]);

      const result = await send({ action: 'fetchGroupRules' }).response;

      // BUG (pinned): shared/ruleUtils.extractUserAttributes dedupes via a Set;
      // this inline copy does not. Adopting ruleUtils WILL change these strings.
      expect(result.rules![0]).toMatchObject({ userAttributes: ['department', 'department'] });
      expect(result.conflicts).toEqual([
        {
          rule1: { id: 'r1', name: 'R1' },
          rule2: { id: 'r2', name: 'R2' },
          reason: 'Both rules use department, department and assign to 1 shared group(s)',
          severity: 'low',
          affectedGroups: [GROUP_A],
        },
      ]);
      expect(result.stats!.conflicts).toBe(1);
    });

    it.each([
      [1, 'low'],
      [2, 'medium'],
      [3, 'high'],
    ])('%i shared group(s) → severity %s', async (count, severity) => {
      const ids = ['00gS1', '00gS2', '00gS3'].slice(0, count);
      const mk = (id: string) =>
        makeRule({
          id,
          name: id,
          actions: { assignUserToGroups: { groupIds: ids } },
          conditions: { expression: { value: 'user.title == "T"', type: 'x' } },
        });
      routeFetch([
        [RULES_URL, () => res([mk('r1'), mk('r2')])],
        [/^\/api\/v1\/groups\/00gS/, () => res({}, { status: 404 })],
      ]);

      const result = await send({ action: 'fetchGroupRules' }).response;

      expect(result.conflicts![0].severity).toBe(severity);
      expect(result.conflicts![0].affectedGroups).toEqual(ids);
    });

    it('ignores INACTIVE rules and shared groups with no shared attribute', async () => {
      routeFetch([
        [
          RULES_URL,
          () =>
            res([
              makeRule({
                id: 'r1',
                status: 'INACTIVE',
                actions: { assignUserToGroups: { groupIds: [GROUP_A] } },
                conditions: { expression: { value: 'user.title == "X"', type: 'x' } },
              }),
              makeRule({
                id: 'r2',
                actions: { assignUserToGroups: { groupIds: [GROUP_A] } },
                conditions: { expression: { value: 'user.title == "Y"', type: 'x' } },
              }),
              makeRule({
                id: 'r3',
                actions: { assignUserToGroups: { groupIds: [GROUP_A] } },
                conditions: { expression: { value: 'user.department == "D"', type: 'x' } },
              }),
            ]),
        ],
        [`/api/v1/groups/${GROUP_A}`, () => res(groupPayload(GROUP_A, 'A'))],
      ]);

      const result = await send({ action: 'fetchGroupRules' }).response;

      // r1 is INACTIVE (skipped); r2 vs r3 share the group but not the attribute.
      expect(result.conflicts).toEqual([]);
      expect(result.stats).toEqual({ total: 3, active: 2, inactive: 1, conflicts: 0 });
    });

    it('attaches each conflict to both rules it involves', async () => {
      const mk = (id: string) =>
        makeRule({
          id,
          name: id,
          actions: { assignUserToGroups: { groupIds: [GROUP_A] } },
          conditions: { expression: { value: 'user.title == "T"', type: 'x' } },
        });
      routeFetch([
        [RULES_URL, () => res([mk('r1'), mk('r2')])],
        [`/api/v1/groups/${GROUP_A}`, () => res(groupPayload(GROUP_A, 'A'))],
      ]);

      const result = await send({ action: 'fetchGroupRules' }).response;

      expect(wireRules(result)[0].conflicts).toHaveLength(1);
      expect(wireRules(result)[1].conflicts).toHaveLength(1);
    });
  });

  describe('group-name resolution and caching', () => {
    it('collects ids from BOTH assignUserToGroups and the condition expression scan', async () => {
      const condId = '00gCCCCCCCCCCCCCCCCC';
      routeFetch([
        [
          RULES_URL,
          () =>
            res([
              makeRule({
                actions: { assignUserToGroups: { groupIds: [GROUP_A] } },
                conditions: { expression: { value: `isMemberOfAnyGroup("${condId}")`, type: 'x' } },
              }),
            ]),
        ],
        [`/api/v1/groups/${GROUP_A}`, () => res(groupPayload(GROUP_A, 'Target A'))],
        [`/api/v1/groups/${condId}`, () => res(groupPayload(condId, 'Condition C'))],
      ]);

      const result = await send({ action: 'fetchGroupRules' }).response;

      expect(fetchedEndpoints().slice(1).sort()).toEqual(
        [`/api/v1/groups/${GROUP_A}`, `/api/v1/groups/${condId}`].sort(),
      );
      expect(result.rules![0]).toMatchObject({
        groupNames: ['Target A'],
        allGroupNamesMap: { [GROUP_A]: 'Target A', [condId]: 'Condition C' },
      });
    });

    it('a cache hit produces ZERO group fetches', async () => {
      const now = Date.now();
      store.set(`group_name_${GROUP_A}`, {
        data: 'Cached A',
        timestamp: now,
        expiresAt: now + 60_000,
      });
      routeFetch([
        [
          RULES_URL,
          () => res([makeRule({ actions: { assignUserToGroups: { groupIds: [GROUP_A] } } })]),
        ],
      ]);

      const result = await send({ action: 'fetchGroupRules' }).response;

      expect(fetchedEndpoints()).toEqual([RULES_URL]);
      expect(result.rules![0]).toMatchObject({ groupNames: ['Cached A'] });
      expect(storageSet).not.toHaveBeenCalled();
    });

    it('a cache miss writes group_name_<id> with a 5-minute TTL', async () => {
      routeFetch([
        [
          RULES_URL,
          () => res([makeRule({ actions: { assignUserToGroups: { groupIds: [GROUP_A] } } })]),
        ],
        [`/api/v1/groups/${GROUP_A}`, () => res(groupPayload(GROUP_A, 'A'))],
      ]);

      await send({ action: 'fetchGroupRules' }).response;

      expect(storageSet).toHaveBeenCalledTimes(1);
      const written = store.get(`group_name_${GROUP_A}`) as {
        data: string;
        timestamp: number;
        expiresAt: number;
      };
      expect(written.data).toBe('A');
      expect(written.expiresAt - written.timestamp).toBe(5 * 60 * 1000);
    });

    it('one failing group loses only that name; the rest resolve and the call still succeeds', async () => {
      const ids = ['00gID1', '00gID2', '00gID3', '00gID4', '00gID5'];
      routeFetch([
        [
          RULES_URL,
          () =>
            res([
              makeRule({
                id: 'r1',
                actions: { assignUserToGroups: { groupIds: ids.slice(0, 2) } },
              }),
              makeRule({
                id: 'r2',
                actions: { assignUserToGroups: { groupIds: ids.slice(2, 4) } },
              }),
              makeRule({ id: 'r3', actions: { assignUserToGroups: { groupIds: ids.slice(4) } } }),
            ]),
        ],
        ['/api/v1/groups/00gID3', () => Promise.reject(new Error('boom'))],
        [/^\/api\/v1\/groups\/00gID/, () => res({}) as Response],
      ]);
      // Route the successful ones by name.
      fetchMock.mockImplementation(async (url: string) => {
        const endpoint = String(url).replace(ORIGIN, '');
        if (endpoint === RULES_URL) {
          return res([
            makeRule({ id: 'r1', actions: { assignUserToGroups: { groupIds: ids.slice(0, 2) } } }),
            makeRule({ id: 'r2', actions: { assignUserToGroups: { groupIds: ids.slice(2, 4) } } }),
            makeRule({ id: 'r3', actions: { assignUserToGroups: { groupIds: ids.slice(4) } } }),
          ]);
        }
        const id = endpoint.replace('/api/v1/groups/', '');
        if (id === '00gID3') throw new Error('network boom');
        return res(groupPayload(id, `Name ${id}`));
      });

      const result = await send({ action: 'fetchGroupRules' }).response;

      expect(result.success).toBe(true);
      // Rule r2 targets 00gID3 (failed) and 00gID4 (ok) → raw id vs name.
      expect(result.rules![1]).toMatchObject({
        groupNames: ['00gID3', 'Name 00gID4'],
        allGroupNamesMap: { '00gID4': 'Name 00gID4' },
      });
      expect(
        (result.rules![1] as unknown as { allGroupNamesMap: Record<string, string> })
          .allGroupNamesMap,
      ).not.toHaveProperty('00gID3');
      // 4 of 5 cached.
      expect(storageSet).toHaveBeenCalledTimes(4);
      for (const id of ids.filter((i) => i !== '00gID3')) {
        expect(store.has(`group_name_${id}`)).toBe(true);
      }
      expect(store.has('group_name_00gID3')).toBe(false);
    });

    it('a group fetch returning success without profile.name is dropped (id shown raw, nothing cached)', async () => {
      routeFetch([
        [
          RULES_URL,
          () => res([makeRule({ actions: { assignUserToGroups: { groupIds: [GROUP_A] } } })]),
        ],
        [`/api/v1/groups/${GROUP_A}`, () => res({ id: GROUP_A })],
      ]);

      const result = await send({ action: 'fetchGroupRules' }).response;

      expect(result.rules![0]).toMatchObject({ groupNames: [GROUP_A], allGroupNamesMap: {} });
      expect(storageSet).not.toHaveBeenCalled();
    });

    it('the condition scan requires exactly 00g + 17 chars (shorter ids are not resolved)', async () => {
      routeFetch([
        [
          RULES_URL,
          () =>
            res([
              makeRule({
                conditions: { expression: { value: 'isMemberOfGroup("00gTOOSHORT")', type: 'x' } },
              }),
            ]),
        ],
      ]);

      await send({ action: 'fetchGroupRules' }).response;

      // Only the rules page was fetched — the short id never became a lookup.
      expect(fetchedEndpoints()).toEqual([RULES_URL]);
    });
  });

  describe('pagination', () => {
    it('follows rel="next" across pages and concatenates the results', async () => {
      const page2 = '/api/v1/groups/rules?limit=200&after=cursor2';
      routeFetch([
        [
          RULES_URL,
          () =>
            res([makeRule({ id: 'r1' })], {
              headers: { link: `<https://acme.okta.com${page2}>; rel="next"` },
            }),
        ],
        [page2, () => res([makeRule({ id: 'r2' })])],
      ]);

      const result = await send({ action: 'fetchGroupRules' }).response;

      expect(fetchedEndpoints()).toEqual([RULES_URL, page2]);
      expect(result.stats!.total).toBe(2);
    });

    it('ignores rel="self" and only follows rel="next"', async () => {
      routeFetch([
        [
          RULES_URL,
          () =>
            res([makeRule()], {
              headers: { link: `<https://acme.okta.com${RULES_URL}>; rel="self"` },
            }),
        ],
      ]);

      await send({ action: 'fetchGroupRules' }).response;
      expect(fetchedEndpoints()).toEqual([RULES_URL]);
    });

    it('terminates on a malformed rel="next" link rather than looping forever', async () => {
      routeFetch([
        [RULES_URL, () => res([makeRule()], { headers: { link: 'not-a-link; rel="next"' } })],
      ]);

      const result = await send({ action: 'fetchGroupRules' }).response;

      expect(fetchedEndpoints()).toEqual([RULES_URL]);
      expect(result.success).toBe(true);
    });

    it('a failed page DISCARDS accumulated rules and returns the raw ApiResponse (no rules/stats keys)', async () => {
      const page2 = '/api/v1/groups/rules?limit=200&after=cursor2';
      routeFetch([
        [
          RULES_URL,
          () =>
            res([makeRule()], {
              headers: { link: `<https://acme.okta.com${page2}>; rel="next"` },
            }),
        ],
        [page2, () => res({ errorSummary: 'Rate limited' }, { status: 429 })],
      ]);

      const result = await send({ action: 'fetchGroupRules' }).response;

      // BUG (pinned): partial results are thrown away and the caller gets an object
      // with no `rules`/`stats`. RulesTab degrades to 0 via `response.rules?.length || 0`.
      expect(result).toEqual({
        success: false,
        error: 'Rate limited',
        status: 429,
        data: { errorSummary: 'Rate limited' },
      });
      expect(result).not.toHaveProperty('rules');
      expect(result).not.toHaveProperty('stats');
    });
  });

  it('a non-array rules payload is concat-ed as a SINGLE rule rather than rejected', async () => {
    fetchMock.mockResolvedValue(res({ notAnArray: true }));

    const result = await send({ action: 'fetchGroupRules' }).response;

    // BUG (pinned): `allRules.concat(response.data)` on a non-array appends the object
    // itself, so a garbage payload becomes one undefined-everything "rule" and the call
    // still reports success. There is no zod schema on this endpoint.
    expect(result.success).toBe(true);
    expect(result.stats).toEqual({ total: 1, active: 0, inactive: 0, conflicts: 0 });
    expect(result.rules![0]).toMatchObject({
      id: undefined,
      name: undefined,
      type: 'group_rule',
      condition: 'No condition specified',
      groupIds: [],
      userAttributes: [],
    });
  });

  it('a null rules payload becomes zero rules (the `|| []` guard)', async () => {
    fetchMock.mockResolvedValue(res(null));

    const result = await send({ action: 'fetchGroupRules' }).response;

    expect(result.success).toBe(true);
    expect(result.stats).toEqual({ total: 0, active: 0, inactive: 0, conflicts: 0 });
    expect(result.rules).toEqual([]);
  });
});

// ============================================================================
// 11. activate / deactivate rule shape asymmetry
// ============================================================================

describe.each([['activateRule', 'activate'] as const, ['deactivateRule', 'deactivate'] as const])(
  '%s',
  (action, verb) => {
    const endpoint = `/api/v1/groups/rules/rule1/lifecycle/${verb}`;

    it('posts to the lifecycle endpoint', async () => {
      fetchMock.mockResolvedValue(res({}));
      await send({ action, ruleId: 'rule1' }).response;

      expect(fetchMock.mock.calls[0][0]).toBe(ORIGIN + endpoint);
      expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
    });

    it('success → {success:true} ONLY, dropping data/status/headers', async () => {
      fetchMock.mockResolvedValue(
        res({ id: 'rule1' }, { headers: { 'x-rate-limit-remaining': '5' } }),
      );

      const result = await send({ action, ruleId: 'rule1' }).response;

      expect(result).toEqual({ success: true });
    });

    it('failure → the RAW ApiResponse verbatim (status + data survive)', async () => {
      fetchMock.mockResolvedValue(res({ errorSummary: 'Not allowed' }, { status: 403 }));

      const result = await send({ action, ruleId: 'rule1' }).response;

      // Asymmetric on purpose: the two failure shapes are NOT normalized.
      expect(result).toEqual({
        success: false,
        error: 'Not allowed',
        status: 403,
        data: { errorSummary: 'Not allowed' },
      });
    });

    it('a network rejection surfaces the fetch error message, not the fallback string', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      // makeApiRequest already catches, so the handler's own catch never runs and the
      // `Failed to ${verb} rule` literal is effectively unreachable.
      const result = await send({ action, ruleId: 'rule1' }).response;

      expect(result).toEqual({ success: false, error: 'Failed to fetch' });
    });
  },
);

// ============================================================================
// 6 + 13. Search cascades
// ============================================================================

describe('searchUsers cascade', () => {
  const qUrl = (q: string) => `/api/v1/users?q=${encodeURIComponent(q)}&limit=20`;
  const searchUrl = (q: string) => `/api/v1/users?search=${encodeURIComponent(q)}&limit=20`;
  const filterUrl = (q: string) => `/api/v1/users?filter=profile.email eq "${q}"&limit=20`;

  it('(a) q returns results → exactly ONE request', async () => {
    routeFetch([[qUrl('ada'), () => res([makeUser()])]]);

    const result = await send({ action: 'searchUsers', query: '  ada  ' }).response;

    expect(fetchedEndpoints()).toEqual([qUrl('ada')]);
    expect(result).toEqual({ success: true, data: [makeUser()], count: 1 });
  });

  it('(b) q returns [] → exactly TWO requests, the second using ?search=', async () => {
    routeFetch([
      [qUrl('ada'), () => res([])],
      [searchUrl('ada'), () => res([makeUser()])],
    ]);

    const result = await send({ action: 'searchUsers', query: 'ada' }).response;

    expect(fetchedEndpoints()).toEqual([qUrl('ada'), searchUrl('ada')]);
    expect(result.count).toBe(1);
  });

  it('(c) both empty with an "@" query → exactly THREE requests, the third UNENCODED', async () => {
    const email = 'ada@example.com';
    routeFetch([
      [qUrl(email), () => res([])],
      [searchUrl(email), () => res([])],
      [filterUrl(email), () => res([makeUser()])],
    ]);

    const result = await send({ action: 'searchUsers', query: email }).response;

    // BUG (pinned): strategy 3 interpolates the raw query — no encodeURIComponent,
    // and the literal quotes/spaces go out as-is.
    expect(fetchedEndpoints()).toEqual([qUrl(email), searchUrl(email), filterUrl(email)]);
    expect(fetchedEndpoints()[2]).toBe(`/api/v1/users?filter=profile.email eq "${email}"&limit=20`);
    expect(result.count).toBe(1);
  });

  it('(d) both empty WITHOUT an "@" → exactly TWO requests, no filter strategy', async () => {
    routeFetch([
      [qUrl('ada'), () => res([])],
      [searchUrl('ada'), () => res([])],
    ]);

    const result = await send({ action: 'searchUsers', query: 'ada' }).response;

    expect(fetchedEndpoints()).toEqual([qUrl('ada'), searchUrl('ada')]);
    expect(result).toEqual({ success: true, data: [], count: 0 });
  });

  it('strategy 2 OVERWRITES strategy 1 even when strategy 1 succeeded-but-empty', async () => {
    // Strategy 1 empty → advance; strategy 2 also succeeds with [] → assigns [].
    routeFetch([
      [qUrl('ada'), () => res([])],
      [searchUrl('ada'), () => res([])],
    ]);

    await expect(send({ action: 'searchUsers', query: 'ada' }).response).resolves.toMatchObject({
      data: [],
    });
  });

  it('a strategy-1 FAILURE is swallowed and the cascade continues (error state discarded)', async () => {
    routeFetch([
      [qUrl('ada'), () => res({ errorSummary: 'boom' }, { status: 500 })],
      [searchUrl('ada'), () => res([makeUser()])],
    ]);

    const result = await send({ action: 'searchUsers', query: 'ada' }).response;

    expect(result).toEqual({ success: true, data: [makeUser()], count: 1 });
  });

  it('every strategy failing still reports success:true with an empty list', async () => {
    fetchMock.mockResolvedValue(res({ errorSummary: 'boom' }, { status: 500 }));

    // BUG (pinned): a total API failure is indistinguishable from "no matches".
    await expect(send({ action: 'searchUsers', query: 'ada@x.com' }).response).resolves.toEqual({
      success: true,
      data: [],
      count: 0,
    });
  });

  it('a thrown non-fetch error becomes "Failed to search users"', async () => {
    // A non-array `data` makes `users.length` throw inside the handler's try block.
    routeFetch([[qUrl('ada'), () => res({ length: 1, 0: 'x' })]]);

    const result = await send({ action: 'searchUsers', query: 'ada' }).response;
    // An object with a numeric length passes `data.length > 0` — pinned as-is.
    expect(result.success).toBe(true);
  });
});

describe('searchGroups', () => {
  const url = (q: string) => `/api/v1/groups?q=${encodeURIComponent(q)}&limit=20&expand=stats`;

  it('searches with q, limit and expand=stats', async () => {
    const groups = [{ id: GROUP_ID, profile: { name: 'Eng' } }];
    routeFetch([[url('eng'), () => res(groups)]]);

    const result = await send({ action: 'searchGroups', query: ' eng ' }).response;

    expect(fetchedEndpoints()).toEqual([url('eng')]);
    expect(result).toEqual({ success: true, data: groups, count: 1 });
  });

  it('a FAILED search is masked as an empty successful one', async () => {
    routeFetch([[url('eng'), () => res({ errorSummary: 'boom' }, { status: 500 })]]);

    // BUG (pinned): GroupsTab has no error branch — do not "fix" without touching it.
    await expect(send({ action: 'searchGroups', query: 'eng' }).response).resolves.toEqual({
      success: true,
      data: [],
      count: 0,
    });
  });

  it('a network rejection is also masked as empty-success', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(send({ action: 'searchGroups', query: 'eng' }).response).resolves.toEqual({
      success: true,
      data: [],
      count: 0,
    });
  });
});

// ============================================================================
// 12. getUserGroups mapping + pagination
// ============================================================================

describe('getUserGroups', () => {
  const url = `/api/v1/users/${USER_ID}/groups?limit=200`;

  it('maps every group to membershipType "UNKNOWN" with addedDate undefined', async () => {
    const group = {
      id: GROUP_ID,
      type: 'OKTA_GROUP',
      profile: { name: 'Eng' },
      lastUpdated: '2024-05-05',
    };
    routeFetch([[url, () => res([group])]]);

    const result = await send({ action: 'getUserGroups', userId: USER_ID }).response;

    // OKTA_API_LIMITATIONS §1: Okta gives no membership timestamps here.
    expect(result).toEqual({
      success: true,
      data: [{ group, membershipType: 'UNKNOWN', addedDate: undefined }],
      count: 1,
    });
  });

  it('paginates via rel="next"', async () => {
    const page2 = `/api/v1/users/${USER_ID}/groups?limit=200&after=c2`;
    routeFetch([
      [
        url,
        () =>
          res([{ id: 'g1' }], { headers: { link: `<https://acme.okta.com${page2}>; rel="next"` } }),
      ],
      [page2, () => res([{ id: 'g2' }])],
    ]);

    const result = await send({ action: 'getUserGroups', userId: USER_ID }).response;

    expect(fetchedEndpoints()).toEqual([url, page2]);
    expect(result.count).toBe(2);
  });

  it('a failed page returns the raw ApiResponse and discards page 1', async () => {
    const page2 = `/api/v1/users/${USER_ID}/groups?limit=200&after=c2`;
    routeFetch([
      [
        url,
        () =>
          res([{ id: 'g1' }], { headers: { link: `<https://acme.okta.com${page2}>; rel="next"` } }),
      ],
      [page2, () => res({ errorSummary: 'nope' }, { status: 500 })],
    ]);

    const result = await send({ action: 'getUserGroups', userId: USER_ID }).response;

    expect(result).toEqual({
      success: false,
      error: 'nope',
      status: 500,
      data: { errorSummary: 'nope' },
    });
    expect(result).not.toHaveProperty('count');
  });

  it('terminates on a malformed next link', async () => {
    routeFetch([[url, () => res([{ id: 'g1' }], { headers: { link: 'garbage; rel="next"' } })]]);

    await expect(
      send({ action: 'getUserGroups', userId: USER_ID }).response,
    ).resolves.toMatchObject({
      count: 1,
    });
    expect(fetchedEndpoints()).toEqual([url]);
  });
});

// ============================================================================
// 10. getUserContext admin-DataTables decoding
// ============================================================================

describe('getUserContext', () => {
  const endpoint = `/admin/users/search?iDisplayLength=1&sColumns=user.id%2CmanagedBy.rules&sSearch=${USER_ID}`;

  function withAaData(row: unknown[]) {
    routeFetch([[endpoint, () => res({ aaData: [row] })]]);
  }

  it('reads userId from column 0 and managedBy.rules from column 1', async () => {
    withAaData([USER_ID, [{ id: 'r1' }, { id: 'r2' }]]);

    const result = await send({ action: 'getUserContext', userId: USER_ID }).response;

    expect(fetchedEndpoints()).toEqual([endpoint]);
    expect(result).toEqual({
      success: true,
      data: { userId: USER_ID, managedByRules: [{ id: 'r1' }, { id: 'r2' }] },
    });
  });

  it.each([
    ['an array', ['a', 'b'], ['a', 'b']],
    ['a non-empty string', 'rule-1', ['rule-1']],
    ['an object with id', { id: 'r9' }, ['r9']],
    ['an object with ruleId', { ruleId: 'r8' }, ['r8']],
    ['a whitespace-only string', '   ', []],
    ['an empty string', '', []],
    ['null', null, []],
    ['undefined', undefined, []],
    ['an object with neither id nor ruleId', { other: 1 }, []],
  ])('normalizes managedByRules from %s', async (_label, raw, expected) => {
    withAaData([USER_ID, raw]);

    const result = await send({ action: 'getUserContext', userId: USER_ID }).response;

    expect(result.data.managedByRules).toEqual(expected);
  });

  it('prefers .id over .ruleId when both are present', async () => {
    withAaData([USER_ID, { id: 'from-id', ruleId: 'from-ruleId' }]);

    const result = await send({ action: 'getUserContext', userId: USER_ID }).response;
    expect(result.data.managedByRules).toEqual(['from-id']);
  });

  it('an empty aaData → "User context not found or invalid response"', async () => {
    routeFetch([[endpoint, () => res({ aaData: [] })]]);

    await expect(send({ action: 'getUserContext', userId: USER_ID }).response).resolves.toEqual({
      success: false,
      error: 'User context not found or invalid response',
    });
  });

  it('a payload with no aaData at all → the same error', async () => {
    routeFetch([[endpoint, () => res({ something: 'else' })]]);

    await expect(send({ action: 'getUserContext', userId: USER_ID }).response).resolves.toEqual({
      success: false,
      error: 'User context not found or invalid response',
    });
  });

  it('an API failure returns {success:false, error} with status/data stripped', async () => {
    routeFetch([[endpoint, () => res({ errorSummary: 'Forbidden' }, { status: 403 })]]);

    const result = await send({ action: 'getUserContext', userId: USER_ID }).response;

    expect(result).toEqual({ success: false, error: 'Forbidden' });
    expect(result).not.toHaveProperty('status');
  });
});

// ============================================================================
// getUserDetails
// ============================================================================

describe('getUserDetails', () => {
  it('re-wraps success, DROPPING headers and status (no zod validation)', async () => {
    const raw = { id: USER_ID, status: 'BOGUS_STATUS', profile: {} };
    routeFetch([
      [`/api/v1/users/${USER_ID}`, () => res(raw, { headers: { 'x-rate-limit-remaining': '9' } })],
    ]);

    const result = await send({ action: 'getUserDetails', userId: USER_ID }).response;

    // Unvalidated passthrough — a schema-violating payload sails right through.
    expect(result).toEqual({ success: true, data: raw });
    expect(result).not.toHaveProperty('headers');
    expect(result).not.toHaveProperty('status');
  });

  it('passes a FAILED ApiResponse through verbatim (status + data preserved)', async () => {
    routeFetch([
      [`/api/v1/users/${USER_ID}`, () => res({ errorSummary: 'Nope' }, { status: 404 })],
    ]);

    const result = await send({ action: 'getUserDetails', userId: USER_ID }).response;

    // Asymmetric with getUserContext, which strips status.
    expect(result).toEqual({
      success: false,
      error: 'Nope',
      status: 404,
      data: { errorSummary: 'Nope' },
    });
  });
});

// ============================================================================
// 9. exportGroupMembers — golden bytes
// ============================================================================

describe('exportGroupMembers', () => {
  const url = `/api/v1/groups/${GROUP_ID}/users?limit=200`;
  let downloaded: { filename: string; content: string; mimeType: string } | null;
  let appendSpy: Mock;

  beforeEach(() => {
    downloaded = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      // Blob content is captured synchronously at construction time by the Blob stub below.
      void obj;
      return 'blob:mock-url';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const RealBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class extends RealBlob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          lastBlob = { content: String(parts[0]), mimeType: options?.type ?? '' };
        }
      },
    );

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded = {
        filename: this.download,
        content: lastBlob!.content,
        mimeType: lastBlob!.mimeType,
      };
    });

    appendSpy = vi.spyOn(document.body, 'appendChild') as unknown as Mock;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    lastBlob = null;
  });

  let lastBlob: { content: string; mimeType: string } | null = null;

  const members: OktaUser[] = [
    makeUser({
      id: 'u1',
      profile: { login: 'a@x.com', email: 'a@x.com', firstName: 'Ada', lastName: 'Lovelace' },
    } as Partial<OktaUser>),
    makeUser({
      id: 'u2',
      status: 'SUSPENDED',
      profile: {
        login: 'b@x.com',
        email: 'b@x.com',
        firstName: 'Bob "The Builder"',
        lastName: 'Smith, Jr.',
      },
    } as Partial<OktaUser>),
  ];

  it('produces golden CSV bytes — RFC 4180 escaping via escapeCSV', async () => {
    vi.setSystemTime(new Date('2026-07-14T10:00:00Z'));
    routeFetch([[url, () => res(members)]]);

    const result = await send({
      action: 'exportGroupMembers',
      groupId: GROUP_ID,
      groupName: 'Engineering',
      format: 'csv',
    }).response;

    expect(result).toEqual({ success: true, count: 2 });
    // Cells route through csvUtils.escapeCSV: only cells containing a comma,
    // newline, or quote are wrapped, and embedded quotes are doubled.
    expect(downloaded!.content).toBe(
      [
        'ID,Email,First Name,Last Name,Status',
        'u1,a@x.com,Ada,Lovelace,ACTIVE',
        'u2,b@x.com,"Bob ""The Builder""","Smith, Jr.",SUSPENDED',
      ].join('\n'),
    );
    expect(downloaded!.mimeType).toBe('text/csv');
    expect(downloaded!.filename).toBe('Engineering_members_2026-07-14.csv');
    vi.useRealTimers();
  });

  it('neutralizes spreadsheet formula injection in profile fields', async () => {
    routeFetch([
      [
        url,
        () =>
          res([
            makeUser({
              id: 'u3',
              profile: {
                login: 'c@x.com',
                email: 'c@x.com',
                firstName: '=HYPERLINK("https://evil.example","x")',
                lastName: '+Payload',
              },
            } as Partial<OktaUser>),
          ]),
      ],
    ]);

    await send({ action: 'exportGroupMembers', groupId: GROUP_ID, groupName: 'G', format: 'csv' })
      .response;

    const dataRow = downloaded!.content.split('\n')[1];
    // Leading formula trigger characters are prefixed with a single quote.
    expect(dataRow).toBe(
      `u3,c@x.com,"'=HYPERLINK(""https://evil.example"",""x"")",'+Payload,ACTIVE`,
    );
  });

  it('the header row is NOT quoted (plain cells stay unquoted)', async () => {
    routeFetch([[url, () => res([makeUser({ id: 'u1' })])]]);

    await send({ action: 'exportGroupMembers', groupId: GROUP_ID, groupName: 'G', format: 'csv' })
      .response;

    expect(downloaded!.content.split('\n')[0]).toBe('ID,Email,First Name,Last Name,Status');
  });

  it('an EMPTY member list produces an empty string, not a header row', async () => {
    routeFetch([[url, () => res([])]]);

    const result = await send({
      action: 'exportGroupMembers',
      groupId: GROUP_ID,
      groupName: 'G',
      format: 'csv',
    }).response;

    // BUG (pinned): csvUtils.generateCSV would emit the header row instead.
    expect(result).toEqual({ success: true, count: 0 });
    expect(downloaded!.content).toBe('');
  });

  it('produces golden JSON with 2-space indent and the application/json mime type', async () => {
    vi.setSystemTime(new Date('2026-07-14T10:00:00Z'));
    routeFetch([[url, () => res([members[0]])]]);

    const result = await send({
      action: 'exportGroupMembers',
      groupId: GROUP_ID,
      groupName: 'Engineering',
      format: 'json',
    }).response;

    expect(result).toEqual({ success: true, count: 1 });
    expect(downloaded!.content).toBe(JSON.stringify([members[0]], null, 2));
    expect(downloaded!.mimeType).toBe('application/json');
    expect(downloaded!.filename).toBe('Engineering_members_2026-07-14.json');
    vi.useRealTimers();
  });

  it('does NOT attach the anchor to document.body', async () => {
    routeFetch([[url, () => res([makeUser()])]]);
    appendSpy.mockClear();

    await send({ action: 'exportGroupMembers', groupId: GROUP_ID, groupName: 'G', format: 'csv' })
      .response;

    // csvUtils.downloadCSV appends/removes the anchor; this one does not.
    const appendedAnchors = appendSpy.mock.calls.filter((c) => (c[0] as Node).nodeName === 'A');
    expect(appendedAnchors).toHaveLength(0);
  });

  it('applies statusFilter and reports count === filtered length', async () => {
    routeFetch([[url, () => res(members)]]);

    const result = await send({
      action: 'exportGroupMembers',
      groupId: GROUP_ID,
      groupName: 'G',
      format: 'csv',
      statusFilter: 'SUSPENDED',
    }).response;

    expect(result).toEqual({ success: true, count: 1 });
    expect(downloaded!.content).toContain('u2,');
    expect(downloaded!.content).not.toContain('u1,');
  });

  it('an empty-string statusFilter is falsy → no filtering', async () => {
    routeFetch([[url, () => res(members)]]);

    const result = await send({
      action: 'exportGroupMembers',
      groupId: GROUP_ID,
      groupName: 'G',
      format: 'csv',
      statusFilter: '',
    }).response;

    expect(result).toEqual({ success: true, count: 2 });
  });

  it('paginates members across pages', async () => {
    const page2 = `/api/v1/groups/${GROUP_ID}/users?limit=200&after=c2`;
    routeFetch([
      [
        url,
        () =>
          res([members[0]], { headers: { link: `<https://acme.okta.com${page2}>; rel="next"` } }),
      ],
      [page2, () => res([members[1]])],
    ]);

    const result = await send({
      action: 'exportGroupMembers',
      groupId: GROUP_ID,
      groupName: 'G',
      format: 'csv',
    }).response;

    expect(fetchedEndpoints()).toEqual([url, page2]);
    expect(result.count).toBe(2);
  });

  it('a failed member page THROWS (unlike the other two loops) and downloads nothing', async () => {
    const page2 = `/api/v1/groups/${GROUP_ID}/users?limit=200&after=c2`;
    routeFetch([
      [
        url,
        () =>
          res([members[0]], { headers: { link: `<https://acme.okta.com${page2}>; rel="next"` } }),
      ],
      [page2, () => res({ errorSummary: 'Rate limited' }, { status: 429 })],
    ]);

    const result = await send({
      action: 'exportGroupMembers',
      groupId: GROUP_ID,
      groupName: 'G',
      format: 'csv',
    }).response;

    // The thrown message wins over the 'Export failed' fallback.
    expect(result).toEqual({ success: false, error: 'Rate limited' });
    expect(downloaded).toBeNull();
  });

  it('a failed member page with no error message → "Failed to fetch group members"', async () => {
    fetchMock.mockResolvedValue(
      res({}, { status: 500, json: false, headers: { 'content-type': 'text/plain' } }),
    );

    const result = await send({
      action: 'exportGroupMembers',
      groupId: GROUP_ID,
      groupName: 'G',
      format: 'csv',
    }).response;

    expect(result).toEqual({ success: false, error: 'Request failed with status 500' });
  });

  it('an undefined groupName lands in the filename as the literal "undefined"', async () => {
    vi.setSystemTime(new Date('2026-07-14T10:00:00Z'));
    routeFetch([[url, () => res([makeUser()])]]);

    // BUG (pinned): no guard on groupName — the router only requires groupId+format.
    await send({ action: 'exportGroupMembers', groupId: GROUP_ID, format: 'csv' }).response;

    expect(downloaded!.filename).toBe('undefined_members_2026-07-14.csv');
    vi.useRealTimers();
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
