/**
 * @module hooks/useOrgStats
 * @description Hook for fetching organization-wide statistics from caches
 *
 * This hook reads from existing caches (groups, apps, rules) and IndexedDB (audit)
 * to provide organization statistics WITHOUT making additional API calls.
 *
 * The strategy is to surface data that's already been loaded by other tabs,
 * making the Organization Overview efficient and fast.
 */

import { useState, useEffect, useCallback } from 'react';
import { RulesCache } from '../../shared/rulesCache';
import { auditStore } from '../../shared/storage/auditStore';

const GROUPS_CACHE_KEY = 'okta_unbound_groups_cache';
const APPS_CACHE_KEY = 'okta_unbound_apps_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export interface OrgStats {
  totalGroups: number | null;
  totalApps: number | null;
  activeRules: number | null;
  recentOperations: number | null;
  cacheStatus: {
    groupsCached: boolean;
    appsCached: boolean;
    rulesCached: boolean;
    groupsCacheAge: number | null; // milliseconds
    appsCacheAge: number | null;
  };
}

export interface UseOrgStatsResult {
  stats: OrgStats;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useOrgStats(): UseOrgStatsResult {
  const [stats, setStats] = useState<OrgStats>({
    totalGroups: null,
    totalApps: null,
    activeRules: null,
    recentOperations: null,
    cacheStatus: {
      groupsCached: false,
      appsCached: false,
      rulesCached: false,
      groupsCacheAge: null,
      appsCacheAge: null,
    },
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setIsLoading(true);

    try {
      const now = Date.now();
      let groupsCount: number | null = null;
      let appsCount: number | null = null;
      let rulesCount: number | null = null;
      let recentOps: number | null = null;
      let groupsCached = false;
      let appsCached = false;
      let rulesCached = false;
      let groupsCacheAge: number | null = null;
      let appsCacheAge: number | null = null;

      // 1. Check groups cache
      try {
        const result = await chrome.storage.local.get([GROUPS_CACHE_KEY]);
        if (result[GROUPS_CACHE_KEY]) {
          const cached = JSON.parse(result[GROUPS_CACHE_KEY] as string);
          const age = now - cached.timestamp;

          if (age < CACHE_DURATION && cached.groups) {
            groupsCount = cached.groups.length;
            groupsCached = true;
            groupsCacheAge = age;
          }
        }
      } catch (err) {
        console.error('[useOrgStats] Failed to read groups cache:', err);
      }

      // 2. Check apps cache
      try {
        const result = await chrome.storage.local.get([APPS_CACHE_KEY]);
        if (result[APPS_CACHE_KEY]) {
          const cached = JSON.parse(result[APPS_CACHE_KEY] as string);
          const age = now - cached.timestamp;

          if (age < CACHE_DURATION && cached.apps) {
            appsCount = cached.apps.length;
            appsCached = true;
            appsCacheAge = age;
          }
        }
      } catch (err) {
        console.error('[useOrgStats] Failed to read apps cache:', err);
      }

      // 3. Check rules cache
      try {
        const rulesData = await RulesCache.get();
        if (rulesData) {
          rulesCount = rulesData.stats.active;
          rulesCached = true;
        }
      } catch (err) {
        console.error('[useOrgStats] Failed to read rules cache:', err);
      }

      // 4. Get recent operations from audit store (IndexedDB - no API call)
      try {
        const auditStats = await auditStore.getStats();
        recentOps = auditStats.lastWeekOperations;
      } catch (err) {
        console.error('[useOrgStats] Failed to read audit stats:', err);
      }

      setStats({
        totalGroups: groupsCount,
        totalApps: appsCount,
        activeRules: rulesCount,
        recentOperations: recentOps,
        cacheStatus: {
          groupsCached,
          appsCached,
          rulesCached,
          groupsCacheAge,
          appsCacheAge,
        },
      });
    } catch (err) {
      console.error('[useOrgStats] Failed to load stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Listen for storage changes to update stats when caches are updated
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local') {
        if (
          changes[GROUPS_CACHE_KEY] ||
          changes[APPS_CACHE_KEY] ||
          changes['global_rules_cache']
        ) {
          console.log('[useOrgStats] Cache updated, refreshing stats');
          loadStats();
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [loadStats]);

  return {
    stats,
    isLoading,
    refresh: loadStats,
  };
}
