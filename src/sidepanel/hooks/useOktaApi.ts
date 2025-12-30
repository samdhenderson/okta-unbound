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
import type { UseOktaApiOptions } from './useOktaApi/types';
import { createCoreApi } from './useOktaApi/core';
import { createGroupMemberOperations } from './useOktaApi/groupMembers';
import { createGroupCleanupOperations } from './useOktaApi/groupCleanup';
import { createGroupBulkOperations } from './useOktaApi/groupBulkOps';
import { createGroupDiscoveryOperations } from './useOktaApi/groupDiscovery';
import { createUserOperations } from './useOktaApi/userOperations';
import { createAppOperations } from './useOktaApi/appOperations';
import { createExportOperations } from './useOktaApi/exportOperations';

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

  // Create core API with callbacks
  const coreApi = createCoreApi(targetTabId, checkCancelled, { onResult, onProgress });

  // Create operation modules
  const groupMemberOps = createGroupMemberOperations(coreApi);
  const groupCleanupOps = createGroupCleanupOperations(coreApi, groupMemberOps.removeUserFromGroup);
  const groupBulkOps = createGroupBulkOperations(coreApi, groupMemberOps.removeUserFromGroup, groupMemberOps.getAllGroupMembers);
  const groupDiscoveryOps = createGroupDiscoveryOperations(coreApi);
  const userOps = createUserOperations(coreApi);
  const appOps = createAppOperations(coreApi);
  const exportOps = createExportOperations(coreApi);

  // Wrap operations that need state management
  const wrappedRemoveDeprovisioned = useCallback(
    async (groupId: string) => {
      setIsCancelled(false);
      const controller = new AbortController();
      setAbortController(controller);
      setIsLoading(true);

      try {
        await groupCleanupOps.removeDeprovisioned(groupId);
      } finally {
        setIsLoading(false);
        setAbortController(null);
        setIsCancelled(false);
      }
    },
    [groupCleanupOps]
  );

  const wrappedSmartCleanup = useCallback(
    async (groupId: string) => {
      setIsCancelled(false);
      const controller = new AbortController();
      setAbortController(controller);
      setIsLoading(true);

      try {
        await groupCleanupOps.smartCleanup(groupId);
      } finally {
        setIsLoading(false);
        setAbortController(null);
        setIsCancelled(false);
      }
    },
    [groupCleanupOps]
  );

  const wrappedCustomFilter = useCallback(
    async (groupId: string, targetStatus: any, action: 'list' | 'remove') => {
      setIsCancelled(false);
      const controller = new AbortController();
      setAbortController(controller);
      setIsLoading(true);

      try {
        await groupCleanupOps.customFilter(groupId, targetStatus, action);
      } finally {
        setIsLoading(false);
        setAbortController(null);
        setIsCancelled(false);
      }
    },
    [groupCleanupOps]
  );

  const wrappedCustomFilterMultiple = useCallback(
    async (groupId: string, targetStatuses: any[], action: 'list' | 'remove') => {
      setIsCancelled(false);
      const controller = new AbortController();
      setAbortController(controller);
      setIsLoading(true);

      try {
        await groupCleanupOps.customFilterMultiple(groupId, targetStatuses, action);
      } finally {
        setIsLoading(false);
        setAbortController(null);
        setIsCancelled(false);
      }
    },
    [groupCleanupOps]
  );

  const wrappedExportMembers = useCallback(
    async (groupId: string, groupName: string, format: 'csv' | 'json', statusFilter?: any) => {
      setIsLoading(true);
      try {
        await exportOps.exportMembers(groupId, groupName, format, statusFilter);
      } finally {
        setIsLoading(false);
      }
    },
    [exportOps]
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
    removeDeprovisioned: wrappedRemoveDeprovisioned,
    smartCleanup: wrappedSmartCleanup,
    customFilter: wrappedCustomFilter,
    customFilterMultiple: wrappedCustomFilterMultiple,
    getAllGroups: groupDiscoveryOps.getAllGroups,
    getGroupMemberCount: groupDiscoveryOps.getGroupMemberCount,
    getGroupRulesForGroup: groupDiscoveryOps.getGroupRulesForGroup,
    findUserAcrossGroups: groupDiscoveryOps.findUserAcrossGroups,
    executeBulkOperation: groupBulkOps.executeBulkOperation,
    compareGroups: groupBulkOps.compareGroups,
    searchGroups: groupDiscoveryOps.searchGroups,
    getGroupById: groupDiscoveryOps.getGroupById,

    // User operations
    getUserLastLogin: userOps.getUserLastLogin,
    getUserAppAssignments: userOps.getUserAppAssignments,
    batchGetUserDetails: userOps.batchGetUserDetails,
    getUserGroupMemberships: userOps.getUserGroupMemberships,
    searchUsers: userOps.searchUsers,
    getUserById: userOps.getUserById,

    // App operations
    getAllApps: appOps.getAllApps,
    getUserApps: appOps.getUserApps,
    getGroupApps: appOps.getGroupApps,
    getUserAppAssignment: appOps.getUserAppAssignment,
    getGroupAppAssignment: appOps.getGroupAppAssignment,
    getAppDetails: appOps.getAppDetails,
    assignUserToApp: appOps.assignUserToApp,
    assignGroupToApp: appOps.assignGroupToApp,
    removeUserFromApp: appOps.removeUserFromApp,
    removeGroupFromApp: appOps.removeGroupFromApp,
    getAppProfileSchema: appOps.getAppProfileSchema,
    previewConversion: appOps.previewConversion,
    convertUserToGroupAssignment: appOps.convertUserToGroupAssignment,
    copyUserToUserAssignment: appOps.copyUserToUserAssignment,
    bulkAssignGroupsToApps: appOps.bulkAssignGroupsToApps,
    analyzeAppAssignmentSecurity: appOps.analyzeAppAssignmentSecurity,
    getAppAssignmentRecommender: appOps.getAppAssignmentRecommender,
    getAppPushGroupMappings: appOps.getAppPushGroupMappings,
    getAppCertificates: appOps.getAppCertificates,
    getAppFeatures: appOps.getAppFeatures,
    getAppAssignmentCounts: appOps.getAppAssignmentCounts,
    enrichApp: appOps.enrichApp,

    // Export operations
    exportMembers: wrappedExportMembers,
  };
}
