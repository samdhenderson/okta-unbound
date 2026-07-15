/**
 * @module hooks/useOktaApi/groupDiscovery
 * @description Group discovery and search operations
 */

import type { CoreApi } from './core';
import type { OktaGroup, OktaGroupRule, FormattedRule } from '../../../shared/types';
import { RulesCache } from '../../../shared/rulesCache';
import { parseNextLink } from './utilities';
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
  ): Promise<OktaGroup[]> => {
    const allGroups: OktaGroup[] = [];
    let nextUrl: string | null = '/api/v1/groups?limit=200&expand=stats';

    while (nextUrl) {
      const response = await coreApi.makeApiRequest(nextUrl);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch groups');
      }

      const pageGroups = response.data || [];
      allGroups.push(...pageGroups);

      onProgress?.(allGroups.length, allGroups.length);

      nextUrl = parseNextLink(response.headers?.link);
    }

    return allGroups;
  };

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
        `/api/v1/groups/${groupId}/users?limit=200`,
      );
      if (usersResponse.success && usersResponse.data) {
        const firstPageCount = usersResponse.data.length;

        const linkHeader = usersResponse.headers?.['link'] || usersResponse.headers?.['Link'];
        const hasMorePages = linkHeader && linkHeader.includes('rel="next"');

        if (hasMorePages) {
          return firstPageCount;
        }

        return firstPageCount;
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
   * fetches all rules once (200 limit) and filters those targeting `groupId`.
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

      // Cache miss - fetch all group rules
      log.debug(`Cache miss - fetching all rules for group ${groupId}`);
      const response = await coreApi.makeApiRequest('/api/v1/groups/rules?limit=200');
      if (!response.success) {
        return [];
      }

      const allRules: OktaGroupRule[] = response.data || [];

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
