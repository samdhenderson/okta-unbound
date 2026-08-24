/**
 * @module shared/utils/redact
 * @description Pattern-based redaction of PII and Okta entity identifiers from arbitrary JSON.
 *
 * Built for the API Explorer's response viewer: walks a parsed JSON value and, for
 * every string leaf, swaps the live org's own hostname, email addresses, phone
 * numbers, and Okta-ID-shaped substrings for stable placeholders (`<EMAIL>`,
 * `<GROUP_ID>`, …) so a response can be copied out of the extension without
 * carrying live-org data with it.
 *
 * Deliberately pattern-based, not field-name-based: a value is redacted because of
 * its *shape*, never because of the key it sits under. This catches the identifiers
 * that turn up unpredictably in `_links`/`_embedded` regardless of field name, but
 * it does not catch unstructured PII with no matching pattern (a bare city or
 * person name) — an accepted limitation for a "safe enough to paste" tool, not a
 * compliance-grade DLP system. See the API Explorer ADR for the full rationale.
 */

/** One redaction pass over a JSON value, plus how many substitutions it made. */
export interface RedactionResult {
  data: unknown;
  redactedCount: number;
}

/** Matches an email address anywhere inside a longer string. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Matches a phone number that carries a separator (space/dash/dot, or a leading
 * `+`) between digit groups. Deliberately does not match a bare unseparated digit
 * run — that would false-positive on counts, timestamps, and numeric ids.
 */
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;

/**
 * Known Okta entity id prefixes mapped to a readable placeholder label. `rst` is
 * included alongside `00p` because this codebase's own `POLICY_ID_PATTERN`
 * (`useOktaApi/policyOperations.ts`) already treats both as policy ids.
 */
const KNOWN_OKTA_ID_PREFIXES: ReadonlyArray<readonly [prefix: string, label: string]> = [
  ['00u', 'USER_ID'],
  ['00g', 'GROUP_ID'],
  ['0oa', 'APP_ID'],
  ['00p', 'POLICY_ID'],
  ['rst', 'POLICY_ID'],
  ['aus', 'AUTH_SERVER_ID'],
];

/**
 * Matches a known-prefix Okta id; capture group 1 is the prefix. The 17-char
 * fixed body (not a range) reflects Okta's actual generated-id length — every
 * known prefix here is 3 characters, so the full match is exactly 20 characters,
 * same as a real Okta id.
 */
const KNOWN_ID_RE = new RegExp(
  `\\b(${KNOWN_OKTA_ID_PREFIXES.map(([prefix]) => prefix).join('|')})[A-Za-z0-9]{17}\\b`,
  'g',
);

/**
 * Fallback for an Okta-id-shaped token whose prefix isn't in
 * {@link KNOWN_OKTA_ID_PREFIXES}: a 3-character lowercase-start prefix (Okta ids
 * always start lowercase) followed by exactly 17 more alphanumeric characters —
 * 20 characters total, matching the real length of Okta's generated ids exactly
 * rather than an open-ended minimum. This narrows, but cannot eliminate, the risk
 * of relabeling an unrelated token that happens to be exactly Okta-id-shaped
 * (e.g. a 20-char lowercase-start hash); that residual risk is an accepted
 * limitation of a pattern-based, field-name-blind redactor.
 */
const GENERIC_ID_RE = /\b[a-z][a-z0-9]{2}[A-Za-z0-9]{17}\b/g;

/** Escape a string for safe interpolation into a `RegExp` source. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Best-effort hostname extraction from an Okta org origin (`https://acme.okta.com`
 * → `acme.okta.com`). Falls back to stripping a leading scheme if `URL` parsing
 * fails, so a bare hostname passed in by mistake still works.
 */
function extractHostname(oktaOrigin: string): string | null {
  try {
    return new URL(oktaOrigin).hostname || null;
  } catch {
    const stripped = oktaOrigin.replace(/^[a-z]+:\/\//i, '').split('/')[0];
    return stripped || null;
  }
}

/**
 * Redact one string value in place, in order: org hostname, email, phone, known
 * Okta id prefixes, then the generic id fallback. Order matters — email before
 * phone so a phone-shaped digit run embedded in an email local-part is claimed by
 * the email match first; known ids before the generic fallback so a recognized
 * prefix gets its specific label instead of the generic one.
 */
function redactString(input: string, orgHostname: string | null, bump: () => void): string {
  let out = input;

  if (orgHostname) {
    const hostRe = new RegExp(escapeRegExp(orgHostname), 'g');
    out = out.replace(hostRe, () => {
      bump();
      return '<OKTA_ORG>';
    });
  }

  out = out.replace(EMAIL_RE, () => {
    bump();
    return '<EMAIL>';
  });

  out = out.replace(PHONE_RE, () => {
    bump();
    return '<PHONE>';
  });

  out = out.replace(KNOWN_ID_RE, (_match, prefix: string) => {
    bump();
    const label = KNOWN_OKTA_ID_PREFIXES.find(([p]) => p === prefix)?.[1] ?? 'OKTA_ID';
    return `<${label}>`;
  });

  out = out.replace(GENERIC_ID_RE, () => {
    bump();
    return '<OKTA_ID>';
  });

  return out;
}

/** Recursively redact every string leaf of an arbitrary JSON value. */
function walk(value: unknown, orgHostname: string | null, bump: () => void): unknown {
  if (typeof value === 'string') return redactString(value, orgHostname, bump);
  if (Array.isArray(value)) return value.map((item) => walk(item, orgHostname, bump));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, walk(item, orgHostname, bump)]),
    );
  }
  // Numbers, booleans, and null are left untouched — status enums, counts, and
  // flags aren't PII and stay useful signal in the redacted view.
  return value;
}

/**
 * Redact PII and Okta entity ids from an arbitrary parsed JSON value.
 *
 * @param value - Parsed JSON (object, array, or primitive) to redact.
 * @param oktaOrigin - The live org's origin (e.g. `https://acme.okta.com`), used to
 * scrub the org's own hostname out of embedded URLs (`_links.self.href` and
 * similar). Omit when unavailable — hostname redaction is simply skipped.
 * @returns The redacted value plus a count of substitutions made, for a UI badge.
 *
 * @example
 * ```ts
 * const { data, redactedCount } = redactJson(response.data, oktaOrigin);
 * ```
 */
export function redactJson(value: unknown, oktaOrigin?: string): RedactionResult {
  let redactedCount = 0;
  const orgHostname = oktaOrigin ? extractHostname(oktaOrigin) : null;
  const data = walk(value, orgHostname, () => {
    redactedCount += 1;
  });
  return { data, redactedCount };
}
