/**
 * Tests for the canonical Okta pagination module: `parseNextLink` (Link-header
 * parsing), the loop-guarded `nextPageUrl`, and the `fetchAllPages` helper
 * (accumulation, guard stops, error surfacing, schema validation, callbacks,
 * and the `maxPages` cap).
 *
 * Fixtures use only fake placeholders (`example.okta.com`, `00uFAKE…`) per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  parseNextLink,
  nextPageUrl,
  fetchAllPages,
  OKTA_PAGE_SIZE,
  type PaginatedPageResult,
} from './oktaPagination';

/** Wrap a path in an Okta-style `rel="next"` Link header. */
function nextLink(path: string): string {
  return `<https://example.okta.com${path}>; rel="next"`;
}

/** Build a request mock that serves responses from a URL → result map. */
function routedRequest(
  routes: Record<string, PaginatedPageResult>,
): (url: string) => Promise<PaginatedPageResult> {
  return vi.fn(async (url: string) => {
    const response = routes[url];
    if (!response) throw new Error(`Unrouted test URL: ${url}`);
    return response;
  });
}

describe('OKTA_PAGE_SIZE', () => {
  it('is the standard 200-per-page Okta list page size', () => {
    expect(OKTA_PAGE_SIZE).toBe(200);
  });
});

// Behavior-parity cases for parseNextLink, mirroring the original
// useOktaApi/utilities.test.ts coverage against the moved implementation.
describe('parseNextLink', () => {
  it('returns null when the header is missing', () => {
    expect(parseNextLink()).toBeNull();
    expect(parseNextLink(undefined)).toBeNull();
  });

  it('returns null when there is no rel="next" link', () => {
    const header = '<https://example.okta.com/api/v1/users?after=abc>; rel="self"';
    expect(parseNextLink(header)).toBeNull();
  });

  it('extracts the next link as an origin-relative path + search', () => {
    const header = '<https://example.okta.com/api/v1/users?limit=200&after=cursor123>; rel="next"';
    expect(parseNextLink(header)).toBe('/api/v1/users?limit=200&after=cursor123');
  });

  it('picks the next link out of multiple comma-separated links', () => {
    const header =
      '<https://example.okta.com/api/v1/users?after=self>; rel="self", ' +
      '<https://example.okta.com/api/v1/users?after=next1>; rel="next"';
    expect(parseNextLink(header)).toBe('/api/v1/users?after=next1');
  });

  it('returns a path without a search string when the next URL has no query', () => {
    const header = '<https://example.okta.com/api/v1/groups>; rel="next"';
    expect(parseNextLink(header)).toBe('/api/v1/groups');
  });

  it('returns null when a rel="next" link has no angle-bracketed URL', () => {
    const header = 'https://example.okta.com/api/v1/users; rel="next"';
    expect(parseNextLink(header)).toBeNull();
  });
});

// Behavior-parity cases for the guarded nextPageUrl, mirroring the original
// useOktaApi/utilities.test.ts coverage against the moved implementation.
describe('nextPageUrl', () => {
  const cur = '/api/v1/groups/rules?limit=200';
  const nextHeader =
    '<https://example.okta.com/api/v1/groups/rules?after=CUR&limit=200>; rel="next"';

  it('returns the next page when the cursor advances and the page had items', () => {
    expect(nextPageUrl(cur, nextHeader, 200)).toBe('/api/v1/groups/rules?after=CUR&limit=200');
  });

  it('stops when the page came back empty even if a next link is present', () => {
    expect(nextPageUrl(cur, nextHeader, 0)).toBeNull();
  });

  it('stops when the cursor does not advance (self-referential next link)', () => {
    const selfHeader = `<https://example.okta.com${cur}>; rel="next"`;
    expect(nextPageUrl(cur, selfHeader, 200)).toBeNull();
  });

  it('stops when there is no next link', () => {
    expect(nextPageUrl(cur, undefined, 200)).toBeNull();
  });
});

