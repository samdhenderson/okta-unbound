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
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useOktaApi } from '../hooks/useOktaApi';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('UsersTab');

interface UsersTabProps {
  /** Chrome tab id of the connected Okta tab; required for all user/group API calls. */
  targetTabId?: number;
  /** Id of the currently detected group; highlights that group in the membership list. */
  currentGroupId?: string;
  /** Navigates to the Rules tab and deep-links to the rule that added a membership. */
  onNavigateToRule?: (ruleId: string) => void;
}

/** User lifecycle operation triggered from the profile card. */
type LifecycleAction = 'suspend' | 'unsuspend' | 'resetPassword';

/** Shape returned by `searchGroups` in `groupDiscovery.ts` for the Add-to-Group flow. */
interface GroupSearchResult {
  id: string;
  name: string;
  description: string;
  type: string;
}

/**
 * Renders the Users tab: user search/auto-load, the detailed profile card and its
 * collapsible sections, lifecycle actions, the Add-to-Group modal, and the analysed
 * group-membership list.
 */
const UsersTab: React.FC<UsersTabProps> = ({ targetTabId, currentGroupId, onNavigateToRule }) => {
  const { userInfo, isLoading: isLoadingUserContext, oktaOrigin } = useUserContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OktaUser | null>(null);
  const [searchResults, setSearchResults] = useState<OktaUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<AlertMessageData | null>(null);
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<LifecycleAction | null>(
    null,
  );
  const [isLifecycleLoading, setIsLifecycleLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasAutoLoadedUser, setHasAutoLoadedUser] = useState<string | null>(null);

  // Add to Group modal state
  const [isAddToGroupModalOpen, setIsAddToGroupModalOpen] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<GroupSearchResult[]>([]);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupSearchResult | null>(null);
  const [isAddingToGroup, setIsAddingToGroup] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const groupDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { suspendUser, unsuspendUser, resetPassword, getUserById, searchGroups, addUserToGroup } =
    useOktaApi({
      targetTabId: targetTabId ?? null,
    });

  // Membership loading + attribution lives in the shared hook (also used by
  // UserOverview / user comparison). The orchestrator keeps owning the merged
  // `error` banner and the `isLoadingMemberships` flag via the hook's callbacks,
  // so last-write-wins across search / auto-load / lifecycle is preserved.
  const { memberships, loadMemberships, clearMemberships } = useUserMemberships({
    targetTabId,
    onError: setError,
    onLoadingChange: setIsLoadingMemberships,
  });

  const handleSearch = useCallback(async () => {
    if (!targetTabId) {
      setError('No Okta tab connected');
      return;
    }

    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSelectedUser(null);
    clearMemberships();

    try {
      log.debug('Searching for users', { queryLength: searchQuery.trim().length });

      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'searchUsers',
        query: searchQuery.trim(),
      });

      if (response.success) {
        setSearchResults(response.data || []);
        log.debug('Found users:', response.data?.length);
      } else {
        setError(response.error || 'Failed to search users');
        setSearchResults([]);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to communicate with Okta tab');
      setSearchResults([]);
      log.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [targetTabId, searchQuery, clearMemberships]);

  const handleSelectUser = async (user: OktaUser) => {
    if (!targetTabId) return;

    setSelectedUser(user);
    await loadMemberships(user);
  };

  // Live search with debouncing - trigger search as user types
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is empty or too short
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setError(null);
      return;
    }

    // Don't search if query is too short (minimum 2 characters for efficiency)
    if (searchQuery.trim().length < 2) {
      return;
    }

    // Debounce the search - wait 600ms after user stops typing
    debounceTimerRef.current = setTimeout(() => {
      handleSearch();
    }, 600);

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, targetTabId, handleSearch]);

  // Auto-load detected user from page context
  useEffect(() => {
    if (!targetTabId || isLoadingUserContext) return;
    if (!userInfo?.userId) {
      // Not on a user page - reset auto-load state
      if (hasAutoLoadedUser) {
        setHasAutoLoadedUser(null);
      }
      return;
    }

    // Only auto-load if we haven't already loaded this user
    if (hasAutoLoadedUser === userInfo.userId) return;

    const autoLoadUser = async () => {
      log.debug('Auto-loading detected user:', userInfo.userId);
      setHasAutoLoadedUser(userInfo.userId);
      setIsLoadingMemberships(true);
      setError(null);
      setSearchResults([]); // Clear search results when auto-loading
      setSearchQuery(''); // Clear search query

      try {
        // First fetch user details
        const userResponse = await chrome.tabs.sendMessage(targetTabId, {
          action: 'getUserDetails',
          userId: userInfo.userId,
        });

        if (!userResponse.success) {
          throw new Error(userResponse.error || 'Failed to fetch user details');
        }

        const user: OktaUser = userResponse.data;
        setSelectedUser(user);

        // Then load memberships (drives isLoadingMemberships/error via callbacks).
        await loadMemberships(user);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load detected user';
        setSelectedUser(null);
        // clearMemberships() reports error=null via its callback; set the real
        // message afterwards so it wins the merged channel (last-write-wins).
        clearMemberships();
        setError(message);
        setIsLoadingMemberships(false);
      }
    };

    autoLoadUser();
    // loadMemberships/clearMemberships are stable (keyed off targetTabId); the
    // guard `hasAutoLoadedUser` prevents re-entrancy, so they are intentionally
    // omitted to keep the effect's re-run trigger to the detected user changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo?.userId, targetTabId, isLoadingUserContext, hasAutoLoadedUser]);

  // Clear search and reset to initial state
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    clearMemberships();
    setHasAutoLoadedUser(null);
    setError(null);
    setResultMessage(null);
  };

  const handleLifecycleAction = async () => {
    if (!selectedUser || !pendingLifecycleAction) return;

    // Capture before clearing so success message lookup still works
    const action = pendingLifecycleAction;
    setIsLifecycleLoading(true);
    setPendingLifecycleAction(null);

    try {
      let result: { success: boolean; error?: string };

      if (action === 'suspend') {
        result = await suspendUser(selectedUser.id);
      } else if (action === 'unsuspend') {
        result = await unsuspendUser(selectedUser.id);
      } else {
        result = await resetPassword(selectedUser.id);
      }

      if (result.success) {
        const successMessages: Record<LifecycleAction, string> = {
          suspend: 'User suspended successfully. They can no longer sign in.',
          unsuspend: 'User unsuspended successfully. They can now sign in.',
          resetPassword: 'Password reset email sent successfully.',
        };
        setResultMessage({ text: successMessages[action], type: 'success' });

        // Refresh user status cheaply without reloading memberships
        if (action !== 'resetPassword') {
          const refreshed = await getUserById(selectedUser.id);
          if (refreshed) {
            setSelectedUser((prev) =>
              prev ? { ...prev, status: refreshed.status as OktaUser['status'] } : prev,
            );
          }
        }
      } else {
        setResultMessage({
          text: result.error || 'The operation failed. Please try again.',
          type: 'danger',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setResultMessage({ text: message, type: 'danger' });
    } finally {
      setIsLifecycleLoading(false);
    }
  };

  // Debounced group search for the Add to Group modal
  useEffect(() => {
    if (groupDebounceTimerRef.current) {
      clearTimeout(groupDebounceTimerRef.current);
    }

    if (groupSearchQuery.trim().length < 2) {
      setGroupSearchResults([]);
      setShowGroupDropdown(false);
      return;
    }

    groupDebounceTimerRef.current = setTimeout(async () => {
      setIsSearchingGroups(true);
      try {
        const results = await searchGroups(groupSearchQuery.trim());
        setGroupSearchResults(results);
        setShowGroupDropdown(results.length > 0);
      } catch {
        setGroupSearchResults([]);
        setShowGroupDropdown(false);
      } finally {
        setIsSearchingGroups(false);
      }
    }, 300);

    return () => {
      if (groupDebounceTimerRef.current) {
        clearTimeout(groupDebounceTimerRef.current);
      }
    };
  }, [groupSearchQuery, searchGroups]);

  const handleOpenAddToGroupModal = () => {
    setGroupSearchQuery('');
    setGroupSearchResults([]);
    setSelectedGroup(null);
    setShowGroupDropdown(false);
    setIsAddToGroupModalOpen(true);
  };

  const handleCloseAddToGroupModal = () => {
    setIsAddToGroupModalOpen(false);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
    setSelectedGroup(null);
    setShowGroupDropdown(false);
  };

  const handleConfirmAddToGroup = async () => {
    if (!selectedUser || !selectedGroup) return;

    setIsAddingToGroup(true);
    try {
      const result = await addUserToGroup(selectedGroup.id, selectedGroup.name, {
        id: selectedUser.id,
        profile: {
          login: selectedUser.profile.login,
          firstName: selectedUser.profile.firstName,
          lastName: selectedUser.profile.lastName,
          email: selectedUser.profile.email,
        },
      });

      if (result.success) {
        handleCloseAddToGroupModal();
        // Refresh memberships so the new group appears immediately
        await handleSelectUser(selectedUser);
      } else {
        setResultMessage({
          text: result.error || 'Failed to add user to group. Please try again.',
          type: 'danger',
        });
        handleCloseAddToGroupModal();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setResultMessage({ text: message, type: 'danger' });
      handleCloseAddToGroupModal();
    } finally {
      setIsAddingToGroup(false);
    }
  };

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
                    onClick={handleLifecycleAction}
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
                    onClick={() => {
                      setSelectedGroup(group);
                      setShowGroupDropdown(false);
                      setGroupSearchQuery('');
                    }}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedGroup(null);
                  setGroupSearchQuery('');
                }}
              >
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
