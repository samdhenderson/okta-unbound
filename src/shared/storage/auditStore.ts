/**
 * @module shared/storage/auditStore
 * @description IndexedDB-backed store for the operation audit trail.
 *
 * Persists {@link AuditLogEntry} records (indexed by timestamp, group, action,
 * actor, and result) plus a single settings row. Supports filtered queries,
 * statistics, CSV export, retention-based and full clears. Logging is
 * fire-and-forget: failures are logged and never propagate to callers. Exposed as
 * the {@link auditStore} singleton.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { createLogger } from '../utils/logger';
import type { AuditLogEntry, AuditFilters, AuditStats, AuditSettings } from '../types';

const log = createLogger('AuditStore');

interface AuditDB extends DBSchema {
  operations: {
    key: string;
    value: AuditLogEntry;
    indexes: {
      timestamp: Date;
      groupId: string;
      action: string;
      performedBy: string;
      result: string;
    };
  };
  settings: {
    key: string;
    value: AuditSettings;
  };
}

const DB_NAME = 'okta-unbound-audit';
const DB_VERSION = 1;
const STORE_NAME = 'operations';
const SETTINGS_STORE = 'settings';

/**
 * IndexedDB audit-trail store. Lazily opens the database on first use and reuses
 * the connection. Prefer the shared {@link auditStore} singleton over constructing
 * new instances.
 */
class AuditStore {
  private dbPromise: Promise<IDBPDatabase<AuditDB>> | null = null;

