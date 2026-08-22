/**
 * @module hooks/useOktaApi/pushGroupOps
 * @description Push group mapping operations for tracking which groups are pushed to external apps
 */

import type { CoreApi } from './core';
import type { PushGroupMapping, GroupSummary } from '../../../shared/types';
import { fetchAllPages, OKTA_PAGE_SIZE } from '@/shared/utils/oktaPagination';
import {
  oktaAppGroupAssignmentSchema,
  oktaAppListItemSchema,
  parseOkta,
  type OktaAppGroupAssignment,
  type OktaAppListItem,
} from '@/shared/schemas/okta';
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
   * Every way a label lookup can fail leaves that app's existing name (its raw
   * id) in place and is logged with identifiers and outcome codes only, never a
   * payload: a thrown request, a resolved `success: false` (how a 401/429
   * surfaces), a body that fails boundary validation, a 200 with neither `label`
   * nor `name`, and — at phase level — apps that never started because the run
   * was cancelled or halted.
   * @remarks Resolves each unique app's label, then fetches its mappings — both
   * phases through {@link CoreApi.runOperation} (ADR-0009) with bounded
   * concurrency at `low` priority, activity-bar visible and cancellable (a
   * cancel enriches with whatever resolved before it). Each label response is
   * validated at the boundary with {@link oktaAppListItemSchema} (ADR-0006), so
   * a non-string `label`/`name` degrades to "not reported" rather than reaching
   * the UI as an app name. Returns `groups` untouched when no `APP_GROUP`
   * sources are present.
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
    const labelOutcome = await coreApi.runOperation(
      'Resolve app names',
      Array.from(appIds.keys()),
      async (appId) => {
        try {
          const response = await coreApi.makeApiRequest(
            `/api/v1/apps/${encodeURIComponent(appId)}`,
            'GET',
            undefined,
            'low',
          );
          if (!response.success || !response.data) {
            // `success: false` is how a scheduler-level 401/429 surfaces: it
            // resolves rather than throwing, so the likeliest systemic failure
            // used to fall straight through the `if` unlogged (D-019). Numeric
            // status only — never `response.error` or the body.
            log.error('App name resolution request failed', {
              code: 'resolve_app_name_request_failed',
              appId,
              status: response.status,
            });
            return;
          }

          // Validated at the response boundary (ADR-0006) with the same schema
          // and context string `getAppById` uses for this endpoint, so the label
          // rendered as an app name can only ever be a string Okta actually sent
          // (D-020). Kept inline rather than delegating to `getAppById` so this
          // bulk read keeps its explicit `low` priority and its three
          // distinguishable failure codes.
          let app: OktaAppListItem;
          try {
            app = parseOkta(oktaAppListItemSchema, response.data, 'GET /api/v1/apps/{id}');
          } catch {
            // A body that fails validation degrades exactly like a failed
            // request — the app keeps its raw id — under its own outcome code so
            // a log reader can still tell it apart from a 401/429. The thrown
            // message is not logged: identifier + code only.
            log.error('App name resolution returned an invalid app', {
              code: 'resolve_app_name_invalid',
              appId,
            });
            return;
          }

          const label = app.label || app.name;
          if (label) {
            appIds.set(appId, label);
          } else {
            // A 200 carrying neither `label` nor `name` degrades exactly like a
            // failure — the app keeps its raw id — so it gets its own line
            // (D-019). The label is end-user-influenced Okta content and is
            // never logged; identifier + outcome code only.
            log.error('App name resolution returned no label', {
              code: 'resolve_app_name_no_label',
              appId,
            });
          }
        } catch (error) {
          // Keep existing name on failure — but never silently: a systemic
          // failure here leaves every app stuck on its raw id (D-003).
          log.error(`Failed to resolve app name for app ${appId}:`, error);
        }
      },
      { message: (p) => `Resolving app names (${p.completed}/${p.total})` },
    );

    // Inspected rather than discarded, matching the mapping phase below. The
    // per-app branches above cover every app whose task actually ran; apps that
    // never started (a cancel, or an error halt) produce no line of their own, so
    // the phase-level counts are the only trace that the run was partial (D-019).
    if (labelOutcome.cancelled || labelOutcome.skipped > 0) {
      log.warn('App name resolution did not complete', {
        code: 'resolve_app_names_incomplete',
        cancelled: labelOutcome.cancelled,
        skipped: labelOutcome.skipped,
        total: labelOutcome.total,
      });
    }

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
