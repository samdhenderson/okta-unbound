/**
 * Tests for the shared searcher/fetcher builder behind Home's jump bar and the
 * ⌘K palette.
 *
 * Three contracts are pinned here, and the first is the one most likely to be
 * broken by an innocent-looking edit:
 *
 * 1. **`searchers` is referentially stable.** `useJumpResolver`'s debounced
 *    effect depends on its identity, so a fresh object per render turns one
 *    search per settle into one search per render of the host. This is a hook's
 *    documented stability contract, not the referential identity of props
 *    brokered to a mocked child that ADR-0023 bans testing.
 * 2. **The allow-list is honoured, and ANDed with reachability.** A surface gets
 *    exactly the legs it asked for, and never a leg it could not open.
 * 3. **Local kinds cost nothing.** Rules never reach Okta; apps only do so when
 *    the snapshot cannot be trusted to be complete.
 *
 * The Okta client is a plain object of eight functions rather than the real
 * facade — `EntitySearchApi` is declared structurally for exactly this reason,
 * and this repo does not use MSW.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEntitySearchSources, type EntitySearchApi } from './useEntitySearchSources';
import { NavigationProvider, type EntityType } from '../contexts/NavigationContext';
import { resetEntityCache } from '../cache/entityCache';
import type { OrgEntityIndex, IndexedEntity, IndexedKind } from './useOrgEntityIndex';
import type { JumpKind } from './useJumpResolver';
import type { OktaPolicyListItem } from '../../shared/schemas/okta';

const ALL_KINDS = ['group', 'app', 'rule', 'policy', 'user'] as const;

const api = {
  searchGroups: vi.fn(async () => [{ id: '00gFAKE1', name: 'Engineering' }]),
  searchUsers: vi.fn(async () => [{ id: '00uFAKE1', login: 'ada@example.com' }]),
  searchApps: vi.fn(async () => [{ id: '0oaFAKE9', label: 'Live Only App' }]),
  listPolicies: vi.fn(
    async () =>
      [
        { id: 'rstFAKE1', name: 'Any two factors' },
        { id: 'rstFAKE2', name: 'Default Policy' },
      ] as OktaPolicyListItem[],
  ),
  getGroupById: vi.fn(async () => null),
  getUserById: vi.fn(async () => null),
  getAppById: vi.fn(async () => ({ kind: 'missing' as const })),
  getRawGroupRule: vi.fn(async () => null),
} satisfies EntitySearchApi;

const SNAPSHOT_ROWS: Record<IndexedKind, IndexedEntity[]> = {
  rule: [{ kind: 'rule', id: '0prFAKE1', name: 'Feeds Engineering', secondary: 'Active' }],
  app: [{ kind: 'app', id: '0oaFAKE1', name: 'Salesforce' }],
  group: [],
};

/** A stub index whose completeness the test dictates. */
function makeIndex(complete: Partial<Record<IndexedKind, boolean>> = {}): OrgEntityIndex {
  return {
    lookup: () => ({ status: 'unknown' }),
    searchByName: (kind, query) =>
      SNAPSHOT_ROWS[kind].filter((row) =>
        row.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    isAuthoritative: (kind) => complete[kind] ?? true,
    groups: {} as OrgEntityIndex['groups'],
    rules: {} as OrgEntityIndex['rules'],
    apps: {} as OrgEntityIndex['apps'],
    appGroups: {} as OrgEntityIndex['appGroups'],
  };
}

/** Render the hook under a navigation context with the given kinds reachable. */
function renderSources(options: {
  kinds?: ReadonlyArray<JumpKind>;
  reachable?: ReadonlyArray<EntityType>;
  index?: OrgEntityIndex;
}) {
  const { kinds = ALL_KINDS, reachable = ['group', 'app', 'rule', 'policy', 'user'] } = options;
  const index = options.index ?? makeIndex();
  const handlers = Object.fromEntries(reachable.map((type) => [type, vi.fn()]));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NavigationProvider handlers={handlers}>{children}</NavigationProvider>
  );
  return renderHook(() => useEntitySearchSources({ api, index, kinds }), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
});

