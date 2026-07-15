/**
 * @module sidepanel/hooks/useUserSearch
 * @description Debounced Okta user search bound to a specific tab.
 *
 * Sends `searchUsers` to the target tab's content script (never Okta directly) as
 * the query changes, enforcing a minimum length and debounce.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { OktaUser } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useUserSearch');

/** Options for {@link useUserSearch}. */
interface UseUserSearchOptions {
  /** Tab whose content script performs the search; searches error out when undefined. */
  targetTabId: number | undefined;
  /** Debounce delay before searching. Defaults to 600ms. */
  debounceMs?: number;
  /** Minimum query length before searching. Defaults to 2. */
  minQueryLength?: number;
}

/** Return shape of {@link useUserSearch}. */
interface UseUserSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: OktaUser[];
  isSearching: boolean;
  error: string | null;
  clearSearch: () => void;
}

/**
 * Hook for searching Okta users with debouncing.
 *
 * Features:
 * - Debounced search to avoid excessive API calls
 * - Minimum query length enforcement
 * - Error handling
 * - Clear search functionality
 *
 * @param options - See `UseUserSearchOptions`.
 * @returns `searchQuery` / `setSearchQuery` (which drives the debounced search),
 *   `searchResults`, `isSearching`, `error`, and `clearSearch`.
 */
export function useUserSearch({
  targetTabId,
  debounceMs = 600,
  minQueryLength = 2,
}: UseUserSearchOptions): UseUserSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OktaUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(
    async (query: string) => {
      if (!targetTabId) {
        setError('No Okta tab connected');
        return;
      }

      if (!query.trim()) {
        setError('Please enter a search query');
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        log.debug('Searching for users', { queryLength: query.length });

        const response = await chrome.tabs.sendMessage(targetTabId, {
          action: 'searchUsers',
          query: query.trim(),
        });

        if (response.success) {
          setSearchResults(response.data || []);
          log.debug('Found users:', response.data?.length);
        } else {
          setError(response.error || 'Failed to search users');
          setSearchResults([]);
        }
      } catch (err: unknown) {
        const error = err as Error;
        setError(error.message || 'Failed to communicate with Okta tab');
        setSearchResults([]);
        log.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [targetTabId],
  );

  // Debounced search effect
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is empty
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setError(null);
      return;
    }

    // Don't search if query is too short
    if (searchQuery.trim().length < minQueryLength) {
      return;
    }

    // Debounce the search
    debounceTimerRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, debounceMs, minQueryLength, performSearch]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    error,
    clearSearch,
  };
}
