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
 * Parses the URL and matches its **hostname** against the known Okta domains
 * (exact or dot-separated subdomain, e.g. `acme.okta.com`) over HTTPS only.
 * Substring matching is deliberately avoided: `https://okta.com.evil.com/` and
 * `https://evil.com/?q=okta.com` must not pass, because this check gates which
 * tab the extension treats as the authenticated Okta session. Tolerant of
 * `null`/`undefined` so callers can pass `tab.url` directly; unparseable input
 * is not Okta.
 *
 * @param url - The URL to test, or nullish.
 * @returns `true` if the URL's hostname is a known Okta domain; `false` otherwise.
 *
 * @example
 * isOktaUrl('https://acme.okta.com/admin'); // => true
 * isOktaUrl('https://okta.com.evil.com/'); // => false
 * isOktaUrl(undefined); // => false
 */
export function isOktaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let hostname: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    hostname = parsed.hostname;
  } catch {
    return false;
  }
  return OKTA_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}
