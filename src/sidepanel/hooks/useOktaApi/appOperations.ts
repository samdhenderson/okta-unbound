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
import type { RequestResult } from '@/shared/scheduler/types';
import { oktaAppListItemSchema, type OktaAppListItem } from '@/shared/schemas/okta';
import {
  oktaAppUserSchema,
  oktaAppGroupSchema,
  oktaAppGroupAssignmentSchema,
} from '@/shared/schemas/okta';
import { parseOkta, parseOktaList } from '@/shared/schemas/okta';
import { fetchAllPages, OKTA_PAGE_SIZE } from '@/shared/utils/oktaPagination';
import { isSessionExpired, NO_HTTP_STATUS } from '@/shared/scheduler/requestResult';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('useOktaApi');

/** Okta's answer for "no app with that id in this org". */
const HTTP_NOT_FOUND = 404;

/** Assignment totals for one app, as returned by `getAppAssignmentCounts`. */
export interface AppAssignmentCounts {
  /** Number of directly- and group-assigned users on the app. */
  users: number;
  /** Number of groups assigned to the app. */
  groups: number;
}

/**
 * The outcome of {@link createAppOperations}'s `getAppById`.
 *
 * Four outcomes, not one nullable app. "Okta says there is no such app" and
 * "we could not ask Okta" are different answers with different remedies, and a
 * shared `null` let a rate-limited or unauthenticated lookup render as an
 * authoritative absence (`D-007a`).
 */
export type AppLookup =
  /** Okta returned the app and it validated. */
  | { kind: 'found'; app: OktaAppListItem }
  /** Okta answered 404: this org has no app with that id. Authoritative. */
  | { kind: 'missing' }
  /** HTTP 401 — the admin's Okta session is gone; only re-authenticating fixes it. */
  | { kind: 'session-expired' }
  /**
   * Anything else: rate limited (429), forbidden (403), a server error, an
   * unreadable response, or a transport failure carrying `NO_HTTP_STATUS`.
   * Nothing is known about whether the app exists.
   */
  | { kind: 'failed'; status: number };

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
   * @returns An {@link AppLookup} saying which of the four outcomes happened.
   * Never throws.
   * @remarks Validation follows the `getRawGroupRule` precedent for
   * single-entity reads: strict {@link parseOkta} against the same lenient
   * list-item schema, logging the outcome only.
   *
   * It does **not** follow that precedent's `T | null` return. A single `null`
   * for both "Okta says 404" and "the request never landed" is what let a
   * throttled lookup read as a deleted app — the defect `D-007a` names. A 404 is
   * the only answer that earns `missing`; a 401 is `session-expired` (via the
   * shared {@link isSessionExpired} predicate, so 403 and 429 are not mistaken
   * for it); everything else, including a response that failed validation, is
   * `failed` with the status that caused it.
   */
  const getAppById = async (appId: string): Promise<AppLookup> => {
    let response: RequestResult;
    try {
      response = await coreApi.makeApiRequest(`/api/v1/apps/${encodeURIComponent(appId)}`, {
        reason: 'Load app details',
      });
    } catch {
      // Identifier + outcome only — never the response body.
      log.error('getAppById transport failed', { code: 'get_app_failed', appId });
      return { kind: 'failed', status: NO_HTTP_STATUS };
    }

    if (!response.success) {
      if (response.status === HTTP_NOT_FOUND) return { kind: 'missing' };
      if (isSessionExpired(response)) return { kind: 'session-expired' };
      log.error('getAppById failed', {
        code: 'get_app_failed',
        appId,
        status: response.status,
      });
      return { kind: 'failed', status: response.status };
    }

    // A 2xx with nothing readable in it is not an absence — it is an answer we
    // could not use. Report the status that carried it rather than inventing a
    // 404 Okta never sent.
    const status = response.status ?? NO_HTTP_STATUS;
    if (!response.data) return { kind: 'failed', status };
    try {
      return {
        kind: 'found',
        app: parseOkta(oktaAppListItemSchema, response.data, 'GET /api/v1/apps/{id}'),
      };
    } catch {
      log.error('getAppById validation failed', { code: 'get_app_invalid', appId });
      return { kind: 'failed', status };
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
