/**
 * @module sidepanel/hooks/getUserGroupsRequest
 * @description Scheduler-routed fetch of a user's group memberships.
 *
 * §8: reproduces the content script's former `getUserGroups` handler in the side
 * panel, issuing each page through the rate-limited scheduler (`makeApiRequest`)
 * instead of a direct `chrome.tabs.sendMessage`. The unbounded `Link`-header
 * pagination, the `{ group, membershipType: 'UNKNOWN', addedDate: undefined }`
 * membership wrapper, and the `{ success, data, count }` result shape are preserved
 * verbatim from `content/userHandlers.ts` so consumers are unchanged.
 *
 * ## Why every membership here is `UNKNOWN` (ADR-0020)
 *
 * The group path gets Okta's own attribution for free: `GET
 * /api/v1/groups/{id}/users?expand=group-rules` embeds the feeding rules on each
 * member row (`shared/membership/memberRuleAttribution`). **There is no analogous
 * expand on this endpoint** — `/users/{id}/groups` returns plain group objects and
 * says nothing about how the user got into any of them. That asymmetry, not an
 * oversight, is why `useUserMemberships` is heuristic-only and why the two views
 * are reconciled by *labelling* provenance rather than by sharing an answer.
 *
 * This module is the seam where that would change. If Okta ever exposes a
 * per-membership attribution on this endpoint, add it here and have
 * `useUserMemberships` prefer it exactly as `groupSource` prefers the embed —
 * and update `shared/membership/attributionParity.test.ts`, which currently pins
 * the divergence as expected.
 */

import type { OktaGroup } from '../../shared/types';
import type { CoreApi } from './useOktaApi/core';
import { nextPageUrl } from './useOktaApi/utilities';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('getUserGroupsRequest');

/** The scheduler-routed request function (`useOktaApi().makeApiRequest`). */
type MakeApiRequest = CoreApi['makeApiRequest'];

/** One membership record, mirroring the old content-script `getUserGroups` shape. */
export interface UserGroupMembership {
  group: OktaGroup;
  /** Source is unknown from this endpoint; callers re-derive it (see `analyzeMemberships`). */
  membershipType: 'UNKNOWN';
  /** Okta does not expose membership timestamps (OKTA_API_LIMITATIONS.md §1). */
  addedDate: undefined;
}

/** Result of {@link getUserGroupsRequest}, mirroring the old content-script response. */
export interface GetUserGroupsResult {
  success: boolean;
  data?: UserGroupMembership[];
  count?: number;
  error?: string;
}

/**
 * Fetch every group a user belongs to through the scheduler, following `Link`
 * pagination (200 per page) exactly as the content-script handler did, and map each
 * group into the `{ group, membershipType: 'UNKNOWN', addedDate: undefined }`
 * wrapper. `addedDate` is intentionally `undefined` — Okta does not expose
 * membership timestamps.
 *
 * @param makeApiRequest - `useOktaApi().makeApiRequest`, routing via the background scheduler.
 * @param userId - The user whose group memberships to fetch.
 * @returns `{ success: true, data, count }` on success; on a failed page it returns
 *   that page's error response verbatim, and a thrown error becomes
 *   `{ success: false, error }` (matching the former handler).
 */
export async function getUserGroupsRequest(
  makeApiRequest: MakeApiRequest,
  userId: string,
): Promise<GetUserGroupsResult> {
  log.debug('Fetching user groups', { userId });

  try {
    let allGroups: OktaGroup[] = [];
    let nextUrl: string | null = `/api/v1/users/${userId}/groups?limit=200`;

    // Fetch all groups with pagination.
    while (nextUrl) {
      const response = await makeApiRequest(nextUrl, { reason: "Load user's groups" });

      if (!response.success) {
        return response;
      }

      const page: OktaGroup[] = response.data || [];
      allGroups = allGroups.concat(page);
      nextUrl = nextPageUrl(nextUrl, response.headers?.link, page.length);
    }

    // Transform to the membership wrapper. Source is unknown from this endpoint;
    // addedDate is unavailable from the Okta API (OKTA_API_LIMITATIONS.md §1).
    const memberships: UserGroupMembership[] = allGroups.map((group) => ({
      group,
      membershipType: 'UNKNOWN',
      addedDate: undefined,
    }));

    return { success: true, data: memberships, count: memberships.length };
  } catch (error) {
    log.error('getUserGroups error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user groups',
    };
  }
}
