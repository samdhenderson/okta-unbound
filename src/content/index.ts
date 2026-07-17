/**
 * @module content/index
 * @description Content script injected into Okta web pages to facilitate API communication.
 *
 * This content script serves as the bridge between the extension's sidepanel and Okta's web application.
 * It runs in the context of Okta pages and has access to the authenticated session, XSRF tokens,
 * and cookies required to make API calls.
 *
 * **Architecture:**
 * ```
 * Sidepanel → Background Worker → Content Script → Okta API
 *                                      ↑
 *                              (Has auth context)
 * ```
 *
 * **Key Responsibilities:**
 * - Extract page context (group IDs, user IDs, group names)
 * - Make authenticated API requests using the page's session
 * - Handle XSRF token extraction and inclusion
 * - Parse pagination headers from API responses
 * - Cache frequently accessed data (group names, etc.)
 * - Export data to CSV/JSON formats
 * - Display visual indicators when active
 *
 * **Supported Operations:**
 * - Group management (fetch members, get info, export)
 * - User management (search, get details, get groups)
 * - Rules management (fetch, activate, deactivate)
 * - Generic API requests (GET, POST, PUT, DELETE)
 *
 * **Security:**
 * - All API calls use the page's existing authentication
 * - XSRF tokens are automatically extracted and included
 * - Credentials are never stored or transmitted
 * - Only operates on official Okta domains
 *
 * @see `background service worker` for request scheduling
 * @see `useOktaApi` for sidepanel integration
 */

// Content script for Okta Unbound
// Runs on Okta pages and handles API requests with proper session authentication

import type {
  MessageRequest,
  MessageResponse,
  OktaUser,
  OktaGroup,
  GroupInfo,
  UserInfo,
  UserStatus,
} from '../shared/types';
import { createLogger } from '../shared/utils/logger';
import { oktaUserSchema, oktaGroupSchema, parseOkta } from '../shared/schemas/okta';
import {
  extractGroupIdFromUrl,
  extractGroupNameFromPage,
  extractUserIdFromUrl,
  extractUserNameFromPage,
  extractAppIdFromUrl,
  extractAppNameFromPage,
} from './pageContext';
import { handleMakeApiRequest } from './apiRequest';
import { convertToCSV, downloadFile } from './exportHelpers';
import { injectIndicator } from './indicator';
import {
  handleFetchGroupRules,
  handleActivateRule,
  handleDeactivateRule,
} from './ruleHandlers';

const log = createLogger('Content');

log.debug('Content script loaded', {
  readyState: document.readyState,
});

// ============================================================================
// Message Listener
// ============================================================================

chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ) => {
    log.debug('Received message', {
      action: request.action,
      from: sender.id,
    });

    switch (request.action) {
      case 'getGroupInfo':
        handleGetGroupInfo().then(sendResponse);
        return true;

      case 'getUserInfo':
        handleGetUserInfo().then(sendResponse);
        return true;

      case 'getAppInfo':
        handleGetAppInfo().then(sendResponse);
        return true;

      case 'makeApiRequest':
        if (!request.endpoint) {
          sendResponse({ success: false, error: 'Missing endpoint' });
          return true;
        }
        handleMakeApiRequest(request.endpoint, request.method, request.body).then(sendResponse);
        return true;

      case 'exportGroupMembers':
        if (!request.groupId || !request.format) {
          sendResponse({ success: false, error: 'Missing groupId or format' });
          return true;
        }
        handleExportGroupMembers(request).then(sendResponse);
        return true;

      case 'fetchGroupRules':
        handleFetchGroupRules(request.groupId).then(sendResponse);
        return true;

      case 'activateRule':
        if (!request.ruleId) {
          sendResponse({ success: false, error: 'Missing ruleId' });
          return true;
        }
        handleActivateRule(request.ruleId).then(sendResponse);
        return true;

      case 'deactivateRule':
        if (!request.ruleId) {
          sendResponse({ success: false, error: 'Missing ruleId' });
          return true;
        }
        handleDeactivateRule(request.ruleId).then(sendResponse);
        return true;

      case 'searchUsers':
        if (!request.query) {
          sendResponse({ success: false, error: 'Missing query' });
          return true;
        }
        handleSearchUsers(request.query).then(sendResponse);
        return true;

      case 'searchGroups':
        if (!request.query) {
          sendResponse({ success: false, error: 'Missing query' });
          return true;
        }
        handleSearchGroups(request.query).then(sendResponse);
        return true;

      case 'getUserGroups':
        if (!request.userId) {
          sendResponse({ success: false, error: 'Missing userId' });
          return true;
        }
        handleGetUserGroups(request.userId).then(sendResponse);
        return true;

      case 'getUserDetails':
        if (!request.userId) {
          sendResponse({ success: false, error: 'Missing userId' });
          return true;
        }
        handleGetUserDetails(request.userId).then(sendResponse);
        return true;

      case 'getUserContext':
        if (!request.userId) {
          sendResponse({ success: false, error: 'Missing userId' });
          return true;
        }
        handleGetUserContext(request.userId).then(sendResponse);
        return true;

      case 'getOktaOrigin':
        sendResponse({ success: true, data: window.location.origin });
        return true;

      default:
        log.warn('Unknown action', { action: request.action });
        sendResponse({ success: false, error: 'Unknown action' });
        return true;
    }
  },
);

