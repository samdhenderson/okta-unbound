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
  interpretGroupRules,
  memberWithGroupRulesSchema,
  type MemberRuleAttribution,
  type MemberWithGroupRules,
} from '@/shared/membership/memberRuleAttribution';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('useOktaApi');

/**
 * The rule-reference array out of a `…/group-rules` response body.
 *
 * The documented body **is** the array. Okta has shipped the same list nested
 * under a key elsewhere though (`_embedded['group-rules']` on the member
 * listing), so an object carrying that key is unwrapped rather than discarded.
 * Anything else returns `undefined`, which
 * {@link module:shared/membership/memberRuleAttribution.interpretGroupRules}
 * reads as `unknown` — never as "no rule".
 *
 * @param data - The raw response payload.
 * @returns The rule-reference array, or `undefined` when the payload is not one.
 */
function groupRulesPayload(data: unknown): unknown {
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null && GROUP_RULES_EXPAND in data) {
    return (data as Record<string, unknown>)[GROUP_RULES_EXPAND];
  }
  return undefined;
}

/**
 * Build add/remove/list operations for individual group memberships.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @param onMembershipChanged - Called with a group id after **every** successful
 * membership write here. This module deliberately knows nothing about the entity
 * cache — it reports that a group's membership moved and lets the assembly point
 * (`useOktaApi`) decide what that invalidates.
 *
 * The seam lives here rather than at the call sites because there are six of
 * them, and two (`groupBulkOps`, `groupCleanup`) are inside this same API layer,
 * receiving `removeUserFromGroup` as an injected primitive. Firing from the
 * primitive is the only place that covers all six without teaching the API layer
 * about caching.
 * @returns `{ removeUserFromGroup, removeUserFromGroups, getAllGroupMembers,
 * getMembershipRuleProof, addUserToGroup }`.
 */
export function createGroupMemberOperations(
  coreApi: CoreApi,
  onMembershipChanged?: (groupId: string) => void,
) {
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

    // Fires regardless of `skipUndoLog`: that flag controls the *audit* entry a
    // bulk caller aggregates, not whether this group's membership actually moved.
    if (result.success) onMembershipChanged?.(groupId);

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
        onMembershipChanged?.(groupId);
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
          coreApi.callbacks.onResult?.({ message: `Fetching page ${pageNumber}...`, type: 'info' });
        },
        onPage: (pageMembers, totalSoFar) => {
          coreApi.callbacks.onResult?.({
            message: `Page ${pageCount}: Loaded ${pageMembers.length} members (Total: ${totalSoFar})`,
            type: 'info',
          });
        },
      },
    );

    coreApi.callbacks.onResult?.({
      message: `Loaded ${allMembers.length} total members`,
      type: 'success',
    });
    return allMembers;
  };

  /**
   * Ask Okta which rules manage **one** user's membership of **one** group.
   *
   * `GET /api/v1/groups/{groupId}/users/{userId}/group-rules` is the documented
   * per-membership counterpart to the `expand=group-rules` embed
   * {@link getAllGroupMembers} rides along on. It is the user-detail page's only
   * route to an authoritative answer, since `GET /api/v1/users/{id}/groups`
   * carries no attribution embed at all (ADR-0020, ADR-0031).
   *
   * **One call per membership, so this is never run for a whole list.** A
   * 40-group user would be 40 requests; the caller gates it behind an explicit
   * per-row action. Exactly one request, no pagination — the response is the
   * complete rule set for that one membership.
   *
   * @param groupId - The group whose membership is in question.
   * @param userId - The member.
   * @returns The three-state {@link MemberRuleAttribution}, read through the same
   * interpreter as the embed so `no-rules` (Okta asserting a manual add) can
   * never collapse into `unknown`. A failed request is `unknown` — the absence of
   * an answer, never an answer.
   * @remarks Routed through `coreApi.makeApiRequest`, i.e. the background
   * scheduler, like every other Okta call. Never throws: the caller is a UI
   * affordance and the honest failure mode is "Okta did not answer".
   */
  const getMembershipRuleProof = async (
    groupId: string,
    userId: string,
  ): Promise<MemberRuleAttribution> => {
    const result = await coreApi.makeApiRequest(
      `/api/v1/groups/${groupId}/users/${userId}/group-rules`,
    );

    if (!result.success) {
      // Identifiers and the outcome only — never the response body.
      log.warn('Membership rule proof unavailable', {
        groupId,
        userId,
        status: result.status,
      });
      return { state: 'unknown' };
    }

    // Validated at the response boundary (ADR-0006): every entry goes through
    // `interpretGroupRules`' zod schema, and anything unusable degrades.
    return interpretGroupRules(groupRulesPayload(result.data));
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
      onMembershipChanged?.(groupId);
      await logAction(`Added ${user.profile.firstName} ${user.profile.lastName} to ${groupName}`, {
        type: 'ADD_USER_TO_GROUP',
        userId: user.id,
        userEmail: user.profile.email,
        userName: `${user.profile.firstName} ${user.profile.lastName}`,
        groupId,
        groupName,
      });
      coreApi.callbacks.onResult?.({
        message: `Added ${user.profile.login} to ${groupName}`,
        type: 'success',
      });
    }

    return { success: result.success, error: result.error };
  };

  return {
    removeUserFromGroup,
    removeUserFromGroups,
    getAllGroupMembers,
    getMembershipRuleProof,
    addUserToGroup,
  };
}
