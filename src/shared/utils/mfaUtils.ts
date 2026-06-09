/**
 * @module shared/utils/mfaUtils
 * @description Pure helpers for classifying Okta MFA factors into factual,
 * human-friendly labels. No risk/strength scoring — the goal is simply to
 * record and filter by what each member has enrolled.
 */

import type { OktaFactor, MemberMfaResult } from '../types';

/**
 * Map an Okta factor (factorType + provider) to a friendly display label.
 * Falls back to a prettified version of the raw factorType for unknown types.
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
 * ACTIVE factors.
 */
export function isActiveMfaFactor(factor: OktaFactor): boolean {
  return factor.status === 'ACTIVE' && (factor.factorType || '').toLowerCase() !== 'password';
}

/**
 * Summarize a user's factors into a MemberMfaResult. Pure function.
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
