/**
 * Tests for the multi-strategy scheduler-routed user search (§8).
 *
 * Pins the 1–3 request fallback ported from the old content-script `searchUsers`
 * handler: `q=` first, then `search=`, then an email `filter=` only when the query
 * looks like an email and nothing matched. Every request runs at `interactive`
 * priority.
 *
 * Strategy 2 sends a SCIM expression, not the bare query — the ported handler's
 * `search=<term>` was a malformed filter Okta rejects, which left `q=`'s per-field
 * prefix match as the only name-aware strategy.
 */
import { describe, it, expect, vi } from 'vitest';
import { searchUsersRequest } from './searchUsersRequest';
import type { RequestResult } from '../../shared/scheduler/types';

const ok = (data: unknown): RequestResult => ({ success: true, data });

function user(id: string) {
  return { id, status: 'ACTIVE', profile: { email: `${id}@x.com`, login: `${id}@x.com` } };
}

describe('searchUsersRequest', () => {
  it('uses the q= result and stops when strategy 1 returns matches', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(ok([user('u1')]));

    const result = await searchUsersRequest(makeApiRequest, 'ada');

    expect(result).toEqual({ success: true, data: [user('u1')], count: 1 });
    expect(makeApiRequest).toHaveBeenCalledTimes(1);
    expect(makeApiRequest).toHaveBeenCalledWith('/api/v1/users?q=ada&limit=20', {
      method: 'GET',
      priority: 'interactive',
      reason: 'Search users',
    });
  });

  /** The decoded `search=` expression from the nth call, for readable assertions. */
  function searchExpression(makeApiRequest: ReturnType<typeof vi.fn>, nth: number): string {
    const url = makeApiRequest.mock.calls[nth - 1][0] as string;
    const value = /[?&]search=([^&]*)/.exec(url)?.[1] ?? '';
    return decodeURIComponent(value);
  }

  it('falls back to a SCIM search= expression when q= returns no rows', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce(ok([])) // q=
      .mockResolvedValueOnce(ok([user('u2')])); // search=

    const result = await searchUsersRequest(makeApiRequest, 'ada');

    expect(result.data).toEqual([user('u2')]);
    expect(makeApiRequest).toHaveBeenCalledTimes(2);
    expect(searchExpression(makeApiRequest, 2)).toBe(
      'profile.firstName sw "ada" or profile.lastName sw "ada" or ' +
        'profile.login sw "ada" or profile.email sw "ada"',
    );
    expect(makeApiRequest.mock.calls[1][1]).toEqual({
      method: 'GET',
      priority: 'interactive',
      reason: 'Search users',
    });
  });

  it('adds a first/last name pair for a multi-word query', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(ok([]));

    await searchUsersRequest(makeApiRequest, 'Ada Lovelace');

    expect(searchExpression(makeApiRequest, 2)).toContain(
      '(profile.firstName sw "Ada" and profile.lastName sw "Lovelace")',
    );
  });

  it('pairs the first and last token of a three-part name, not the middle one', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(ok([]));

    await searchUsersRequest(makeApiRequest, 'Ada Byron Lovelace');

    expect(searchExpression(makeApiRequest, 2)).toContain(
      '(profile.firstName sw "Ada" and profile.lastName sw "Lovelace")',
    );
  });

  it('escapes quotes and backslashes so a typed " cannot break the expression', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(ok([]));

    await searchUsersRequest(makeApiRequest, 'a" or profile.login pr or "');

    const expression = searchExpression(makeApiRequest, 2);
    expect(expression).toContain('profile.firstName sw "a\\" or profile.login pr or \\""');
    expect(expression).not.toContain('sw "a" or profile.login pr or ""');
  });

  it('URL-encodes the search expression', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(ok([]));

    await searchUsersRequest(makeApiRequest, 'ada');

    const url = makeApiRequest.mock.calls[1][0] as string;
    expect(url).not.toMatch(/[ "]/);
    expect(url).toContain('search=profile.firstName%20sw%20%22ada%22');
  });

  it('tries the email filter only when the query has @ and nothing matched yet', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce(ok([])) // q=
      .mockResolvedValueOnce(ok([])) // search=
      .mockResolvedValueOnce(ok([user('ada')])); // filter=

    const result = await searchUsersRequest(makeApiRequest, 'ada@x.com');

    expect(result.data).toEqual([user('ada')]);
    expect(makeApiRequest).toHaveBeenCalledTimes(3);
    expect(makeApiRequest).toHaveBeenNthCalledWith(
      3,
      '/api/v1/users?filter=profile.email eq "ada@x.com"&limit=20',
      {
        method: 'GET',
        priority: 'interactive',
        reason: 'Search users',
      },
    );
  });

  it('does NOT try the email filter for a non-email query that finds nothing', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(ok([]));

    const result = await searchUsersRequest(makeApiRequest, 'ada');

    expect(result).toEqual({ success: true, data: [], count: 0 });
    expect(makeApiRequest).toHaveBeenCalledTimes(2); // q= then search=, no filter
  });

  it('trims the query and URL-encodes it', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(ok([user('u1')]));

    await searchUsersRequest(makeApiRequest, '  a b  ');

    expect(makeApiRequest).toHaveBeenCalledWith('/api/v1/users?q=a%20b&limit=20', {
      method: 'GET',
      priority: 'interactive',
      reason: 'Search users',
    });
  });

  it('reports a failure (does not throw) when a request rejects', async () => {
    const makeApiRequest = vi.fn().mockRejectedValue(new Error('scheduler down'));

    const result = await searchUsersRequest(makeApiRequest, 'ada');

    expect(result).toEqual({ success: false, error: 'scheduler down' });
  });
});
