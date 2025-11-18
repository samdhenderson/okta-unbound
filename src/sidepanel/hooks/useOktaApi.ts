import { useState, useCallback } from 'react';
import type { MessageRequest, MessageResponse, OktaUser, UserStatus } from '../../shared/types';
import { logAction } from '../../shared/undoManager';

interface UseOktaApiOptions {
  targetTabId: number | null;
  onResult?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onProgress?: (current: number, total: number, message: string) => void;
}

export function useOktaApi({ targetTabId, onResult, onProgress }: UseOktaApiOptions) {
  const [isLoading, setIsLoading] = useState(false);

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
      try {
        setIsLoading(true);
        onResult?.('Starting: Remove deprovisioned users', 'info');

        // Check group type
        const groupDetails = await makeApiRequest(`/api/v1/groups/${groupId}`);
        if (groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
          onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
          return;
        }

        const groupName = groupDetails.data?.profile?.name || 'Unknown Group';

        // Fetch all members
        const members = await getAllGroupMembers(groupId);
        const deprovisionedUsers = members.filter((u) => u.status === 'DEPROVISIONED');

        onResult?.(`Found ${deprovisionedUsers.length} deprovisioned users`, 'warning');

        if (deprovisionedUsers.length === 0) {
          onResult?.('No deprovisioned users to remove', 'success');
          return;
        }

        // Remove each deprovisioned user
        let removed = 0;
        let failed = 0;

        for (let i = 0; i < deprovisionedUsers.length; i++) {
          const user = deprovisionedUsers[i];
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
            if (result.status === 403) {
              onResult?.(`403 Forbidden: ${user.profile.login} - ${result.error}`, 'error');
              onResult?.('Stopping after first 403 error', 'warning');
              break;
            } else {
              onResult?.(`Failed: ${user.profile.login} - ${result.error}`, 'error');
            }
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        onResult?.(`Complete: ${removed} removed, ${failed} failed`, removed > 0 ? 'success' : 'warning');
      } catch (error) {
        onResult?.(
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        );
      } finally {
        setIsLoading(false);
        onProgress?.(100, 100, 'Complete');
      }
    },
    [makeApiRequest, getAllGroupMembers, removeUserFromGroup, onResult, onProgress]
  );

  const smartCleanup = useCallback(
    async (groupId: string) => {
      try {
        setIsLoading(true);
        onResult?.('Starting: Smart Cleanup (remove all inactive users)', 'info');

        // Check group type
        const groupDetails = await makeApiRequest(`/api/v1/groups/${groupId}`);
        if (groupDetails.success && groupDetails.data?.type === 'APP_GROUP') {
          onResult?.('ERROR: Cannot modify APP_GROUP', 'error');
          return;
        }

        const groupName = groupDetails.data?.profile?.name || 'Unknown Group';

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
        let removed = 0;
        let failed = 0;

        for (let i = 0; i < inactiveUsers.length; i++) {
          const user = inactiveUsers[i];
          onProgress?.(i + 1, inactiveUsers.length, `Removing user ${i + 1} of ${inactiveUsers.length}`);

          const result = await removeUserFromGroup(groupId, groupName, user);

          if (result.success) {
            removed++;
            onResult?.(`Removed: ${user.profile.login} (${user.status})`, 'success');
          } else {
            failed++;
            if (result.status === 403) {
              onResult?.('403 Forbidden - stopping', 'error');
              break;
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        onResult?.(`Smart Cleanup complete: ${removed} removed, ${failed} failed`, 'success');
      } catch (error) {
        onResult?.(
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        );
      } finally {
        setIsLoading(false);
        onProgress?.(100, 100, 'Complete');
      }
    },
    [makeApiRequest, getAllGroupMembers, removeUserFromGroup, onResult, onProgress]
  );

  const customFilter = useCallback(
    async (groupId: string, targetStatus: UserStatus, action: 'list' | 'remove') => {
      try {
        setIsLoading(true);
        onResult?.(`Starting: ${action === 'remove' ? 'Remove' : 'List'} users with status ${targetStatus}`, 'info');

        // Get group name for undo logging
        const groupDetails = await makeApiRequest(`/api/v1/groups/${groupId}`);
        const groupName = groupDetails.data?.profile?.name || 'Unknown Group';

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
          let removed = 0;
          for (let i = 0; i < filteredUsers.length; i++) {
            const user = filteredUsers[i];
            onProgress?.(i + 1, filteredUsers.length, `Removing user ${i + 1} of ${filteredUsers.length}`);

            const result = await removeUserFromGroup(groupId, groupName, user);
            if (result.success) {
              removed++;
              onResult?.(`Removed: ${user.profile.login}`, 'success');
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          onResult?.(`Removed ${removed} users`, 'success');
        }
      } catch (error) {
        onResult?.(
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        );
      } finally {
        setIsLoading(false);
        onProgress?.(100, 100, 'Complete');
      }
    },
    [makeApiRequest, getAllGroupMembers, removeUserFromGroup, onResult, onProgress]
  );

  const exportMembers = useCallback(
    async (groupId: string, groupName: string, format: 'csv' | 'json', statusFilter?: UserStatus | '') => {
      try {
        setIsLoading(true);
        onResult?.(`Starting export: ${format.toUpperCase()} format`, 'info');

        const response = await sendMessage({
          action: 'exportGroupMembers',
          groupId,
          groupName,
          format,
          statusFilter,
        });

        if (response.success) {
          onResult?.(`Export complete: ${response.count} members exported`, 'success');
        } else {
          onResult?.(`Export failed: ${response.error}`, 'error');
        }
      } catch (error) {
        onResult?.(
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [sendMessage, onResult]
  );

  return {
    isLoading,
    makeApiRequest,
    getAllGroupMembers,
    removeUserFromGroup,
    removeDeprovisioned,
    smartCleanup,
    customFilter,
    exportMembers,
  };
}
