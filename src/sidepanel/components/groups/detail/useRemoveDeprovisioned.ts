/**
 * @module sidepanel/components/groups/detail/useRemoveDeprovisioned
 * @description Run state for the group-detail rung's bulk *Remove deprovisioned*
 * verb — the confirm-gated cleanup that empties a group of every member Okta has
 * already deprovisioned.
 *
 * The operation itself is not new and is not implemented here: it is
 * {@link module:hooks/useOktaApi/groupCleanup.createGroupCleanupOperations}'s
 * `removeDeprovisioned`, on the `useOktaApi` facade the whole time, which already
 * refuses `APP_GROUP`s, paces every DELETE through the scheduler via
 * `runOperation` (so the global Activity Bar shows live progress and one Cancel),
 * halts on the first 403, writes **one** aggregate undo entry rather than one per
 * user, and records an `AuditLogEntry`. Its only UI died with the Overview tab;
 * this hook is the wire back to it, not a second implementation.
 *
 * It is a hook rather than state inside `GroupDetailView` for the ordinary reason
 * — that container already composes seven others and is at its size limit — and
 * because the `onResult` callback below has to be `useCallback`-stable:
 * `useOktaApi` memoizes every operation it returns on it, so an inline arrow would
 * hand each render a fresh operation identity.
 *
 * `removeDeprovisioned` resolves to `void`; its outcome is reported only through
 * `onResult` lines. So the failure surface here is the last `type: 'error'`
 * message — enough for the confirm modal to say what went wrong, with the per-user
 * detail already streaming through the Activity Bar.
 */
import { useCallback, useState } from 'react';
import { useOktaApi } from '../../../hooks/useOktaApi';
import { createLogger } from '../../../../shared/utils/logger';
import type { OperationResult } from '../../../hooks/useOktaApi/types';

const log = createLogger('useRemoveDeprovisioned');

/** Return shape of {@link useRemoveDeprovisioned}. */
export interface UseRemoveDeprovisionedReturn {
  /** Runs the removal. Safe to call with no connected tab — the facade no-ops. */
  run: () => void;
  /** True while the removal is in flight. */
  isRemoving: boolean;
  /** The last error the operation reported, or `null`. Cleared at the start of each run. */
  error: string | null;
}

/**
 * Owns the in-flight/error state of one group's deprovisioned-member cleanup.
 *
 * @param groupId - The group to clean up.
 * @param targetTabId - Connected Okta tab id; the write no-ops without one.
 * @param onDone - Called once the run settles, success or failure. Wire it to the
 *   page's roster refresh: the removal drops `cacheKeys.groupMembers` on every
 *   successful DELETE, so a re-analysis genuinely re-walks the group rather than
 *   reading a stale entry. Do not hand-filter the roster instead — a run that stops
 *   at a 403 wall would make a local filter lie about who is still a member.
 * @returns See {@link UseRemoveDeprovisionedReturn}.
 *
 * @example
 * ```tsx
 * const cleanup = useRemoveDeprovisioned(group.id, targetTabId, refreshRoster);
 * <GroupActionBar onRemoveDeprovisioned={cleanup.run} isRemoving={cleanup.isRemoving} />
 * ```
 */
export function useRemoveDeprovisioned(
  groupId: string,
  targetTabId: number | null,
  onDone: () => void,
): UseRemoveDeprovisionedReturn {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable by contract, not by convenience: `useOktaApi` lists this in the deps
  // of the memo that builds every operation it returns.
  const onResult = useCallback(({ message, type }: OperationResult) => {
    if (type === 'error') setError(message);
  }, []);

  const { removeDeprovisioned } = useOktaApi({ targetTabId, onResult });

  const run = useCallback(() => {
    setError(null);
    setIsRemoving(true);
    // Caught, not just `void`-ed: a rejection escaping `.finally()` is an
    // unhandled rejection, and the operation's own failures already arrive
    // through `onResult` — this branch is for the ones that never got that far
    // (a dead port, a thrown cancellation), which are an identifier and an
    // outcome, never a payload.
    void removeDeprovisioned(groupId)
      .catch((err: unknown) => {
        log.error('Bulk deprovisioned-member removal failed:', err);
        setError((current) => current ?? 'Removal failed. See the activity log for detail.');
      })
      .finally(() => {
        setIsRemoving(false);
        onDone();
      });
  }, [removeDeprovisioned, groupId, onDone]);

  return { run, isRemoving, error };
}
