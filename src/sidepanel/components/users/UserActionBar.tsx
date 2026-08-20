/**
 * @module sidepanel/components/users/UserActionBar
 * @description The user-detail rung's two-tier action strip.
 *
 * Every verb whose object is the whole user lives here (ADR-0030) — but they are
 * not equal, and a flat row of five buttons said they were. The strip is
 * therefore **tiered**:
 *
 * - **Tier 1**, inside the shared `ActionBar`: the verbs you reach for while
 *   reading — *Compare*, *Add to Group*, and *Manage*, which is not a verb at
 *   all but the disclosure for tier 2.
 * - **Tier 2**, only when Manage is open: the account-state verbs
 *   ({@link UserLifecycleActions}). Suspending someone is one press further away
 *   than comparing them, which is the whole point of the tier.
 *
 * The band is drawn to read as part of the bar rather than as a card that
 * appeared under it: `-mt-px` pulls its top border onto the strip's bottom one,
 * and only its bottom corners are rounded. It is a sibling of `ActionBar` rather
 * than a child because the strip is sticky — the band scrolls under the pinned
 * bar, and a sticky element cannot grow a second row without moving the buttons
 * above it.
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
import { ActionBar, Button } from '../shared';
import UserLifecycleActions from './UserLifecycleActions';
import { userDisplayName } from '../../../shared/utils/userDisplay';
import type { OktaUser } from '../../../shared/types';
import type { LifecycleAction } from '../../hooks/useUserLifecycleActions';

/** `id` of the tier-2 band, so Manage can point `aria-controls` at it. */
const MANAGE_BAND_ID = 'user-action-bar-manage';

/** Props for {@link UserActionBar}. */
export interface UserActionBarProps {
  /** The user every verb in the strip acts on. */
  user: OktaUser;
  /** Opens the comparison rung. */
  onCompare: () => void;
  /** Opens the Add-to-Group modal. */
  onAddToGroup: () => void;
  /**
   * True while the user's memberships are loading. Both tier-1 verbs need them
   * — a comparison of an unloaded left-hand side is meaningless, and adding to a
   * group would not know which groups the user is already in — so both disable.
   */
  isLoadingMemberships: boolean;
  /** Whether tier 2 is showing. Owned by the tab, so it collapses on a rung change. */
  manageOpen: boolean;
  /** Toggles tier 2. */
  onToggleManage: () => void;
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
 * The user-detail rung's action strip: the everyday verbs in tier 1, the
 * account-state verbs behind **Manage** in tier 2.
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
 *   manageOpen={manageOpen}
 *   onToggleManage={() => setManageOpen((open) => !open)}
 *   {...lifecycleProps}
 * />
 * ```
 */
const UserActionBar: React.FC<UserActionBarProps> = ({
  user,
  onCompare,
  onAddToGroup,
  isLoadingMemberships,
  manageOpen,
  onToggleManage,
  isLifecycleLoading,
  pendingLifecycleAction,
  onRequestLifecycleAction,
  onCancelLifecycleAction,
  onConfirmLifecycleAction,
  sticky = true,
}) => (
  // `contents`, not a plain wrapper: this node groups the strip with the band it
  // owns, and must not become the strip's containing block. `position: sticky`
  // travels only within its parent's box, and a bare `<div>` here is exactly as
  // tall as the strip — so the strip reached its parent's bottom edge
  // immediately, never pinned, and scrolled away with the rung. `display:
  // contents` generates no box, so the strip's containing block is the rung
  // itself and it has the whole page to stay pinned over (ADR-0032 §3).
  //
  // It also keeps the band glued. The rung carries `space-y-6`, whose
  // `& > :not([hidden]) ~ :not([hidden])` matches DOM *children* of the rung —
  // this node, not the two inside it — so no 24px margin is injected between the
  // strip and the band, and the band's `-mt-px` overlap survives. Returning a
  // fragment instead would lose that: `space-y-6` out-specifies `-mt-px`.
  <div className="contents">
    {/*
      Page-level verbs, pinned while the panes scroll under them (ADR-0030).
      These used to sit in `GroupMembershipsList`'s header slot — the same slot
      as controls acting on that one card — so the page's main action read as a
      property of its groups section.
    */}
    <ActionBar ariaLabel={`Actions for ${userDisplayName(user)}`} sticky={sticky}>
      <Button
        variant="primary"
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
        icon="plus"
        onClick={onAddToGroup}
        disabled={isLoadingMemberships}
      >
        Add to Group
      </Button>
      <Button
        variant="ghost"
        size="sm"
        // `minus` while open is the registry's collapse glyph; `settings` names
        // what the tier holds rather than what pressing it does.
        icon={manageOpen ? 'minus' : 'settings'}
        onClick={onToggleManage}
        expanded={manageOpen}
        controls={MANAGE_BAND_ID}
        title={manageOpen ? 'Hide account-state actions' : 'Show account-state actions'}
      >
        Manage
      </Button>
    </ActionBar>

    {manageOpen && (
      <div
        id={MANAGE_BAND_ID}
        // `-mt-px` overlaps the strip's bottom border so the two read as one
        // piece of chrome rather than a card that appeared underneath it.
        className="-mt-px rounded-b-md border border-neutral-200 bg-white px-4 py-3"
      >
        <UserLifecycleActions
          user={user}
          isLifecycleLoading={isLifecycleLoading}
          pendingLifecycleAction={pendingLifecycleAction}
          onRequestAction={onRequestLifecycleAction}
          onCancel={onCancelLifecycleAction}
          onConfirm={onConfirmLifecycleAction}
        />
      </div>
    )}
  </div>
);

export default UserActionBar;
