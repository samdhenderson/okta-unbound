/**
 * @module sidepanel/hooks/useUserMemberships
 * @description Loads a user's groups and classifies each membership as DIRECT or RULE_BASED.
 *
 * Okta's API does not report how a user landed in a group, so this module infers
 * it heuristically (APP_GROUP → rule, rule-exclusion → direct, matching active
 * rules → rule with confidence, otherwise direct). See OKTA_API_LIMITATIONS.md §2.
 * Group rules are read from the shared `RulesCache` and refetched on a miss.
 */

import { useState, useCallback, useRef } from 'react';
import type { OktaUser, GroupMembership, OktaGroup, FormattedRule } from '../../shared/types';
import { RulesCache } from '../../shared/rulesCache';
import { getOrFetch, peek } from '../cache/entityCache';
import { analyzeMemberships } from '../../shared/utils/membershipAnalysis';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useUserMemberships');

/** Options for {@link useUserMemberships}. */
interface UseUserMembershipsOptions {
  /** Tab whose content script fetches groups/rules; loading errors when undefined. */
  targetTabId: number | undefined;
  /**
   * Notified whenever the load error changes — `null` on start/success, the
   * message on failure. Lets an orchestrator mirror this into a single merged
   * error channel it owns (last-write-wins). Optional; consumers that read the
   * returned `error` directly can omit it.
   */
  onError?: (message: string | null) => void;
  /** Notified when a load starts (`true`) and settles (`false`). Optional. */
  onLoadingChange?: (loading: boolean) => void;
}

/** Return shape of {@link useUserMemberships}. */
interface UseUserMembershipsReturn {
  memberships: GroupMembership[];
  isLoading: boolean;
  error: string | null;
  /**
   * (Re)load a user's analyzed memberships. A fresh cached analysis is served
   * instantly; pass `{ force: true }` after a mutation (e.g. add-to-group) to
   * bypass the cache and refetch.
   */
  loadMemberships: (user: OktaUser, options?: { force?: boolean }) => Promise<void>;
  clearMemberships: () => void;
}

/**
 * Hook for loading and analyzing a user's group memberships.
 *
 * Features:
 * - Fetches user's groups from Okta API
 * - Uses cached rules when available
 * - Analyzes membership types (DIRECT vs RULE_BASED)
 *
 * @param options - See `UseUserMembershipsOptions`.
 * @returns `memberships` (each annotated with its inferred type), `isLoading`,
 *   `error`, `loadMemberships(user)` to (re)load for a user, and
 *   `clearMemberships` to reset.
 */
export function useUserMemberships({
  targetTabId,
  onError,
  onLoadingChange,
}: UseUserMembershipsOptions): UseUserMembershipsReturn {
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Held in a ref so `loadMemberships` keeps a stable identity regardless of
  // whether callers pass inline callbacks — the auto-load effect that depends
  // on it must not re-run on every render.
  const callbacksRef = useRef({ onError, onLoadingChange });
  callbacksRef.current = { onError, onLoadingChange };

  const reportError = useCallback((message: string | null) => {
    setError(message);
    callbacksRef.current.onError?.(message);
  }, []);
  const reportLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
    callbacksRef.current.onLoadingChange?.(loading);
  }, []);

  const loadMemberships = useCallback(
    async (user: OktaUser, options?: { force?: boolean }) => {
      if (!targetTabId) {
        reportError('No Okta tab connected');
        return;
      }

      reportError(null);

      // Serve a fresh cached analysis instantly (no loading flash) unless forcing.
      // Re-navigating back to a user, or re-selecting one, then costs nothing.
      if (!options?.force) {
        const cached = peek<GroupMembership[]>(['userMemberships', user.id]);
        if (cached) {
          setMemberships(cached);
          // Own the loading lifecycle fully: a caller (e.g. the Users tab's detected-
          // user "Load") may have flipped loading on before calling us, so clear it
          // here too — otherwise a cache hit leaves the spinner stuck on forever.
          reportLoading(false);
          return;
        }
      }

      reportLoading(true);

      try {
        // Fetch + analyze through the entity cache so concurrent callers de-dup and
        // the result is reused on remount. `force` bypasses cache + in-flight.
        const analyzedMemberships = await getOrFetch<GroupMembership[]>(
          ['userMemberships', user.id],
          async () => {
            log.debug('Loading memberships for user:', user.id);

            // Fetch user's groups
            const groupsResponse = await chrome.tabs.sendMessage(targetTabId, {
              action: 'getUserGroups',
              userId: user.id,
            });

            if (!groupsResponse.success) {
              throw new Error(groupsResponse.error || 'Failed to fetch user groups');
            }

            // Check cache for rules first
            let rules: FormattedRule[] = [];
            const cachedRules = await RulesCache.get();

            if (cachedRules) {
              log.debug('Using cached rules from global cache');
              rules = cachedRules.rules;
            } else {
              // Cache miss - fetch rules
              log.debug('Cache miss - fetching rules');
              const rulesResponse = await chrome.tabs.sendMessage(targetTabId, {
                action: 'fetchGroupRules',
              });

              if (!rulesResponse.success) {
                log.warn('Could not fetch rules for analysis:', rulesResponse.error);
              } else {
                rules = rulesResponse.rules || [];
                // Populate cache for future use
                await RulesCache.set(
                  rules,
                  [],
                  rulesResponse.stats || { total: 0, active: 0, inactive: 0, conflicts: 0 },
                  rulesResponse.conflicts || [],
                );
              }
            }

            // Extract raw groups from membership wrapper objects
            // groupsResponse.data is an array of { group, membershipType, addedDate }
            const membershipData: Array<{ group?: OktaGroup }> = groupsResponse.data || [];
            const rawGroups: OktaGroup[] = membershipData.map(
              (m) => m.group || (m as unknown as OktaGroup),
            );
            return analyzeMemberships(rawGroups, rules, user);
          },
          { force: options?.force },
        );

        setMemberships(analyzedMemberships);
        log.debug('Loaded memberships:', { count: analyzedMemberships.length });
      } catch (err) {
        reportError(err instanceof Error ? err.message : 'Failed to load user memberships');
        setMemberships([]);
        log.error('Membership loading error:', err);
      } finally {
        reportLoading(false);
      }
    },
    [targetTabId, reportError, reportLoading],
  );

  const clearMemberships = useCallback(() => {
    setMemberships([]);
    reportError(null);
  }, [reportError]);

  return {
    memberships,
    isLoading,
    error,
    loadMemberships,
    clearMemberships,
  };
}
