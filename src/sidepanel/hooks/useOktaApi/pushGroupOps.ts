/**
 * @module hooks/useOktaApi/pushGroupOps
 * @description Push group mapping operations for tracking which groups are pushed to external apps
 */

import type { CoreApi } from './core';
import type { PushGroupMapping, GroupSummary } from '../../../shared/types';
import { parseNextLink } from './utilities';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('pushGroupOps');

/**
 * Build push-group mapping operations.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns `{ getAppPushGroupMappings, applyPushGroupMappings }`.
 * @remarks Note: this factory is not currently re-exported from the barrel; it is
 * wired up where push-group enrichment is needed.
 */
export function createPushGroupOperations(coreApi: CoreApi) {
  /**
   * Fetch the push-group mappings for a single app.
   *
   * @param appId - App to inspect.
   * @param appName - Optional label to stamp onto each returned mapping.
   * @returns One {@link PushGroupMapping} per assigned group across all pages; `[]` on error.
   * @remarks Pages `/api/v1/apps/{id}/groups` (200 per page) at `low` priority so it
   * yields to interactive work. Group id is recovered from each assignment's
   * `_links.group.href`; `status` is inferred `ACTIVE` when a `priority` is present.
   * Errors are swallowed (logged only) and truncate the result.
   */
  const getAppPushGroupMappings = async (
    appId: string,
    appName?: string,
  ): Promise<PushGroupMapping[]> => {
    const mappings: PushGroupMapping[] = [];
    let nextUrl: string | null = `/api/v1/apps/${appId}/groups?limit=200`;

    try {
      while (nextUrl) {
        const response = await coreApi.makeApiRequest(nextUrl, 'GET', undefined, 'low');
        if (!response.success || !response.data) break;

        for (const assignment of response.data) {
          mappings.push({
            mappingId:
              assignment.id ||
              `${appId}_${assignment._links?.group?.href?.split('/').pop() || 'unknown'}`,
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
      log.error(`Failed to fetch push mappings for app ${appId}:`, error);
    }

    return mappings;
  };

  /**
   * Enrich groups with push-mapping and resolved source-app-name data.
   *
   * @param groups - Groups to enrich (only `APP_GROUP`-type with a `sourceAppId` trigger lookups).
   * @param onProgress - Called as each app's mappings resolve with `(processed, total)`.
   * @returns A new array where matched groups gain `pushMappings` and/or a resolved
   * `sourceAppName`; groups with no updates are returned unchanged (same reference).
   * @remarks Resolves each unique app's label and fetches its mappings in parallel
   * (one request per app, at `low` priority — the scheduler caps real concurrency).
   * Returns `groups` untouched when no `APP_GROUP` sources are present.
   */
  const applyPushGroupMappings = async (
    groups: GroupSummary[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<GroupSummary[]> => {
    // Collect unique app IDs from APP_GROUP type groups
    const appIds = new Map<string, string>(); // appId -> appName
    for (const group of groups) {
      if (group.type === 'APP_GROUP' && group.sourceAppId) {
        appIds.set(group.sourceAppId, group.sourceAppName || group.sourceAppId);
      }
    }

    if (appIds.size === 0) return groups;

    // Resolve app labels from Okta API (1 request per unique app, in parallel)
    const resolvedNames = await Promise.all(
      Array.from(appIds.keys()).map(async (appId) => {
        try {
          const response = await coreApi.makeApiRequest(
            `/api/v1/apps/${appId}`,
            'GET',
            undefined,
            'low',
          );
          if (response.success && response.data) {
            const label = response.data.label || response.data.name;
            if (label) return { appId, name: label };
          }
        } catch {
          // Keep existing name on failure
        }
        return null;
      }),
    );

    // Update appIds map with resolved labels
    for (const result of resolvedNames) {
      if (result) {
        appIds.set(result.appId, result.name);
      }
    }

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
      }),
    );

    const allMappings = mappingResults.flat();

    // Build lookup: groupId -> mappings[]
    const mappingsByGroup = new Map<string, PushGroupMapping[]>();
    for (const mapping of allMappings) {
      const existing = mappingsByGroup.get(mapping.sourceUserGroupId) || [];
      existing.push(mapping);
      mappingsByGroup.set(mapping.sourceUserGroupId, existing);
    }

    // Apply push mappings and resolved app names to groups
    return groups.map((group) => {
      const pushMappings = mappingsByGroup.get(group.id);
      const resolvedAppName = group.sourceAppId ? appIds.get(group.sourceAppId) : undefined;
      const updates: Partial<GroupSummary> = {};

      if (pushMappings && pushMappings.length > 0) {
        updates.pushMappings = pushMappings;
      }
      if (resolvedAppName && resolvedAppName !== group.sourceAppId) {
        updates.sourceAppName = resolvedAppName;
      }

      return Object.keys(updates).length > 0 ? { ...group, ...updates } : group;
    });
  };

  return {
    getAppPushGroupMappings,
    applyPushGroupMappings,
  };
}
