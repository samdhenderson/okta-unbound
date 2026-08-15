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
 * The Add-to-Group modal confirms through that hook's `confirmAddToGroup` wrapper
 * rather than `addToGroup.confirmAddToGroup`, so the group being added is captured
 * for the membership list's one-shot success flash before the modal resets itself.
 *
 * ## Sub-navigation
 *
 * A **two-rung** {@link sidepanel/hooks/useViewStack.useViewStack} stack — search →
 * a user's detail → their comparison — instantiated inside `useUsersTabState` with
 * this component's `compareViewRef` passed in.
 *
 * The detail page became a rung of that stack rather than an inline block under the
 * search box (ADR-0030). Before, the tab ran two navigation models at once: a real
 * stack for the comparison, and nothing at all for the page you were actually
 * reading — so the header said "User Search" while you read someone's profile, and
 * there was no way back. Now the header names them and the trail reads
 * `User Search › Ada Lovelace › Compare users`.
 *
 * All three regions are **hidden rather than unmounted** (ADR-0016), so the search
 * box, the selected user, their analysed memberships and the profile card's own
 * section expansion all survive a push→pop round trip. What clears a finished
 * comparison is `useUserComparison`'s reset effect — keyed on "a comparison is
 * pushed" — rather than an unmount. One `PageHeader` stays mounted throughout and
 * swaps its contents, per ADR-0008's stable-region precedent.
 *
 * `compareViewRef` rides whichever rung is on screen, because `useViewStack` focuses
 * the first focusable descendant of that ref: one container wrapping both rungs
 * would send focus into the hidden one.
 *
 * Page-level verbs (Compare, Add to Group) live in a sticky `ActionBar` on the detail
 * rung, not in `GroupMembershipsList`'s header slot where they used to sit beside
 * controls acting on that one card (ADR-0030).
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
import { ActionBar, Button, EntityIdentity, OpenInOktaLink } from './shared';
import { AddToGroupModal, UserComparisonPanel, UserDetailPanel, UserSearchPanel } from './users';
import { userIdentity } from './users/userIdentity';
import { useUsersTabState } from '../hooks/useUsersTabState';
import { userDisplayName } from '../../shared/utils/userDisplay';

interface UsersTabProps {
  /** Chrome tab id of the connected Okta tab; required for all user/group API calls. */
  targetTabId?: number;
  /** Id of the currently detected group; highlights that group in the membership list. */
  currentGroupId?: string;
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
  const {
    selectedUser,
    memberships,
    isLoadingMemberships,
    lifecycle,
    addToGroup,
    nav,
    isDetailOpen,
    isCompareOpen,
  } = state;

  // Re-resolve the pushed entry against the live selection: the entry is a snapshot
  // taken at push time, while `selectedUser` is patched in place (a lifecycle action
  // rewrites its status) and its memberships reload after a group is copied.
  const currentEntry = nav.currentEntry;
  const currentName =
    currentEntry && selectedUser?.id === currentEntry.userId
      ? userDisplayName(selectedUser)
      : currentEntry?.userName;

