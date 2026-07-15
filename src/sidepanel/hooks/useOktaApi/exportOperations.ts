/**
 * @module hooks/useOktaApi/exportOperations
 * @description Export operations for group members
 */

import type { CoreApi } from './core';
import type { UserStatus, AuditLogEntry } from './types';
import { auditStore } from '../../../shared/storage/auditStore';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useOktaApi');

/**
 * Build the group-member export operation.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns `{ exportMembers }`.
 */
export function createExportOperations(coreApi: CoreApi) {
  /**
   * Export a group's members to CSV or JSON, then record the outcome to the audit trail.
   *
   * @param groupId - Group whose members to export.
   * @param groupName - Human-readable group name (used in audit + result messages).
   * @param format - Output format: `'csv'` or `'json'`.
   * @param statusFilter - Optional {@link UserStatus} to include only matching members; `''`/omitted = all.
   * @remarks Delegates the fetch-and-serialize to the content script via
   * {@link CoreApi.sendMessage} (`exportGroupMembers`), which streams the file to
   * download. Success and failure are logged to {@link auditStore} as fire-and-forget
   * audit entries; audit-write failures are swallowed (logged only).
   */
  const exportMembers = async (
    groupId: string,
    groupName: string,
    format: 'csv' | 'json',
    statusFilter?: UserStatus | '',
  ) => {
    const startTime = Date.now();
    let currentUser: { email: string; id: string } | null = null;

    try {
      coreApi.callbacks.onResult?.(`Starting export: ${format.toUpperCase()} format`, 'info');

      // Get current user for audit logging
      currentUser = await coreApi.getCurrentUser();

      const response = await coreApi.sendMessage({
        action: 'exportGroupMembers',
        groupId,
        groupName,
        format,
        statusFilter,
      });

      if (response.success) {
        coreApi.callbacks.onResult?.(
          `Export complete: ${response.count} members exported`,
          'success',
        );

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
            log.error('Failed to log audit entry:', err);
          });
        }
      } else {
        coreApi.callbacks.onResult?.(`Export failed: ${response.error}`, 'error');

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
            log.error('Failed to log audit entry:', err);
          });
        }
      }
    } catch (error) {
      const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      coreApi.callbacks.onResult?.(errorMsg, 'error');

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
          log.error('Failed to log audit entry:', err);
        });
      }
    }
  };

  return {
    exportMembers,
  };
}
