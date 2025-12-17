/**
 * @module hooks/useOktaApi
 * @description Primary hook for interacting with the Okta API. Provides comprehensive methods for
 * managing users, groups, and applications with built-in rate limiting, error handling, and audit logging.
 *
 * This hook serves as the main interface between the UI and Okta's REST API, coordinating with:
 * - Background scheduler for rate limit management
 * - Audit store for operation logging
 * - Undo manager for reversible operations
 * - Rules cache for automation
 *
 * @example
 * ```tsx
 * const {
 *   fetchGroupDetails,
 *   removeDeprovisioned,
 *   addUsersToGroup
 * } = useOktaApi({
 *   targetTabId: activeTabId,
 *   onResult: (msg, type) => showToast(msg, type),
 *   onProgress: (current, total, msg) => updateProgress(current, total, msg)
 * });
 *
 * // Fetch group information
 * const group = await fetchGroupDetails('00g...');
 *
 * // Remove deprovisioned users with progress tracking
 * await removeDeprovisioned(groupId);
 * ```
 */

import { useState, useCallback } from 'react';
import type {
  MessageRequest,
  MessageResponse,
  OktaUser,
  UserStatus,
  AuditLogEntry,
  OktaApp,
  UserAppAssignment,
  GroupAppAssignment,
  CreateAppAssignmentRequest,
  AssignmentConversionRequest,
  AssignmentConversionResult,
  BulkAppAssignmentRequest,
  BulkAppAssignmentResult,
  AppAssignmentSecurityAnalysis,
  AssignmentRecommenderResult,
  AppProfileSchema
} from '../../shared/types';
import { logAction, logBulkRemoveAction } from '../../shared/undoManager';
import type { BulkUserInfo } from '../../shared/undoTypes';
import { auditStore } from '../../shared/storage/auditStore';
import { RulesCache } from '../../shared/rulesCache';
import { analyzeAppSecurity, getAppAssignmentRecommendations } from './useAppAnalysis';

/**
 * @typedef {Object} UseOktaApiOptions
 * @property {number|null} targetTabId - Chrome tab ID where Okta is loaded (required for API calls)
 * @property {Function} [onResult] - Callback for operation status messages
 * @property {Function} [onProgress] - Callback for progress updates during bulk operations
 */
interface UseOktaApiOptions {
  targetTabId: number | null;
  onResult?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onProgress?: (current: number, total: number, message: string, apiCalls?: number) => void;
}

/**
 * Custom React hook providing comprehensive Okta API operations.
 *
 * @function useOktaApi
 * @param {UseOktaApiOptions} options - Configuration for the hook
 * @returns {Object} API methods and state for interacting with Okta
 *
 * @description
 * This hook provides a complete suite of operations for managing Okta resources:
 *
 * **User Operations:**
 * - Fetch user details and group memberships
 * - Add/remove users from groups
 * - Update user status (activate, deactivate, suspend)
 * - Bulk user operations with progress tracking
 *
 * **Group Operations:**
 * - Fetch group details and members (with pagination)
 * - Search across multiple groups
 * - Remove deprovisioned/suspended users
 * - Bulk member management
 *
 * **Application Operations:**
 * - Fetch application assignments
 * - Create/modify/delete app assignments
 * - Convert between user and group assignments
 * - Bulk assignment operations
 * - Security analysis and recommendations
 *
 * **Features:**
 * - Automatic rate limit handling via background scheduler
 * - Progress tracking for long-running operations
 * - Comprehensive audit logging
 * - Undo support for reversible operations
 * - Operation cancellation support
 * - Error handling and retry logic
 */
