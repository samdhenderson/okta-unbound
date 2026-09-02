/**
 * @module sidepanel/hooks/useGroupMerge
 * @description Drives the group-merge (membership consolidation) flow.
 *
 * Loads a {@link MergePlan} preview (members + feeding rules for the survivor and
 * sources), then executes it: copy distinct source members into the survivor and
 * empty each source. Both legs are fan-outs, so both run through
 * `coreApi.runOperation` (`D-034`) rather than a hand-rolled loop — the same
 * rate-limited scheduler path as before, now with the activity bar's live counts
 * and a Cancel that abandons the merge. A cancelled run keeps everything that
 * already landed: the counts are reported, the copies stay undoable, and the two
 * audit entries are written, with {@link UseGroupMergeReturn.error} saying what
 * was left undone.
 * Every run records two audit entries (both attributed to the signed-in admin,
 * resolved through the facade's `getCurrentUser()`) and a bulk undo action per
 * affected group so the operation can be inspected and reversed. When the actor
 * cannot be resolved, both entries record `performedBy: null` /
 * `actorResolution: 'unavailable'` rather than a placeholder identity, and the
 * merge still runs (`D-013`/`D-013b`) — with {@link UseGroupMergeReturn.actorNotice}
 * telling the admin so at the time (`D-013c`). Emptying is blocked when a source
 * is fed by an active rule.
 */

import { useCallback, useState } from 'react';
import type { GroupSummary, AuditLogEntry, OktaUser } from '../../shared/types';
import type { BatchOutcome } from '../../shared/scheduler/runBatch';
import type { AlertMessageData } from '../components/shared/AlertMessage';
import { useOktaApi } from './useOktaApi';
import { useActorNotice } from './useActorNotice';
import { useProgress } from '../contexts/ProgressContext';
import { logAction } from '../../shared/undoManager';
import { auditStore } from '../../shared/storage/auditStore';
import {
  planGroupMerge,
  type MergePlan,
  type MergeFeedingRule,
} from '../../shared/membership/mergePlan';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useGroupMerge');

/** Lifecycle of the merge flow. */
export type MergePhase = 'idle' | 'preview-loading' | 'preview' | 'running' | 'done' | 'error';

/** Outcome counts once a merge has run. */
export interface MergeResults {
  copied: number;
  copyFailed: number;
  removed: number;
  removeFailed: number;
}

/** Return shape of {@link useGroupMerge}. */
export interface UseGroupMergeReturn {
  phase: MergePhase;
  plan: MergePlan | null;
  results: MergeResults | null;
  error: string | null;
  /**
   * Non-blocking notice shown when the run could not name the acting admin, or
   * `null` when it could. The merge runs either way (`D-013c`).
   */
  actorNotice: AlertMessageData | null;
  /** Dismiss {@link UseGroupMergeReturn.actorNotice}. */
  dismissActorNotice: () => void;
  /** Load the preview for the chosen survivor + sources. */
  preview: (survivor: GroupSummary, sources: GroupSummary[]) => Promise<void>;
  /** Execute the previewed plan (copy into survivor, empty sources). */
  execute: () => Promise<void>;
  /** Reset back to idle (closes the wizard). */
  reset: () => void;
}

/** Minimal bulk-undo user record. */
function toBulkUserInfo(u: OktaUser) {
  return {
    userId: u.id,
    userEmail: u.profile.email,
    userName: `${u.profile.firstName} ${u.profile.lastName}`.trim(),
  };
}

/**
 * A membership write Okta answered with a failure result.
 *
 * The merge counts these and carries on — one member who could not be copied is
 * a tallied failure, not a reason to abandon the run. It is a distinct type so
 * the batch runner can tell it apart from a transport error (no target tab, the
 * extension reloaded underneath the panel), which aborts the whole merge.
 */
class MergeWriteRejectedError extends Error {
  /** @param message - Okta's error text, when it supplied one. */
  constructor(message = 'Membership write rejected') {
    super(message);
    this.name = 'MergeWriteRejectedError';
    Object.setPrototypeOf(this, MergeWriteRejectedError.prototype);
  }
}

/** Users whose write settled successfully, in plan order. */
function settledUsers(outcome: BatchOutcome<OktaUser, OktaUser>): OktaUser[] {
  return outcome.results.filter((r) => r.status === 'fulfilled').map((r) => r.item);
}

/** How many writes Okta rejected (transport failures are not counted — they abort). */
function rejectedByOkta(outcome: BatchOutcome<OktaUser, OktaUser>): number {
  return outcome.results.filter((r) => r.error instanceof MergeWriteRejectedError).length;
}

/**
 * Re-raise the first error that is not an Okta rejection, if the batch halted on
 * one.
 *
 * Preserves the pre-`D-034` serial loop's abort semantics exactly: a transport
 * throw ended the merge on the spot, with the partial counts kept and no audit
 * entry written, while a `success: false` response was tallied and stepped over.
 */
