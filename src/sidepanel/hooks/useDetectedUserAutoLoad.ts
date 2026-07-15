/**
 * @module sidepanel/hooks/useDetectedUserAutoLoad
 * @description Auto-loads the Okta user detected on the active page into the Users tab.
 *
 * When the content script reports a user on the page, this hook fetches that user's
 * details (via the §8-preserved raw `getUserDetails` read path it grandfathers) and
 * loads their memberships — exactly once per detected id. A pre-await re-entrancy
 * guard (`hasAutoLoadedUser`) stops the effect from re-firing on unrelated parent
 * re-renders; `resetAutoLoad` clears the guard so the same user reloads (used by the
 * tab's Clear button). All orchestrator writes (selection, merged error channel,
 * membership-loading flag, search reset) go through injected callbacks so the effect
 * only re-runs when the detected user actually changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { OktaUser } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useDetectedUserAutoLoad');

/** Options for {@link useDetectedUserAutoLoad}. */
interface UseDetectedUserAutoLoadOptions {
  /** Tab whose content script holds the page + fetches user details. */
  targetTabId: number | undefined;
  /** Id of the user detected on the page, or undefined when not on a user page. */
  detectedUserId: string | undefined;
  /** True while the page context is still resolving; auto-load waits for it. */
  isLoadingUserContext: boolean;
  /** Loads + classifies the user's memberships (drives loading/error via its own callbacks). */
  loadMemberships: (user: OktaUser) => Promise<void>;
  /** Resets the membership list (and reports `error=null` through its callback). */
  clearMemberships: () => void;
  /** Sets (or clears) the tab's selected user. */
  onSelectUser: (user: OktaUser | null) => void;
  /** Reports into the tab's single merged error channel. */
  onError: (message: string | null) => void;
  /** Toggles the tab's membership-loading flag. */
  onLoadingChange: (loading: boolean) => void;
  /** Clears the search query + results so an auto-load supersedes any search. */
  onResetSearch: () => void;
}

/** Return shape of {@link useDetectedUserAutoLoad}. */
interface UseDetectedUserAutoLoadReturn {
  /** The detected id that has been auto-loaded, or `null`. Doubles as the re-entrancy guard. */
  hasAutoLoadedUser: string | null;
  /** Clears the guard so the currently-detected user auto-loads again. */
  resetAutoLoad: () => void;
}

/**
 * Hook that auto-loads the page-detected user into the Users tab exactly once.
 *
 * @param options - See {@link UseDetectedUserAutoLoadOptions}.
 * @returns `hasAutoLoadedUser` (the loaded id / re-entrancy guard) and
 *   `resetAutoLoad` to force a reload of the same detected user.
 */
export function useDetectedUserAutoLoad({
  targetTabId,
  detectedUserId,
  isLoadingUserContext,
  loadMemberships,
  clearMemberships,
  onSelectUser,
  onError,
  onLoadingChange,
  onResetSearch,
}: UseDetectedUserAutoLoadOptions): UseDetectedUserAutoLoadReturn {
  const [hasAutoLoadedUser, setHasAutoLoadedUser] = useState<string | null>(null);

  // Held in a ref so the auto-load effect's re-run trigger stays limited to the
  // detected user changing — passing these inline must not re-fire the load chain.
  const depsRef = useRef({
    loadMemberships,
    clearMemberships,
    onSelectUser,
    onError,
    onLoadingChange,
    onResetSearch,
  });
  depsRef.current = {
    loadMemberships,
    clearMemberships,
    onSelectUser,
    onError,
    onLoadingChange,
    onResetSearch,
  };

  // Auto-load detected user from page context
  useEffect(() => {
    if (!targetTabId || isLoadingUserContext) return;
    if (!detectedUserId) {
      // Not on a user page - reset auto-load state
      setHasAutoLoadedUser((prev) => (prev ? null : prev));
      return;
    }

    // Only auto-load if we haven't already loaded this user
    if (hasAutoLoadedUser === detectedUserId) return;

    const autoLoadUser = async () => {
      const {
        loadMemberships,
        clearMemberships,
        onSelectUser,
        onError,
        onLoadingChange,
        onResetSearch,
      } = depsRef.current;

      log.debug('Auto-loading detected user:', detectedUserId);
      setHasAutoLoadedUser(detectedUserId);
      onLoadingChange(true);
      onError(null);
      onResetSearch(); // Clear search results + query when auto-loading

      try {
        // First fetch user details
        const userResponse = await chrome.tabs.sendMessage(targetTabId, {
          action: 'getUserDetails',
          userId: detectedUserId,
        });

        if (!userResponse.success) {
          throw new Error(userResponse.error || 'Failed to fetch user details');
        }

        const user: OktaUser = userResponse.data;
        onSelectUser(user);

        // Then load memberships (drives isLoadingMemberships/error via callbacks).
        await loadMemberships(user);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load detected user';
        onSelectUser(null);
        // clearMemberships() reports error=null via its callback; set the real
        // message afterwards so it wins the merged channel (last-write-wins).
        clearMemberships();
        onError(message);
        onLoadingChange(false);
      }
    };

    autoLoadUser();
  }, [detectedUserId, targetTabId, isLoadingUserContext, hasAutoLoadedUser]);

  const resetAutoLoad = useCallback(() => setHasAutoLoadedUser(null), []);

  return { hasAutoLoadedUser, resetAutoLoad };
}
