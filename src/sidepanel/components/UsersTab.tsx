/**
 * @module sidepanel/components/UsersTab
 * @description Users tab: search users and analyse their group memberships.
 *
 * Debounced live search over Okta users (or auto-loading the user detected on the
 * page), a rich profile card with collapsible detail sections, lifecycle actions
 * (suspend / unsuspend / reset password) behind confirm modals, an "Add to Group"
 * flow, and per-group membership attribution (rule-based vs. direct) computed by
 * `analyzeMemberships`. Security-sensitive profile fields are never shown.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import PageHeader from './shared/PageHeader';
import AlertMessage from './shared/AlertMessage';
import Button from './shared/Button';
import EmptyState from './shared/EmptyState';
import {
  AddToGroupModal,
  DetectedUserBanner,
  GroupMembershipsList,
  UserLifecycleActions,
  UserProfileCard,
  UserSearchBar,
  UserSearchResults,
} from './users';
import type { OktaUser } from '../../shared/types';
import type { AlertMessageData } from './shared/AlertMessage';
import { useUserContext } from '../hooks/useUserContext';
import { useUserMemberships } from '../hooks/useUserMemberships';
import { invalidate } from '../cache/entityCache';
import { useUsersTabSearch } from '../hooks/useUsersTabSearch';
import { useDetectedUser } from '../hooks/useDetectedUser';
import { useUserLifecycleActions } from '../hooks/useUserLifecycleActions';
import { useAddToGroup } from '../hooks/useAddToGroup';

interface UsersTabProps {
  /** Chrome tab id of the connected Okta tab; required for all user/group API calls. */
  targetTabId?: number;
  /** Id of the currently detected group; highlights that group in the membership list. */
  currentGroupId?: string;
  /** Navigates to the Rules tab and deep-links to the rule that added a membership. */
  onNavigateToRule?: (ruleId: string) => void;
  /**
   * One-shot request to open a specific user (e.g. from the Overview's "View all
   * groups"): the tab fetches that user + their memberships, then calls
   * {@link UsersTabProps.onUserSelected} to clear the request.
   */
  selectedUserId?: string | null;
  /** Invoked once {@link UsersTabProps.selectedUserId} has been consumed. */
  onUserSelected?: () => void;
}

/**
 * Renders the Users tab: user search/auto-load, the detailed profile card and its
 * collapsible sections, lifecycle actions, the Add-to-Group modal, and the analysed
 * group-membership list.
 */
