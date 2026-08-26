import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { auditStore } from './auditStore';
import type {
  ActorResolution,
  AuditLogEntry,
  AuditSettings,
  PersistedAuditLogEntry,
} from '../types';

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
        actorResolution: 'resolved',
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
        actorResolution: 'resolved',
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
          actorResolution: 'resolved',
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
          actorResolution: 'resolved',
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
          actorResolution: 'resolved',
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
          actorResolution: 'resolved',
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
          actorResolution: 'resolved',
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
          actorResolution: 'resolved',
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

  // -------------------------------------------------------------------------
  // Timestamp-index paths (jsdom has no IndexedDB, so IDBKeyRange is stubbed
  // with tagged marker objects we can assert against).
  // -------------------------------------------------------------------------
  describe('timestamp index paths', () => {
    const fakeIDBKeyRange = {
      bound: vi.fn((lower: Date, upper: Date) => ({ kind: 'bound', lower, upper })),
      lowerBound: vi.fn((lower: Date) => ({ kind: 'lowerBound', lower })),
      upperBound: vi.fn((upper: Date, open?: boolean) => ({ kind: 'upperBound', upper, open })),
    };

    const indexEntry = (id: string, timestamp: Date): AuditLogEntry => ({
      id,
      timestamp,
      action: 'remove_users',
      groupId: 'group1',
      groupName: 'Group 1',
      performedBy: 'admin@example.com',
      actorResolution: 'resolved',
      affectedUsers: [],
      result: 'success',
      details: { usersSucceeded: 1, usersFailed: 0, apiRequestCount: 1, durationMs: 500 },
    });

    beforeEach(() => {
      vi.stubGlobal('IDBKeyRange', fakeIDBKeyRange);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('date-scoped getHistory reads only the bounded timestamp range, never getAll', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-02-01');
      const inRangeOld = indexEntry('old', new Date('2025-01-10'));
      const inRangeNew = indexEntry('new', new Date('2025-01-20'));
      mockDB.getAllFromIndex.mockResolvedValueOnce([inRangeOld, inRangeNew]);

      const result = await auditStore.getHistory({ startDate, endDate });

      expect(mockDB.getAllFromIndex).toHaveBeenCalledWith('operations', 'timestamp', {
        kind: 'bound',
        lower: startDate,
        upper: endDate,
      });
      expect(mockDB.getAll).not.toHaveBeenCalled();
      // Result shape/ordering promise holds: newest first.
      expect(result.map((e) => e.id)).toEqual(['new', 'old']);
    });

    it('startDate-only uses a lower bound; endDate-only uses an upper bound', async () => {
      const startDate = new Date('2025-03-01');
      mockDB.getAllFromIndex.mockResolvedValueOnce([]);
      await auditStore.getHistory({ startDate });
      expect(mockDB.getAllFromIndex).toHaveBeenLastCalledWith('operations', 'timestamp', {
        kind: 'lowerBound',
        lower: startDate,
      });

      const endDate = new Date('2025-04-01');
      mockDB.getAllFromIndex.mockResolvedValueOnce([]);
      await auditStore.getHistory({ endDate });
      expect(mockDB.getAllFromIndex).toHaveBeenLastCalledWith('operations', 'timestamp', {
        kind: 'upperBound',
        upper: endDate,
        open: undefined,
      });
      expect(mockDB.getAll).not.toHaveBeenCalled();
    });

    it('an equality filter plus dates keeps the equality index and date-filters in JS', async () => {
      const startDate = new Date('2025-01-01');
      const kept = indexEntry('kept', new Date('2025-01-10'));
      const tooOld = indexEntry('too-old', new Date('2024-12-01'));
      mockDB.getAllFromIndex.mockResolvedValueOnce([kept, tooOld]);

      const result = await auditStore.getHistory({ groupId: 'group1', startDate });

      expect(mockDB.getAllFromIndex).toHaveBeenCalledWith('operations', 'groupId', 'group1');
      expect(result.map((e) => e.id)).toEqual(['kept']);
    });

    it('clearOldLogs walks a cursor over the expired range, deleting as it goes', async () => {
      const second = {
        delete: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(null),
      };
      const first = {
        delete: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockResolvedValue(second),
      };
      const openCursor = vi.fn().mockResolvedValue(first);
      const transaction = {
        store: { index: vi.fn(() => ({ openCursor })) },
        done: Promise.resolve(),
      };
      mockDB.transaction.mockReturnValueOnce(transaction);

      await auditStore.clearOldLogs(30);

      expect(mockDB.transaction).toHaveBeenCalledWith('operations', 'readwrite');
      expect(transaction.store.index).toHaveBeenCalledWith('timestamp');
      // Strictly-older-than cutoff: an OPEN upper bound.
      expect(openCursor).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'upperBound', open: true }),
      );
      expect(first.delete).toHaveBeenCalledTimes(1);
      expect(second.delete).toHaveBeenCalledTimes(1);
      // The full-table read is gone.
      expect(mockDB.getAll).not.toHaveBeenCalled();
      expect(mockDB.delete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // D-032: the DB predates `actorResolution`, so a row can lack it. `getHistory`
  // must neither invent a value nor promise one in its type.
  // -------------------------------------------------------------------------
  describe('rows persisted before actorResolution existed', () => {
    /**
     * Compile-time assertion helper: accepts only a value that is definitely an
     * {@link ActorResolution}. Paired with `@ts-expect-error` below to pin that
     * a row out of `getHistory` is *not* one.
     */
    const requireResolution = (_value: ActorResolution): void => {};

    /** A row as written before `D-013a`: the `actorResolution` key is absent. */
    const legacyRow = (): PersistedAuditLogEntry => ({
      id: 'legacy-1',
      timestamp: new Date('2024-11-02T00:00:00.000Z'),
      action: 'remove_users',
      groupId: '00gFAKE1',
      groupName: 'Legacy Group',
      performedBy: 'admin@example.com',
      affectedUsers: ['00uFAKE1'],
      result: 'success',
      details: { usersSucceeded: 1, usersFailed: 0, apiRequestCount: 1, durationMs: 500 },
    });

    it('getHistory returns the row untouched and does not promise the field', async () => {
      mockDB.getAll.mockResolvedValueOnce([legacyRow()]);

      const [row] = await auditStore.getHistory();

      // No back-fill: the absent field stays absent, rather than becoming
      // 'resolved' (a claim the writer never made) or 'unavailable' (a claim
      // contradicted by the actor string the row does carry).
      expect('actorResolution' in row).toBe(false);
      expect(row.actorResolution).toBeUndefined();
      expect(row.performedBy).toBe('admin@example.com');

      // @ts-expect-error `PersistedAuditLogEntry.actorResolution` is optional, so
      // a reader is told about the gap by the compiler instead of meeting a bare
      // `undefined` at runtime. Without D-032's split type this line compiles and
      // the expect-error is reported as unused.
      requireResolution(row.actorResolution);
    });
  });

  // -------------------------------------------------------------------------
  describe('exportAuditLog CSV', () => {
    const fakeIDBKeyRange = {
      bound: vi.fn((lower: Date, upper: Date) => ({ kind: 'bound', lower, upper })),
      lowerBound: vi.fn((lower: Date) => ({ kind: 'lowerBound', lower })),
      upperBound: vi.fn((upper: Date, open?: boolean) => ({ kind: 'upperBound', upper, open })),
    };

    const exportEntry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
      id: 'csv-1',
      timestamp: new Date('2025-01-15T00:00:00.000Z'),
      action: 'export',
      groupId: '00gFAKE1',
      groupName: 'Sales "VIP", EMEA',
      performedBy: '=1+1',
      actorResolution: 'resolved',
      affectedUsers: [],
      result: 'success',
      details: { usersSucceeded: 0, usersFailed: 0, apiRequestCount: 1, durationMs: 10 },
      ...overrides,
    });

    beforeEach(() => {
      vi.stubGlobal('IDBKeyRange', fakeIDBKeyRange);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** Read a Blob as text — jsdom's Blob has no `text()`. */
    function readBlob(blob: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new globalThis.FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
    }

    /** The single data row of the exported CSV. */
    async function exportRow(entries: PersistedAuditLogEntry[]): Promise<string> {
      mockDB.getAllFromIndex.mockResolvedValueOnce(entries);
      const blob = await auditStore.exportAuditLog(
        new Date('2025-01-01T00:00:00.000Z'),
        new Date('2025-02-01T00:00:00.000Z'),
      );
      return (await readBlob(blob)).split('\n')[1];
    }

    it('escapes every cell: quotes are doubled and a formula-triggering actor is neutralized', async () => {
      const row = await exportRow([exportEntry()]);

      // RFC 4180: embedded quotes doubled, field wrapped once.
      expect(row).toContain('"Sales ""VIP"", EMEA"');
      // Formula-injection guard on the actor cell.
      expect(row).toContain(",'=1+1,");
      expect(row).not.toContain(',=1+1,');
    });

    it('renders an unresolved actor as an explicit label, not a blank or invented cell', async () => {
      const row = await exportRow([
        exportEntry({
          groupName: 'Plain Group',
          performedBy: null,
          actorResolution: 'unavailable',
        }),
      ]);

      expect(row.split(',')[3]).toBe('(actor unavailable)');
    });

    it('exports a pre-D-013a row with its stored actor, not the unavailable label', async () => {
      // The row carries an actor string but no `actorResolution` (D-032). The
      // export decides the cell from `performedBy` alone, so it must not be
      // mistaken for an unresolved actor.
      const legacy: PersistedAuditLogEntry = {
        id: 'legacy-csv',
        timestamp: new Date('2025-01-15T00:00:00.000Z'),
        action: 'export',
        groupId: '00gFAKE1',
        groupName: 'Plain Group',
        performedBy: 'admin@example.com',
        affectedUsers: [],
        result: 'success',
        details: { usersSucceeded: 0, usersFailed: 0, apiRequestCount: 1, durationMs: 10 },
      };

      const row = await exportRow([legacy]);

      expect(row.split(',')[3]).toBe('admin@example.com');
    });
  });

  describe('settings cache', () => {
    it('logOperation skips the per-write settings read once updateSettings primed the cache', async () => {
      mockDB.put.mockResolvedValueOnce(undefined);
      await auditStore.updateSettings({ enabled: true, retentionDays: 90 });
      vi.clearAllMocks();

      mockDB.add.mockResolvedValueOnce(undefined);
      const entry: AuditLogEntry = {
        id: 'cached-settings-entry',
        timestamp: new Date(),
        action: 'remove_users',
        groupId: 'test-group',
        groupName: 'Test Group',
        performedBy: 'admin@example.com',
        actorResolution: 'resolved',
        affectedUsers: ['user1'],
        result: 'success',
        details: { usersSucceeded: 1, usersFailed: 0, apiRequestCount: 1, durationMs: 100 },
      };
      await auditStore.logOperation(entry);

      expect(mockDB.get).not.toHaveBeenCalled();
      expect(mockDB.add).toHaveBeenCalled();
    });

    it('updateSettings replaces the cached snapshot (a disable takes effect immediately)', async () => {
      mockDB.put.mockResolvedValueOnce(undefined);
      await auditStore.updateSettings({ enabled: false, retentionDays: 90 });

      await auditStore.logOperation({
        id: 'disabled-entry',
        timestamp: new Date(),
        action: 'remove_users',
        groupId: 'test-group',
        groupName: 'Test Group',
        performedBy: 'admin@example.com',
        actorResolution: 'resolved',
        affectedUsers: [],
        result: 'success',
        details: { usersSucceeded: 0, usersFailed: 0, apiRequestCount: 0, durationMs: 100 },
      });

      expect(mockDB.get).not.toHaveBeenCalled();
      expect(mockDB.add).not.toHaveBeenCalled();
    });
  });
});
