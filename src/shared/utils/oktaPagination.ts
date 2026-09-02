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
 * Every raw value a query parameter carries, in order, **without decoding it**.
 *
 * Deliberately a hand-rolled scan rather than `URLSearchParams`: values are
 * returned as the exact bytes they appear as, so re-appending one elsewhere can
 * never re-encode an opaque Okta cursor (a `+` in a base64-ish `after` token
 * would decode to a space and round-trip wrong).
 *
 * Returns every occurrence, not the first: a parameter may legitimately repeat
 * (`/api/v1/groups?expand=stats&expand=app` asks for two embeds), and reading
 * only the first would let the second be silently dropped.
 *
 * @param url - Origin-relative URL (`/path?a=1&a=2&b=3`).
 * @param name - Parameter name to look for.
 * @returns The raw (still percent-encoded) values, `''` for a valueless
 * occurrence; `[]` when the parameter is absent.
 */
function rawQueryParamAll(url: string, name: string): string[] {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return [];

  const values: string[] = [];
  for (const pair of url.slice(queryStart + 1).split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    if (key === name) values.push(eq === -1 ? '' : pair.slice(eq + 1));
  }
  return values;
}

/**
 * Re-apply named query parameters that the first page carried but Okta dropped
 * from its `rel="next"` link.
 *
 * Okta echoes *public* expand parameters into the next link (`expand=stats` on
 * `/api/v1/groups` does survive), but not every one of them: the admin console's
 * private `expand=group-rules` on the group-members listing is silently dropped,
 * so page 2+ would come back without the embed — a silently split answer.
 *
 * Purely additive: a value already present on `nextUrl` is left exactly as Okta
 * wrote it (no duplicate, no re-encode), and a value absent from `firstUrl` is
 * not invented. When nothing needs re-applying the input string is returned
 * unchanged, byte for byte.
 *
 * **Repeats are handled per value, not per name.** `expand=stats&expand=app`
 * asks for two embeds, and Okta may echo one and drop the other — as it does on
 * `/api/v1/groups`, where `stats` survives the `rel="next"` link. Comparing by
 * name alone would see `expand` present, conclude nothing was dropped, and lose
 * the second embed on every page after the first.
 *
 * @param nextUrl - The next-page URL parsed out of the `Link` header.
 * @param firstUrl - The URL whose parameters are the source of truth.
 * @param names - Parameter names to preserve.
 * @returns `nextUrl`, with any missing value of a named parameter appended.
 */
function preserveQueryParams(nextUrl: string, firstUrl: string, names: string[]): string {
  let result = nextUrl;
  for (const name of names) {
    const present = rawQueryParamAll(result, name);
    for (const value of rawQueryParamAll(firstUrl, name)) {
      if (present.includes(value)) continue;
      result += `${result.includes('?') ? '&' : '?'}${name}=${value}`;
      present.push(value);
    }
  }
  return result;
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
  /**
   * HTTP status of the page request, when the transport supplied one — a real
   * status (401, 403, 429…) on failure, or `NO_HTTP_STATUS` when the request
   * never produced a response at all. Optional so a transport that predates
   * this field (or a test's hand-built result) still satisfies the shape; a
   * caller that cares about *why* a walk stopped should treat an absent status
   * the same as an unknown one, not as success.
   */
  status?: number;
}

/**
 * Thrown by {@link fetchAllPages} when a page request fails, carrying the same
 * status the failing {@link PaginatedPageResult} reported.
 *
 * A plain `Error` cannot say *why* a walk stopped — a 401, a 429 and a
 * transport failure with no HTTP response at all would all arrive at a
 * `catch` block looking identical. Callers that need to distinguish them
 * (`shared/snapshot/snapshotSync`'s `WalkOutcome.status`) narrow on
 * `error instanceof PaginatedFetchError` rather than re-deriving a status from
 * the message string.
 */
