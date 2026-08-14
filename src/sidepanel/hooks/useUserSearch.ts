/**
 * @module sidepanel/hooks/useUserSearch
 * @description Debounced Okta user search bound to a specific tab.
 *
 * §8: searches route through the rate-limited scheduler (`makeApiRequest` at
 * `interactive` priority, via `searchUsersRequest`) as the query changes,
 * enforcing a minimum length and debounce. Thin wrapper over the shared
 * {@link useDebouncedUserSearch} engine that surfaces failures as local state.
 */

import { useState, useCallback } from 'react';
import type { OktaUser } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';
import { useDebouncedUserSearch } from './useDebouncedUserSearch';

const log = createLogger('useUserSearch');

/** Options for {@link useUserSearch}. */
interface UseUserSearchOptions {
  /** Tab whose content script performs the search; searches error out when undefined. */
  targetTabId: number | undefined;
  /** Debounce delay before searching. Defaults to 600ms. */
  debounceMs?: number;
  /** Minimum query length before searching. Defaults to 2. */
  minQueryLength?: number;
  /**
   * When `false`, the debounce never commits a search. Consumers that stay mounted
   * while hidden (the comparison surface behind a closed dialog or a popped view,
   * inside a tab that itself stays mounted — ADR-0018) pass their visibility here so
   * a standing query cannot re-fire against a new `targetTabId` with no reader.
   * Defaults to `true`.
   */
  enabled?: boolean;
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
 * - An `enabled` gate for hosts that stay mounted while hidden
 *
 * @param options - See `UseUserSearchOptions`.
 * @returns `searchQuery` / `setSearchQuery` (which drives the debounced search),
 *   `searchResults`, `isSearching`, `error`, and `clearSearch`.
 */
export function useUserSearch({
  targetTabId,
  debounceMs = 600,
  minQueryLength = 2,
  enabled = true,
}: UseUserSearchOptions): UseUserSearchReturn {
  const [error, setError] = useState<string | null>(null);

  const { searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching } =
    useDebouncedUserSearch({
      targetTabId,
      onError: setError,
      debounceMs,
      minQueryLength,
      log,
      enabled,
    });

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
  }, [setSearchQuery, setSearchResults]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    error,
    clearSearch,
  };
}
