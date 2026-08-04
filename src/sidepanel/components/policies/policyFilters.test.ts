/**
 * Unit tests for the Auth Policies list's pure search filter.
 *
 * Mirrors `apps/appFilters.test.ts`. Fixtures use fake placeholders (`rstFAKE…`)
 * per CLAUDE.md.
 */
import { describe, it, expect } from 'vitest';
import { filterPolicies } from './policyFilters';
import type { OktaPolicyListItem } from '../../../shared/schemas/okta';

const policies: OktaPolicyListItem[] = [
  {
    id: 'rstFAKE000000000001',
    name: 'Any two factors',
    description: 'Requires MFA for contractors',
    status: 'ACTIVE',
    type: 'ACCESS_POLICY',
  },
  {
    id: 'rstFAKE000000000002',
    name: 'Password only',
    description: 'Legacy sign-on',
    status: 'INACTIVE',
    type: 'ACCESS_POLICY',
  },
  { id: 'rstFAKE000000000003', name: 'Default Policy', status: 'ACTIVE', type: 'ACCESS_POLICY' },
];

describe('filterPolicies', () => {
  it('returns the input untouched for a blank query', () => {
    // Reference identity matters: a memoized caller depends on it.
    expect(filterPolicies(policies, '')).toBe(policies);
    expect(filterPolicies(policies, '   ')).toBe(policies);
  });

  it('matches on name, case-insensitively', () => {
    expect(filterPolicies(policies, 'PASSWORD').map((p) => p.id)).toEqual(['rstFAKE000000000002']);
  });

  it('matches on description too', () => {
    expect(filterPolicies(policies, 'contractors').map((p) => p.id)).toEqual([
      'rstFAKE000000000001',
    ]);
  });

  it('tolerates a missing description', () => {
    // `description` is optional on the lenient schema (ADR-0006).
    expect(filterPolicies(policies, 'default').map((p) => p.id)).toEqual(['rstFAKE000000000003']);
  });

  it('preserves the incoming (priority) order', () => {
    expect(filterPolicies(policies, 'o').map((p) => p.id)).toEqual([
      'rstFAKE000000000001',
      'rstFAKE000000000002',
      'rstFAKE000000000003',
    ]);
  });

  it('returns nothing when no policy matches', () => {
    expect(filterPolicies(policies, 'no-such-policy')).toEqual([]);
  });

  it('trims the query before matching', () => {
    expect(filterPolicies(policies, '  password  ').map((p) => p.id)).toEqual([
      'rstFAKE000000000002',
    ]);
  });
});
