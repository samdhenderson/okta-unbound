/**
 * @module content/ruleHandlers
 * @description Group-rule message handlers for the content script.
 *
 * Covers fetching all group rules (with unbounded pagination, parallel cached
 * group-name resolution, and simple conflict detection) plus activating and
 * deactivating individual rules. Each handler returns a `MessageResponse` and
 * routes every network call through the same-origin fetch primitive.
 *
 * @see `content/apiRequest` for the transport primitive.
 * @see `content/index` for message routing.
 */

import type { MessageResponse, OktaGroupRule, RuleConflict } from '../shared/types';
import { getCacheEntry, setCacheEntry } from '../shared/cache';
import { createLogger } from '../shared/utils/logger';
import { extractGroupIdFromUrl } from './pageContext';
import { handleMakeApiRequest } from './apiRequest';

const log = createLogger('Content');

/**
 * Fetch every group rule across all pages, resolve referenced group names (cached,
 * in parallel), detect simple attribute/target conflicts between active rules, and
 * return formatted rules plus aggregate stats.
 *
 * @param groupId - Optional current group ID; falls back to the URL when omitted.
 * @returns A response with `rules`, `stats`, and `conflicts`, or an error.
 */
export async function handleFetchGroupRules(groupId?: string): Promise<MessageResponse> {
  log.debug('Processing fetchGroupRules request', { groupId });

  try {
    // Fetch all rules with pagination
    let allRules: OktaGroupRule[] = [];
    let nextUrl: string | null = '/api/v1/groups/rules?limit=200';

    while (nextUrl) {
      const response = await handleMakeApiRequest(nextUrl, 'GET');

      if (!response.success) {
        return response;
      }

      allRules = allRules.concat(response.data || []);

      // Parse next link from headers
      nextUrl = null;
      if (response.headers?.link) {
        const links = response.headers.link.split(',');
        for (const link of links) {
          if (link.includes('rel="next"')) {
            const match = link.match(/<([^>]+)>/);
            if (match) {
              const fullUrl = new URL(match[1]);
              nextUrl = fullUrl.pathname + fullUrl.search;
              log.debug('Fetching next page of rules', { path: fullUrl.pathname });
              break;
            }
          }
        }
      }
    }

    const rules: OktaGroupRule[] = allRules;
    log.debug('Fetched rules (total across all pages)', { count: rules.length });

    // Use provided groupId or extract from URL if on a group page
    const currentGroupId = groupId || extractGroupIdFromUrl(window.location.href);

    // Collect all unique group IDs from all rules
    const allGroupIds = new Set<string>();
    rules.forEach((rule) => {
      // Add target group IDs (groups users are assigned to)
      const groupIds = rule.actions?.assignUserToGroups?.groupIds || [];
      groupIds.forEach((id: string) => allGroupIds.add(id));

      // Also extract and add group IDs from the condition expression
      const expression = rule.conditions?.expression?.value || '';
      const groupIdPattern = /\b00g[a-zA-Z0-9]{17}\b/g;
      const matches = expression.match(groupIdPattern);
      if (matches) {
        matches.forEach((id: string) => allGroupIds.add(id));
      }
    });

    // Fetch group details for all group IDs in parallel (optimized)
    const groupNameMap = new Map<string, string>();
    log.debug('Fetching group names in parallel', { count: allGroupIds.size });

    // Create an array of promises to fetch all groups in parallel with caching
    const groupFetchPromises = Array.from(allGroupIds).map(async (groupId) => {
      try {
        // Check cache first
        const cacheKey = `group_name_${groupId}`;
        const cachedName = await getCacheEntry<string>(cacheKey);

        if (cachedName) {
          log.debug('Using cached name for group', { groupId });
          return { groupId, name: cachedName };
        }

        // Fetch from API if not cached
        const groupResponse = await handleMakeApiRequest(`/api/v1/groups/${groupId}`, 'GET');
        if (groupResponse.success && groupResponse.data?.profile?.name) {
          const groupName = groupResponse.data.profile.name;

          // Cache the result (5 minute TTL)
          await setCacheEntry(cacheKey, groupName, { ttl: 5 * 60 * 1000 });

          return { groupId, name: groupName };
        }
      } catch (err) {
        log.warn('Failed to fetch group name for group', { groupId }, err);
      }
      return null;
    });

    // Wait for all group fetches to complete
    const groupResults = await Promise.all(groupFetchPromises);

    // Populate the map with successful results
    groupResults.forEach((result) => {
      if (result) {
        groupNameMap.set(result.groupId, result.name);
      }
    });

    log.debug('Successfully fetched group names (parallel fetch with caching)', {
      count: groupNameMap.size,
    });

    // Calculate stats
    const activeRules = rules.filter((r) => r.status === 'ACTIVE');
    const inactiveRules = rules.filter((r) => r.status === 'INACTIVE');

    // Detect conflicts (simple implementation in content script)
    let conflictCount = 0;
    const conflicts: RuleConflict[] = [];

    for (let i = 0; i < activeRules.length; i++) {
      for (let j = i + 1; j < activeRules.length; j++) {
        const rule1 = activeRules[i];
        const rule2 = activeRules[j];

        const groups1 = rule1.actions?.assignUserToGroups?.groupIds || [];
        const groups2 = rule2.actions?.assignUserToGroups?.groupIds || [];
        const sharedGroups = groups1.filter((g: string) => groups2.includes(g));

        if (sharedGroups.length > 0) {
          // Extract user attributes
          const expr1 = rule1.conditions?.expression?.value || '';
          const expr2 = rule2.conditions?.expression?.value || '';
          const attrs1 = (expr1.match(/user\.(\w+)/g) || []).map((m: string) =>
            m.replace('user.', ''),
          );
          const attrs2 = (expr2.match(/user\.(\w+)/g) || []).map((m: string) =>
            m.replace('user.', ''),
          );
          const commonAttrs = attrs1.filter((a: string) => attrs2.includes(a));

          if (commonAttrs.length > 0) {
            conflictCount++;
            conflicts.push({
              rule1: { id: rule1.id, name: rule1.name },
              rule2: { id: rule2.id, name: rule2.name },
              reason: `Both rules use ${commonAttrs.join(', ')} and assign to ${sharedGroups.length} shared group(s)`,
              severity:
                sharedGroups.length > 2 ? 'high' : sharedGroups.length > 1 ? 'medium' : 'low',
              affectedGroups: sharedGroups,
            });
          }
        }
      }
    }

    // Format rules for display
    const formattedRules = rules.map((rule) => {
      const groupIds = rule.actions?.assignUserToGroups?.groupIds || [];
      const expression = rule.conditions?.expression?.value || 'No condition specified';

      // Extract user attributes
      const attrs = (expression.match(/user\.(\w+)/g) || []).map((m: string) =>
        m.replace('user.', ''),
      );

      // Simplify expression for display
      const simpleCondition = expression
        .replace(/user\./g, '')
        .replace(/isMemberOfAnyGroup/g, 'is member of group')
        .replace(/isMemberOfGroup/g, 'is member of group');

      // Check if this rule affects the current group
      const affectsCurrentGroup = currentGroupId ? groupIds.includes(currentGroupId) : false;

      // Find conflicts involving this rule
      const ruleConflicts = conflicts.filter(
        (c) => c.rule1.id === rule.id || c.rule2.id === rule.id,
      );

      // Map group IDs to their names (for target groups)
      const groupNames = groupIds.map((id: string) => groupNameMap.get(id) || id);

      // Extract group IDs from condition expression and create a map of ALL group IDs -> names
      const conditionGroupIds = expression.match(/\b00g[a-zA-Z0-9]{17}\b/g) || [];
      const allGroupIdsInRule = [...new Set([...groupIds, ...conditionGroupIds])];
      const allGroupNamesMap: Record<string, string> = {};
      allGroupIdsInRule.forEach((id) => {
        const name = groupNameMap.get(id);
        if (name) {
          allGroupNamesMap[id] = name;
        }
      });

      return {
        id: rule.id,
        name: rule.name,
        status: rule.status,
        type: rule.type || 'group_rule',
        condition: simpleCondition,
        conditionExpression: expression,
        groupIds,
        groupNames,
        allGroupNamesMap, // New field: map of all group IDs (in condition and targets) to names
        userAttributes: attrs,
        created: rule.created,
        lastUpdated: rule.lastUpdated,
        affectsCurrentGroup,
        conflicts: ruleConflicts,
      };
    });

    const stats = {
      total: rules.length,
      active: activeRules.length,
      inactive: inactiveRules.length,
      conflicts: conflictCount,
    };

    log.debug('Rule stats', stats);

    return {
      success: true,
      rules: formattedRules,
      stats,
      conflicts,
    };
  } catch (error) {
    log.error('fetchGroupRules error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch rules',
    };
  }
}

