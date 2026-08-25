/**
 * @module hooks/useOktaApi/appOperations
 * @description App-scoped read operations: type-ahead app search, the full app
 * inventory, single-app lookup, assignment counts, and the app's assigned-group
 * list (the fallback for naming an app's granting group).
 *
 * Powers the Export tab's search-to-select for app-scoped exports (App Users /
 * App Groups) and the Applications tab's inventory. Like every read here,
 * requests go through the scheduler path and responses are zod-validated at the
 * boundary. There are no write operations in this module.
 */

import type { CoreApi } from './core';
import { oktaAppListItemSchema, type OktaAppListItem } from '@/shared/schemas/okta';
import {
  oktaAppUserSchema,
  oktaAppGroupSchema,
  oktaAppGroupAssignmentSchema,
} from '@/shared/schemas/okta';
import { parseOkta, parseOktaList } from '@/shared/schemas/okta';
import { fetchAllPages, OKTA_PAGE_SIZE } from '@/shared/utils/oktaPagination';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('useOktaApi');

/** Assignment totals for one app, as returned by `getAppAssignmentCounts`. */
export interface AppAssignmentCounts {
  /** Number of directly- and group-assigned users on the app. */
  users: number;
  /** Number of groups assigned to the app. */
  groups: number;
}

/** A lightweight app summary for pickers. */
export interface AppSummary {
  /** Okta app instance id. */
  id: string;
  /** Display label (falls back to the app name/key, then the id). */
  label: string;
  /** Lifecycle status (e.g. `ACTIVE`), when present. */
  status?: string;
}

/**
 * Build app-scoped operations bound to a {@link CoreApi} transport.
 *
 * @param coreApi - Shared transport surface.
 * @returns `{ searchApps, getAppById, getAppAssignmentCounts,
 * getAppGroupAssignments }`.
 */
