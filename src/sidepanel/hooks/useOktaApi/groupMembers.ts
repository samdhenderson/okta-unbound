/**
 * @module hooks/useOktaApi/groupMembers
 * @description Group member management operations
 */

import type { CoreApi } from './core';
import type { OktaUser } from './types';
import { logAction } from '../../../shared/undoManager';
import { parseNextLink } from './utilities';

/**
 * Build add/remove/list operations for individual group memberships.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns `{ removeUserFromGroup, getAllGroupMembers, addUserToGroup }`.
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
   * Fetch every member of a group, following `Link` pagination (200 per page).
   *
   * @param groupId - Group whose members to load.
   * @returns All members across all pages.
   * @remarks Emits per-page `onResult` progress. Throws on the first failed page.
   */
  const getAllGroupMembers = async (groupId: string): Promise<OktaUser[]> => {
    const allMembers: OktaUser[] = [];
    let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
    let pageCount = 0;

    while (nextUrl) {
      pageCount++;
      coreApi.callbacks.onResult?.(`Fetching page ${pageCount}...`, 'info');

      const response = await coreApi.makeApiRequest(nextUrl);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch group members');
      }

      const pageMembers = response.data || [];
      allMembers.push(...pageMembers);

      coreApi.callbacks.onResult?.(
        `Page ${pageCount}: Loaded ${pageMembers.length} members (Total: ${allMembers.length})`,
        'info',
      );

      nextUrl = parseNextLink(response.headers?.link);
    }

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
    getAllGroupMembers,
    addUserToGroup,
  };
}
