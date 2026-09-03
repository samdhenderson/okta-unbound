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
 * and the Add-to-Group type-ahead (ADR-0018). The user-search debounce is also
 * gated on `nav.isRoot`, so a query typed just before pushing a rung cannot land
 * after the push and clear the user that rung is showing.
 *
 * ## The detail rung's panes
 *
 * Which of the rung's three panes (Groups / Apps / Profile) is on screen — and
 * the apps and profile-schema loads gated on it — live in
 * {@link sidepanel/hooks/useUserDetailPanes.useUserDetailPanes}, surfaced here as
 * `panes`. It is a separate hook rather than more fields on this one because the
 * pane's own filters and disclosures stay local to their pane; only `pane`
 * itself is read by anything outside the card (the tiered `ActionBar` and the
 * header's apps metric).
 *
 * ## Profile editing
 *
 * Three more hooks hang off the Profile pane — the draft, the blast-radius
 * prediction and the one undo the panel executes — and they are composed one
 * level out in
 * {@link sidepanel/hooks/useUsersTabProfileEdit.useUsersTabProfileEdit} so this
 * file gains a single `profileEdit` field instead of three state machines. What
 * it *does* keep is the lift: `setSelectedUser` is handed in as `onUserUpdated`,
 * because there is no `user` cache key and the object Okta returns after a save
 * has nowhere else to land.
 *
 * ## Sub-navigation
 *
 * The hook also owns the tab's {@link sidepanel/hooks/useViewStack.useViewStack}
 * stack, whose one pushed view is the user comparison (ADR-0016). "Compare" is a
 * push rather than a modal open, so `isCompareOpen` is now derived from the stack
 * (`!nav.isRoot`) and the cross-tab deep link resets the stack before loading its
 * user — a pushed view would otherwise hide the profile that deep link is for.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import type { GroupMembership, OktaUser } from '../../shared/types';
import type { AlertAction, AlertMessageData } from '../components/shared/AlertMessage';
import { invalidate } from '../cache/entityCache';
import { useOktaApi } from './useOktaApi';
import type { MemberRuleAttribution } from '../../shared/membership/memberRuleAttribution';
import { cacheKeys } from '../cache/keys';
import { userDisplayName } from '../../shared/utils/userDisplay';
import { useUserContext } from './useUserContext';
import { useUserMemberships } from './useUserMemberships';
import { useUsersTabSearch } from './useUsersTabSearch';
import { useDetectedUser } from './useDetectedUser';
import { useUserLifecycleActions } from './useUserLifecycleActions';
import { useAddToGroup } from './useAddToGroup';
import { useViewStack, type ViewStack } from './useViewStack';
import { useUserDetailPanes, type UseUserDetailPanesReturn } from './useUserDetailPanes';
import { useUsersTabProfileEdit, type UserProfileEditing } from './useUsersTabProfileEdit';

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
  /** Result banner for lifecycle / add-to-group / profile-save outcomes. */
  resultMessage: AlertMessageData | null;
  /**
   * The result banner's inline action, when the outcome offers one — today only
   * the `Undo` after a confirmed profile save.
   *
   * Held beside the message rather than inside it, but **only ever written
   * together with it**: every publisher goes through one setter that clears the
   * action, so a lifecycle result can never inherit the previous save's Undo
   * button. There is no toast primitive in this panel; `AlertMessage`'s own
   * action slot is where an inline verb belongs.
   */
  resultAction: AlertAction | null;
  /** Dismisses the result banner and its action. */
  dismissResultMessage: () => void;
  /** Current search box value. */
  searchQuery: string;
  /** Updates the search box, (re)arming the 600ms debounce. */
  setSearchQuery: (query: string) => void;
  /** Latest committed search results. */
  searchResults: OktaUser[];
  /** True while a debounced search is in flight. */
  isSearching: boolean;
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
  /**
   * Asks Okta which rules manage one of the selected user's memberships
   * (ADR-0031). `undefined` when there is no selected user or no connected tab,
   * which is what hides the per-row "Prove it" action rather than offering one
   * that cannot work.
   *
   * One request per call, so it is only ever invoked from that press.
   */
  proveMembershipSource?: (groupId: string) => Promise<MemberRuleAttribution>;
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
   * The detail rung's three panes: which one is on screen, and the apps and
   * profile data each of them loads on first entry. Lives in its own hook
   * ({@link sidepanel/hooks/useUserDetailPanes.useUserDetailPanes}) because
   * `pane` is the only piece of that state the rung's neighbours read — the
   * tiered `ActionBar` and the header's apps metric.
   */
  panes: UseUserDetailPanesReturn;
  /**
   * Everything that makes the Profile pane editable — the header's verbs, the
   * per-attribute cells and the save confirmation's props. Composed in
   * {@link sidepanel/hooks/useUsersTabProfileEdit.useUsersTabProfileEdit} so this
   * orchestrator gains one field rather than three hooks' worth of state.
   */
  profileEdit: UserProfileEditing;
  /**
   * Publishes a profile save made *outside* the Profile pane — today, the
   * Compare rung's left column, which edits this same `selectedUser`.
   *
   * The same lift {@link UseUsersTabStateReturn.profileEdit} performs
   * internally, exposed because the Compare rung sits beside the detail rung
   * rather than inside it. There is no `user` cache key, so a save that is not
   * lifted leaves every surface showing values Okta no longer holds; that is
   * also why the Compare view refuses to edit its left column at all when this
   * is not supplied.
   */
  applySelectedUserUpdate: (user: OktaUser) => void;
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
  const { oktaOrigin } = useUserContext(isActive);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OktaUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The banner and its inline action are two pieces of state with one writer.
  // Every publisher — lifecycle, add-to-group, profile save — goes through
  // `publishResult`, which clears the action unless the caller passes a new one;
  // otherwise a suspend result would arrive still wearing the previous save's
  // Undo button, which would then put values back into a profile nobody was
  // looking at.
  const [resultMessage, setResultMessage] = useState<AlertMessageData | null>(null);
  const [resultAction, setResultAction] = useState<AlertAction | null>(null);
  const publishResult = useCallback((message: AlertMessageData, action?: AlertAction) => {
    setResultMessage(message);
    setResultAction(action ?? null);
  }, []);
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
  const { memberships, rules, loadMemberships, clearMemberships } = useUserMemberships({
    targetTabId,
    oktaOrigin,
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

  // Gated on `nav.isRoot` as well as `isActive`: the search box is hidden (not
  // unmounted) once a rung is pushed, but a keystroke typed just before the push
  // still leaves the 600ms debounce armed. Left gated on `isActive` alone, that
  // debounce fires `onSearchStart` after the push and silently clears the very
  // user whose detail/comparison rung is now on screen. Mirrors the comparison
  // rung's own `searchEnabled` gate below.
  const { searchQuery, setSearchQuery, searchResults, setSearchResults, isSearching } =
    useUsersTabSearch({
      targetTabId,
      onError: setError,
      onSearchStart,
      enabled: isActive && nav.isRoot,
    });

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
  /**
   * Drop the cached analysis for one user and load it again from their *current*
   * profile.
   *
   * Takes the user rather than reading `selectedUser`, because the caller that
   * needs it most has just changed the profile: a profile write's reload has to
   * classify against the attributes it wrote, and `selectedUser` is whatever the
   * render this callback was created in closed over. Same id, older attributes,
   * and the rules are evaluated against the attributes.
   */
  const refreshMembershipsFor = useCallback(
    (user: OktaUser) => {
      invalidate(cacheKeys.userMemberships(user.id));
      void loadMemberships(user, { force: true });
    },
    [loadMemberships],
  );

  const refreshSelectedUserMemberships = useCallback(() => {
    if (!selectedUser) return;
    refreshMembershipsFor(selectedUser);
  }, [selectedUser, refreshMembershipsFor]);

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

  const { loadUserById } = useDetectedUser({
    targetTabId,
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

  /*
    The detected-user banner used to live here: a row inside the tab body offering
    to load whichever user the admin console had open. It is gone, generalised
    into the masthead's handoff offer (`useEntityHandoff`), which asks the same
    question for every detectable kind and costs no row. Accepting it sets
    `selectedUserId`, which the deep-link effect above already fulfils through
    `loadUserById` — the exact call the banner's Load button made. Its
    per-id dismissal moved with it, unchanged in scope.
  */

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
    setResultAction(null);
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
    onResult: publishResult,
    onUserStatusRefresh,
  });

  // Add-to-Group modal: debounced group type-ahead + the add itself. The hook owns
  // its own scheduler slice; on success it refreshes memberships via handleSelectUser
  // and reports failures through the tab's result banner.
  const addToGroup = useAddToGroup({
    targetTabId,
    selectedUser,
    onResult: publishResult,
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
  const dismissResultMessage = useCallback(() => {
    setResultMessage(null);
    setResultAction(null);
  }, []);

  // §8: this orchestrator owns one scheduler-routed read of its own — the
  // per-membership proof, which needs both the selected user and a live tab.
  const { getMembershipRuleProof } = useOktaApi({ targetTabId: targetTabId ?? null });
  const proveMembershipSource = useMemo(
    () =>
      selectedUser && targetTabId
        ? (groupId: string) => getMembershipRuleProof(groupId, selectedUser.id)
        : undefined,
    [selectedUser, targetTabId, getMembershipRuleProof],
  );

  // The detail rung's panes. Both of its loads are gated on their own pane and on
  // `isActive`, so opening a user pays for Groups only and a hidden tab pays for
  // nothing (ADR-0018).
  const panes = useUserDetailPanes({
    user: selectedUser,
    targetTabId,
    oktaOrigin,
    memberships,
    rules,
    enabled: isActive,
  });

  // Profile editing, composed one hook further out so this file does not grow
  // three more state machines. `enabled` is the pane gate as well as the tab
  // gate: a draft is never begun, and a write is never sent, from a pane nobody
  // is looking at (ADR-0018).
  //
  // `setSelectedUser` is the lift the whole flow turns on. There is no `user`
  // cache key, so the object Okta returns has nowhere else to land and the pane
  // would keep rendering the values the save just replaced.
  const profileEdit = useUsersTabProfileEdit({
    user: selectedUser,
    attributes: panes.attributes,
    memberships,
    rules,
    oktaOrigin,
    mastering: panes.mastering,
    targetTabId,
    enabled: isActive && panes.pane === 'profile',
    onUserUpdated: setSelectedUser,
    onMembershipsChanged: refreshMembershipsFor,
    onResult: publishResult,
  });

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
    resultAction,
    dismissResultMessage,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    selectUser: handleSelectUser,
    clearSearch,
    nav,
    isDetailOpen,
    isCompareOpen,
    proveMembershipSource,
    openCompare,
    closeCompare,
    refreshSelectedUserMemberships,
    lifecycle,
    addToGroup,
    panes,
    profileEdit,
    applySelectedUserUpdate: setSelectedUser,
    confirmAddToGroup,
    recentlyAddedGroupId,
  };
}
