/**
 * @module sidepanel/hooks/useGroupNameResolver.test
 * @description The resolver's three rungs, and the fetch rung that did not exist.
 *
 * A group id in a rule condition names a group the reader is usually **not**
 * looking at, so every private id→name map the panel used to carry — one per
 * surface, built from whatever that surface happened to hold — could name the
 * groups the user was already in and nothing else. These pin the ladder that
 * replaced them: caller-held names, then the org snapshot, then one
 * `GET /api/v1/groups/{id}` per id a surface actually asked about.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGroupNameResolver } from './useGroupNameResolver';
import { resetEntityCache } from '../cache/entityCache';

const getGroupById = vi.fn();
vi.mock('./useOktaApi', () => ({
  useOktaApi: () => ({ getGroupById: (id: string) => getGroupById(id) }),
}));

const loadCachedGroupIndex = vi.fn();
vi.mock('./fetchGroupRulesRequest', () => ({
  loadCachedGroupIndex: (origin: string | null | undefined) => loadCachedGroupIndex(origin),
}));

const ORIGIN = 'https://example.okta.com';
/** Full-length fake ids: the shape guard rejects anything else. */
const IN_SNAPSHOT = '00gFAKEsnapshot00001';
const FETCHED = '00gFAKEfetched000001';

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
  loadCachedGroupIndex.mockResolvedValue({
    nameById: new Map([[IN_SNAPSHOT, 'Contractors']]),
    idsHeld: new Set([IN_SNAPSHOT]),
    complete: true,
  });
  getGroupById.mockResolvedValue({ id: FETCHED, name: 'Engineering' });
});

const render = (options: Record<string, unknown> = {}) =>
  renderHook(() => useGroupNameResolver({ targetTabId: 1, oktaOrigin: ORIGIN, ...options }));

describe('useGroupNameResolver', () => {
  it('prefers a name the caller already holds over every other rung', async () => {
    const known = new Map([[IN_SNAPSHOT, 'Contractors (live)']]);
    const { result } = render({ known });

    await waitFor(() => expect(loadCachedGroupIndex).toHaveBeenCalled());
    expect(result.current.resolveGroupName(IN_SNAPSHOT)).toBe('Contractors (live)');

    // And asking about it costs nothing: a known id is never fetched.
    act(() => result.current.request([IN_SNAPSHOT]));
    expect(getGroupById).not.toHaveBeenCalled();
  });

  it('names a group from the org snapshot without an API call', async () => {
    const { result } = render();

    await waitFor(() => expect(result.current.resolveGroupName(IN_SNAPSHOT)).toBe('Contractors'));
    act(() => result.current.request([IN_SNAPSHOT]));
    expect(getGroupById).not.toHaveBeenCalled();
  });

  it('fetches an id the snapshot cannot name — the rung that did not exist', async () => {
    const { result } = render();
    await waitFor(() => expect(loadCachedGroupIndex).toHaveBeenCalled());

    expect(result.current.resolveGroupName(FETCHED)).toBeUndefined();
    act(() => result.current.request([FETCHED]));

    await waitFor(() => expect(result.current.resolveGroupName(FETCHED)).toBe('Engineering'));
    expect(getGroupById).toHaveBeenCalledWith(FETCHED);
  });

  it('asks once for an id, however many times a re-render asks again', async () => {
    const { result } = render();
    await waitFor(() => expect(loadCachedGroupIndex).toHaveBeenCalled());

    act(() => {
      result.current.request([FETCHED]);
      result.current.request([FETCHED]);
    });
    await waitFor(() => expect(result.current.resolveGroupName(FETCHED)).toBe('Engineering'));
    act(() => result.current.request([FETCHED]));

    expect(getGroupById).toHaveBeenCalledTimes(1);
  });

  it('asks once for an id Okta cannot name, and names it nothing', async () => {
    getGroupById.mockResolvedValue(null);
    const { result } = render();
    await waitFor(() => expect(loadCachedGroupIndex).toHaveBeenCalled());

    act(() => result.current.request([FETCHED]));
    await waitFor(() => expect(getGroupById).toHaveBeenCalledTimes(1));

    act(() => result.current.request([FETCHED]));
    expect(getGroupById).toHaveBeenCalledTimes(1);
    expect(result.current.resolveGroupName(FETCHED)).toBeUndefined();
  });

  it('never names an id as itself', async () => {
    // `getGroupById` falls back to the id when a group carries no name. Badging
    // an id as its own name would read as a resolved answer.
    getGroupById.mockResolvedValue({ id: FETCHED, name: FETCHED });
    const { result } = render();
    await waitFor(() => expect(loadCachedGroupIndex).toHaveBeenCalled());

    act(() => result.current.request([FETCHED]));
    await waitFor(() => expect(getGroupById).toHaveBeenCalled());
    expect(result.current.resolveGroupName(FETCHED)).toBeUndefined();
  });

  it('refuses to look up anything that is not shaped like a group id', async () => {
    const { result } = render();
    await waitFor(() => expect(loadCachedGroupIndex).toHaveBeenCalled());

    // Tenant-authored text reaches this function, and it is interpolated into a
    // request path.
    act(() => result.current.request(['../../users/me', '00uFAKEuser00000001', '00g']));
    expect(getGroupById).not.toHaveBeenCalled();
  });

  it('reads nothing and fetches nothing while the surface is off screen', async () => {
    const { result } = render({ enabled: false });

    act(() => result.current.request([FETCHED]));
    expect(loadCachedGroupIndex).not.toHaveBeenCalled();
    expect(getGroupById).not.toHaveBeenCalled();
  });

  it('still answers from the snapshot with no tab attached', async () => {
    const { result } = render({ targetTabId: null });

    await waitFor(() => expect(result.current.resolveGroupName(IN_SNAPSHOT)).toBe('Contractors'));
    act(() => result.current.request([FETCHED]));
    expect(getGroupById).not.toHaveBeenCalled();
  });
});