export function useOktaApi({ targetTabId, onResult, onProgress }: UseOktaApiOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  // Cancel ongoing operation
  const cancelOperation = useCallback(() => {
    console.log('[useOktaApi] Cancelling operation');
    setIsCancelled(true);
    if (abortController) {
      abortController.abort();
    }
    onResult?.('Operation cancelled by user', 'warning');
  }, [abortController, onResult]);

  // Check if operation should be cancelled
  const checkCancelled = useCallback(() => {
    if (isCancelled) {
      throw new Error('Operation cancelled');
    }
  }, [isCancelled]);

  const sendMessage = useCallback(
    async <T = any>(message: MessageRequest): Promise<MessageResponse<T>> => {
      if (!targetTabId) {
        throw new Error('No target tab ID - not connected to Okta page');
      }

      console.log('[useOktaApi] Sending message:', message);
      const response = await chrome.tabs.sendMessage(targetTabId, message);
      console.log('[useOktaApi] Received response:', response);

      return response;
    },
    [targetTabId]
  );

  const makeApiRequest = useCallback(
    async (endpoint: string, method: string = 'GET', body?: any, priority: 'high' | 'normal' | 'low' = 'normal') => {
      if (!targetTabId) {
        throw new Error('No target tab ID - not connected to Okta page');
      }

      console.log('[useOktaApi] Scheduling API request via background:', { endpoint, method, priority });

      // Route through the background scheduler for rate limit control
      const response = await chrome.runtime.sendMessage({
        action: 'scheduleApiRequest',
        endpoint,
        method,
        body,
        tabId: targetTabId,
        priority,
      });

      console.log('[useOktaApi] Received scheduled response:', response);
      return response;
    },
    [targetTabId]
  );

  // Get current user for audit logging
  const getCurrentUser = useCallback(async (): Promise<{ email: string; id: string }> => {
    try {
      const response = await makeApiRequest('/api/v1/users/me');
      if (response.success && response.data) {
        return {
          email: response.data.profile?.email || 'unknown@unknown.com',
          id: response.data.id || 'unknown',
        };
      }
      return { email: 'unknown@unknown.com', id: 'unknown' };
    } catch (error) {
      console.error('[useOktaApi] Failed to get current user:', error);
      return { email: 'unknown@unknown.com', id: 'unknown' };
    }
  }, [makeApiRequest]);

  const getAllGroupMembers = useCallback(
    async (groupId: string): Promise<OktaUser[]> => {
      const allMembers: OktaUser[] = [];
      let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
      let pageCount = 0;

      while (nextUrl) {
        pageCount++;
        onResult?.(`Fetching page ${pageCount}...`, 'info');

        const response = await makeApiRequest(nextUrl);

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch group members');
        }

        const pageMembers = response.data || [];
        allMembers.push(...pageMembers);

        onResult?.(
          `Page ${pageCount}: Loaded ${pageMembers.length} members (Total: ${allMembers.length})`,
          'info'
        );

        // Parse next link from headers
        nextUrl = null;
        if (response.headers?.link) {
          const links = response.headers.link.split(',');
          for (const link of links) {
            if (link.includes('rel="next"')) {
              const match = link.match(/<([^>]+)>/);
              if (match) {
                const fullUrl = new URL(match[1]);
                nextUrl = fullUrl.pathname + fullUrl.search;
                break;
              }
            }
          }
        }
      }

      onResult?.(`Loaded ${allMembers.length} total members`, 'success');
      return allMembers;
    },
    [makeApiRequest, onResult]
  );

  const removeUserFromGroup = useCallback(
    async (groupId: string, groupName: string, user: OktaUser, skipUndoLog = false) => {
      const result = await makeApiRequest(`/api/v1/groups/${groupId}/users/${user.id}`, 'DELETE');

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
    },
    [makeApiRequest]
  );

  const removeDeprovisioned = useCallback(
    async (groupId: string) => {
      const startTime = Date.now();
      let currentUser: { email: string; id: string } | null = null;
      let groupName = 'Unknown Group';
      let removed = 0;
      let failed = 0;
      let apiCallsMade = 0;
      const errorMessages: string[] = [];
      const affectedUserIds: string[] = [];
      const removedUsers: BulkUserInfo[] = []; // Collect for bulk undo

      try {
        // Reset cancellation state and create new controller
        setIsCancelled(false);
        const controller = new AbortController();
        setAbortController(controller);

        setIsLoading(true);
        onResult?.('Starting: Remove deprovisioned users', 'info');
        onProgress?.(0, 100, 'Fetching user info...', 0);

        // Get current user for audit logging
        currentUser = await getCurrentUser();
        apiCallsMade++;

        checkCancelled(); // Check if cancelled

        // Check group type
        onProgress?.(0, 100, 'Checking group type...', apiCallsMade);
        const groupDetails = await makeApiRequest(`/api/v1/groups/${groupId}`);
        apiCallsMade++;
        if (groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
          onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
          return;
        }

        groupName = groupDetails.data?.profile?.name || 'Unknown Group';

        checkCancelled(); // Check if cancelled

        // Fetch all members with progress tracking
        onProgress?.(0, 100, 'Fetching group members...', apiCallsMade);
        const allMembers: OktaUser[] = [];
        let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
        let pageCount = 0;

        while (nextUrl) {
          pageCount++;
          onResult?.(`Fetching page ${pageCount}...`, 'info');

          const response = await makeApiRequest(nextUrl);
          apiCallsMade++;
          onProgress?.(0, 100, `Fetching members (page ${pageCount})...`, apiCallsMade);

          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch group members');
          }

          const pageMembers = response.data || [];
          allMembers.push(...pageMembers);

          onResult?.(
            `Page ${pageCount}: Loaded ${pageMembers.length} members (Total: ${allMembers.length})`,
            'info'
          );

          // Parse next link from headers
          nextUrl = null;
          if (response.headers?.link) {
            const links = response.headers.link.split(',');
            for (const link of links) {
              if (link.includes('rel="next"')) {
                const match = link.match(/<([^>]+)>/);
                if (match) {
                  const fullUrl = new URL(match[1]);
                  nextUrl = fullUrl.pathname + fullUrl.search;
                  break;
                }
              }
            }
          }
        }

        const deprovisionedUsers = allMembers.filter((u) => u.status === 'DEPROVISIONED');

        onResult?.(`Found ${deprovisionedUsers.length} deprovisioned users`, 'warning');

        if (deprovisionedUsers.length === 0) {
          onResult?.('No deprovisioned users to remove', 'success');
          return;
        }

        // Calculate total API calls: fetch phase + removal phase
        const totalApiCalls = apiCallsMade + deprovisionedUsers.length;

        // Remove each deprovisioned user
        for (let i = 0; i < deprovisionedUsers.length; i++) {
          checkCancelled(); // Check if cancelled before each iteration

          const user = deprovisionedUsers[i];
          affectedUserIds.push(user.id);

          const currentApiCall = apiCallsMade + i + 1;
          onProgress?.(currentApiCall, totalApiCalls, `Removing ${user.profile.firstName} ${user.profile.lastName} (${i + 1}/${deprovisionedUsers.length})`, currentApiCall);

          // Skip individual undo logging - we'll log a bulk action at the end
          const result = await removeUserFromGroup(groupId, groupName, user, true);

          if (result.success) {
            removed++;
            // Collect for bulk undo
            removedUsers.push({
              userId: user.id,
              userEmail: user.profile.email,
              userName: `${user.profile.firstName} ${user.profile.lastName}`,
            });
            onResult?.(
              `Removed: ${user.profile.login} (${user.profile.firstName} ${user.profile.lastName})`,
              'success'
            );
          } else {
            failed++;
            const errorMsg = `Failed: ${user.profile.login} - ${result.error}`;
            errorMessages.push(errorMsg);
            if (result.status === 403) {
              onResult?.(`403 Forbidden: ${user.profile.login} - ${result.error}`, 'error');
              onResult?.('Stopping after first 403 error', 'warning');
              break;
            } else {
              onResult?.(errorMsg, 'error');
            }
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        apiCallsMade += deprovisionedUsers.length;

        // Log a single bulk undo action for all removed users
        if (removedUsers.length > 0) {
          await logBulkRemoveAction(groupId, groupName, removedUsers, 'deprovisioned');
        }

        onResult?.(`Complete: ${removed} removed, ${failed} failed`, removed > 0 ? 'success' : 'warning');
      } catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorMessages.push(errorMsg);
        onResult?.(errorMsg, error instanceof Error && error.message === 'Operation cancelled' ? 'warning' : 'error');
      } finally {
        setIsLoading(false);
        setAbortController(null);
        setIsCancelled(false);
        onProgress?.(apiCallsMade, apiCallsMade, 'Complete', apiCallsMade);

        // Log to audit trail (fire-and-forget)
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
    },
    [makeApiRequest, removeUserFromGroup, getCurrentUser, onResult, onProgress, checkCancelled]
  );

  const smartCleanup = useCallback(
    async (groupId: string) => {
      const startTime = Date.now();
      let currentUser: { email: string; id: string } | null = null;
      let groupName = 'Unknown Group';
      let removed = 0;
      let failed = 0;
      let apiCallsMade = 0;
      const errorMessages: string[] = [];
      const affectedUserIds: string[] = [];
      const removedUsers: BulkUserInfo[] = []; // Collect for bulk undo

      try {
        // Reset cancellation state and create new controller
        setIsCancelled(false);
        const controller = new AbortController();
        setAbortController(controller);

        setIsLoading(true);
        onResult?.('Starting: Smart Cleanup (remove all inactive users)', 'info');
        onProgress?.(0, 100, 'Fetching user info...', 0);

        // Get current user for audit logging
        currentUser = await getCurrentUser();
        apiCallsMade++;

        checkCancelled(); // Check if cancelled

        // Check group type
        onProgress?.(0, 100, 'Checking group type...', apiCallsMade);
        const groupDetails = await makeApiRequest(`/api/v1/groups/${groupId}`);
        apiCallsMade++;
        if (groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
          onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
          return;
        }

        groupName = groupDetails.data?.profile?.name || 'Unknown Group';

        checkCancelled(); // Check if cancelled

        // Fetch all members with progress tracking
        onProgress?.(0, 100, 'Fetching group members...', apiCallsMade);
        const allMembers: OktaUser[] = [];
        let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
        let pageCount = 0;

        while (nextUrl) {
          pageCount++;
          onResult?.(`Fetching page ${pageCount}...`, 'info');

          const response = await makeApiRequest(nextUrl);
          apiCallsMade++;
          onProgress?.(0, 100, `Fetching members (page ${pageCount})...`, apiCallsMade);

          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch group members');
          }

          const pageMembers = response.data || [];
          allMembers.push(...pageMembers);

          // Parse next link from headers
          nextUrl = null;
          if (response.headers?.link) {
            const links = response.headers.link.split(',');
            for (const link of links) {
              if (link.includes('rel="next"')) {
                const match = link.match(/<([^>]+)>/);
                if (match) {
                  const fullUrl = new URL(match[1]);
                  nextUrl = fullUrl.pathname + fullUrl.search;
                  break;
                }
              }
            }
          }
        }

        const inactiveStatuses: UserStatus[] = ['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT'];
        const inactiveUsers = allMembers.filter((u) => inactiveStatuses.includes(u.status));

        onResult?.(`Found ${inactiveUsers.length} inactive users`, 'warning');

        if (inactiveUsers.length === 0) {
          onResult?.('No inactive users to remove', 'success');
          return;
        }

        // Show breakdown
        inactiveStatuses.forEach((status) => {
          const count = inactiveUsers.filter((u) => u.status === status).length;
          if (count > 0) {
            onResult?.(`- ${status}: ${count} users`, 'info');
          }
        });

        // Calculate total API calls: fetch phase + removal phase
        const totalApiCalls = apiCallsMade + inactiveUsers.length;

        // Remove each inactive user
        for (let i = 0; i < inactiveUsers.length; i++) {
          checkCancelled(); // Check if cancelled before each iteration

          const user = inactiveUsers[i];
          affectedUserIds.push(user.id);

          const currentApiCall = apiCallsMade + i + 1;
          onProgress?.(currentApiCall, totalApiCalls, `Removing ${user.profile.firstName} ${user.profile.lastName} (${i + 1}/${inactiveUsers.length})`, currentApiCall);

          // Skip individual undo logging - we'll log a bulk action at the end
          const result = await removeUserFromGroup(groupId, groupName, user, true);

          if (result.success) {
            removed++;
            // Collect for bulk undo
            removedUsers.push({
              userId: user.id,
              userEmail: user.profile.email,
              userName: `${user.profile.firstName} ${user.profile.lastName}`,
            });
            onResult?.(`Removed: ${user.profile.login} (${user.status})`, 'success');
          } else {
            failed++;
            const errorMsg = `Failed: ${user.profile.login} - ${result.error}`;
            errorMessages.push(errorMsg);
            if (result.status === 403) {
              onResult?.('403 Forbidden - stopping', 'error');
              break;
            } else {
              onResult?.(errorMsg, 'error');
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        apiCallsMade += inactiveUsers.length;

        // Log a single bulk undo action for all removed users
        if (removedUsers.length > 0) {
          await logBulkRemoveAction(groupId, groupName, removedUsers, 'inactive');
        }

        onResult?.(`Smart Cleanup complete: ${removed} removed, ${failed} failed`, 'success');
      } catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorMessages.push(errorMsg);
        onResult?.(errorMsg, error instanceof Error && error.message === 'Operation cancelled' ? 'warning' : 'error');
      } finally {
        setIsLoading(false);
        setAbortController(null);
        setIsCancelled(false);
        onProgress?.(apiCallsMade, apiCallsMade, 'Complete', apiCallsMade);

        // Log to audit trail (fire-and-forget)
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
    },
    [makeApiRequest, removeUserFromGroup, getCurrentUser, onResult, onProgress, checkCancelled]
  );

  const customFilter = useCallback(
    async (groupId: string, targetStatus: UserStatus, action: 'list' | 'remove') => {
      const startTime = Date.now();
      let currentUser: { email: string; id: string } | null = null;
      let groupName = 'Unknown Group';
      let removed = 0;
      let failed = 0;
      let apiCallsMade = 0;
      const errorMessages: string[] = [];
      const affectedUserIds: string[] = [];
      const removedUsers: BulkUserInfo[] = []; // Collect for bulk undo

      try {
        // Reset cancellation state and create new controller
        setIsCancelled(false);
        const controller = new AbortController();
        setAbortController(controller);

        setIsLoading(true);
        onResult?.(`Starting: ${action === 'remove' ? 'Remove' : 'List'} users with status ${targetStatus}`, 'info');
        onProgress?.(0, 100, 'Fetching user info...', 0);

        // Get current user for audit logging
        currentUser = await getCurrentUser();
        apiCallsMade++;

        checkCancelled(); // Check if cancelled

        // Check group type
        onProgress?.(0, 100, 'Checking group type...', apiCallsMade);
        const groupDetails = await makeApiRequest(`/api/v1/groups/${groupId}`);
        apiCallsMade++;
        if (action === 'remove' && groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
          onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
          return;
        }

        groupName = groupDetails.data?.profile?.name || 'Unknown Group';

        checkCancelled(); // Check if cancelled

        // Fetch all members with progress tracking
        onProgress?.(0, 100, 'Fetching group members...', apiCallsMade);
        const allMembers: OktaUser[] = [];
        let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
        let pageCount = 0;

        while (nextUrl) {
          pageCount++;
          onResult?.(`Fetching page ${pageCount}...`, 'info');

          const response = await makeApiRequest(nextUrl);
          apiCallsMade++;
          onProgress?.(0, 100, `Fetching members (page ${pageCount})...`, apiCallsMade);

          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch group members');
          }

          const pageMembers = response.data || [];
          allMembers.push(...pageMembers);

          // Parse next link from headers
          nextUrl = null;
          if (response.headers?.link) {
            const links = response.headers.link.split(',');
            for (const link of links) {
              if (link.includes('rel="next"')) {
                const match = link.match(/<([^>]+)>/);
                if (match) {
                  const fullUrl = new URL(match[1]);
                  nextUrl = fullUrl.pathname + fullUrl.search;
                  break;
                }
              }
            }
          }
        }

        const filteredUsers = allMembers.filter((u) => u.status === targetStatus);

        onResult?.(`Found ${filteredUsers.length} users with status ${targetStatus}`, 'warning');

        if (filteredUsers.length === 0) {
          onResult?.(`No users with status ${targetStatus}`, 'success');
          return;
        }

        if (action === 'list') {
          filteredUsers.forEach((user) => {
            onResult?.(
              `${user.profile.login} - ${user.profile.firstName} ${user.profile.lastName}`,
              'info'
            );
          });
          onResult?.(`Listed ${filteredUsers.length} users`, 'success');
        } else {
          // Calculate total API calls: fetch phase + removal phase
          const totalApiCalls = apiCallsMade + filteredUsers.length;

          for (let i = 0; i < filteredUsers.length; i++) {
            checkCancelled(); // Check if cancelled before each iteration

            const user = filteredUsers[i];
            affectedUserIds.push(user.id);

            const currentApiCall = apiCallsMade + i + 1;
            onProgress?.(currentApiCall, totalApiCalls, `Removing ${user.profile.firstName} ${user.profile.lastName} (${i + 1}/${filteredUsers.length})`, currentApiCall);

            // Skip individual undo logging - we'll log a bulk action at the end
            const result = await removeUserFromGroup(groupId, groupName, user, true);
            if (result.success) {
              removed++;
              // Collect for bulk undo
              removedUsers.push({
                userId: user.id,
                userEmail: user.profile.email,
                userName: `${user.profile.firstName} ${user.profile.lastName}`,
              });
              onResult?.(`Removed: ${user.profile.login}`, 'success');
            } else {
              failed++;
              const errorMsg = `Failed: ${user.profile.login} - ${result.error}`;
              errorMessages.push(errorMsg);
              if (result.status === 403) {
                onResult?.(`403 Forbidden: ${user.profile.login} - ${result.error}`, 'error');
                onResult?.('Stopping after first 403 error', 'warning');
                break;
              } else {
                onResult?.(errorMsg, 'error');
              }
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          apiCallsMade += filteredUsers.length;

          // Log a single bulk undo action for all removed users
          if (removedUsers.length > 0) {
            await logBulkRemoveAction(groupId, groupName, removedUsers, 'custom_status', targetStatus);
          }

          onResult?.(`Removed ${removed} users`, 'success');
        }
      } catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorMessages.push(errorMsg);
        onResult?.(errorMsg, error instanceof Error && error.message === 'Operation cancelled' ? 'warning' : 'error');
      } finally {
        setIsLoading(false);
        setAbortController(null);
        setIsCancelled(false);
        onProgress?.(apiCallsMade, apiCallsMade, 'Complete', apiCallsMade);

        // Log to audit trail (fire-and-forget) - only for remove actions
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
    },
    [makeApiRequest, removeUserFromGroup, getCurrentUser, onResult, onProgress, checkCancelled]
  );

  /**
   * Custom filter for multiple statuses - allows selecting multiple user statuses to list or remove
   */
  const customFilterMultiple = useCallback(
    async (groupId: string, targetStatuses: UserStatus[], action: 'list' | 'remove') => {
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
        // Reset cancellation state and create new controller
        setIsCancelled(false);
        const controller = new AbortController();
        setAbortController(controller);

        setIsLoading(true);
        const statusLabel = targetStatuses.join(', ');
        onResult?.(`Starting: ${action === 'remove' ? 'Remove' : 'List'} users with statuses: ${statusLabel}`, 'info');
        onProgress?.(0, 100, 'Fetching user info...', 0);

        // Get current user for audit logging
        currentUser = await getCurrentUser();
        apiCallsMade++;

        checkCancelled();

        // Check group type
        onProgress?.(0, 100, 'Checking group type...', apiCallsMade);
        const groupDetails = await makeApiRequest(`/api/v1/groups/${groupId}`);
        apiCallsMade++;
        if (action === 'remove' && groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
          onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
          return;
        }

        groupName = groupDetails.data?.profile?.name || 'Unknown Group';

        checkCancelled();

        // Fetch all members with progress tracking
        onProgress?.(0, 100, 'Fetching group members...', apiCallsMade);
        const allMembers: OktaUser[] = [];
        let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;
        let pageCount = 0;

        while (nextUrl) {
          pageCount++;
          onResult?.(`Fetching page ${pageCount}...`, 'info');

          const response = await makeApiRequest(nextUrl);
          apiCallsMade++;
          onProgress?.(0, 100, `Fetching members (page ${pageCount})...`, apiCallsMade);

          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch group members');
          }

          const pageMembers = response.data || [];
          allMembers.push(...pageMembers);

          // Parse next link from headers
          nextUrl = null;
          if (response.headers?.link) {
            const links = response.headers.link.split(',');
            for (const link of links) {
              if (link.includes('rel="next"')) {
                const match = link.match(/<([^>]+)>/);
                if (match) {
                  const fullUrl = new URL(match[1]);
                  nextUrl = fullUrl.pathname + fullUrl.search;
                  break;
                }
              }
            }
          }
        }

        // Filter users matching any of the target statuses
        const filteredUsers = allMembers.filter((u) => targetStatuses.includes(u.status));

        onResult?.(`Found ${filteredUsers.length} users matching statuses: ${statusLabel}`, 'warning');

        // Show breakdown by status
        targetStatuses.forEach((status) => {
          const count = filteredUsers.filter((u) => u.status === status).length;
          if (count > 0) {
            onResult?.(`- ${status}: ${count} users`, 'info');
          }
        });

        if (filteredUsers.length === 0) {
          onResult?.(`No users with statuses: ${statusLabel}`, 'success');
          return;
        }

        if (action === 'list') {
          filteredUsers.forEach((user) => {
            onResult?.(
              `[${user.status}] ${user.profile.login} - ${user.profile.firstName} ${user.profile.lastName}`,
              'info'
            );
          });
          onResult?.(`Listed ${filteredUsers.length} users`, 'success');
        } else {
          // Calculate total API calls: fetch phase + removal phase
          const totalApiCalls = apiCallsMade + filteredUsers.length;

          for (let i = 0; i < filteredUsers.length; i++) {
            checkCancelled();

            const user = filteredUsers[i];
            affectedUserIds.push(user.id);

            const currentApiCall = apiCallsMade + i + 1;
            onProgress?.(currentApiCall, totalApiCalls, `Removing ${user.profile.firstName} ${user.profile.lastName} (${i + 1}/${filteredUsers.length})`, currentApiCall);

            // Skip individual undo logging
            const result = await removeUserFromGroup(groupId, groupName, user, true);
            if (result.success) {
              removed++;
              removedUsers.push({
                userId: user.id,
                userEmail: user.profile.email,
                userName: `${user.profile.firstName} ${user.profile.lastName}`,
              });
              onResult?.(`Removed: ${user.profile.login} (${user.status})`, 'success');
            } else {
              failed++;
              const errorMsg = `Failed: ${user.profile.login} - ${result.error}`;
              errorMessages.push(errorMsg);
              if (result.status === 403) {
                onResult?.(`403 Forbidden: ${user.profile.login} - ${result.error}`, 'error');
                onResult?.('Stopping after first 403 error', 'warning');
                break;
              } else {
                onResult?.(errorMsg, 'error');
              }
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          apiCallsMade += filteredUsers.length;

          // Log a single bulk undo action for all removed users
          if (removedUsers.length > 0) {
            await logBulkRemoveAction(groupId, groupName, removedUsers, 'multi_status', targetStatuses.join(','));
          }

          onResult?.(`Removed ${removed} users, ${failed} failed`, removed > 0 ? 'success' : 'warning');
        }
      } catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorMessages.push(errorMsg);
        onResult?.(errorMsg, error instanceof Error && error.message === 'Operation cancelled' ? 'warning' : 'error');
      } finally {
        setIsLoading(false);
        setAbortController(null);
        setIsCancelled(false);
        onProgress?.(apiCallsMade, apiCallsMade, 'Complete', apiCallsMade);

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
    },
    [makeApiRequest, removeUserFromGroup, getCurrentUser, onResult, onProgress, checkCancelled]
  );

  const exportMembers = useCallback(
    async (groupId: string, groupName: string, format: 'csv' | 'json', statusFilter?: UserStatus | '') => {
      const startTime = Date.now();
      let currentUser: { email: string; id: string } | null = null;

      try {
        setIsLoading(true);
        onResult?.(`Starting export: ${format.toUpperCase()} format`, 'info');

        // Get current user for audit logging
        currentUser = await getCurrentUser();

        const response = await sendMessage({
          action: 'exportGroupMembers',
          groupId,
          groupName,
          format,
          statusFilter,
        });

        if (response.success) {
          onResult?.(`Export complete: ${response.count} members exported`, 'success');

          // Log to audit trail (fire-and-forget)
          if (currentUser) {
            const auditEntry: AuditLogEntry = {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              action: 'export',
              groupId,
              groupName,
              performedBy: currentUser.email,
              affectedUsers: [], // No users are modified in export
              result: 'success',
              details: {
                usersSucceeded: response.count || 0,
                usersFailed: 0,
                apiRequestCount: 1,
                durationMs: Date.now() - startTime,
              },
            };
            auditStore.logOperation(auditEntry).catch((err) => {
              console.error('[useOktaApi] Failed to log audit entry:', err);
            });
          }
        } else {
          onResult?.(`Export failed: ${response.error}`, 'error');

          // Log failure to audit trail
          if (currentUser) {
            const auditEntry: AuditLogEntry = {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              action: 'export',
              groupId,
              groupName,
              performedBy: currentUser.email,
              affectedUsers: [],
              result: 'failed',
              details: {
                usersSucceeded: 0,
                usersFailed: 0,
                apiRequestCount: 1,
                durationMs: Date.now() - startTime,
                errorMessages: [response.error || 'Unknown error'],
              },
            };
            auditStore.logOperation(auditEntry).catch((err) => {
              console.error('[useOktaApi] Failed to log audit entry:', err);
            });
          }
        }
      } catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        onResult?.(errorMsg, 'error');

        // Log error to audit trail
        if (currentUser) {
          const auditEntry: AuditLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action: 'export',
            groupId,
            groupName,
            performedBy: currentUser.email,
            affectedUsers: [],
            result: 'failed',
            details: {
              usersSucceeded: 0,
              usersFailed: 0,
              apiRequestCount: 1,
              durationMs: Date.now() - startTime,
              errorMessages: [errorMsg],
            },
          };
          auditStore.logOperation(auditEntry).catch((err) => {
            console.error('[useOktaApi] Failed to log audit entry:', err);
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [sendMessage, getCurrentUser, onResult]
  );

  // Security Analysis API calls
  const getUserLastLogin = useCallback(
    async (userId: string): Promise<Date | null> => {
      try {
        const response = await makeApiRequest(`/api/v1/users/${userId}`);
        if (response.success && response.data?.lastLogin) {
          return new Date(response.data.lastLogin);
        }
        return null;
      } catch (error) {
        console.error(`[useOktaApi] Failed to get last login for user ${userId}:`, error);
        return null;
      }
    },
    [makeApiRequest]
  );

  const getUserAppAssignments = useCallback(
    async (userId: string): Promise<number> => {
      try {
        // Fetch first page with limit=200 to get app assignments count
        // Note: Okta API doesn't provide x-total-count header
        const response = await makeApiRequest(`/api/v1/apps?filter=user.id+eq+"${userId}"&limit=200`);
        if (response.success && response.data) {
          const firstPageCount = response.data.length;

          // Check if there are more pages by looking for Link header with rel="next"
          const linkHeader = response.headers?.['link'] || response.headers?.['Link'];
          const hasMorePages = linkHeader && linkHeader.includes('rel="next"');

          if (hasMorePages) {
            // If there are more pages, we need to fetch all to get accurate count
            // For now, return the first page count as minimum
            return firstPageCount;
          }

          return firstPageCount;
        }
        return 0;
      } catch (error) {
        console.error(`[useOktaApi] Failed to get app assignments for user ${userId}:`, error);
        return 0;
      }
    },
    [makeApiRequest]
  );

  const batchGetUserDetails = useCallback(
    async (userIds: string[], onProgress?: (current: number, total: number) => void): Promise<Map<string, any>> => {
      const userDetailsMap = new Map<string, any>();
      const batchSize = 10; // Process 10 users concurrently

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (userId) => {
          try {
            const response = await makeApiRequest(`/api/v1/users/${userId}`);
            if (response.success && response.data) {
              return { userId, data: response.data };
            }
            return { userId, data: null };
          } catch (error) {
            console.error(`[useOktaApi] Failed to fetch user ${userId}:`, error);
            return { userId, data: null };
          }
        });

        const results = await Promise.all(batchPromises);
        results.forEach(({ userId, data }) => {
          if (data) {
            userDetailsMap.set(userId, data);
          }
        });

        onProgress?.(Math.min(i + batchSize, userIds.length), userIds.length);

        // Rate limiting - small delay between batches
        if (i + batchSize < userIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      return userDetailsMap;
    },
    [makeApiRequest]
  );

  const getUserGroupMemberships = useCallback(
    async (userId: string): Promise<number> => {
      try {
        const response = await makeApiRequest(`/api/v1/users/${userId}/groups?limit=1`);
        if (response.success && response.headers?.['x-total-count']) {
          return parseInt(response.headers['x-total-count'], 10);
        }
        // If we can't get the count from headers, we'd need to paginate - return 0 for now
        return 0;
      } catch (error) {
        console.error(`[useOktaApi] Failed to get group memberships for user ${userId}:`, error);
        return 0;
      }
    },
    [makeApiRequest]
  );

  /**
   * Search for users by name, email, or login
   */
  const searchUsers = useCallback(
    async (query: string): Promise<Array<{ id: string; email: string; firstName: string; lastName: string; login: string; status: string }>> => {
      if (!query || query.length < 2) {
        return [];
      }

      try {
        // Use Okta's search API with the q parameter for flexible search
        const response = await makeApiRequest(`/api/v1/users?q=${encodeURIComponent(query)}&limit=20`);

        if (response.success && response.data) {
          return response.data.map((user: any) => ({
            id: user.id,
            email: user.profile?.email || '',
            firstName: user.profile?.firstName || '',
            lastName: user.profile?.lastName || '',
            login: user.profile?.login || '',
            status: user.status || 'UNKNOWN',
          }));
        }
        return [];
      } catch (error) {
        console.error('[useOktaApi] searchUsers error:', error);
        return [];
      }
    },
    [makeApiRequest]
  );

  /**
   * Search for groups by name
   */
  const searchGroups = useCallback(
    async (query: string): Promise<Array<{ id: string; name: string; description: string; type: string }>> => {
      if (!query || query.length < 2) {
        return [];
      }

      try {
        // Use the Okta q parameter for flexible search
        const response = await makeApiRequest(`/api/v1/groups?q=${encodeURIComponent(query)}&limit=20`);

        if (response.success && response.data) {
          return response.data.map((group: any) => ({
            id: group.id,
            name: group.profile?.name || group.id,
            description: group.profile?.description || '',
            type: group.type || 'OKTA_GROUP',
          }));
        }
        return [];
      } catch (error) {
        console.error('[useOktaApi] searchGroups error:', error);
        return [];
      }
    },
    [makeApiRequest]
  );

  /**
   * Get user details by ID
   */
  const getUserById = useCallback(
    async (userId: string): Promise<{ id: string; email: string; firstName: string; lastName: string; login: string; status: string } | null> => {
      try {
        const response = await makeApiRequest(`/api/v1/users/${userId}`);
        if (response.success && response.data) {
          const user = response.data;
          return {
            id: user.id,
            email: user.profile?.email || '',
            firstName: user.profile?.firstName || '',
            lastName: user.profile?.lastName || '',
            login: user.profile?.login || '',
            status: user.status || 'UNKNOWN',
          };
        }
        return null;
      } catch (error) {
        console.error('[useOktaApi] getUserById error:', error);
        return null;
      }
    },
    [makeApiRequest]
  );

  /**
   * Get group details by ID
   */
  const getGroupById = useCallback(
    async (groupId: string): Promise<{ id: string; name: string; description: string; type: string } | null> => {
      try {
        const response = await makeApiRequest(`/api/v1/groups/${groupId}`);
        if (response.success && response.data) {
          const group = response.data;
          return {
            id: group.id,
            name: group.profile?.name || group.id,
            description: group.profile?.description || '',
            type: group.type || 'OKTA_GROUP',
          };
        }
        return null;
      } catch (error) {
        console.error('[useOktaApi] getGroupById error:', error);
        return null;
      }
    },
    [makeApiRequest]
  );

  // Multi-Group Operations
  const getAllGroups = useCallback(
    async (onProgress?: (loaded: number, total: number) => void): Promise<any[]> => {
      const allGroups: any[] = [];
      let nextUrl: string | null = '/api/v1/groups?limit=200&expand=stats';

      while (nextUrl) {
        const response = await makeApiRequest(nextUrl);

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch groups');
        }

        const pageGroups = response.data || [];
        allGroups.push(...pageGroups);

        onProgress?.(allGroups.length, allGroups.length);

        // Parse next link from headers
        nextUrl = null;
        if (response.headers?.link) {
          const links = response.headers.link.split(',');
          for (const link of links) {
            if (link.includes('rel="next"')) {
              const match = link.match(/<([^>]+)>/);
              if (match) {
                const fullUrl = new URL(match[1]);
                nextUrl = fullUrl.pathname + fullUrl.search;
                break;
              }
            }
          }
        }
      }

      return allGroups;
    },
    [makeApiRequest]
  );

  const getGroupMemberCount = useCallback(
    async (groupId: string): Promise<number> => {
      try {
        // Fetch first page with limit=200 to get an approximate count
        // Okta API doesn't provide x-total-count header, so we need to check pagination
        const usersResponse = await makeApiRequest(`/api/v1/groups/${groupId}/users?limit=200`);
        if (usersResponse.success && usersResponse.data) {
          const firstPageCount = usersResponse.data.length;

          // Check if there are more pages by looking for Link header with rel="next"
          const linkHeader = usersResponse.headers?.['link'] || usersResponse.headers?.['Link'];
          const hasMorePages = linkHeader && linkHeader.includes('rel="next"');

          // If there are more pages, we know there are at least 200+ members
          // For accurate counts, we'd need to fetch all pages, but that's expensive
          // Return the first page count as a minimum estimate
          if (hasMorePages) {
            // If there's a next page, return 200+ to indicate there are more
            // The UI can show "200+" to indicate this is a lower bound
            return firstPageCount;
          }

          return firstPageCount;
        }

        return 0;
      } catch (error) {
        console.error(`[useOktaApi] Failed to get member count for group ${groupId}:`, error);
        return 0;
      }
    },
    [makeApiRequest]
  );

  const getGroupRulesForGroup = useCallback(
    async (groupId: string): Promise<any[]> => {
      try {
        // OPTIMIZED: Check cache first to avoid fetching all rules
        const cachedRules = await RulesCache.getRulesForGroup(groupId);
        if (cachedRules.length > 0 || await RulesCache.isFresh()) {
          console.log(`[useOktaApi] Using cached rules for group ${groupId}:`, cachedRules.length);
          return cachedRules;
        }

        // Cache miss - fetch all group rules
        console.log(`[useOktaApi] Cache miss - fetching all rules for group ${groupId}`);
        const response = await makeApiRequest('/api/v1/groups/rules?limit=200');
        if (!response.success) {
          return [];
        }

        const allRules = response.data || [];

        // Filter rules that target this group
        const groupRules = allRules.filter((rule: any) => {
          const targetGroupIds = rule.actions?.assignUserToGroups?.groupIds || [];
          return targetGroupIds.includes(groupId);
        });

        return groupRules;
      } catch (error) {
        console.error(`[useOktaApi] Failed to get rules for group ${groupId}:`, error);
        return [];
      }
    },
    [makeApiRequest]
  );

  const findUserAcrossGroups = useCallback(
    async (query: string): Promise<any> => {
      try {
        // Search for user
        const userResponse = await makeApiRequest(`/api/v1/users?q=${encodeURIComponent(query)}&limit=1`);
        if (!userResponse.success || !userResponse.data || userResponse.data.length === 0) {
          throw new Error('User not found');
        }

        const user = userResponse.data[0];

        // Get all groups for user
        let allGroups: any[] = [];
        let nextUrl: string | null = `/api/v1/users/${user.id}/groups?limit=200`;

        while (nextUrl) {
          const groupsResponse = await makeApiRequest(nextUrl);
          if (!groupsResponse.success) break;

          allGroups = allGroups.concat(groupsResponse.data || []);

          // Parse next link
          nextUrl = null;
          if (groupsResponse.headers?.link) {
            const links = groupsResponse.headers.link.split(',');
            for (const link of links) {
              if (link.includes('rel="next"')) {
                const match = link.match(/<([^>]+)>/);
                if (match) {
                  const fullUrl = new URL(match[1]);
                  nextUrl = fullUrl.pathname + fullUrl.search;
                  break;
                }
              }
            }
          }
        }

        return {
          user,
          groups: allGroups,
        };
      } catch (error) {
        throw new Error(`Failed to find user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [makeApiRequest]
  );

  const executeBulkOperation = useCallback(
    async (
      operation: any,
      onProgress?: (current: number, total: number, currentGroupName: string) => void
    ): Promise<any[]> => {
      const results: any[] = [];
      const totalGroups = operation.targetGroups.length;

      for (let i = 0; i < totalGroups; i++) {
        const groupId = operation.targetGroups[i];

        try {
          // Get group name
          const groupResponse = await makeApiRequest(`/api/v1/groups/${groupId}`);
          const groupName = groupResponse.data?.profile?.name || groupId;

          onProgress?.(i + 1, totalGroups, groupName);

          let result: any = { groupId, groupName, status: 'success', itemsProcessed: 0 };

          // Execute operation based on type
          switch (operation.type) {
            case 'cleanup_inactive': {
              // Get all members
              const members = await getAllGroupMembers(groupId);
              const inactiveStatuses = ['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT'];
              const inactiveUsers = members.filter((u) => inactiveStatuses.includes(u.status));

              result.itemsProcessed = inactiveUsers.length;

              // Remove inactive users
              for (const user of inactiveUsers) {
                await removeUserFromGroup(groupId, groupName, user);
                await new Promise((resolve) => setTimeout(resolve, 100));
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
                const removeResult = await makeApiRequest(
                  `/api/v1/groups/${groupId}/users/${operation.config.userId}`,
                  'DELETE'
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
          results.push({
            groupId,
            groupName: groupId,
            status: 'failed',
            itemsProcessed: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          });
        }

        // Rate limiting between groups
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      return results;
    },
    [makeApiRequest, getAllGroupMembers, removeUserFromGroup]
  );

  const compareGroups = useCallback(
    async (groupIds: string[]): Promise<any> => {
      const groupData: any[] = [];

      // Fetch members for each group
      for (const groupId of groupIds) {
        const groupResponse = await makeApiRequest(`/api/v1/groups/${groupId}`);
        const members = await getAllGroupMembers(groupId);

        groupData.push({
          id: groupId,
          name: groupResponse.data?.profile?.name || groupId,
          type: groupResponse.data?.type,
          members,
          memberIds: new Set(members.map((m: any) => m.id)),
        });
      }

      // Calculate overlaps
      const overlaps: any[] = [];
      for (let i = 0; i < groupData.length; i++) {
        for (let j = i + 1; j < groupData.length; j++) {
          const group1 = groupData[i];
          const group2 = groupData[j];

          const sharedUserIds = [...group1.memberIds].filter((id: string) => group2.memberIds.has(id));
          const uniqueToGroup1 = group1.members.length - sharedUserIds.length;
          const uniqueToGroup2 = group2.members.length - sharedUserIds.length;

          overlaps.push({
            group1: { id: group1.id, name: group1.name },
            group2: { id: group2.id, name: group2.name },
            sharedUsers: sharedUserIds.length,
            uniqueToGroup1,
            uniqueToGroup2,
          });
        }
      }

      // Calculate unique users across all groups
      const allUserIds = new Set<string>();
      groupData.forEach((g) => {
        g.members.forEach((m: any) => allUserIds.add(m.id));
      });

      return {
        totalGroups: groupData.length,
        totalUniqueUsers: allUserIds.size,
        groupData,
        overlaps,
      };
    },
    [makeApiRequest, getAllGroupMembers]
  );

  // ========================================
  // App Assignment API Methods
  // ========================================

  /**
   * Get all apps assigned to a user (with pagination)
   * Uses /api/v1/users/{userId}/appLinks endpoint
   */
  const getUserApps = useCallback(
    async (userId: string, expand?: boolean): Promise<UserAppAssignment[]> => {
      console.log('[useOktaApi] getUserApps called with userId:', userId, 'expand:', expand);
      try {
        const allApps: UserAppAssignment[] = [];
        // Use the correct endpoint for user app links
        let nextUrl: string | null = `/api/v1/users/${userId}/appLinks`;
        console.log('[useOktaApi] getUserApps URL:', nextUrl);

        while (nextUrl) {
          const response = await makeApiRequest(nextUrl);
          console.log('[useOktaApi] getUserApps response:', response.success, 'data length:', response.data?.length);
          if (response.success && response.data) {
            const appLinks = Array.isArray(response.data) ? response.data : [response.data];

            // appLinks returns basic info, we need to fetch full app details if expand is true
            for (const link of appLinks) {
              if (expand && link.appInstanceId) {
                // Fetch full app details including assignment profile
                try {
                  const appResponse = await makeApiRequest(`/api/v1/apps/${link.appInstanceId}/users/${userId}`);
                  if (appResponse.success && appResponse.data) {
                    // Merge appLink data with user assignment data
                    allApps.push({
                      id: appResponse.data.id || link.appInstanceId,
                      appId: link.appInstanceId,
                      scope: 'USER' as const,
                      created: appResponse.data.created || new Date().toISOString(),
                      lastUpdated: appResponse.data.lastUpdated || new Date().toISOString(),
                      status: appResponse.data.status || 'ACTIVE',
                      profile: appResponse.data.profile || {},
                      credentials: appResponse.data.credentials,
                      _embedded: {
                        app: {
                          id: link.appInstanceId,
                          label: link.label,
                          name: link.appName,
                        } as any
                      }
                    });
                  }
                } catch {
                  // If we can't get details, still include basic info
                  allApps.push({
                    id: link.appInstanceId,
                    appId: link.appInstanceId,
                    scope: 'USER' as const,
                    created: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    status: 'ACTIVE',
                    profile: {},
                    _embedded: {
                      app: {
                        id: link.appInstanceId,
                        label: link.label,
                        name: link.appName,
                      } as any
                    }
                  });
                }
              } else {
                // Basic info only
                allApps.push({
                  id: link.appInstanceId,
                  appId: link.appInstanceId,
                  scope: 'USER' as const,
                  created: new Date().toISOString(),
                  lastUpdated: new Date().toISOString(),
                  status: 'ACTIVE',
                  profile: {},
                  _embedded: {
                    app: {
                      id: link.appInstanceId,
                      label: link.label,
                      name: link.appName,
                    } as any
                  }
                });
              }
            }

            // Check for next page using Link header
            const linkHeader = response.headers?.['link'] || response.headers?.['Link'];
            if (linkHeader && linkHeader.includes('rel="next"')) {
              const links = linkHeader.split(',');
              for (const link of links) {
                if (link.includes('rel="next"')) {
                  const match = link.match(/<([^>]+)>/);
                  if (match) {
                    const fullUrl = new URL(match[1]);
                    nextUrl = fullUrl.pathname + fullUrl.search;
                    break;
                  }
                }
              }
              if (!nextUrl || nextUrl === `/api/v1/users/${userId}/appLinks`) {
                nextUrl = null;
              }
            } else {
              nextUrl = null;
            }
          } else {
            break;
          }
        }

        console.log('[useOktaApi] getUserApps returning', allApps.length, 'apps');
        return allApps;
      } catch (error) {
        console.error(`[useOktaApi] Failed to get apps for user ${userId}:`, error);
        throw error;
      }
    },
    [makeApiRequest]
  );

  /**
   * Get all apps assigned to a group (with pagination)
   */
  const getGroupApps = useCallback(
    async (groupId: string, expand?: boolean): Promise<GroupAppAssignment[]> => {
      try {
        const allApps: GroupAppAssignment[] = [];
        const expandParam = expand ? '?expand=app' : '';
        let nextUrl: string | null = `/api/v1/groups/${groupId}/apps${expandParam}`;
        const initialUrl = nextUrl;

        while (nextUrl) {
          const response = await makeApiRequest(nextUrl);
          if (response.success && response.data) {
            const apps = Array.isArray(response.data) ? response.data : [response.data];
            allApps.push(...apps);

            // Check for next page using Link header
            const linkHeader = response.headers?.['link'] || response.headers?.['Link'];
            if (linkHeader && linkHeader.includes('rel="next"')) {
              // Parse the Link header to extract the next URL
              const links = linkHeader.split(',');
              nextUrl = null;
              for (const link of links) {
                if (link.includes('rel="next"')) {
                  const match = link.match(/<([^>]+)>/);
                  if (match) {
                    const fullUrl = new URL(match[1]);
                    nextUrl = fullUrl.pathname + fullUrl.search;
                    break;
                  }
                }
              }
              // Prevent infinite loops
              if (nextUrl === initialUrl) {
                nextUrl = null;
              }
            } else {
              nextUrl = null;
            }
          } else {
            break;
          }
        }

        return allApps;
      } catch (error) {
        console.error(`[useOktaApi] Failed to get apps for group ${groupId}:`, error);
        throw error;
      }
    },
    [makeApiRequest]
  );

  /**
   * Get a specific user's assignment to an app
   */
  const getUserAppAssignment = useCallback(
    async (appId: string, userId: string): Promise<UserAppAssignment | null> => {
      try {
        const response = await makeApiRequest(`/api/v1/apps/${appId}/users/${userId}`);
        if (response.success && response.data) {
          return { ...response.data, scope: 'USER' as const };
        }
        return null;
      } catch (error) {
        console.error(`[useOktaApi] Failed to get user assignment for app ${appId}, user ${userId}:`, error);
        return null;
      }
    },
    [makeApiRequest]
  );

  /**
   * Get a specific group's assignment to an app
   */
  const getGroupAppAssignment = useCallback(
    async (appId: string, groupId: string): Promise<GroupAppAssignment | null> => {
      try {
        const response = await makeApiRequest(`/api/v1/apps/${appId}/groups/${groupId}`);
        if (response.success && response.data) {
          return { ...response.data, scope: 'GROUP' as const };
        }
        return null;
      } catch (error) {
        console.error(`[useOktaApi] Failed to get group assignment for app ${appId}, group ${groupId}:`, error);
        return null;
      }
    },
    [makeApiRequest]
  );

  /**
   * Get app details including schema
   */
  const getAppDetails = useCallback(
    async (appId: string, includeSchema: boolean = false): Promise<{ app: OktaApp; schema?: AppProfileSchema }> => {
      try {
        const appResponse = await makeApiRequest(`/api/v1/apps/${appId}`);
        if (!appResponse.success || !appResponse.data) {
          throw new Error('Failed to fetch app details');
        }

        const result: { app: OktaApp; schema?: AppProfileSchema } = {
          app: appResponse.data,
        };

        if (includeSchema) {
          const schemaResponse = await makeApiRequest(`/api/v1/meta/schemas/apps/${appId}/default`);
          if (schemaResponse.success && schemaResponse.data) {
            result.schema = schemaResponse.data;
          }
        }

        return result;
      } catch (error) {
        console.error(`[useOktaApi] Failed to get app details for ${appId}:`, error);
        throw error;
      }
    },
    [makeApiRequest]
  );

  /**
   * Assign a user to an app
   */
  const assignUserToApp = useCallback(
    async (appId: string, userId: string, assignmentData?: CreateAppAssignmentRequest): Promise<UserAppAssignment> => {
      try {
        const body: any = {
          id: userId,
          scope: 'USER',
          ...(assignmentData?.profile && { profile: assignmentData.profile }),
          ...(assignmentData?.credentials && { credentials: assignmentData.credentials }),
        };

        const response = await makeApiRequest(`/api/v1/apps/${appId}/users`, 'POST', body);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to assign user to app');
        }

        // Log to audit
        const currentUser = await getCurrentUser();
        const appDetails = await getAppDetails(appId);
        await auditStore.logOperation({
          action: 'assign_user_to_app' as any,
          groupId: 'N/A',
          groupName: 'N/A',
          performedBy: currentUser.email,
          affectedUsers: [userId],
          result: 'success',
          details: {
            usersSucceeded: 1,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: 0,
          },
          appId,
          appName: appDetails.app.label,
        } as any);

        return { ...response.data, scope: 'USER' as const };
      } catch (error) {
        console.error(`[useOktaApi] Failed to assign user ${userId} to app ${appId}:`, error);
        throw error;
      }
    },
    [makeApiRequest, getCurrentUser, getAppDetails]
  );

  /**
   * Assign a group to an app
   */
  const assignGroupToApp = useCallback(
    async (appId: string, groupId: string, assignmentData?: CreateAppAssignmentRequest): Promise<GroupAppAssignment> => {
      try {
        const body: any = {
          priority: assignmentData?.priority ?? 0,
          ...(assignmentData?.profile && { profile: assignmentData.profile }),
        };

        const response = await makeApiRequest(`/api/v1/apps/${appId}/groups/${groupId}`, 'PUT', body);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to assign group to app');
        }

        // Log to audit
        const currentUser = await getCurrentUser();
        const appDetails = await getAppDetails(appId);
        const groupResponse = await makeApiRequest(`/api/v1/groups/${groupId}`);
        await auditStore.logOperation({
          action: 'assign_group_to_app' as any,
          groupId,
          groupName: groupResponse.data?.profile?.name || groupId,
          performedBy: currentUser.email,
          affectedUsers: [],
          result: 'success',
          details: {
            usersSucceeded: 0,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: 0,
          },
          appId,
          appName: appDetails.app.label,
        } as any);

        return { ...response.data, scope: 'GROUP' as const };
      } catch (error) {
        console.error(`[useOktaApi] Failed to assign group ${groupId} to app ${appId}:`, error);
        throw error;
      }
    },
    [makeApiRequest, getCurrentUser, getAppDetails]
  );

  /**
   * Remove a user from an app
   */
  const removeUserFromApp = useCallback(
    async (appId: string, userId: string): Promise<boolean> => {
      try {
        const response = await makeApiRequest(`/api/v1/apps/${appId}/users/${userId}`, 'DELETE');
        const success = response.success;

        // Log to audit
        const currentUser = await getCurrentUser();
        const appDetails = await getAppDetails(appId);
        await auditStore.logOperation({
          action: 'remove_user_from_app' as any,
          groupId: 'N/A',
          groupName: 'N/A',
          performedBy: currentUser.email,
          affectedUsers: [userId],
          result: success ? 'success' : 'failed',
          details: {
            usersSucceeded: success ? 1 : 0,
            usersFailed: success ? 0 : 1,
            apiRequestCount: 1,
            durationMs: 0,
          },
          appId,
          appName: appDetails.app.label,
        } as any);

        return success;
      } catch (error) {
        console.error(`[useOktaApi] Failed to remove user ${userId} from app ${appId}:`, error);
        throw error;
      }
    },
    [makeApiRequest, getCurrentUser, getAppDetails]
  );

  /**
   * Remove a group from an app
   */
  const removeGroupFromApp = useCallback(
    async (appId: string, groupId: string): Promise<boolean> => {
      try {
        const response = await makeApiRequest(`/api/v1/apps/${appId}/groups/${groupId}`, 'DELETE');
        const success = response.success;

        // Log to audit
        const currentUser = await getCurrentUser();
        const appDetails = await getAppDetails(appId);
        const groupResponse = await makeApiRequest(`/api/v1/groups/${groupId}`);
        await auditStore.logOperation({
          action: 'remove_group_from_app' as any,
          groupId,
          groupName: groupResponse.data?.profile?.name || groupId,
          performedBy: currentUser.email,
          affectedUsers: [],
          result: success ? 'success' : 'failed',
          details: {
            usersSucceeded: 0,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: 0,
          },
          appId,
          appName: appDetails.app.label,
        } as any);

        return success;
      } catch (error) {
        console.error(`[useOktaApi] Failed to remove group ${groupId} from app ${appId}:`, error);
        throw error;
      }
    },
    [makeApiRequest, getCurrentUser, getAppDetails]
  );

  /**
   * Deep merge utility for complex app profiles
   * Handles arrays (merge or replace based on strategy), nested objects, and null values
   */
  const deepMergeProfiles = (
    baseProfile: Record<string, any>,
    overrideProfile: Record<string, any>,
    arrayStrategy: 'merge' | 'replace' = 'replace'
  ): Record<string, any> => {
    const result: Record<string, any> = { ...baseProfile };

    for (const [key, overrideValue] of Object.entries(overrideProfile)) {
      const baseValue = result[key];

      // Skip null/undefined override values (keep base)
      if (overrideValue === null || overrideValue === undefined) {
        continue;
      }

      // Handle arrays (e.g., Salesforce permission sets)
      if (Array.isArray(overrideValue)) {
        if (arrayStrategy === 'merge' && Array.isArray(baseValue)) {
          // Merge arrays, dedupe
          result[key] = [...new Set([...baseValue, ...overrideValue])];
        } else {
          // Replace array entirely
          result[key] = [...overrideValue];
        }
      }
      // Handle nested objects (not arrays)
      else if (typeof overrideValue === 'object' && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
        result[key] = deepMergeProfiles(baseValue || {}, overrideValue, arrayStrategy);
      }
      // Primitive values
      else {
        result[key] = overrideValue;
      }
    }

    return result;
  };

  /**
   * Get app profile schema for validation
   */
  const getAppProfileSchema = useCallback(
    async (appId: string): Promise<Record<string, any> | null> => {
      try {
        const response = await makeApiRequest(`/api/v1/apps/${appId}`);
        if (response.success && response.data) {
          // App profile schema is in the credentials.scheme or settings.app
          return response.data.settings?.app || response.data.credentials?.scheme || null;
        }
        return null;
      } catch {
        return null;
      }
    },
    [makeApiRequest]
  );

  /**
   * Preview conversion without making changes
   */
  const previewConversion = useCallback(
    async (
      userId: string,
      targetGroupId: string,
      appId: string
    ): Promise<{
      userProfile: Record<string, any>;
      groupProfile: Record<string, any>;
      mergedProfile: Record<string, any>;
      differences: Array<{
        field: string;
        userValue: any;
        groupValue: any;
        mergedValue: any;
        fieldType: string;
      }>;
      warnings: string[];
    }> => {
      const userAssignment = await getUserAppAssignment(appId, userId);
      const existingGroupAssignment = await getGroupAppAssignment(appId, targetGroupId);

      const userProfile = userAssignment?.profile || {};
      const groupProfile = existingGroupAssignment?.profile || {};
      const mergedProfile = deepMergeProfiles(groupProfile, userProfile, 'merge');

      const warnings: string[] = [];
      const differences: Array<{
        field: string;
        userValue: any;
        groupValue: any;
        mergedValue: any;
        fieldType: string;
      }> = [];

      // Analyze all fields
      const allKeys = new Set([...Object.keys(userProfile), ...Object.keys(groupProfile)]);
      allKeys.forEach((key) => {
        const uVal = userProfile[key];
        const gVal = groupProfile[key];
        const mVal = mergedProfile[key];

        // Determine field type
        let fieldType = 'string';
        if (Array.isArray(uVal) || Array.isArray(gVal)) fieldType = 'array';
        else if (typeof uVal === 'object' || typeof gVal === 'object') fieldType = 'object';
        else if (typeof uVal === 'boolean' || typeof gVal === 'boolean') fieldType = 'boolean';

        // Check if there's a difference
        const isDifferent = JSON.stringify(uVal) !== JSON.stringify(gVal);
        if (isDifferent) {
          differences.push({
            field: key,
            userValue: uVal,
            groupValue: gVal,
            mergedValue: mVal,
            fieldType,
          });
        }
      });

      // Add warnings
      if (userAssignment?.credentials) {
        warnings.push('User has stored credentials that cannot be transferred to group assignment. User may need to re-authenticate.');
      }
      if (!existingGroupAssignment) {
        warnings.push('This will create a new group assignment to the app.');
      }
      if (differences.some(d => d.fieldType === 'array')) {
        warnings.push('Profile contains array fields (like permission sets). Arrays will be merged, not replaced.');
      }

      return {
        userProfile,
        groupProfile,
        mergedProfile,
        differences,
        warnings,
      };
    },
    [getUserAppAssignment, getGroupAppAssignment]
  );

  /**
   * FEATURE 2: Convert user app assignments to group assignments
   */
  const convertUserToGroupAssignment = useCallback(
    async (request: AssignmentConversionRequest): Promise<AssignmentConversionResult[]> => {
      const results: AssignmentConversionResult[] = [];
      const startTime = Date.now();
      let successCount = 0;
      let failCount = 0;

      try {
        onResult?.('Starting user-to-group assignment conversion...', 'info');

        for (let i = 0; i < request.appIds.length; i++) {
          const appId = request.appIds[i];
          checkCancelled();

          try {
            // Get user's assignment to the app
            const userAssignment = await getUserAppAssignment(appId, request.userId);
            if (!userAssignment) {
              results.push({
                appId,
                appName: 'Unknown',
                success: false,
                error: 'User not assigned to this app',
              });
              failCount++;
              continue;
            }

            // Get app details for name
            const appDetails = await getAppDetails(appId);

            // Check if group assignment already exists
            const existingGroupAssignment = await getGroupAppAssignment(appId, request.targetGroupId);

            // Determine profile based on merge strategy using deep merge
            // Filter out user-specific profile properties that can't be set on group assignments
            const userSpecificFields = new Set([
              'email', 'emailType', 'displayName', 'givenName', 'familyName',
              'firstName', 'lastName', 'login', 'secondEmail', 'middleName',
              'honorificPrefix', 'honorificSuffix', 'title', 'nickName',
              'profileUrl', 'primaryPhone', 'mobilePhone', 'streetAddress',
              'city', 'state', 'zipCode', 'countryCode', 'postalAddress',
              'preferredLanguage', 'locale', 'timezone', 'userType',
              'employeeNumber', 'costCenter', 'organization', 'division',
              'department', 'managerId', 'manager'
            ]);

            // Filter user profile to only include app-specific settings (not user-derived values)
            const filterUserSpecificFields = (profile: Record<string, any>): Record<string, any> => {
              const filtered: Record<string, any> = {};
              for (const [key, value] of Object.entries(profile)) {
                if (!userSpecificFields.has(key)) {
                  filtered[key] = value;
                }
              }
              return filtered;
            };

            let mergedProfile: Record<string, any> | undefined;
            const userProfile = filterUserSpecificFields(userAssignment.profile || {});
            const groupProfile = existingGroupAssignment?.profile || {};

            const profileChanges: any = {
              userProfile,
              groupProfile,
              differences: [],
              credentialsHandled: !!userAssignment.credentials,
              hasArrayFields: false,
              hasNestedObjects: false,
            };

            // Detect complex fields
            [...Object.values(userProfile), ...Object.values(groupProfile)].forEach(val => {
              if (Array.isArray(val)) profileChanges.hasArrayFields = true;
              if (val && typeof val === 'object' && !Array.isArray(val)) profileChanges.hasNestedObjects = true;
            });

            if (userAssignment.profile || existingGroupAssignment?.profile) {
              // Find differences with type information
              const allKeys = new Set([...Object.keys(userProfile), ...Object.keys(groupProfile)]);
              allKeys.forEach((key) => {
                const uVal = userProfile[key];
                const gVal = groupProfile[key];
                if (JSON.stringify(uVal) !== JSON.stringify(gVal)) {
                  profileChanges.differences.push({
                    field: key,
                    userValue: uVal,
                    groupValue: gVal,
                    isArray: Array.isArray(uVal) || Array.isArray(gVal),
                    isObject: (typeof uVal === 'object' && !Array.isArray(uVal)) ||
                              (typeof gVal === 'object' && !Array.isArray(gVal)),
                  });
                }
              });

              // Apply merge strategy with deep merge support
              switch (request.mergeStrategy) {
                case 'preserve_user':
                  // Keep existing group profile, don't modify
                  mergedProfile = existingGroupAssignment?.profile;
                  break;
                case 'prefer_user':
                  // Deep merge with user profile taking precedence
                  mergedProfile = deepMergeProfiles(groupProfile, userProfile, 'merge');
                  break;
                case 'prefer_default':
                  // Use group profile or empty if new
                  mergedProfile = groupProfile;
                  break;
              }
            }

            // Create or update group assignment
            const groupAssignment = await assignGroupToApp(appId, request.targetGroupId, {
              profile: mergedProfile,
              priority: 0,
            });

            // Remove user assignment if requested
            let userAssignmentRemoved = false;
            if (request.removeUserAssignment) {
              userAssignmentRemoved = await removeUserFromApp(appId, request.userId);
            }

            results.push({
              appId,
              appName: appDetails.app.label,
              success: true,
              userAssignment,
              groupAssignment,
              profileChanges,
              userAssignmentRemoved,
            });

            successCount++;
            onProgress?.(i + 1, request.appIds.length, `Converted ${appDetails.app.label}`);
          } catch (error: any) {
            results.push({
              appId,
              appName: 'Unknown',
              success: false,
              error: error.message || 'Unknown error',
            });
            failCount++;
          }
        }

        // Log to audit
        const currentUser = await getCurrentUser();
        const groupResponse = await makeApiRequest(`/api/v1/groups/${request.targetGroupId}`);
        await auditStore.logOperation({
          action: 'convert_assignment' as any,
          groupId: request.targetGroupId,
          groupName: groupResponse.data?.profile?.name || request.targetGroupId,
          performedBy: currentUser.email,
          affectedUsers: [request.userId],
          result: failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
          details: {
            usersSucceeded: successCount,
            usersFailed: failCount,
            apiRequestCount: request.appIds.length * 3, // Approximate
            durationMs: Date.now() - startTime,
          },
          conversionDetails: {
            sourceType: 'user',
            targetType: 'group',
            assignmentsConverted: successCount,
          },
        } as any);

        onResult?.(
          `Conversion complete: ${successCount} succeeded, ${failCount} failed`,
          failCount === 0 ? 'success' : successCount > 0 ? 'warning' : 'error'
        );
      } catch (error: any) {
        onResult?.(`Conversion failed: ${error.message}`, 'error');
        throw error;
      }

      return results;
    },
    [
      getUserAppAssignment,
      getGroupAppAssignment,
      assignGroupToApp,
      removeUserFromApp,
      getAppDetails,
      getCurrentUser,
      makeApiRequest,
      onResult,
      onProgress,
      checkCancelled,
    ]
  );

  /**
   * FEATURE 4: Bulk assign groups to apps
   */
  const bulkAssignGroupsToApps = useCallback(
    async (request: BulkAppAssignmentRequest): Promise<BulkAppAssignmentResult> => {
      const results: any[] = [];
      const startTime = Date.now();
      let successCount = 0;
      let failCount = 0;
      const totalOperations = request.groupIds.length * request.appIds.length;

      try {
        onResult?.(`Starting bulk assignment: ${totalOperations} total operations...`, 'info');

        let current = 0;
        for (const groupId of request.groupIds) {
          checkCancelled();

          // Get group details
          const groupResponse = await makeApiRequest(`/api/v1/groups/${groupId}`);
          const groupName = groupResponse.data?.profile?.name || groupId;

          for (const appId of request.appIds) {
            checkCancelled();
            current++;

            try {
              // Get app details
              const appDetails = await getAppDetails(appId);

              // Determine profile: app-specific > default
              const profile = request.perAppProfiles?.[appId] || request.profile;

              // Assign group to app
              const assignment = await assignGroupToApp(appId, groupId, {
                profile,
                priority: request.priority ?? 0,
              });

              results.push({
                groupId,
                groupName,
                appId,
                appName: appDetails.app.label,
                success: true,
                assignment,
              });

              successCount++;
              onProgress?.(current, totalOperations, `Assigned ${groupName} to ${appDetails.app.label}`);
            } catch (error: any) {
              const appDetails = await getAppDetails(appId).catch(() => ({ app: { label: 'Unknown' } }));
              results.push({
                groupId,
                groupName,
                appId,
                appName: appDetails.app.label,
                success: false,
                error: error.message || 'Unknown error',
              });
              failCount++;
              onProgress?.(current, totalOperations, `Failed: ${groupName} to ${appDetails.app.label}`);
            }
          }
        }

        // Log to audit
        const currentUser = await getCurrentUser();
        await auditStore.logOperation({
          action: 'bulk_app_assignment' as any,
          groupId: 'multiple',
          groupName: `${request.groupIds.length} groups`,
          performedBy: currentUser.email,
          affectedUsers: [],
          affectedApps: request.appIds,
          result: failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
          details: {
            usersSucceeded: successCount,
            usersFailed: failCount,
            apiRequestCount: totalOperations,
            durationMs: Date.now() - startTime,
          },
        } as any);

        onResult?.(
          `Bulk assignment complete: ${successCount}/${totalOperations} succeeded`,
          failCount === 0 ? 'success' : successCount > 0 ? 'warning' : 'error'
        );
      } catch (error: any) {
        onResult?.(`Bulk assignment failed: ${error.message}`, 'error');
        throw error;
      }

      return {
        totalOperations,
        successful: successCount,
        failed: failCount,
        results,
      };
    },
    [assignGroupToApp, getAppDetails, getCurrentUser, makeApiRequest, onResult, onProgress, checkCancelled]
  );

  /**
   * FEATURE 3: App assignment security analysis wrapper
   */
  const analyzeAppAssignmentSecurity = useCallback(
    async (userId?: string, groupId?: string): Promise<AppAssignmentSecurityAnalysis> => {
      onResult?.('Starting app assignment security analysis...', 'info');
      const startTime = Date.now();

      try {
        const analysis = await analyzeAppSecurity(
          userId,
          groupId,
          getUserApps,
          getGroupApps,
          makeApiRequest,
          getUserLastLogin
        );

        // Log to audit
        const currentUser = await getCurrentUser();
        await auditStore.logOperation({
          action: 'app_security_scan' as any,
          groupId: groupId || 'N/A',
          groupName: groupId ? 'Group Analysis' : 'User Analysis',
          performedBy: currentUser.email,
          affectedUsers: userId ? [userId] : [],
          result: 'success',
          details: {
            usersSucceeded: 0,
            usersFailed: 0,
            apiRequestCount: analysis.totalAppsAnalyzed,
            durationMs: Date.now() - startTime,
          },
        } as any);

        onResult?.(
          `Security analysis complete: ${analysis.findings.length} findings, risk score ${analysis.riskScore}/100`,
          analysis.riskScore > 70 ? 'error' : analysis.riskScore > 40 ? 'warning' : 'success'
        );

        return analysis;
      } catch (error: any) {
        onResult?.(`Security analysis failed: ${error.message}`, 'error');
        throw error;
      }
    },
    [getUserApps, getGroupApps, makeApiRequest, getUserLastLogin, getCurrentUser, onResult]
  );

  /**
   * FEATURE 5: App assignment recommender wrapper
   */
  const getAppAssignmentRecommender = useCallback(
    async (appIds: string[]): Promise<AssignmentRecommenderResult> => {
      onResult?.('Analyzing app assignments and generating recommendations...', 'info');

      try {
        const result = await getAppAssignmentRecommendations(appIds, makeApiRequest);

        onResult?.(
          `Recommendations ready: Found ${result.recommendations.length} apps with optimization opportunities. ` +
            `Potential ${result.overallStats.estimatedMaintenanceReduction.toFixed(0)}% reduction in direct assignments.`,
          'success'
        );

        return result;
      } catch (error: any) {
        onResult?.(`Failed to generate recommendations: ${error.message}`, 'error');
        throw error;
      }
    },
    [getUserApps, getGroupApps, makeApiRequest, onResult]
  );

  /**
   * Fetches push group mappings for an application.
   * Uses the new Group Push Mapping API to get actual push relationships.
   * @param appId - The application ID
   * @returns Array of push group mappings with sourceUserGroupId linking to Okta groups
   */
  const getAppPushGroupMappings = useCallback(
    async (appId: string): Promise<Array<{
      mappingId: string;
      sourceUserGroupId: string;
      targetGroupId?: string;
      status: string;
    }>> => {
      try {
        const response = await makeApiRequest(`/api/v1/apps/${appId}/group-push/mappings?limit=200`);
        if (!response.success || !response.data) {
          return [];
        }
        return response.data.map((mapping: any) => ({
          mappingId: mapping.mappingId || mapping.id,
          sourceUserGroupId: mapping.sourceUserGroupId,
          targetGroupId: mapping.targetGroupId,
          status: mapping.status || 'UNKNOWN',
        }));
      } catch (error) {
        console.warn(`[useOktaApi] Failed to get push group mappings for app ${appId}:`, error);
        return [];
      }
    },
    [makeApiRequest]
  );

  return {
    isLoading,
    isCancelled,
    cancelOperation,
    makeApiRequest,
    getAllGroupMembers,
    removeUserFromGroup,
    removeDeprovisioned,
    smartCleanup,
    customFilter,
    customFilterMultiple,
    exportMembers,
    getUserLastLogin,
    getUserAppAssignments,
    batchGetUserDetails,
    getUserGroupMemberships,
    // Multi-group operations
    getAllGroups,
    getGroupMemberCount,
    getGroupRulesForGroup,
    findUserAcrossGroups,
    executeBulkOperation,
    compareGroups,
    // App assignment operations
    getUserApps,
    getGroupApps,
    getUserAppAssignment,
    getGroupAppAssignment,
    getAppDetails,
    getAppPushGroupMappings,
    assignUserToApp,
    assignGroupToApp,
    removeUserFromApp,
    removeGroupFromApp,
    // App assignment features
    convertUserToGroupAssignment,
    bulkAssignGroupsToApps,
    analyzeAppAssignmentSecurity,
    getAppAssignmentRecommender,
    // Profile management
    previewConversion,
    getAppProfileSchema,
    // Search functions
    searchUsers,
    searchGroups,
    getUserById,
    getGroupById,
  };
}
