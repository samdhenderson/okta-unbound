import { useState, useCallback, useRef, useEffect } from 'react';
import type { OktaUser } from '../../shared/types';

interface UseUserSearchOptions {
  targetTabId: number | undefined;
  debounceMs?: number;
  minQueryLength?: number;
}

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

  const performSearch = useCallback(async (query: string) => {
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
      console.log('[useUserSearch] Searching for users:', query);

      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'searchUsers',
        query: query.trim(),
      });

      if (response.success) {
        setSearchResults(response.data || []);
        console.log('[useUserSearch] Found users:', response.data?.length);
      } else {
        setError(response.error || 'Failed to search users');
        setSearchResults([]);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to communicate with Okta tab');
      setSearchResults([]);
      console.error('[useUserSearch] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [targetTabId]);

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
