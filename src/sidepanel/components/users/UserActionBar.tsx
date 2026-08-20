/**
 * @module sidepanel/components/users/UserActionBar
 * @description The user-detail rung's action strip — which of a user's verbs are
 * one press away, and which are two.
 *
 * Every verb whose object is the whole user belongs on this strip (ADR-0030), but
 * a flat row of them claimed they were all equal and they are not. *Add group*
 * and *Compare* are the verbs you reach for while reading someone's page, and the
 * worst either can do is add a membership you can remove again. Suspending an
 * account or resetting its password changes who that person is to the org between
 * one press and the next, and there is no symmetric press to take it back. So the
 * account-state verbs ({@link UserLifecycleActions}) go in the strip's disclosure
 * tier, one press behind **More**, and the everyday two stay in the row. That
 * asymmetry — not the number of buttons — is why this strip has a second tier.
 *
 * `ActionBar` owns the tier itself: the **More** control, the region it opens and
 * that region's `aria-controls` target. This component only decides what goes on
 * each side of it, which is why there is no disclosure button in the code below.
 *
 * *Add group* leads and is the `primary` variant; *Compare* follows and overflows
 * first. Comparing is a lookup, adding is the thing an admin came here to do. The
 * label is *Add group*, not "Add to Group": at the 360px panel floor both verbs
 * plus **More** only seat if the first one is short, and the object is already
 * named by the header above the strip.
 *
 * The tier is `ActionBar`'s `expansion` slot, so it lives *inside* the strip and
 * grows it downward. It was a sibling of the strip first, on the reasoning that a
 * sticky element cannot grow a second row without moving the buttons above it —
 * wrong, because sticky pins the box's top edge and a row added at the bottom
 * grows away from them. What the sibling version produced was a second card
 * arriving in the page flow rather than out of the control that summoned it, plus
 * a `display: contents` wrapper to keep the two glued that then swallowed the
 * rung's `space-y-6` step and butted the detail card against the strip.
 *
 * ## What is not here
 *
 * **Export.** The design called for an Export button "scoped to this user", but
 * the Export tab has no user-scoped descriptor: `users` is `whole-org`, and the
 * three `search-to-select` descriptors take a group or an app as their context,
 * never a user. Shipping the button would mean either inventing a descriptor or
 * shipping a control that does nothing, and a dead control is worse than an
 * absent one. It returns when a `user-groups` / `user-apps` descriptor exists.
 *
 * **Clear sessions.** Likewise: `useUserLifecycleActions` implements
 * `suspend | unsuspend | resetPassword` and nothing else, and this component is
 * a view over that state machine, not a place to add a fourth Okta write.
 */
import React from 'react';
import { ActionBar, type ActionDescriptor } from '../shared';
import UserLifecycleActions from './UserLifecycleActions';
import { userDisplayName } from '../../../shared/utils/userDisplay';
import type { OktaUser } from '../../../shared/types';
import type { LifecycleAction } from '../../hooks/useUserLifecycleActions';

/** Props for {@link UserActionBar}. */
export interface UserActionBarProps {
  /** The user every verb in the strip acts on. */
  user: OktaUser;
  /** Opens the comparison rung. */
  onCompare: () => void;
  /** Opens the Add-to-Group modal. */
  onAddToGroup: () => void;
  /**
   * True while the user's memberships are loading. Both row verbs need them
   * — a comparison of an unloaded left-hand side is meaningless, and adding to a
   * group would not know which groups the user is already in — so both disable.
   */
  isLoadingMemberships: boolean;
  /** Whether the disclosure tier is showing. Owned by the tab, so it collapses on a rung change. */
  tierOpen: boolean;
  /** Called with the tier's next open state when **More** is pressed. */
  onTierOpenChange: (open: boolean) => void;
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
   * Pin the strip below the header while the page scrolls under it. Defaults to
   * `true`; pass `false` in a story, where there is nothing to scroll.
   */
  sticky?: boolean;
}

/**
 * The user-detail rung's action strip: the everyday verbs in the row, the
 * account-state verbs behind **More**.
 *
 * @param props - See {@link UserActionBarProps}.
 *
 * @example
 * ```tsx
 * <UserActionBar
 *   user={selectedUser}
 *   onCompare={openCompare}
 *   onAddToGroup={addToGroup.openModal}
 *   isLoadingMemberships={isLoadingMemberships}
 *   tierOpen={manageOpen}
 *   onTierOpenChange={setManageOpen}
 *   {...lifecycleProps}
 * />
 * ```
 */
const UserActionBar: React.FC<UserActionBarProps> = ({
  user,
  onCompare,
  onAddToGroup,
  isLoadingMemberships,
  tierOpen,
  onTierOpenChange,
  isLifecycleLoading,
  pendingLifecycleAction,
  onRequestLifecycleAction,
  onCancelLifecycleAction,
  onConfirmLifecycleAction,
  sticky = true,
}) => {
  // Declaration order is reading order and overflow order both: `primary` pins
  // `Add group` in the row, and `Compare` is the first thing to move behind
  // **More** when the panel tightens.
  const actions: ActionDescriptor[] = [
    {
      id: 'add-to-group',
      label: 'Add group',
      icon: 'plus',
      variant: 'primary',
      onClick: onAddToGroup,
      disabled: isLoadingMemberships,
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: 'users',
      onClick: onCompare,
      disabled: isLoadingMemberships,
      title: 'Compare group & app access with another user',
    },
  ];

  return (
    <ActionBar
      ariaLabel={`Actions for ${userDisplayName(user)}`}
      sticky={sticky}
      actions={actions}
      tierOpen={tierOpen}
      onTierOpenChange={onTierOpenChange}
      expansion={
        /* The tier — mounted whether or not it is open, held out of the tab order
           and the accessible tree by `ActionBar`'s `inert` while closed. */
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
  );
};

export default UserActionBar;
