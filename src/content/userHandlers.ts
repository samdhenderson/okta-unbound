/**
 * @module content/userHandlers
 * @description User-oriented message handlers for the content script.
 *
 * Covers resolving the current user's info (API-first with page-scrape fallback),
 * multi-strategy user search, paginated group-membership retrieval, managed-by-rule
 * context lookup via the admin console endpoint, and raw user-detail fetches. Every
 * network call routes through the same-origin fetch primitive; user records are
 * zod-validated at the boundary where applicable.
 *
 * @see `content/apiRequest` for the transport primitive.
 * @see `content/index` for message routing.
 */

import type { MessageResponse, OktaUser, UserInfo, UserStatus } from '../shared/types';
import { createLogger } from '../shared/utils/logger';
import {
  oktaUserSchema,
  oktaUserListItemSchema,
  oktaGroupListItemSchema,
  parseOkta,
  parseOktaList,
  type OktaGroupListItem,
} from '../shared/schemas/okta';
import { extractUserIdFromUrl, extractUserNameFromPage } from './pageContext';
import { handleMakeApiRequest } from './apiRequest';

const log = createLogger('Content');

/**
 * Resolve the current page's user ID, display name, email, and status.
 *
 * Prefers zod-validated API data, falling back to page scraping for the name.
 *
 * @returns A response carrying {@link UserInfo}, or an error when not on a user page.
 */
