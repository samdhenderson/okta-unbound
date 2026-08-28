/**
 * Tests for useJumpResolver — the Home tab's jump bar.
 *
 * The subject here is the **request-cost contract**, not the rendering: no
 * request under three characters, no request at all for an id until Enter, zero
 * requests when the local org snapshot can answer, and no request wasted on an
 * id a complete snapshot has already ruled out. Those four rules are the reason
 * the tab exists in this shape, so each gets a test that counts calls.
 *
 * All ids are fake, per the repo's no-secrets rule.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useJumpResolver, JUMP_SEARCH_DEBOUNCE_MS, type JumpResult } from './useJumpResolver';
import type { OrgEntityIndex, LocalLookup } from './useOrgEntityIndex';

const GROUP_ID = '00gFAKE0000000000001';
const USER_ID = '00uFAKE0000000000001';
const RULE_ID = '0prFAKE0000000000001';

/** A stub index whose answer per kind the test dictates. */
function makeIndex(answers: Partial<Record<string, LocalLookup>> = {}): OrgEntityIndex {
  return {
    lookup: (kind) => answers[kind] ?? { status: 'unknown' },
    isAuthoritative: () => true,
    // The snapshot handles are not read by this hook; the figures card uses them.
    groups: {} as OrgEntityIndex['groups'],
    rules: {} as OrgEntityIndex['rules'],
    apps: {} as OrgEntityIndex['apps'],
  };
}

