/**
 * @module hooks/useOktaApi
 * @description Primary hook for interacting with the Okta API.
 */

import { useState, useCallback } from 'react';
import type { UseOktaApiOptions } from './useOktaApi/types';
import { createCoreApi } from './useOktaApi/core';
import { createGroupMemberOperations } from './useOktaApi/groupMembers';
import { createGroupCleanupOperations } from './useOktaApi/groupCleanup';
import { createGroupBulkOperations } from './useOktaApi/groupBulkOps';
import { createGroupDiscoveryOperations } from './useOktaApi/groupDiscovery';
import { createUserOperations } from './useOktaApi/userOperations';
import { createExportOperations } from './useOktaApi/exportOperations';

export function useOktaApi({ targetTabId, onResult, onProgress }: UseOktaApiOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  const cancelOperation = useCallback(() => {
    setIsCancelled(true);
    if (abortController) {
      abortController.abort();
    }
    onResult?.('Operation cancelled by user', 'warning');
  }, [abortController, onResult]);

  const checkCancelled = useCallback(() => {
    if (isCancelled) {
      throw new Error('Operation cancelled');
    }
  }, [isCancelled]);

  const coreApi = createCoreApi(targetTabId, checkCancelled, { onResult, onProgress });

  const groupMemberOps = createGroupMemberOperations(coreApi);
  const groupCleanupOps = createGroupCleanupOperations(coreApi, groupMemberOps.removeUserFromGroup);
  const groupBulkOps = createGroupBulkOperations(coreApi, groupMemberOps.removeUserFromGroup, groupMemberOps.getAllGroupMembers);
  const groupDiscoveryOps = createGroupDiscoveryOperations(coreApi);
  const userOps = createUserOperations(coreApi);
  const exportOps = createExportOperations(coreApi);

  const wrapOperation = useCallback(
    (fn: (...args: any[]) => Promise<void>) => {
      return async (...args: any[]) => {
        setIsCancelled(false);
        const controller = new AbortController();
        setAbortController(controller);
        setIsLoading(true);
        try {
          await fn(...args);
        } finally {
          setIsLoading(false);
          setAbortController(null);
          setIsCancelled(false);
        }
      };
    },
    []
  );

  return {
    // State
    isLoading,
    isCancelled,
    cancelOperation,

    // Core API
    makeApiRequest: coreApi.makeApiRequest,

    // Group operations
    getAllGroupMembers: groupMemberOps.getAllGroupMembers,
    removeUserFromGroup: groupMemberOps.removeUserFromGroup,
    addUserToGroup: groupMemberOps.addUserToGroup,
    removeDeprovisioned: wrapOperation(groupCleanupOps.removeDeprovisioned),
    getAllGroups: groupDiscoveryOps.getAllGroups,
    getGroupMemberCount: groupDiscoveryOps.getGroupMemberCount,
    getGroupRulesForGroup: groupDiscoveryOps.getGroupRulesForGroup,
    executeBulkOperation: groupBulkOps.executeBulkOperation,
    searchGroups: groupDiscoveryOps.searchGroups,
    getGroupById: groupDiscoveryOps.getGroupById,

    // User operations
    getUserLastLogin: userOps.getUserLastLogin,
    getUserAppAssignments: userOps.getUserAppAssignments,
    batchGetUserDetails: userOps.batchGetUserDetails,
    getUserGroupMemberships: userOps.getUserGroupMemberships,
    searchUsers: userOps.searchUsers,
    getUserById: userOps.getUserById,
    suspendUser: userOps.suspendUser,
    unsuspendUser: userOps.unsuspendUser,
    resetPassword: userOps.resetPassword,

    // Export operations
    exportMembers: wrapOperation(exportOps.exportMembers),
  };
}
