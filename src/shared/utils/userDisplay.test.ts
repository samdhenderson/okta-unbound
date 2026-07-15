import { describe, it, expect } from 'vitest';
import { userDisplayName, initialsOf, hueFromId } from './userDisplay';
import type { OktaUser } from '../types';

const user = (profile: Partial<OktaUser['profile']> & { id?: string } = {}): OktaUser => ({
  id: profile.id ?? 'u1',
  status: 'ACTIVE',
  profile: {
    login: profile.login ?? '',
    email: profile.email ?? '',
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
  },
});

describe('userDisplayName', () => {
  it('prefers first + last name', () => {
    expect(userDisplayName(user({ firstName: 'Ada', lastName: 'Lovelace' }))).toBe('Ada Lovelace');
  });

  it('trims when only one of first/last is present', () => {
    expect(userDisplayName(user({ firstName: 'Ada' }))).toBe('Ada');
    expect(userDisplayName(user({ lastName: 'Lovelace' }))).toBe('Lovelace');
  });

  it('falls back to login, then email, then "User"', () => {
    expect(userDisplayName(user({ login: 'ada@x.com' }))).toBe('ada@x.com');
    expect(userDisplayName(user({ email: 'a@x.com' }))).toBe('a@x.com');
    expect(userDisplayName(user())).toBe('User');
  });
});

describe('initialsOf', () => {
  it('uses first letters of first and last name, upper-cased', () => {
    expect(initialsOf(user({ firstName: 'ada', lastName: 'lovelace' }))).toBe('AL');
  });

  it('uses a single initial when only one name is present', () => {
    expect(initialsOf(user({ firstName: 'ada' }))).toBe('A');
  });

  it('falls back to the first two chars of login/email when no name', () => {
    expect(initialsOf(user({ login: 'zeb@x.com' }))).toBe('ZE');
    expect(initialsOf(user({ email: 'qq@x.com' }))).toBe('QQ');
    expect(initialsOf(user())).toBe('?');
  });
});

describe('hueFromId', () => {
  it('is deterministic and within 0–359', () => {
    const h = hueFromId('some-user-id');
    expect(h).toBe(hueFromId('some-user-id'));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });

  it('returns 0 for the empty string', () => {
    expect(hueFromId('')).toBe(0);
  });

  it('differs for different ids (typically)', () => {
    expect(hueFromId('aaaa')).not.toBe(hueFromId('zzzz'));
  });
});