// ============================================================================
// Group Info Handler
// ============================================================================

async function handleGetGroupInfo(): Promise<MessageResponse<GroupInfo>> {
  log.debug('Processing getGroupInfo request');

  try {
    const url = window.location.href;
    log.debug('Current page location', { path: window.location.pathname });

    const groupId = extractGroupIdFromUrl(url);
    log.debug('Extracted groupId', { groupId });

    if (!groupId) {
      return {
        success: false,
        error: 'Not on a group page. Please navigate to a specific group page.',
      };
    }

    let groupName = extractGroupNameFromPage();
    log.debug('Extracted groupName from page', { found: Boolean(groupName) });

    // Fallback: fetch from API if not found in DOM
    if (!groupName) {
      log.debug('Fetching group name from API');
      try {
        const response = await handleMakeApiRequest(`/api/v1/groups/${groupId}`, 'GET');
        if (response.success) {
          const group = parseOkta(oktaGroupSchema, response.data, 'GET /api/v1/groups/{id}');
          groupName = group.profile.name;
          log.debug('Fetched groupName from API', { found: Boolean(groupName) });
        }
      } catch (e) {
        log.warn('Failed to fetch group name from API', e);
      }
    }

    const result: GroupInfo = {
      groupId,
      groupName: groupName || 'Unknown',
    };

    log.debug('getGroupInfo result', {
      groupId: result.groupId,
      hasName: result.groupName !== 'Unknown',
    });
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    log.error('getGroupInfo error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// User Info Handler
// ============================================================================

async function handleGetUserInfo(): Promise<MessageResponse<UserInfo>> {
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

async function handleGetAppInfo(): Promise<MessageResponse<import('../shared/types').AppInfo>> {
  log.debug('Processing getAppInfo request');

  try {
    const url = window.location.href;
    log.debug('Current page location', { path: window.location.pathname });

    const appId = extractAppIdFromUrl(url);
    log.debug('Extracted appId', { appId });

    if (!appId) {
      return {
        success: false,
        error: 'Not on an app page. Please navigate to a specific app page.',
      };
    }

    let appName = extractAppNameFromPage();
    let appLabel: string | undefined;
    log.debug('Extracted appName from page', { found: Boolean(appName) });

    // Fetch app details from API
    log.debug('Fetching app details from API');
    try {
      const response = await handleMakeApiRequest(`/api/v1/apps/${appId}`, 'GET');
      if (response.success && response.data) {
        appName = appName || response.data.name || response.data.label || 'Unknown';
        appLabel = response.data.label;
        log.debug('Fetched app details from API', {
          hasName: Boolean(appName),
          hasLabel: Boolean(appLabel),
        });
      }
    } catch (e) {
      log.warn('Failed to fetch app details from API', e);
    }

    const result = {
      appId,
      appName: appName || 'Unknown',
      appLabel,
    };

    log.debug('getAppInfo result', {
      appId: result.appId,
      hasName: result.appName !== 'Unknown',
      hasLabel: Boolean(result.appLabel),
    });
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    log.error('getAppInfo error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Export Handler (Stub - will implement with proper modules)
// ============================================================================

async function handleExportGroupMembers(request: MessageRequest): Promise<MessageResponse> {
  log.debug('Processing exportGroupMembers request');

  try {
    const { groupId, groupName, format, statusFilter } = request;

    // Fetch all group members
    const members = await fetchAllGroupMembers(groupId!);

    // Filter by status if specified
    let filteredMembers = members;
    if (statusFilter) {
      filteredMembers = members.filter((u: OktaUser) => u.status === statusFilter);
    }

    // Format and download
    const filename = `${groupName}_members_${new Date().toISOString().split('T')[0]}.${format}`;
    let content: string;

    if (format === 'csv') {
      content = convertToCSV(filteredMembers);
    } else {
      content = JSON.stringify(filteredMembers, null, 2);
    }

    downloadFile(filename, content, format === 'csv' ? 'text/csv' : 'application/json');

    return {
      success: true,
      count: filteredMembers.length,
    };
  } catch (error) {
    log.error('exportGroupMembers error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

// ============================================================================
// User Search and Membership Handlers
// ============================================================================

async function handleSearchUsers(query: string): Promise<MessageResponse> {
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
      users = response.data;
      log.debug('Found users with q search', { count: users.length });
    } else {
      // Strategy 2: If 'q' doesn't work, try 'search' parameter (prefix search)
      const searchParam = encodeURIComponent(trimmedQuery);
      const searchUrl = `/api/v1/users?search=${searchParam}&limit=20`;

      log.debug('Trying search parameter');
      response = await handleMakeApiRequest(searchUrl, 'GET');

      if (response.success && response.data) {
        users = response.data;
        log.debug('Found users with search parameter', { count: users.length });
      }
    }

    // If still no results and query looks like an email, try filter
    if (users.length === 0 && trimmedQuery.includes('@')) {
      const filterUrl = `/api/v1/users?filter=profile.email eq "${trimmedQuery}"&limit=20`;
      log.debug('Trying email filter');
      response = await handleMakeApiRequest(filterUrl, 'GET');

      if (response.success && response.data) {
        users = response.data;
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

async function handleSearchGroups(query: string): Promise<MessageResponse> {
  log.debug('Processing searchGroups request', { queryLength: query.length });

  try {
    const trimmedQuery = query.trim();

    // Use 'q' parameter for flexible name-based search (autocomplete scenario)
    // This matches the pattern used by searchUsers and is simple/fast
    const qParam = encodeURIComponent(trimmedQuery);
    const searchUrl = `/api/v1/groups?q=${qParam}&limit=20&expand=stats`;

    log.debug('Searching groups with q parameter');
    const response = await handleMakeApiRequest(searchUrl, 'GET');

    if (response.success && response.data) {
      const groups = response.data;
      log.debug('Found groups', { count: groups.length });

      return {
        success: true,
        data: groups,
        count: groups.length,
      };
    }

    return {
      success: true,
      data: [],
      count: 0,
    };
  } catch (error) {
    log.error('searchGroups error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search groups',
    };
  }
}

async function handleGetUserGroups(userId: string): Promise<MessageResponse> {
  log.debug('Processing getUserGroups request', { userId });

  try {
    let allGroups: OktaGroup[] = [];
    let nextUrl: string | null = `/api/v1/users/${userId}/groups?limit=200`;

    // Fetch all groups with pagination
    while (nextUrl) {
      const response = await handleMakeApiRequest(nextUrl, 'GET');

      if (!response.success) {
        return response;
      }

      allGroups = allGroups.concat(response.data || []);

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
async function handleGetUserContext(userId: string): Promise<MessageResponse> {
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

async function handleGetUserDetails(userId: string): Promise<MessageResponse> {
  log.debug('Processing getUserDetails request', { userId });

  try {
    const response = await handleMakeApiRequest(`/api/v1/users/${userId}`, 'GET');

    if (!response.success) {
      return response;
    }

    log.debug('Retrieved user details');

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    log.error('getUserDetails error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user details',
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

async function fetchAllGroupMembers(groupId: string): Promise<OktaUser[]> {
  let allMembers: OktaUser[] = [];
  let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;

  while (nextUrl) {
    const response = await handleMakeApiRequest(nextUrl, 'GET');

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch group members');
    }

    allMembers = allMembers.concat(response.data || []);

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

  return allMembers;
}

// ============================================================================
// Initialization
// ============================================================================

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    log.debug('DOMContentLoaded fired');
    injectIndicator();
  });
} else {
  log.debug('DOM already loaded, injecting indicator');
  injectIndicator();
}
