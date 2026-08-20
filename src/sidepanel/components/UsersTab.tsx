/**
 * @module sidepanel/components/UsersTab
 * @description Users tab: search users and analyse their group memberships.
 *
 * Debounced live search over Okta users (or auto-loading the user detected on the
 * page), then a detail rung of three tabbed panes — the groups the user is in,
 * the apps they can reach and the profile attributes the rules read — with an
 * "Add to Group" flow and per-group membership attribution (rule-based vs.
 * direct) computed by `analyzeMemberships`. Security-sensitive profile fields are
 * never shown.
 *
 * The tab itself is composition only: all state and hook wiring live in
 * {@link sidepanel/hooks/useUsersTabState.useUsersTabState}, the header in
 * {@link UserRungHeader}, the action strip in {@link UserActionBar}, the search
 * surface in {@link UserSearchPanel} and the selected-user surface in
 * {@link UserDetailPanel}. The Add-to-Group modal confirms through that hook's
 * `confirmAddToGroup` wrapper rather than `addToGroup.confirmAddToGroup`, so the
 * group being added is captured for the membership list's one-shot success flash
 * before the modal resets itself.
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
 * box, the selected user, their analysed memberships and each detail pane's own
 * filter, pills and open disclosures all survive a push→pop round trip. What clears a finished
 * comparison is `useUserComparison`'s reset effect — keyed on "a comparison is
 * pushed" — rather than an unmount. One `PageHeader` stays mounted throughout and
 * swaps its contents, per ADR-0008's stable-region precedent.
 *
 * `compareViewRef` rides whichever rung is on screen, because `useViewStack` focuses
 * the first focusable descendant of that ref: one container wrapping both rungs
 * would send focus into the hidden one.
 *
 * ## The tiered action strip
 *
 * Every page-level verb lives in {@link UserActionBar} on the detail rung, not in
 * `GroupMembershipsList`'s header slot where Compare and Add to Group used to sit
 * beside controls acting on that one card, and not in a `Lifecycle Actions` card
 * of its own (ADR-0030). The account-state verbs sit one press away behind
 * **Manage**; `manageOpen` is owned here, not in the strip, so it collapses
 * whenever the rung changes.
 *
 * There is deliberately **no Export button**: the Export tab has no user-scoped
 * descriptor to open, and a control that does nothing is worse than an absent
 * one. See {@link UserActionBar} for the full note.
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
import React, { useRef, useState } from 'react';
import AlertMessage from './shared/AlertMessage';
import {
  AddToGroupModal,
  UserActionBar,
  UserComparisonPanel,
  UserDetailPanel,
  UserRungHeader,
  UserSearchPanel,
} from './users';
import { useUsersTabState } from '../hooks/useUsersTabState';

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
    panes,
    isDetailOpen,
    isCompareOpen,
  } = state;

  // The Manage tier is a property of the strip you are looking at, not of the
  // user, so it collapses whenever the rung changes — leaving the detail page and
  // coming back should not re-open a band of destructive verbs behind you.
  // Adjusted during render rather than in an effect, the pattern `PageHeader`
  // uses: React re-renders immediately without committing the open frame.
  const [manageOpen, setManageOpen] = useState(false);
  const [manageRung, setManageRung] = useState(isDetailOpen);
  if (manageRung !== isDetailOpen) {
    setManageRung(isDetailOpen);
    setManageOpen(false);
  }

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      {/*
        One header for the whole tab; its contents swap as views push/pop
        (ADR-0008, ADR-0016). It names the user you have open — before the detail
        page became a rung of this stack the title read "User Search" even while
        you were reading someone's profile, and there was no way back.
      */}
      <UserRungHeader
        nav={nav}
        isDetailOpen={isDetailOpen}
        isCompareOpen={isCompareOpen}
        selectedUser={selectedUser}
        membershipCount={memberships.length}
        isLoadingMemberships={isLoadingMemberships}
        appCount={panes.appCount}
        oktaOrigin={state.oktaOrigin}
        isActive={isActive}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/*
          The result banner sits OUTSIDE the rung switch, above both regions.
          Every outcome it reports — a lifecycle verb, an add-to-group, a profile
          save — is triggered from the detail rung, and the search region that
          used to host it is `hidden` the whole time a user is open. (jsdom loads
          no stylesheet, so the tests never saw it disappear.) It is also where
          the profile save's inline `Undo` lands: there is no toast primitive in
          this panel, and `AlertMessage`'s action slot is the sanctioned place
          for an inline verb.
        */}
        {state.resultMessage && (
          <AlertMessage
            message={state.resultMessage}
            onDismiss={state.dismissResultMessage}
            {...(state.resultAction ? { action: state.resultAction } : {})}
            className="animate-rise-in"
          />
        )}

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
              /* Search / load failures only; the result banner is above, outside the rung switch. */
              state.error ? (
                <AlertMessage
                  message={{ text: state.error, type: 'danger' }}
                  onDismiss={state.dismissError}
                  className="animate-rise-in"
                />
              ) : undefined
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
                Every page-level verb, tiered: the everyday ones pinned in the
                strip, the account-state ones one press away behind Manage
                (ADR-0030). They used to sit in `GroupMembershipsList`'s header
                slot and in a `Lifecycle Actions` card of their own.
              */}
              <UserActionBar
                user={selectedUser}
                onCompare={state.openCompare}
                onAddToGroup={addToGroup.openModal}
                isLoadingMemberships={state.isLoadingMemberships}
                manageOpen={manageOpen}
                onToggleManage={() => setManageOpen((open) => !open)}
                isLifecycleLoading={lifecycle.isLifecycleLoading}
                pendingLifecycleAction={lifecycle.pendingLifecycleAction}
                onRequestLifecycleAction={lifecycle.setPendingLifecycleAction}
                onCancelLifecycleAction={() => lifecycle.setPendingLifecycleAction(null)}
                onConfirmLifecycleAction={lifecycle.confirmLifecycleAction}
              />

              <UserDetailPanel
                user={selectedUser}
                oktaOrigin={state.oktaOrigin}
                pane={panes.pane}
                onPaneChange={panes.setPane}
                memberships={memberships}
                isLoadingMemberships={state.isLoadingMemberships}
                currentGroupId={currentGroupId}
                recentlyAddedGroupId={state.recentlyAddedGroupId}
                onProveMembershipSource={state.proveMembershipSource}
                apps={panes.apps}
                isLoadingApps={panes.isLoadingApps}
                appsComplete={panes.appsComplete}
                appsByGroupId={panes.appsByGroupId}
                appCount={panes.appCount}
                attributes={panes.attributes}
                isLoadingProfile={panes.isLoadingProfile}
                profileConfig={panes.profileConfig}
                onProfileConfigChange={panes.updateProfileConfig}
                onProfileConfigReset={panes.resetProfileConfig}
                ruleReads={panes.ruleReads}
                profileEdit={state.profileEdit}
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
                  onContextUserUpdated={state.applySelectedUserUpdate}
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
