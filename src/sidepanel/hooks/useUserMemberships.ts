/**
 * @module sidepanel/hooks/useUserMemberships
 * @description Loads a user's groups and classifies each membership as DIRECT or RULE_BASED.
 *
 * Okta's API does not report how a user landed in a group, so this module infers
 * it heuristically (APP_GROUP → rule, rule-exclusion → direct, matching active
 * rules → rule with confidence, otherwise direct). See OKTA_API_LIMITATIONS.md §2.
 * Group rules are read from the shared `RulesCache` and refetched on a miss.
 */

import { useState, useCallback } from 'react';
import type { OktaUser, GroupMembership, OktaGroup, FormattedRule } from '../../shared/types';
import { RulesCache } from '../../shared/rulesCache';
import { analyzeMemberships } from '../../shared/utils/membershipAnalysis';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useUserMemberships');

/** Options for {@link useUserMemberships}. */
interface UseUserMembershipsOptions {
  /** Tab whose content script fetches groups/rules; loading errors when undefined. */
  targetTabId: number | undefined;
}

/** Return shape of {@link useUserMemberships}. */
interface UseUserMembershipsReturn {
  memberships: GroupMembership[];
  isLoading: boolean;
  error: string | null;
  loadMemberships: (user: OktaUser) => Promise<void>;
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
}: UseUserMembershipsOptions): UseUserMembershipsReturn {
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMemberships = useCallback(
    async (user: OktaUser) => {
      if (!targetTabId) {
        setError('No Okta tab connected');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
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
        const analyzedMemberships = analyzeMemberships(rawGroups, rules, user);

        setMemberships(analyzedMemberships);

        log.debug('Loaded memberships:', {
          count: analyzedMemberships.length,
          usedCache: cachedRules !== null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user memberships');
        setMemberships([]);
        log.error('Membership loading error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [targetTabId],
  );

  const clearMemberships = useCallback(() => {
    setMemberships([]);
    setError(null);
  }, []);

  return {
    memberships,
    isLoading,
    error,
    loadMemberships,
    clearMemberships,
  };
}
