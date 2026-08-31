/**
 * @module hooks/useOktaApi/groupBulkOps
 * @description Bulk operations across multiple groups
 */

import type { CoreApi } from './core';
import type { OktaUser } from './types';
import type { BulkOperation, BulkOperationResult } from '../../../shared/types';
import type { RequestResult } from '../../../shared/scheduler/types';
import { OperationCancelledError } from '../../../shared/scheduler/cancellation';

/** A bulk-operation result, extended with the member list some operations return. */
interface BulkGroupResult extends BulkOperationResult {
  members?: OktaUser[];
}

/**
 * Build the multi-group bulk-operation runner.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @param removeUserFromGroup - Membership-removal primitive (from
 * `createGroupMemberOperations`), reused by `cleanup_inactive`.
 * @param getAllGroupMembers - Paginated member fetch, reused by member-reading ops.
 * @returns `{ executeBulkOperation }`.
 */
export function createGroupBulkOperations(
  coreApi: CoreApi,
  removeUserFromGroup: (
    groupId: string,
    groupName: string,
    user: OktaUser,
    skipUndoLog?: boolean,
    planId?: string,
  ) => Promise<RequestResult>,
  getAllGroupMembers: (groupId: string) => Promise<OktaUser[]>,
) {
  /**
   * Apply one {@link BulkOperation} across each of its target groups.
   *
   * @param operation - The operation type + target group ids (+ optional config).
   * @param onProgress - Called per group with `(index, total, currentGroupName)`.
   * @returns One `BulkGroupResult` per target group, in input order.
   * @remarks
   * Groups are processed sequentially; within a group, `cleanup_inactive`
   * removals run through {@link CoreApi.runOperation} (ADR-0009), so they are
   * scheduler-rate-limited, activity-bar visible, and cancellable — no artificial
   * pause is needed between groups. Supported `type`s: `cleanup_inactive` (remove
   * `DEPROVISIONED`/`SUSPENDED`/`LOCKED_OUT` members), `export_all` (attach the
   * member list to the result), and `remove_user` (drop one user by
   * `config.userId`); unknown types yield a `failed` result. A thrown error for
   * one group is captured as that group's failed result and does not abort the rest.
   */
  const executeBulkOperation = async (
    operation: BulkOperation,
    onProgress?: (current: number, total: number, currentGroupName: string) => void,
  ): Promise<BulkGroupResult[]> => {
    // Clear any prior cancel so this run starts clean (this path doesn't drive the
    // global progress bar, which would otherwise have reset it).
    coreApi.resetCancellation();

    const results: BulkGroupResult[] = [];
    const totalGroups = operation.targetGroups.length;

    for (let i = 0; i < totalGroups; i++) {
      // Between groups, bail immediately if the user cancelled — this is what
      // stops the loop from starting the "next action" after a cancel.
      coreApi.checkCancelled();

      const groupId = operation.targetGroups[i];

      try {
        // Get group name
        const groupResponse = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`, {
          reason: 'Load group name for bulk operation',
        });
        const groupName = groupResponse.data?.profile?.name || groupId;

        onProgress?.(i + 1, totalGroups, groupName);

        const result: BulkGroupResult = {
          groupId,
          groupName,
          status: 'success',
          itemsProcessed: 0,
        };

        // Execute operation based on type
        switch (operation.type) {
          case 'cleanup_inactive': {
            const members = await getAllGroupMembers(groupId);
            const inactiveStatuses = ['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT'];
            const inactiveUsers = members.filter((u) => inactiveStatuses.includes(u.status));

            result.itemsProcessed = inactiveUsers.length;

            // ADR-0009: removals run through the shared operation runner —
            // scheduler-rate-limited, activity-bar visible, one Cancel. The
            // first rejection halts the group's remaining removals and is
            // re-raised so the group is recorded as failed (matching the old
            // serial loop's abort semantics).
            const outcome = await coreApi.runOperation(
              'Remove inactive members',
              inactiveUsers,
              async (user, _index, planId) => {
                await removeUserFromGroup(groupId, groupName, user, false, planId);
              },
              {
                stopOnError: () => true,
                message: (p) => `Removing inactive members (${p.completed}/${p.total})`,
                // One DELETE per inactive member, halting on the first failure.
                plan: { endpoint: '/api/v1/groups', method: 'DELETE' },
              },
            );
            if (outcome.cancelled) {
              // A cancel mid-removal aborts the whole bulk operation, exactly
              // like the old loop's propagated OperationCancelledError.
              throw new OperationCancelledError();
            }
            const rejected = outcome.results.find((r) => r.status === 'rejected');
            if (rejected) {
              throw rejected.error instanceof Error
                ? rejected.error
                : new Error('Failed to remove inactive members');
            }
            break;
          }

          case 'export_all': {
            const members = await getAllGroupMembers(groupId);
            result.itemsProcessed = members.length;
            result.members = members;
            break;
          }

          case 'remove_user': {
            if (operation.config?.userId) {
              const removeResult = await coreApi.makeApiRequest(
                `/api/v1/groups/${groupId}/users/${operation.config.userId}`,
                { method: 'DELETE', reason: 'Bulk remove user from group' },
              );
              result.status = removeResult.success ? 'success' : 'failed';
              result.itemsProcessed = removeResult.success ? 1 : 0;
              if (!removeResult.success) {
                result.errors = [removeResult.error || 'Unknown error'];
              }
            }
            break;
          }

          default:
            result.status = 'failed';
            result.errors = [`Unknown operation type: ${operation.type}`];
        }

        results.push(result);
      } catch (error) {
        // A cancellation raised mid-group (e.g. the scheduler rejecting an
        // in-flight request when the queue is cleared) must abort the whole
        // operation, not be recorded as this group's "failed" result.
        if (error instanceof OperationCancelledError) {
          throw error;
        }

        results.push({
          groupId,
          groupName: groupId,
          status: 'failed',
          itemsProcessed: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
      // No pause between groups: the background scheduler enforces rate limits.
    }

    return results;
  };

  return {
    executeBulkOperation,
  };
}
