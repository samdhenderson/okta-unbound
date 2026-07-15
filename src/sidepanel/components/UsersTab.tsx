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
import React, { useState, useCallback } from 'react';
import PageHeader from './shared/PageHeader';
import AlertMessage from './shared/AlertMessage';
import Button from './shared/Button';
import Modal from './shared/Modal';
import EmptyState from './shared/EmptyState';
import LoadingSpinner from './shared/LoadingSpinner';
import { GroupMembershipsList, UserProfileCard, UserSearchBar, UserSearchResults } from './users';
import type { OktaUser } from '../../shared/types';
import type { AlertMessageData } from './shared/AlertMessage';
import { useUserContext } from '../hooks/useUserContext';
import { useUserMemberships } from '../hooks/useUserMemberships';
import { useUsersTabSearch } from '../hooks/useUsersTabSearch';
import { useDetectedUserAutoLoad } from '../hooks/useDetectedUserAutoLoad';
import { useUserLifecycleActions } from '../hooks/useUserLifecycleActions';
import { useAddToGroup } from '../hooks/useAddToGroup';

interface UsersTabProps {
  /** Chrome tab id of the connected Okta tab; required for all user/group API calls. */
  targetTabId?: number;
  /** Id of the currently detected group; highlights that group in the membership list. */
  currentGroupId?: string;
  /** Navigates to the Rules tab and deep-links to the rule that added a membership. */
  onNavigateToRule?: (ruleId: string) => void;
}

/**
 * Renders the Users tab: user search/auto-load, the detailed profile card and its
 * collapsible sections, lifecycle actions, the Add-to-Group modal, and the analysed
 * group-membership list.
 */