  private async getDB(): Promise<IDBPDatabase<AuditDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<AuditDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Create operations store with indexes
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const operationsStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            operationsStore.createIndex('timestamp', 'timestamp');
            operationsStore.createIndex('groupId', 'groupId');
            operationsStore.createIndex('action', 'action');
            operationsStore.createIndex('performedBy', 'performedBy');
            operationsStore.createIndex('result', 'result');
          }

          // Create settings store
          if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
            db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Log an operation to the audit trail
   * Fire-and-forget - errors are logged but don't block operations
   */
  async logOperation(entry: AuditLogEntry): Promise<void> {
    try {
      // Check if audit logging is enabled
      const settings = await this.getSettings();
      if (!settings.enabled) {
        log.debug('Audit logging is disabled, skipping log entry');
        return;
      }

      const db = await this.getDB();

      // Ensure timestamp is a Date object
      const entryToStore = {
        ...entry,
        timestamp: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
      };

      await db.add(STORE_NAME, entryToStore);
      log.debug('Logged operation:', entry.action, entry.id);
    } catch (error) {
      log.error('Failed to log operation:', error);
      // Don't throw - audit logging should never block operations
    }
  }

  /**
   * Get audit history with optional filtering and limit
   */
  async getHistory(filters: AuditFilters = {}, limit?: number): Promise<AuditLogEntry[]> {
    try {
      const db = await this.getDB();
      let results: AuditLogEntry[] = [];

      // If we have a specific filter that can use an index, use it
      if (filters.groupId) {
        results = await db.getAllFromIndex(STORE_NAME, 'groupId', filters.groupId);
      } else if (filters.action) {
        results = await db.getAllFromIndex(STORE_NAME, 'action', filters.action);
      } else if (filters.performedBy) {
        results = await db.getAllFromIndex(STORE_NAME, 'performedBy', filters.performedBy);
      } else if (filters.result) {
        results = await db.getAllFromIndex(STORE_NAME, 'result', filters.result);
      } else {
        results = await db.getAll(STORE_NAME);
      }

      // Apply additional filters
      results = results.filter((entry) => {
        if (filters.groupId && entry.groupId !== filters.groupId) return false;
        if (filters.action && entry.action !== filters.action) return false;
        if (filters.performedBy && entry.performedBy !== filters.performedBy) return false;
        if (filters.result && entry.result !== filters.result) return false;

        const entryDate = new Date(entry.timestamp);
        if (filters.startDate && entryDate < filters.startDate) return false;
        if (filters.endDate && entryDate > filters.endDate) return false;

        return true;
      });

      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply limit if specified
      if (limit && limit > 0) {
        results = results.slice(0, limit);
      }

      return results;
    } catch (error) {
      log.error('Failed to get history:', error);
      return [];
    }
  }

  /**
   * Export audit log to CSV blob
   */
  async exportAuditLog(startDate: Date, endDate: Date): Promise<Blob> {
    try {
      const entries = await this.getHistory({ startDate, endDate });

      // CSV header
      const header =
        'Timestamp,Action,Group,Performed By,Result,Users Affected,Users Succeeded,Users Failed,Duration (ms),API Requests,Errors\n';

      // CSV rows
      const rows = entries.map((entry) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const errors = entry.details.errorMessages?.join('; ') || '';

        return [
          timestamp,
          entry.action,
          `"${entry.groupName}"`,
          entry.performedBy,
          entry.result,
          entry.affectedUsers.length,
          entry.details.usersSucceeded,
          entry.details.usersFailed,
          entry.details.durationMs,
          entry.details.apiRequestCount,
          `"${errors}"`,
        ].join(',');
      });

      const csvContent = header + rows.join('\n');
      return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    } catch (error) {
      log.error('Failed to export audit log:', error);
      throw error;
    }
  }

  /**
   * Clear logs older than retention period
   */
  async clearOldLogs(retentionDays: number): Promise<void> {
    try {
      const db = await this.getDB();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Get all entries older than cutoff
      const allEntries = await db.getAll(STORE_NAME);
      const oldEntries = allEntries.filter((entry) => new Date(entry.timestamp) < cutoffDate);

      // Delete old entries
      const tx = db.transaction(STORE_NAME, 'readwrite');
      for (const entry of oldEntries) {
        await tx.store.delete(entry.id);
      }
      await tx.done;

      log.debug(`Cleared ${oldEntries.length} old log entries`);
    } catch (error) {
      log.error('Failed to clear old logs:', error);
    }
  }

  /**
   * Get audit statistics
   */
  async getStats(): Promise<AuditStats> {
    try {
      const db = await this.getDB();
      const allEntries = await db.getAll(STORE_NAME);

      // Calculate stats
      const totalOperations = allEntries.length;
      const operationsByType: Record<string, number> = {};
      let totalUsersAffected = 0;
      let totalApiRequests = 0;
      let successfulOperations = 0;

      // Last week date
      const lastWeekDate = new Date();
      lastWeekDate.setDate(lastWeekDate.getDate() - 7);
      let lastWeekOperations = 0;

      for (const entry of allEntries) {
        // Count by type
        operationsByType[entry.action] = (operationsByType[entry.action] || 0) + 1;

        // Total users affected
        totalUsersAffected += entry.affectedUsers.length;

        // Total API requests
        totalApiRequests += entry.details.apiRequestCount;

        // Success rate
        if (entry.result === 'success') {
          successfulOperations++;
        }

        // Last week operations
        if (new Date(entry.timestamp) >= lastWeekDate) {
          lastWeekOperations++;
        }
      }

      const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;

      return {
        totalOperations,
        operationsByType,
        successRate,
        totalUsersAffected,
        totalApiRequests,
        lastWeekOperations,
      };
    } catch (error) {
      log.error('Failed to get stats:', error);
      return {
        totalOperations: 0,
        operationsByType: {},
        successRate: 0,
        totalUsersAffected: 0,
        totalApiRequests: 0,
        lastWeekOperations: 0,
      };
    }
  }

  /**
   * Get current audit settings
   */
  async getSettings(): Promise<AuditSettings> {
    try {
      const db = await this.getDB();
      const settings = await db.get(SETTINGS_STORE, 'default');

      // Return default settings if not found
      return settings || { enabled: true, retentionDays: 90 };
    } catch (error) {
      log.error('Failed to get settings:', error);
      return { enabled: true, retentionDays: 90 };
    }
  }

  /**
   * Update audit settings
   */
  async updateSettings(settings: AuditSettings): Promise<void> {
    try {
      const db = await this.getDB();
      const storedSettings = { ...settings, id: 'default' as const };
      await db.put(SETTINGS_STORE, storedSettings);
      log.debug('Updated settings:', settings);
    } catch (error) {
      log.error('Failed to update settings:', error);
      throw error;
    }
  }

  /**
   * Clear all audit logs (for GDPR compliance)
   */
  async clearAllLogs(): Promise<void> {
    try {
      const db = await this.getDB();
      await db.clear(STORE_NAME);
      log.info('Cleared all audit logs');
    } catch (error) {
      log.error('Failed to clear all logs:', error);
      throw error;
    }
  }

  /**
   * Get storage usage estimate
   */
  async getStorageUsage(): Promise<{ used: number; quota: number }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          quota: estimate.quota || 0,
        };
      }
      return { used: 0, quota: 0 };
    } catch (error) {
      log.error('Failed to get storage usage:', error);
      return { used: 0, quota: 0 };
    }
  }
}

/** Shared audit-trail store singleton — use this rather than `new AuditStore()`. */
export const auditStore = new AuditStore();
export default auditStore;
