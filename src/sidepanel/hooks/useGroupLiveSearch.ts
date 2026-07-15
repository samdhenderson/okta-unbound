import { useState, useRef, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GroupSummary } from '../../shared/types';
import { liveSearchToGroupSummary } from '../components/groups/groupSummary';

interface UseGroupLiveSearchOptions {
  targetTabId: number | null;
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
 * CHARACTERIZED: this goes DIRECT to the content script (bypassing the scheduler)
 * and has no stale-response guard — the last-resolving request wins. Both are §8
 * concerns, preserved verbatim here.
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
        const response = await chrome.tabs.sendMessage(targetTabId, {
          action: 'searchGroups',
          query: query.trim(),
        });

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
    [targetTabId, setError],
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
