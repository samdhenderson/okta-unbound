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
 */

import type { OktaGroup } from '../../shared/types';
import type { CoreApi } from './useOktaApi/core';
import { parseNextLink } from './useOktaApi/utilities';
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
      const response = await makeApiRequest(nextUrl);

      if (!response.success) {
        return response;
      }

      allGroups = allGroups.concat(response.data || []);
      nextUrl = parseNextLink(response.headers?.link);
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
