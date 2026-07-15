/**
 * @module sidepanel/hooks/useRulesData
 * @description Owns the Rules tab's rule list, stats, and load/cache pipeline.
 *
 * Extracted from `RulesTab` during its §7 decomposition. Holds the loaded rules,
 * aggregate stats, API-cost/last-fetch metadata, and loading flag, and exposes
 * `loadRules(force)` (RulesCache-first, then the content-script fetch) plus a
 * `hydrate` used by the tab to restore persisted state on mount.
 *
 * @remarks Keeps the raw `chrome.tabs.sendMessage('fetchGroupRules')` transport
 * verbatim (the §8 scheduler migration is out of scope); this file is
 * grandfathered in the ESLint `no-restricted-syntax` override.
 */

import { useCallback, useState } from 'react';
import type { FormattedRule, RuleStats } from '../../shared/types';
import { RulesCache } from '../../shared/rulesCache';
import { useProgress } from '../contexts/ProgressContext';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('RulesTab');

/** The zeroed stats object, reused as the default and the fetch fallback. */
const EMPTY_STATS: RuleStats = { total: 0, active: 0, inactive: 0, conflicts: 0 };

/** State restored from persistence on mount (persisted fields may be null). */
export interface RulesDataSnapshot {
  rules?: FormattedRule[] | null;
  stats?: RuleStats | null;
  lastFetchTime?: string | null;
}

/** Options for {@link useRulesData}. */
interface UseRulesDataOptions {
  /** Connected Okta tab id; loading errors when absent. */
  targetTabId?: number;
  /** Surface an error message in the tab's banner. */
  onError: (message: string) => void;
}

/** Return shape of {@link useRulesData}. */
interface UseRulesDataReturn {
  rules: FormattedRule[];
  stats: RuleStats;
  apiCost: number | null;
  lastFetchTime: string | null;
  isLoading: boolean;
  /** Load rules: serves the fresh RulesCache unless `force`, else fetches + caches. */
  loadRules: (force?: boolean) => Promise<void>;
  /** Restore persisted rules/stats/last-fetch on mount (no fetch). */
  hydrate: (snapshot: RulesDataSnapshot) => void;
}

/**
 * Manage the Rules tab's data: the rule list, stats, load-cost metadata, and the
 * cache-first `loadRules` pipeline.
 *
 * @param options - See {@link UseRulesDataOptions}.
 * @returns The rule data plus `loadRules`/`hydrate`.
 */
export function useRulesData({ targetTabId, onError }: UseRulesDataOptions): UseRulesDataReturn {
  const [rules, setRules] = useState<FormattedRule[]>([]);
  const [stats, setStats] = useState<RuleStats>(EMPTY_STATS);
  const [apiCost, setApiCost] = useState<number | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { startProgress, updateProgress, completeProgress } = useProgress();

  const hydrate = useCallback((snapshot: RulesDataSnapshot) => {
    if (snapshot.rules) setRules(snapshot.rules);
    if (snapshot.stats) setStats(snapshot.stats);
    if (snapshot.lastFetchTime) setLastFetchTime(snapshot.lastFetchTime);
  }, []);

  const loadRules = useCallback(
    async (force: boolean = false) => {
      if (!targetTabId) {
        onError('No Okta tab connected');
        return;
      }

      setIsLoading(true);
      onError('');
      setApiCost(null);

      try {
        log.debug('Fetching rules from tab:', targetTabId);

        // Start progress - we don't know total yet, so use indeterminate progress
        startProgress('Loading Rules', 'Loading group rules...', 1);

        // Track API requests made
        let apiRequestCount = 0;

        // OPTIMIZED: Check global cache first (unless forced refresh)
        if (!force) {
          const cached = await RulesCache.get();
          if (cached) {
            log.debug('Using cached rules from global cache');
            setRules(cached.rules);
            setStats(cached.stats);
            setLastFetchTime(new Date(cached.timestamp).toISOString());
            setApiCost(0); // No API calls needed
            updateProgress(1, 1, `Loaded ${cached.rules.length} rules from cache`);
            setTimeout(() => completeProgress(), 500);
            setIsLoading(false);
            return;
          }
        }

        const response = await chrome.tabs.sendMessage(targetTabId, {
          action: 'fetchGroupRules',
        });

        log.debug('Received response:', { success: response.success });

        if (response.success) {
          const rulesCount = response.rules?.length || 0;
          updateProgress(1, 1, `Loaded ${rulesCount} rules successfully`);

          setRules(response.rules || []);
          setStats(response.stats || EMPTY_STATS);
          setLastFetchTime(new Date().toISOString());

          // OPTIMIZED: Populate global cache for other components to use
          await RulesCache.set(
            response.rules || [],
            [], // rawRules not available from formatted response
            response.stats || EMPTY_STATS,
            response.conflicts || [],
          );

          // Calculate actual API cost based on response metadata
          // The content script makes 1 request for rules fetch
          apiRequestCount = 1;
          setApiCost(apiRequestCount);

          log.debug('Loaded rules successfully:', {
            count: response.rules?.length,
            stats: response.stats,
            apiCost: apiRequestCount,
          });

          // Complete progress after a short delay to show success message
          setTimeout(() => {
            completeProgress();
          }, 1000);
        } else {
          onError(response.error || 'Failed to fetch rules');
          log.error('Error fetching rules:', response.error);
          completeProgress();
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to communicate with Okta tab');
        log.error('Exception:', err);
        completeProgress();
      } finally {
        setIsLoading(false);
      }
    },
    [targetTabId, onError, startProgress, updateProgress, completeProgress],
  );

  return { rules, stats, apiCost, lastFetchTime, isLoading, loadRules, hydrate };
}
