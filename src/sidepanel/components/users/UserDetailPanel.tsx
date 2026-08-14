/**
 * @module sidepanel/components/users/UserDetailPanel
 * @description The Users tab's selected-user surface: profile card, lifecycle actions and analysed memberships.
 *
 * Purely presentational — the selected user, their analysed memberships and every
 * action's state live in {@link sidepanel/hooks/useUsersTabState.useUsersTabState};
 * this component composes {@link UserProfileCard} (with
 * {@link UserLifecycleActions} in its `afterCard` slot) and
 * {@link GroupMembershipsList}, and forwards intent.
 *
 * **Page-level actions are deliberately not here.** Compare and Add-to-Group act
 * on the whole user, so they live in {@link UsersTab}'s `ActionBar` above this
 * panel (ADR-0030). They used to sit in `GroupMembershipsList`'s header slot — the
 * same slot as controls acting on that one card — which made the page's main verb
 * read as a property of its groups section.
 *
 * The user comparison is deliberately **not** mounted here either: it is the next
 * rung of the tab's view stack (ADR-0016) and stays a sibling of this panel in
 * {@link UsersTab}, so this panel survives — hidden, not unmounted — behind it.
 */
import React from 'react';
import GroupMembershipsList from './GroupMembershipsList';
import UserLifecycleActions from './UserLifecycleActions';
import UserProfileCard from './UserProfileCard';
import type { GroupMembership, OktaUser } from '../../../shared/types';
import type { MemberRuleAttribution } from '../../../shared/membership/memberRuleAttribution';
import type { LifecycleAction } from '../../hooks/useUserLifecycleActions';

/** Props for {@link UserDetailPanel}. */
export interface UserDetailPanelProps {
  /** The selected user to render. */
  user: OktaUser;
  /** Okta origin used to build admin-console deep links; links are hidden when absent. */
  oktaOrigin?: string | null;
  /** The user's memberships, each already classified as direct or rule-based. */
  memberships: GroupMembership[];
  /** True while the memberships are being loaded/analysed (spinner + disabled actions). */
  isLoadingMemberships: boolean;
  /** Id of the currently detected group; highlights that group in the membership list. */
  currentGroupId?: string;
  /**
   * Id of the group just added via the Add-to-Group flow, forwarded so that row
   * plays its one-shot success flash rather than the confirmation only landing in
   * the banner above the fold.
   */
  recentlyAddedGroupId?: string | null;
  /** True while a confirmed lifecycle action is in flight. */
  isLifecycleLoading: boolean;
  /** The lifecycle action awaiting confirmation, or `null`. Drives the confirm modal. */
  pendingLifecycleAction: LifecycleAction | null;
  /** Arm the confirm modal for a lifecycle action. */
  onRequestLifecycleAction: (action: LifecycleAction) => void;
  /** Dismiss the lifecycle confirm modal without running the action. */
  onCancelLifecycleAction: () => void;
  /** Run the armed lifecycle action (the confirm button). */
  onConfirmLifecycleAction: () => void;
  /**
   * Asks Okta which rules manage one membership, replacing that row's deduction
   * with Okta's own answer (ADR-0031). Omitted, no row offers the action.
   */
  onProveMembershipSource?: (groupId: string) => Promise<MemberRuleAttribution>;
}

/**
 * The Users tab's selected-user detail: profile card with lifecycle actions, plus
 * the analysed group-membership list and its Compare / Add to Group controls.
 */
const UserDetailPanel: React.FC<UserDetailPanelProps> = ({
  user,
  oktaOrigin,
  memberships,
  isLoadingMemberships,
  currentGroupId,
  recentlyAddedGroupId,
  isLifecycleLoading,
  pendingLifecycleAction,
  onRequestLifecycleAction,
  onCancelLifecycleAction,
  onConfirmLifecycleAction,
  onProveMembershipSource,
}) => {
  return (
    <div className="space-y-6 animate-rise-in">
      <UserProfileCard
        user={user}
        oktaOrigin={oktaOrigin}
        // The tab's PageHeader names the user on this rung, so the identity card
        // does not repeat it (ADR-0030).
        showName={false}
        afterCard={
          <UserLifecycleActions
            user={user}
            isLifecycleLoading={isLifecycleLoading}
            pendingLifecycleAction={pendingLifecycleAction}
            onRequestAction={onRequestLifecycleAction}
            onCancel={onCancelLifecycleAction}
            onConfirm={onConfirmLifecycleAction}
          />
        }
      />

      {/* Group Memberships */}
      <GroupMembershipsList
        memberships={memberships}
        user={user}
        isLoading={isLoadingMemberships}
        currentGroupId={currentGroupId}
        oktaOrigin={oktaOrigin}
        recentlyAddedGroupId={recentlyAddedGroupId}
        onProveMembershipSource={onProveMembershipSource}
      />
    </div>
  );
};

export default UserDetailPanel;
