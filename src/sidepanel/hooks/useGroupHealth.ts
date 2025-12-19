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
    let currentOffset = 0;
    const pageSize = 200;
    let hasMore = true;

    // Use the internal admin console API endpoint that includes managedBy.rules data
    // This endpoint provides accurate information about rule-based vs manual assignments
    while (hasMore) {
      const endpoint = `/admin/users/search?iDisplayLength=${pageSize}&iColumns=6&sColumns=user.id%2Cstatus.statusLabel%2Cuser.fullName%2Cuser.login%2CmanagedBy.rules&orderBy=membershipId&enableSQLQueryGenerator=true&enableESUserLookup=true&skipCountTotal=true&groupId=${groupId}&sortDirection=desc&iDisplayStart=${currentOffset}&sSearch=`;

      const response: { success: boolean; data?: any; error?: string } = await sendMessageSafely(targetTabId, {
        action: 'makeApiRequest',
        endpoint,
        method: 'GET',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch group members');
      }

      // The internal API returns data in the format { aaData: [...], iTotalRecords: number }
      const responseData = response.data;
      const pageMembers = responseData?.aaData || [];

      // Debug logging to inspect the actual response structure
      if (pageMembers.length > 0 && currentOffset === 0) {
        console.log('[useGroupHealth] Sample member from aaData:', JSON.stringify(pageMembers[0], null, 2));
        console.log('[useGroupHealth] Keys in first member:', Object.keys(pageMembers[0]));
      }

      if (pageMembers.length === 0) {
        hasMore = false;
        break;
      }

      // Transform the internal API response format to match OktaUser interface
      // The aaData returns arrays where each element maps to the sColumns order:
      // [0] = user.id, [1] = status.statusLabel, [2] = user.fullName, [3] = user.login, [4] = managedBy.rules
      const transformedMembers = pageMembers.map((member: any[]) => {
        const userId = member[0];
        const statusLabel = member[1];
        const fullName = member[2];
        const login = member[3];
        const managedByRulesRaw = member[4]; // This is the key field!

        // Debug log to see what managedBy looks like
        if (currentOffset === 0 && allMembers.length < 5) {
          console.log('[useGroupHealth] Member array:', member);
          console.log('[useGroupHealth] managedBy.rules raw value:', managedByRulesRaw);
          console.log('[useGroupHealth] managedBy.rules type:', typeof managedByRulesRaw);
          console.log('[useGroupHealth] managedBy.rules is array?:', Array.isArray(managedByRulesRaw));
          if (typeof managedByRulesRaw === 'string') {
            console.log('[useGroupHealth] managedBy.rules string length:', managedByRulesRaw.length);
          }
        }

        // Normalize the managedBy.rules field to always be an array of strings or undefined
        let normalizedRules: string[] | undefined = undefined;

        if (managedByRulesRaw !== null && managedByRulesRaw !== undefined && managedByRulesRaw !== '') {
          if (Array.isArray(managedByRulesRaw)) {
            // If it's already an array, use it
            normalizedRules = managedByRulesRaw.filter(rule => rule && rule !== '');
          } else if (typeof managedByRulesRaw === 'string') {
            // If it's a string, wrap it in an array (unless it's empty)
            if (managedByRulesRaw.trim() !== '') {
              normalizedRules = [managedByRulesRaw];
            }
          } else if (typeof managedByRulesRaw === 'object') {
            // If it's an object, try to extract rule IDs
            // This handles cases where Okta returns {id: "ruleId"} or similar
            if ('id' in managedByRulesRaw) {
              normalizedRules = [managedByRulesRaw.id];
            } else if ('ruleId' in managedByRulesRaw) {
              normalizedRules = [managedByRulesRaw.ruleId];
            }
          }
        }

        // Parse the full name into first and last
        const nameParts = fullName ? fullName.split(' ') : ['', ''];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        return {
          id: userId,
          status: statusLabel as UserStatus,
          managedBy: normalizedRules && normalizedRules.length > 0 ? { rules: normalizedRules } : undefined,
          profile: {
            login: login || '',
            email: login || '', // Login is typically the email
            firstName,
            lastName,
          },
        };
      });

      allMembers.push(...transformedMembers);

      // Check if there are more results
      if (pageMembers.length < pageSize) {
        hasMore = false;
      } else {
        currentOffset += pageSize;
      }
    }

    return allMembers;
  }, [groupId, targetTabId, sendMessageSafely]);

  const fetchGroupRules = useCallback(async (): Promise<{ ruleCount: number; hasActiveRules: boolean }> => {
    if (!targetTabId || !groupId) {
      return { ruleCount: 0, hasActiveRules: false };
    }

    try {
      const response = await sendMessageSafely(targetTabId, {
        action: 'fetchGroupRules',
        groupId,
      });

      if (response.success && response.formattedRules) {
        // Count ACTIVE rules that affect current group
        const activeRulesForGroup = response.formattedRules.filter(
          (rule: any) => rule.affectsCurrentGroup && rule.status === 'ACTIVE'
        );
        return {
          ruleCount: activeRulesForGroup.length,
          hasActiveRules: activeRulesForGroup.length > 0,
        };
      }
      return { ruleCount: 0, hasActiveRules: false };
    } catch (err) {
      console.warn('[useGroupHealth] Failed to fetch group rules:', err);
      return { ruleCount: 0, hasActiveRules: false };
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

      // Calculate membership sources using the actual managedBy.rules data from Okta
      // This data is only available through the internal /admin/users/search endpoint
      let ruleBased = 0;
      let direct = 0;
      let unclassified = 0; // Track users we couldn't classify

      members.forEach((user, index) => {
        // Check if the user has any rules managing their membership
        // CRITICAL: user.managedBy.rules should be an array of rule IDs
        const hasRules =
          user.managedBy &&
          user.managedBy.rules &&
          Array.isArray(user.managedBy.rules) &&
          user.managedBy.rules.length > 0;

        // Debug logging for first 10 users to understand the pattern
        if (index < 10) {
          console.log('[useGroupHealth] User', index, ':', {
            id: user.id,
            login: user.profile.login,
            managedBy: user.managedBy,
            managedByType: user.managedBy ? typeof user.managedBy.rules : 'N/A',
            isArray: user.managedBy ? Array.isArray(user.managedBy.rules) : false,
            rulesLength: user.managedBy?.rules ? (Array.isArray(user.managedBy.rules) ? user.managedBy.rules.length : 'not-array') : 0,
            hasRules,
            classification: hasRules ? 'RULE-BASED' : 'MANUAL',
          });
        }

        if (hasRules) {
          ruleBased++;
        } else if (user.managedBy === undefined) {
          // User has no managedBy data, which means manual assignment
          direct++;
        } else {
          // Edge case: managedBy exists but rules is empty/invalid
          direct++;
          if (index < 10) {
            console.warn('[useGroupHealth] User has managedBy but no valid rules:', user.id, user.managedBy);
          }
        }
      });

      console.log('[useGroupHealth] Final membership counts:', {
        direct,
        ruleBased,
        total: members.length,
        sanityCheck: direct + ruleBased === members.length ? '✓ PASS' : '✗ FAIL',
      });

      // Sanity check: ensure counts add up
      if (direct + ruleBased !== members.length) {
        console.error('[useGroupHealth] CRITICAL: Membership count mismatch!', {
          direct,
          ruleBased,
          sum: direct + ruleBased,
          total: members.length,
          difference: members.length - (direct + ruleBased),
        });
      }

      const membershipSources = {
        direct,
        ruleBased,
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
