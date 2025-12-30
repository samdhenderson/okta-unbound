/**
 * @module hooks/useOktaApi/exportOperations
 * @description Export operations for group members
 */

import type { CoreApi } from './core';
import type { UserStatus, AuditLogEntry } from './types';
import { auditStore } from '../../../shared/storage/auditStore';

export function createExportOperations(coreApi: CoreApi) {
  /**
   * Export group members to CSV or JSON format
   */
  const exportMembers = async (
    groupId: string,
    groupName: string,
    format: 'csv' | 'json',
    statusFilter?: UserStatus | ''
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
        coreApi.callbacks.onResult?.(`Export complete: ${response.count} members exported`, 'success');

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
            console.error('[useOktaApi] Failed to log audit entry:', err);
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
          console.error('[useOktaApi] Failed to log audit entry:', err);
        });
      }
    }
  };

  return {
    exportMembers,
  };
}
