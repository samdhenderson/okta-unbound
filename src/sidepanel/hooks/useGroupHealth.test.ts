import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGroupHealth } from './useGroupHealth';
import type { OktaUser } from '../../shared/types';

// Mock Chrome API
const mockChrome = {
  tabs: {
    get: vi.fn(),
    sendMessage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
};

(globalThis as any).chrome = mockChrome;

describe('useGroupHealth', () => {
  const mockGroupId = '00g123456789';
  const mockTargetTabId = 1;

  const mockUsers: OktaUser[] = [
    {
      id: 'user1',
      status: 'ACTIVE',
      profile: {
        login: 'user1@example.com',
        email: 'user1@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
    },
    {
      id: 'user2',
      status: 'ACTIVE',
      profile: {
        login: 'user2@example.com',
        email: 'user2@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      },
    },
    {
      id: 'user3',
      status: 'DEPROVISIONED',
      profile: {
        login: 'user3@example.com',
        email: 'user3@example.com',
        firstName: 'Bob',
        lastName: 'Johnson',
      },
    },
    {
      id: 'user4',
      status: 'SUSPENDED',
      profile: {
        login: 'user4@example.com',
        email: 'user4@example.com',
        firstName: 'Alice',
        lastName: 'Williams',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation for chrome.tabs.get
    mockChrome.tabs.get.mockImplementation((tabId) => Promise.resolve({ id: tabId, active: true }));

    // Default mock implementation for chrome.storage.local.get (no cache)
    mockChrome.storage.local.get.mockImplementation(() => Promise.resolve({}));

    // Default mock implementation for chrome.storage.local.set
    mockChrome.storage.local.set.mockImplementation(() => Promise.resolve());

    // Default mock for API request (group members)
    mockChrome.tabs.sendMessage.mockImplementation((_tabId, message) => {
      if (message.action === 'makeApiRequest') {
        return Promise.resolve({
          success: true,
          data: mockUsers,
          headers: {},
        });
      }
      if (message.action === 'fetchGroupRules') {
        return Promise.resolve({
          success: true,
          formattedRules: [],
        });
      }
      return Promise.resolve({ success: false });
    });
  });

  it('should load metrics successfully', async () => {
    const { result } = renderHook(() =>
      useGroupHealth({ groupId: mockGroupId, targetTabId: mockTargetTabId })
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics).toBeDefined();
    expect(result.current.metrics?.totalUsers).toBe(4);
    expect(result.current.metrics?.statusBreakdown.ACTIVE).toBe(2);
    expect(result.current.metrics?.statusBreakdown.DEPROVISIONED).toBe(1);
    expect(result.current.metrics?.statusBreakdown.SUSPENDED).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('should calculate risk score correctly for healthy group', async () => {
    // Mock only active users
    mockChrome.tabs.sendMessage.mockImplementation((_tabId, message) => {
      if (message.action === 'makeApiRequest') {
        return Promise.resolve({
          success: true,
          data: [mockUsers[0], mockUsers[1]], // Only active users
          headers: {},
        });
      }
      if (message.action === 'fetchGroupRules') {
        return Promise.resolve({
          success: true,
          formattedRules: [],
        });
      }
      return Promise.resolve({ success: false });
    });

    const { result } = renderHook(() =>
      useGroupHealth({ groupId: mockGroupId, targetTabId: mockTargetTabId })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics?.riskScore).toBeLessThan(30);
    expect(result.current.metrics?.riskFactors).toContain('No issues detected');
  });

  it('should calculate risk score correctly for unhealthy group', async () => {
    // Mock mostly inactive users
    const unhealthyUsers: OktaUser[] = [
      ...mockUsers,
      {
        id: 'user5',
        status: 'DEPROVISIONED',
        profile: {
          login: 'user5@example.com',
          email: 'user5@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      },
      {
        id: 'user6',
        status: 'LOCKED_OUT',
        profile: {
          login: 'user6@example.com',
          email: 'user6@example.com',
          firstName: 'Test2',
          lastName: 'User2',
        },
      },
    ];

    mockChrome.tabs.sendMessage.mockImplementation((_tabId, message) => {
      if (message.action === 'makeApiRequest') {
        return Promise.resolve({
          success: true,
          data: unhealthyUsers,
          headers: {},
        });
      }
      if (message.action === 'fetchGroupRules') {
        return Promise.resolve({
          success: true,
          formattedRules: [],
        });
      }
      return Promise.resolve({ success: false });
    });

    const { result } = renderHook(() =>
      useGroupHealth({ groupId: mockGroupId, targetTabId: mockTargetTabId })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics?.riskScore).toBeGreaterThan(30);
    expect(result.current.metrics?.riskFactors.length).toBeGreaterThan(1);
  });

  it('should use cached metrics when available and fresh', async () => {
    const cachedMetrics = {
      totalUsers: 10,
      statusBreakdown: {
        ACTIVE: 10,
        DEPROVISIONED: 0,
        SUSPENDED: 0,
        STAGED: 0,
        PROVISIONED: 0,
        RECOVERY: 0,
        LOCKED_OUT: 0,
        PASSWORD_EXPIRED: 0,
      },
      membershipSources: { direct: 10, ruleBased: 0 },
      riskScore: 0,
      riskFactors: ['No issues detected'],
      lastCleanup: null,
      daysSinceCleanup: null,
      trends: { membershipChange30d: 0, newUsersThisWeek: 0 },
    };

    mockChrome.storage.local.get.mockImplementation(() =>
      Promise.resolve({
        dashboard_cache: {
          metrics: cachedMetrics,
          timestamp: Date.now(),
          groupId: mockGroupId,
        },
      })
    );

    const { result } = renderHook(() =>
      useGroupHealth({ groupId: mockGroupId, targetTabId: mockTargetTabId })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics).toEqual(cachedMetrics);
    // Should not call API if cache is fresh
    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    mockChrome.tabs.sendMessage.mockImplementation(() =>
      Promise.resolve({
        success: false,
        error: 'API Error',
      })
    );

    const { result } = renderHook(() =>
      useGroupHealth({ groupId: mockGroupId, targetTabId: mockTargetTabId })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.metrics).toBeNull();
  });

  it('should not load metrics when groupId or targetTabId is missing', async () => {
    const { result } = renderHook(() =>
      useGroupHealth({ groupId: undefined, targetTabId: null })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metrics).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
});
