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

/**
 * The Okta org origin a URL belongs to.
 *
 * The counterpart to {@link isOktaUrl} for callers that need the origin itself —
 * the key the org snapshot is scoped by (ADR-0040). Same parsing rules, so a
 * caller never has to slice an origin out of a URL string by hand.
 *
 * @param url - The URL to read, or nullish.
 * @returns The `https://host` origin when the URL is an Okta org, else `null`.
 *
 * @example
 * oktaOriginOf('https://acme.okta.com/admin/groups'); // => 'https://acme.okta.com'
 * oktaOriginOf('https://okta.com.evil.com/'); // => null
 */
export function oktaOriginOf(url: string | null | undefined): string | null {
  if (!isOktaUrl(url)) return null;
  try {
    return new URL(url as string).origin;
  } catch {
    return null;
  }
}

/**
 * What to deep-link to — and, by its members, the only entity kinds that have an
 * Okta Admin Console deep link at all.
 *
 * A union rather than a `(type, id)` pair because the kinds do not take the same
 * inputs: an app's Admin Console route is keyed by the app **type** — its Okta
 * `name`, e.g. `oidc_client` or `salesforce` — as well as its instance id, and
 * the id alone cannot produce a working URL. Modelling that in the type is what
 * stops a caller from building an app link out of the id twice, which is the
 * shape this replaced and which 404'd on every app in the org.
 */
export type OktaAdminTarget =
  | { type: 'group'; id: string | null | undefined }
  | { type: 'user'; id: string | null | undefined }
  | {
      type: 'app';
      id: string | null | undefined;
      /**
       * The app's Okta `name` — the app type key, not its display label.
       * Nullish when the org did not report one (`oktaAppListItemSchema` catches
       * the field), in which case no link is built rather than a broken one.
       */
      name: string | null | undefined;
    };

/**
 * Build the Okta Admin Console deep link for a single entity.
 *
 * Centralizes the per-entity admin URL shapes that were previously duplicated
 * across the context banner and the overview cards, so every "Open in Okta"
 * affordance targets the same paths.
 *
 * @param origin - The Okta org origin (e.g. `https://acme.okta.com`), or nullish.
 * @param target - The entity to link to — see {@link OktaAdminTarget}.
 * @returns The absolute admin URL, or `null` when any part of the target is
 * missing. Withholding is deliberate: a link that cannot be built correctly is
 * not rendered at all.
 *
 * @example
 * oktaAdminEntityUrl('https://acme.okta.com', { type: 'user', id: '00u1' });
 * // => .../admin/user/profile/view/00u1
 * oktaAdminEntityUrl('https://acme.okta.com', { type: 'app', id: '0oa1', name: 'oidc_client' });
 * // => .../admin/app/oidc_client/instance/0oa1
 */
export function oktaAdminEntityUrl(
  origin: string | null | undefined,
  target: OktaAdminTarget,
): string | null {
  if (!origin || !target.id) return null;
  switch (target.type) {
    case 'group':
      return `${origin}/admin/group/${target.id}`;
    case 'user':
      return `${origin}/admin/user/profile/view/${target.id}`;
    case 'app':
      // No app type key, no link. The Admin Console has no id-only app route, so
      // the alternative is a URL that resolves to an error page.
      return target.name ? `${origin}/admin/app/${target.name}/instance/${target.id}` : null;
  }
}