function rethrowFatal(outcome: BatchOutcome<OktaUser, OktaUser>): void {
  const fatal = outcome.results.find(
    (r) => r.status === 'rejected' && !(r.error instanceof MergeWriteRejectedError),
  );
  if (fatal) throw fatal.error;
}

/**
 * Manage the group-merge wizard: preview then execute a consolidation.
 *
 * @param targetTabId - Connected Okta tab id (operations no-op when absent).
 * @returns Merge state plus `preview`/`execute`/`reset`.
 */
export function useGroupMerge(targetTabId?: number): UseGroupMergeReturn {
  const api = useOktaApi({ targetTabId: targetTabId ?? null });
  const {
    getAllGroupMembers,
    getGroupRulesForGroup,
    getCurrentUser,
    makeApiRequest,
    removeUserFromGroup,
    runOperation,
  } = api;
  const { completeProgress } = useProgress();
  const { actorNotice, noteActor, dismissActorNotice } = useActorNotice();

  const [phase, setPhase] = useState<MergePhase>('idle');
  const [plan, setPlan] = useState<MergePlan | null>(null);
  const [results, setResults] = useState<MergeResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useCallback(
    async (survivor: GroupSummary, sources: GroupSummary[]) => {
      setPhase('preview-loading');
      setError(null);
      setResults(null);
      try {
        const groups = [survivor, ...sources];
        const membersByGroup = new Map<string, OktaUser[]>();
        const feedingRulesByGroup = new Map<string, MergeFeedingRule[]>();

        // One paginated member read per group; feeding rules only for the sources.
        for (const g of groups) {
          membersByGroup.set(g.id, await getAllGroupMembers(g.id, { memberCount: g.memberCount }));
        }
        for (const s of sources) {
          const rules = await getGroupRulesForGroup(s.id);
          feedingRulesByGroup.set(
            s.id,
            rules.map((r) => ({ name: r.name, status: r.status })),
          );
        }

        const built = planGroupMerge(
          { id: survivor.id, name: survivor.name },
          sources.map((s) => ({ id: s.id, name: s.name })),
          membersByGroup,
          feedingRulesByGroup,
        );
        setPlan(built);
        setPhase('preview');
      } catch (err) {
        log.error('Merge preview failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to build merge preview');
        setPhase('error');
      }
    },
    [getAllGroupMembers, getGroupRulesForGroup],
  );

  const execute = useCallback(async () => {
    if (!plan || plan.blocked) return;
    setPhase('running');
    setError(null);

    const startTime = Date.now();
    const res: MergeResults = { copied: 0, copyFailed: 0, removed: 0, removeFailed: 0 };

    // Resolve the signed-in admin for audit attribution through the facade: one
    // validated, per-tab-cached `/api/v1/users/me` lookup that reports its own
    // failures as `kind: 'unavailable'` instead of inventing an identity.
    const actor = await getCurrentUser();
    // Tell the admin their identity could not be confirmed, then carry on: the
    // notice is informational and never gates the merge below (`D-013c`).
    noteActor(actor);

    /**
     * Close the run out: two audit entries (one add for the survivor, one
     * aggregate remove for the sources), the counts, and a terminal phase.
     *
     * `cancelledMessage` is passed only when the admin stopped the merge. The
     * writes that had already landed are just as real as a completed run's, so
     * they are audited and shown the same way — the message is what tells the
     * admin the rest never happened.
     */
    const finish = (cancelledMessage?: string) => {
      // Audit trail: one add entry (survivor) + one aggregate remove entry (sources).
      const auditBase = {
        performedBy: actor.kind === 'resolved' ? actor.email : null,
        actorResolution:
          actor.kind === 'resolved' ? ('resolved' as const) : ('unavailable' as const),
        affectedUsers: [] as string[],
      };
      const addEntry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action: 'add_users',
        groupId: plan.survivor.id,
        groupName: plan.survivor.name,
        ...auditBase,
        result: res.copyFailed === 0 ? 'success' : res.copied > 0 ? 'partial' : 'failed',
        details: {
          usersSucceeded: res.copied,
          usersFailed: res.copyFailed,
          apiRequestCount: plan.totalCopies,
          durationMs: Date.now() - startTime,
        },
      };
      const removeEntry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action: 'remove_users',
        groupId: plan.sources.length === 1 ? plan.sources[0].id : 'multiple',
        groupName: plan.sources.map((s) => s.name).join(', '),
        ...auditBase,
        result: res.removeFailed === 0 ? 'success' : res.removed > 0 ? 'partial' : 'failed',
        details: {
          usersSucceeded: res.removed,
          usersFailed: res.removeFailed,
          apiRequestCount: plan.totalRemovals,
          durationMs: Date.now() - startTime,
        },
      };
      auditStore.logOperation(addEntry).catch((e) => log.error('audit add failed', e));
      auditStore.logOperation(removeEntry).catch((e) => log.error('audit remove failed', e));

      setResults(res);
      if (cancelledMessage) {
        setError(cancelledMessage);
        setPhase('error');
        return;
      }
      setPhase('done');
    };

    try {
      // 1) Copy distinct source members into the survivor (PUT membership directly
      // so we log ONE bulk undo instead of flooding history per user).
      //
      // The fan-out runs through the shared operation runner rather than a
      // hand-rolled loop (`D-034`, CONVENTIONS "Okta API throttling"): same
      // scheduler path as before, but with the activity bar's live
      // done/active/failed counts and — new — a Cancel that stops the merge.
      const copyOutcome = await runOperation<OktaUser, OktaUser>(
        'Merging groups',
        plan.toCopy,
        async (user, _index, planId) => {
          const result = await makeApiRequest(
            `/api/v1/groups/${plan.survivor.id}/users/${user.id}`,
            {
              method: 'PUT',
              // Static label, not the survivor's name: `reason` is never redacted before
              // storage (only `endpoint` is), so a tenant group name has no business in it.
              reason: 'Merge groups: copy member into survivor',
              planId,
            },
          );
          if (!result.success) throw new MergeWriteRejectedError(result.error);
          return user;
        },
        {
          // An Okta rejection is tallied and stepped over; anything else ends the run.
          stopOnError: (error) => !(error instanceof MergeWriteRejectedError),
          message: (p) => `Copied ${p.completed}/${p.total} into ${plan.survivor.name}`,
          // One PUT per member that is not already in the survivor.
          plan: { endpoint: '/api/v1/groups', method: 'PUT' },
        },
      );
      // Tally before re-raising: a run aborted by a transport failure still
      // reports the writes that did land, exactly as the serial loop's
      // incremented counters did.
      const copiedUsers = settledUsers(copyOutcome);
      res.copied = copiedUsers.length;
      res.copyFailed = rejectedByOkta(copyOutcome);
      rethrowFatal(copyOutcome);

      if (copiedUsers.length > 0) {
        await logAction(
          `Merged ${copiedUsers.length} member${copiedUsers.length === 1 ? '' : 's'} into ${plan.survivor.name}`,
          {
            type: 'BULK_ADD_USERS_TO_GROUP',
            users: copiedUsers.map(toBulkUserInfo),
            groupId: plan.survivor.id,
            groupName: plan.survivor.name,
          },
        );
      }

      if (copyOutcome.cancelled) {
        // Cancelled before a single source was touched. The copies that already
        // landed are real writes: they stay recorded, undoable, and reported.
        finish('Merge cancelled. The source groups were not emptied.');
        return;
      }

      // 2) Empty each source group (skip per-user undo; log one bulk undo per source).
      for (const source of plan.sources) {
        const removeOutcome = await runOperation<OktaUser, OktaUser>(
          'Merging groups',
          source.membersToRemove,
          async (user, _index, planId) => {
            const result = await removeUserFromGroup(source.id, source.name, user, true, planId);
            if (!result.success) throw new MergeWriteRejectedError(result.error);
            return user;
          },
          {
            stopOnError: (error) => !(error instanceof MergeWriteRejectedError),
            message: () => `Emptying ${source.name}…`,
            // One DELETE per member currently in this source.
            plan: { endpoint: '/api/v1/groups', method: 'DELETE' },
          },
        );
        const removedUsers = settledUsers(removeOutcome);
        res.removed += removedUsers.length;
        res.removeFailed += rejectedByOkta(removeOutcome);
        rethrowFatal(removeOutcome);

        if (removedUsers.length > 0) {
          await logAction(
            `Emptied ${removedUsers.length} member${removedUsers.length === 1 ? '' : 's'} from ${source.name} (merge into ${plan.survivor.name})`,
            {
              type: 'BULK_REMOVE_USERS_FROM_GROUP',
              users: removedUsers.map(toBulkUserInfo),
              groupId: source.id,
              groupName: source.name,
              operationType: 'custom_status',
            },
          );
        }

        if (removeOutcome.cancelled) {
          finish(
            `Merge cancelled. ${source.name} was not fully emptied, and any later source group was left untouched.`,
          );
          return;
        }
      }

      finish();
    } catch (err) {
      log.error('Merge execution failed:', err);
      setError(err instanceof Error ? err.message : 'Merge failed');
      setResults(res);
      setPhase('error');
    } finally {
      completeProgress();
    }
  }, [
    plan,
    getCurrentUser,
    noteActor,
    makeApiRequest,
    removeUserFromGroup,
    runOperation,
    completeProgress,
  ]);

  const reset = useCallback(() => {
    setPhase('idle');
    setPlan(null);
    setResults(null);
    setError(null);
    dismissActorNotice();
  }, [dismissActorNotice]);

  return {
    phase,
    plan,
    results,
    error,
    actorNotice,
    dismissActorNotice,
    preview,
    execute,
    reset,
  };
}
