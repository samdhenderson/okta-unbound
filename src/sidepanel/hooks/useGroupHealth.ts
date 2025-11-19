import { useState, useEffect, useCallback } from 'react';
import type { GroupHealthMetrics, OktaUser, UserStatus, DashboardCache } from '../../shared/types';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY = 'dashboard_cache';

interface UseGroupHealthOptions {
  groupId: string | undefined;
  targetTabId: number | null;
}

export function useGroupHealth({ groupId, targetTabId }: UseGroupHealthOptions) {
  const [metrics, setMetrics] = useState<GroupHealthMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to validate tab and send message safely
  const sendMessageSafely = useCallback(async (tabId: number, message: any) => {
    try {
      // Check if tab exists first
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        throw new Error('Tab not found');
      }

      // Send message to content script
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      // Handle connection errors gracefully
      if (err instanceof Error && err.message.includes('Receiving end does not exist')) {
        throw new Error('Connection lost. Please refresh the Okta page and try again.');
      }
      if (err instanceof Error && err.message.includes('Tab not found')) {
        throw new Error('The Okta tab is no longer available. Please navigate to a group page.');
      }
      throw err;
    }
  }, []);

  const fetchGroupMembers = useCallback(async (): Promise<OktaUser[]> => {
    if (!targetTabId || !groupId) {
      throw new Error('Missing target tab ID or group ID');
    }

    const allMembers: OktaUser[] = [];
    let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;

    while (nextUrl) {
      const response: { success: boolean; data?: OktaUser[]; error?: string; headers?: { link?: string } } = await sendMessageSafely(targetTabId, {
        action: 'makeApiRequest',
        endpoint: nextUrl,
        method: 'GET',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch group members');
      }

      const pageMembers = response.data || [];
      allMembers.push(...pageMembers);

      // Parse next link from headers
      nextUrl = null;
      if (response.headers?.link) {
        const links: string[] = response.headers.link.split(',');
        for (const link of links) {
          if (link.includes('rel="next"')) {
            const match: RegExpMatchArray | null = link.match(/<([^>]+)>/);
            if (match) {
              const fullUrl: URL = new URL(match[1]);
              nextUrl = fullUrl.pathname + fullUrl.search;
              break;
            }
          }
        }
      }
    }

    return allMembers;
  }, [groupId, targetTabId, sendMessageSafely]);

  const fetchGroupRules = useCallback(async (): Promise<number> => {
    if (!targetTabId || !groupId) {
      return 0;
    }

    try {
      const response = await sendMessageSafely(targetTabId, {
        action: 'fetchGroupRules',
        groupId,
      });

      if (response.success && response.formattedRules) {
        // Count rules that affect current group
        return response.formattedRules.filter((rule: any) => rule.affectsCurrentGroup).length;
      }
      return 0;
    } catch (err) {
      console.warn('[useGroupHealth] Failed to fetch group rules:', err);
      return 0;
    }
  }, [groupId, targetTabId, sendMessageSafely]);

  const calculateMetrics = useCallback(
    async (members: OktaUser[]): Promise<GroupHealthMetrics> => {
      // Calculate status breakdown
      const statusBreakdown: Record<UserStatus, number> = {
        ACTIVE: 0,
        DEPROVISIONED: 0,
        SUSPENDED: 0,
        STAGED: 0,
        PROVISIONED: 0,
        RECOVERY: 0,
        LOCKED_OUT: 0,
        PASSWORD_EXPIRED: 0,
      };

      members.forEach((user) => {
        if (statusBreakdown[user.status] !== undefined) {
          statusBreakdown[user.status]++;
        }
      });

      // Fetch rule-based memberships count
      const ruleBasedCount = await fetchGroupRules();

      // Calculate membership sources (estimation)
      // For now, we'll use a simple heuristic: rule-based members are estimated from active rules
      // Direct members = total - estimated rule-based
      const membershipSources = {
        direct: Math.max(0, members.length - ruleBasedCount),
        ruleBased: ruleBasedCount,
      };

      // Calculate risk score (0-100, lower is better)
      const inactiveCount =
        statusBreakdown.DEPROVISIONED + statusBreakdown.SUSPENDED + statusBreakdown.LOCKED_OUT;
      const inactivePercentage = members.length > 0 ? (inactiveCount / members.length) * 100 : 0;

      const riskFactors: string[] = [];
      let riskScore = 0;

      // Risk factor: High percentage of inactive users
      if (inactivePercentage > 20) {
        riskScore += 40;
        riskFactors.push(`${inactivePercentage.toFixed(1)}% inactive users`);
      } else if (inactivePercentage > 10) {
        riskScore += 20;
        riskFactors.push(`${inactivePercentage.toFixed(1)}% inactive users`);
      } else if (inactivePercentage > 5) {
        riskScore += 10;
        riskFactors.push(`${inactivePercentage.toFixed(1)}% inactive users`);
      }

      // Risk factor: Large group size without recent cleanup
      if (members.length > 500) {
        riskScore += 15;
        riskFactors.push(`Large group size (${members.length} members)`);
      }

      // Risk factor: Suspended or locked out users
      if (statusBreakdown.SUSPENDED > 0) {
        riskScore += 15;
        riskFactors.push(`${statusBreakdown.SUSPENDED} suspended users`);
      }

      if (statusBreakdown.LOCKED_OUT > 0) {
        riskScore += 10;
        riskFactors.push(`${statusBreakdown.LOCKED_OUT} locked out users`);
      }

      // Risk factor: Password expired users
      if (statusBreakdown.PASSWORD_EXPIRED > 0) {
        riskScore += 10;
        riskFactors.push(`${statusBreakdown.PASSWORD_EXPIRED} users with expired passwords`);
      }

      // Cap risk score at 100
      riskScore = Math.min(100, riskScore);

      // If no risk factors, it's healthy
      if (riskFactors.length === 0) {
        riskFactors.push('No issues detected');
      }

      // Get last cleanup from storage (future enhancement)
      const lastCleanup = null;
      const daysSinceCleanup = null;

      // Trends (future enhancement - would require historical data)
      const trends = {
        membershipChange30d: 0,
        newUsersThisWeek: 0,
      };

      return {
        totalUsers: members.length,
        statusBreakdown,
        membershipSources,
        riskScore,
        riskFactors,
        lastCleanup,
        daysSinceCleanup,
        trends,
      };
    },
    [fetchGroupRules]
  );

  const loadMetrics = useCallback(async () => {
    if (!groupId || !targetTabId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = await chrome.storage.local.get(CACHE_KEY);
      const cacheData = cached[CACHE_KEY] as DashboardCache | undefined;

      if (
        cacheData &&
        cacheData.groupId === groupId &&
        Date.now() - cacheData.timestamp < CACHE_DURATION
      ) {
        console.log('[useGroupHealth] Using cached metrics');
        setMetrics(cacheData.metrics);
        setIsLoading(false);
        return;
      }

      // Fetch fresh data
      console.log('[useGroupHealth] Fetching fresh metrics');
      const members = await fetchGroupMembers();
      const newMetrics = await calculateMetrics(members);

      // Cache the results
      await chrome.storage.local.set({
        [CACHE_KEY]: {
          metrics: newMetrics,
          timestamp: Date.now(),
          groupId,
        } as DashboardCache,
      });

      setMetrics(newMetrics);
    } catch (err) {
      console.error('[useGroupHealth] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load health metrics');
    } finally {
      setIsLoading(false);
    }
  }, [groupId, targetTabId, fetchGroupMembers, calculateMetrics]);

  const refresh = useCallback(async () => {
    // Clear cache and reload
    await chrome.storage.local.remove(CACHE_KEY);
    await loadMetrics();
  }, [loadMetrics]);

  // Auto-load on mount and when dependencies change
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return {
    metrics,
    isLoading,
    error,
    refresh,
  };
}
