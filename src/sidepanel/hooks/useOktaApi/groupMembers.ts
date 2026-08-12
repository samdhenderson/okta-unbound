/**
 * @module hooks/useOktaApi/groupMembers
 * @description Group member management operations
 */

import type { CoreApi } from './core';
import type { OktaUser } from './types';
import type { BatchOutcome } from '@/shared/scheduler/runBatch';
import { logAction } from '../../../shared/undoManager';
import { fetchAllPages, OKTA_PAGE_SIZE } from '@/shared/utils/oktaPagination';
import {
  GROUP_RULES_EXPAND,
  memberWithGroupRulesSchema,
  type MemberWithGroupRules,
} from '@/shared/membership/memberRuleAttribution';

/**
 * Build add/remove/list operations for individual group memberships.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns `{ removeUserFromGroup, removeUserFromGroups, getAllGroupMembers, addUserToGroup }`.
 */
export function createGroupMemberOperations(coreApi: CoreApi) {
  /**
   * Remove a single user from a group (DELETE membership).
   *
   * @param groupId - Target group id.
   * @param groupName - Human-readable name, used in the undo-log description.
   * @param user - The member to remove.
   * @param skipUndoLog - When `true`, suppresses the per-user undo entry; bulk
   * callers set this and log one aggregate undo action at the end.
   * @returns The raw `RequestResult`; inspect `success`/`status` for outcome.
   */
  const removeUserFromGroup = async (
    groupId: string,
    groupName: string,
    user: OktaUser,
    skipUndoLog = false,
  ) => {
    const result = await coreApi.makeApiRequest(
      `/api/v1/groups/${groupId}/users/${user.id}`,
      'DELETE',
    );

    // Log undo action if successful (skip for bulk operations which log at the end)
    if (result.success && !skipUndoLog) {
      await logAction(
        `Removed ${user.profile.firstName} ${user.profile.lastName} from ${groupName}`,
        {
          type: 'REMOVE_USER_FROM_GROUP',
          userId: user.id,
          userEmail: user.profile.email,
          userName: `${user.profile.firstName} ${user.profile.lastName}`,
          groupId,
          groupName,
        },
      );
    }

    return result;
  };

  /**
   * Remove one user from several groups as a single tracked, cancellable
   * operation ({@link CoreApi.runOperation} → activity bar + Cancel; ADR-0009).
   *
   * @param userId - The user to remove.
   * @param groupIds - Groups to remove the user from, processed in order.
   * @param onProgress - Optional `(completed, total)` callback fired after each
   * successful removal.
   * @returns The full {@link BatchOutcome} (never throws for control flow —
   * inspect `results` / `cancelled`); callers that need the legacy
   * throw-on-first-rejection contract re-raise from `results`.
   * @remarks
   * Deliberately preserved legacy semantics (pinned by GroupsTab
   * characterization tests — do not "fix" here):
   * - DELETEs run sequentially (`concurrency: 1`) in the given group order.
   * - The first *rejected* request halts the remaining groups (`stopOnError`).
   * - A `success: false` response (no throw) still counts as processed and the
   *   run carries on.
   * No per-group undo entry is logged, matching the previous implementation.
   */
  const removeUserFromGroups = async (
    userId: string,
    groupIds: string[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<BatchOutcome<string, void>> => {
    let completedCount = 0;
    return coreApi.runOperation(
      'Remove user from groups',
      groupIds,
      async (groupId) => {
        await coreApi.makeApiRequest(`/api/v1/groups/${groupId}/users/${userId}`, 'DELETE');
        completedCount += 1;
        onProgress?.(completedCount, groupIds.length);
      },
      {
        concurrency: 1,
        stopOnError: () => true,
        message: (p) => `Removing user from groups (${p.completed}/${p.total})`,
      },
    );
  };

  /**
   * Fetch every member of a group, following `Link` pagination (200 per page).
   *
   * @param groupId - Group whose members to load.
   * @returns All members across all pages. Each row carries Okta's own rule
   * attribution under `_embedded['group-rules']` — see
   * {@link module:shared/membership/memberRuleAttribution}.
   * @remarks Emits per-page `onResult` progress. Throws on the first failed page.
   *
   * Requests `expand=group-rules`, the private parameter the Okta admin console
   * uses to fill its own "assigned by rule" column. It rides along on the
   * listing this method already issues, so the attribution costs **no extra
   * requests** — the no-fan-out guarantee in
   * `useGroupSource.requestCount.test.ts` is unchanged.
   */
  const getAllGroupMembers = async (groupId: string): Promise<OktaUser[]> => {
    let pageCount = 0;

    const allMembers: OktaUser[] = await fetchAllPages<MemberWithGroupRules>(
      (url) => coreApi.makeApiRequest(url),
      `/api/v1/groups/${groupId}/users?limit=${OKTA_PAGE_SIZE}&expand=${GROUP_RULES_EXPAND}`,
      {
        // Validated at the response boundary (ADR-0006): malformed rows are
        // dropped leniently by parseOktaList, never thrown on.
        schema: memberWithGroupRulesSchema,
        // Okta does NOT echo the private `expand` into its rel="next" link, so
        // without this page 2+ would arrive with no embed at all — attribution
        // exact for the first 200 members and inferred for the rest. The only
        // caller of fetchAllPages that opts in.
        preserveParams: ['expand'],
        errorMessage: 'Failed to fetch group members',
        onBeforePage: (pageNumber) => {
          pageCount = pageNumber;
          coreApi.callbacks.onResult?.(`Fetching page ${pageNumber}...`, 'info');
        },
        onPage: (pageMembers, totalSoFar) => {
          coreApi.callbacks.onResult?.(
            `Page ${pageCount}: Loaded ${pageMembers.length} members (Total: ${totalSoFar})`,
            'info',
          );
        },
      },
    );

    coreApi.callbacks.onResult?.(`Loaded ${allMembers.length} total members`, 'success');
    return allMembers;
  };

  /**
   * Add a user to a group (PUT membership) and log an undo action on success.
   *
   * @param groupId - Target group id.
   * @param groupName - Human-readable name for undo/result messages.
   * @param user - The user to add (id + profile fields).
   * @returns `{ success, error? }` distilled from the underlying request.
   */
  const addUserToGroup = async (
    groupId: string,
    groupName: string,
    user: {
      id: string;
      profile: { login: string; firstName: string; lastName: string; email: string };
    },
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await coreApi.makeApiRequest(
      `/api/v1/groups/${groupId}/users/${user.id}`,
      'PUT',
    );

    if (result.success) {
      await logAction(`Added ${user.profile.firstName} ${user.profile.lastName} to ${groupName}`, {
        type: 'ADD_USER_TO_GROUP',
        userId: user.id,
        userEmail: user.profile.email,
        userName: `${user.profile.firstName} ${user.profile.lastName}`,
        groupId,
        groupName,
      });
      coreApi.callbacks.onResult?.(`Added ${user.profile.login} to ${groupName}`, 'success');
    }

    return { success: result.success, error: result.error };
  };

  return {
    removeUserFromGroup,
    removeUserFromGroups,
    getAllGroupMembers,
    addUserToGroup,
  };
}
