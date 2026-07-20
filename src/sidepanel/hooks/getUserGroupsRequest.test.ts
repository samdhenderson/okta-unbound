/**
 * Tests for the scheduler-routed user-groups fetch (§8).
 *
 * Pins the pagination + membership-wrapper behavior ported verbatim from the old
 * content-script `getUserGroups` handler: follow `Link` rel="next" across pages,
 * wrap each group as `{ group, membershipType: 'UNKNOWN', addedDate: undefined }`,
 * and return `{ success, data, count }`. A failed page is returned verbatim; a
 * thrown error becomes `{ success: false, error }`.
 */
import { describe, it, expect, vi } from 'vitest';
import { getUserGroupsRequest } from './getUserGroupsRequest';
import type { RequestResult } from '../../shared/scheduler/types';

const ok = (data: unknown, headers?: Record<string, string>): RequestResult => ({
  success: true,
  data,
  headers,
});

function group(id: string) {
  return { id, type: 'OKTA_GROUP', profile: { name: id } };
}

describe('getUserGroupsRequest', () => {
  it('fetches a single page and wraps each group as an UNKNOWN membership', async () => {
    const makeApiRequest = vi.fn().mockResolvedValue(ok([group('g1'), group('g2')]));

    const result = await getUserGroupsRequest(makeApiRequest, 'u1');

    expect(makeApiRequest).toHaveBeenCalledTimes(1);
    expect(makeApiRequest).toHaveBeenCalledWith('/api/v1/users/u1/groups?limit=200');
    expect(result).toEqual({
      success: true,
      count: 2,
      data: [
        { group: group('g1'), membershipType: 'UNKNOWN', addedDate: undefined },
        { group: group('g2'), membershipType: 'UNKNOWN', addedDate: undefined },
      ],
    });
  });

  it('follows Link rel="next" pagination across pages', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValueOnce(
        ok([group('g1')], {
          link: '<https://acme.okta.com/api/v1/users/u1/groups?after=CURSOR&limit=200>; rel="next"',
        }),
      )
      .mockResolvedValueOnce(ok([group('g2')]));

    const result = await getUserGroupsRequest(makeApiRequest, 'u1');

    expect(makeApiRequest).toHaveBeenCalledTimes(2);
    expect(makeApiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/v1/users/u1/groups?after=CURSOR&limit=200',
    );
    expect(result.count).toBe(2);
    expect(result.data?.map((m) => m.group.id)).toEqual(['g1', 'g2']);
  });

  it('returns a failed page response verbatim (and stops paginating)', async () => {
    const makeApiRequest = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'boom' } as RequestResult);

    const result = await getUserGroupsRequest(makeApiRequest, 'u1');

    expect(result).toEqual({ success: false, error: 'boom' });
    expect(makeApiRequest).toHaveBeenCalledTimes(1);
  });

  it('reports a failure (does not throw) when a request rejects', async () => {
    const makeApiRequest = vi.fn().mockRejectedValue(new Error('scheduler down'));

    const result = await getUserGroupsRequest(makeApiRequest, 'u1');

    expect(result).toEqual({ success: false, error: 'scheduler down' });
  });
});
