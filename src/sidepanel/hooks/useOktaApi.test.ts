import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOktaApi } from './useOktaApi';
import type { OktaUser, MessageResponse } from '../../shared/types';

// Mock chrome APIs
const mockSendMessage = vi.fn();
global.chrome = {
  tabs: {
    sendMessage: mockSendMessage,
  },
} as any;

// Mock undo manager
vi.mock('../../shared/undoManager', () => ({
  logAction: vi.fn(),
}));

describe('useOktaApi', () => {
  const targetTabId = 123;
  const mockOnResult = vi.fn();
  const mockOnProgress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendMessage', () => {
    it('should send message to target tab', async () => {
      const mockResponse: MessageResponse = {
        success: true,
        data: { test: 'data' },
      };
      mockSendMessage.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      const response = await act(async () => {
        return result.current.makeApiRequest('/api/v1/test');
      });

      expect(mockSendMessage).toHaveBeenCalledWith(targetTabId, {
        action: 'makeApiRequest',
        endpoint: '/api/v1/test',
        method: 'GET',
        body: undefined,
      });
      expect(response).toEqual(mockResponse);
    });

    it('should throw error when no target tab ID', async () => {
      const { result } = renderHook(() =>
        useOktaApi({ targetTabId: null, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await expect(async () => {
        await result.current.makeApiRequest('/api/v1/test');
      }).rejects.toThrow('No target tab ID - not connected to Okta page');
    });
  });

  describe('getAllGroupMembers - Pagination', () => {
    it('should fetch all pages with exactly 200 members', async () => {
      const page1Users: OktaUser[] = Array.from({ length: 200 }, (_, i) => ({
        id: `user${i + 1}`,
        status: 'ACTIVE',
        profile: {
          login: `user${i + 1}@example.com`,
          email: `user${i + 1}@example.com`,
          firstName: `First${i + 1}`,
          lastName: `Last${i + 1}`,
        },
      }));

      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: page1Users,
        headers: {
          link: '<https://example.okta.com/api/v1/groups/group1/users?limit=200&after=cursor1>; rel="next"',
        },
      });

      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: [],
        headers: {},
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      const members = await act(async () => {
        return result.current.getAllGroupMembers('group1');
      });

      expect(members).toHaveLength(200);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockOnResult).toHaveBeenCalledWith('Fetching page 1...', 'info');
      expect(mockOnResult).toHaveBeenCalledWith('Fetching page 2...', 'info');
    });

    it('should fetch all pages with 201 members (2 pages)', async () => {
      const page1Users: OktaUser[] = Array.from({ length: 200 }, (_, i) => ({
        id: `user${i + 1}`,
        status: 'ACTIVE',
        profile: {
          login: `user${i + 1}@example.com`,
          email: `user${i + 1}@example.com`,
          firstName: `First${i + 1}`,
          lastName: `Last${i + 1}`,
        },
      }));

      const page2Users: OktaUser[] = [{
        id: 'user201',
        status: 'ACTIVE',
        profile: {
          login: 'user201@example.com',
          email: 'user201@example.com',
          firstName: 'First201',
          lastName: 'Last201',
        },
      }];

      mockSendMessage
        .mockResolvedValueOnce({
          success: true,
          data: page1Users,
          headers: {
            link: '<https://example.okta.com/api/v1/groups/group1/users?limit=200&after=cursor1>; rel="next"',
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: page2Users,
          headers: {},
        });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      const members = await act(async () => {
        return result.current.getAllGroupMembers('group1');
      });

      expect(members).toHaveLength(201);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockOnResult).toHaveBeenCalledWith(
        'Page 1: Loaded 200 members (Total: 200)',
        'info'
      );
      expect(mockOnResult).toHaveBeenCalledWith(
        'Page 2: Loaded 1 members (Total: 201)',
        'info'
      );
    });

    it('should fetch all pages with 1000+ members (6 pages)', async () => {
      const createMockUsers = (start: number, count: number): OktaUser[] =>
        Array.from({ length: count }, (_, i) => ({
          id: `user${start + i + 1}`,
          status: 'ACTIVE',
          profile: {
            login: `user${start + i + 1}@example.com`,
            email: `user${start + i + 1}@example.com`,
            firstName: `First${start + i + 1}`,
            lastName: `Last${start + i + 1}`,
          },
        }));

      // Mock 6 pages: 5 pages of 200 + 1 page of 50 = 1050 total
      for (let i = 0; i < 5; i++) {
        mockSendMessage.mockResolvedValueOnce({
          success: true,
          data: createMockUsers(i * 200, 200),
          headers: {
            link: `<https://example.okta.com/api/v1/groups/group1/users?limit=200&after=cursor${i + 1}>; rel="next"`,
          },
        });
      }

      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: createMockUsers(1000, 50),
        headers: {},
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      const members = await act(async () => {
        return result.current.getAllGroupMembers('group1');
      });

      expect(members).toHaveLength(1050);
      expect(mockSendMessage).toHaveBeenCalledTimes(6);
    });

    it('should handle cursor-based pagination with various page sizes', async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({
        id: `user${i + 1}`,
        status: 'ACTIVE',
        profile: {
          login: `user${i + 1}@example.com`,
          email: `user${i + 1}@example.com`,
          firstName: `First${i + 1}`,
          lastName: `Last${i + 1}`,
        },
      }));

      const page2 = Array.from({ length: 100 }, (_, i) => ({
        id: `user${i + 101}`,
        status: 'ACTIVE',
        profile: {
          login: `user${i + 101}@example.com`,
          email: `user${i + 101}@example.com`,
          firstName: `First${i + 101}`,
          lastName: `Last${i + 101}`,
        },
      }));

      mockSendMessage
        .mockResolvedValueOnce({
          success: true,
          data: page1,
          headers: {
            link: '<https://example.okta.com/api/v1/groups/group1/users?limit=100&after=abc123>; rel="next"',
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: page2,
          headers: {},
        });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      const members = await act(async () => {
        return result.current.getAllGroupMembers('group1');
      });

      expect(members).toHaveLength(200);
      expect(mockSendMessage).toHaveBeenCalledWith(targetTabId, {
        action: 'makeApiRequest',
        endpoint: '/api/v1/groups/group1/users?limit=200',
        method: 'GET',
        body: undefined,
      });
    });

    it('should throw error on failed pagination request', async () => {
      mockSendMessage.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await expect(async () => {
        await result.current.getAllGroupMembers('group1');
      }).rejects.toThrow('Network error');
    });

    it('should handle Link header without next rel', async () => {
      const users: OktaUser[] = [{
        id: 'user1',
        status: 'ACTIVE',
        profile: {
          login: 'user1@example.com',
          email: 'user1@example.com',
          firstName: 'First1',
          lastName: 'Last1',
        },
      }];

      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: users,
        headers: {
          link: '<https://example.okta.com/api/v1/groups/group1/users?limit=200>; rel="self"',
        },
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      const members = await act(async () => {
        return result.current.getAllGroupMembers('group1');
      });

      expect(members).toHaveLength(1);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeDeprovisioned', () => {
    it('should remove all deprovisioned users', async () => {
      const mockUsers: OktaUser[] = [
        {
          id: 'user1',
          status: 'DEPROVISIONED',
          profile: {
            login: 'deprovisioned@example.com',
            email: 'deprovisioned@example.com',
            firstName: 'Deprovisioned',
            lastName: 'User',
          },
        },
        {
          id: 'user2',
          status: 'ACTIVE',
          profile: {
            login: 'active@example.com',
            email: 'active@example.com',
            firstName: 'Active',
            lastName: 'User',
          },
        },
      ];

      // Mock group details
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: { type: 'OKTA_GROUP', profile: { name: 'Test Group' } },
      });

      // Mock getAllGroupMembers
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: mockUsers,
        headers: {},
      });

      // Mock remove user
      mockSendMessage.mockResolvedValueOnce({
        success: true,
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await act(async () => {
        await result.current.removeDeprovisioned('group1');
      });

      await waitFor(() => {
        expect(mockOnResult).toHaveBeenCalledWith('Found 1 deprovisioned users', 'warning');
        expect(mockOnProgress).toHaveBeenCalledWith(1, 1, 'Removing user 1 of 1');
      });
    });

    it('should stop on 403 error', async () => {
      const mockUsers: OktaUser[] = [
        {
          id: 'user1',
          status: 'DEPROVISIONED',
          profile: {
            login: 'dep1@example.com',
            email: 'dep1@example.com',
            firstName: 'User',
            lastName: '1',
          },
        },
        {
          id: 'user2',
          status: 'DEPROVISIONED',
          profile: {
            login: 'dep2@example.com',
            email: 'dep2@example.com',
            firstName: 'User',
            lastName: '2',
          },
        },
      ];

      // Mock group details
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: { type: 'OKTA_GROUP', profile: { name: 'Test Group' } },
      });

      // Mock getAllGroupMembers
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: mockUsers,
        headers: {},
      });

      // Mock 403 error on first remove
      mockSendMessage.mockResolvedValueOnce({
        success: false,
        status: 403,
        error: 'Forbidden',
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await act(async () => {
        await result.current.removeDeprovisioned('group1');
      });

      await waitFor(() => {
        expect(mockOnResult).toHaveBeenCalledWith(
          expect.stringContaining('403 Forbidden'),
          'error'
        );
        expect(mockOnResult).toHaveBeenCalledWith('Stopping after first 403 error', 'warning');
      });

      // Should only attempt to remove one user due to 403 stopping
      expect(mockSendMessage).toHaveBeenCalledTimes(3); // group details + get members + 1 remove attempt
    });

    it('should not allow modification of APP_GROUP', async () => {
      // Mock APP_GROUP
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: { type: 'APP_GROUP', profile: { name: 'App Group' } },
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await act(async () => {
        await result.current.removeDeprovisioned('group1');
      });

      await waitFor(() => {
        expect(mockOnResult).toHaveBeenCalledWith('ERROR: Cannot modify APP_GROUP', 'error');
      });
    });

    it('should handle rate limiting with 100ms delays', async () => {
      vi.useFakeTimers();

      const mockUsers: OktaUser[] = Array.from({ length: 3 }, (_, i) => ({
        id: `user${i + 1}`,
        status: 'DEPROVISIONED',
        profile: {
          login: `user${i + 1}@example.com`,
          email: `user${i + 1}@example.com`,
          firstName: `User`,
          lastName: `${i + 1}`,
        },
      }));

      // Mock group details
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: { type: 'OKTA_GROUP', profile: { name: 'Test Group' } },
      });

      // Mock getAllGroupMembers
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: mockUsers,
        headers: {},
      });

      // Mock successful removes
      mockSendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      const removePromise = act(async () => {
        return result.current.removeDeprovisioned('group1');
      });

      // Advance timers to trigger rate limiting delays
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(100);
      });

      await removePromise;

      vi.useRealTimers();

      expect(mockSendMessage).toHaveBeenCalledTimes(5); // group + members + 3 removes
    });
  });

  describe('smartCleanup', () => {
    it('should remove inactive users (DEPROVISIONED, SUSPENDED, LOCKED_OUT)', async () => {
      const mockUsers: OktaUser[] = [
        {
          id: 'user1',
          status: 'DEPROVISIONED',
          profile: {
            login: 'dep@example.com',
            email: 'dep@example.com',
            firstName: 'Dep',
            lastName: 'User',
          },
        },
        {
          id: 'user2',
          status: 'SUSPENDED',
          profile: {
            login: 'susp@example.com',
            email: 'susp@example.com',
            firstName: 'Susp',
            lastName: 'User',
          },
        },
        {
          id: 'user3',
          status: 'LOCKED_OUT',
          profile: {
            login: 'locked@example.com',
            email: 'locked@example.com',
            firstName: 'Locked',
            lastName: 'User',
          },
        },
        {
          id: 'user4',
          status: 'ACTIVE',
          profile: {
            login: 'active@example.com',
            email: 'active@example.com',
            firstName: 'Active',
            lastName: 'User',
          },
        },
      ];

      // Mock group details
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: { type: 'OKTA_GROUP', profile: { name: 'Test Group' } },
      });

      // Mock getAllGroupMembers
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: mockUsers,
        headers: {},
      });

      // Mock successful removes (3 times)
      mockSendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await act(async () => {
        await result.current.smartCleanup('group1');
      });

      await waitFor(() => {
        expect(mockOnResult).toHaveBeenCalledWith('Found 3 inactive users', 'warning');
      });
    });
  });

  describe('customFilter', () => {
    it('should list users with specific status', async () => {
      const mockUsers: OktaUser[] = [
        {
          id: 'user1',
          status: 'SUSPENDED',
          profile: {
            login: 'susp1@example.com',
            email: 'susp1@example.com',
            firstName: 'Susp',
            lastName: '1',
          },
        },
        {
          id: 'user2',
          status: 'SUSPENDED',
          profile: {
            login: 'susp2@example.com',
            email: 'susp2@example.com',
            firstName: 'Susp',
            lastName: '2',
          },
        },
        {
          id: 'user3',
          status: 'ACTIVE',
          profile: {
            login: 'active@example.com',
            email: 'active@example.com',
            firstName: 'Active',
            lastName: 'User',
          },
        },
      ];

      // Mock group details
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: { type: 'OKTA_GROUP', profile: { name: 'Test Group' } },
      });

      // Mock getAllGroupMembers
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: mockUsers,
        headers: {},
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await act(async () => {
        await result.current.customFilter('group1', 'SUSPENDED', 'list');
      });

      await waitFor(() => {
        expect(mockOnResult).toHaveBeenCalledWith('Found 2 users with status SUSPENDED', 'warning');
        expect(mockOnResult).toHaveBeenCalledWith('susp1@example.com - Susp 1', 'info');
        expect(mockOnResult).toHaveBeenCalledWith('susp2@example.com - Susp 2', 'info');
        expect(mockOnResult).toHaveBeenCalledWith('Listed 2 users', 'success');
      });
    });

    it('should remove users with specific status', async () => {
      const mockUsers: OktaUser[] = [
        {
          id: 'user1',
          status: 'SUSPENDED',
          profile: {
            login: 'susp@example.com',
            email: 'susp@example.com',
            firstName: 'Susp',
            lastName: 'User',
          },
        },
      ];

      // Mock group details
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: { type: 'OKTA_GROUP', profile: { name: 'Test Group' } },
      });

      // Mock getAllGroupMembers
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: mockUsers,
        headers: {},
      });

      // Mock successful remove
      mockSendMessage.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await act(async () => {
        await result.current.customFilter('group1', 'SUSPENDED', 'remove');
      });

      await waitFor(() => {
        expect(mockOnProgress).toHaveBeenCalledWith(1, 1, 'Removing user 1 of 1');
        expect(mockOnResult).toHaveBeenCalledWith('Removed 1 users', 'success');
      });
    });
  });

  describe('exportMembers', () => {
    it('should export members in CSV format', async () => {
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        count: 150,
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await act(async () => {
        await result.current.exportMembers('group1', 'Test Group', 'csv');
      });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith(targetTabId, {
          action: 'exportGroupMembers',
          groupId: 'group1',
          groupName: 'Test Group',
          format: 'csv',
          statusFilter: undefined,
        });
        expect(mockOnResult).toHaveBeenCalledWith('Export complete: 150 members exported', 'success');
      });
    });

    it('should export members in JSON format with status filter', async () => {
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        count: 50,
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await act(async () => {
        await result.current.exportMembers('group1', 'Test Group', 'json', 'ACTIVE');
      });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith(targetTabId, {
          action: 'exportGroupMembers',
          groupId: 'group1',
          groupName: 'Test Group',
          format: 'json',
          statusFilter: 'ACTIVE',
        });
      });
    });

    it('should handle export errors', async () => {
      mockSendMessage.mockResolvedValueOnce({
        success: false,
        error: 'Export failed',
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await act(async () => {
        await result.current.exportMembers('group1', 'Test Group', 'csv');
      });

      await waitFor(() => {
        expect(mockOnResult).toHaveBeenCalledWith('Export failed: Export failed', 'error');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      await expect(async () => {
        await result.current.makeApiRequest('/api/v1/test');
      }).rejects.toThrow('Network error');
    });

    it('should handle 404 errors', async () => {
      mockSendMessage.mockResolvedValueOnce({
        success: false,
        status: 404,
        error: 'Not found',
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      const response = await act(async () => {
        return result.current.makeApiRequest('/api/v1/nonexistent');
      });

      expect(response.success).toBe(false);
      expect(response.status).toBe(404);
    });

    it('should handle 500 errors', async () => {
      mockSendMessage.mockResolvedValueOnce({
        success: false,
        status: 500,
        error: 'Internal server error',
      });

      const { result } = renderHook(() =>
        useOktaApi({ targetTabId, onResult: mockOnResult, onProgress: mockOnProgress })
      );

      const response = await act(async () => {
        return result.current.makeApiRequest('/api/v1/test');
      });

      expect(response.success).toBe(false);
      expect(response.status).toBe(500);
    });
  });
});