export async function handleGetUserInfo(): Promise<MessageResponse<UserInfo>> {
  log.debug('Processing getUserInfo request');

  try {
    const url = window.location.href;
    log.debug('Current page location', { path: window.location.pathname });

    const userId = extractUserIdFromUrl(url);
    log.debug('Extracted userId', { userId });

    if (!userId) {
      return {
        success: false,
        error: 'Not on a user page. Please navigate to a specific user page.',
      };
    }

    let userName: string | undefined;
    let userEmail: string | undefined;
    let userStatus: UserStatus | undefined;

    // Fetch user details from API (prioritize API over page scraping)
    log.debug('Fetching user details from API');
    try {
      const response = await handleMakeApiRequest(`/api/v1/users/${userId}`, 'GET');
      if (response.success) {
        const user = parseOkta(oktaUserSchema, response.data, 'GET /api/v1/users/{id}');
        const profile = user.profile;
        // Use API data for the full name (firstName + lastName)
        userName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
        userEmail = profile.email;
        userStatus = user.status;
        log.debug('Fetched user details from API', {
          hasName: Boolean(userName),
          hasEmail: Boolean(userEmail),
          userStatus,
        });
      }
    } catch (e) {
      log.warn('Failed to fetch user details from API', e);
    }

    // Fallback to page scraping if API didn't provide a name
    if (!userName) {
      userName = extractUserNameFromPage() || undefined;
      log.debug('Extracted userName from page (fallback)', { found: Boolean(userName) });
    }

    const result: UserInfo = {
      userId,
      userName: userName || 'Unknown',
      userEmail,
      userStatus,
    };

    log.debug('getUserInfo result', {
      userId: result.userId,
      hasName: result.userName !== 'Unknown',
      hasEmail: Boolean(result.userEmail),
      userStatus: result.userStatus,
    });
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    log.error('getUserInfo error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Search users, trying `q` (flexible), then `search` (prefix), then an email
 * `filter` when the query looks like an address.
 *
 * @param query - The (untrimmed) search text.
 * @returns A response with the matched users and their `count`.
 */
export async function handleSearchUsers(query: string): Promise<MessageResponse> {
  log.debug('Processing searchUsers request', { queryLength: query.length });

  try {
    // Okta search API supports multiple search methods
    const trimmedQuery = query.trim();

    // Try multiple search strategies
    let users: OktaUser[] = [];

    // Strategy 1: Use 'q' parameter for flexible search (searches across multiple fields)
    // This is more flexible than 'search' and works better for partial matches
    const qParam = encodeURIComponent(trimmedQuery);
    const qSearchUrl = `/api/v1/users?q=${qParam}&limit=20`;

    log.debug('Searching users with q parameter');
    let response = await handleMakeApiRequest(qSearchUrl, 'GET');

    if (response.success && response.data && response.data.length > 0) {
      users = parseOktaList(oktaUserListItemSchema, response.data, 'GET /api/v1/users?q');
      log.debug('Found users with q search', { count: users.length });
    } else {
      // Strategy 2: If 'q' doesn't work, try 'search' parameter (prefix search)
      const searchParam = encodeURIComponent(trimmedQuery);
      const searchUrl = `/api/v1/users?search=${searchParam}&limit=20`;

      log.debug('Trying search parameter');
      response = await handleMakeApiRequest(searchUrl, 'GET');

      if (response.success && response.data) {
        users = parseOktaList(oktaUserListItemSchema, response.data, 'GET /api/v1/users?search');
        log.debug('Found users with search parameter', { count: users.length });
      }
    }

    // If still no results and query looks like an email, try filter
    if (users.length === 0 && trimmedQuery.includes('@')) {
      const filterUrl = `/api/v1/users?filter=profile.email eq "${trimmedQuery}"&limit=20`;
      log.debug('Trying email filter');
      response = await handleMakeApiRequest(filterUrl, 'GET');

      if (response.success && response.data) {
        users = parseOktaList(oktaUserListItemSchema, response.data, 'GET /api/v1/users?filter');
        log.debug('Found users with email filter', { count: users.length });
      }
    }

    return {
      success: true,
      data: users,
      count: users.length,
    };
  } catch (error) {
    log.error('searchUsers error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search users',
    };
  }
}

/**
 * Fetch all groups a user belongs to (unbounded pagination) and map them into the
 * `GroupMembership` shape.
 *
 * `addedDate` is intentionally `undefined`: the Okta API does not expose membership
 * timestamps (see OKTA_API_LIMITATIONS.md §1).
 *
 * @param userId - The user whose group memberships to fetch.
 * @returns A response with the memberships and their `count`.
 */
export async function handleGetUserGroups(userId: string): Promise<MessageResponse> {
  log.debug('Processing getUserGroups request', { userId });

  try {
    let allGroups: OktaGroupListItem[] = [];
    let nextUrl: string | null = `/api/v1/users/${userId}/groups?limit=200`;

    // Fetch all groups with pagination
    while (nextUrl) {
      const response = await handleMakeApiRequest(nextUrl, 'GET');

      if (!response.success) {
        return response;
      }

      allGroups = allGroups.concat(
        parseOktaList(oktaGroupListItemSchema, response.data, 'GET /api/v1/users/{id}/groups'),
      );

      // Parse next link from headers
      nextUrl = null;
      if (response.headers?.link) {
        const links = response.headers.link.split(',');
        for (const link of links) {
          if (link.includes('rel="next"')) {
            const match = link.match(/<([^>]+)>/);
            if (match) {
              const fullUrl = new URL(match[1]);
              nextUrl = fullUrl.pathname + fullUrl.search;
              break;
            }
          }
        }
      }
    }

    // Transform to GroupMembership format
    // Note: addedDate is undefined because Okta API does not provide membership timestamps.
    // group.lastUpdated is when the GROUP was modified, not when the user was added.
    // See OKTA_API_LIMITATIONS.md §1 for details.
    const memberships = allGroups.map((group) => ({
      group: group,
      membershipType: 'UNKNOWN', // We don't know the source from this endpoint
      addedDate: undefined, // Not available from Okta API
    }));

    return {
      success: true,
      data: memberships,
      count: memberships.length,
    };
  } catch (error) {
    log.error('getUserGroups error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user groups',
    };
  }
}

/**
 * Look up which group rules manage a user via the admin console search endpoint,
 * normalizing the `managedBy.rules` column (array / string / object) into a string
 * list.
 *
 * @param userId - The user whose managed-by-rule context to fetch.
 * @returns A response with `{ userId, managedByRules }`, or an error.
 */
export async function handleGetUserContext(userId: string): Promise<MessageResponse> {
  log.debug('Processing getUserContext request', { userId });

  try {
    // Use the internal admin console API endpoint that includes managedBy.rules data
    // This provides authoritative data on which rules manage the user
    // We explicitly request the managedBy.rules column
    const endpoint = `/admin/users/search?iDisplayLength=1&sColumns=user.id%2CmanagedBy.rules&sSearch=${userId}`;

    const response = await handleMakeApiRequest(endpoint, 'GET');

    if (!response.success) {
      return {
        success: false,
        error: response.error,
      };
    }

    const responseData = response.data;
    // Check for valid response structure (AAData with at least one row)
    if (!responseData?.aaData?.[0]) {
      return {
        success: false,
        error: 'User context not found or invalid response',
      };
    }

    const userData = responseData.aaData[0];
    const managedByRulesRaw = userData[1]; // Index 1 because sColumns="user.id,managedBy.rules"

    // Normalize managedBy rules
    let rules: string[] = [];
    if (managedByRulesRaw) {
      if (Array.isArray(managedByRulesRaw)) {
        rules = managedByRulesRaw;
      } else if (typeof managedByRulesRaw === 'string' && managedByRulesRaw.trim()) {
        rules = [managedByRulesRaw];
      } else if (
        typeof managedByRulesRaw === 'object' &&
        (managedByRulesRaw.id || managedByRulesRaw.ruleId)
      ) {
        rules = [managedByRulesRaw.id || managedByRulesRaw.ruleId];
      }
    }

    return {
      success: true,
      data: {
        userId: userData[0],
        managedByRules: rules,
      },
    };
  } catch (error) {
    log.error('getUserContext error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user context',
    };
  }
}

/**
 * Fetch a user's raw detail record by ID.
 *
 * @param userId - The user to fetch.
 * @returns A response with the raw user data, or the underlying error.
 */
export async function handleGetUserDetails(userId: string): Promise<MessageResponse> {
  log.debug('Processing getUserDetails request', { userId });

  try {
    const response = await handleMakeApiRequest(`/api/v1/users/${userId}`, 'GET');

    if (!response.success) {
      return response;
    }

    // Single-entity read: validate strictly (mirrors handleGetUserInfo). A shape
    // mismatch throws and is caught below as a clean error, not a mystery crash.
    const user = parseOkta(oktaUserSchema, response.data, 'GET /api/v1/users/{id}');

    log.debug('Retrieved user details');

    return {
      success: true,
      data: user,
    };
  } catch (error) {
    log.error('getUserDetails error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user details',
    };
  }
}