export function createAppOperations(coreApi: CoreApi) {
  /**
   * Type-ahead search over apps by name/label (`q=` prefix match).
   *
   * @param query - The search text; queries shorter than 2 chars return `[]`.
   * @returns Up to 20 matching app summaries; `[]` on error (never throws).
   */
  const searchApps = async (query: string): Promise<AppSummary[]> => {
    if (!query || query.length < 2) return [];
    try {
      const response = await coreApi.makeApiRequest(
        `/api/v1/apps?q=${encodeURIComponent(query)}&limit=20`,
        { reason: 'Search apps by name' },
      );
      if (!response.success) return [];
      const apps = parseOktaList(oktaAppListItemSchema, response.data, 'GET /api/v1/apps?q');
      return apps.map((app) => ({
        id: app.id,
        label: app.label || app.name || app.id,
        status: app.status,
      }));
    } catch {
      // Redacted: the query text may carry identifying data — log the outcome only.
      log.error('searchApps failed', { code: 'search_failed' });
      return [];
    }
  };

  /**
   * Fetch one app by id.
   *
   * @param appId - App instance id to look up.
   * @returns The validated app, or `null` when the request fails or the response
   * fails validation. Never throws.
   * @remarks Follows the `getRawGroupRule` precedent for single-entity reads:
   * strict {@link parseOkta} against the same lenient list-item schema, with a
   * validation failure degrading to `null` and logging the outcome only.
   */
  const getAppById = async (appId: string): Promise<OktaAppListItem | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/apps/${encodeURIComponent(appId)}`, {
        reason: 'Load app details',
      });
      if (!response.success || !response.data) return null;
      return parseOkta(oktaAppListItemSchema, response.data, 'GET /api/v1/apps/{id}');
    } catch {
      // Identifier + outcome only — never the response body.
      log.error('getAppById failed', { code: 'get_app_failed', appId });
      return null;
    }
  };

  /**
   * Count the users and groups assigned to an app.
   *
   * @param appId - App to size.
   * @returns `{ users, groups }` across all pages, or `null` if either walk fails.
   * Never throws.
   * @remarks Both collections are walked in full at `low` priority so this bulk
   * read yields to interactive work (the `getAppPushGroupMappings` precedent).
   * Counts reflect *validated* rows: malformed rows are dropped at the boundary
   * (ADR-0006), so a corrupt row is excluded rather than counted blindly. A large
   * app costs one request per 200 assignments, so call it lazily.
   */
  const getAppAssignmentCounts = async (appId: string): Promise<AppAssignmentCounts | null> => {
    const encodedId = encodeURIComponent(appId);
    try {
      const [users, groups] = await Promise.all([
        fetchAllPages(
          (url) =>
            coreApi.makeApiRequest(url, {
              method: 'GET',
              priority: 'low',
              reason: 'Count app assignments',
            }),
          `/api/v1/apps/${encodedId}/users?limit=${OKTA_PAGE_SIZE}`,
          { schema: oktaAppUserSchema, context: 'GET /api/v1/apps/{id}/users' },
        ),
        fetchAllPages(
          (url) =>
            coreApi.makeApiRequest(url, {
              method: 'GET',
              priority: 'low',
              reason: 'Count app assignments',
            }),
          `/api/v1/apps/${encodedId}/groups?limit=${OKTA_PAGE_SIZE}`,
          { schema: oktaAppGroupSchema, context: 'GET /api/v1/apps/{id}/groups' },
        ),
      ]);
      return { users: users.length, groups: groups.length };
    } catch {
      // Identifier + outcome only.
      log.error('getAppAssignmentCounts failed', { code: 'app_assignment_counts_failed', appId });
      return null;
    }
  };

  /**
   * List the ids of every group assigned to an app.
   *
   * **Fallback only.** The primary answer to "which group grants this app?" is
   * already in hand: `userOperations.getUserApps` reads `grantGroupId` off the
   * `expand=user/{userId}` embed for zero additional requests. This operation
   * exists for the rows where that embed was silent, and it answers a strictly
   * weaker question — the groups assigned to the app, not the group that granted
   * it to a particular user. Intersecting it with a user's memberships narrows
   * the candidates; it does not by itself name the grantor.
   *
   * **A caller must gate it behind an explicit, per-row action.** It costs at
   * least one request per app (more for apps with over 200 assigned groups), so
   * firing it across a user's app list is linear in app count — the cost lesson
   * ADR-0031 records for the per-membership proof, and the reason that read is
   * user-initiated rather than automatic.
   *
   * @param appId - App whose group assignments to list.
   * @returns Every assigned group id across all pages, or `null` when the walk
   * failed. Never throws.
   * @remarks `null` and `[]` are deliberately different answers: `[]` is Okta
   * positively reporting **no groups assigned**, `null` is **no answer**.
   * Collapsing them would manufacture a confident "no group grants this" out of
   * a failed request, which is exactly the defect ADR-0020 removed from the
   * attribution paths. Rows are validated with
   * {@link oktaAppGroupAssignmentSchema}, so a malformed row is dropped
   * leniently (ADR-0006) rather than failing the walk. Issued at `low` priority
   * like its neighbour {@link getAppAssignmentCounts}, so a bulk read never
   * starves interactive work. Cache under `cacheKeys.appGroups(appId)`.
   */
  const getAppGroupAssignments = async (appId: string): Promise<string[] | null> => {
    try {
      const groups = await fetchAllPages(
        (url) =>
          coreApi.makeApiRequest(url, {
            method: 'GET',
            priority: 'low',
            reason: 'Load app group assignments',
          }),
        `/api/v1/apps/${encodeURIComponent(appId)}/groups?limit=${OKTA_PAGE_SIZE}`,
        {
          schema: oktaAppGroupAssignmentSchema,
          context: 'GET /api/v1/apps/{id}/groups',
        },
      );
      return groups.map((group) => group.id);
    } catch {
      // Identifier + outcome only — never the response body or a group name.
      log.error('getAppGroupAssignments failed', { code: 'app_group_assignments_failed', appId });
      return null;
    }
  };

  return {
    searchApps,
    getAppById,
    getAppAssignmentCounts,
    getAppGroupAssignments,
  };
}
