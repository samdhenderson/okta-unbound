/**
 * @module sidepanel/hooks/useUsersTabState
 * @description Orchestrates every piece of Users-tab state so the tab is pure composition.
 *
 * Owns the tab's shell state (selected user, merged error channel, lifecycle result
 * banner, detected-user dismissal, compare-modal open flag) and wires together the
 * feature hooks it coordinates: page context ({@link useUserContext}), membership
 * loading + attribution ({@link useUserMemberships}), the debounced user search
 * ({@link useUsersTabSearch}), the on-demand detected-user loader
 * ({@link useDetectedUser}), the lifecycle actions
 * ({@link useUserLifecycleActions}) and the Add-to-Group modal
 * ({@link useAddToGroup}).
 *
 * {@link App} hides the Users tab rather than unmounting it, so the tab must be
 * inert while hidden: `isActive` is threaded into the three things here that can
 * reach Okta without a click — live user-page detection, the user-search debounce
 * and the Add-to-Group type-ahead (ADR-0018).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GroupMembership, OktaUser, UserInfo } from '../../shared/types';
import type { AlertMessageData } from '../components/shared/AlertMessage';
import { invalidate } from '../cache/entityCache';
import { useUserContext } from './useUserContext';
import { useUserMemberships } from './useUserMemberships';
import { useUsersTabSearch } from './useUsersTabSearch';
import { useDetectedUser } from './useDetectedUser';
import { useUserLifecycleActions } from './useUserLifecycleActions';
import { useAddToGroup } from './useAddToGroup';

/** Options for {@link useUsersTabState}. */
export interface UseUsersTabStateOptions {
  /** Chrome tab id of the connected Okta tab; required for all user/group API calls. */
  targetTabId?: number;
  /**
   * One-shot request to open a specific user (e.g. from the Overview's "View all
   * groups"): the hook fetches that user + their memberships, then calls
   * {@link UseUsersTabStateOptions.onUserSelected} to clear the request.
   */
  selectedUserId?: string | null;
  /** Invoked once {@link UseUsersTabStateOptions.selectedUserId} has been consumed. */
  onUserSelected?: () => void;
  /**
   * Whether the Users tab is the selected top-level tab. Gates live page-context
   * re-detection, the search debounce and the Add-to-Group type-ahead so a hidden
   * tab spends no scheduler budget. Defaults to `true`.
   */
  isActive?: boolean;
}

/** Return shape of {@link useUsersTabState}. */
export interface UseUsersTabStateReturn {
  /** Okta org origin from the page context; used to build admin deep links. */
  oktaOrigin: string | null;
  /** The user whose profile + memberships the tab is showing, or `null`. */
  selectedUser: OktaUser | null;
  /** The selected user's memberships, each classified DIRECT vs RULE_BASED. */
  memberships: GroupMembership[];
  /** True while a user's memberships are being loaded/analysed. */
  isLoadingMemberships: boolean;
  /** The tab's single merged error channel (search / load / membership failures). */
  error: string | null;
  /** Dismisses the merged error banner. */
  dismissError: () => void;
  /** Result banner for lifecycle / add-to-group outcomes. */
  resultMessage: AlertMessageData | null;
  /** Dismisses the result banner. */
  dismissResultMessage: () => void;
  /** Current search box value. */
  searchQuery: string;
  /** Updates the search box, (re)arming the 600ms debounce. */
  setSearchQuery: (query: string) => void;
  /** Latest committed search results. */
  searchResults: OktaUser[];
  /** True while a debounced search is in flight. */
  isSearching: boolean;
  /**
   * The user detected on the current admin page when the banner should be offered
   * (different from the selected user, not dismissed, no active search), else `null`.
   */
  detectedUser: UserInfo | null;
  /** Loads the detected user + their memberships (the banner's Load button). */
  loadDetectedUser: () => Promise<void>;
  /** Hides the detected-user banner for that user id without loading. */
  dismissDetectedUser: () => void;
  /** Selects a user from the search results and loads their memberships. */
  selectUser: (user: OktaUser) => Promise<void>;
  /** Clears the search, selection, memberships and both banners. */
  clearSearch: () => void;
  /** Whether the user-comparison modal is open. */
  isCompareOpen: boolean;
  /** Opens the user-comparison modal. */
  openCompare: () => void;
  /** Closes the user-comparison modal. */
  closeCompare: () => void;
  /**
   * Reloads the selected user's memberships in place after the comparison modal
   * copies a group onto them. Deliberately does NOT touch the selected user or the
   * modal's open state, so adding a group never closes the comparison.
   */
  refreshSelectedUserMemberships: () => void;
  /** Lifecycle actions (suspend / unsuspend / reset password) and their confirm modal. */
  lifecycle: ReturnType<typeof useUserLifecycleActions>;
  /** The Add-to-Group modal's state machine (type-ahead, selection, add). */
  addToGroup: ReturnType<typeof useAddToGroup>;
}

/**
 * Hook owning all Users-tab state and the hook wiring between its features.
 *
 * @param options - See {@link UseUsersTabStateOptions}.
 * @returns Everything {@link UsersTab} renders: see {@link UseUsersTabStateReturn}.
 */
