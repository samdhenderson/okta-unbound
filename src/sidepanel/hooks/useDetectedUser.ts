/**
 * @module sidepanel/hooks/useDetectedUser
 * @description On-demand loader for the Okta user detected on the active admin page.
 *
 * The Users tab stays pinned to the user you explicitly selected — it is never
 * hijacked by admin navigation. This hook does **not** fetch on its own; it exposes
 * a `loadDetectedUser` action that the tab's "Detected in admin — Load" banner
 * invokes on click, which fetches the user's details (§8: through the rate-limited
 * scheduler via `makeApiRequest('/api/v1/users/{id}')`) and their memberships.
 * Nothing hits Okta until you ask for it, so navigating admin with the panel open
 * costs nothing.
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
  /** Id of the user detected on the page, or undefined when not on a user page. */
  detectedUserId: string | undefined;
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
   * Load the page-detected user into the tab: fetch details, select them, and load
   * their memberships. No-op when there is no detected user / connected tab.
   */
  loadDetectedUser: () => Promise<void>;
  /**
   * Load an explicit user id into the tab (fetch details, select, load memberships).
   * Used to fulfil a deep link such as the Overview's "View all groups". No-op when
   * no tab is connected or `userId` is empty.
   */
  loadUserById: (userId: string) => Promise<void>;
}

/**
 * Hook exposing an on-demand loader for the page-detected user.
 *
 * @param options - See {@link UseDetectedUserOptions}.
 * @returns `loadDetectedUser`, invoked by the tab's detected-user banner.
 */
export function useDetectedUser({
  targetTabId,
  detectedUserId,
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
        const userResponse = await makeApiRequest(`/api/v1/users/${userId}`);

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

  const loadDetectedUser = useCallback(async () => {
    if (!detectedUserId) return;
    await loadUserById(detectedUserId);
  }, [detectedUserId, loadUserById]);

  return { loadDetectedUser, loadUserById };
}
