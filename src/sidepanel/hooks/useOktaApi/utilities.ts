/**
 * @module hooks/useOktaApi/utilities
 * @description Shared utility functions for API operations
 */

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
 * Recursively merge one app profile over another.
 *
 * @param baseProfile - Starting profile; copied, never mutated.
 * @param overrideProfile - Values layered on top of the base.
 * @param arrayStrategy - How to combine array-valued fields: `'replace'` (default)
 * swaps the whole array; `'merge'` unions and de-dupes with the base array.
 * @returns A new profile object with overrides applied.
 * @remarks `null`/`undefined` override values are skipped so the base value survives;
 * nested plain objects recurse with the same strategy; all other values are replaced.
 */
export function deepMergeProfiles(
  baseProfile: Record<string, unknown>,
  overrideProfile: Record<string, unknown>,
  arrayStrategy: 'merge' | 'replace' = 'replace',
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...baseProfile };

  for (const [key, overrideValue] of Object.entries(overrideProfile)) {
    const baseValue = result[key];

    // Skip null/undefined override values (keep base)
    if (overrideValue === null || overrideValue === undefined) {
      continue;
    }

    // Handle arrays (e.g., Salesforce permission sets)
    if (Array.isArray(overrideValue)) {
      if (arrayStrategy === 'merge' && Array.isArray(baseValue)) {
        // Merge arrays, dedupe
        result[key] = [...new Set([...baseValue, ...overrideValue])];
      } else {
        // Replace array entirely
        result[key] = [...overrideValue];
      }
    }
    // Handle nested objects (not arrays)
    else if (
      typeof overrideValue === 'object' &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMergeProfiles(
        (baseValue as Record<string, unknown> | null) || {},
        overrideValue as Record<string, unknown>,
        arrayStrategy,
      );
    }
    // Primitive values
    else {
      result[key] = overrideValue;
    }
  }

  return result;
}