  // The header describes a user only on the detail rung, and only once the loaded user is
  // the one the rung is for — otherwise the stack's snapshot name still stands and the
  // status badge would belong to somebody else. Compare is a different subject entirely
  // (two users), so it keeps a plain title.
  const detailUser =
    isDetailOpen && !isCompareOpen && currentEntry && selectedUser?.id === currentEntry.userId
      ? selectedUser
      : undefined;
  const identity = detailUser
    ? userIdentity(detailUser, {
        // Omitted while loading, so the region shows no count rather than "0 groups".
        groupCount: isLoadingMemberships ? undefined : memberships.length,
      })
    : undefined;

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      {/*
        One header for the whole tab; its contents swap as views push/pop
        (ADR-0008, ADR-0016). It now names the user you have open — before the
        detail page became a rung of this stack the title read "User Search" even
        while you were reading someone's profile, and there was no way back.
      */}
      <PageHeader
        // Root title matches the stack's `rootLabel`, so the header and the
        // breadcrumb trail never disagree about what the root is called.
        title={
          isCompareOpen ? 'Compare users' : isDetailOpen ? (currentName ?? 'User') : 'User Search'
        }
        subtitle={
          isCompareOpen
            ? `${currentName} vs. another user`
            : isDetailOpen
              ? undefined
              : 'Search users and analyze their group memberships'
        }
        onBack={nav.isRoot ? undefined : nav.pop}
        backLabel={isCompareOpen ? 'Back to user' : 'Back to search'}
        breadcrumbs={nav.isRoot ? undefined : <Breadcrumbs items={nav.trail} />}
        sticky={isActive}
        identityKey={identity?.key}
        identity={identity ? <EntityIdentity lines={identity.lines} /> : undefined}
        badge={
          // On the detail rung the badge becomes the user's Okta status and the group
          // count moves into the region below it; elsewhere the count stays the badge.
          identity
            ? identity.badge
            : selectedUser
              ? { text: `${memberships.length} Groups`, variant: 'primary' }
              : undefined
        }
        actions={
          identity?.link && (
            <OpenInOktaLink
              oktaOrigin={state.oktaOrigin}
              entityType={identity.link.entityType}
              entityId={identity.link.entityId}
            />
          )
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
        <div className={nav.isRoot ? 'space-y-6' : 'hidden'}>
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
                    className="animate-rise-in"
                  />
                )}

                {/* Lifecycle operation result */}
                {state.resultMessage && (
                  <AlertMessage
                    message={state.resultMessage}
                    onDismiss={state.dismissResultMessage}
                    className="animate-rise-in"
                  />
                )}
              </>
            }
          />
        </div>

        {/*
          The pushed area — one focus container holding both rungs, because
          `useViewStack` moves focus to a single `viewRef` and every push must land
          somewhere. The rungs inside are hidden, never unmounted (ADR-0016): the
          detail page's profile-card expansion and the comparison's loaded state
          both survive a push→pop round trip, and the comparison's reset on pop is
          the hook's doing rather than an unmount's.

          Each `data-testid` is a scoping handle for the navigation tests — the
          hidden rungs still answer `getByRole` under jsdom, so a query has to say
          which rung it means.
        */}
        {selectedUser && (
          <>
            {/*
              The ref rides the rung that is actually on screen. `useViewStack`
              focuses the first focusable descendant of `viewRef`, so a single
              container wrapping both rungs would send focus into the hidden one —
              landing on the detail page's Compare button instead of the
              comparison that just arrived.
            */}
            <div
              ref={isDetailOpen ? compareViewRef : undefined}
              tabIndex={-1}
              data-testid="user-detail-view"
              className={isDetailOpen ? 'space-y-6 focus:outline-none' : 'hidden'}
            >
              {/*
                Page-level verbs, pinned while the memberships scroll under them
                (ADR-0030). These used to sit in `GroupMembershipsList`'s header
                slot — the same slot as controls acting on that one card — so the
                page's main action read as a property of its groups section.
              */}
              <ActionBar ariaLabel={`Actions for ${userDisplayName(selectedUser)}`}>
                <Button
                  variant="primary"
                  size="sm"
                  icon="users"
                  onClick={state.openCompare}
                  disabled={state.isLoadingMemberships}
                  title="Compare group & app access with another user"
                >
                  Compare
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  onClick={addToGroup.openModal}
                  disabled={state.isLoadingMemberships}
                >
                  Add to Group
                </Button>
              </ActionBar>

              <UserDetailPanel
                user={selectedUser}
                oktaOrigin={state.oktaOrigin}
                memberships={memberships}
                isLoadingMemberships={state.isLoadingMemberships}
                currentGroupId={currentGroupId}
                recentlyAddedGroupId={state.recentlyAddedGroupId}
                isLifecycleLoading={lifecycle.isLifecycleLoading}
                pendingLifecycleAction={lifecycle.pendingLifecycleAction}
                onRequestLifecycleAction={lifecycle.setPendingLifecycleAction}
                onCancelLifecycleAction={() => lifecycle.setPendingLifecycleAction(null)}
                onConfirmLifecycleAction={lifecycle.confirmLifecycleAction}
                onProveMembershipSource={state.proveMembershipSource}
              />
            </div>

            {targetTabId != null && (
              <div
                ref={isCompareOpen ? compareViewRef : undefined}
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
          </>
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
        onConfirm={state.confirmAddToGroup}
      />
    </div>
  );
};

export default UsersTab;