/**
 * Activate a single group rule by ID.
 *
 * @param ruleId - The rule to activate.
 * @returns A success response, or the underlying error response.
 */
export async function handleActivateRule(ruleId: string): Promise<MessageResponse> {
  log.debug('Activating rule', { ruleId });

  try {
    const response = await handleMakeApiRequest(
      `/api/v1/groups/rules/${ruleId}/lifecycle/activate`,
      'POST',
    );

    if (response.success) {
      log.debug('Rule activated successfully');
      return { success: true };
    } else {
      return response;
    }
  } catch (error) {
    log.error('activateRule error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to activate rule',
    };
  }
}

/**
 * Deactivate a single group rule by ID.
 *
 * @param ruleId - The rule to deactivate.
 * @returns A success response, or the underlying error response.
 */
export async function handleDeactivateRule(ruleId: string): Promise<MessageResponse> {
  log.debug('Deactivating rule', { ruleId });

  try {
    const response = await handleMakeApiRequest(
      `/api/v1/groups/rules/${ruleId}/lifecycle/deactivate`,
      'POST',
    );

    if (response.success) {
      log.debug('Rule deactivated successfully');
      return { success: true };
    } else {
      return response;
    }
  } catch (error) {
    log.error('deactivateRule error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deactivate rule',
    };
  }
}
