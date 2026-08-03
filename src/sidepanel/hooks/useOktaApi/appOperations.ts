/**
 * @module hooks/useOktaApi/appOperations
 * @description App-scoped read operations: type-ahead app search, the full app
 * inventory, single-app lookup, and assignment counts.
 *
 * Powers the Export tab's search-to-select for app-scoped exports (App Users /
 * App Groups) and the Applications tab's inventory. Like every read here,
 * requests go through the scheduler path and responses are zod-validated at the
 * boundary. There are no write operations in this module.
 */

import type { CoreApi } from './core';
import { oktaAppListItemSchema, type OktaAppListItem } from '@/shared/schemas/okta';
import { oktaAppUserSchema, oktaAppGroupSchema } from '@/shared/schemas/okta';
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
 * @returns `{ searchApps, getAllApps, getAppById, getAppAssignmentCounts }`.
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
   * List every app in the org, following `Link` pagination (200 per page).
   *
   * @returns All validated apps across all pages.
   * @throws Error on the first failed page — deliberately mirroring
   * `getAllGroups` (`groupDiscovery`), the precedent for a full-collection read:
   * a truncated inventory silently rendered as complete is worse than a banner,
   * so the caller (a loader hook) decides how to surface it.
   * @remarks Malformed rows are dropped leniently by boundary validation
   * ({@link oktaAppListItemSchema}, ADR-0006) rather than failing the walk.
   */
  const getAllApps = async (): Promise<OktaAppListItem[]> =>
    fetchAllPages<OktaAppListItem>(
      (url) => coreApi.makeApiRequest(url),
      `/api/v1/apps?limit=${OKTA_PAGE_SIZE}`,
      {
        schema: oktaAppListItemSchema,
        context: 'GET /api/v1/apps',
        errorMessage: 'Failed to fetch apps',
      },
    );

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
      const response = await coreApi.makeApiRequest(`/api/v1/apps/${encodeURIComponent(appId)}`);
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
          (url) => coreApi.makeApiRequest(url, 'GET', undefined, 'low'),
          `/api/v1/apps/${encodedId}/users?limit=${OKTA_PAGE_SIZE}`,
          { schema: oktaAppUserSchema, context: 'GET /api/v1/apps/{id}/users' },
        ),
        fetchAllPages(
          (url) => coreApi.makeApiRequest(url, 'GET', undefined, 'low'),
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

  return { searchApps, getAllApps, getAppById, getAppAssignmentCounts };
}
