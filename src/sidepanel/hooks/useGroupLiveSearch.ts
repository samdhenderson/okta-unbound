/**
 * @module sidepanel/hooks/useGroupLiveSearch
 * @description Server-side, per-keystroke group search with a 300ms debounce.
 *
 * Owns the live search query, its results, and the searching spinner for the Groups
 * tab. When `searchMode` is `live`, each query change is debounced and sent straight
 * to the content script's `searchGroups` action.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GroupSummary } from '../../shared/types';
import { liveSearchToGroupSummary } from '../components/groups/groupSummary';
import { useDebouncedValue } from './useDebouncedValue';
import { useOktaApi } from './useOktaApi';

/** Inputs to {@link useGroupLiveSearch}. */
interface UseGroupLiveSearchOptions {
  /** Tab id of the Okta session to search against, or `null` when disconnected. */
  targetTabId: number | null;
  /** Only debounces/fires while this is `live`. */
  searchMode: 'live' | 'cached';
  /** The shell's single error setter — three producers write it, so it stays there. */
  setError: Dispatch<SetStateAction<string | null>>;
  /**
   * When `false`, the debounced search never fires. The Groups tab stays mounted
   * while another top-level tab is selected, and the debounce effect re-runs on a
   * `targetTabId` change — which would otherwise re-issue the last typed query
   * from a tab the user cannot see. Defaults to `true`.
   */
  enabled?: boolean;
}

/**
 * Owns the live (per-keystroke) group search: the query, its results, the spinner
 * flag, and the 300ms debounce.
 *
 * `handleLiveSearch` is memoized on `[targetTabId, setError]` (both stable — the
 * error setter is the shell's raw useState setter), so the search effect keyed on
 * its identity only re-fires when `targetTabId` changes. Do NOT widen these deps or
 * pass an inline `onError` — an unstable handler makes the effect re-fire the
 * search on every render.
 *
 * §8: routes through the rate-limited scheduler (`makeApiRequest` at the
 * `interactive` priority, which jumps the soft cooldown so a typed search stays
 * instant) instead of a direct content-script `searchGroups` message. The request
 * is the same single `GET /api/v1/groups?q=…&limit=20&expand=stats` the content
 * handler used to issue. CHARACTERIZED (preserved): still no stale-response guard —
 * the last-resolving request wins.
 *
 * @returns `liveSearchQuery` + `setLiveSearchQuery` (drives the debounce),
 * `liveSearchResults`, the `isLiveSearching` flag, and `resetLiveSearch`.
 */
export function useGroupLiveSearch({
  targetTabId,
  searchMode,
  setError,
  enabled = true,
}: UseGroupLiveSearchOptions) {
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState<GroupSummary[]>([]);
  const [isLiveSearching, setIsLiveSearching] = useState(false);
  const debouncedQuery = useDebouncedValue(liveSearchQuery, 300);

  // §8: own a useOktaApi slice for the scheduler path. `makeApiRequest` is stable
  // per `targetTabId` (memoized in useOktaApi), so it does not widen the debounce
  // effect's re-fire surface below.
  const { makeApiRequest } = useOktaApi({ targetTabId });

  const handleLiveSearch = useCallback(
    async (query: string) => {
      if (!targetTabId) {
        setError('No Okta tab connected');
        return;
      }

      if (!query.trim()) {
        setLiveSearchResults([]);
        return;
      }

      setIsLiveSearching(true);
      setError(null);

      try {
        const q = encodeURIComponent(query.trim());
        const response = await makeApiRequest(
          `/api/v1/groups?q=${q}&limit=20&expand=stats`,
          'GET',
          undefined,
          'interactive',
        );

        if (response.success) {
          const results = (response.data || []).map(liveSearchToGroupSummary);
          setLiveSearchResults(results);
        } else {
          setError(response.error || 'Failed to search groups');
          setLiveSearchResults([]);
        }
      } catch (err) {
        setError((err as Error).message || 'Failed to communicate with Okta tab');
        setLiveSearchResults([]);
      } finally {
        setIsLiveSearching(false);
      }
    },
    [targetTabId, setError, makeApiRequest],
  );

  // Debounced search effect: fires once the query has been stable for 300ms, and
  // re-fires with the settled query when the handler identity changes (i.e. a new
  // `targetTabId`) or the mode flips back to live. Suppressed entirely while the
  // tab is hidden, so a mounted-but-invisible tab never calls Okta. Coming back
  // runs it once for the query still in the box (a no-op when that box is empty),
  // which is the point of a *live* search: what it shows should be current.
  useEffect(() => {
    if (enabled && searchMode === 'live') {
      handleLiveSearch(debouncedQuery);
    }
  }, [debouncedQuery, searchMode, handleLiveSearch, enabled]);

  const resetLiveSearch = useCallback(() => {
    setLiveSearchQuery('');
    setLiveSearchResults([]);
  }, []);

  return {
    liveSearchQuery,
    setLiveSearchQuery,
    liveSearchResults,
    isLiveSearching,
    resetLiveSearch,
  };
}