const UsersTab: React.FC<UsersTabProps> = ({ targetTabId, currentGroupId, onNavigateToRule }) => {
  const { userInfo, isLoading: isLoadingUserContext, oktaOrigin } = useUserContext();
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OktaUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<AlertMessageData | null>(null);

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

  // Auto-load the user detected on the page. The raw `getUserDetails` read path (a
  // §8-preserved scheduler bypass) lives in the hook; every orchestrator write goes
  // through these callbacks so the load fires exactly once per detected id.
  const onResetSearch = useCallback(() => {
    setSearchResults([]);
    setSearchQuery('');
  }, [setSearchResults, setSearchQuery]);

  const { resetAutoLoad } = useDetectedUserAutoLoad({
    targetTabId,
    detectedUserId: userInfo?.userId,
    isLoadingUserContext,
    loadMemberships,
    clearMemberships,
    onSelectUser: setSelectedUser,
    onError: setError,
    onLoadingChange: setIsLoadingMemberships,
    onResetSearch,
  });

  // Clear search and reset to initial state
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    clearMemberships();
    resetAutoLoad();
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
    onAdded: handleSelectUser,
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

          {/* Detected user hint */}
          {userInfo && !selectedUser && !searchQuery && (
            <div className="px-4 py-2.5 bg-primary-light border border-primary-highlight rounded-md flex items-center gap-2">
              <span className="text-sm text-neutral-700">
                Detected: <strong className="text-neutral-900">{userInfo.userName}</strong>
              </span>
              {userInfo.userStatus && (
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-md ${
                    userInfo.userStatus === 'ACTIVE'
                      ? 'bg-success-light text-success-text'
                      : userInfo.userStatus === 'DEPROVISIONED'
                        ? 'bg-danger-light text-danger-text'
                        : 'bg-warning-light text-warning-text'
                  }`}
                >
                  {userInfo.userStatus}
                </span>
              )}
            </div>
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
              groupCount={memberships.length}
              oktaOrigin={oktaOrigin}
              afterCard={
                selectedUser.status !== 'DEPROVISIONED' ? (
                  <div className="bg-white rounded-md border border-neutral-200 px-5 py-4">
                    <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-3">
                      Lifecycle Actions
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.status === 'ACTIVE' && (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isLifecycleLoading}
                          onClick={() => setPendingLifecycleAction('suspend')}
                        >
                          Suspend User
                        </Button>
                      )}
                      {selectedUser.status === 'SUSPENDED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isLifecycleLoading}
                          onClick={() => setPendingLifecycleAction('unsuspend')}
                        >
                          Unsuspend User
                        </Button>
                      )}
                      {(selectedUser.status === 'ACTIVE' ||
                        selectedUser.status === 'RECOVERY' ||
                        selectedUser.status === 'LOCKED_OUT' ||
                        selectedUser.status === 'PASSWORD_EXPIRED') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isLifecycleLoading}
                          onClick={() => setPendingLifecycleAction('resetPassword')}
                        >
                          Reset Password
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-3 bg-neutral-50 rounded-md border border-neutral-200">
                    <p className="text-xs text-neutral-500">
                      No lifecycle actions are available for deprovisioned users.
                    </p>
                  </div>
                )
              }
            />

            {/* Confirmation modal for lifecycle actions */}
            <Modal
              isOpen={pendingLifecycleAction !== null}
              onClose={() => setPendingLifecycleAction(null)}
              title={
                pendingLifecycleAction === 'suspend'
                  ? 'Suspend User'
                  : pendingLifecycleAction === 'unsuspend'
                    ? 'Unsuspend User'
                    : 'Reset Password'
              }
              size="sm"
              footer={
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPendingLifecycleAction(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant={pendingLifecycleAction === 'suspend' ? 'danger' : 'primary'}
                    size="sm"
                    onClick={confirmLifecycleAction}
                  >
                    {pendingLifecycleAction === 'suspend'
                      ? 'Suspend'
                      : pendingLifecycleAction === 'unsuspend'
                        ? 'Unsuspend'
                        : 'Send Reset Email'}
                  </Button>
                </>
              }
            >
              <p className="text-sm text-neutral-700">
                {pendingLifecycleAction === 'suspend' && (
                  <>
                    Are you sure you want to suspend{' '}
                    <strong className="text-neutral-900">
                      {selectedUser.profile.firstName} {selectedUser.profile.lastName}
                    </strong>
                    ? They will be unable to sign in until unsuspended.
                  </>
                )}
                {pendingLifecycleAction === 'unsuspend' && (
                  <>
                    Unsuspend{' '}
                    <strong className="text-neutral-900">
                      {selectedUser.profile.firstName} {selectedUser.profile.lastName}
                    </strong>
                    ? They will regain the ability to sign in.
                  </>
                )}
                {pendingLifecycleAction === 'resetPassword' && (
                  <>
                    Send a password reset email to{' '}
                    <strong className="text-neutral-900">{selectedUser.profile.email}</strong>?
                  </>
                )}
              </p>
            </Modal>

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
      <Modal
        isOpen={isAddToGroupModalOpen}
        onClose={handleCloseAddToGroupModal}
        title={`Add ${selectedUser?.profile?.firstName || 'User'} to Group`}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={handleCloseAddToGroupModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmAddToGroup}
              disabled={!selectedGroup || isAddingToGroup}
              loading={isAddingToGroup}
            >
              Add to Group
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Search for a group
            </label>
            <input
              type="text"
              value={groupSearchQuery}
              onChange={(e) => setGroupSearchQuery(e.target.value)}
              placeholder="Type to search by group name..."
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {isSearchingGroups && (
              <div className="absolute right-3 top-8">
                <LoadingSpinner size="sm" />
              </div>
            )}

            {/* Search results dropdown */}
            {showGroupDropdown && groupSearchResults.length > 0 && !selectedGroup && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {groupSearchResults.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => selectGroup(group)}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                  >
                    <div className="text-sm font-medium text-neutral-900">{group.name}</div>
                    <div className="text-xs text-neutral-500">{group.type}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected group display */}
          {selectedGroup && (
            <div className="flex items-center justify-between p-3 bg-primary-light border border-primary-highlight rounded-md">
              <div>
                <div className="text-sm font-medium text-neutral-900">{selectedGroup.name}</div>
                <div className="text-xs text-neutral-500">{selectedGroup.type}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSelectedGroup}>
                Clear
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default UsersTab;