describe('useJumpResolver', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  /** Let the debounce window elapse and any resulting promises settle. */
  async function settleDebounce() {
    await act(async () => {
      vi.advanceTimersByTime(JUMP_SEARCH_DEBOUNCE_MS + 10);
    });
  }

  type Searcher = (query: string) => Promise<JumpResult[]>;
  type Fetcher = (id: string) => Promise<JumpResult | null>;

  function setup(
    overrides: {
      index?: OrgEntityIndex;
      searchGroups?: Searcher;
      searchUsers?: Searcher;
      fetchUser?: Fetcher;
      fetchGroup?: Fetcher;
      enabled?: boolean;
    } = {},
  ) {
    const searchGroups = vi.fn<Searcher>(overrides.searchGroups ?? (async () => []));
    const searchUsers = vi.fn<Searcher>(overrides.searchUsers ?? (async () => []));
    const fetchUser = vi.fn<Fetcher>(overrides.fetchUser ?? (async () => null));
    const fetchGroup = vi.fn<Fetcher>(overrides.fetchGroup ?? (async () => null));
    // Stable across renders, as the hook's contract requires.
    const searchers = { group: searchGroups, user: searchUsers };
    const fetchers = { user: fetchUser, group: fetchGroup };
    const index = overrides.index ?? makeIndex();

    const view = renderHook(() =>
      useJumpResolver({
        index,
        searchers,
        fetchers,
        enabled: overrides.enabled ?? true,
      }),
    );
    return { ...view, searchGroups, searchUsers, fetchUser, fetchGroup };
  }

  describe('the three-character floor', () => {
    it('issues no request for one or two characters', async () => {
      const { result, searchGroups, searchUsers } = setup();

      act(() => result.current.setQuery('en'));
      await settleDebounce();

      expect(searchGroups).not.toHaveBeenCalled();
      expect(searchUsers).not.toHaveBeenCalled();
      expect(result.current.mode).toBe('idle');
    });

    it('searches every supplied kind once at three characters', async () => {
      const { result, searchGroups, searchUsers } = setup();

      act(() => result.current.setQuery('eng'));
      await settleDebounce();

      await waitFor(() => expect(result.current.mode).toBe('results'));
      expect(searchGroups).toHaveBeenCalledTimes(1);
      expect(searchGroups).toHaveBeenCalledWith('eng');
      expect(searchUsers).toHaveBeenCalledTimes(1);
    });

    it('drops stale results when the query falls back below the floor', async () => {
      const searchGroups = vi.fn(async () => [
        { kind: 'group' as const, id: GROUP_ID, name: 'Engineering' },
      ]);
      const { result } = setup({ searchGroups });

      act(() => result.current.setQuery('eng'));
      await settleDebounce();
      await waitFor(() => expect(result.current.results).toHaveLength(1));

      act(() => result.current.setQuery('en'));
      await settleDebounce();

      // A shorter query must not keep showing a longer query's answer.
      expect(result.current.results).toEqual([]);
      expect(result.current.mode).toBe('idle');
    });
  });

  describe('an id is resolved, not searched', () => {
    it('issues no request while a well-formed id is being typed', async () => {
      const { result, searchGroups, searchUsers, fetchGroup } = setup();

      act(() => result.current.setQuery(GROUP_ID));
      await settleDebounce();

      // Every intermediate prefix of an id matches nothing, so searching one
      // would spend a request per keystroke to return an empty list.
      expect(searchGroups).not.toHaveBeenCalled();
      expect(searchUsers).not.toHaveBeenCalled();
      expect(fetchGroup).not.toHaveBeenCalled();
      expect(result.current.isIdQuery).toBe(true);
      expect(result.current.mode).toBe('idle');
    });

    it('resolves a snapshot hit at zero requests', async () => {
      const index = makeIndex({
        group: {
          status: 'hit',
          entity: { kind: 'group', id: GROUP_ID, name: 'Engineering' },
        },
      });
      const { result, fetchGroup } = setup({ index });

      act(() => result.current.setQuery(GROUP_ID));
      act(() => result.current.submit());

      await waitFor(() => expect(result.current.mode).toBe('results'));
      expect(fetchGroup).not.toHaveBeenCalled();
      expect(result.current.resolution).toEqual({ cost: 0 });
      expect(result.current.results).toEqual([
        { kind: 'group', id: GROUP_ID, name: 'Engineering' },
      ]);
    });

    it('spends no request on an id a complete snapshot has ruled out', async () => {
      const index = makeIndex({ group: { status: 'miss' } });
      const { result, fetchGroup } = setup({ index });

      act(() => result.current.setQuery(GROUP_ID));
      act(() => result.current.submit());

      await waitFor(() => expect(result.current.mode).toBe('results'));
      // An authoritative absence is an answer. Asking Okta to repeat it is waste.
      expect(fetchGroup).not.toHaveBeenCalled();
      expect(result.current.results).toEqual([]);
      expect(result.current.resolution).toEqual({ cost: 0 });
    });

    it('falls through to one request when the snapshot cannot say', async () => {
      // 'unknown' is the incomplete-walk case: rows exist but the walk did not
      // finish, so a miss is not evidence of absence (ADR-0040 §7).
      const index = makeIndex({ group: { status: 'unknown' } });
      const fetchGroup = vi.fn(async () => ({
        kind: 'group' as const,
        id: GROUP_ID,
        name: 'Engineering',
      }));
      const { result } = setup({ index, fetchGroup });

      act(() => result.current.setQuery(GROUP_ID));
      act(() => result.current.submit());

      await waitFor(() => expect(result.current.mode).toBe('results'));
      expect(fetchGroup).toHaveBeenCalledWith(GROUP_ID);
      expect(result.current.resolution).toEqual({ cost: 1 });
    });

    it('always costs one request for a user id — users are not snapshotted', async () => {
      const fetchUser = vi.fn(async () => ({
        kind: 'user' as const,
        id: USER_ID,
        name: 'Ada Lovelace',
        secondary: 'ada@example.com',
      }));
      // A real index answers 'unknown' for every user id (ADR-0040 §5).
      const { result } = setup({ index: makeIndex(), fetchUser });

      act(() => result.current.setQuery(USER_ID));
      act(() => result.current.submit());

      await waitFor(() => expect(result.current.mode).toBe('results'));
      expect(fetchUser).toHaveBeenCalledWith(USER_ID);
      expect(result.current.resolution).toEqual({ cost: 1 });
    });

    it('resolves a rule id from the snapshot without a rule fetcher', async () => {
      // No `rule` entry in `fetchers` at all — the snapshot is the only route,
      // and it is enough.
      const index = makeIndex({
        rule: {
          status: 'hit',
          entity: { kind: 'rule', id: RULE_ID, name: 'Eng — All ICs', secondary: 'Paused' },
        },
      });
      const { result } = setup({ index });

      act(() => result.current.setQuery(RULE_ID));
      act(() => result.current.submit());

      await waitFor(() => expect(result.current.mode).toBe('results'));
      expect(result.current.results[0]).toMatchObject({ kind: 'rule', secondary: 'Paused' });
      expect(result.current.resolution).toEqual({ cost: 0 });
    });

    it('trims a pasted id before resolving it', async () => {
      const index = makeIndex({
        group: {
          status: 'hit',
          entity: { kind: 'group', id: GROUP_ID, name: 'Engineering' },
        },
      });
      const { result } = setup({ index });

      act(() => result.current.setQuery(`  ${GROUP_ID}\n`));
      expect(result.current.isIdQuery).toBe(true);
      act(() => result.current.submit());

      await waitFor(() => expect(result.current.results).toHaveLength(1));
    });
  });

  describe('the fan-out follows what the caller can navigate to', () => {
    it('searches only the kinds a searcher was supplied for', async () => {
      // `app` is omitted because no navigation handler is registered for it, so
      // an app row would be a control that does nothing.
      const { result, searchGroups, searchUsers } = setup();

      act(() => result.current.setQuery('eng'));
      await settleDebounce();

      await waitFor(() => expect(result.current.mode).toBe('results'));
      expect(searchGroups).toHaveBeenCalled();
      expect(searchUsers).toHaveBeenCalled();
    });

    it('merges results from every kind into one list', async () => {
      const searchGroups = vi.fn(async () => [
        { kind: 'group' as const, id: GROUP_ID, name: 'Engineering' },
      ]);
      const searchUsers = vi.fn(async () => [
        { kind: 'user' as const, id: USER_ID, name: 'Ada Lovelace' },
      ]);
      const { result } = setup({ searchGroups, searchUsers });

      act(() => result.current.setQuery('eng'));
      await settleDebounce();

      await waitFor(() => expect(result.current.results).toHaveLength(2));
      expect(result.current.results.map((r) => r.kind).sort()).toEqual(['group', 'user']);
    });
  });

  describe('failure', () => {
    it('shows a partial answer when only one leg fails', async () => {
      const searchGroups = vi.fn(async () => [
        { kind: 'group' as const, id: GROUP_ID, name: 'Engineering' },
      ]);
      const searchUsers = vi.fn(async () => {
        throw new Error('boom');
      });
      const { result } = setup({ searchGroups, searchUsers });

      act(() => result.current.setQuery('eng'));
      await settleDebounce();

      await waitFor(() => expect(result.current.mode).toBe('results'));
      // One real answer beats an error banner over a result the user can use.
      expect(result.current.results).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it('reports an error only when every leg fails', async () => {
      const boom = vi.fn(async () => {
        throw new Error('boom');
      });
      const { result } = setup({ searchGroups: boom, searchUsers: boom });

      act(() => result.current.setQuery('eng'));
      await settleDebounce();

      await waitFor(() => expect(result.current.mode).toBe('error'));
      // An empty list would read as "nothing matched", which is a different and
      // wrong claim.
      expect(result.current.error).toBeTruthy();
      expect(result.current.results).toEqual([]);
    });

    it('surfaces a failed id resolution as an error, not an empty result', async () => {
      const index = makeIndex({ group: { status: 'unknown' } });
      const fetchGroup = vi.fn(async () => {
        throw new Error('403 Forbidden');
      });
      const { result } = setup({ index, fetchGroup });

      act(() => result.current.setQuery(GROUP_ID));
      act(() => result.current.submit());

      await waitFor(() => expect(result.current.mode).toBe('error'));
      expect(result.current.error).toContain('403');
    });
  });

  describe('gating and reset', () => {
    it('issues no search while the tab is hidden', async () => {
      const { result, searchGroups } = setup({ enabled: false });

      act(() => result.current.setQuery('eng'));
      await settleDebounce();

      expect(searchGroups).not.toHaveBeenCalled();
      // The query is still recorded, so returning to the tab keeps what was typed.
      expect(result.current.query).toBe('eng');
    });

    it('submit is inert while the tab is hidden', async () => {
      const index = makeIndex({
        group: { status: 'hit', entity: { kind: 'group', id: GROUP_ID, name: 'Engineering' } },
      });
      const { result } = setup({ index, enabled: false });

      act(() => result.current.setQuery(GROUP_ID));
      act(() => result.current.submit());

      expect(result.current.mode).toBe('idle');
      expect(result.current.results).toEqual([]);
    });

    it('clear returns the bar to its resting state', async () => {
      const searchGroups = vi.fn(async () => [
        { kind: 'group' as const, id: GROUP_ID, name: 'Engineering' },
      ]);
      const { result } = setup({ searchGroups });

      act(() => result.current.setQuery('eng'));
      await settleDebounce();
      await waitFor(() => expect(result.current.results).toHaveLength(1));

      act(() => result.current.clear());

      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.mode).toBe('idle');
      expect(result.current.resolution).toBeNull();
    });
  });
});
