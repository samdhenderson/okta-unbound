/**
 * @module sidepanel/components/users/UserDetailPanel
 * @description The Users tab's selected-user surface: three tabbed panes under one strip.
 *
 * **Groups**, **Apps** and **Profile** — the same three questions the native Okta
 * admin console splits a user into, but with source attribution on every row.
 * They are panes of one card rather than a stack of sections because they are
 * three answers to one question ("what does this person have, and why?"), and
 * stacking them made the page a scroll rather than a comparison.
 *
 * The **strip** sits above that card rather than inside it, which is Okta's own
 * chrome and what `GroupDetailView` already did. Tabs inside the card read as a
 * control belonging to the pane below them; outside, they read as what they are —
 * a switch over which card is on screen. The card around the panes stays: that is
 * what makes the three read as one surface.
 *
 * ## Panes are hidden, not unmounted
 *
 * All three render as siblings and the inactive ones carry the `hidden`
 * **attribute** as well as the class (ADR-0016/ADR-0018). Two reasons:
 *
 * - Each pane owns its own filter text, source pills and open disclosures as
 *   plain local state. Unmounting would reset every one of them on each pane
 *   switch, and lifting them here would drag a row's disclosure state up two
 *   levels for nothing (`docs/state-management.md`).
 * - The attribute, not only the class, because jsdom loads no stylesheet: a
 *   class-only hide leaves the whole subtree answering `getByRole`, and three
 *   panes of rows would then all match at once.
 *
 * ## It composes; it does not fetch
 *
 * Purely presentational. The selected user, their analysed memberships, the apps
 * list, the org's profile schema and the admin's display configuration all live
 * in {@link sidepanel/hooks/useUsersTabState.useUsersTabState} (via
 * {@link sidepanel/hooks/useUserDetailPanes.useUserDetailPanes}); this component
 * forwards them and reports pane changes back, which is what lets the apps load
 * be deferred until the Apps pane is first asked for.
 *
 * **An Apps count is a fact the rung may not have yet**, so the tab shows no
 * count at all until a walk has returned, rather than a `0` the panel never asked
 * for (`docs/components.md`, "Unknown is not zero"). That test is the `appCount`
 * prop, **not** `apps.length` — an empty array means either "not loaded" or
 * "loaded, and there are none", and collapsing the two would hide a real zero
 * forever, which is the same defect pointing the other way.
 *
 * ## The Profile pane's dialog lives here; its display editor does not
 *
 * A pane renders and owns no dialog, so `ProfileSaveModal` is mounted at this
 * level — the last thing between a draft and a live write to the org's
 * directory. It opens from a nullable payload rather than a boolean beside one,
 * so what is being confirmed and the fact that something is cannot drift apart.
 *
 * Display customization is **not** a dialog any more. The gear switches the
 * Profile pane into customize mode, where `ProfileDisplayEditor` replaces the
 * section list in place; all this rung keeps is the mode flag, because nothing
 * outside the card reads it. The editor holds its own draft and hands back a
 * whole `ProfileDisplayConfig` on Done, so the write happens once, on commit —
 * where the modal it replaced wrote live on every click.
 *
 * ## Page-level actions are deliberately not here
 *
 * Compare, Add-to-Group and the account-state verbs act on the whole user, so
 * they live in {@link UserActionBar} above this panel (ADR-0030). The user
 * comparison is not mounted here either: it is the next rung of the tab's view
 * stack (ADR-0016) and stays a sibling of this panel in {@link UsersTab}, so
 * this panel survives — hidden, not unmounted — behind it.
 */
import React, { useState } from 'react';
import { Tabs, type TabItem } from '../shared';
import GroupMembershipsList from './GroupMembershipsList';
import UserAppsList from './UserAppsList';
import UserProfilePane from './UserProfilePane';
import ProfileSaveModal from './ProfileSaveModal';
import { userDisplayName } from '../../../shared/utils/userDisplay';
import type { AttributeDescriptor } from './profileAttributes';
import type { GroupMembership, OktaUser } from '../../../shared/types';
import type { MemberRuleAttribution } from '../../../shared/membership/memberRuleAttribution';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { UserAppAssignment } from '../../hooks/useOktaApi/userOperations';
import type { AppsByGroupId } from '../../hooks/useUserApps';
import type { UserDetailPane } from '../../hooks/useUserDetailPanes';
import type { UserProfileEditing } from '../../hooks/useUsersTabProfileEdit';