const UsersTab: React.FC<UsersTabProps> = ({
  targetTabId,
  currentGroupId,
  onNavigateToRule,
  selectedUserId,
  onUserSelected,
}) => {
  const { userInfo, oktaOrigin } = useUserContext();
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OktaUser | null>(null);
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
    useUsersTabSearch({ targetTabId, onError: setError, onSearchStart });

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

  // Clear search and reset to initial state
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    clearMemberships();
    setError(null);
    setResultMessage(null);
  };

  // Lifecycle actions (suspend / unsuspend / reset password) behind the confirm
  // modal. The hook owns its own scheduler slice; the orchestrator keeps the result
  // banner and patches the selected user's status in place after a refresh.
  const onUserStatusRefresh = useCallback((status: OktaUser['status']) => {
    setSelectedUser((prev) => (prev ? { ...prev, status } : prev));
  }, []);

  const {
    pendingLifecycleAction,
    setPendingLifecycleAction,
    isLifecycleLoading,
    confirmLifecycleAction,
  } = useUserLifecycleActions({
    targetTabId,
    selectedUser,
    onResult: setResultMessage,
    onUserStatusRefresh,
  });

  // Add-to-Group modal: debounced group type-ahead + the add itself. The hook owns
  // its own scheduler slice; on success it refreshes memberships via handleSelectUser
  // and reports failures through the tab's result banner.
  const {
    isOpen: isAddToGroupModalOpen,
    groupSearchQuery,
    setGroupSearchQuery,
    groupSearchResults,
    isSearchingGroups,
    showGroupDropdown,
    selectedGroup,
    selectGroup,
    clearSelectedGroup,
    isAddingToGroup,
    openModal: handleOpenAddToGroupModal,
    closeModal: handleCloseAddToGroupModal,
    confirmAddToGroup: handleConfirmAddToGroup,
  } = useAddToGroup({
    targetTabId,
    selectedUser,
    onResult: setResultMessage,
    onAdded: handleUserAddedToGroup,
  });

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="User Search"
        subtitle="Search users and analyze their group memberships"
        badge={
          selectedUser ? { text: `${memberships.length} Groups`, variant: 'primary' } : undefined
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Search Section */}
        <div className="space-y-3">
          <UserSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClear={handleClearSearch}
            isSearching={isSearching}
            showClearButton={Boolean(searchQuery || selectedUser)}
          />

          {/* Detected-user banner: manual load only, so the tab is never hijacked. */}
          {showDetectedBanner && userInfo && (
            <DetectedUserBanner
              userInfo={userInfo}
              isLoading={isLoadingMemberships}
              onLoad={loadDetectedUser}
              onDismiss={() => setDismissedDetectedId(userInfo.userId)}
            />
          )}
        </div>

        {/* Error Display */}
        {error && (
          <AlertMessage
            message={{ text: error, type: 'danger' }}
            onDismiss={() => setError(null)}
            className="animate-in slide-in-from-top-2 duration-300"
          />
        )}

        {/* Lifecycle operation result */}
        {resultMessage && (
          <AlertMessage
            message={resultMessage}
            onDismiss={() => setResultMessage(null)}
            className="animate-in slide-in-from-top-2 duration-300"
          />
        )}

        {/* Search Results (the component self-hides when empty; caller gates on selection) */}
        {!selectedUser && (
          <UserSearchResults results={searchResults} onSelectUser={handleSelectUser} />
        )}

        {/* Selected User Details - Positioned directly under search */}
        {selectedUser && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
            <UserProfileCard
              user={selectedUser}
              oktaOrigin={oktaOrigin}
              afterCard={
                <UserLifecycleActions
                  user={selectedUser}
                  isLifecycleLoading={isLifecycleLoading}
                  pendingLifecycleAction={pendingLifecycleAction}
                  onRequestAction={setPendingLifecycleAction}
                  onCancel={() => setPendingLifecycleAction(null)}
                  onConfirm={confirmLifecycleAction}
                />
              }
            />

            {/* Group Memberships */}
            <GroupMembershipsList
              memberships={memberships}
              isLoading={isLoadingMemberships}
              currentGroupId={currentGroupId}
              oktaOrigin={oktaOrigin}
              onNavigateToRule={onNavigateToRule}
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenAddToGroupModal}
                  disabled={isLoadingMemberships}
                >
                  Add to Group
                </Button>
              }
            />
          </div>
        )}

        {/* Empty State - Show only when no search and no user selected */}
        {!isSearching && searchResults.length === 0 && !error && !selectedUser && !searchQuery && (
          <EmptyState
            icon="user"
            title="User Membership Tracing"
            description="Search for users to analyze their group memberships and understand why they're in specific groups"
          />
        )}
      </div>

      {/* Add to Group Modal */}
      <AddToGroupModal
        isOpen={isAddToGroupModalOpen}
        userFirstName={selectedUser?.profile?.firstName}
        groupSearchQuery={groupSearchQuery}
        onGroupSearchQueryChange={setGroupSearchQuery}
        groupSearchResults={groupSearchResults}
        isSearchingGroups={isSearchingGroups}
        showGroupDropdown={showGroupDropdown}
        selectedGroup={selectedGroup}
        onSelectGroup={selectGroup}
        onClearSelectedGroup={clearSelectedGroup}
        isAddingToGroup={isAddingToGroup}
        onClose={handleCloseAddToGroupModal}
        onConfirm={handleConfirmAddToGroup}
      />
    </div>
  );
};

export default UsersTab;