describe('fetchAllPages', () => {
  const page1Url = '/api/v1/users?limit=200';
  const page2Url = '/api/v1/users?limit=200&after=cursor2';

  it('follows rel="next" across pages and accumulates every page in order', async () => {
    const request = routedRequest({
      [page1Url]: {
        success: true,
        data: [{ id: '00uFAKE1' }, { id: '00uFAKE2' }],
        headers: { link: nextLink(page2Url) },
      },
      [page2Url]: { success: true, data: [{ id: '00uFAKE3' }] },
    });

    const rows = await fetchAllPages<{ id: string }>(request, page1Url);

    expect(rows.map((r) => r.id)).toEqual(['00uFAKE1', '00uFAKE2', '00uFAKE3']);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, page1Url);
    expect(request).toHaveBeenNthCalledWith(2, page2Url);
  });

  it('stops on an empty page even when a next link is present', async () => {
    const request = routedRequest({
      [page1Url]: { success: true, data: [], headers: { link: nextLink(page2Url) } },
    });

    const rows = await fetchAllPages(request, page1Url);

    expect(rows).toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('stops on a self-referential rel="next" cursor instead of looping forever', async () => {
    const request = routedRequest({
      [page1Url]: {
        success: true,
        data: [{ id: '00uFAKE1' }],
        headers: { link: nextLink(page1Url) },
      },
    });

    const rows = await fetchAllPages<{ id: string }>(request, page1Url);

    expect(rows).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('treats non-array data as an empty page and stops', async () => {
    const request = routedRequest({
      [page1Url]: {
        success: true,
        data: { unexpected: true },
        headers: { link: nextLink(page2Url) },
      },
    });

    const rows = await fetchAllPages(request, page1Url);

    expect(rows).toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('throws the transport error when a page fails', async () => {
    const request = routedRequest({
      [page1Url]: {
        success: true,
        data: [{ id: '00uFAKE1' }],
        headers: { link: nextLink(page2Url) },
      },
      [page2Url]: { success: false, error: 'rate limited' },
    });

    await expect(fetchAllPages(request, page1Url)).rejects.toThrow('rate limited');
  });

  it('throws the caller-supplied errorMessage when a failed page carries no error', async () => {
    const request = routedRequest({ [page1Url]: { success: false } });

    await expect(
      fetchAllPages(request, page1Url, { errorMessage: 'Failed to fetch group members' }),
    ).rejects.toThrow('Failed to fetch group members');
  });

  it('throws a default message naming the endpoint when a failed page carries no error', async () => {
    const request = routedRequest({ [page1Url]: { success: false } });

    await expect(fetchAllPages(request, page1Url)).rejects.toThrow(
      'Paginated fetch failed (/api/v1/users)',
    );
  });

  it('validates each page with the schema, dropping malformed rows leniently', async () => {
    const itemSchema = z.object({ id: z.string() }).passthrough();
    const request = routedRequest({
      [page1Url]: {
        success: true,
        data: [{ id: '00uFAKE1' }, { missingId: true }],
        headers: { link: nextLink(page2Url) },
      },
      [page2Url]: { success: true, data: [{ id: '00uFAKE2' }, 42] },
    });

    const rows = await fetchAllPages(request, page1Url, { schema: itemSchema });

    expect(rows.map((r) => r.id)).toEqual(['00uFAKE1', '00uFAKE2']);
  });

  it('still advances pagination when the schema drops every row of a non-empty page', async () => {
    const itemSchema = z.object({ id: z.string() }).passthrough();
    const request = routedRequest({
      [page1Url]: {
        success: true,
        data: [{ missingId: true }],
        headers: { link: nextLink(page2Url) },
      },
      [page2Url]: { success: true, data: [{ id: '00uFAKE9' }] },
    });

    const rows = await fetchAllPages(request, page1Url, { schema: itemSchema });

    // The guard keys off the RAW page size, so an all-malformed page does not
    // prematurely terminate the walk.
    expect(request).toHaveBeenCalledTimes(2);
    expect(rows.map((r) => r.id)).toEqual(['00uFAKE9']);
  });

  it('calls onPage after each page with the page items and running total', async () => {
    const onPage = vi.fn();
    const request = routedRequest({
      [page1Url]: {
        success: true,
        data: [{ id: '00uFAKE1' }, { id: '00uFAKE2' }],
        headers: { link: nextLink(page2Url) },
      },
      [page2Url]: { success: true, data: [{ id: '00uFAKE3' }] },
    });

    await fetchAllPages<{ id: string }>(request, page1Url, { onPage });

    expect(onPage).toHaveBeenCalledTimes(2);
    expect(onPage).toHaveBeenNthCalledWith(1, [{ id: '00uFAKE1' }, { id: '00uFAKE2' }], 2);
    expect(onPage).toHaveBeenNthCalledWith(2, [{ id: '00uFAKE3' }], 3);
  });

  it('calls onBeforePage with the 1-based page number before each request', async () => {
    const calls: string[] = [];
    const request = vi.fn(async (url: string) => {
      calls.push(`request:${url}`);
      return url === page1Url
        ? {
            success: true,
            data: [{ id: '00uFAKE1' }],
            headers: { link: nextLink(page2Url) },
          }
        : { success: true, data: [{ id: '00uFAKE2' }] };
    });

    await fetchAllPages<{ id: string }>(request, page1Url, {
      onBeforePage: (pageNumber) => calls.push(`before:${pageNumber}`),
    });

    expect(calls).toEqual([`before:1`, `request:${page1Url}`, `before:2`, `request:${page2Url}`]);
  });

  // Okta drops the admin console's private `expand=group-rules` from its
  // rel="next" link, so page 2+ would arrive without the embed. `preserveParams`
  // re-applies it. It is opt-in precisely so the other ten fetchAllPages call
  // sites keep issuing byte-identical URLs.
  describe('preserveParams', () => {
    const firstUrl = '/api/v1/groups/00gFAKE1/users?limit=200&expand=group-rules';
    const droppedNext = '/api/v1/groups/00gFAKE1/users?limit=200&after=cursor2';
    const restoredNext = `${droppedNext}&expand=group-rules`;

    it('re-applies a named param the next link dropped', async () => {
      const request = routedRequest({
        [firstUrl]: {
          success: true,
          data: [{ id: '00uFAKE1' }],
          headers: { link: nextLink(droppedNext) },
        },
        [restoredNext]: { success: true, data: [{ id: '00uFAKE2' }] },
      });

      const rows = await fetchAllPages<{ id: string }>(request, firstUrl, {
        preserveParams: ['expand'],
      });

      expect(rows.map((r) => r.id)).toEqual(['00uFAKE1', '00uFAKE2']);
      expect(request).toHaveBeenNthCalledWith(2, restoredNext);
    });

    it('does not duplicate a param the next link already carries', async () => {
      // The public `expand=stats` case: Okta DOES echo this one, and re-applying
      // it must be a no-op — the URL is passed through untouched.
      const statsFirst = '/api/v1/groups?limit=200&expand=stats';
      const statsNext = '/api/v1/groups?limit=200&after=cursor2&expand=stats';
      const request = routedRequest({
        [statsFirst]: {
          success: true,
          data: [{ id: '00gFAKE1' }],
          headers: { link: nextLink(statsNext) },
        },
        [statsNext]: { success: true, data: [{ id: '00gFAKE2' }] },
      });

      await fetchAllPages<{ id: string }>(request, statsFirst, { preserveParams: ['expand'] });

      expect(request).toHaveBeenNthCalledWith(2, statsNext);
      expect(statsNext.match(/expand=/g)).toHaveLength(1);
    });

    it('does not invent a param that was never on the first URL', async () => {
      const request = routedRequest({
        [page1Url]: {
          success: true,
          data: [{ id: '00uFAKE1' }],
          headers: { link: nextLink(page2Url) },
        },
        [page2Url]: { success: true, data: [{ id: '00uFAKE2' }] },
      });

      await fetchAllPages<{ id: string }>(request, page1Url, { preserveParams: ['expand'] });

      expect(request).toHaveBeenNthCalledWith(2, page2Url);
    });

    // The blast-radius guard for the other ten fetchAllPages call sites: they
    // omit the option, so every URL they issue must be exactly what Okta handed
    // back, byte for byte.
    it('leaves URLs byte-for-byte unchanged for callers that omit the option', async () => {
      const opaqueNext = '/api/v1/users?limit=200&after=a%2Bb%3D&filter=status+eq+%22ACTIVE%22';
      const routes = {
        [page1Url]: {
          success: true,
          data: [{ id: '00uFAKE1' }],
          headers: { link: nextLink(opaqueNext) },
        },
        [opaqueNext]: { success: true, data: [{ id: '00uFAKE2' }] },
      };

      const withoutOption = routedRequest(routes);
      await fetchAllPages<{ id: string }>(withoutOption, page1Url);

      // Same walk with an empty preserveParams list, to pin that the opt-in
      // plumbing itself never rewrites a URL.
      const withEmptyOption = routedRequest(routes);
      await fetchAllPages<{ id: string }>(withEmptyOption, page1Url, { preserveParams: [] });

      for (const request of [withoutOption, withEmptyOption]) {
        expect(request).toHaveBeenNthCalledWith(1, page1Url);
        expect(request).toHaveBeenNthCalledWith(2, opaqueNext);
      }
    });

    it('still stops on a self-referential cursor once the param is re-applied', async () => {
      // Without re-running the guard against the preserved URL, the appended
      // param would make a self-referential link look like a new page forever.
      const request = routedRequest({
        [firstUrl]: {
          success: true,
          data: [{ id: '00uFAKE1' }],
          headers: { link: nextLink('/api/v1/groups/00gFAKE1/users?limit=200') },
        },
      });

      const rows = await fetchAllPages<{ id: string }>(request, firstUrl, {
        preserveParams: ['expand'],
      });

      expect(rows).toHaveLength(1);
      expect(request).toHaveBeenCalledTimes(1);
    });
  });

  it('honors maxPages, stopping even though more pages exist', async () => {
    const request = routedRequest({
      [page1Url]: {
        success: true,
        data: [{ id: '00uFAKE1' }],
        headers: { link: nextLink(page2Url) },
      },
      [page2Url]: {
        success: true,
        data: [{ id: '00uFAKE2' }],
        headers: { link: nextLink('/api/v1/users?limit=200&after=cursor3') },
      },
    });

    const rows = await fetchAllPages<{ id: string }>(request, page1Url, { maxPages: 2 });

    expect(rows.map((r) => r.id)).toEqual(['00uFAKE1', '00uFAKE2']);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
