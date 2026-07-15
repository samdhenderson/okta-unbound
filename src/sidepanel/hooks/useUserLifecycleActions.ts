/**
 * @module sidepanel/hooks/useUserLifecycleActions
 * @description Confirm-gated Okta user lifecycle actions (suspend / unsuspend / reset password).
 *
 * Owns the pending-action + in-flight state behind the Users tab's confirmation
 * modal and runs the chosen action through `useOktaApi` (the rate-limited scheduler
 * path). On success it reports a user-facing message and, for suspend/unsuspend,
 * cheaply refreshes just the user's status (one `getUserById`) without reloading
 * memberships. Reset-password issues no refresh. Failures surface as a `danger`
 * result message; the caller owns the selected user and the result banner.
 */

import { useState, useCallback } from 'react';
import type { OktaUser } from '../../shared/types';
import { useOktaApi } from './useOktaApi';

/** User lifecycle operation triggered from the profile card. */
export type LifecycleAction = 'suspend' | 'unsuspend' | 'resetPassword';

/** Outcome message emitted by a lifecycle action (a subset of the shared alert data). */
export interface LifecycleResult {
  text: string;
  type: 'success' | 'danger';
}

/** Options for {@link useUserLifecycleActions}. */
interface UseUserLifecycleActionsOptions {
  /** Tab whose scheduler runs the lifecycle requests. */
  targetTabId: number | undefined;
  /** The user the actions apply to; actions no-op when null. */
  selectedUser: OktaUser | null;
  /** Reports the action outcome (success copy or a `danger` failure message). */
  onResult: (result: LifecycleResult) => void;
  /** Applies the refreshed status back onto the selected user after suspend/unsuspend. */
  onUserStatusRefresh: (status: OktaUser['status']) => void;
}

/** Return shape of {@link useUserLifecycleActions}. */
interface UseUserLifecycleActionsReturn {
  /** The action awaiting confirmation, or `null`. Drives the confirm modal's open state. */
  pendingLifecycleAction: LifecycleAction | null;
  /** Arms (or dismisses) the confirm modal for an action. */
  setPendingLifecycleAction: (action: LifecycleAction | null) => void;
  /** True while a confirmed action is in flight. */
  isLifecycleLoading: boolean;
  /** Runs the pending action (call from the confirm button). */
  confirmLifecycleAction: () => Promise<void>;
}

const SUCCESS_MESSAGES: Record<LifecycleAction, string> = {
  suspend: 'User suspended successfully. They can no longer sign in.',
  unsuspend: 'User unsuspended successfully. They can now sign in.',
  resetPassword: 'Password reset email sent successfully.',
};

/**
 * Hook backing the Users tab's lifecycle actions and their confirmation modal.
 *
 * @param options - See {@link UseUserLifecycleActionsOptions}.
 * @returns The pending-action state (for the confirm modal), `isLifecycleLoading`,
 *   and `confirmLifecycleAction` to execute the armed action.
 */
export function useUserLifecycleActions({
  targetTabId,
  selectedUser,
  onResult,
  onUserStatusRefresh,
}: UseUserLifecycleActionsOptions): UseUserLifecycleActionsReturn {
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<LifecycleAction | null>(
    null,
  );
  const [isLifecycleLoading, setIsLifecycleLoading] = useState(false);

  const { suspendUser, unsuspendUser, resetPassword, getUserById } = useOktaApi({
    targetTabId: targetTabId ?? null,
  });

  const confirmLifecycleAction = useCallback(async () => {
    if (!selectedUser || !pendingLifecycleAction) return;

    // Capture before clearing so success message lookup still works
    const action = pendingLifecycleAction;
    setIsLifecycleLoading(true);
    setPendingLifecycleAction(null);

    try {
      let result: { success: boolean; error?: string };

      if (action === 'suspend') {
        result = await suspendUser(selectedUser.id);
      } else if (action === 'unsuspend') {
        result = await unsuspendUser(selectedUser.id);
      } else {
        result = await resetPassword(selectedUser.id);
      }

      if (result.success) {
        onResult({ text: SUCCESS_MESSAGES[action], type: 'success' });

        // Refresh user status cheaply without reloading memberships
        if (action !== 'resetPassword') {
          const refreshed = await getUserById(selectedUser.id);
          if (refreshed) {
            onUserStatusRefresh(refreshed.status as OktaUser['status']);
          }
        }
      } else {
        onResult({
          text: result.error || 'The operation failed. Please try again.',
          type: 'danger',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      onResult({ text: message, type: 'danger' });
    } finally {
      setIsLifecycleLoading(false);
    }
  }, [
    selectedUser,
    pendingLifecycleAction,
    suspendUser,
    unsuspendUser,
    resetPassword,
    getUserById,
    onResult,
    onUserStatusRefresh,
  ]);

  return {
    pendingLifecycleAction,
    setPendingLifecycleAction,
    isLifecycleLoading,
    confirmLifecycleAction,
  };
}