/** Props for {@link UserDetailPanel}. */
export interface UserDetailPanelProps {
  /** The selected user to render. */
  user: OktaUser;
  /** Okta origin used to build admin-console deep links; links are hidden when absent. */
  /**
   * The tab whose content script serves the Groups pane's group-name fallback.
   * Absent, that pane still names every group the org snapshot holds; it simply
   * cannot fetch the ones it does not.
   */
  targetTabId?: number | null;
  oktaOrigin?: string | null;

  /** Which pane is on screen. Lifted, because the header and the action strip read it too. */
  pane: UserDetailPane;
  /** Selects a pane. The rung's apps / schema loads are gated on this. */
  onPaneChange: (pane: UserDetailPane) => void;

  /** The user's memberships, each already classified as direct or rule-based. */
  memberships: GroupMembership[];
  /** True while the memberships are being loaded/analysed (row skeletons). */
  isLoadingMemberships: boolean;
  /** Id of the currently detected group; highlights that group in the membership list. */
  currentGroupId?: string;
  /**
   * Id of the group just added via the Add-to-Group flow, forwarded so that row
   * plays its one-shot success flash rather than the confirmation only landing in
   * the banner above the fold.
   */
  recentlyAddedGroupId?: string | null;
  /**
   * Asks Okta which rules manage one membership, replacing that row's deduction
   * with Okta's own answer (ADR-0031). Omitted, no row offers the action.
   */
  onProveMembershipSource?: (groupId: string) => Promise<MemberRuleAttribution>;

  /** The user's app assignments, granting group filled in wherever it is known. */
  apps: UserAppAssignment[];
  /** True while the apps list is loading with nothing cached to show. */
  isLoadingApps: boolean;
  /** False when the app pagination walk did not finish; the Apps pane says so. */
  appsComplete: boolean;
  /**
   * Applications each group grants, keyed by group id — the Groups pane's
   * `Also grants:` line. **Absent is not empty**: a group with no entry renders
   * no line rather than claiming it grants nothing.
   */
  appsByGroupId: AppsByGroupId;
  /**
   * How many apps this user has, or `undefined` while no walk has returned.
   *
   * Passed in rather than derived from `apps.length`, because an empty array
   * means *either* "not loaded" *or* "loaded, and there are none" — and only the
   * hook that owns the walk can tell those apart. Deriving it here would
   * permanently hide a real zero.
   */
  appCount?: number;

  /** Every attribute of this user's profile, empty ones included. */
  attributes: AttributeDescriptor[];
  /** True while the org's profile schema is loading with nothing cached. */
  isLoadingProfile: boolean;
  /** The admin's reconciled profile-display configuration for this org. */
  profileConfig: ProfileDisplayConfig;
  /**
   * Applies one configuration change. The display editor commits the **whole**
   * configuration on Done, and record fields (`assign`, `hidden`) are always
   * whole maps by design — pass them straight through to the store's `update`,
   * never merged here.
   */
  onProfileConfigChange: (patch: Partial<ProfileDisplayConfig>) => void;
  /**
   * Attribute Okta name → the names of the rules that read it *and* currently
   * grant this user access. Absent attributes carry no mark.
   */
  ruleReads: Record<string, string[]>;
  /**
   * Makes the Profile pane editable. Absent renders it exactly as it rendered
   * before editing existed — which is what a story, or a rung with no connected
   * Okta tab, gets.
   */
  profileEdit?: UserProfileEditing;
}

/**
 * The Users tab's selected-user detail: one card, three panes — the groups the
 * user is in, the apps they can reach, and the profile attributes the rules read.
 *
 * @param props - See {@link UserDetailPanelProps}.
 */
