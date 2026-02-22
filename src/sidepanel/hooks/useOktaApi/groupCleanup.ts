/**
 * @module hooks/useOktaApi/groupCleanup
 * @description Group cleanup operations for removing inactive users
 */

import type { CoreApi } from './core';
import type { OktaUser, AuditLogEntry } from './types';
import type { BulkUserInfo } from '../../../shared/undoTypes';
import { logBulkRemoveAction } from '../../../shared/undoManager';
import { auditStore } from '../../../shared/storage/auditStore';
import { parseNextLink } from './utilities';

/**
 * Fetch all members of a group with pagination
 */
async function fetchAllMembers(
  coreApi: CoreApi,
  groupId: string,
  onApiCall: () => number
): Promise<OktaUser[]> {
  const allMembers: OktaUser[] = [];
  let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
  let pageCount = 0;

  while (nextUrl) {
    pageCount++;
    coreApi.callbacks.onResult?.(`Fetching page ${pageCount}...`, 'info');

    const response = await coreApi.makeApiRequest(nextUrl);
    const apiCalls = onApiCall();
    coreApi.callbacks.onProgress?.(0, 100, `Fetching members (page ${pageCount})...`, apiCalls);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch group members');
    }

    allMembers.push(...(response.data || []));
    nextUrl = parseNextLink(response.headers?.link);
  }

  return allMembers;
}

export function createGroupCleanupOperations(
  coreApi: CoreApi,
  removeUserFromGroup: (groupId: string, groupName: string, user: OktaUser, skipUndoLog?: boolean) => Promise<any>
) {
  /**
   * Remove all deprovisioned users from a group
   */
  const removeDeprovisioned = async (groupId: string) => {
    const startTime = Date.now();
    let currentUser: { email: string; id: string } | null = null;
    let groupName = 'Unknown Group';
    let removed = 0;
    let failed = 0;
    let apiCallsMade = 0;
    const errorMessages: string[] = [];
    const affectedUserIds: string[] = [];
    const removedUsers: BulkUserInfo[] = [];

    const trackApiCall = () => ++apiCallsMade;

    try {
      coreApi.callbacks.onResult?.('Starting: Remove deprovisioned users', 'info');
      coreApi.callbacks.onProgress?.(0, 100, 'Fetching user info...', 0);

      currentUser = await coreApi.getCurrentUser();
      trackApiCall();
      coreApi.checkCancelled();

      // Check group type
      coreApi.callbacks.onProgress?.(0, 100, 'Checking group type...', apiCallsMade);
      const groupDetails = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
      trackApiCall();

      if (groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
        coreApi.callbacks.onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
        return;
      }

      groupName = groupDetails.data?.profile?.name || 'Unknown Group';
      coreApi.checkCancelled();

      // Fetch all members
      coreApi.callbacks.onProgress?.(0, 100, 'Fetching group members...', apiCallsMade);
      const allMembers = await fetchAllMembers(coreApi, groupId, trackApiCall);

      const deprovisionedUsers = allMembers.filter((u) => u.status === 'DEPROVISIONED');
      coreApi.callbacks.onResult?.(`Found ${deprovisionedUsers.length} deprovisioned users`, 'warning');

      if (deprovisionedUsers.length === 0) {
        coreApi.callbacks.onResult?.('No deprovisioned users to remove', 'success');
        return;
      }

      const totalApiCalls = apiCallsMade + deprovisionedUsers.length;

      // Remove each deprovisioned user
      for (let i = 0; i < deprovisionedUsers.length; i++) {
        coreApi.checkCancelled();

        const user = deprovisionedUsers[i];
        affectedUserIds.push(user.id);

        const currentApiCall = apiCallsMade + i + 1;
        coreApi.callbacks.onProgress?.(
          currentApiCall,
          totalApiCalls,
          `Removing ${user.profile.firstName} ${user.profile.lastName} (${i + 1}/${deprovisionedUsers.length})`,
          currentApiCall
        );

        const result = await removeUserFromGroup(groupId, groupName, user, true);

        if (result.success) {
          removed++;
          removedUsers.push({
            userId: user.id,
            userEmail: user.profile.email,
            userName: `${user.profile.firstName} ${user.profile.lastName}`,
          });
          coreApi.callbacks.onResult?.(
            `Removed: ${user.profile.login} (${user.profile.firstName} ${user.profile.lastName})`,
            'success'
          );
        } else {
          failed++;
          const errorMsg = `Failed: ${user.profile.login} - ${result.error}`;
          errorMessages.push(errorMsg);
          if (result.status === 403) {
            coreApi.callbacks.onResult?.(`403 Forbidden: ${user.profile.login} - ${result.error}`, 'error');
            coreApi.callbacks.onResult?.('Stopping after first 403 error', 'warning');
            break;
          } else {
            coreApi.callbacks.onResult?.(errorMsg, 'error');
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      apiCallsMade += deprovisionedUsers.length;

      if (removedUsers.length > 0) {
        await logBulkRemoveAction(groupId, groupName, removedUsers, 'deprovisioned');
      }

      coreApi.callbacks.onResult?.(
        `Complete: ${removed} removed, ${failed} failed`,
        removed > 0 ? 'success' : 'warning'
      );
    } catch (error) {
      const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errorMessages.push(errorMsg);
      coreApi.callbacks.onResult?.(
        errorMsg,
        error instanceof Error && error.message === 'Operation cancelled' ? 'warning' : 'error'
      );
    } finally {
      coreApi.callbacks.onProgress?.(apiCallsMade, apiCallsMade, 'Complete', apiCallsMade);

      if (currentUser && affectedUserIds.length > 0) {
        const auditEntry: AuditLogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'remove_users',
          groupId,
          groupName,
          performedBy: currentUser.email,
          affectedUsers: affectedUserIds,
          result: failed === 0 ? 'success' : removed === 0 ? 'failed' : 'partial',
          details: {
            usersSucceeded: removed,
            usersFailed: failed,
            apiRequestCount: apiCallsMade,
            durationMs: Date.now() - startTime,
            errorMessages: errorMessages.length > 0 ? errorMessages : undefined,
          },
        };
        auditStore.logOperation(auditEntry).catch((err) => {
          console.error('[useOktaApi] Failed to log audit entry:', err);
        });
      }
    }
  };

  return {
    removeDeprovisioned,
  };
}
