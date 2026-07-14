import { describe, it, expect } from 'vitest';
import { factorLabel, isActiveMfaFactor, summarizeFactors } from './mfaUtils';
import type { OktaFactor } from '../types';

const factor = (overrides: Partial<OktaFactor>): OktaFactor => ({
  id: 'f1',
  factorType: 'sms',
  provider: 'OKTA',
  status: 'ACTIVE',
  ...overrides,
});

describe('factorLabel', () => {
  it('maps known factor types to friendly labels', () => {
    expect(factorLabel('push', 'OKTA')).toBe('Okta Verify Push');
    expect(factorLabel('signed_nonce', 'OKTA')).toBe('Okta Verify (Fastpass)');
    expect(factorLabel('sms', 'OKTA')).toBe('SMS');
    expect(factorLabel('call', 'OKTA')).toBe('Voice Call');
    expect(factorLabel('question', 'OKTA')).toBe('Security Question');
    expect(factorLabel('webauthn', 'FIDO')).toBe('Security Key (WebAuthn)');
  });

  it('distinguishes TOTP providers', () => {
    expect(factorLabel('token:software:totp', 'OKTA')).toBe('Okta Verify (TOTP)');
    expect(factorLabel('token:software:totp', 'GOOGLE')).toBe('Google Authenticator');
    expect(factorLabel('token:software:totp', 'OTHER')).toBe('Authenticator App (TOTP)');
  });

  it('prettifies unknown factor types', () => {
    expect(factorLabel('custom:thing', 'OKTA')).toBe('Custom Thing');
    expect(factorLabel('', '')).toBe('Unknown');
  });
});

describe('isActiveMfaFactor', () => {
  it('only counts ACTIVE non-password factors', () => {
    expect(isActiveMfaFactor(factor({ status: 'ACTIVE' }))).toBe(true);
    expect(isActiveMfaFactor(factor({ status: 'PENDING_ACTIVATION' }))).toBe(false);
    expect(isActiveMfaFactor(factor({ factorType: 'password', status: 'ACTIVE' }))).toBe(false);
  });
});

describe('summarizeFactors', () => {
  it('reports no enrollment for an empty factor list', () => {
    const result = summarizeFactors('u1', []);
    expect(result).toEqual({
      userId: 'u1',
      factors: [],
      enrolled: false,
      factorCount: 0,
      factorLabels: [],
    });
  });

  it('counts active factors and dedupes/sorts labels', () => {
    const factors = [
      factor({ id: '1', factorType: 'push', provider: 'OKTA' }),
      factor({ id: '2', factorType: 'sms', provider: 'OKTA' }),
      factor({ id: '3', factorType: 'sms', provider: 'OKTA' }), // duplicate label
      factor({ id: '4', factorType: 'token:software:totp', status: 'PENDING_ACTIVATION' }), // inactive
    ];
    const result = summarizeFactors('u2', factors);
    expect(result.enrolled).toBe(true);
    expect(result.factorCount).toBe(3); // 3 active (push + 2 sms)
    expect(result.factorLabels).toEqual(['Okta Verify Push', 'SMS']); // sorted, deduped
  });

  it('ignores the password factor for enrollment', () => {
    const result = summarizeFactors('u3', [factor({ factorType: 'password', status: 'ACTIVE' })]);
    expect(result.enrolled).toBe(false);
    expect(result.factorCount).toBe(0);
  });
});
