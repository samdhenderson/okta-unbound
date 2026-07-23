/**
 * @module sidepanel/hooks/useGroupLiveSearch
 * @description Server-side, per-keystroke group search with a 300ms debounce.
 *
 * Owns the live search query, its results, and the searching spinner for the Groups
 * tab. When `searchMode` is `live`, each query change is debounced and sent straight
 * to the content script's `searchGroups` action.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GroupSummary } from '../../shared/types';
import { liveSearchToGroupSummary } from '../components/groups/groupSummary';
import { useOktaApi } from './useOktaApi';

/** Inputs to {@link useGroupLiveSearch}. */
interface UseGroupLiveSearchOptions {
  /** Tab id of the Okta session to search against, or `null` when disconnected. */
  targetTabId: number | null;
  /** Only debounces/fires while this is `live`. */
  searchMode: 'live' | 'cached';
  /** The shell's single error setter — three producers write it, so it stays there. */
  setError: Dispatch<SetStateAction<string | null>>;
}

/**
 * Owns the live (per-keystroke) group search: the query, its results, the spinner
 * flag, and the 300ms debounce.
 *
 * `handleLiveSearch` is memoized on `[targetTabId, setError]` (both stable — the
 * error setter is the shell's raw useState setter), so the debounce effect keyed on
 * its identity only re-fires when `targetTabId` changes. Do NOT widen these deps or
 * pass an inline `onError` — an unstable handler makes the effect reschedule the
 * timer every render and the search silently never fires.
 *
 * §8: routes through the rate-limited scheduler (`makeApiRequest` at the
 * `interactive` priority, which jumps the soft cooldown so a typed search stays
 * instant) instead of a direct content-script `searchGroups` message. The request
 * is the same single `GET /api/v1/groups?q=…&limit=20&expand=stats` the content
 * handler used to issue. Uses a monotonic request counter to discard stale
 * responses when a newer search has been dispatched.
 *
 * @returns `liveSearchQuery` + `setLiveSearchQuery` (drives the debounce),
 * `liveSearchResults`, the `isLiveSearching` flag, and `resetLiveSearch`.
 */
export function useGroupLiveSearch({
  targetTabId,
  searchMode,
  setError,
}: UseGroupLiveSearchOptions) {
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState<GroupSummary[]>([]);
  const [isLiveSearching, setIsLiveSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);

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

      const thisRequest = ++requestIdRef.current;
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

        if (thisRequest !== requestIdRef.current) return;

        if (response.success) {
          const results = (response.data || []).map(liveSearchToGroupSummary);
          setLiveSearchResults(results);
        } else {
          setError(response.error || 'Failed to search groups');
          setLiveSearchResults([]);
        }
      } catch (err) {
        if (thisRequest !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to communicate with Okta tab');
        setLiveSearchResults([]);
      } finally {
        if (thisRequest === requestIdRef.current) {
          setIsLiveSearching(false);
        }
      }
    },
    [targetTabId, setError, makeApiRequest],
  );

  // Debounced search effect
  useEffect(() => {
    if (searchMode === 'live') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        handleLiveSearch(liveSearchQuery);
      }, 300);
      return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      };
    }
  }, [liveSearchQuery, searchMode, handleLiveSearch]);

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
