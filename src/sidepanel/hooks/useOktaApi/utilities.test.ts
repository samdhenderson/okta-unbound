/**
 * Tests for the shared API utilities: `parseNextLink` (pagination header parsing)
 * and `deepMergeProfiles` (recursive profile merge with array strategies).
 */
import { describe, it, expect } from 'vitest';
import { parseNextLink, deepMergeProfiles, nextPageUrl } from './utilities';

describe('parseNextLink', () => {
  it('returns null when the header is missing', () => {
    expect(parseNextLink()).toBeNull();
    expect(parseNextLink(undefined)).toBeNull();
  });

  it('returns null when there is no rel="next" link', () => {
    const header = '<https://example.okta.com/api/v1/users?after=abc>; rel="self"';
    expect(parseNextLink(header)).toBeNull();
  });

  it('extracts the next link as an origin-relative path + search', () => {
    const header = '<https://example.okta.com/api/v1/users?limit=200&after=cursor123>; rel="next"';
    expect(parseNextLink(header)).toBe('/api/v1/users?limit=200&after=cursor123');
  });

  it('picks the next link out of multiple comma-separated links', () => {
    const header =
      '<https://example.okta.com/api/v1/users?after=self>; rel="self", ' +
      '<https://example.okta.com/api/v1/users?after=next1>; rel="next"';
    expect(parseNextLink(header)).toBe('/api/v1/users?after=next1');
  });

  it('returns a path without a search string when the next URL has no query', () => {
    const header = '<https://example.okta.com/api/v1/groups>; rel="next"';
    expect(parseNextLink(header)).toBe('/api/v1/groups');
  });

  it('returns null when a rel="next" link has no angle-bracketed URL', () => {
    // Matches the rel token but the `<...>` extraction fails → falls through to null.
    const header = 'https://example.okta.com/api/v1/users; rel="next"';
    expect(parseNextLink(header)).toBeNull();
  });
});

describe('nextPageUrl', () => {
  const cur = '/api/v1/groups/rules?limit=200';
  const nextHeader = '<https://acme.okta.com/api/v1/groups/rules?after=CUR&limit=200>; rel="next"';

  it('returns the next page when the cursor advances and the page had items', () => {
    expect(nextPageUrl(cur, nextHeader, 200)).toBe('/api/v1/groups/rules?after=CUR&limit=200');
  });

  it('stops when the page came back empty even if a next link is present', () => {
    expect(nextPageUrl(cur, nextHeader, 0)).toBeNull();
  });

  it('stops when the cursor does not advance (self-referential next link)', () => {
    const selfHeader = `<https://acme.okta.com${cur}>; rel="next"`;
    expect(nextPageUrl(cur, selfHeader, 200)).toBeNull();
  });

  it('stops when there is no next link', () => {
    expect(nextPageUrl(cur, undefined, 200)).toBeNull();
  });
});

describe('deepMergeProfiles', () => {
  it('layers override primitives over the base and leaves the base untouched', () => {
    const base = { firstName: 'Ada', lastName: 'Lovelace' };
    const result = deepMergeProfiles(base, { lastName: 'Byron' });

    expect(result).toEqual({ firstName: 'Ada', lastName: 'Byron' });
    expect(base.lastName).toBe('Lovelace'); // not mutated
  });

  it('skips null and undefined override values so the base survives', () => {
    const result = deepMergeProfiles(
      { title: 'Engineer', dept: 'R&D' },
      { title: null, dept: undefined },
    );
    expect(result).toEqual({ title: 'Engineer', dept: 'R&D' });
  });

  it('replaces arrays entirely by default', () => {
    const result = deepMergeProfiles({ perms: ['a', 'b'] }, { perms: ['c'] });
    expect(result.perms).toEqual(['c']);
  });

  it("unions and de-dupes arrays with the 'merge' strategy", () => {
    const result = deepMergeProfiles({ perms: ['a', 'b'] }, { perms: ['b', 'c'] }, 'merge');
    expect(result.perms).toEqual(['a', 'b', 'c']);
  });

  it("replaces the array when 'merge' is requested but the base value is not an array", () => {
    const result = deepMergeProfiles({ perms: 'not-an-array' }, { perms: ['x'] }, 'merge');
    expect(result.perms).toEqual(['x']);
  });

  it('recursively merges nested objects', () => {
    const result = deepMergeProfiles(
      { address: { city: 'Oldtown', zip: '00000' } },
      { address: { city: 'Newtown' } },
    );
    expect(result.address).toEqual({ city: 'Newtown', zip: '00000' });
  });

  it('recurses into a nested override even when the base value is null', () => {
    const result = deepMergeProfiles({ address: null }, { address: { city: 'Newtown' } });
    expect(result.address).toEqual({ city: 'Newtown' });
  });

  it('propagates the array strategy through nested recursion', () => {
    const result = deepMergeProfiles(
      { settings: { tags: ['a'] } },
      { settings: { tags: ['b'] } },
      'merge',
    );
    expect(result.settings).toEqual({ tags: ['a', 'b'] });
  });
});
