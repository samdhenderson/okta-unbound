/**
 * Okta URL detection — single source of truth.
 *
 * Replaces the ~15 copy-pasted `url.includes('okta.com') || …` checks across the
 * background, hooks, and components.
 *
 * @module oktaUrl
 */

/** Okta domain suffixes the extension operates on (matches manifest host permissions). */
const OKTA_DOMAINS = ['okta.com', 'oktapreview.com', 'okta-emea.com'] as const;

/**
 * True if `url` points at an Okta org (commercial, preview, or EMEA).
 * Tolerant of `null`/`undefined` so callers can pass `tab.url` directly.
 */
export function isOktaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return OKTA_DOMAINS.some((domain) => url.includes(domain));
}
