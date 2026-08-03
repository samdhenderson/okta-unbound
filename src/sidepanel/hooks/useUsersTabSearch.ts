/**
 * @module sidepanel/hooks/useUsersTabSearch
 * @description Debounced Okta user search for the Users tab's search box.
 *
 * Owns the query, debounced results and in-flight flag, searching Okta users
 * through the rate-limited scheduler (§8: `makeApiRequest` at `interactive`
 * priority, via `searchUsersRequest`). Unlike the generic {@link useUserSearch},
 * it reports failures through the tab's single merged error channel and clears
 * the selected user / memberships when a fresh search begins, preserving the
 * orchestrator's last-write-wins behavior. Thin wrapper over the shared
 * {@link useDebouncedUserSearch} engine.
 *
 * Quirk preserved verbatim from the pre-decomposition inline effect: backspacing
 * to a single character early-returns WITHOUT clearing the on-screen results; only
 * reaching zero characters clears them. See UsersTab.test.tsx §1.
 */

import type { OktaUser } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';
import { useDebouncedUserSearch } from './useDebouncedUserSearch';

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
  /**
   * Whether the Users tab is the visible one. The tab stays mounted while hidden,
   * so the debounce is suspended rather than re-issuing the standing query when
   * `targetTabId` changes. Defaults to `true`.
   */
  enabled?: boolean;
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
  enabled = true,
}: UseUsersTabSearchOptions): UseUsersTabSearchReturn {
  return useDebouncedUserSearch({
    targetTabId,
    onError,
    onSearchStart,
    debounceMs,
    minQueryLength,
    log,
    enabled,
  });
}
