/**
 * @module hooks/useOktaApi/pushGroupOps
 * @description Push group mapping operations for tracking which groups are pushed to external apps
 */

import type { CoreApi } from './core';
import type { PushGroupMapping, GroupSummary } from '../../../shared/types';
import { parseNextLink } from './utilities';

export function createPushGroupOperations(coreApi: CoreApi) {
  /**
   * Fetch push group mappings for an app.
   * Uses the Okta Apps API to get groups assigned to an application,
   * then checks for push group configurations.
   */
  const getAppPushGroupMappings = async (appId: string, appName?: string): Promise<PushGroupMapping[]> => {
    const mappings: PushGroupMapping[] = [];
    let nextUrl: string | null = `/api/v1/apps/${appId}/groups?limit=200`;

    try {
      while (nextUrl) {
        const response = await coreApi.makeApiRequest(nextUrl, 'GET', undefined, 'low');
        if (!response.success || !response.data) break;

        for (const assignment of response.data) {
          mappings.push({
            mappingId: assignment.id || `${appId}_${assignment._links?.group?.href?.split('/').pop() || 'unknown'}`,
            sourceUserGroupId: assignment._links?.group?.href?.split('/').pop() || '',
            targetGroupName: assignment.profile?.name || assignment.profile?.groupName || '',
            status: assignment.priority !== undefined ? 'ACTIVE' : 'INACTIVE',
            appId,
            appName,
          });
        }

        nextUrl = parseNextLink(response.headers?.link);
      }
    } catch (error) {
      console.error(`[pushGroupOps] Failed to fetch push mappings for app ${appId}:`, error);
    }

    return mappings;
  };

  /**
   * Auto-detect apps from APP_GROUP sources and fetch their push mappings,
   * then apply those mappings to the provided groups.
   */
  const applyPushGroupMappings = async (
    groups: GroupSummary[],
    onProgress?: (current: number, total: number) => void
  ): Promise<GroupSummary[]> => {
    // Collect unique app IDs from APP_GROUP type groups
    const appIds = new Map<string, string>(); // appId -> appName
    for (const group of groups) {
      if (group.type === 'APP_GROUP' && group.sourceAppId) {
        appIds.set(group.sourceAppId, group.sourceAppName || group.sourceAppId);
      }
    }

    if (appIds.size === 0) return groups;

    // Fetch push mappings for all apps in parallel (scheduler handles concurrency)
    const appEntries = Array.from(appIds.entries());
    const total = appEntries.length;
    let processed = 0;

    const mappingResults = await Promise.all(
      appEntries.map(async ([appId, appName]) => {
        const mappings = await getAppPushGroupMappings(appId, appName);
        processed++;
        onProgress?.(processed, total);
        return mappings;
      })
    );

    const allMappings = mappingResults.flat();

    // Build lookup: groupId -> mappings[]
    const mappingsByGroup = new Map<string, PushGroupMapping[]>();
    for (const mapping of allMappings) {
      const existing = mappingsByGroup.get(mapping.sourceUserGroupId) || [];
      existing.push(mapping);
      mappingsByGroup.set(mapping.sourceUserGroupId, existing);
    }

    // Apply to groups
    return groups.map((group) => {
      const pushMappings = mappingsByGroup.get(group.id);
      if (pushMappings && pushMappings.length > 0) {
        return { ...group, pushMappings };
      }
      return group;
    });
  };

  return {
    getAppPushGroupMappings,
    applyPushGroupMappings,
  };
}
