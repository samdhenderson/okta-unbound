import { describe, it, expect } from 'vitest';
import { userIdentity } from './userIdentity';
import type { OktaUser, UserStatus } from '../../../shared/types';

const makeUser = (overrides: Partial<OktaUser['profile']> = {}, status: UserStatus = 'ACTIVE') =>
  ({
    id: '00uFAKE9z8y7x6w5v',
    status,
    profile: {
      login: 'priya@example.com',
      email: 'priya@example.com',
      firstName: 'Priya',
      lastName: 'Raman',
      ...overrides,
    },
  }) as OktaUser;

describe('userIdentity', () => {
  it('carries the user id as the crossfade key and the display name as the title', () => {
    const identity = userIdentity(makeUser());

    expect(identity.key).toBe('00uFAKE9z8y7x6w5v');
    expect(identity.name).toBe('Priya Raman');
  });

  it('falls back to the login when the profile has no name', () => {
    const identity = userIdentity(makeUser({ firstName: '', lastName: '' }));

    expect(identity.name).toBe('priya@example.com');
  });

  it.each([
    ['ACTIVE', 'success'],
    ['PROVISIONED', 'info'],
    ['STAGED', 'neutral'],
    ['SUSPENDED', 'warning'],
    ['LOCKED_OUT', 'danger'],
    ['DEPROVISIONED', 'danger'],
  ] as const)('badges %s through the shared status vocabulary as %s', (status, variant) => {
    // The label stays the raw Okta string on purpose: those are the terms the Admin
    // Console uses, so humanising them would make the panel and Okta disagree.
    expect(userIdentity(makeUser({}, status)).badge).toEqual({ text: status, variant });
  });

  it('omits the count line entirely while memberships are still loading', () => {
    // Not `0 groups` — that reads as a fact about the user rather than about the fetch.
    expect(userIdentity(makeUser()).lines).toEqual([]);
  });

  it.each([
    [0, '0', 'groups'],
    [1, '1', 'group'],
    [1284, '1,284', 'groups'],
  ])('renders a known count of %i as "%s %s"', (groupCount, value, label) => {
    expect(userIdentity(makeUser(), { groupCount }).lines).toEqual([
      { kind: 'metric', icon: 'users', value, label },
    ]);
  });

  it('links to the user in the Admin Console', () => {
    expect(userIdentity(makeUser()).link).toEqual({
      entityType: 'user',
      entityId: '00uFAKE9z8y7x6w5v',
    });
  });
});
