/**
 * @module sidepanel/hooks/useOktaApi
 * @description Facade hook that exposes the whole Okta API surface to the side panel.
 *
 * Composes the per-concern operation modules under `useOktaApi/` (core, group
 * members/cleanup/bulk/discovery/analysis, users, exports, push groups) into a
 * single memoized object. No request is issued here directly: every call routes
 * through the extension's rate-limited path — side panel → background
 * `ApiScheduler` → content script `fetch` against the live Okta session. This hook
 * only owns cross-cutting run state (loading, cancellation via `AbortController`).
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
import { createRuleImpactOperations } from './useOktaApi/ruleImpact';

/**
 * Aggregate hook returning every Okta operation the side panel can invoke.
 *
 * Each returned function ultimately posts a message to the background
 * `ApiScheduler`, which rate-limits and forwards it to the content script that
 * performs the actual authenticated `fetch` — the side panel never calls Okta
 * directly. Long-running operations (`removeDeprovisioned`, `exportMembers`) are
 * wrapped so they toggle `isLoading` and can be aborted via `cancelOperation`.
 *
 * @remarks
 * The options (see `UseOktaApiOptions`) scope every operation to
 * `targetTabId`'s content script and wire the result/progress callbacks.
 * `onResult` reports user-facing messages (status is `success` / `warning` /
 * `danger`, never `error`). Both `onResult` and `onProgress` must be stable
 * (`useCallback`) — they are memo dependencies, so an unstable value defeats the
 * memoization and gives every returned function a new identity each render.
 *
 * @returns A memoized object of run state (`isLoading`, `isCancelled`,
 *   `cancelOperation`) plus the core, group, user, export, push-group and
 *   group-analysis operations.
 *
 * @example
 * ```tsx
 * const api = useOktaApi({ targetTabId, onResult, onProgress });
 * await api.addUserToGroup(userId, groupId);
 * ```
 */
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
  const ruleImpactOps = useMemo(
    () => createRuleImpactOperations(coreApi, groupMemberOps.getAllGroupMembers),
    [coreApi, groupMemberOps],
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

      // Rule impact preview (read-only)
      captureRuleImpact: ruleImpactOps.captureRuleImpact,
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
      ruleImpactOps,
      removeDeprovisioned,
      exportMembers,
    ],
  );
}
