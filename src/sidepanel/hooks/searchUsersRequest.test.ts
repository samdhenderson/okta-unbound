/**
 * Tests for the multi-strategy scheduler-routed user search (§8).
 *
 * Pins the 1–3 request fallback ported verbatim from the old content-script
 * `searchUsers` handler: `q=` first, then `search=`, then an email `filter=` only
 * when the query looks like an email and nothing matched. Every request runs at
 * `interactive` priority.
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
    expect(makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/users?q=ada&limit=20',
      'GET',
      undefined,
      'interactive',
    );
  });

  it('falls back to search= when q= returns no rows', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce(ok([])) // q=
      .mockResolvedValueOnce(ok([user('u2')])); // search=

    const result = await searchUsersRequest(makeApiRequest, 'ada');

    expect(result.data).toEqual([user('u2')]);
    expect(makeApiRequest).toHaveBeenCalledTimes(2);
    expect(makeApiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/v1/users?search=ada&limit=20',
      'GET',
      undefined,
      'interactive',
    );
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
      'GET',
      undefined,
      'interactive',
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

    expect(makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/users?q=a%20b&limit=20',
      'GET',
      undefined,
      'interactive',
    );
  });

  it('reports a failure (does not throw) when a request rejects', async () => {
    const makeApiRequest = vi.fn().mockRejectedValue(new Error('scheduler down'));

    const result = await searchUsersRequest(makeApiRequest, 'ada');

    expect(result).toEqual({ success: false, error: 'scheduler down' });
  });
});
