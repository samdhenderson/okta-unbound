/**
 * @module shared/utils/mfaUtils
 * @description Pure helpers for classifying Okta MFA factors into factual,
 * human-friendly labels. No risk/strength scoring — the goal is simply to
 * record and filter by what each member has enrolled.
 */

import type { OktaFactor, MemberMfaResult } from '../types';

/**
 * Map an Okta factor (`factorType` + `provider`) to a friendly display label.
 *
 * Known types get curated labels (e.g. `push` → "Okta Verify Push"); TOTP labels
 * are further disambiguated by provider. Unknown types fall back to a prettified
 * version of the raw `factorType`.
 *
 * @param factorType - The Okta factor type, e.g. `'push'` or `'token:software:totp'`.
 * @param provider - Optional Okta provider, e.g. `'GOOGLE'` or `'OKTA'`.
 * @returns A human-friendly label; `'Unknown'` if `factorType` is empty.
 *
 * @example
 * factorLabel('token:software:totp', 'GOOGLE'); // => 'Google Authenticator'
 * factorLabel('webauthn'); // => 'Security Key (WebAuthn)'
 */
export function factorLabel(factorType: string, provider?: string): string {
  const type = (factorType || '').toLowerCase();
  const prov = (provider || '').toUpperCase();

  switch (type) {
    case 'push':
      return 'Okta Verify Push';
    case 'signed_nonce':
      return 'Okta Verify (Fastpass)';
    case 'token:software:totp':
      if (prov === 'GOOGLE') return 'Google Authenticator';
      if (prov === 'OKTA') return 'Okta Verify (TOTP)';
      return 'Authenticator App (TOTP)';
    case 'token:hardware':
      return 'Hardware Token';
    case 'token':
      return 'Token';
    case 'sms':
      return 'SMS';
    case 'call':
      return 'Voice Call';
    case 'email':
      return 'Email';
    case 'question':
      return 'Security Question';
    case 'webauthn':
    case 'u2f':
    case 'fido':
      return 'Security Key (WebAuthn)';
    default: {
      // Prettify unknown factor types, e.g. "custom:foo" -> "Custom Foo"
      const cleaned = type.replace(/[:_]+/g, ' ').trim();
      if (!cleaned) return 'Unknown';
      return cleaned
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }
}

/**
 * Whether a factor counts toward MFA enrollment. Excludes the `password`
 * factor (which is base credentials, not a second factor) and only counts
 * `ACTIVE` factors.
 *
 * @param factor - The Okta factor to test.
 * @returns `true` if the factor is active and is not a password factor.
 */
export function isActiveMfaFactor(factor: OktaFactor): boolean {
  return factor.status === 'ACTIVE' && (factor.factorType || '').toLowerCase() !== 'password';
}

/**
 * Summarize a user's factors into a {@link MemberMfaResult}. Pure function.
 *
 * Counts only {@link isActiveMfaFactor | active MFA factors} and collects their
 * de-duplicated, sorted {@link factorLabel | labels}. The full `factors` array is
 * preserved on the result unchanged.
 *
 * @param userId - The Okta user id the factors belong to.
 * @param factors - The user's factors (nullish is treated as empty).
 * @returns The per-member MFA summary (`enrolled`, `factorCount`, `factorLabels`).
 */
export function summarizeFactors(userId: string, factors: OktaFactor[]): MemberMfaResult {
  const active = (factors || []).filter(isActiveMfaFactor);
  const labels = new Set<string>();
  active.forEach((f) => labels.add(factorLabel(f.factorType, f.provider)));

  return {
    userId,
    factors: factors || [],
    enrolled: active.length > 0,
    factorCount: active.length,
    factorLabels: Array.from(labels).sort(),
  };
}
