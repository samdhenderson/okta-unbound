import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auditStore } from './auditStore';
import type { AuditLogEntry, AuditSettings } from '../types';

// Mock IndexedDB
const mockDB: any = {
  add: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  getAllFromIndex: vi.fn(),
  put: vi.fn(),
  clear: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
};

// Mock idb
vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB)),
}));

describe('AuditStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logOperation', () => {
    it('should log an operation when audit logging is enabled', async () => {
      const mockSettings: AuditSettings = { enabled: true, retentionDays: 90 };
      mockDB.get.mockResolvedValueOnce(mockSettings);
      mockDB.add.mockResolvedValueOnce(undefined);

      const entry: AuditLogEntry = {
        id: 'test-id',
        timestamp: new Date(),
        action: 'remove_users',
        groupId: 'test-group',
        groupName: 'Test Group',
        performedBy: 'admin@example.com',
        affectedUsers: ['user1', 'user2'],
        result: 'success',
        details: {
          usersSucceeded: 2,
          usersFailed: 0,
          apiRequestCount: 2,
          durationMs: 1000,
        },
      };

      await auditStore.logOperation(entry);

      expect(mockDB.add).toHaveBeenCalled();
    });

    it('should not log when audit logging is disabled', async () => {
      const mockSettings: AuditSettings = { enabled: false, retentionDays: 90 };
      mockDB.get.mockResolvedValueOnce(mockSettings);

      const entry: AuditLogEntry = {
        id: 'test-id',
        timestamp: new Date(),
        action: 'remove_users',
        groupId: 'test-group',
        groupName: 'Test Group',
        performedBy: 'admin@example.com',
        affectedUsers: [],
        result: 'success',
        details: {
          usersSucceeded: 0,
          usersFailed: 0,
          apiRequestCount: 0,
          durationMs: 100,
        },
      };

      await auditStore.logOperation(entry);

      expect(mockDB.add).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return all entries when no filters are provided', async () => {
      const mockEntries: AuditLogEntry[] = [
        {
          id: '1',
          timestamp: new Date('2025-01-15'),
          action: 'remove_users',
          groupId: 'group1',
          groupName: 'Group 1',
          performedBy: 'admin@example.com',
          affectedUsers: ['user1'],
          result: 'success',
          details: {
            usersSucceeded: 1,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: 500,
          },
        },
        {
          id: '2',
          timestamp: new Date('2025-01-14'),
          action: 'export',
          groupId: 'group1',
          groupName: 'Group 1',
          performedBy: 'admin@example.com',
          affectedUsers: [],
          result: 'success',
          details: {
            usersSucceeded: 10,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: 200,
          },
        },
      ];

      mockDB.getAll.mockResolvedValueOnce(mockEntries);

      const result = await auditStore.getHistory();

      expect(result).toHaveLength(2);
      // Should be sorted by timestamp (newest first)
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    it('should filter by groupId', async () => {
      const mockEntries: AuditLogEntry[] = [
        {
          id: '1',
          timestamp: new Date('2025-01-15'),
          action: 'remove_users',
          groupId: 'group1',
          groupName: 'Group 1',
          performedBy: 'admin@example.com',
          affectedUsers: [],
          result: 'success',
          details: {
            usersSucceeded: 1,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: 500,
          },
        },
      ];

      mockDB.getAllFromIndex.mockResolvedValueOnce(mockEntries);

      const result = await auditStore.getHistory({ groupId: 'group1' });

      expect(mockDB.getAllFromIndex).toHaveBeenCalledWith('operations', 'groupId', 'group1');
      expect(result).toHaveLength(1);
    });

    it('should limit results when limit is specified', async () => {
      const mockEntries: AuditLogEntry[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `${i}`,
          timestamp: new Date(`2025-01-${i + 1}`),
          action: 'remove_users' as const,
          groupId: 'group1',
          groupName: 'Group 1',
          performedBy: 'admin@example.com',
          affectedUsers: [],
          result: 'success' as const,
          details: {
            usersSucceeded: 1,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: 500,
          },
        }));

      mockDB.getAll.mockResolvedValueOnce(mockEntries);

      const result = await auditStore.getHistory({}, 5);

      expect(result).toHaveLength(5);
    });
  });

  describe('getStats', () => {
    it('should calculate correct statistics', async () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const mockEntries: AuditLogEntry[] = [
        {
          id: '1',
          timestamp: lastWeek,
          action: 'remove_users',
          groupId: 'group1',
          groupName: 'Group 1',
          performedBy: 'admin@example.com',
          affectedUsers: ['user1', 'user2'],
          result: 'success',
          details: {
            usersSucceeded: 2,
            usersFailed: 0,
            apiRequestCount: 2,
            durationMs: 500,
          },
        },
        {
          id: '2',
          timestamp: twoWeeksAgo,
          action: 'export',
          groupId: 'group1',
          groupName: 'Group 1',
          performedBy: 'admin@example.com',
          affectedUsers: [],
          result: 'failed',
          details: {
            usersSucceeded: 0,
            usersFailed: 0,
            apiRequestCount: 1,
            durationMs: 100,
          },
        },
      ];

      mockDB.getAll.mockResolvedValueOnce(mockEntries);

      const stats = await auditStore.getStats();

      expect(stats.totalOperations).toBe(2);
      expect(stats.successRate).toBe(50); // 1 success out of 2
      expect(stats.totalUsersAffected).toBe(2);
      expect(stats.totalApiRequests).toBe(3);
      expect(stats.lastWeekOperations).toBe(1);
      expect(stats.operationsByType).toEqual({
        remove_users: 1,
        export: 1,
      });
    });
  });

  describe('updateSettings', () => {
    it('should update settings', async () => {
      mockDB.put.mockResolvedValueOnce(undefined);

      const settings: AuditSettings = {
        enabled: false,
        retentionDays: 30,
      };

      await auditStore.updateSettings(settings);

      expect(mockDB.put).toHaveBeenCalledWith('settings', { ...settings, id: 'default' });
    });
  });

  describe('clearAllLogs', () => {
    it('should clear all audit logs', async () => {
      mockDB.clear.mockResolvedValueOnce(undefined);

      await auditStore.clearAllLogs();

      expect(mockDB.clear).toHaveBeenCalledWith('operations');
    });
  });
});
