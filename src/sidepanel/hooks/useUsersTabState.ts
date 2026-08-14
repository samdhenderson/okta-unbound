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
 * It also owns the post-add success flash: `recentlyAddedGroupId` names the group the
 * membership list should flash once, and {@link UseUsersTabStateReturn.confirmAddToGroup}
 * wraps the modal's confirm so that group is captured before the modal resets itself.
 *
 * {@link App} hides the Users tab rather than unmounting it, so the tab must be
 * inert while hidden: `isActive` is threaded into the three things here that can
 * reach Okta without a click — live user-page detection, the user-search debounce
 * and the Add-to-Group type-ahead (ADR-0018).
 *
 * ## Sub-navigation
 *
 * The hook also owns the tab's {@link sidepanel/hooks/useViewStack.useViewStack}
 * stack, whose one pushed view is the user comparison (ADR-0016). "Compare" is a
 * push rather than a modal open, so `isCompareOpen` is now derived from the stack
 * (`!nav.isRoot`) and the cross-tab deep link resets the stack before loading its
 * user — a pushed view would otherwise hide the profile that deep link is for.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import type { GroupMembership, OktaUser, UserInfo } from '../../shared/types';
import type { AlertMessageData } from '../components/shared/AlertMessage';
import { invalidate } from '../cache/entityCache';
import { cacheKeys } from '../cache/keys';
import { userDisplayName } from '../../shared/utils/userDisplay';
import { useUserContext } from './useUserContext';
import { useUserMemberships } from './useUserMemberships';
import { useUsersTabSearch } from './useUsersTabSearch';
import { useDetectedUser } from './useDetectedUser';
import { useUserLifecycleActions } from './useUserLifecycleActions';
import { useAddToGroup } from './useAddToGroup';
import { useViewStack, type ViewStack } from './useViewStack';

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
  /**
   * Ref on the pushed view's container, owned by the tab. Handed to
   * {@link sidepanel/hooks/useViewStack.useViewStack} so focus moves into a pushed
   * comparison; passed **in** rather than returned, per that hook's contract.
   */
  compareViewRef?: React.RefObject<HTMLElement | null>;
}

/**
 * One pushed view of the Users tab's stack.
 *
 * Two rungs, in this order: a user's **detail** page, and a **comparison**
 * anchored on that user. The detail page used to render inline under the search
 * box, which left the tab with two navigation models at once — a real stack for
 * the comparison, and nothing at all for the page you were actually reading. The
 * header could not name the user you had open, and there was no back affordance
 * (ADR-0030; the Groups tab has drilled in this way since ADR-0016).
 */
export type UsersViewEntry =
  | {
      kind: 'detail';
      /** Id of the user whose profile + memberships are shown. */
      userId: string;
      /** That user's display name at push time, for the breadcrumb/title. */
      userName: string;
    }
  | {
      kind: 'compare';
      /** Id of the user the comparison is anchored on (its left-hand side). */
      userId: string;
      /** That user's display name at push time, for the breadcrumb/subtitle. */
      userName: string;
    };

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
  /** The tab's sub-navigation stack: search → a user's detail → their comparison. */
  nav: ViewStack<UsersViewEntry>;
  /** Whether a user's detail page is the view on screen. */
  isDetailOpen: boolean;
  /** Whether a comparison is the view on screen (the stack's second rung). */
  isCompareOpen: boolean;
  /** Pushes the comparison view for the selected user. No-op without one. */
  openCompare: () => void;
  /** Pops the comparison view, returning to the search + profile body. */
  closeCompare: () => void;
  /**
   * Reloads the selected user's memberships in place after the comparison view
   * copies a group onto them. Deliberately does NOT touch the selected user or the
   * view stack, so adding a group never closes the comparison.
   */
  refreshSelectedUserMemberships: () => void;
  /** Lifecycle actions (suspend / unsuspend / reset password) and their confirm modal. */
  lifecycle: ReturnType<typeof useUserLifecycleActions>;
  /** The Add-to-Group modal's state machine (type-ahead, selection, add). */
  addToGroup: ReturnType<typeof useAddToGroup>;
  /**
   * The Add-to-Group modal's confirm handler — use this in place of
   * {@link UseUsersTabStateReturn.addToGroup}'s own `confirmAddToGroup`. It snapshots
   * the group being confirmed before delegating, so the row for that group can flash
   * once the add resolves; every other `addToGroup` member is passed through unchanged.
   */
  confirmAddToGroup: () => Promise<void>;
  /**
   * Id of the group most recently added via the Add-to-Group modal, so its row in the
   * membership list can play a one-shot success flash; `null` once the flash is over.
   */
  recentlyAddedGroupId: string | null;
}

