/**
 * @module hooks/useOktaApi/userOperations
 * @description User management operations
 */

import type { CoreApi } from './core';
import type { OktaFactor, MemberMfaResult, OktaUser } from '../../../shared/types';
import { summarizeFactors } from '../../../shared/utils/mfaUtils';
import { fetchAllPages, OKTA_PAGE_SIZE } from '@/shared/utils/oktaPagination';
import {
  oktaAppListItemSchema,
  extractAppAssignmentScope,
  type OktaAppListItem,
  type AppAssignmentScope,
} from '@/shared/schemas/okta';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useOktaApi');

/** One app assignment as {@link createUserOperations.getUserApps} reports it. */
export interface UserAppAssignment {
  /** Okta app id. */
  id: string;
  /** Display label, falling back to the app name and then the id. */
  label: string;
  /** How the assignment was granted, when Okta reported it. */
  scope?: AppAssignmentScope;
}

/**
 * The outcome of listing a user's apps: the assignments **and** whether the walk
 * that produced them finished.
 *
 * This is an object rather than a bare array on purpose. The walk accumulates
 * page-by-page and a failure part-way through still leaves real rows in hand, so
 * returning just the array makes "Okta returned nothing" and "we never got an
 * answer" the same value — and the caller renders a transport failure as *zero
 * apps*, which is a confident, wrong statement about someone's access. Carrying
 * `complete` alongside the rows makes the difference impossible to drop silently.
 */
export interface UserAppsResult {
  /** Every assignment collected — all of them when `complete`, otherwise a prefix. */
  apps: UserAppAssignment[];
  /**
   * `true` when the pagination walk ran to the end. `false` means the list is
   * short by an unknown amount: treat any count, percentage or "missing app"
   * conclusion drawn from it as unavailable, not as zero.
   */
  complete: boolean;
}

/**
 * Build per-user read and lifecycle operations.
 *
 * @param coreApi - Shared transport surface (see {@link CoreApi}).
 * @returns Lookups (last login, app/group counts, apps, MFA, search, by-id) plus
 * lifecycle actions (suspend/unsuspend/reset password).
 */
