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
import type {
  OktaUser,
  GroupMembership,
  OktaGroup,
  MembershipRule,
  FormattedRule,
} from '../../shared/types';
import { RulesCache } from '../../shared/rulesCache';
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
 * Check if a user is explicitly excluded from a rule.
 * Users on the exclusion list are not affected by the rule even if they match conditions.
 */
function isUserExcludedFromRule(rule: MembershipRule, userId: string): boolean {
  const excludedUsers = rule.conditions?.people?.users?.exclude || [];
  return excludedUsers.includes(userId);
}

/**
 * Analyzes group memberships to determine if they are DIRECT or RULE_BASED.
 *
 * IMPORTANT: Okta API doesn't directly indicate if a user was added via rule or manually.
 * We use heuristics (see OKTA_API_LIMITATIONS.md §2):
 *
 * 1. APP_GROUPs are always RULE_BASED (managed by application)
 * 2. If user is on the EXCLUSION LIST of all rules for a group → DIRECT
 *    (They're excluded from rules but still in group = manual add)
 * 3. Groups with matching ACTIVE rules → RULE_BASED (with confidence level)
 * 4. Groups without any active rules → DIRECT
 *
 * LIMITATIONS:
 * - Cannot evaluate isMemberOfGroup() conditions
 * - Cannot evaluate app.* attributes
 * - Historical rule changes may affect accuracy
 */
function analyzeMemberships(
  groups: OktaGroup[],
  rules: MembershipRule[],
  user: OktaUser,
): GroupMembership[] {
  log.debug('Analyzing memberships for user:', user.id);
  log.debug(
    'Total rules:',
    rules.length,
    'Active rules:',
    rules.filter((r) => r.status === 'ACTIVE').length,
  );
  log.debug('Total groups:', groups.length);

  return groups.map((group) => {
    // APP_GROUPs are always managed by the application (rule-based)
    if (group.type === 'APP_GROUP') {
      log.debug(`Group ${group.id}: APP_GROUP (application managed)`);
      return {
        group: group,
        membershipType: 'RULE_BASED' as const,
        rule: undefined,
      };
    }

    // Find ACTIVE rules that assign users to this group
    const matchingRules = rules.filter((rule) => {
      if (rule.status !== 'ACTIVE') return false;
      const groupIds = rule.groupIds || rule.actions?.assignUserToGroups?.groupIds || [];
      return groupIds.includes(group.id);
    });

    log.debug(`Group ${group.id}: Found ${matchingRules.length} active rules`);

    if (matchingRules.length === 0) {
      // No active rules for this group - must be direct assignment
      log.debug(`Group ${group.id}: DIRECT (no active rules)`);
      return {
        group: group,
        membershipType: 'DIRECT' as const,
        rule: undefined,
      };
    }

    // NEW: Check if user is excluded from ALL rules for this group
    // If excluded from all rules but still in group = definitely DIRECT assignment
    const rulesWithoutExclusion = matchingRules.filter(
      (rule) => !isUserExcludedFromRule(rule, user.id),
    );

    if (rulesWithoutExclusion.length === 0) {
      // User is excluded from ALL rules that target this group
      // They must have been added directly (manually)
      log.debug(`Group ${group.id}: DIRECT (user excluded from all ${matchingRules.length} rules)`);
      return {
        group: group,
        membershipType: 'DIRECT' as const,
        rule: undefined,
      };
    }

    // Log if user is excluded from some but not all rules
    if (rulesWithoutExclusion.length < matchingRules.length) {
      const excludedRules = matchingRules.filter((rule) => isUserExcludedFromRule(rule, user.id));
      log.debug(`Group ${group.id}: User excluded from ${excludedRules.length} rule(s)`);
    }

    // Try to evaluate which rule might have added the user
    let bestMatchRule = rulesWithoutExclusion[0];
    let confidence = 'low';

    for (const rule of rulesWithoutExclusion) {
      // Extract user attributes from rule condition
      const condition = rule.conditionExpression || rule.conditions?.expression?.value || '';
      const userAttrs = rule.userAttributes || [];

      // Basic heuristic: check if referenced attributes exist in user profile
      let attributesMatch = 0;
      let attributesChecked = 0;

      for (const attr of userAttrs) {
        attributesChecked++;
        const userValue = (user.profile as Record<string, unknown>)[attr];

        // If attribute exists and is non-empty, it's a potential match
        if (userValue !== undefined && userValue !== null && userValue !== '') {
          // Check if the condition references this attribute value
          const valueStr = String(userValue).toLowerCase();
          const conditionLower = condition.toLowerCase();

          if (conditionLower.includes(valueStr) || conditionLower.includes(`"${valueStr}"`)) {
            attributesMatch++;
          }
        }
      }

      // If we found attribute matches, this rule is more likely
      if (attributesChecked > 0 && attributesMatch >= attributesChecked * 0.5) {
        bestMatchRule = rule;
        confidence = attributesMatch === attributesChecked ? 'high' : 'medium';
        break;
      }
    }

    log.debug(
      `Group ${group.id}: RULE_BASED (rule: ${bestMatchRule.id}, confidence: ${confidence})`,
    );

    return {
      group: group,
      membershipType: 'RULE_BASED' as const,
      rule: bestMatchRule,
    };
  });
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
