/**
 * @module sidepanel/hooks/useDetectedUser
 * @description On-demand loader for one Okta user, by id.
 *
 * The Users tab stays pinned to the user you explicitly selected — it is never
 * hijacked by admin navigation. This hook does **not** fetch on its own; it
 * exposes a `loadUserById` action that fetches the user's details (§8: through
 * the rate-limited scheduler via `makeApiRequest('/api/v1/users/{id}')`) and
 * their memberships. Nothing hits Okta until you ask for it, so navigating admin
 * with the panel open costs nothing.
 *
 * It had a second entry point, `loadDetectedUser`, which was `loadUserById`
 * applied to whatever user the admin console had open — the tab's detected-user
 * banner's Load button. That banner is now the masthead's handoff offer, which
 * accepts by setting `selectedUserId`, and the deep-link path that fulfils it
 * already ends in `loadUserById`. One entry point, one code path.
 */

import { useCallback, useRef } from 'react';
import type { OktaUser } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';
import { useOktaApi } from './useOktaApi';

const log = createLogger('useDetectedUser');

/** Options for {@link useDetectedUser}. */
interface UseDetectedUserOptions {
  /** Tab whose content script holds the page + fetches user details. */
  targetTabId: number | undefined;
  /** Loads + classifies the user's memberships (drives loading/error via its own callbacks). */
  loadMemberships: (user: OktaUser) => Promise<void>;
  /** Sets (or clears) the tab's selected user. */
  onSelectUser: (user: OktaUser | null) => void;
  /** Reports into the tab's single merged error channel. */
  onError: (message: string | null) => void;
  /** Toggles the tab's membership-loading flag. */
  onLoadingChange: (loading: boolean) => void;
  /** Clears the search query + results so the loaded user supersedes any search. */
  onResetSearch: () => void;
}

/** Return shape of {@link useDetectedUser}. */
interface UseDetectedUserReturn {
  /**
   * Load an explicit user id into the tab (fetch details, select, load memberships).
   * Used to fulfil a deep link such as the Overview's "View all groups". No-op when
   * no tab is connected or `userId` is empty.
   */
  loadUserById: (userId: string) => Promise<void>;
}

/**
 * Hook exposing an on-demand loader for one user by id.
 *
 * @param options - See {@link UseDetectedUserOptions}.
 * @returns `loadUserById`, invoked to fulfil a `selectedUserId` request.
 */
export function useDetectedUser({
  targetTabId,
  loadMemberships,
  onSelectUser,
  onError,
  onLoadingChange,
  onResetSearch,
}: UseDetectedUserOptions): UseDetectedUserReturn {
  // §8: own a useOktaApi slice for the scheduler-routed details read.
  const { makeApiRequest } = useOktaApi({ targetTabId: targetTabId ?? null });

  // Held in a ref so `loadUserById` keeps a stable `[targetTabId]` identity
  // regardless of whether callers pass inline callbacks. `makeApiRequest` is stable
  // per `targetTabId` but is held here too so it never widens that dependency.
  const depsRef = useRef({
    loadMemberships,
    onSelectUser,
    onError,
    onLoadingChange,
    onResetSearch,
    makeApiRequest,
  });
  depsRef.current = {
    loadMemberships,
    onSelectUser,
    onError,
    onLoadingChange,
    onResetSearch,
    makeApiRequest,
  };

  const loadUserById = useCallback(
    async (userId: string) => {
      if (!targetTabId || !userId) return;

      const {
        loadMemberships,
        onSelectUser,
        onError,
        onLoadingChange,
        onResetSearch,
        makeApiRequest,
      } = depsRef.current;

      log.debug('Loading user on request:', userId);
      onLoadingChange(true);
      onError(null);
      onResetSearch(); // Clear search results + query when loading a specific user.

      try {
        // First fetch user details
        const userResponse = await makeApiRequest(`/api/v1/users/${userId}`, {
          reason: 'Detect current Okta user',
        });

        if (!userResponse.success) {
          throw new Error(userResponse.error || 'Failed to fetch user details');
        }

        const user: OktaUser = userResponse.data;
        onSelectUser(user);

        // Then load memberships (drives isLoadingMemberships/error via callbacks).
        await loadMemberships(user);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load user';
        onSelectUser(null);
        onError(message);
        onLoadingChange(false);
      }
    },
    [targetTabId],
  );

  return { loadUserById };
}
