import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useOktaApi } from './useOktaApi';
import type { GroupSummary } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';
import { toGroupSummary } from '../components/groups/groupSummary';
import {
  GROUPS_CACHE_KEY,
  parseGroupsCache,
  serializeGroupsCache,
} from '../components/groups/groupsCache';

const log = createLogger('useGroupsLoader');

type OktaApi = ReturnType<typeof useOktaApi>;

interface UseGroupsLoaderOptions {
  api: OktaApi;
  setError: Dispatch<SetStateAction<string | null>>;
  setSearchMode: Dispatch<SetStateAction<'live' | 'cached'>>;
  /** Called after a successful full load to clear live-search state. */
  onLoaded: () => void;
}

/**
 * Owns the cached group list + loading flag, the mount cache rehydrate, and the
 * `loadAllGroups` pipeline (fetch → map → staleness → non-fatal push enrichment →
 * cache write).
 *
 * CHARACTERIZED: the mount rehydrate races `loadAllGroups` with no cancellation —
 * a late storage callback can overwrite freshly loaded groups (stale wins). The
 * push-mapping enrichment is a NESTED non-fatal try/catch: a push failure logs a
 * warning and lets the load complete + cache; a `getAllGroups` failure banners and
 * caches nothing. Both are preserved verbatim.
 */
export function useGroupsLoader({
  api,
  setError,
  setSearchMode,
  onLoaded,
}: UseGroupsLoaderOptions) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Load groups from cache on mount ([setSearchMode] is a stable setter → mount-only).
  useEffect(() => {
    chrome.storage.local.get([GROUPS_CACHE_KEY], (result) => {
      if (result[GROUPS_CACHE_KEY]) {
        try {
          const parsedGroups = parseGroupsCache(result[GROUPS_CACHE_KEY] as string, Date.now());
          if (parsedGroups) {
            setGroups(parsedGroups);
            setSearchMode('cached');
          }
        } catch (err) {
          log.error('Failed to parse groups cache:', err);
        }
      }
    });
  }, [setSearchMode]);

  const loadAllGroups = async () => {
    setLoading(true);
    setError(null);

    try {
      const allGroups = await api.getAllGroups(() => {});

      let groupSummaries: GroupSummary[] = allGroups.map(toGroupSummary);

      // Calculate staleness for each group
      groupSummaries = groupSummaries.map((g) => ({
        ...g,
        staleness: api.calculateStaleness(g),
      }));

      // Auto-detect and apply push group mappings
      try {
        groupSummaries = await api.applyPushGroupMappings(groupSummaries);
      } catch (err) {
        log.warn('Failed to load push group mappings:', err);
      }

      setGroups(groupSummaries);
      setSearchMode('cached');
      onLoaded();

      // Cache results
      chrome.storage.local.set({
        [GROUPS_CACHE_KEY]: serializeGroupsCache(groupSummaries, Date.now()),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  return { groups, loading, loadAllGroups };
}
