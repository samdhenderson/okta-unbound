/**
 * Unit tests for profile-field partitioning, with emphasis on the security
 * filter: recovery/security-question and credential keys must never survive.
 */
import { describe, it, expect } from 'vitest';
import {
  EXCLUDED_PROFILE_FIELDS,
  STANDARD_PROFILE_FIELDS,
  getCustomProfileFields,
} from './profileFields';

describe('getCustomProfileFields', () => {
  it('returns only non-standard fields', () => {
    const result = getCustomProfileFields({
      login: 'a@x.com',
      firstName: 'Ada',
      badgeId: 'B-42',
    });
    expect(result).toEqual([['badgeId', 'B-42']]);
  });

  it('drops null, undefined, and empty-string values', () => {
    const result = getCustomProfileFields({
      keepMe: 'yes',
      nullish: null,
      undef: undefined,
      empty: '',
      zero: 0,
      falsy: false,
    });
    const keys = result.map(([k]) => k);
    expect(keys).toContain('keepMe');
    expect(keys).toContain('zero'); // 0 is a real value, kept
    expect(keys).toContain('falsy'); // false is a real value, kept
    expect(keys).not.toContain('nullish');
    expect(keys).not.toContain('undef');
    expect(keys).not.toContain('empty');
  });

  it('never leaks security-sensitive fields (every exact excluded key)', () => {
    const profile: Record<string, unknown> = { safe: 'ok' };
    for (const key of EXCLUDED_PROFILE_FIELDS) profile[key] = 'secret';
    const keys = getCustomProfileFields(profile).map(([k]) => k);
    expect(keys).toEqual(['safe']);
  });

  it('also excludes case-variant keys whose lower-case is a security key', () => {
    // e.g. `PASSWORD` / `Credentials` lower-case into the excluded set.
    const keys = getCustomProfileFields({
      safe: 'ok',
      PASSWORD: 'secret',
      Credentials: 'secret',
    }).map(([k]) => k);
    expect(keys).toEqual(['safe']);
  });

  it('excludes every standard field', () => {
    const profile: Record<string, unknown> = {};
    for (const key of STANDARD_PROFILE_FIELDS) profile[key] = 'x';
    expect(getCustomProfileFields(profile)).toEqual([]);
  });
});
