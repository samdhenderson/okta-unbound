/**
 * @module sidepanel/hooks/useRulesData
 * @description Owns the Rules tab's rule list, stats, and load/cache pipeline.
 *
 * Extracted from `RulesTab` during its §7 decomposition. Holds the loaded rules,
 * aggregate stats, API-cost/last-fetch metadata, and loading flag, and exposes
 * `loadRules(force)` (RulesCache-first, then the scheduler-routed fetch) plus a
 * `hydrate` used by the tab to restore persisted state on mount.
 *
 * @remarks §8: the rule fetch now routes through the background scheduler via
 * {@link fetchGroupRulesRequest} (`makeApiRequest`), not a raw
 * `chrome.tabs.sendMessage`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormattedRule, RuleStats } from '../../shared/types';
import { RulesCache } from '../../shared/rulesCache';
import { useProgress } from '../contexts/ProgressContext';
import { createLogger } from '../../shared/utils/logger';
import { useOktaApi } from './useOktaApi';
import { fetchGroupRulesRequest } from './fetchGroupRulesRequest';

const log = createLogger('RulesTab');

/** The zeroed stats object, reused as the default and the fetch fallback. */
const EMPTY_STATS: RuleStats = { total: 0, active: 0, inactive: 0, conflicts: 0 };

/**
 * Strip the caller-scoped `affectsCurrentGroup` flag from rules on their way
 * into the **org-wide** `RulesCache`.
 *
 * The cache is a single shared slot read by every group (see
 * `useOktaApi/groupDiscovery.ts`, which formats its own writes with
 * `currentGroupId === undefined` for exactly this reason). This load, by
 * contrast, formats for whichever group the panel currently has open — writing
 * those flags into the shared entry would hand every other group a wrong
 * "Current Group" answer for the next 5 minutes. Consumers derive the relation
 * from `groupIds` instead.
 *
 * @param rules - Rules as returned by this load (possibly group-flagged).
 * @returns The same rules with no `affectsCurrentGroup` field.
 */
function toOrgWideRules(rules: FormattedRule[] | undefined): FormattedRule[] {
  return (rules ?? []).map(({ affectsCurrentGroup: _scoped, ...rest }) => rest);
}

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
  /**
   * Current group (the panel's detected group), used to flag rules that target it
   * (`affectsCurrentGroup`). Mirrors the page-URL group the content script derived.
   */
  currentGroupId?: string;
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
export function useRulesData({
  targetTabId,
  onError,
  currentGroupId,
}: UseRulesDataOptions): UseRulesDataReturn {
  const [rules, setRules] = useState<FormattedRule[]>([]);
  const [stats, setStats] = useState<RuleStats>(EMPTY_STATS);
  const [apiCost, setApiCost] = useState<number | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { startProgress, updateProgress, completeProgress } = useProgress();

  // §8: own a useOktaApi slice so the rule fetch routes through the scheduler.
  const { makeApiRequest } = useOktaApi({ targetTabId: targetTabId ?? null });

  // `loadRules` closes the success/cache-hit progress bar on a short delay so the
  // "Loaded N rules" message has time to be read, via a raw `setTimeout` rather
  // than an effect (it fires from inside an async callback, not in response to a
  // render). Nothing cancelled that timer if the hook unmounted first — a `Timeout`
  // firing after teardown called `completeProgress()` into a torn-down `window`.
  // `mountedRef` + the pending-timer ref close both gaps: the ref lets a re-fetch
  // clear a still-pending completion from the previous one, and the mounted check
  // stops the callback from touching context state after unmount.
  const mountedRef = useRef(true);
  const completeProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (completeProgressTimerRef.current) {
        clearTimeout(completeProgressTimerRef.current);
        completeProgressTimerRef.current = null;
      }
    };
  }, []);

  const scheduleCompleteProgress = useCallback(
    (delayMs: number) => {
      if (completeProgressTimerRef.current) {
        clearTimeout(completeProgressTimerRef.current);
      }
      completeProgressTimerRef.current = setTimeout(() => {
        completeProgressTimerRef.current = null;
        if (mountedRef.current) completeProgress();
      }, delayMs);
    },
    [completeProgress],
  );

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
            scheduleCompleteProgress(500);
            setIsLoading(false);
            return;
          }
        }

        const response = await fetchGroupRulesRequest(makeApiRequest, currentGroupId);

        log.debug('Received response:', { success: response.success });

        if (response.success) {
          const rulesCount = response.rules?.length || 0;
          updateProgress(1, 1, `Loaded ${rulesCount} rules successfully`);

          setRules(response.rules || []);
          setStats(response.stats || EMPTY_STATS);
          setLastFetchTime(new Date().toISOString());

          // OPTIMIZED: Populate global cache for other components to use. The
          // raw rules come from the same single fetch as the formatted ones, so
          // raw-rule consumers (rule-impact analysis) are served from this cache
          // instead of re-paginating /api/v1/groups/rules. The entry is org-wide,
          // so this load's group-scoped flags are stripped first ({@link toOrgWideRules}).
          await RulesCache.set(
            toOrgWideRules(response.rules),
            response.rawRules || [],
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
          scheduleCompleteProgress(1000);
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
    [
      targetTabId,
      onError,
      currentGroupId,
      makeApiRequest,
      startProgress,
      updateProgress,
      completeProgress,
      scheduleCompleteProgress,
    ],
  );

  return { rules, stats, apiCost, lastFetchTime, isLoading, loadRules, hydrate };
}
