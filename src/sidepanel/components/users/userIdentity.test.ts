import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { userIdentity, type UserIdentityOptions } from './userIdentity';
import type { OktaUser, UserStatus } from '../../../shared/types';

// Relative timestamps are computed against "now", so the clock is pinned.
const NOW = new Date('2026-08-15T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

const makeUser = (overrides: Partial<OktaUser> = {}, status: UserStatus = 'ACTIVE') =>
  ({
    id: '00uFAKE9z8y7x6w5v',
    status,
    ...overrides,
    profile: {
      login: 'priya@example.com',
      email: 'priya@example.com',
      firstName: 'Priya',
      lastName: 'Raman',
      ...overrides.profile,
    },
  }) as OktaUser;

/** The three rows a user descriptor always has: identity, counts, timestamps. */
const rowsOf = (user: OktaUser, options?: UserIdentityOptions) => {
  const [identity, counts, timestamps] = userIdentity(user, options).rows;
  return { identity, counts, timestamps };
};

describe('userIdentity', () => {
  it('carries the user id as the crossfade key and the display name as the title', () => {
    const identity = userIdentity(makeUser());

    expect(identity.key).toBe('00uFAKE9z8y7x6w5v');
    expect(identity.name).toBe('Priya Raman');
  });

  it('falls back to the login when the profile has no name', () => {
    expect(userIdentity(makeUser({ profile: { firstName: '', lastName: '' } as never })).name).toBe(
      'priya@example.com',
    );
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

  it('opens with the copyable user id', () => {
    expect(rowsOf(makeUser()).identity).toEqual([
      { kind: 'id', value: '00uFAKE9z8y7x6w5v', copyLabel: 'Copy user id' },
    ]);
  });

  it('omits the group count entirely while memberships are still loading', () => {
    // Not `0 groups` — that reads as a fact about the user rather than about the fetch.
    expect(rowsOf(makeUser()).counts).toEqual([]);
  });

  it.each([
    [0, '0', 'groups'],
    [1, '1', 'group'],
    [1284, '1,284', 'groups'],
  ])('renders a known count of %i as "%s %s"', (groupCount, value, label) => {
    expect(rowsOf(makeUser(), { groupCount }).counts[0]).toMatchObject({
      icon: 'users',
      value,
      label,
    });
  });

  it('omits the app count entirely while the apps request is still outstanding', () => {
    // The header must not say "0 apps" about a question the panel has not asked yet.
    // Only `groupCount` was supplied, so the counts row carries exactly that one fact.
    const counts = rowsOf(makeUser(), { groupCount: 3 }).counts;

    expect(counts).toEqual([expect.objectContaining({ icon: 'users' })]);
    expect(counts).not.toContainEqual(expect.objectContaining({ icon: 'app' }));
  });

  it.each([
    [0, '0', 'apps'],
    [1, '1', 'app'],
    [1284, '1,284', 'apps'],
  ])('renders a known app count of %i as "%s %s"', (appCount, value, label) => {
    // Zero is a real answer once the list has loaded — the omission above is about
    // not having asked, not about having no apps.
    expect(rowsOf(makeUser(), { groupCount: 3, appCount }).counts).toContainEqual(
      expect.objectContaining({ kind: 'metric', icon: 'app', value, label }),
    );
  });

  it('puts apps after groups on the counts row', () => {
    expect(
      rowsOf(makeUser(), { groupCount: 3, appCount: 7 }).counts.map((fact) =>
        fact.kind === 'metric' ? fact.icon : fact.kind,
      ),
    ).toEqual(['users', 'app']);
  });

  it('reports an app count even when the group count has not landed', () => {
    // The two facts are independent fetches; neither gates the other.
    expect(rowsOf(makeUser(), { appCount: 7 }).counts).toEqual([
      expect.objectContaining({ icon: 'app', value: '7', label: 'apps' }),
    ]);
  });

  it('reports the rules that grant this user membership, when Okta named any', () => {
    const user = makeUser({
      managedBy: { rules: [{ id: '0prA', name: 'Engineers' }] },
    });

    expect(rowsOf(user, { groupCount: 42 }).counts).toContainEqual(
      expect.objectContaining({ icon: 'bolt', value: '1', label: 'rule' }),
    );
  });

  it('says nothing about rules when the membership analysis has not run', () => {
    expect(rowsOf(makeUser(), { groupCount: 42 }).counts).toHaveLength(1);
  });

  it('states a null last login as "never" rather than dropping the fact', () => {
    // `null` is Okta answering the question; `undefined` is Okta not being asked.
    expect(rowsOf(makeUser({ lastLogin: null })).timestamps[0]).toMatchObject({
      text: 'Last login never',
    });
  });

  it('renders a known last login as recency', () => {
    expect(rowsOf(makeUser({ lastLogin: daysAgo(2) })).timestamps[0]).toMatchObject({
      icon: 'clock',
      text: 'Last login 2 days ago',
    });
  });

  it('leaves the timestamp row empty when the payload carried no dates', () => {
    expect(rowsOf(makeUser()).timestamps).toEqual([]);
  });

  it('links to the user in the Admin Console', () => {
    expect(userIdentity(makeUser()).link).toEqual({
      entityType: 'user',
      entityId: '00uFAKE9z8y7x6w5v',
    });
  });
});
