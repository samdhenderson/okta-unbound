/**
 * @module content/apiRequest.test
 * @description Unit tests for the content script's fetch primitive, focused on
 * the status every failure now carries (D-007a).
 *
 * `handleMakeApiRequest` is the sole producer of the scheduler's
 * `RequestResult`, so it is the only place that can keep the failure arm's
 * promise that `status` is always present. Three failure shapes leave this
 * module without an HTTP response — a rejected same-origin guard, a rejected
 * method, and a `fetch` that threw — and all three must say so with
 * {@link NO_HTTP_STATUS} rather than omitting the field.
 *
 * Network is stubbed at `globalThis.fetch` rather than via MSW, matching
 * `content/index.test.ts` (MSW is not used in this repo, and a rejecting fetch
 * is not observable through a handler).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleMakeApiRequest, isSameOriginPath } from './apiRequest';
import { NO_HTTP_STATUS } from '../shared/scheduler/requestResult';

const fetchMock = vi.fn();

/** A JSON `Response` with the given status. */
const res = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  // The token element is absent by default; presence is not what these tests
  // are about, and the token is never asserted on (it must never be logged or
  // echoed anywhere).
  vi.spyOn(document, 'getElementById').mockReturnValue(null);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isSameOriginPath', () => {
  it('accepts a single-slash same-origin path and rejects the rest', () => {
    expect(isSameOriginPath('/api/v1/apps')).toBe(true);
    expect(isSameOriginPath('//evil.example.com/api')).toBe(false);
    expect(isSameOriginPath('https://evil.example.com/api')).toBe(false);
    expect(isSameOriginPath('api/v1/apps')).toBe(false);
  });
});

describe('handleMakeApiRequest failure statuses', () => {
  it('reports the real HTTP status when Okta answered', async () => {
    fetchMock.mockResolvedValue(res({ errorSummary: 'Too many requests' }, 429));

    const result = await handleMakeApiRequest('/api/v1/apps/0oaFAKE1');

    expect(result).toMatchObject({ success: false, status: 429 });
  });

  it('reports 401 as itself, so the session-expiry predicate can see it', async () => {
    fetchMock.mockResolvedValue(res({ errorSummary: 'Invalid session' }, 401));

    const result = await handleMakeApiRequest('/api/v1/apps/0oaFAKE1');

    expect(result).toMatchObject({ success: false, status: 401 });
  });

  it('uses the sentinel when fetch throws — a transport failure has no status', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await handleMakeApiRequest('/api/v1/apps/0oaFAKE1');

    expect(result).toEqual({
      success: false,
      error: 'Failed to fetch',
      status: NO_HTTP_STATUS,
    });
  });

  it('uses the sentinel when the same-origin guard rejects the endpoint', async () => {
    const result = await handleMakeApiRequest('//evil.example.com/api/v1/apps');

    expect(result).toEqual({
      success: false,
      error: 'Rejected request: endpoint must be a same-origin path',
      status: NO_HTTP_STATUS,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the sentinel when the method allow-list rejects the request', async () => {
    const result = await handleMakeApiRequest('/api/v1/apps', 'TRACE');

    expect(result).toEqual({
      success: false,
      error: 'Rejected request: unsupported HTTP method',
      status: NO_HTTP_STATUS,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never invents a status on the success path', async () => {
    fetchMock.mockResolvedValue(res({ id: '0oaFAKE1' }, 200));

    const result = await handleMakeApiRequest('/api/v1/apps/0oaFAKE1');

    expect(result).toMatchObject({ success: true, status: 200, data: { id: '0oaFAKE1' } });
  });
});
