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
 *
 * ## Sub-navigation
 *
 * "Compare" **pushes a view** rather than opening a dialog (ADR-0016). The tab owns
 * a {@link sidepanel/hooks/useViewStack.useViewStack} stack — instantiated inside
 * `useUsersTabState`, with this component's `compareViewRef` passed in — whose one
 * pushed view is {@link UserComparisonPanel}. The search + profile body is **hidden
 * rather than unmounted** while it is pushed and the comparison renders as its
 * sibling, so the search box, the selected user and their analysed memberships all
 * survive a push→pop round trip. One `PageHeader` stays mounted throughout and swaps
 * its contents, per ADR-0008's stable-region precedent.
 *
 * The comparison host is mounted on the same condition the dialog used to be
 * (a selected user + a live tab) and hidden with the same wholesale class swap, so
 * what clears a finished comparison is `useUserComparison`'s reset effect — keyed on
 * "a comparison is pushed" — rather than an unmount.
 *
 * Unlike the Groups tab this one owns no scroll box of its own: its body scrolls the
 * app root scroller, whose offset belongs to {@link TabPanel} (ADR-0018). There is
 * therefore nothing here for `useScrollPreservation` to capture before a push.
 *
 * {@link App} hides this tab rather than unmounting it when another top-level tab
 * is selected, so the selected user, their analysed memberships, the search box and
 * a pushed comparison all survive leaving it. In exchange the tab must be inert
 * while hidden: `isActive` suspends live user-page detection, the user-search
 * debounce, the Add-to-Group type-ahead and the comparison's own user search — the
 * four things here that can reach Okta without a click.
 */
import React, { useRef } from 'react';
import PageHeader from './shared/PageHeader';
import Breadcrumbs from './shared/Breadcrumbs';
import AlertMessage from './shared/AlertMessage';
import { AddToGroupModal, UserComparisonPanel, UserDetailPanel, UserSearchPanel } from './users';
import { useUsersTabState } from '../hooks/useUsersTabState';
import { userDisplayName } from '../../shared/utils/userDisplay';

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
 * collapsible sections, lifecycle actions, the Add-to-Group modal, the analysed
 * group-membership list, and the pushed user-comparison view.
 */
const UsersTab: React.FC<UsersTabProps> = ({
  targetTabId,
  currentGroupId,
  onNavigateToRule,
  selectedUserId,
  onUserSelected,
  isActive = true,
}) => {
  const compareViewRef = useRef<HTMLDivElement>(null);
  const state = useUsersTabState({
    targetTabId,
    selectedUserId,
    onUserSelected,
    isActive,
    compareViewRef,
  });
  const { selectedUser, memberships, lifecycle, addToGroup, nav, isCompareOpen } = state;

  // Re-resolve the pushed entry against the live selection: the entry is a snapshot
  // taken at push time, while `selectedUser` is patched in place (a lifecycle action
  // rewrites its status) and its memberships reload after a group is copied.
  const compareEntry = nav.currentEntry;
  const compareName =
    compareEntry && selectedUser?.id === compareEntry.userId
      ? userDisplayName(selectedUser)
      : compareEntry?.userName;

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      {/* One header for the whole tab; its contents swap as views push/pop (ADR-0008). */}
      <PageHeader
        title={isCompareOpen ? 'Compare users' : 'User Search'}
        subtitle={
          isCompareOpen
            ? `${compareName} vs. another user`
            : 'Search users and analyze their group memberships'
        }
        onBack={isCompareOpen ? nav.pop : undefined}
        backLabel="Back to user"
        breadcrumbs={isCompareOpen ? <Breadcrumbs items={nav.trail} /> : undefined}
        badge={
          selectedUser ? { text: `${memberships.length} Groups`, variant: 'primary' } : undefined
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/*
          Hidden, never unmounted: the search box, the selected user's profile card
          and its per-section expansion all live in this subtree, as does the Compare
          button focus is restored to on pop. The class is swapped wholesale (rather
          than adding `hidden` alongside the layout classes) because those would
          otherwise out-specify the `hidden` display rule.
        */}
        <div className={isCompareOpen ? 'hidden' : 'space-y-6'}>
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

        {/* Pushed comparison view — a sibling of the body, never a replacement for
            it. Mounted on the same condition the comparison dialog used to be, so
            the reset that clears a finished comparison is the hook's, not an
            unmount's. The `data-testid` is a scoping handle for the navigation
            tests: unlike the Groups tab's detail view this one is always mounted,
            so its presence tracks nothing — tests scope queries with it because the
            hidden browse body still answers `getByRole` under jsdom. */}
        {selectedUser && targetTabId != null && (
          <div
            ref={compareViewRef}
            tabIndex={-1}
            data-testid="user-comparison-view"
            className={isCompareOpen ? 'space-y-6 focus:outline-none' : 'hidden'}
          >
            <UserComparisonPanel
              oktaOrigin={state.oktaOrigin}
              isActive={isCompareOpen}
              searchEnabled={isCompareOpen && isActive}
              contextUser={selectedUser}
              contextGroups={memberships}
              targetTabId={targetTabId}
              onGroupsChanged={state.refreshSelectedUserMemberships}
            />
          </div>
        )}
      </div>

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
