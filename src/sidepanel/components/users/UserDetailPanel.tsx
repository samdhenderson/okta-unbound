/**
 * @module sidepanel/components/users/UserDetailPanel
 * @description The Users tab's selected-user surface: three tabbed panes of one card.
 *
 * **Groups**, **Apps** and **Profile** — the same three questions the native Okta
 * admin console splits a user into, but with source attribution on every row.
 * They are panes of one card rather than a stack of sections because they are
 * three answers to one question ("what does this person have, and why?"), and
 * stacking them made the page a scroll rather than a comparison.
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
 *   panes of rows would then all match at once. `ProfileDisplayModal` already
 *   establishes the idiom.
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
import ProfileDisplayModal from './ProfileDisplayModal';
import type { AttributeDescriptor } from './profileAttributes';
import type { GroupMembership, OktaUser } from '../../../shared/types';
import type { MemberRuleAttribution } from '../../../shared/membership/memberRuleAttribution';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import type { UserAppAssignment } from '../../hooks/useOktaApi/userOperations';
import type { AppsByGroupId } from '../../hooks/useUserApps';
import type { UserDetailPane } from '../../hooks/useUserDetailPanes';

/** Props for {@link UserDetailPanel}. */
export interface UserDetailPanelProps {
  /** The selected user to render. */
  user: OktaUser;
  /** Okta origin used to build admin-console deep links; links are hidden when absent. */
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
   * Applies one configuration patch. Record patches (`assign`, `hidden`) arrive
   * whole by design — pass them straight through to the store's `update`, never
   * merged here.
   */
  onProfileConfigChange: (patch: Partial<ProfileDisplayConfig>) => void;
  /** Discards the org's configuration and returns to the shipped defaults. */
  onProfileConfigReset: () => void;
  /**
   * Attribute Okta name → the names of the rules that read it *and* currently
   * grant this user access. Absent attributes carry no mark.
   */
  ruleReads: Record<string, string[]>;
}

/**
 * The Users tab's selected-user detail: one card, three panes — the groups the
 * user is in, the apps they can reach, and the profile attributes the rules read.
 *
 * @param props - See {@link UserDetailPanelProps}.
 */
const UserDetailPanel: React.FC<UserDetailPanelProps> = ({
  user,
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
  onProfileConfigReset,
  ruleReads,
}) => {
  // The gear belongs to the Profile pane, so its dialog's open state does too —
  // nothing outside this card reads it.
  const [isConfiguringProfile, setIsConfiguringProfile] = useState(false);

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
    <div className="animate-rise-in overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="px-2">
        <Tabs
          tabs={tabs}
          activeKey={pane}
          onChange={(key) => onPaneChange(key as UserDetailPane)}
          ariaLabel="User detail sections"
        />
      </div>

      <div
        role="tabpanel"
        aria-label="Groups"
        hidden={pane !== 'groups'}
        className={pane === 'groups' ? '' : 'hidden'}
      >
        <GroupMembershipsList
          memberships={memberships}
          user={user}
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
        className={pane === 'apps' ? 'px-4 py-3' : 'hidden'}
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
          onConfigure={() => setIsConfiguringProfile(true)}
        />
      </div>

      {/*
        Edits apply live to the pane behind the dialog: the patch goes straight to
        the store's `update`, and `assign`/`hidden` arrive as whole maps by design.
      */}
      <ProfileDisplayModal
        isOpen={isConfiguringProfile}
        onClose={() => setIsConfiguringProfile(false)}
        attributes={attributes}
        config={profileConfig}
        onChange={onProfileConfigChange}
        onReset={onProfileConfigReset}
        ruleReads={ruleReads}
      />
    </div>
  );
};

export default UserDetailPanel;