export function useUsersTabState({
  targetTabId,
  selectedUserId,
  onUserSelected,
  isActive = true,
}: UseUsersTabStateOptions): UseUsersTabStateReturn {
  const { userInfo, oktaOrigin } = useUserContext(isActive);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OktaUser | null>(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<AlertMessageData | null>(null);
  // Detected-user banner is hidden per id once dismissed (the tab stays pinned to
  // the user you explicitly selected; admin navigation never swaps it).
  const [dismissedDetectedId, setDismissedDetectedId] = useState<string | null>(null);

  // Membership loading + attribution lives in the shared hook (also used by
  // UserOverview / user comparison). The orchestrator keeps owning the merged
  // `error` banner and the `isLoadingMemberships` flag via the hook's callbacks,
  // so last-write-wins across search / auto-load / lifecycle is preserved.
  const { memberships, loadMemberships, clearMemberships } = useUserMemberships({
    targetTabId,
    onError: setError,
    onLoadingChange: setIsLoadingMemberships,
  });

  // Debounced user search. The raw `searchUsers` read path (a §8-preserved
  // scheduler bypass) lives in the hook; a fresh search clears the selected user
  // and its memberships via `onSearchStart` and reports failures through the tab's
  // single merged `error` channel.
  const onSearchStart = useCallback(() => {
    setSelectedUser(null);
    clearMemberships();
  }, [clearMemberships]);

  const { searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching } =
    useUsersTabSearch({ targetTabId, onError: setError, onSearchStart, enabled: isActive });

  const handleSelectUser = useCallback(
    async (user: OktaUser) => {
      if (!targetTabId) return;

      setSelectedUser(user);
      await loadMemberships(user);
    },
    [targetTabId, loadMemberships],
  );

  // After adding the user to a group their memberships have changed — drop the
  // cached analysis so the reload reflects the new group.
  const handleUserAddedToGroup = useCallback(
    async (user: OktaUser) => {
      invalidate(['userMemberships', user.id]);
      await handleSelectUser(user);
    },
    [handleSelectUser],
  );

  // Compare-modal refresh: after a group is copied onto the selected user, drop the
  // cached analysis and reload their memberships in place. Crucially this does NOT
  // touch `selectedUser` or the modal's open state, so adding a group never closes
  // the comparison or resets the tab — you can keep adding.
  const refreshSelectedUserMemberships = useCallback(() => {
    if (!selectedUser) return;
    invalidate(['userMemberships', selectedUser.id]);
    void loadMemberships(selectedUser, { force: true });
  }, [selectedUser, loadMemberships]);

  // Load the user detected on the page — only when the banner's Load button is
  // clicked. The raw `getUserDetails` read path (a §8-preserved scheduler bypass)
  // lives in the hook; orchestrator writes go through these callbacks.
  const onResetSearch = useCallback(() => {
    setSearchResults([]);
    setSearchQuery('');
  }, [setSearchResults, setSearchQuery]);

  const { loadDetectedUser, loadUserById } = useDetectedUser({
    targetTabId,
    detectedUserId: userInfo?.userId,
    loadMemberships,
    onSelectUser: setSelectedUser,
    onError: setError,
    onLoadingChange: setIsLoadingMemberships,
    onResetSearch,
  });

  // Fulfil a one-shot `selectedUserId` request (e.g. Overview's "View all groups")
  // exactly once — load that user + memberships, then clear the request so it can
  // fire again for a repeat navigation.
  const requestedUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedUserId) {
      requestedUserRef.current = null;
      return;
    }
    if (selectedUserId === requestedUserRef.current) return;
    requestedUserRef.current = selectedUserId;
    loadUserById(selectedUserId);
    onUserSelected?.();
  }, [selectedUserId, loadUserById, onUserSelected]);

  // Show the detected-user banner only when the page's user differs from the one
  // explicitly selected and hasn't been dismissed — never while searching.
  const detectedUserId = userInfo?.userId;
  const showDetectedBanner =
    Boolean(userInfo) &&
    detectedUserId !== selectedUser?.id &&
    detectedUserId !== dismissedDetectedId &&
    !searchQuery;

  const dismissDetectedUser = useCallback(() => {
    if (!userInfo) return;
    setDismissedDetectedId(userInfo.userId);
  }, [userInfo]);

  // Clear search and reset to initial state
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    clearMemberships();
    setError(null);
    setResultMessage(null);
  }, [setSearchQuery, setSearchResults, clearMemberships]);

  // Lifecycle actions (suspend / unsuspend / reset password) behind the confirm
  // modal. The hook owns its own scheduler slice; the orchestrator keeps the result
  // banner and patches the selected user's status in place after a refresh.
  const onUserStatusRefresh = useCallback((status: OktaUser['status']) => {
    setSelectedUser((prev) => (prev ? { ...prev, status } : prev));
  }, []);

  const lifecycle = useUserLifecycleActions({
    targetTabId,
    selectedUser,
    onResult: setResultMessage,
    onUserStatusRefresh,
  });

  // Add-to-Group modal: debounced group type-ahead + the add itself. The hook owns
  // its own scheduler slice; on success it refreshes memberships via handleSelectUser
  // and reports failures through the tab's result banner.
  const addToGroup = useAddToGroup({
    targetTabId,
    selectedUser,
    onResult: setResultMessage,
    onAdded: handleUserAddedToGroup,
    enabled: isActive,
  });

  const dismissError = useCallback(() => setError(null), []);
  const dismissResultMessage = useCallback(() => setResultMessage(null), []);
  const openCompare = useCallback(() => setIsCompareOpen(true), []);
  const closeCompare = useCallback(() => setIsCompareOpen(false), []);

  return {
    oktaOrigin,
    selectedUser,
    memberships,
    isLoadingMemberships,
    error,
    dismissError,
    resultMessage,
    dismissResultMessage,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    detectedUser: showDetectedBanner && userInfo ? userInfo : null,
    loadDetectedUser,
    dismissDetectedUser,
    selectUser: handleSelectUser,
    clearSearch,
    isCompareOpen,
    openCompare,
    closeCompare,
    refreshSelectedUserMemberships,
    lifecycle,
    addToGroup,
  };
}
