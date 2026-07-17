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

/** Entity kinds that have an Okta Admin Console deep link. */
export type OktaAdminEntityType = 'group' | 'user' | 'app';

/**
 * Build the Okta Admin Console deep link for a single entity.
 *
 * Centralizes the per-entity admin URL shapes that were previously duplicated
 * across the context banner and the overview cards, so every "Open in Okta"
 * affordance targets the same paths.
 *
 * @param origin - The Okta org origin (e.g. `https://acme.okta.com`), or nullish.
 * @param type - The entity kind to link to.
 * @param id - The entity's Okta id, or nullish.
 * @returns The absolute admin URL, or `null` when `origin` or `id` is missing.
 *
 * @example
 * oktaAdminEntityUrl('https://acme.okta.com', 'user', '00u1'); // .../admin/user/profile/view/00u1
 */
export function oktaAdminEntityUrl(
  origin: string | null | undefined,
  type: OktaAdminEntityType,
  id: string | null | undefined,
): string | null {
  if (!origin || !id) return null;
  switch (type) {
    case 'group':
      return `${origin}/admin/group/${id}`;
    case 'user':
      return `${origin}/admin/user/profile/view/${id}`;
    case 'app':
      return `${origin}/admin/app/${id}/instance/${id}`;
  }
}