export class PaginatedFetchError extends Error {
  /** The failing page's HTTP status, or `undefined` when none was reported. */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PaginatedFetchError';
    this.status = status;
  }
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
  /**
   * Query parameter names that must survive onto every page.
   *
   * Okta does not always echo a first-page parameter into its `rel="next"` link
   * — notably the admin console's private `expand=group-rules` on the
   * group-members listing — which would leave the walk's later pages missing
   * data the first page had. Each named parameter present on `firstUrl` and
   * absent from the next link is re-appended; one already present is left
   * untouched (never duplicated, never re-encoded).
   *
   * **Opt-in.** Omit it (every caller but `getAllGroupMembers`) and the walk's
   * URLs are byte-for-byte the ones Okta handed back, exactly as before.
   */
  preserveParams?: string[];
  /**
   * Called after each page with the URL the walk will fetch next, or `null` when
   * the page just handled was the last one.
   *
   * Exists so a caller that persists progress can record a resume point without
   * re-implementing the walk. The background org snapshot uses it to survive an
   * MV3 worker suspension mid-walk; every other caller omits it and is unaffected.
   */
  onCursor?: (nextUrl: string | null, pageNumber: number) => void;
  /**
   * Where {@link preserveParams} reads its values from, when that is not
   * `firstUrl`.
   *
   * A **resumed** walk starts at a cursor URL rather than at the collection's
   * canonical first URL, so the parameters to re-apply must come from the
   * canonical URL — reading them from the cursor would re-apply only whatever
   * Okta had already echoed, which is exactly the set that does not need
   * re-applying. Defaults to `firstUrl`, so a normal walk is unchanged.
   */
  paramSource?: string;
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
 * @throws {@link PaginatedFetchError} when any page returns `success: false` —
 * the message is the response's `error`, else `options.errorMessage`, else a
 * generic label, and `status` carries the response's HTTP status (or
 * `undefined`) so a caller can tell *why* the walk stopped. Callers that
 * prefer partial results accumulate via `onPage` and catch.
 * @remarks The termination guard keys off the RAW page length (before schema
 * validation), so an all-malformed page still advances the cursor rather than
 * silently truncating the walk.
 */
export async function fetchAllPages<T = unknown>(
  request: (url: string) => Promise<PaginatedPageResult>,
  firstUrl: string,
  options: FetchAllPagesOptions<T> = {},
): Promise<T[]> {
  const { onPage, onBeforePage, onCursor, schema, maxPages, errorMessage, preserveParams } =
    options;
  const paramSource = options.paramSource ?? firstUrl;
  const context = options.context ?? firstUrl.split('?')[0];
  const all: T[] = [];
  let url: string | null = firstUrl;
  let pageCount = 0;

  while (url) {
    pageCount++;
    onBeforePage?.(pageCount);

    const response = await request(url);
    if (!response.success) {
      throw new PaginatedFetchError(
        response.error || errorMessage || `Paginated fetch failed (${context})`,
        response.status,
      );
    }

    const rawPageSize = Array.isArray(response.data) ? response.data.length : 0;
    const items: T[] = schema
      ? parseOktaList(schema, response.data, context)
      : ((Array.isArray(response.data) ? response.data : []) as T[]);
    all.push(...items);
    onPage?.(items, all.length);

    if (maxPages !== undefined && pageCount >= maxPages) {
      // A capped walk stopped early by choice, not by exhaustion. Report no
      // cursor: the caller asked for N pages and got them.
      onCursor?.(null, pageCount);
      break;
    }

    const rawNext = nextPageUrl(url, response.headers?.link, rawPageSize);
    const next =
      rawNext !== null && preserveParams?.length
        ? preserveQueryParams(rawNext, paramSource, preserveParams)
        : rawNext;
    // Re-run the non-advancing-cursor guard against the *preserved* URL. Once a
    // parameter is re-appended, a self-referential next link no longer equals
    // `url` inside nextPageUrl, so that check has to happen again out here or an
    // opt-in caller could page forever. A no-op when preserveParams is omitted:
    // nextPageUrl already proved `next !== url`.
    url = next === url ? null : next;
    // Reported after the guards, so the cursor a caller persists is the one the
    // walk will actually fetch — never a self-referential link it is about to
    // reject, which on resume would page against itself forever.
    onCursor?.(url, pageCount);
  }

  return all;
}
