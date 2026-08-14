/**
 * @module sidepanel/hooks/useGroupMembersCache
 * @description Shared, lazily-populated cache of group members for the Groups tab.
 *
 * A single member cache (`groupId → OktaUser[]`) that the export, compare, and
 * cross-search features all read from and fill in, plus helpers to fetch members and
 * bulk-remove a user from groups.
 *
 * Fetches are backed by the module-level entity cache under the same
 * `['groupMembers', groupId]` key `GroupOverview` uses, so members loaded in one
 * place (overview navigation, export, compare) are served from memory everywhere
 * else — switching tabs no longer refetches data already in memory.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { useOktaApi } from './useOktaApi';
import { getOrFetch, invalidate } from '../cache/entityCache';
import { cacheKeys } from '../cache/keys';
import type { GroupSummary, OktaUser } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useGroupMembersCache');

type OktaApi = ReturnType<typeof useOktaApi>;

/**
 * Owns the shared `groupMembersCache` that export/compare/cross-search build up.
 *
 * @param api - The Okta API surface from {@link useOktaApi} (captured in a render-time ref; see below).
 * @param groups - Current group summaries, used to derive the `groupId → name` lookup.
 * @returns `groupMembersCache`, a `groupNames` map, `fetchMembers`, and `removeUserFromGroups`.
 *
 * `apiRef` is assigned during render (NOT in an effect): `useOktaApi` returns a
 * fresh object with fresh method identities every render, so a ref updated in an
 * effect would lag by one commit and the first fetch after a targetTabId change
 * would call a stale closure. Assigning during render is what lets `fetchMembers`
 * and `removeUserFromGroups` stay `useCallback([])` yet always hit the current api.
 * Do not move this into a useEffect.
 */
export function useGroupMembersCache(api: OktaApi, groups: GroupSummary[]) {
  const [groupMembersCache, setGroupMembersCache] = useState<Map<string, OktaUser[]>>(new Map());

  const apiRef = useRef(api);
  // Intentionally assigned during render (see the hook doc): an effect would lag
  // api by one commit and break the "always uses the current targetTabId" guarantee.
  // eslint-disable-next-line react-hooks/refs
  apiRef.current = api;

  const fetchMembers = useCallback(async (groupId: string) => {
    // Shared entity-cache key with GroupOverview (`['groupMembers', groupId]`):
    // a fresh entry is served with no network call, and concurrent fetches for
    // the same group coalesce onto one request.
    const members = await getOrFetch<OktaUser[]>(cacheKeys.groupMembers(groupId), () =>
      apiRef.current.getAllGroupMembers(groupId),
    );
    // Populate the local Map state (what compare/cross-search render from).
    setGroupMembersCache((prev) => {
      const next = new Map(prev);
      next.set(groupId, members);
      return next;
    });
    return members;
  }, []);

  const removeUserFromGroups = useCallback(async (userId: string, groupIds: string[]) => {
    // ADR-0009: the serial DELETE loop lives in useOktaApi/groupMembers as one
    // tracked, cancellable runOperation. The outcome never throws, so re-raise
    // the first rejection here to preserve the legacy abort-and-propagate
    // contract — after invalidating the entity-cache entry for every group
    // whose DELETE went through.
    const outcome = await apiRef.current.removeUserFromGroups(userId, groupIds);
    for (const r of outcome.results) {
      if (r.status !== 'fulfilled') continue;
      invalidate(cacheKeys.groupMembers(r.item));
      log.debug(`Removed user ${userId} from group ${r.item}`);
    }
    const rejected = outcome.results.find((r) => r.status === 'rejected');
    if (rejected) throw rejected.error;
  }, []);

  const groupNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const g of groups) {
      names.set(g.id, g.name);
    }
    return names;
  }, [groups]);

  return { groupMembersCache, groupNames, fetchMembers, removeUserFromGroups };
}