export function createUserOperations(coreApi: CoreApi) {
  /**
   * Read a user's last-login timestamp.
   *
   * @param userId - User to inspect.
   * @returns The `lastLogin` as a `Date`, or `null` if never logged in / on error.
   */
  const getUserLastLogin = async (userId: string): Promise<Date | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/users/${userId}`);
      if (response.success && response.data?.lastLogin) {
        return new Date(response.data.lastLogin);
      }
      return null;
    } catch (error) {
      log.error(`Failed to get last login for user ${userId}:`, error);
      return null;
    }
  };

  /**
   * Approximate how many apps a user is assigned, from the first page.
   *
   * @param userId - User to inspect.
   * @returns First-page assignment count (max 200), or `0` on error.
   * @remarks Does not walk pagination; a floor for users with >200 assignments.
   */
  const getUserAppAssignments = async (userId: string): Promise<number> => {
    try {
      // Fetch first page with the standard page size to get app assignments count
      const response = await coreApi.makeApiRequest(
        `/api/v1/apps?filter=user.id+eq+"${userId}"&limit=${OKTA_PAGE_SIZE}`,
      );
      if (response.success && response.data) {
        const firstPageCount = response.data.length;

        // Check if there are more pages by looking for Link header with rel="next"
        const linkHeader = response.headers?.['link'] || response.headers?.['Link'];
        const hasMorePages = linkHeader && linkHeader.includes('rel="next"');

        if (hasMorePages) {
          return firstPageCount;
        }

        return firstPageCount;
      }
      return 0;
    } catch (error) {
      log.error(`Failed to get app assignments for user ${userId}:`, error);
      return 0;
    }
  };

  /**
   * List all apps assigned to a user (id + display label + assignment scope).
   *
   * @param userId - User whose apps to list.
   * @returns A {@link UserAppsResult}: the assignments collected across all pages,
   * plus `complete` saying whether the walk finished. A failed or part-way-failed
   * walk resolves with `complete: false` and whatever was collected — it never
   * rejects, and it never reports a failure as an empty list. Each entry carries
   * an optional {@link AppAssignmentScope}: `'USER'` when the user **has a direct
   * assignment** to the app, `'GROUP'` when the assignment comes from a group, and
   * `undefined` when Okta did not report one. Okta reports a single scope per
   * app-user and prefers `'USER'` when both paths exist, so `'USER'` must never be
   * rendered as "direct only".
   * @remarks Reflects effective assignments (direct + via group) from the apps
   * filter endpoint, following `Link` pagination (200 per page).
   *
   * The scope costs **no extra requests**: `expand=user/{userId}` asks this same
   * list endpoint (not `appLinks`, which does not support `expand`) to embed the
   * app-user object under `_embedded.user` on each row, so the walk is byte-for-byte
   * the same number of calls it was without it. A missing or malformed embed leaves
   * `scope` undefined and never drops the app (ADR-0006).
   *
   * Pages 2+ are re-issued from Okta's own `rel="next"` cursor, so they carry the
   * embed only if Okta echoes `expand` back on that link (it does for `expand=stats`
   * on `/api/v1/groups` — see `groupDiscovery.test.ts`). If it ever stops, the only
   * consequence is `scope: undefined` past page 1 — apps are never lost — so this
   * deliberately does not rewrite the cursor URL.
   */
  const getUserApps = async (userId: string): Promise<UserAppsResult> => {
    const apps: UserAppAssignment[] = [];

    try {
      // Accumulate via onPage so a mid-walk failure still returns the pages
      // collected so far (fetchAllPages throws on a failed page).
      await fetchAllPages<OktaAppListItem>(
        (url) => coreApi.makeApiRequest(url),
        `/api/v1/apps?filter=user.id+eq+"${userId}"&limit=${OKTA_PAGE_SIZE}&expand=user/${userId}`,
        {
          // Validated at the response boundary (ADR-0006): malformed rows are
          // dropped leniently by parseOktaList, never thrown on.
          schema: oktaAppListItemSchema,
          onPage: (page) => {
            for (const app of page) {
              apps.push({
                id: app.id,
                label: app.label || app.name || app.id,
                // Read defensively off the untyped `_embedded`: any shape that is
                // not a recognizable app-user yields undefined, so the app is still
                // listed with its scope simply unknown.
                scope: extractAppAssignmentScope(app._embedded),
              });
            }
          },
        },
      );
    } catch (error) {
      log.error(`Failed to list apps for user ${userId}:`, error);
      return { apps, complete: false };
    }

    return { apps, complete: true };
  };

  /**
   * Fetch full details for many users, keyed by id.
   *
   * @param userIds - Users to load.
   * @param onProgress - Called with `(processed, total)` every third settled user
   * and at completion — the cadence of the old batch-of-3 implementation.
   * @returns Map of userId → {@link OktaUser}; ids that fail to load are omitted.
   * @remarks Runs through {@link CoreApi.runOperation} (ADR-0009): each `GET` is
   * a `low`-priority scheduler request so it never starves interactive work, with
   * a live activity view and cancellation (a cancel returns the partial map).
   * A per-user fetch failure is logged and its id omitted, never thrown.
   */
  const batchGetUserDetails = async (
    userIds: string[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<Map<string, OktaUser>> => {
    const userDetailsMap = new Map<string, OktaUser>();
    const total = userIds.length;
    // Report cadence preserved from the old lockstep batches of 3.
    const reportInterval = 3;
    let processed = 0;

    await coreApi.runOperation(
      'Load user details',
      userIds,
      async (userId) => {
        try {
          const response = await coreApi.makeApiRequest(
            `/api/v1/users/${userId}`,
            'GET',
            undefined,
            'low',
          );
          if (response.success && response.data) {
            userDetailsMap.set(userId, response.data);
          }
        } catch (error) {
          log.error(`Failed to fetch user ${userId}:`, error);
        } finally {
          processed += 1;
          if (processed % reportInterval === 0 || processed === total) {
            onProgress?.(processed, total);
          }
        }
      },
      { message: (p) => `Loading user details (${p.completed}/${p.total})` },
    );

    return userDetailsMap;
  };

  /**
   * Scan MFA factor enrollment for a list of users.
   *
   * @param userIds - Users to scan.
   * @param onProgress - Called after each batch with `(processed, total)`.
   * @returns Map of userId → {@link MemberMfaResult} (summarized via {@link summarizeFactors}).
   * @remarks Costs one API call per user (`GET /api/v1/users/{id}/factors`). Runs
   * through the shared operation runner at `low` priority (like
   * `batchGetUserDetails`) to avoid starving interactive requests.
   */
  const scanGroupMfa = async (
    userIds: string[],
    _onProgress?: (current: number, total: number) => void,
  ): Promise<Map<string, MemberMfaResult>> => {
    const resultMap = new Map<string, MemberMfaResult>();

    // Scan through the shared operation runner: rate-limit-safe (each factor GET is
    // a `low`-priority scheduler request so it never starves interactive work), with
    // a live done/active view and cancellation. A per-user fetch failure summarizes
    // as "no factors" rather than aborting the scan.
    await coreApi.runOperation(
      'MFA scan',
      userIds,
      async (userId) => {
        try {
          const response = await coreApi.makeApiRequest(
            `/api/v1/users/${userId}/factors`,
            'GET',
            undefined,
            'low',
          );
          const factors: OktaFactor[] =
            response.success && Array.isArray(response.data) ? response.data : [];
          resultMap.set(userId, summarizeFactors(userId, factors));
        } catch (error) {
          log.error(`Failed to fetch factors for user ${userId}:`, error);
          resultMap.set(userId, summarizeFactors(userId, []));
        }
      },
      { message: (p) => `Scanned ${p.completed}/${p.total} members` },
    );

    return resultMap;
  };

  /**
   * Count a user's group memberships.
   *
   * @param userId - User to inspect.
   * @returns Exact membership count, read from the `x-total-count` header of a
   * `limit=1` request (avoids paging the full list); `0` on error.
   */
  const getUserGroupMemberships = async (userId: string): Promise<number> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/users/${userId}/groups?limit=1`);
      if (response.success && response.headers?.['x-total-count']) {
        return parseInt(response.headers['x-total-count'], 10);
      }
      return 0;
    } catch (error) {
      log.error(`Failed to get group memberships for user ${userId}:`, error);
      return 0;
    }
  };

  /**
   * Search users by name, email, or login via Okta's `q` query (capped at 20).
   *
   * @param query - Search text; queries shorter than 2 chars short-circuit to `[]`.
   * @returns Flattened `{ id, email, firstName, lastName, login, status }` records; `[]` on error.
   */
  const searchUsers = async (
    query: string,
  ): Promise<
    Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      login: string;
      status: string;
    }>
  > => {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // Use Okta's search API with the q parameter for flexible search
      const response = await coreApi.makeApiRequest(
        `/api/v1/users?q=${encodeURIComponent(query)}&limit=20`,
      );

      if (response.success && response.data) {
        return response.data.map((user: OktaUser) => ({
          id: user.id,
          email: user.profile?.email || '',
          firstName: user.profile?.firstName || '',
          lastName: user.profile?.lastName || '',
          login: user.profile?.login || '',
          status: user.status || 'UNKNOWN',
        }));
      }
      return [];
    } catch (error) {
      log.error('searchUsers error:', error);
      return [];
    }
  };

  /**
   * Fetch one user by id.
   *
   * @param userId - User id to look up.
   * @returns A flattened `{ id, email, firstName, lastName, login, status }`
   * record, or `null` if not found / on error.
   */
  const getUserById = async (
    userId: string,
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    login: string;
    status: string;
  } | null> => {
    try {
      const response = await coreApi.makeApiRequest(`/api/v1/users/${userId}`);
      if (response.success && response.data) {
        const user = response.data;
        return {
          id: user.id,
          email: user.profile?.email || '',
          firstName: user.profile?.firstName || '',
          lastName: user.profile?.lastName || '',
          login: user.profile?.login || '',
          status: user.status || 'UNKNOWN',
        };
      }
      return null;
    } catch (error) {
      log.error('getUserById error:', error);
      return null;
    }
  };

  /**
   * Suspend an active user, preventing them from signing in.
   *
   * @param userId - User to suspend.
   * @returns `{ success, error? }`.
   * @remarks Only valid for users in `ACTIVE` status.
   */
  const suspendUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await coreApi.makeApiRequest(
      `/api/v1/users/${userId}/lifecycle/suspend`,
      'POST',
    );
    return { success: result.success, error: result.error };
  };

  /**
   * Unsuspend a suspended user, restoring their ability to sign in.
   *
   * @param userId - User to unsuspend.
   * @returns `{ success, error? }`.
   * @remarks Only valid for users in `SUSPENDED` status.
   */
  const unsuspendUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await coreApi.makeApiRequest(
      `/api/v1/users/${userId}/lifecycle/unsuspend`,
      'POST',
    );
    return { success: result.success, error: result.error };
  };

  /**
   * Trigger a password-reset email for the user.
   *
   * @param userId - User to send the reset link to.
   * @returns `{ success, error? }`.
   * @remarks Sends an email with a one-time reset link (`sendEmail=true`). Valid
   * for `ACTIVE` and `RECOVERY` status users.
   */
  const resetPassword = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await coreApi.makeApiRequest(
      `/api/v1/users/${userId}/lifecycle/reset_password?sendEmail=true`,
      'POST',
    );
    return { success: result.success, error: result.error };
  };

  return {
    getUserLastLogin,
    getUserAppAssignments,
    getUserApps,
    batchGetUserDetails,
    scanGroupMfa,
    getUserGroupMemberships,
    searchUsers,
    getUserById,
    suspendUser,
    unsuspendUser,
    resetPassword,
  };
}
