/**
 * @module sidepanel/hooks/useUsersTabSearch
 * @description Debounced Okta user search for the Users tab's search box.
 *
 * Owns the query, debounced results and in-flight flag, searching Okta users
 * through the rate-limited scheduler (§8: `makeApiRequest` at `interactive`
 * priority, via {@link searchUsersRequest}) as the query changes. Unlike the
 * generic {@link useUserSearch}, it reports failures through the tab's single
 * merged error channel and clears the selected user / memberships when a fresh
 * search begins, preserving the orchestrator's last-write-wins behavior.
 *
 * Quirk preserved verbatim from the pre-decomposition inline effect: backspacing
 * to a single character early-returns WITHOUT clearing the on-screen results; only
 * reaching zero characters clears them. See UsersTab.test.tsx §1.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { OktaUser } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';
import { useOktaApi } from './useOktaApi';
import { searchUsersRequest } from './searchUsersRequest';

const log = createLogger('useUsersTabSearch');

/** Options for {@link useUsersTabSearch}. */
interface UseUsersTabSearchOptions {
  /** Tab whose content script performs the search; searches error out when undefined. */
  targetTabId: number | undefined;
  /**
   * Reports the search error into the orchestrator's single merged error channel —
   * `null` on start/success, the message on failure. Must be stable (a `useState`
   * setter or `useCallback`) so the debounce effect keeps a fixed identity.
   */
  onError: (message: string | null) => void;
  /**
   * Fired at the start of each committed search so the orchestrator can clear the
   * selected user and its memberships. Must be stable (`useCallback`).
   */
  onSearchStart: () => void;
  /** Debounce delay before searching. Defaults to 600ms. */
  debounceMs?: number;
  /** Minimum query length before searching. Defaults to 2. */
  minQueryLength?: number;
}

/** Return shape of {@link useUsersTabSearch}. */
interface UseUsersTabSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: OktaUser[];
  setSearchResults: (users: OktaUser[]) => void;
  isSearching: boolean;
}

/**
 * Hook backing the Users tab search box: debounced, tab-scoped user search wired
 * into the orchestrator's merged error channel and selection reset.
 *
 * @param options - See {@link UseUsersTabSearchOptions}.
 * @returns `searchQuery` / `setSearchQuery` (drives the debounced search),
 *   `searchResults` / `setSearchResults` (so the orchestrator can clear or seed
 *   them on auto-load / clear), and `isSearching`.
 */
export function useUsersTabSearch({
  targetTabId,
  onError,
  onSearchStart,
  debounceMs = 600,
  minQueryLength = 2,
}: UseUsersTabSearchOptions): UseUsersTabSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OktaUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // §8: own a useOktaApi slice for the scheduler path. `makeApiRequest` is stable
  // per `targetTabId`, so it does not widen the debounce effect's re-fire surface.
  const { makeApiRequest } = useOktaApi({ targetTabId: targetTabId ?? null });

  const handleSearch = useCallback(async () => {
    if (!targetTabId) {
      onError('No Okta tab connected');
      return;
    }

    if (!searchQuery.trim()) {
      onError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    onError(null);
    onSearchStart();

    try {
      log.debug('Searching for users', { queryLength: searchQuery.trim().length });

      const response = await searchUsersRequest(makeApiRequest, searchQuery.trim());

      if (response.success) {
        setSearchResults(response.data || []);
        log.debug('Found users:', response.data?.length);
      } else {
        onError(response.error || 'Failed to search users');
        setSearchResults([]);
      }
    } catch (err: unknown) {
      const error = err as Error;
      onError(error.message || 'Failed to communicate with Okta tab');
      setSearchResults([]);
      log.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [targetTabId, searchQuery, onError, onSearchStart, makeApiRequest]);

  // Live search with debouncing - trigger search as user types
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is empty or too short
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      onError(null);
      return;
    }

    // Don't search if query is too short (minimum 2 characters for efficiency).
    // NOTE: this early-returns WITHOUT clearing results — backspacing to 1 char
    // deliberately leaves the last results on screen (characterized quirk).
    if (searchQuery.trim().length < minQueryLength) {
      return;
    }

    // Debounce the search - wait `debounceMs` after user stops typing
    debounceTimerRef.current = setTimeout(() => {
      handleSearch();
    }, debounceMs);

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, targetTabId, handleSearch, debounceMs, minQueryLength, onError]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
  };
}
