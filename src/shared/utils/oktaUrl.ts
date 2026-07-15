/**
 * @module shared/utils/oktaUrl
 * @description Okta URL detection — single source of truth.
 *
 * Replaces the ~15 copy-pasted `url.includes('okta.com') || …` checks across the
 * background, hooks, and components.
 */

/** Okta domain suffixes the extension operates on (matches manifest host permissions). */
const OKTA_DOMAINS = ['okta.com', 'oktapreview.com', 'okta-emea.com'] as const;

/**
 * Whether `url` points at an Okta org (commercial, preview, or EMEA).
 *
 * Matches by substring against the known Okta domain suffixes, so it also accepts
 * org subdomains (e.g. `acme.okta.com`). Tolerant of `null`/`undefined` so callers
 * can pass `tab.url` directly.
 *
 * @param url - The URL to test, or nullish.
 * @returns `true` if the URL contains a known Okta domain; `false` otherwise.
 *
 * @example
 * isOktaUrl('https://acme.okta.com/admin'); // => true
 * isOktaUrl(undefined); // => false
 */
export function isOktaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return OKTA_DOMAINS.some((domain) => url.includes(domain));
}