const UserDetailPanel: React.FC<UserDetailPanelProps> = ({
  user,
  targetTabId,
  oktaOrigin,
  pane,
  onPaneChange,
  memberships,
  isLoadingMemberships,
  currentGroupId,
  recentlyAddedGroupId,
  onProveMembershipSource,
  apps,
  isLoadingApps,
  appsComplete,
  appsByGroupId,
  appCount,
  attributes,
  isLoadingProfile,
  profileConfig,
  onProfileConfigChange,
  ruleReads,
  profileEdit,
}) => {
  // The gear belongs to the Profile pane, so the mode it switches on does too —
  // nothing outside this card reads it.
  const [isCustomizingDisplay, setIsCustomizingDisplay] = useState(false);

  const tabs: TabItem[] = [
    // Every count here is omitted rather than zeroed while its payload is
    // outstanding (ADR-0032 §2a). Groups knows it has none only once the
    // analysis lands; Apps only once a walk has returned — note that is
    // `appCount`, not `apps.length`, so a genuine zero still shows.
    {
      key: 'groups',
      label: 'Groups',
      count: isLoadingMemberships ? undefined : memberships.length,
    },
    { key: 'apps', label: 'Apps', count: appCount },
    { key: 'profile', label: 'Profile', count: attributes.length || undefined },
  ];

  return (
    <div className="animate-rise-in">
      {/*
        The tab strip sits *above* the card, not inside it — the same chrome Group
        Detail uses, and Okta's own. The panes keep the card: they are three
        answers to one question and read as one surface, which is the whole reason
        they are panes rather than a stack of sections.
      */}
      <Tabs
        tabs={tabs}
        activeKey={pane}
        onChange={(key) => onPaneChange(key as UserDetailPane)}
        ariaLabel="User detail sections"
      />

      <div className="mt-(--sp-rung) overflow-hidden rounded-md border border-neutral-200 bg-white">
        <div
          role="tabpanel"
          aria-label="Groups"
          hidden={pane !== 'groups'}
          className={pane === 'groups' ? '' : 'hidden'}
        >
          <GroupMembershipsList
            memberships={memberships}
            user={user}
            targetTabId={targetTabId}
            isActive={pane === 'groups'}
            isLoading={isLoadingMemberships}
            currentGroupId={currentGroupId}
            oktaOrigin={oktaOrigin}
            recentlyAddedGroupId={recentlyAddedGroupId}
            appsByGroupId={appsByGroupId}
            onProveMembershipSource={onProveMembershipSource}
          />
        </div>

        <div
          role="tabpanel"
          aria-label="Apps"
          hidden={pane !== 'apps'}
          className={pane === 'apps' ? 'p-(--sp-card)' : 'hidden'}
        >
          <UserAppsList
            apps={apps}
            memberships={memberships}
            isLoading={isLoadingApps}
            complete={appsComplete}
            oktaOrigin={oktaOrigin}
          />
        </div>

        <div
          role="tabpanel"
          aria-label="Profile"
          hidden={pane !== 'profile'}
          className={pane === 'profile' ? undefined : 'hidden'}
        >
          <UserProfilePane
            attributes={attributes}
            config={profileConfig}
            ruleReads={ruleReads}
            isLoading={isLoadingProfile}
            customize={{
              isCustomizing: isCustomizingDisplay,
              onBegin: () => setIsCustomizingDisplay(true),
              // Done: one whole-config write, then out of the mode. `assign`
              // and `hidden` arrive complete by design — a one-key patch is
              // how a record merge un-files everything it did not mention.
              onCommit: (next) => {
                onProfileConfigChange(next);
                setIsCustomizingDisplay(false);
              },
              // Cancel: the draft never left the editor, so there is nothing to
              // undo here.
              onCancel: () => setIsCustomizingDisplay(false),
            }}
            edit={profileEdit?.controls}
            cells={profileEdit?.cells}
          />
        </div>
      </div>

      {/*
        The save confirmation belongs here because the pane renders and owns no
        dialog, and this is the last thing between a draft and a live write to
        the org's directory. Its own
        `changes` prop is the nullable discriminant that opens it, so it is
        mounted unconditionally whenever the rung offers editing.
      */}
      {profileEdit && <ProfileSaveModal {...profileEdit.save} userName={userDisplayName(user)} />}
    </div>
  );
};

export default UserDetailPanel;
