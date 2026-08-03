/**
 * @module hooks/useOktaApi/groupDiscovery
 * @description Group discovery and search operations
 */

import type { CoreApi } from './core';
import type { OktaGroup, OktaGroupRule, FormattedRule } from '../../../shared/types';
import { RulesCache } from '../../../shared/rulesCache';
import { detectConflicts, formatRuleForDisplay } from '../../../shared/ruleUtils';
import { fetchAllPages, OKTA_PAGE_SIZE } from '@/shared/utils/oktaPagination';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useOktaApi');

/**
 * Build read-only group discovery/search operations.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns Group listing, member-count, rules, search, and by-id lookups.
 */
export function createGroupDiscoveryOperations(coreApi: CoreApi) {
  /**
   * List every group, following `Link` pagination (200 per page, `expand=stats`).
   *
   * @param onProgress - Called after each page with the running loaded count.
   * @returns All groups across all pages.
   * @remarks Throws on the first failed page.
   */
  const getAllGroups = async (
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<OktaGroup[]> =>
    fetchAllPages<OktaGroup>(
      (url) => coreApi.makeApiRequest(url),
      `/api/v1/groups?limit=${OKTA_PAGE_SIZE}&expand=stats`,
      {
        errorMessage: 'Failed to fetch groups',
        onPage: (_pageGroups, totalSoFar) => onProgress?.(totalSoFar, totalSoFar),
      },
    );

  /**
   * Approximate a group's member count from the first page of members.
   *
   * @param groupId - Group to size.
   * @returns The first-page member count (max 200), or `0` on failure.
   * @remarks Intentionally does NOT walk pagination — for groups larger than one
   * page this returns the page size (200), i.e. a floor, not the exact total.
   */
  const getGroupMemberCount = async (groupId: string): Promise<number> => {
    try {
      const usersResponse = await coreApi.makeApiRequest(
        `/api/v1/groups/${groupId}/users?limit=${OKTA_PAGE_SIZE}`,
      );
      if (usersResponse.success && usersResponse.data) {
        return usersResponse.data.length;
      }

      return 0;
    } catch (error) {
      log.error(`Failed to get member count for group ${groupId}:`, error);
      return 0;
    }
  };

  /**
   * Resolve the group rules that assign users to a given group.
   *
   * @param groupId - Group whose inbound assignment rules to find.
   * @returns Matching rules, or `[]` on failure/none.
   * @remarks Serves from {@link RulesCache} when populated or fresh; otherwise
   * fetches the full rules list (following `Link` pagination, 200 per page),
   * writes it back to the cache so subsequent lookups — for any group — are
   * served without refetching, and returns the rules targeting `groupId`.
   */
  const getGroupRulesForGroup = async (
    groupId: string,
  ): Promise<FormattedRule[] | OktaGroupRule[]> => {
    try {
      // Check cache first
      const cachedRules = await RulesCache.getRulesForGroup(groupId);
      if (cachedRules.length > 0 || (await RulesCache.isFresh())) {
        log.debug(`Using cached rules for group ${groupId}:`, cachedRules.length);
        return cachedRules;
      }

      // Cache miss - fetch ALL group rules, following pagination so orgs with
      // more than one page (>200 rules) are not silently truncated.
      log.debug(`Cache miss - fetching all rules for group ${groupId}`);
      const allRules = await fetchAllPages<OktaGroupRule>(
        (url) => coreApi.makeApiRequest(url),
        `/api/v1/groups/rules?limit=${OKTA_PAGE_SIZE}`,
      );

      // Write back to the global cache so the next call (any group) hits it.
      // No currentGroupId is passed to the formatter: the cache is org-wide, so
      // baking one group's `affectsCurrentGroup` flag into it would be wrong.
      const conflicts = detectConflicts(allRules);
      const formattedRules = allRules.map((rule) =>
        formatRuleForDisplay(rule, undefined, conflicts),
      );
      await RulesCache.set(
        formattedRules,
        allRules,
        {
          total: allRules.length,
          active: allRules.filter((r) => r.status === 'ACTIVE').length,
          inactive: allRules.filter((r) => r.status === 'INACTIVE').length,
          conflicts: conflicts.length,
        },
        conflicts,
      );

      // Filter rules that target this group
      const groupRules = allRules.filter((rule) => {
        const targetGroupIds = rule.actions?.assignUserToGroups?.groupIds || [];
        return targetGroupIds.includes(groupId);
      });

      return groupRules;
    } catch (error) {
      log.error(`Failed to get rules for group ${groupId}:`, error);
      return [];
    }
  };

  /**
   * Search groups by name via Okta's `q` query (capped at 20 results).
   *
   * @param query - Search text; queries shorter than 2 chars short-circuit to `[]`.
   * @returns Lightweight `{ id, name, description, type }` records; `[]` on error.
   */
  const searchGroups = async (
    query: string,
  ): Promise<Array<{ id: string; name: string; description: string; type: string }>> => {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      const response = await coreApi.makeApiRequest(
        `/api/v1/groups?q=${encodeURIComponent(query)}&limit=20`,
      );

      if (response.success && response.data) {
        return response.data.map((group: OktaGroup) => ({
          id: group.id,
          name: group.profile?.name || group.id,
          description: group.profile?.description || '',
          type: group.type || 'OKTA_GROUP',
        }));
      }
      return [];
    } catch (error) {
      log.error('searchGroups error:', error);
      return [];
    }
  };

  /**
   * Fetch one group by id.
   *
   * @param groupId - Group id to look up.
   * @returns A lightweight `{ id, name, description, type }` record, or `null` if
   * not found / on error.
   */
  const getGroupById = async (
    groupId: string,
  ): Promise<{ id: string; name: string; description: string; type: string } | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}`);
      if (response.success && response.data) {
        const group = response.data;
        return {
          id: group.id,
          name: group.profile?.name || group.id,
          description: group.profile?.description || '',
          type: group.type || 'OKTA_GROUP',
        };
      }
      return null;
    } catch (error) {
      log.error('getGroupById error:', error);
      return null;
    }
  };

  return {
    getAllGroups,
    getGroupMemberCount,
    getGroupRulesForGroup,
    searchGroups,
    getGroupById,
  };
}