describe('useEntitySearchSources', () => {
  describe('stability', () => {
    it('keeps `searchers` referentially identical across re-renders', () => {
      const { result, rerender } = renderSources({});
      const first = result.current.searchers;

      rerender();
      rerender();

      // `useJumpResolver` re-issues its whole fan-out when this identity changes,
      // so a fresh object here is a request per render of the host component.
      expect(result.current.searchers).toBe(first);
    });
  });

  describe('the allow-list', () => {
    it('builds only the kinds the surface asked for', () => {
      const { result } = renderSources({ kinds: ['group', 'user'] });

      expect(Object.keys(result.current.searchers).sort()).toEqual(['group', 'user']);
    });

    it('drops a kind this build cannot open, even when the surface asked for it', () => {
      // ANDed, not ORed: a searcher for an unreachable kind produces a row that
      // only refuses, which is worse than not finding the thing (ADR-0039).
      const { result } = renderSources({ kinds: ALL_KINDS, reachable: ['group', 'user'] });

      expect(Object.keys(result.current.searchers).sort()).toEqual(['group', 'user']);
    });
  });

  describe('what a search costs', () => {
    it('answers a rule search from the snapshot, with zero requests', async () => {
      const { result } = renderSources({});

      const rows = await result.current.searchers.rule!('feeds');

      expect(rows).toEqual([
        { kind: 'rule', id: '0prFAKE1', name: 'Feeds Engineering', secondary: 'Active' },
      ]);
      // There is no rule-name endpoint on Okta, and the whole collection is
      // local, so nothing here may reach the network.
      expect(api.searchGroups).not.toHaveBeenCalled();
      expect(api.searchApps).not.toHaveBeenCalled();
    });

    it('answers an app search from a complete snapshot without asking Okta', async () => {
      const { result } = renderSources({ index: makeIndex({ app: true }) });

      const rows = await result.current.searchers.app!('sales');

      expect(rows.map((row) => row.name)).toEqual(['Salesforce']);
      expect(api.searchApps).not.toHaveBeenCalled();
    });

    it('tops an app search up from Okta when the snapshot walk has not finished', async () => {
      // A partial collection cannot be trusted to be missing nothing, so it is
      // topped up rather than presented as the answer (ADR-0040 §7).
      const { result } = renderSources({ index: makeIndex({ app: false }) });

      const rows = await result.current.searchers.app!('a');

      expect(api.searchApps).toHaveBeenCalledWith('a');
      expect(rows.map((row) => row.id)).toEqual(['0oaFAKE1', '0oaFAKE9']);
    });

    it('walks the policy list once, however many searches run', async () => {
      const { result } = renderSources({});

      const first = await result.current.searchers.policy!('two');
      const second = await result.current.searchers.policy!('default');

      // `/api/v1/policies` takes no `q=`, so searching a name means holding the
      // list. Holding it behind the Policies tab's own cache key is what keeps
      // that from being a whole-org walk per settle.
      expect(api.listPolicies).toHaveBeenCalledTimes(1);
      expect(first.map((row) => row.name)).toEqual(['Any two factors']);
      expect(second.map((row) => row.name)).toEqual(['Default Policy']);
    });
  });

  describe('fetchers', () => {
    it('separates "no such app" from "the lookup did not complete" (D-007a)', async () => {
      const { result } = renderSources({});

      // A real 404 is the only answer that may report an absence.
      await expect(result.current.fetchers.app!('0oaFAKE1')).resolves.toBeNull();

      api.getAppById.mockResolvedValueOnce({ kind: 'failed', status: 429 } as never);
      // A throttled lookup throws, so the caller renders an error rather than
      // telling the reader the app is gone.
      await expect(result.current.fetchers.app!('0oaFAKE1')).rejects.toThrow();

      api.getAppById.mockResolvedValueOnce({ kind: 'session-expired' } as never);
      await expect(result.current.fetchers.app!('0oaFAKE1')).rejects.toThrow(/session has expired/);
    });
  });

  describe('mapping', () => {
    it('falls back to a login when a user has no name', async () => {
      const { result } = renderSources({});

      await waitFor(async () => {
        const rows = await result.current.searchers.user!('ada');
        expect(rows[0]).toMatchObject({ name: 'ada@example.com', secondary: 'ada@example.com' });
      });
    });
  });
});
