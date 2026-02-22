/**
 * @module hooks/useOktaApi/groupMembers
 * @description Group member management operations
 */

import type { CoreApi } from './core';
import type { OktaUser } from './types';
import { logAction } from '../../../shared/undoManager';
import { parseNextLink } from './utilities';

export function createGroupMemberOperations(coreApi: CoreApi) {
  /**
   * Remove a user from a group
   */
  const removeUserFromGroup = async (
    groupId: string,
    groupName: string,
    user: OktaUser,
    skipUndoLog = false
  ) => {
    const result = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}/users/${user.id}`, 'DELETE');

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
        }
      );
    }

    return result;
  };

  /**
   * Get all members of a group with pagination
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
        'info'
      );

      nextUrl = parseNextLink(response.headers?.link);
    }

    coreApi.callbacks.onResult?.(`Loaded ${allMembers.length} total members`, 'success');
    return allMembers;
  };

  /**
   * Add a user to a group
   */
  const addUserToGroup = async (
    groupId: string,
    groupName: string,
    user: { id: string; profile: { login: string; firstName: string; lastName: string; email: string } }
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}/users/${user.id}`, 'PUT');

    if (result.success) {
      await logAction(
        `Added ${user.profile.firstName} ${user.profile.lastName} to ${groupName}`,
        {
          type: 'ADD_USER_TO_GROUP',
          userId: user.id,
          userEmail: user.profile.email,
          userName: `${user.profile.firstName} ${user.profile.lastName}`,
          groupId,
          groupName,
        }
      );
      coreApi.callbacks.onResult?.(
        `Added ${user.profile.login} to ${groupName}`,
        'success'
      );
    }

    return { success: result.success, error: result.error };
  };

  return {
    removeUserFromGroup,
    getAllGroupMembers,
    addUserToGroup,
  };
}
