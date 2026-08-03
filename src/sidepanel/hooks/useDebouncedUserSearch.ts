/**
 * @module sidepanel/hooks/useDebouncedUserSearch
 * @description Shared debounced Okta user-search engine.
 *
 * The single parameterized implementation behind {@link useUserSearch} (local
 * error state) and {@link useUsersTabSearch} (orchestrator error channel +
 * search-start reset). Behavior is preserved verbatim from their previously
 * duplicated effects — §8: searches route through the rate-limited scheduler
 * (`makeApiRequest` at `interactive` priority, via {@link searchUsersRequest}),
 * with a debounce and minimum-length gate. CHARACTERIZED quirk (preserved):
 * backspacing below the minimum length early-returns WITHOUT clearing the
 * on-screen results; only reaching zero characters clears them.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { OktaUser } from '../../shared/types';
import type { Logger } from '../../shared/utils/logger';
import { useOktaApi } from './useOktaApi';
import { searchUsersRequest } from './searchUsersRequest';

/** Options for {@link useDebouncedUserSearch}. */
export interface UseDebouncedUserSearchOptions {
  /** Tab whose content script performs the search; searches error out when undefined. */
  targetTabId: number | undefined;
  /**
   * Receives `null` on search start/success and the message on failure. Must be
   * stable (a `useState` setter or `useCallback`) so the debounce effect keeps a
   * fixed identity.
   */
  onError: (message: string | null) => void;
  /**
   * Optional: fired at the start of each committed search (after the error channel
   * is cleared, before the request). Must be stable (`useCallback`).
   */
  onSearchStart?: () => void;
  /** Debounce delay before searching. */
  debounceMs: number;
  /** Minimum query length before searching. */
  minQueryLength: number;
  /** The wrapping hook's scoped logger. */
  log: Logger;
  /**
   * When `false`, the debounce never commits a search. The Users tab stays mounted
   * (hidden) once visited, and the effect re-fires whenever `targetTabId`
   * changes — which would otherwise re-run the query still sitting in the box from
   * a tab the user cannot see. Defaults to `true`.
   */
  enabled?: boolean;
}

/** Return shape of {@link useDebouncedUserSearch}. */
export interface UseDebouncedUserSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: OktaUser[];
  setSearchResults: (users: OktaUser[]) => void;
  isSearching: boolean;
}

/**
 * Debounced, tab-scoped Okta user search. Wrap this rather than duplicating the
 * debounce effect; the wrappers own how errors surface.
 *
 * @param options - See {@link UseDebouncedUserSearchOptions}.
 * @returns `searchQuery` / `setSearchQuery` (drives the debounced search),
 *   `searchResults` / `setSearchResults`, and `isSearching`.
 */
export function useDebouncedUserSearch({
  targetTabId,
  onError,
  onSearchStart,
  debounceMs,
  minQueryLength,
  log,
  enabled = true,
}: UseDebouncedUserSearchOptions): UseDebouncedUserSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OktaUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // §8: own a useOktaApi slice for the scheduler path. `makeApiRequest` is stable
  // per `targetTabId`, so it does not widen the debounce effect's re-fire surface.
  const { makeApiRequest } = useOktaApi({ targetTabId: targetTabId ?? null });

  const performSearch = useCallback(
    async (query: string) => {
      if (!targetTabId) {
        onError('No Okta tab connected');
        return;
      }

      if (!query.trim()) {
        onError('Please enter a search query');
        return;
      }

      setIsSearching(true);
      onError(null);
      onSearchStart?.();

      try {
        log.debug('Searching for users', { queryLength: query.trim().length });

        const response = await searchUsersRequest(makeApiRequest, query.trim());

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
    },
    [targetTabId, onError, onSearchStart, makeApiRequest, log],
  );

  // Debounced search effect — trigger the search as the user types.
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Nothing typed can change while the host is hidden, so the only thing this
    // effect could do there is re-issue the standing query against a new
    // `targetTabId` — an Okta call with no reader. Coming back re-runs it for the
    // query still on screen.
    if (!enabled) return;

    // Empty query: clear results and the error channel.
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      onError(null);
      return;
    }

    // Don't search if the query is too short. NOTE: this early-returns WITHOUT
    // clearing results — backspacing to below the minimum deliberately leaves the
    // last results on screen (characterized quirk).
    if (searchQuery.trim().length < minQueryLength) {
      return;
    }

    // Debounce the search — wait `debounceMs` after the user stops typing.
    debounceTimerRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, searchQuery, debounceMs, minQueryLength, performSearch, onError]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
  };
}
