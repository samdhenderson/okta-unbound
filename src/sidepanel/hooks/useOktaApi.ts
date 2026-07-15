/**
 * @module hooks/useOktaApi
 * @description Primary hook for interacting with the Okta API.
 */

import { useState, useCallback, useMemo } from 'react';
import type { UseOktaApiOptions } from './useOktaApi/types';
import { createCoreApi } from './useOktaApi/core';
import { createGroupMemberOperations } from './useOktaApi/groupMembers';
import { createGroupCleanupOperations } from './useOktaApi/groupCleanup';
import { createGroupBulkOperations } from './useOktaApi/groupBulkOps';
import { createGroupDiscoveryOperations } from './useOktaApi/groupDiscovery';
import { createUserOperations } from './useOktaApi/userOperations';
import { createExportOperations } from './useOktaApi/exportOperations';
import { createPushGroupOperations } from './useOktaApi/pushGroupOps';
import { createGroupAnalysisOperations } from './useOktaApi/groupAnalysis';

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

  // Every operation object below is memoized. Without this, each render rebuilds
  // coreApi and all nine operation objects, so every function this hook returns has
  // a fresh identity on every render — and any effect that lists one in its deps
  // re-runs forever. Callers must pass stable onResult/onProgress (useCallback) or
  // these memos are defeated.
  const coreApi = useMemo(
    () => createCoreApi(targetTabId, checkCancelled, { onResult, onProgress }),
    [targetTabId, checkCancelled, onResult, onProgress],
  );

  const groupMemberOps = useMemo(() => createGroupMemberOperations(coreApi), [coreApi]);
  const groupCleanupOps = useMemo(
    () => createGroupCleanupOperations(coreApi, groupMemberOps.removeUserFromGroup),
    [coreApi, groupMemberOps],
  );
  const groupBulkOps = useMemo(
    () =>
      createGroupBulkOperations(
        coreApi,
        groupMemberOps.removeUserFromGroup,
        groupMemberOps.getAllGroupMembers,
      ),
    [coreApi, groupMemberOps],
  );
  const groupDiscoveryOps = useMemo(() => createGroupDiscoveryOperations(coreApi), [coreApi]);
  const userOps = useMemo(() => createUserOperations(coreApi), [coreApi]);
  const exportOps = useMemo(() => createExportOperations(coreApi), [coreApi]);
  const pushGroupOps = useMemo(() => createPushGroupOperations(coreApi), [coreApi]);
  const groupAnalysisOps = useMemo(
    () => createGroupAnalysisOperations(groupMemberOps.getAllGroupMembers),
    [groupMemberOps],
  );

  const wrapOperation = useCallback(<A extends unknown[]>(fn: (...args: A) => Promise<void>) => {
    return async (...args: A) => {
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
  }, []);

  const removeDeprovisioned = useMemo(
    () => wrapOperation(groupCleanupOps.removeDeprovisioned),
    [wrapOperation, groupCleanupOps],
  );
  const exportMembers = useMemo(
    () => wrapOperation(exportOps.exportMembers),
    [wrapOperation, exportOps],
  );

  return useMemo(
    () => ({
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
      removeDeprovisioned,
      getAllGroups: groupDiscoveryOps.getAllGroups,
      getGroupMemberCount: groupDiscoveryOps.getGroupMemberCount,
      getGroupRulesForGroup: groupDiscoveryOps.getGroupRulesForGroup,
      executeBulkOperation: groupBulkOps.executeBulkOperation,
      searchGroups: groupDiscoveryOps.searchGroups,
      getGroupById: groupDiscoveryOps.getGroupById,

      // User operations
      getUserLastLogin: userOps.getUserLastLogin,
      getUserAppAssignments: userOps.getUserAppAssignments,
      getUserApps: userOps.getUserApps,
      batchGetUserDetails: userOps.batchGetUserDetails,
      scanGroupMfa: userOps.scanGroupMfa,
      getUserGroupMemberships: userOps.getUserGroupMemberships,
      searchUsers: userOps.searchUsers,
      getUserById: userOps.getUserById,
      suspendUser: userOps.suspendUser,
      unsuspendUser: userOps.unsuspendUser,
      resetPassword: userOps.resetPassword,

      // Export operations
      exportMembers,

      // Push group operations
      getAppPushGroupMappings: pushGroupOps.getAppPushGroupMappings,
      applyPushGroupMappings: pushGroupOps.applyPushGroupMappings,

      // Group analysis operations
      compareGroups: groupAnalysisOps.compareGroups,
      searchUserAcrossGroups: groupAnalysisOps.searchUserAcrossGroups,
      calculateStaleness: groupAnalysisOps.calculateStaleness,
    }),
    [
      isLoading,
      isCancelled,
      cancelOperation,
      coreApi,
      groupMemberOps,
      groupDiscoveryOps,
      groupBulkOps,
      userOps,
      exportOps,
      pushGroupOps,
      groupAnalysisOps,
      removeDeprovisioned,
      exportMembers,
    ],
  );
}
