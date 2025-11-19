import { useState, useCallback } from 'react';
import type { MessageRequest, MessageResponse, OktaUser, UserStatus, AuditLogEntry } from '../../shared/types';
import { logAction } from '../../shared/undoManager';
import { auditStore } from '../../shared/storage/auditStore';
import { RulesCache } from '../../shared/rulesCache';

interface UseOktaApiOptions {
  targetTabId: number | null;
  onResult?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onProgress?: (current: number, total: number, message: string) => void;
}

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
    async (endpoint: string, method: string = 'GET', body?: any) => {
      return sendMessage({
        action: 'makeApiRequest',
        endpoint,
        method,
        body,
      });
    },
    [sendMessage]
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
    async (groupId: string, groupName: string, user: OktaUser) => {
      const result = await makeApiRequest(`/api/v1/groups/${groupId}/users/${user.id}`, 'DELETE');

      // Log undo action if successful
      if (result.success) {
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
      const errorMessages: string[] = [];
      const affectedUserIds: string[] = [];

      try {
        // Reset cancellation state and create new controller
        setIsCancelled(false);
        const controller = new AbortController();
        setAbortController(controller);

        setIsLoading(true);
        onResult?.('Starting: Remove deprovisioned users', 'info');

        // Get current user for audit logging
        currentUser = await getCurrentUser();

        checkCancelled(); // Check if cancelled

        // Check group type
        const groupDetails = await makeApiRequest(`/api/v1/groups/${groupId}`);
        if (groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
          onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
          return;
        }

        groupName = groupDetails.data?.profile?.name || 'Unknown Group';

        checkCancelled(); // Check if cancelled

        // Fetch all members
        const members = await getAllGroupMembers(groupId);
        const deprovisionedUsers = members.filter((u) => u.status === 'DEPROVISIONED');

        onResult?.(`Found ${deprovisionedUsers.length} deprovisioned users`, 'warning');

        if (deprovisionedUsers.length === 0) {
          onResult?.('No deprovisioned users to remove', 'success');
          return;
        }

        // Remove each deprovisioned user
        for (let i = 0; i < deprovisionedUsers.length; i++) {
          checkCancelled(); // Check if cancelled before each iteration

          const user = deprovisionedUsers[i];
          affectedUserIds.push(user.id);
          onProgress?.(i + 1, deprovisionedUsers.length, `Removing user ${i + 1} of ${deprovisionedUsers.length}`);

          const result = await removeUserFromGroup(groupId, groupName, user);

          if (result.success) {
            removed++;
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

        onResult?.(`Complete: ${removed} removed, ${failed} failed`, removed > 0 ? 'success' : 'warning');
      } catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorMessages.push(errorMsg);
        onResult?.(errorMsg, error instanceof Error && error.message === 'Operation cancelled' ? 'warning' : 'error');
      } finally {
        setIsLoading(false);
        setAbortController(null);
        setIsCancelled(false);
        onProgress?.(100, 100, 'Complete');

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
              apiRequestCount: affectedUserIds.length,
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
    [makeApiRequest, getAllGroupMembers, removeUserFromGroup, getCurrentUser, onResult, onProgress, checkCancelled]
  );

  const smartCleanup = useCallback(
    async (groupId: string) => {
      const startTime = Date.now();
      let currentUser: { email: string; id: string } | null = null;
      let groupName = 'Unknown Group';
      let removed = 0;
      let failed = 0;
      const errorMessages: string[] = [];
      const affectedUserIds: string[] = [];

      try {
        setIsLoading(true);
        onResult?.('Starting: Smart Cleanup (remove all inactive users)', 'info');

        // Get current user for audit logging
        currentUser = await getCurrentUser();

        // Check group type
        const groupDetails = await makeApiRequest(`/api/v1/groups/${groupId}`);
        if (groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
          onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
          return;
        }

        groupName = groupDetails.data?.profile?.name || 'Unknown Group';

        // Fetch all members
        const members = await getAllGroupMembers(groupId);
        const inactiveStatuses: UserStatus[] = ['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT'];
        const inactiveUsers = members.filter((u) => inactiveStatuses.includes(u.status));

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

        // Remove each inactive user
        for (let i = 0; i < inactiveUsers.length; i++) {
          const user = inactiveUsers[i];
          affectedUserIds.push(user.id);
          onProgress?.(i + 1, inactiveUsers.length, `Removing user ${i + 1} of ${inactiveUsers.length}`);

          const result = await removeUserFromGroup(groupId, groupName, user);

          if (result.success) {
            removed++;
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

        onResult?.(`Smart Cleanup complete: ${removed} removed, ${failed} failed`, 'success');
      } catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorMessages.push(errorMsg);
        onResult?.(errorMsg, 'error');
      } finally {
        setIsLoading(false);
        onProgress?.(100, 100, 'Complete');

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
              apiRequestCount: affectedUserIds.length,
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
    [makeApiRequest, getAllGroupMembers, removeUserFromGroup, getCurrentUser, onResult, onProgress]
  );

  const customFilter = useCallback(
    async (groupId: string, targetStatus: UserStatus, action: 'list' | 'remove') => {
      const startTime = Date.now();
      let currentUser: { email: string; id: string } | null = null;
      let groupName = 'Unknown Group';
      let removed = 0;
      let failed = 0;
      const errorMessages: string[] = [];
      const affectedUserIds: string[] = [];

      try {
        setIsLoading(true);
        onResult?.(`Starting: ${action === 'remove' ? 'Remove' : 'List'} users with status ${targetStatus}`, 'info');

        // Get current user for audit logging
        currentUser = await getCurrentUser();

        // Get group name for undo logging
        const groupDetails = await makeApiRequest(`/api/v1/groups/${groupId}`);
        groupName = groupDetails.data?.profile?.name || 'Unknown Group';

        const members = await getAllGroupMembers(groupId);
        const filteredUsers = members.filter((u) => u.status === targetStatus);

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
          for (let i = 0; i < filteredUsers.length; i++) {
            const user = filteredUsers[i];
            affectedUserIds.push(user.id);
            onProgress?.(i + 1, filteredUsers.length, `Removing user ${i + 1} of ${filteredUsers.length}`);

            const result = await removeUserFromGroup(groupId, groupName, user);
            if (result.success) {
              removed++;
              onResult?.(`Removed: ${user.profile.login}`, 'success');
            } else {
              failed++;
              const errorMsg = `Failed: ${user.profile.login} - ${result.error}`;
              errorMessages.push(errorMsg);
              onResult?.(errorMsg, 'error');
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          onResult?.(`Removed ${removed} users`, 'success');
        }
      } catch (error) {
        const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorMessages.push(errorMsg);
        onResult?.(errorMsg, 'error');
      } finally {
        setIsLoading(false);
        onProgress?.(100, 100, 'Complete');

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
              apiRequestCount: affectedUserIds.length,
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
    [makeApiRequest, getAllGroupMembers, removeUserFromGroup, getCurrentUser, onResult, onProgress]
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
        const response = await makeApiRequest(`/api/v1/apps?filter=user.id eq "${userId}"&limit=1`);
        if (response.success && response.headers?.['x-total-count']) {
          return parseInt(response.headers['x-total-count'], 10);
        }
        // If header not available, count the data array
        return response.data?.length || 0;
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

  // Multi-Group Operations
  const getAllGroups = useCallback(
    async (onProgress?: (loaded: number, total: number) => void): Promise<any[]> => {
      const allGroups: any[] = [];
      let nextUrl: string | null = '/api/v1/groups?limit=200';
      let pageCount = 0;

      while (nextUrl) {
        pageCount++;
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
        // OPTIMIZED: Use limit=1 to get count from x-total-count header (1 API call instead of 2)
        const usersResponse = await makeApiRequest(`/api/v1/groups/${groupId}/users?limit=1`);
        if (usersResponse.success && usersResponse.headers?.['x-total-count']) {
          return parseInt(usersResponse.headers['x-total-count'], 10);
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
  };
}
