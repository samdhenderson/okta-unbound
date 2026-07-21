/**
 * @module sidepanel/hooks/useOktaApi
 * @description Facade hook that exposes the whole Okta API surface to the side panel.
 *
 * Composes the per-concern operation modules under `useOktaApi/` (core, group
 * members/cleanup/bulk/discovery/analysis, users, exports, push groups) into a
 * single memoized object. No request is issued here directly: every call routes
 * through the extension's rate-limited path — side panel → background
 * `ApiScheduler` → content script `fetch` against the live Okta session. This hook
 * only owns cross-cutting run state (loading, plus cancellation shared through
 * `ProgressContext` so a single control can stop the running operation).
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { UseOktaApiOptions } from './useOktaApi/types';
import { useProgressOptional } from '../contexts/ProgressContext';
import { createCancellation } from '../../shared/scheduler/cancellation';
import { createCoreApi } from './useOktaApi/core';
import { createGroupMemberOperations } from './useOktaApi/groupMembers';
import { createGroupCleanupOperations } from './useOktaApi/groupCleanup';
import { createGroupBulkOperations } from './useOktaApi/groupBulkOps';
import { createGroupDiscoveryOperations } from './useOktaApi/groupDiscovery';
import { createUserOperations } from './useOktaApi/userOperations';
import { createAppOperations } from './useOktaApi/appOperations';
import { createExportOperations } from './useOktaApi/exportOperations';
import { createExportEngineOperations } from './useOktaApi/exportEngine';
import { createPushGroupOperations } from './useOktaApi/pushGroupOps';
import { createGroupAnalysisOperations } from './useOktaApi/groupAnalysis';
import { createRuleImpactOperations } from './useOktaApi/ruleImpact';
import { createRuleWriteOperations } from './useOktaApi/ruleWrites';

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

  // Cancellation is shared through ProgressContext so a single global control (the
  // Activity Bar) can stop whichever operation is running. Outside a provider
  // (some unit tests) we fall back to a local token. Ref-indirection keeps
  // `checkCancelled`/`cancelOperation` identities stable across renders even though
  // the progress context value changes on every progress tick — essential because
  // `checkCancelled` is threaded into the memoized `coreApi` below.
  const progressCtx = useProgressOptional();
  const localToken = useRef(createCancellation());
  const cancelFns = useRef({
    check: () => {},
    cancel: () => {},
    reset: () => {},
  });
  cancelFns.current.check = progressCtx
    ? progressCtx.throwIfCancelled
    : () => localToken.current.throwIfCancelled();
  cancelFns.current.cancel = progressCtx ? progressCtx.cancel : () => localToken.current.cancel();
  cancelFns.current.reset = progressCtx
    ? progressCtx.resetCancellation
    : () => localToken.current.reset();

  const isCancelled = progressCtx ? progressCtx.isCancelled : localToken.current.isCancelled;

  const cancelOperation = useCallback(() => {
    cancelFns.current.cancel();
    onResult?.('Operation cancelled by user', 'warning');
  }, [onResult]);

  const checkCancelled = useCallback(() => {
    cancelFns.current.check();
  }, []);

  const resetCancellation = useCallback(() => {
    cancelFns.current.reset();
  }, []);

  // Stable ProgressBridge for coreApi.runOperation. Ref-indirection keeps these
  // identities constant even though the progress context value changes on every
  // tick (which would otherwise rebuild the memoized coreApi mid-operation).
  const progressFns = useRef({
    start: (_name: string, _total: number) => {},
    reportBatch: (
      _p: { total: number; completed: number; active: number; failed: number },
      _m?: string,
    ) => {},
    complete: () => {},
  });
  progressFns.current.start = progressCtx
    ? (name, total) => progressCtx.startProgress(name, `${name}…`, total)
    : () => {};
  progressFns.current.reportBatch = progressCtx ? progressCtx.updateBatch : () => {};
  progressFns.current.complete = progressCtx ? progressCtx.completeProgress : () => {};

  const progressBridge = useMemo(
    () => ({
      start: (name: string, total: number) => progressFns.current.start(name, total),
      reportBatch: (
        p: { total: number; completed: number; active: number; failed: number },
        m?: string,
      ) => progressFns.current.reportBatch(p, m),
      complete: () => progressFns.current.complete(),
    }),
    [],
  );

  // Every operation object below is memoized. Without this, each render rebuilds
  // coreApi and all nine operation objects, so every function this hook returns has
  // a fresh identity on every render — and any effect that lists one in its deps
  // re-runs forever. Callers must pass stable onResult/onProgress (useCallback) or
  // these memos are defeated.
  const coreApi = useMemo(
    () =>
      createCoreApi(targetTabId, checkCancelled, resetCancellation, progressBridge, {
        onResult,
        onProgress,
      }),
    [targetTabId, checkCancelled, resetCancellation, progressBridge, onResult, onProgress],
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
  const appOps = useMemo(() => createAppOperations(coreApi), [coreApi]);
  const exportOps = useMemo(() => createExportOperations(coreApi), [coreApi]);
  const exportEngineOps = useMemo(() => createExportEngineOperations(coreApi), [coreApi]);
  const pushGroupOps = useMemo(() => createPushGroupOperations(coreApi), [coreApi]);
  const groupAnalysisOps = useMemo(
    () => createGroupAnalysisOperations(groupMemberOps.getAllGroupMembers),
    [groupMemberOps],
  );
  const ruleImpactOps = useMemo(
    () => createRuleImpactOperations(coreApi, groupMemberOps.getAllGroupMembers),
    [coreApi, groupMemberOps],
  );
  const ruleWriteOps = useMemo(() => createRuleWriteOperations(coreApi), [coreApi]);

  const wrapOperation = useCallback(<A extends unknown[]>(fn: (...args: A) => Promise<void>) => {
    return async (...args: A) => {
      cancelFns.current.reset();
      setIsLoading(true);
      try {
        await fn(...args);
      } finally {
        setIsLoading(false);
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
      searchApps: appOps.searchApps,
      suspendUser: userOps.suspendUser,
      unsuspendUser: userOps.unsuspendUser,
      resetPassword: userOps.resetPassword,

      // Export operations
      exportMembers,

      // Descriptor-driven Export Engine (Export tab)
      fetchExportRows: exportEngineOps.fetchAllRows,
      countExportRows: exportEngineOps.countRows,
      runExport: exportEngineOps.runExport,

      // Push group operations
      getAppPushGroupMappings: pushGroupOps.getAppPushGroupMappings,
      applyPushGroupMappings: pushGroupOps.applyPushGroupMappings,

      // Group analysis operations
      compareGroups: groupAnalysisOps.compareGroups,
      searchUserAcrossGroups: groupAnalysisOps.searchUserAcrossGroups,
      calculateStaleness: groupAnalysisOps.calculateStaleness,

      // Rule impact preview (read-only)
      captureRuleImpact: ruleImpactOps.captureRuleImpact,

      // Rule consolidation writes (A4)
      getRawGroupRule: ruleWriteOps.getRawGroupRule,
      createGroupRule: ruleWriteOps.createGroupRule,
      deleteGroupRule: ruleWriteOps.deleteGroupRule,
      activateGroupRule: ruleWriteOps.activateGroupRule,
      deactivateGroupRule: ruleWriteOps.deactivateGroupRule,
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
      appOps,
      exportOps,
      exportEngineOps,
      pushGroupOps,
      groupAnalysisOps,
      ruleImpactOps,
      ruleWriteOps,
      removeDeprovisioned,
      exportMembers,
    ],
  );
}
