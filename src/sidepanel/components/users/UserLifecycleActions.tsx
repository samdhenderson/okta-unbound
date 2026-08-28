/**
 * @module sidepanel/components/users/UserLifecycleActions
 * @description The disclosure tier's body — the account-state verbs and their confirm modal.
 *
 * A pure view over the {@link useUserLifecycleActions} state machine: the
 * suspend / unsuspend / reset-password buttons (gated by the user's status) and
 * the confirmation modal that arms each action. All state and the
 * scheduler-backed requests live in the hook; this component only renders it and
 * forwards intent. **The state machine, the gating and every confirm modal are
 * unchanged** — only where this renders has moved.
 *
 * ## Why it lost its card
 *
 * These used to be a `Lifecycle Actions` card of their own, stacked with the
 * profile and the memberships as though "suspend this person" were a section of
 * the page's content. It is not: it is a verb whose object is the whole page, so
 * ADR-0030 puts it in the `ActionBar`. It is also the page's most consequential
 * verb, which is why it does not sit in the row beside Compare — it is one press
 * away, behind the strip's **More** disclosure, in a band that reads as part of
 * the bar ({@link UserActionBar}). The control that opens it belongs to the
 * shared `ActionBar`, not to this component or to `UserActionBar`; it was a
 * page-authored button labelled "Manage" until ADR-0038 moved the disclosure
 * into the strip itself.
 *
 * ## The band's own argument
 *
 * Reading order is deliberate: the non-destructive verbs first, a rule, then the
 * destructive one alone on its own row with the consequence spelled out beside
 * it. `Each asks to confirm` is stated once for the band rather than implied per
 * button, so nothing here reads as a one-click action.
 *
 * Security: this component issues nothing and logs nothing. The user's name and
 * email appear only inside the confirm modal, rendered through React's escaping.
 */
import React from 'react';
import { Button, Eyebrow, Modal } from '../shared';
import type { OktaUser } from '../../../shared/types';
import type { LifecycleAction } from '../../hooks/useUserLifecycleActions';

/** Props for {@link UserLifecycleActions}. */
export interface UserLifecycleActionsProps {
  /** The selected user the actions apply to. */
  user: OktaUser;
  /** True while a confirmed action is in flight (disables the trigger buttons). */
  isLifecycleLoading: boolean;
  /** The action awaiting confirmation, or null. Drives the confirm modal. */
  pendingLifecycleAction: LifecycleAction | null;
  /** Arm the confirm modal for an action. */
  onRequestAction: (action: LifecycleAction) => void;
  /** Dismiss the confirm modal without running the action. */
  onCancel: () => void;
  /** Run the armed action (the confirm button). */
  onConfirm: () => void;
}

/**
 * Statuses for which Okta accepts a password-reset email. Unchanged from the
 * card this replaced — the gating is status-driven, not placement-driven.
 */
const RESET_PASSWORD_STATUSES: ReadonlySet<OktaUser['status']> = new Set([
  'ACTIVE',
  'RECOVERY',
  'LOCKED_OUT',
  'PASSWORD_EXPIRED',
]);

/**
 * The disclosure tier's body: the account-state verbs valid for this user's status,
 * and the confirmation modal that arms each of them. A deprovisioned user sees
 * the "no actions available" notice instead. All logic lives in
 * `useUserLifecycleActions`.
 *
 * @param props - See {@link UserLifecycleActionsProps}.
 */
const UserLifecycleActions: React.FC<UserLifecycleActionsProps> = ({
  user,
  isLifecycleLoading,
  pendingLifecycleAction,
  onRequestAction,
  onCancel,
  onConfirm,
}) => {
  const canResetPassword = RESET_PASSWORD_STATUSES.has(user.status);
  const isSuspended = user.status === 'SUSPENDED';
  // Exactly the gating the card had: Suspend for an ACTIVE user, Unsuspend for a
  // SUSPENDED one, and no destructive row at all for any other status — never a
  // disabled button offering something Okta would refuse.
  const hasDestructive = user.status === 'ACTIVE' || isSuspended;

  return (
    <>
      {user.status !== 'DEPROVISIONED' ? (
        <div className="space-y-(--sp-field)">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Account state</Eyebrow>
            {/*
              Stated once for the band. Repeating it per button would read as a
              warning about one verb rather than a property of all of them.
            */}
            <span className="text-xs text-neutral-600">Each asks to confirm</span>
          </div>

          {canResetPassword && (
            <div className="flex flex-wrap gap-(--sp-field)">
              <Button
                variant="secondary"
                size="sm"
                icon="refresh"
                disabled={isLifecycleLoading}
                onClick={() => onRequestAction('resetPassword')}
              >
                Reset password
              </Button>
            </div>
          )}

          {canResetPassword && hasDestructive && <div className="h-px bg-neutral-200" />}

          {/*
            The destructive verb alone on its row, with what it costs stated
            beside it rather than only inside the modal it opens.
          */}
          {hasDestructive && (
            <div className="flex flex-wrap items-center justify-between gap-(--sp-field)">
              <span className="text-xs text-danger-text">
                {isSuspended ? 'Restores sign-in immediately' : 'Blocks sign-in until reversed'}
              </span>
              {isSuspended ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon="refresh"
                  disabled={isLifecycleLoading}
                  onClick={() => onRequestAction('unsuspend')}
                >
                  Unsuspend user
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  icon="pause"
                  disabled={isLifecycleLoading}
                  onClick={() => onRequestAction('suspend')}
                >
                  Suspend user
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-neutral-500">
          No lifecycle actions are available for deprovisioned users.
        </p>
      )}

      {/* Confirmation modal for lifecycle actions */}
      <Modal
        isOpen={pendingLifecycleAction !== null}
        onClose={onCancel}
        title={
          pendingLifecycleAction === 'suspend'
            ? 'Suspend User'
            : pendingLifecycleAction === 'unsuspend'
              ? 'Unsuspend User'
              : 'Reset Password'
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant={pendingLifecycleAction === 'suspend' ? 'danger' : 'primary'}
              size="sm"
              onClick={onConfirm}
            >
              {pendingLifecycleAction === 'suspend'
                ? 'Suspend'
                : pendingLifecycleAction === 'unsuspend'
                  ? 'Unsuspend'
                  : 'Send Reset Email'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          {pendingLifecycleAction === 'suspend' && (
            <>
              Are you sure you want to suspend{' '}
              <strong className="text-neutral-900">
                {user.profile.firstName} {user.profile.lastName}
              </strong>
              ? They will be unable to sign in until unsuspended.
            </>
          )}
          {pendingLifecycleAction === 'unsuspend' && (
            <>
              Unsuspend{' '}
              <strong className="text-neutral-900">
                {user.profile.firstName} {user.profile.lastName}
              </strong>
              ? They will regain the ability to sign in.
            </>
          )}
          {pendingLifecycleAction === 'resetPassword' && (
            <>
              Send a password reset email to{' '}
              <strong className="text-neutral-900">{user.profile.email}</strong>?
            </>
          )}
        </p>
      </Modal>
    </>
  );
};

export default UserLifecycleActions;
