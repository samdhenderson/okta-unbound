/**
 * @module sidepanel/components/UsersTab
 * @description Users tab: search users and analyse their group memberships.
 *
 * Debounced live search over Okta users (or auto-loading the user detected on the
 * page), a rich profile card with collapsible detail sections, lifecycle actions
 * (suspend / unsuspend / reset password) behind confirm modals, an "Add to Group"
 * flow, and per-group membership attribution (rule-based vs. direct) computed by
 * `analyzeMemberships`. Security-sensitive profile fields are never shown.
 *
 * The tab itself is composition only: all state and hook wiring live in
 * {@link sidepanel/hooks/useUsersTabState.useUsersTabState}, the search surface in
 * {@link UserSearchPanel} and the selected-user surface in {@link UserDetailPanel}.
 * The two modals stay mounted here as siblings of those panels, unchanged.
 *
 * {@link App} hides this tab rather than unmounting it when another top-level tab
 * is selected, so the selected user, their analysed memberships and the search box
 * all survive leaving it. In exchange the tab must be inert while hidden:
 * `isActive` suspends live user-page detection, the user-search debounce and the
 * Add-to-Group type-ahead — the three things here that can reach Okta without a click.
 */
import React from 'react';
import PageHeader from './shared/PageHeader';
import AlertMessage from './shared/AlertMessage';
import { AddToGroupModal, UserComparisonModal, UserDetailPanel, UserSearchPanel } from './users';
import { useUsersTabState } from '../hooks/useUsersTabState';

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
  /**
   * Whether this is the selected top-level tab. The tab stays mounted while
   * hidden ({@link App} hides rather than unmounts it, so the selected user and
   * their analysed memberships survive a trip to another tab), so live
   * page-context re-detection is suspended while it is `false` — a resync is
   * deferred until the tab is shown again. Defaults to `true`.
   */
  isActive?: boolean;
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
  isActive = true,
}) => {
  const state = useUsersTabState({ targetTabId, selectedUserId, onUserSelected, isActive });
  const { selectedUser, memberships, lifecycle, addToGroup } = state;

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
        <UserSearchPanel
          searchQuery={state.searchQuery}
          onSearchQueryChange={state.setSearchQuery}
          onClearSearch={state.clearSearch}
          isSearching={state.isSearching}
          searchResults={state.searchResults}
          onSelectUser={state.selectUser}
          detectedUser={state.detectedUser}
          isDetectedUserLoading={state.isLoadingMemberships}
          onLoadDetectedUser={state.loadDetectedUser}
          onDismissDetectedUser={state.dismissDetectedUser}
          hasSelectedUser={Boolean(selectedUser)}
          hasError={Boolean(state.error)}
          alerts={
            <>
              {/* Error Display */}
              {state.error && (
                <AlertMessage
                  message={{ text: state.error, type: 'danger' }}
                  onDismiss={state.dismissError}
                  className="animate-in slide-in-from-top-2 duration-300"
                />
              )}

              {/* Lifecycle operation result */}
              {state.resultMessage && (
                <AlertMessage
                  message={state.resultMessage}
                  onDismiss={state.dismissResultMessage}
                  className="animate-in slide-in-from-top-2 duration-300"
                />
              )}
            </>
          }
        />

        {/* Selected User Details - Positioned directly under search */}
        {selectedUser && (
          <UserDetailPanel
            user={selectedUser}
            oktaOrigin={state.oktaOrigin}
            memberships={memberships}
            isLoadingMemberships={state.isLoadingMemberships}
            currentGroupId={currentGroupId}
            onNavigateToRule={onNavigateToRule}
            isLifecycleLoading={lifecycle.isLifecycleLoading}
            pendingLifecycleAction={lifecycle.pendingLifecycleAction}
            onRequestLifecycleAction={lifecycle.setPendingLifecycleAction}
            onCancelLifecycleAction={() => lifecycle.setPendingLifecycleAction(null)}
            onConfirmLifecycleAction={lifecycle.confirmLifecycleAction}
            onCompare={state.openCompare}
            onAddToGroup={addToGroup.openModal}
          />
        )}
      </div>

      {/* User comparison modal — same feature as the Overview's Compare, now
          reachable from the Users tab. Mounted only with a live tab + selection. */}
      {selectedUser && targetTabId != null && (
        <UserComparisonModal
          isOpen={state.isCompareOpen}
          onClose={state.closeCompare}
          contextUser={selectedUser}
          contextGroups={memberships}
          targetTabId={targetTabId}
          onGroupsChanged={state.refreshSelectedUserMemberships}
        />
      )}

      {/* Add to Group Modal */}
      <AddToGroupModal
        isOpen={addToGroup.isOpen}
        userFirstName={selectedUser?.profile?.firstName}
        groupSearchQuery={addToGroup.groupSearchQuery}
        onGroupSearchQueryChange={addToGroup.setGroupSearchQuery}
        groupSearchResults={addToGroup.groupSearchResults}
        isSearchingGroups={addToGroup.isSearchingGroups}
        showGroupDropdown={addToGroup.showGroupDropdown}
        selectedGroup={addToGroup.selectedGroup}
        onSelectGroup={addToGroup.selectGroup}
        onClearSelectedGroup={addToGroup.clearSelectedGroup}
        isAddingToGroup={addToGroup.isAddingToGroup}
        onClose={addToGroup.closeModal}
        onConfirm={addToGroup.confirmAddToGroup}
      />
    </div>
  );
};

export default UsersTab;
