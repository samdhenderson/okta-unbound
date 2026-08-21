/**
 * @module hooks/useOktaApi/pushGroupOps
 * @description Push group mapping operations for tracking which groups are pushed to external apps
 */

import type { CoreApi } from './core';
import type { PushGroupMapping, GroupSummary } from '../../../shared/types';
import { fetchAllPages, OKTA_PAGE_SIZE } from '@/shared/utils/oktaPagination';
import { oktaAppGroupAssignmentSchema, type OktaAppGroupAssignment } from '@/shared/schemas/okta';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('pushGroupOps');

/**
 * Build push-group mapping operations.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns `{ getAppPushGroupMappings, applyPushGroupMappings }`.
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
   * `_links.group.href`. The endpoint returns no activation status, so none is
   * synthesized — only Okta's real `priority` is carried through.
   * Errors are swallowed (logged only) and truncate the result.
   */
  const getAppPushGroupMappings = async (
    appId: string,
    appName?: string,
  ): Promise<PushGroupMapping[]> => {
    const mappings: PushGroupMapping[] = [];

    try {
      // Accumulate via onPage so a mid-walk failure still returns the pages
      // collected so far (fetchAllPages throws on a failed page).
      await fetchAllPages<OktaAppGroupAssignment>(
        (url) => coreApi.makeApiRequest(url, 'GET', undefined, 'low'),
        `/api/v1/apps/${appId}/groups?limit=${OKTA_PAGE_SIZE}`,
        {
          // Validated at the response boundary (ADR-0006): malformed rows are
          // dropped leniently by parseOktaList, never thrown on.
          schema: oktaAppGroupAssignmentSchema,
          onPage: (assignments) => {
            for (const assignment of assignments) {
              mappings.push({
                mappingId:
                  assignment.id ||
                  `${appId}_${assignment._links?.group?.href?.split('/').pop() || 'unknown'}`,
                sourceUserGroupId: assignment._links?.group?.href?.split('/').pop() || '',
                targetGroupName: assignment.profile?.name || assignment.profile?.groupName || '',
                priority: assignment.priority,
                appId,
                appName,
              });
            }
          },
        },
      );
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
   * @remarks Resolves each unique app's label, then fetches its mappings — both
   * phases through {@link CoreApi.runOperation} (ADR-0009) with bounded
   * concurrency at `low` priority, activity-bar visible and cancellable (a
   * cancel enriches with whatever resolved before it). A per-app label lookup
   * failure is logged (app id + outcome only) and keeps the existing name.
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

    // Resolve app labels (one request per unique app) through the shared
    // operation runner (ADR-0009): bounded concurrency, live activity view, one
    // Cancel. A per-app failure keeps the existing name — logged, never thrown.
    await coreApi.runOperation(
      'Resolve app names',
      Array.from(appIds.keys()),
      async (appId) => {
        try {
          const response = await coreApi.makeApiRequest(
            `/api/v1/apps/${appId}`,
            'GET',
            undefined,
            'low',
          );
          if (response.success && response.data) {
            const label = response.data.label || response.data.name;
            if (label) appIds.set(appId, label);
          }
        } catch (error) {
          // Keep existing name on failure — but never silently: a systemic
          // failure here (auth/rate limit) leaves every app showing its raw id.
          log.error(`Failed to resolve app label for app ${appId}:`, error);
        }
      },
      { message: (p) => `Resolving app names (${p.completed}/${p.total})` },
    );

    // Fetch push mappings for all apps, again through the operation runner.
    const appEntries = Array.from(appIds.entries());
    const total = appEntries.length;
    let processed = 0;

    const mappingOutcome = await coreApi.runOperation(
      'Load push-group mappings',
      appEntries,
      async ([appId, appName]) => {
        const mappings = await getAppPushGroupMappings(appId, appName);
        processed++;
        onProgress?.(processed, total);
        return mappings;
      },
      { message: (p) => `Loading push mappings (${p.completed}/${p.total})` },
    );

    // Skipped/rejected entries (cancel mid-run) simply contribute no mappings.
    const allMappings: PushGroupMapping[] = [];
    for (const r of mappingOutcome.results) {
      if (r.status === 'fulfilled' && r.value) allMappings.push(...r.value);
    }

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
