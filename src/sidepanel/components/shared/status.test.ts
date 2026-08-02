/**
 * Tests for the shared user-status → variant map (ADR-0002 vocabulary).
 *
 * Pins every known Okta user status to its canonical variant — the single
 * source of truth converged onto by UserSearchResults, UserIdentity, and
 * MemberRow — plus the neutral fallback for unknown statuses.
 */
import { describe, it, expect } from 'vitest';
import { userStatusVariant } from './status';

describe('userStatusVariant', () => {
  it.each([
    ['ACTIVE', 'success'],
    ['PROVISIONED', 'info'],
    ['STAGED', 'neutral'],
    ['SUSPENDED', 'warning'],
    ['RECOVERY', 'info'],
    ['PASSWORD_EXPIRED', 'warning'],
    ['LOCKED_OUT', 'danger'],
    ['DEPROVISIONED', 'danger'],
  ] as const)('maps %s to %s', (status, variant) => {
    expect(userStatusVariant(status)).toBe(variant);
  });

  it('falls back to neutral for an unknown status', () => {
    expect(userStatusVariant('SOMETHING_NEW')).toBe('neutral');
    expect(userStatusVariant('')).toBe('neutral');
  });

  it('never returns the banned "error" vocabulary (ADR-0002)', () => {
    const statuses = [
      'ACTIVE',
      'PROVISIONED',
      'STAGED',
      'SUSPENDED',
      'RECOVERY',
      'PASSWORD_EXPIRED',
      'LOCKED_OUT',
      'DEPROVISIONED',
      'UNKNOWN',
    ];
    for (const status of statuses) {
      expect(userStatusVariant(status)).not.toBe('error');
    }
  });
});
