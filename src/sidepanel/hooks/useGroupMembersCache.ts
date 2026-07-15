/**
 * @module sidepanel/hooks/useGroupMembersCache
 * @description Shared, lazily-populated cache of group members for the Groups tab.
 *
 * A single member cache (`groupId → OktaUser[]`) that the export, compare, and
 * cross-search features all read from and fill in, plus helpers to fetch members and
 * bulk-remove a user from groups.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { useOktaApi } from './useOktaApi';
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
    const members = await apiRef.current.getAllGroupMembers(groupId);
    // Populate cache
    setGroupMembersCache((prev) => {
      const next = new Map(prev);
      next.set(groupId, members);
      return next;
    });
    return members;
  }, []);

  const removeUserFromGroups = useCallback(async (userId: string, groupIds: string[]) => {
    for (const groupId of groupIds) {
      await apiRef.current.makeApiRequest(`/api/v1/groups/${groupId}/users/${userId}`, 'DELETE');
      log.debug(`Removed user ${userId} from group ${groupId}`);
    }
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
