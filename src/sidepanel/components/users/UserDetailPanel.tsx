/**
 * @module sidepanel/components/users/UserDetailPanel
 * @description The Users tab's selected-user surface: profile card, lifecycle actions and analysed memberships.
 *
 * Purely presentational — the selected user, their analysed memberships and every
 * action's state live in {@link sidepanel/hooks/useUsersTabState.useUsersTabState};
 * this component composes {@link UserProfileCard} (with
 * {@link UserLifecycleActions} in its `afterCard` slot) and
 * {@link GroupMembershipsList} (with the Compare / Add to Group controls in its
 * `actions` slot) and forwards intent.
 *
 * The user comparison is deliberately **not** mounted here: it is a pushed view
 * (ADR-0016) and stays a sibling of this panel in {@link UsersTab}, so this panel is
 * one of the things that survives — hidden, not unmounted — behind it. Compare is
 * therefore a push, and the button below is the element focus returns to on pop.
 */
import React from 'react';
import { Button } from '../shared';
import GroupMembershipsList from './GroupMembershipsList';
import UserLifecycleActions from './UserLifecycleActions';
import UserProfileCard from './UserProfileCard';
import type { GroupMembership, OktaUser } from '../../../shared/types';
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
  /** Invoked with a rule id to navigate to that rule in the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
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
  /** Pushes the user-comparison view. */
  onCompare: () => void;
  /** Opens the Add-to-Group modal. */
  onAddToGroup: () => void;
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
  onNavigateToRule,
  isLifecycleLoading,
  pendingLifecycleAction,
  onRequestLifecycleAction,
  onCancelLifecycleAction,
  onConfirmLifecycleAction,
  onCompare,
  onAddToGroup,
}) => {
  return (
    <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
      <UserProfileCard
        user={user}
        oktaOrigin={oktaOrigin}
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
        onNavigateToRule={onNavigateToRule}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon="users"
              onClick={onCompare}
              disabled={isLoadingMemberships}
              title="Compare group & app access with another user"
            >
              Compare
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onAddToGroup}
              disabled={isLoadingMemberships}
            >
              Add to Group
            </Button>
          </>
        }
      />
    </div>
  );
};

export default UserDetailPanel;
