/**
 * @module hooks/useOktaApi/groupDiscovery
 * @description Group discovery and search operations
 */

import type { CoreApi } from './core';
import { RulesCache } from '../../../shared/rulesCache';
import { parseNextLink } from './utilities';

export function createGroupDiscoveryOperations(coreApi: CoreApi) {
  /**
   * Get all groups with pagination
   */
  const getAllGroups = async (onProgress?: (loaded: number, total: number) => void): Promise<any[]> => {
    const allGroups: any[] = [];
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
   * Get member count for a group
   */
  const getGroupMemberCount = async (groupId: string): Promise<number> => {
    try {
      const usersResponse = await coreApi.makeApiRequest(`/api/v1/groups/${groupId}/users?limit=200`);
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
      console.error(`[useOktaApi] Failed to get member count for group ${groupId}:`, error);
      return 0;
    }
  };

  /**
   * Get group rules for a specific group
   */
  const getGroupRulesForGroup = async (groupId: string): Promise<any[]> => {
    try {
      // Check cache first
      const cachedRules = await RulesCache.getRulesForGroup(groupId);
      if (cachedRules.length > 0 || (await RulesCache.isFresh())) {
        console.log(`[useOktaApi] Using cached rules for group ${groupId}:`, cachedRules.length);
        return cachedRules;
      }

      // Cache miss - fetch all group rules
      console.log(`[useOktaApi] Cache miss - fetching all rules for group ${groupId}`);
      const response = await coreApi.makeApiRequest('/api/v1/groups/rules?limit=200');
      if (!response.success) {
        return [];
      }

      const allRules = response.data || [];

      // Filter rules that target this group
      const groupRules = allRules.filter((rule: any) => {
        const targetGroupIds = rule.actions?.assignUserToGroups?.groupIds || [];
        return targetGroupIds.includes(groupId);
      });

      return groupRules;
    } catch (error) {
      console.error(`[useOktaApi] Failed to get rules for group ${groupId}:`, error);
      return [];
    }
  };

  /**
   * Find user across groups
   */
  const findUserAcrossGroups = async (query: string): Promise<any> => {
    try {
      // Search for user
      const userResponse = await coreApi.makeApiRequest(`/api/v1/users?q=${encodeURIComponent(query)}&limit=1`);
      if (!userResponse.success || !userResponse.data || userResponse.data.length === 0) {
        throw new Error('User not found');
      }

      const user = userResponse.data[0];

      // Get all groups for user
      let allGroups: any[] = [];
      let nextUrl: string | null = `/api/v1/users/${user.id}/groups?limit=200`;

      while (nextUrl) {
        const groupsResponse = await coreApi.makeApiRequest(nextUrl);
        if (!groupsResponse.success) break;

        allGroups = allGroups.concat(groupsResponse.data || []);

        nextUrl = parseNextLink(groupsResponse.headers?.link);
      }

      return {
        user,
        groups: allGroups,
      };
    } catch (error) {
      throw new Error(`Failed to find user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /**
   * Search for groups by name
   */
  const searchGroups = async (
    query: string
  ): Promise<Array<{ id: string; name: string; description: string; type: string }>> => {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      const response = await coreApi.makeApiRequest(`/api/v1/groups?q=${encodeURIComponent(query)}&limit=20`);

      if (response.success && response.data) {
        return response.data.map((group: any) => ({
          id: group.id,
          name: group.profile?.name || group.id,
          description: group.profile?.description || '',
          type: group.type || 'OKTA_GROUP',
        }));
      }
      return [];
    } catch (error) {
      console.error('[useOktaApi] searchGroups error:', error);
      return [];
    }
  };

  /**
   * Get group details by ID
   */
  const getGroupById = async (
    groupId: string
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
      console.error('[useOktaApi] getGroupById error:', error);
      return null;
    }
  };

  return {
    getAllGroups,
    getGroupMemberCount,
    getGroupRulesForGroup,
    findUserAcrossGroups,
    searchGroups,
    getGroupById,
  };
}