/**
 * Breadcrumb label per rung: the detail rung is named for its user, so the trail
 * reads `Users › Jane Doe › Compare users` rather than repeating the tab name.
 */
const viewCrumbLabel = (entry: UsersViewEntry): string =>
  entry.kind === 'compare' ? 'Compare users' : entry.userName;

/** Stable breadcrumb key: the same user can appear on both rungs at once. */
const viewCrumbKey = (entry: UsersViewEntry): string => `${entry.kind}-${entry.userId}`;

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
  compareViewRef,
}: UseUsersTabStateOptions): UseUsersTabStateReturn {
  const { userInfo, oktaOrigin } = useUserContext(isActive);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OktaUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<AlertMessageData | null>(null);
  // Detected-user banner is hidden per id once dismissed (the tab stays pinned to
  // the user you explicitly selected; admin navigation never swaps it).
  const [dismissedDetectedId, setDismissedDetectedId] = useState<string | null>(null);
  // Id of the group most recently added via the Add-to-Group modal, so its row in
  // GroupMembershipsList can play a one-shot success flash (`animate-affirm-flash`)
  // instead of the confirmation only showing in the banner above the fold.
  // `pendingAddGroupIdRef` is set synchronously at confirm-click time (before the
  // modal's own state resets), and read once the add resolves successfully.
  const [recentlyAddedGroupId, setRecentlyAddedGroupId] = useState<string | null>(null);
  const pendingAddGroupIdRef = useRef<string | null>(null);

  // Sub-navigation (ADR-0016): the search + profile body stays mounted (hidden) and
  // the comparison renders as its sibling, so the selected user, their analysed
  // memberships and the search box all survive a push→pop round trip.
  const nav = useViewStack<UsersViewEntry>({
    rootLabel: 'User Search',
    getLabel: viewCrumbLabel,
    getKey: viewCrumbKey,
    viewRef: compareViewRef,
  });
  const currentView = nav.currentEntry?.kind ?? 'search';
  const isDetailOpen = currentView === 'detail';
  const isCompareOpen = currentView === 'compare';

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

  /**
   * Put the stack on `user`'s detail rung — **idempotently**.
   *
   * The guard is load-bearing, not defensive: a membership reload after an
   * Add-to-Group re-selects the same user, and the comparison copies a group and
   * re-selects too. Without it every one of those would push a second detail rung
   * and stack duplicate breadcrumbs behind the reader.
   *
   * Held in a ref rather than read off `nav.currentEntry` so the callback keeps a
   * stable identity (`useViewStack` documents why reading `currentEntry` in a
   * callback is a trap), and cleared whenever the stack returns to root.
   */
  const detailUserIdRef = useRef<string | null>(null);
  const { push: pushView } = nav;
  const showUserDetail = useCallback(
    (user: OktaUser) => {
      if (detailUserIdRef.current === user.id) return;
      detailUserIdRef.current = user.id;
      pushView({ kind: 'detail', userId: user.id, userName: userDisplayName(user) });
    },
    [pushView],
  );

  // Returning to the search results ends the detail rung, so the next selection —
  // even of the same user — pushes afresh rather than being swallowed as a repeat.
  useEffect(() => {
    if (nav.isRoot) detailUserIdRef.current = null;
  }, [nav.isRoot]);

  const handleSelectUser = useCallback(
    async (user: OktaUser) => {
      if (!targetTabId) return;

      setRecentlyAddedGroupId(null);
      setSelectedUser(user);
      showUserDetail(user);
      await loadMemberships(user);
    },
    [targetTabId, loadMemberships, showUserDetail],
  );

  // After adding the user to a group their memberships have changed — drop the
  // cached analysis so the reload reflects the new group, then flash the row for
  // the group that was just added (captured in `pendingAddGroupIdRef` at
  // confirm-click time, before the Add-to-Group modal resets its own state).
  const handleUserAddedToGroup = useCallback(
    async (user: OktaUser) => {
      invalidate(cacheKeys.userMemberships(user.id));
      await handleSelectUser(user);
      setRecentlyAddedGroupId(pendingAddGroupIdRef.current);
    },
    [handleSelectUser],
  );

  // `animate-affirm-flash`'s final keyframe holds `border-color: transparent`
  // (fill-mode `both`), which would permanently override the row's normal border
  // once applied — clear the flash after its one-shot duration so the class comes
  // back off and the row's ordinary border takes over again.
  useEffect(() => {
    if (!recentlyAddedGroupId) return;
    // Mirrors `--dur-tell` (500ms), the `animate-affirm-flash` duration in
    // tailwind.css — keep the two in step if that token moves.
    const AFFIRM_FLASH_MS = 500;
    const timer = window.setTimeout(() => setRecentlyAddedGroupId(null), AFFIRM_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [recentlyAddedGroupId]);

  // Compare-modal refresh: after a group is copied onto the selected user, drop the
  // cached analysis and reload their memberships in place. Crucially this does NOT
  // touch `selectedUser` or the modal's open state, so adding a group never closes
  // the comparison or resets the tab — you can keep adding.
  const refreshSelectedUserMemberships = useCallback(() => {
    if (!selectedUser) return;
    invalidate(cacheKeys.userMemberships(selectedUser.id));
    void loadMemberships(selectedUser, { force: true });
  }, [selectedUser, loadMemberships]);

  // Load the user detected on the page — only when the banner's Load button is
  // clicked. The raw `getUserDetails` read path (a §8-preserved scheduler bypass)
  // lives in the hook; orchestrator writes go through these callbacks.
  const onResetSearch = useCallback(() => {
    setSearchResults([]);
    setSearchQuery('');
  }, [setSearchResults, setSearchQuery]);

  // The detected-user banner and the cross-tab deep link both select a user
  // without going through `handleSelectUser`, so they open the detail rung here.
  // `null` means the selection was cleared, which is the root's business.
  const onDetectedUserSelected = useCallback(
    (user: OktaUser | null) => {
      setSelectedUser(user);
      if (user) showUserDetail(user);
    },
    [showUserDetail],
  );

  const { loadDetectedUser, loadUserById } = useDetectedUser({
    targetTabId,
    detectedUserId: userInfo?.userId,
    loadMemberships,
    onSelectUser: onDetectedUserSelected,
    onError: setError,
    onLoadingChange: setIsLoadingMemberships,
    onResetSearch,
  });

  // Fulfil a one-shot `selectedUserId` request (e.g. Overview's "View all groups")
  // exactly once — load that user + memberships, then clear the request so it can
  // fire again for a repeat navigation.
  const requestedUserRef = useRef<string | null>(null);
  const { reset: resetNav } = nav;
  useEffect(() => {
    if (!selectedUserId) {
      requestedUserRef.current = null;
      return;
    }
    if (selectedUserId === requestedUserRef.current) return;
    requestedUserRef.current = selectedUserId;
    // The deep-link contract targets a *profile*, so pop any pushed comparison
    // first — otherwise the body it loads into is hidden behind that view.
    resetNav();
    loadUserById(selectedUserId);
    onUserSelected?.();
  }, [selectedUserId, loadUserById, onUserSelected, resetNav]);

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

  // Clear search and reset to initial state. Also pops the view stack: clearing the
  // selected user unmounts the comparison's host, and a pushed view with no host
  // would render an empty screen behind a back button.
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setRecentlyAddedGroupId(null);
    clearMemberships();
    setError(null);
    setResultMessage(null);
    resetNav();
  }, [setSearchQuery, setSearchResults, clearMemberships, resetNav]);

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

  // Captures the group being confirmed BEFORE the modal resets its own
  // `selectedGroup` state, so `handleUserAddedToGroup` (fired only on success)
  // knows which row to flash even after the modal has already closed.
  const { selectedGroup, confirmAddToGroup: confirmAddToGroupInner } = addToGroup;
  const confirmAddToGroup = useCallback(() => {
    pendingAddGroupIdRef.current = selectedGroup?.id ?? null;
    return confirmAddToGroupInner();
  }, [selectedGroup, confirmAddToGroupInner]);

  const dismissError = useCallback(() => setError(null), []);
  const dismissResultMessage = useCallback(() => setResultMessage(null), []);

  const { pop: popCompare } = nav;
  const openCompare = useCallback(() => {
    if (!selectedUser) return;
    pushView({ kind: 'compare', userId: selectedUser.id, userName: userDisplayName(selectedUser) });
  }, [selectedUser, pushView]);
  const closeCompare = popCompare;

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
    nav,
    isDetailOpen,
    isCompareOpen,
    openCompare,
    closeCompare,
    refreshSelectedUserMemberships,
    lifecycle,
    addToGroup,
    confirmAddToGroup,
    recentlyAddedGroupId,
  };
}
