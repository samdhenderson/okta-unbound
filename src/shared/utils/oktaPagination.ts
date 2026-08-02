/**
 * @module shared/utils/oktaPagination
 * @description The canonical Okta `Link`-header pagination module: `parseNextLink`
 * (header parsing), the loop-guarded `nextPageUrl` (never pages forever), the
 * standard {@link OKTA_PAGE_SIZE}, and the {@link fetchAllPages} walk helper.
 *
 * Every pagination loop in the extension — side panel and content script — should
 * build on this module instead of re-implementing the header parse or the
 * `while (nextUrl)` walk.
 */

import type { z } from 'zod';
import { parseOktaList } from '../schemas/okta';

/**
 * The standard page size for Okta list endpoints (`?limit=200`) — the maximum
 * most collection endpoints accept, so a full walk issues the fewest requests.
 */
export const OKTA_PAGE_SIZE = 200;

/**
 * Extract the `rel="next"` pagination target from an Okta `Link` response header.
 *
 * @param linkHeader - Raw `Link` header value (may contain multiple comma-separated links).
 * @returns The next page as an origin-relative `pathname + search` string, or `null`
 * when there is no next page. Returning a relative path lets the caller re-issue it
 * through `CoreApi.makeApiRequest` without leaking the absolute Okta origin.
 */
export function parseNextLink(linkHeader?: string): string | null {
  if (!linkHeader) return null;

  const links = linkHeader.split(',');
  for (const link of links) {
    if (link.includes('rel="next"')) {
      const match = link.match(/<([^>]+)>/);
      if (match) {
        const fullUrl = new URL(match[1]);
        return fullUrl.pathname + fullUrl.search;
      }
    }
  }
  return null;
}

/**
 * Decide the next page URL for a `Link`-header pagination loop, guarding against
 * Okta returning a `rel="next"` link that would never terminate.
 *
 * Standard cursor pagination stops when the last page omits the `next` link, but
 * some list endpoints have been observed to hand back a `next` link on an empty
 * or self-referential final page — a `while (nextUrl)` loop that trusts the link
 * alone then pages forever, flooding the scheduler. This stops when there is no
 * next link, when the returned page was empty (no further data), or when the
 * cursor did not advance (`next === current`).
 *
 * @param currentUrl - The URL that produced this page.
 * @param linkHeader - The page response's raw `Link` header.
 * @param pageSize - Number of items the page returned.
 * @returns The next page URL, or `null` to stop paginating.
 */
export function nextPageUrl(
  currentUrl: string,
  linkHeader: string | undefined,
  pageSize: number,
): string | null {
  if (pageSize === 0) return null;
  const next = parseNextLink(linkHeader);
  if (!next || next === currentUrl) return null;
  return next;
}

/**
 * The per-page transport result {@link fetchAllPages} consumes — a structural
 * subset of the scheduler's `RequestResult` (`shared/scheduler/types`) and the
 * content script's `ApiResponse`, so both transports plug in unchanged.
 */
export interface PaginatedPageResult {
  /** Whether the page request succeeded. */
  success: boolean;
  /** Raw response payload; expected to be the page's item array. */
  data?: unknown;
  /** Response headers (the `link` header drives pagination). */
  headers?: Record<string, string>;
  /** Transport/HTTP error message when `success` is `false`. */
  error?: string;
}

/** Options for {@link fetchAllPages}. */
export interface FetchAllPagesOptions<T> {
  /** Called after each page with that page's (validated) items and the running total. */
  onPage?: (items: T[], totalSoFar: number) => void;
  /** Called before each page request with the 1-based page number (progress messaging). */
  onBeforePage?: (pageNumber: number) => void;
  /**
   * Per-item zod schema applied to each page via `parseOktaList` — lenient
   * semantics, so malformed rows are dropped (and counted in a log warning),
   * never thrown on (ADR-0006).
   */
  schema?: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** Hard cap on the number of pages fetched; unlimited when omitted. */
  maxPages?: number;
  /** Label for validation/log messages; defaults to the first URL's path (query stripped). */
  context?: string;
  /** Error message thrown for a failed page whose response carries no `error`. */
  errorMessage?: string;
}

/**
 * Fetch every page of an Okta list endpoint, following `Link` pagination with the
 * {@link nextPageUrl} guard (stops on a missing next link, an empty page, or a
 * non-advancing cursor — so a misbehaving endpoint can never loop forever).
 *
 * @param request - Issues one page request (e.g. a `CoreApi.makeApiRequest`
 * wrapper); its result is any {@link PaginatedPageResult}-shaped object.
 * @param firstUrl - Origin-relative URL of the first page.
 * @param options - See {@link FetchAllPagesOptions}.
 * @returns All items accumulated across pages (validated when `schema` is given).
 * @throws Error when any page returns `success: false` — the message is the
 * response's `error`, else `options.errorMessage`, else a generic label. Callers
 * that prefer partial results accumulate via `onPage` and catch.
 * @remarks The termination guard keys off the RAW page length (before schema
 * validation), so an all-malformed page still advances the cursor rather than
 * silently truncating the walk.
 */
export async function fetchAllPages<T = unknown>(
  request: (url: string) => Promise<PaginatedPageResult>,
  firstUrl: string,
  options: FetchAllPagesOptions<T> = {},
): Promise<T[]> {
  const { onPage, onBeforePage, schema, maxPages, errorMessage } = options;
  const context = options.context ?? firstUrl.split('?')[0];
  const all: T[] = [];
  let url: string | null = firstUrl;
  let pageCount = 0;

  while (url) {
    pageCount++;
    onBeforePage?.(pageCount);

    const response = await request(url);
    if (!response.success) {
      throw new Error(response.error || errorMessage || `Paginated fetch failed (${context})`);
    }

    const rawPageSize = Array.isArray(response.data) ? response.data.length : 0;
    const items: T[] = schema
      ? parseOktaList(schema, response.data, context)
      : ((Array.isArray(response.data) ? response.data : []) as T[]);
    all.push(...items);
    onPage?.(items, all.length);

    if (maxPages !== undefined && pageCount >= maxPages) break;
    url = nextPageUrl(url, response.headers?.link, rawPageSize);
  }

  return all;
}
