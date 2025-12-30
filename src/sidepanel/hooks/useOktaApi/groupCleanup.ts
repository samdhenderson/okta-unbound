/**
 * @module hooks/useOktaApi/groupCleanup
 * @description Group cleanup operations for removing inactive users
 */

import type { CoreApi } from './core';
import type { OktaUser, UserStatus, AuditLogEntry } from './types';
import type { BulkUserInfo } from '../../../shared/undoTypes';
import { logBulkRemoveAction } from '../../../shared/undoManager';
import { auditStore } from '../../../shared/storage/auditStore';
import { parseNextLink } from './utilities';

export function createGroupCleanupOperations(coreApi: CoreApi, removeUserFromGroup: (groupId: string, groupName: string, user: OktaUser, skipUndoLog?: boolean) => Promise<any>) {
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

    try {
      coreApi.callbacks.onResult?.('Starting: Remove deprovisioned users', 'info');
      coreApi.callbacks.onProgress?.(0, 100, 'Fetching user info...', 0);

      // Get current user for audit logging
      currentUser = await coreApi.getCurrentUser();
      apiCallsMade++;

      coreApi.checkCancelled();

      // Check group type
      coreApi.callbacks.onProgress?.(0, 100, 'Checking group type...', apiCallsMade);
      const groupDetails = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
      apiCallsMade++;
      if (groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
        coreApi.callbacks.onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
        return;
      }

      groupName = groupDetails.data?.profile?.name || 'Unknown Group';

      coreApi.checkCancelled();

      // Fetch all members with progress tracking
      coreApi.callbacks.onProgress?.(0, 100, 'Fetching group members...', apiCallsMade);
      const allMembers: OktaUser[] = [];
      let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
      let pageCount = 0;

      while (nextUrl) {
        pageCount++;
        coreApi.callbacks.onResult?.(`Fetching page ${pageCount}...`, 'info');

        const response = await coreApi.makeApiRequest(nextUrl);
        apiCallsMade++;
        coreApi.callbacks.onProgress?.(0, 100, `Fetching members (page ${pageCount})...`, apiCallsMade);

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

      const deprovisionedUsers = allMembers.filter((u) => u.status === 'DEPROVISIONED');

      coreApi.callbacks.onResult?.(`Found ${deprovisionedUsers.length} deprovisioned users`, 'warning');

      if (deprovisionedUsers.length === 0) {
        coreApi.callbacks.onResult?.('No deprovisioned users to remove', 'success');
        return;
      }

      // Calculate total API calls: fetch phase + removal phase
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

      // Log a single bulk undo action for all removed users
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

      // Log to audit trail
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

  /**
   * Smart cleanup - remove all inactive users (DEPROVISIONED, SUSPENDED, LOCKED_OUT)
   */
  const smartCleanup = async (groupId: string) => {
    const startTime = Date.now();
    let currentUser: { email: string; id: string } | null = null;
    let groupName = 'Unknown Group';
    let removed = 0;
    let failed = 0;
    let apiCallsMade = 0;
    const errorMessages: string[] = [];
    const affectedUserIds: string[] = [];
    const removedUsers: BulkUserInfo[] = [];

    try {
      coreApi.callbacks.onResult?.('Starting: Smart Cleanup (remove all inactive users)', 'info');
      coreApi.callbacks.onProgress?.(0, 100, 'Fetching user info...', 0);

      currentUser = await coreApi.getCurrentUser();
      apiCallsMade++;

      coreApi.checkCancelled();

      // Check group type
      coreApi.callbacks.onProgress?.(0, 100, 'Checking group type...', apiCallsMade);
      const groupDetails = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
      apiCallsMade++;
      if (groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
        coreApi.callbacks.onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
        return;
      }

      groupName = groupDetails.data?.profile?.name || 'Unknown Group';

      coreApi.checkCancelled();

      // Fetch all members
      coreApi.callbacks.onProgress?.(0, 100, 'Fetching group members...', apiCallsMade);
      const allMembers: OktaUser[] = [];
      let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
      let pageCount = 0;

      while (nextUrl) {
        pageCount++;
        coreApi.callbacks.onResult?.(`Fetching page ${pageCount}...`, 'info');

        const response = await coreApi.makeApiRequest(nextUrl);
        apiCallsMade++;
        coreApi.callbacks.onProgress?.(0, 100, `Fetching members (page ${pageCount})...`, apiCallsMade);

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch group members');
        }

        const pageMembers = response.data || [];
        allMembers.push(...pageMembers);

        nextUrl = parseNextLink(response.headers?.link);
      }

      const inactiveStatuses: UserStatus[] = ['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT'];
      const inactiveUsers = allMembers.filter((u) => inactiveStatuses.includes(u.status));

      coreApi.callbacks.onResult?.(`Found ${inactiveUsers.length} inactive users`, 'warning');

      if (inactiveUsers.length === 0) {
        coreApi.callbacks.onResult?.('No inactive users to remove', 'success');
        return;
      }

      // Show breakdown
      inactiveStatuses.forEach((status) => {
        const count = inactiveUsers.filter((u) => u.status === status).length;
        if (count > 0) {
          coreApi.callbacks.onResult?.(`- ${status}: ${count} users`, 'info');
        }
      });

      const totalApiCalls = apiCallsMade + inactiveUsers.length;

      // Remove each inactive user
      for (let i = 0; i < inactiveUsers.length; i++) {
        coreApi.checkCancelled();

        const user = inactiveUsers[i];
        affectedUserIds.push(user.id);

        const currentApiCall = apiCallsMade + i + 1;
        coreApi.callbacks.onProgress?.(
          currentApiCall,
          totalApiCalls,
          `Removing ${user.profile.firstName} ${user.profile.lastName} (${i + 1}/${inactiveUsers.length})`,
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
          coreApi.callbacks.onResult?.(`Removed: ${user.profile.login} (${user.status})`, 'success');
        } else {
          failed++;
          const errorMsg = `Failed: ${user.profile.login} - ${result.error}`;
          errorMessages.push(errorMsg);
          if (result.status === 403) {
            coreApi.callbacks.onResult?.('403 Forbidden - stopping', 'error');
            break;
          } else {
            coreApi.callbacks.onResult?.(errorMsg, 'error');
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      apiCallsMade += inactiveUsers.length;

      // Log bulk undo action
      if (removedUsers.length > 0) {
        await logBulkRemoveAction(groupId, groupName, removedUsers, 'inactive');
      }

      coreApi.callbacks.onResult?.(`Smart Cleanup complete: ${removed} removed, ${failed} failed`, 'success');
    } catch (error) {
      const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errorMessages.push(errorMsg);
      coreApi.callbacks.onResult?.(
        errorMsg,
        error instanceof Error && error.message === 'Operation cancelled' ? 'warning' : 'error'
      );
    } finally {
      coreApi.callbacks.onProgress?.(apiCallsMade, apiCallsMade, 'Complete', apiCallsMade);

      // Log to audit trail
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

  /**
   * Custom filter - list or remove users by specific status
   */
  const customFilter = async (groupId: string, targetStatus: UserStatus, action: 'list' | 'remove') => {
    const startTime = Date.now();
    let currentUser: { email: string; id: string } | null = null;
    let groupName = 'Unknown Group';
    let removed = 0;
    let failed = 0;
    let apiCallsMade = 0;
    const errorMessages: string[] = [];
    const affectedUserIds: string[] = [];
    const removedUsers: BulkUserInfo[] = [];

    try {
      coreApi.callbacks.onResult?.(
        `Starting: ${action === 'remove' ? 'Remove' : 'List'} users with status ${targetStatus}`,
        'info'
      );
      coreApi.callbacks.onProgress?.(0, 100, 'Fetching user info...', 0);

      currentUser = await coreApi.getCurrentUser();
      apiCallsMade++;

      coreApi.checkCancelled();

      // Check group type
      coreApi.callbacks.onProgress?.(0, 100, 'Checking group type...', apiCallsMade);
      const groupDetails = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
      apiCallsMade++;
      if (action === 'remove' && groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
        coreApi.callbacks.onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
        return;
      }

      groupName = groupDetails.data?.profile?.name || 'Unknown Group';

      coreApi.checkCancelled();

      // Fetch all members
      coreApi.callbacks.onProgress?.(0, 100, 'Fetching group members...', apiCallsMade);
      const allMembers: OktaUser[] = [];
      let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
      let pageCount = 0;

      while (nextUrl) {
        pageCount++;
        coreApi.callbacks.onResult?.(`Fetching page ${pageCount}...`, 'info');

        const response = await coreApi.makeApiRequest(nextUrl);
        apiCallsMade++;
        coreApi.callbacks.onProgress?.(0, 100, `Fetching members (page ${pageCount})...`, apiCallsMade);

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch group members');
        }

        const pageMembers = response.data || [];
        allMembers.push(...pageMembers);

        nextUrl = parseNextLink(response.headers?.link);
      }

      const filteredUsers = allMembers.filter((u) => u.status === targetStatus);

      coreApi.callbacks.onResult?.(`Found ${filteredUsers.length} users with status ${targetStatus}`, 'warning');

      if (filteredUsers.length === 0) {
        coreApi.callbacks.onResult?.(`No users with status ${targetStatus}`, 'success');
        return;
      }

      if (action === 'list') {
        filteredUsers.forEach((user) => {
          coreApi.callbacks.onResult?.(
            `${user.profile.login} - ${user.profile.firstName} ${user.profile.lastName}`,
            'info'
          );
        });
        coreApi.callbacks.onResult?.(`Listed ${filteredUsers.length} users`, 'success');
      } else {
        const totalApiCalls = apiCallsMade + filteredUsers.length;

        for (let i = 0; i < filteredUsers.length; i++) {
          coreApi.checkCancelled();

          const user = filteredUsers[i];
          affectedUserIds.push(user.id);

          const currentApiCall = apiCallsMade + i + 1;
          coreApi.callbacks.onProgress?.(
            currentApiCall,
            totalApiCalls,
            `Removing ${user.profile.firstName} ${user.profile.lastName} (${i + 1}/${filteredUsers.length})`,
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
            coreApi.callbacks.onResult?.(`Removed: ${user.profile.login}`, 'success');
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

        apiCallsMade += filteredUsers.length;

        // Log bulk undo action
        if (removedUsers.length > 0) {
          await logBulkRemoveAction(groupId, groupName, removedUsers, 'custom_status', targetStatus);
        }

        coreApi.callbacks.onResult?.(`Removed ${removed} users`, 'success');
      }
    } catch (error) {
      const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errorMessages.push(errorMsg);
      coreApi.callbacks.onResult?.(
        errorMsg,
        error instanceof Error && error.message === 'Operation cancelled' ? 'warning' : 'error'
      );
    } finally {
      coreApi.callbacks.onProgress?.(apiCallsMade, apiCallsMade, 'Complete', apiCallsMade);

      // Log to audit trail (only for remove actions)
      if (action === 'remove' && currentUser && affectedUserIds.length > 0) {
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

  /**
   * Custom filter for multiple statuses
   */
  const customFilterMultiple = async (groupId: string, targetStatuses: UserStatus[], action: 'list' | 'remove') => {
    const startTime = Date.now();
    let currentUser: { email: string; id: string } | null = null;
    let groupName = 'Unknown Group';
    let removed = 0;
    let failed = 0;
    let apiCallsMade = 0;
    const errorMessages: string[] = [];
    const affectedUserIds: string[] = [];
    const removedUsers: BulkUserInfo[] = [];

    try {
      const statusLabel = targetStatuses.join(', ');
      coreApi.callbacks.onResult?.(
        `Starting: ${action === 'remove' ? 'Remove' : 'List'} users with statuses: ${statusLabel}`,
        'info'
      );
      coreApi.callbacks.onProgress?.(0, 100, 'Fetching user info...', 0);

      currentUser = await coreApi.getCurrentUser();
      apiCallsMade++;

      coreApi.checkCancelled();

      // Check group type
      coreApi.callbacks.onProgress?.(0, 100, 'Checking group type...', apiCallsMade);
      const groupDetails = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
      apiCallsMade++;
      if (action === 'remove' && groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
        coreApi.callbacks.onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
        return;
      }

      groupName = groupDetails.data?.profile?.name || 'Unknown Group';

      coreApi.checkCancelled();

      // Fetch all members
      coreApi.callbacks.onProgress?.(0, 100, 'Fetching group members...', apiCallsMade);
      const allMembers: OktaUser[] = [];
      let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
      let pageCount = 0;

      while (nextUrl) {
        pageCount++;
        coreApi.callbacks.onResult?.(`Fetching page ${pageCount}...`, 'info');

        const response = await coreApi.makeApiRequest(nextUrl);
        apiCallsMade++;
        coreApi.callbacks.onProgress?.(0, 100, `Fetching members (page ${pageCount})...`, apiCallsMade);

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch group members');
        }

        const pageMembers = response.data || [];
        allMembers.push(...pageMembers);

        nextUrl = parseNextLink(response.headers?.link);
      }

      // Filter users matching any of the target statuses
      const filteredUsers = allMembers.filter((u) => targetStatuses.includes(u.status));

      coreApi.callbacks.onResult?.(`Found ${filteredUsers.length} users matching statuses: ${statusLabel}`, 'warning');

      // Show breakdown by status
      targetStatuses.forEach((status) => {
        const count = filteredUsers.filter((u) => u.status === status).length;
        if (count > 0) {
          coreApi.callbacks.onResult?.(`- ${status}: ${count} users`, 'info');
        }
      });

      if (filteredUsers.length === 0) {
        coreApi.callbacks.onResult?.(`No users with statuses: ${statusLabel}`, 'success');
        return;
      }

      if (action === 'list') {
        filteredUsers.forEach((user) => {
          coreApi.callbacks.onResult?.(
            `[${user.status}] ${user.profile.login} - ${user.profile.firstName} ${user.profile.lastName}`,
            'info'
          );
        });
        coreApi.callbacks.onResult?.(`Listed ${filteredUsers.length} users`, 'success');
      } else {
        const totalApiCalls = apiCallsMade + filteredUsers.length;

        for (let i = 0; i < filteredUsers.length; i++) {
          coreApi.checkCancelled();

          const user = filteredUsers[i];
          affectedUserIds.push(user.id);

          const currentApiCall = apiCallsMade + i + 1;
          coreApi.callbacks.onProgress?.(
            currentApiCall,
            totalApiCalls,
            `Removing ${user.profile.firstName} ${user.profile.lastName} (${i + 1}/${filteredUsers.length})`,
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
            coreApi.callbacks.onResult?.(`Removed: ${user.profile.login} (${user.status})`, 'success');
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

        apiCallsMade += filteredUsers.length;

        // Log bulk undo action
        if (removedUsers.length > 0) {
          await logBulkRemoveAction(groupId, groupName, removedUsers, 'multi_status', targetStatuses.join(','));
        }

        coreApi.callbacks.onResult?.(
          `Removed ${removed} users, ${failed} failed`,
          removed > 0 ? 'success' : 'warning'
        );
      }
    } catch (error) {
      const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errorMessages.push(errorMsg);
      coreApi.callbacks.onResult?.(
        errorMsg,
        error instanceof Error && error.message === 'Operation cancelled' ? 'warning' : 'error'
      );
    } finally {
      coreApi.callbacks.onProgress?.(apiCallsMade, apiCallsMade, 'Complete', apiCallsMade);

      // Log to audit trail
      if (action === 'remove' && currentUser && affectedUserIds.length > 0) {
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
    smartCleanup,
    customFilter,
    customFilterMultiple,
  };
}
