/**
 * @module sidepanel/hooks/useGroupMerge
 * @description Drives the group-merge (membership consolidation) flow.
 *
 * Loads a {@link MergePlan} preview (members + feeding rules for the survivor and
 * sources), then executes it: copy distinct source members into the survivor and
 * empty each source, all through the rate-limited scheduler with live progress.
 * Every run records an audit entry and a bulk undo action per affected group so
 * the operation can be inspected and reversed. Emptying is blocked when a source
 * is fed by an active rule.
 */

import { useCallback, useState } from 'react';
import type { GroupSummary, AuditLogEntry, MembershipRule, OktaUser } from '../../shared/types';
import { useOktaApi } from './useOktaApi';
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
 * Manage the group-merge wizard: preview then execute a consolidation.
 *
 * @param targetTabId - Connected Okta tab id (operations no-op when absent).
 * @returns Merge state plus `preview`/`execute`/`reset`.
 */
export function useGroupMerge(targetTabId?: number): UseGroupMergeReturn {
  const api = useOktaApi({ targetTabId: targetTabId ?? null });
  const { getAllGroupMembers, getGroupRulesForGroup, makeApiRequest, removeUserFromGroup } = api;
  const { startProgress, updateProgress, completeProgress } = useProgress();

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
          membersByGroup.set(g.id, await getAllGroupMembers(g.id));
        }
        for (const s of sources) {
          const rules = (await getGroupRulesForGroup(s.id)) as MembershipRule[];
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
    const total = plan.totalCopies + plan.totalRemovals;
    let done = 0;
    const res: MergeResults = { copied: 0, copyFailed: 0, removed: 0, removeFailed: 0 };

    startProgress('Merging groups', `Copying members into ${plan.survivor.name}…`, total, false);

    try {
      // 1) Copy distinct source members into the survivor (PUT membership directly
      // so we log ONE bulk undo instead of flooding history per user).
      const copiedUsers: OktaUser[] = [];
      for (const user of plan.toCopy) {
        const result = await makeApiRequest(
          `/api/v1/groups/${plan.survivor.id}/users/${user.id}`,
          'PUT',
        );
        if (result.success) {
          res.copied++;
          copiedUsers.push(user);
        } else {
          res.copyFailed++;
        }
        updateProgress(
          ++done,
          total,
          `Copied ${res.copied}/${plan.totalCopies} into ${plan.survivor.name}`,
        );
      }

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

      // 2) Empty each source group (skip per-user undo; log one bulk undo per source).
      for (const source of plan.sources) {
        const removedUsers: OktaUser[] = [];
        for (const user of source.membersToRemove) {
          const result = await removeUserFromGroup(source.id, source.name, user, true);
          if (result.success) {
            res.removed++;
            removedUsers.push(user);
          } else {
            res.removeFailed++;
          }
          updateProgress(++done, total, `Emptying ${source.name}…`);
        }

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
      }

      // Audit trail: one add entry (survivor) + one aggregate remove entry (sources).
      const auditBase = {
        performedBy: 'unknown@unknown.com',
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
      setPhase('done');
    } catch (err) {
      log.error('Merge execution failed:', err);
      setError(err instanceof Error ? err.message : 'Merge failed');
      setResults(res);
      setPhase('error');
    } finally {
      completeProgress();
    }
  }, [plan, makeApiRequest, removeUserFromGroup, startProgress, updateProgress, completeProgress]);

  const reset = useCallback(() => {
    setPhase('idle');
    setPlan(null);
    setResults(null);
    setError(null);
  }, []);

  return { phase, plan, results, error, preview, execute, reset };
}
