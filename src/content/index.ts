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
 * @see {@link module:background/index|Background Worker} for request scheduling
 * @see {@link module:hooks/useOktaApi|useOktaApi} for sidepanel integration
 */

// Content script for Okta Unbound
// Runs on Okta pages and handles API requests with proper session authentication

import type { MessageRequest, MessageResponse, OktaUser, GroupInfo, UserInfo, ApiResponse } from '../shared/types';
import { getCacheEntry, setCacheEntry } from '../shared/cache';

console.log('[Content] Content script loaded', {
  url: window.location.href,
  readyState: document.readyState,
  timestamp: new Date().toISOString(),
});

// ============================================================================
// Message Listener
// ============================================================================

chrome.runtime.onMessage.addListener(
  (request: MessageRequest, sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    console.log('[Content] Received message:', {
      action: request.action,
      from: sender.id,
      timestamp: new Date().toISOString(),
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
        console.warn('[Content] Unknown action:', (request as any).action);
        sendResponse({ success: false, error: 'Unknown action' });
        return true;
    }
  }
);

// ============================================================================
// API Request Handler
// ============================================================================

async function handleMakeApiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<ApiResponse> {
  console.log('[Content] makeApiRequest called:', { endpoint, method, hasBody: !!body });

  try {
    const url = window.location.origin + endpoint;

    // Extract XSRF token from the page
    const xsrfToken = getXsrfToken();
    console.log('[Content] XSRF token check:', {
      tokenLength: xsrfToken.length,
      tokenPreview: xsrfToken ? xsrfToken.substring(0, 20) + '...' : 'none',
    });

    const options: RequestInit = {
      method,
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'X-Requested-With': 'XMLHttpRequest',
        ...(xsrfToken && { 'X-Okta-Xsrftoken': xsrfToken }),
      },
      credentials: 'include',
      cache: 'no-store',
      mode: 'cors',
      redirect: 'follow',
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    console.log('[Content] About to call fetch() - check Network tab');
    const response = await fetch(url, options);
    console.log('[Content] fetch() completed');

    console.log('[Content] Okta API response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    // Parse response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Handle DELETE requests (empty response)
    if (method === 'DELETE' && response.ok) {
      return {
        success: true,
        data: null,
        headers,
        status: response.status,
      };
    }

    // Try to parse JSON
    let data: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        console.warn('[Content] Failed to parse JSON response');
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: data?.errorSummary || data?.message || `Request failed with status ${response.status}`,
        status: response.status,
        data,
      };
    }

    return {
      success: true,
      data,
      headers,
      status: response.status,
    };
  } catch (error) {
    console.error('[Content] makeApiRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Group Info Handler
// ============================================================================

async function handleGetGroupInfo(): Promise<MessageResponse<GroupInfo>> {
  console.log('[Content] Processing getGroupInfo request');

  try {
    const url = window.location.href;
    console.log('[Content] Current URL:', url);

    const groupId = extractGroupIdFromUrl(url);
    console.log('[Content] Extracted groupId:', groupId);

    if (!groupId) {
      return {
        success: false,
        error: 'Not on a group page. Please navigate to a specific group page.',
      };
    }

    let groupName = extractGroupNameFromPage();
    console.log('[Content] Extracted groupName from page:', groupName);

    // Fallback: fetch from API if not found in DOM
    if (!groupName) {
      console.log('[Content] Fetching group name from API...');
      try {
        const response = await handleMakeApiRequest(`/api/v1/groups/${groupId}`, 'GET');
        if (response.success && response.data?.profile?.name) {
          groupName = response.data.profile.name;
          console.log('[Content] Fetched groupName from API:', groupName);
        }
      } catch (e) {
        console.warn('[Content] Failed to fetch group name from API:', e);
      }
    }

    const result: GroupInfo = {
      groupId,
      groupName: groupName || 'Unknown',
    };

    console.log('[Content] getGroupInfo result:', result);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[Content] getGroupInfo error:', error);
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
  console.log('[Content] Processing getUserInfo request');

  try {
    const url = window.location.href;
    console.log('[Content] Current URL:', url);

    const userId = extractUserIdFromUrl(url);
    console.log('[Content] Extracted userId:', userId);

    if (!userId) {
      return {
        success: false,
        error: 'Not on a user page. Please navigate to a specific user page.',
      };
    }

    let userName: string | undefined;
    let userEmail: string | undefined;
    let userStatus: string | undefined;

    // Fetch user details from API (prioritize API over page scraping)
    console.log('[Content] Fetching user details from API...');
    try {
      const response = await handleMakeApiRequest(`/api/v1/users/${userId}`, 'GET');
      if (response.success && response.data) {
        const profile = response.data.profile || {};
        // Use API data for the full name (firstName + lastName)
        userName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
        userEmail = profile.email;
        userStatus = response.data.status;
        console.log('[Content] Fetched user details from API:', { userName, userEmail, userStatus });
      }
    } catch (e) {
      console.warn('[Content] Failed to fetch user details from API:', e);
    }

    // Fallback to page scraping if API didn't provide a name
    if (!userName) {
      userName = extractUserNameFromPage() || undefined;
      console.log('[Content] Extracted userName from page (fallback):', userName);
    }

    const result: UserInfo = {
      userId,
      userName: userName || 'Unknown',
      userEmail,
      userStatus: userStatus as any,
    };

    console.log('[Content] getUserInfo result:', result);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[Content] getUserInfo error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleGetAppInfo(): Promise<MessageResponse<import('../shared/types').AppInfo>> {
  console.log('[Content] Processing getAppInfo request');

  try {
    const url = window.location.href;
    console.log('[Content] Current URL:', url);

    const appId = extractAppIdFromUrl(url);
    console.log('[Content] Extracted appId:', appId);

    if (!appId) {
      return {
        success: false,
        error: 'Not on an app page. Please navigate to a specific app page.',
      };
    }

    let appName = extractAppNameFromPage();
    let appLabel: string | undefined;
    console.log('[Content] Extracted appName from page:', appName);

    // Fetch app details from API
    console.log('[Content] Fetching app details from API...');
    try {
      const response = await handleMakeApiRequest(`/api/v1/apps/${appId}`, 'GET');
      if (response.success && response.data) {
        appName = appName || response.data.name || response.data.label || 'Unknown';
        appLabel = response.data.label;
        console.log('[Content] Fetched app details from API:', { appName, appLabel });
      }
    } catch (e) {
      console.warn('[Content] Failed to fetch app details from API:', e);
    }

    const result = {
      appId,
      appName: appName || 'Unknown',
      appLabel,
    };

    console.log('[Content] getAppInfo result:', result);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[Content] getAppInfo error:', error);
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
  console.log('[Content] Processing exportGroupMembers request');

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
    console.error('[Content] exportGroupMembers error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

// ============================================================================
// Rules Handlers
// ============================================================================

async function handleFetchGroupRules(groupId?: string): Promise<MessageResponse> {
  console.log('[Content] Processing fetchGroupRules request for groupId:', groupId);

  try {
    // Fetch all rules with pagination
    let allRules: any[] = [];
    let nextUrl: string | null = '/api/v1/groups/rules?limit=200';

    while (nextUrl) {
      const response = await handleMakeApiRequest(nextUrl, 'GET');

      if (!response.success) {
        return response;
      }

      allRules = allRules.concat(response.data || []);

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
              console.log('[Content] Fetching next page of rules:', nextUrl);
              break;
            }
          }
        }
      }
    }

    const rules: any[] = allRules;
    console.log('[Content] Fetched', rules.length, 'rules (total across all pages)');

    // Use provided groupId or extract from URL if on a group page
    const currentGroupId = groupId || extractGroupIdFromUrl(window.location.href);

    // Collect all unique group IDs from all rules
    const allGroupIds = new Set<string>();
    rules.forEach((rule) => {
      // Add target group IDs (groups users are assigned to)
      const groupIds = rule.actions?.assignUserToGroups?.groupIds || [];
      groupIds.forEach((id: string) => allGroupIds.add(id));

      // Also extract and add group IDs from the condition expression
      const expression = rule.conditions?.expression?.value || '';
      const groupIdPattern = /\b00g[a-zA-Z0-9]{17}\b/g;
      const matches = expression.match(groupIdPattern);
      if (matches) {
        matches.forEach((id: string) => allGroupIds.add(id));
      }
    });

    // Fetch group details for all group IDs in parallel (optimized)
    const groupNameMap = new Map<string, string>();
    console.log('[Content] Fetching names for', allGroupIds.size, 'groups in parallel');

    // Create an array of promises to fetch all groups in parallel with caching
    const groupFetchPromises = Array.from(allGroupIds).map(async (groupId) => {
      try {
        // Check cache first
        const cacheKey = `group_name_${groupId}`;
        const cachedName = await getCacheEntry<string>(cacheKey);

        if (cachedName) {
          console.log('[Content] Using cached name for group:', groupId);
          return { groupId, name: cachedName };
        }

        // Fetch from API if not cached
        const groupResponse = await handleMakeApiRequest(`/api/v1/groups/${groupId}`, 'GET');
        if (groupResponse.success && groupResponse.data?.profile?.name) {
          const groupName = groupResponse.data.profile.name;

          // Cache the result (5 minute TTL)
          await setCacheEntry(cacheKey, groupName, { ttl: 5 * 60 * 1000 });

          return { groupId, name: groupName };
        }
      } catch (err) {
        console.warn('[Content] Failed to fetch group name for', groupId, err);
      }
      return null;
    });

    // Wait for all group fetches to complete
    const groupResults = await Promise.all(groupFetchPromises);

    // Populate the map with successful results
    groupResults.forEach((result) => {
      if (result) {
        groupNameMap.set(result.groupId, result.name);
      }
    });

    console.log('[Content] Successfully fetched', groupNameMap.size, 'group names (parallel fetch with caching)');

    // Calculate stats
    const activeRules = rules.filter((r) => r.status === 'ACTIVE');
    const inactiveRules = rules.filter((r) => r.status === 'INACTIVE');

    // Detect conflicts (simple implementation in content script)
    let conflictCount = 0;
    const conflicts: any[] = [];

    for (let i = 0; i < activeRules.length; i++) {
      for (let j = i + 1; j < activeRules.length; j++) {
        const rule1 = activeRules[i];
        const rule2 = activeRules[j];

        const groups1 = rule1.actions?.assignUserToGroups?.groupIds || [];
        const groups2 = rule2.actions?.assignUserToGroups?.groupIds || [];
        const sharedGroups = groups1.filter((g: string) => groups2.includes(g));

        if (sharedGroups.length > 0) {
          // Extract user attributes
          const expr1 = rule1.conditions?.expression?.value || '';
          const expr2 = rule2.conditions?.expression?.value || '';
          const attrs1 = (expr1.match(/user\.(\w+)/g) || []).map((m: string) => m.replace('user.', ''));
          const attrs2 = (expr2.match(/user\.(\w+)/g) || []).map((m: string) => m.replace('user.', ''));
          const commonAttrs = attrs1.filter((a: string) => attrs2.includes(a));

          if (commonAttrs.length > 0) {
            conflictCount++;
            conflicts.push({
              rule1: { id: rule1.id, name: rule1.name },
              rule2: { id: rule2.id, name: rule2.name },
              reason: `Both rules use ${commonAttrs.join(', ')} and assign to ${sharedGroups.length} shared group(s)`,
              severity: sharedGroups.length > 2 ? 'high' : sharedGroups.length > 1 ? 'medium' : 'low',
              affectedGroups: sharedGroups,
            });
          }
        }
      }
    }

    // Format rules for display
    const formattedRules = rules.map((rule) => {
      const groupIds = rule.actions?.assignUserToGroups?.groupIds || [];
      const expression = rule.conditions?.expression?.value || 'No condition specified';

      // Extract user attributes
      const attrs = (expression.match(/user\.(\w+)/g) || []).map((m: string) => m.replace('user.', ''));

      // Simplify expression for display
      const simpleCondition = expression
        .replace(/user\./g, '')
        .replace(/isMemberOfAnyGroup/g, 'is member of group')
        .replace(/isMemberOfGroup/g, 'is member of group');

      // Check if this rule affects the current group
      const affectsCurrentGroup = currentGroupId ? groupIds.includes(currentGroupId) : false;

      // Find conflicts involving this rule
      const ruleConflicts = conflicts.filter(
        (c) => c.rule1.id === rule.id || c.rule2.id === rule.id
      );

      // Map group IDs to their names (for target groups)
      const groupNames = groupIds.map((id: string) => groupNameMap.get(id) || id);

      // Extract group IDs from condition expression and create a map of ALL group IDs -> names
      const conditionGroupIds = expression.match(/\b00g[a-zA-Z0-9]{17}\b/g) || [];
      const allGroupIdsInRule = [...new Set([...groupIds, ...conditionGroupIds])];
      const allGroupNamesMap: Record<string, string> = {};
      allGroupIdsInRule.forEach((id) => {
        const name = groupNameMap.get(id);
        if (name) {
          allGroupNamesMap[id] = name;
        }
      });

      return {
        id: rule.id,
        name: rule.name,
        status: rule.status,
        type: rule.type || 'group_rule',
        condition: simpleCondition,
        conditionExpression: expression,
        groupIds,
        groupNames,
        allGroupNamesMap, // New field: map of all group IDs (in condition and targets) to names
        userAttributes: attrs,
        created: rule.created,
        lastUpdated: rule.lastUpdated,
        affectsCurrentGroup,
        conflicts: ruleConflicts,
      };
    });

    const stats = {
      total: rules.length,
      active: activeRules.length,
      inactive: inactiveRules.length,
      conflicts: conflictCount,
    };

    console.log('[Content] Rule stats:', stats);

    return {
      success: true,
      rules: formattedRules,
      stats,
      conflicts,
    };
  } catch (error) {
    console.error('[Content] fetchGroupRules error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch rules',
    };
  }
}

async function handleActivateRule(ruleId: string): Promise<MessageResponse> {
  console.log('[Content] Activating rule:', ruleId);

  try {
    const response = await handleMakeApiRequest(
      `/api/v1/groups/rules/${ruleId}/lifecycle/activate`,
      'POST'
    );

    if (response.success) {
      console.log('[Content] Rule activated successfully');
      return { success: true };
    } else {
      return response;
    }
  } catch (error) {
    console.error('[Content] activateRule error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to activate rule',
    };
  }
}

async function handleDeactivateRule(ruleId: string): Promise<MessageResponse> {
  console.log('[Content] Deactivating rule:', ruleId);

  try {
    const response = await handleMakeApiRequest(
      `/api/v1/groups/rules/${ruleId}/lifecycle/deactivate`,
      'POST'
    );

    if (response.success) {
      console.log('[Content] Rule deactivated successfully');
      return { success: true };
    } else {
      return response;
    }
  } catch (error) {
    console.error('[Content] deactivateRule error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deactivate rule',
    };
  }
}

// ============================================================================
// User Search and Membership Handlers
// ============================================================================

async function handleSearchUsers(query: string): Promise<MessageResponse> {
  console.log('[Content] Processing searchUsers request:', query);

  try {
    // Okta search API supports multiple search methods
    const trimmedQuery = query.trim();

    // Try multiple search strategies
    let users: OktaUser[] = [];

    // Strategy 1: Use 'q' parameter for flexible search (searches across multiple fields)
    // This is more flexible than 'search' and works better for partial matches
    const qParam = encodeURIComponent(trimmedQuery);
    const qSearchUrl = `/api/v1/users?q=${qParam}&limit=20`;

    console.log('[Content] Searching users with q parameter:', qSearchUrl);
    let response = await handleMakeApiRequest(qSearchUrl, 'GET');

    if (response.success && response.data && response.data.length > 0) {
      users = response.data;
      console.log('[Content] Found', users.length, 'users with q search');
    } else {
      // Strategy 2: If 'q' doesn't work, try 'search' parameter (prefix search)
      const searchParam = encodeURIComponent(trimmedQuery);
      const searchUrl = `/api/v1/users?search=${searchParam}&limit=20`;

      console.log('[Content] Trying search parameter:', searchUrl);
      response = await handleMakeApiRequest(searchUrl, 'GET');

      if (response.success && response.data) {
        users = response.data;
        console.log('[Content] Found', users.length, 'users with search parameter');
      }
    }

    // If still no results and query looks like an email, try filter
    if (users.length === 0 && trimmedQuery.includes('@')) {
      const filterUrl = `/api/v1/users?filter=profile.email eq "${trimmedQuery}"&limit=20`;
      console.log('[Content] Trying email filter:', filterUrl);
      response = await handleMakeApiRequest(filterUrl, 'GET');

      if (response.success && response.data) {
        users = response.data;
        console.log('[Content] Found', users.length, 'users with email filter');
      }
    }

    return {
      success: true,
      data: users,
      count: users.length,
    };
  } catch (error) {
    console.error('[Content] searchUsers error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search users',
    };
  }
}

async function handleSearchGroups(query: string): Promise<MessageResponse> {
  console.log('[Content] Processing searchGroups request:', query);

  try {
    const trimmedQuery = query.trim();

    // Use 'q' parameter for flexible name-based search (autocomplete scenario)
    // This matches the pattern used by searchUsers and is simple/fast
    const qParam = encodeURIComponent(trimmedQuery);
    const searchUrl = `/api/v1/groups?q=${qParam}&limit=20&expand=stats`;

    console.log('[Content] Searching groups with q parameter:', searchUrl);
    const response = await handleMakeApiRequest(searchUrl, 'GET');

    if (response.success && response.data) {
      const groups = response.data;
      console.log('[Content] Found', groups.length, 'groups');

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
    console.error('[Content] searchGroups error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search groups',
    };
  }
}

async function handleGetUserGroups(userId: string): Promise<MessageResponse> {
  console.log('[Content] Processing getUserGroups request for user:', userId);

  try {
    let allGroups: any[] = [];
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
    console.error('[Content] getUserGroups error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user groups',
    };
  }
}
async function handleGetUserContext(userId: string): Promise<MessageResponse> {
  console.log('[Content] Processing getUserContext request for user:', userId);

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
      } else if (typeof managedByRulesRaw === 'object' && (managedByRulesRaw.id || managedByRulesRaw.ruleId)) {
        rules = [managedByRulesRaw.id || managedByRulesRaw.ruleId];
      }
    }

    return {
      success: true,
      data: {
        userId: userData[0],
        managedByRules: rules
      },
    };
  } catch (error) {
    console.error('[Content] getUserContext error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user context',
    };
  }
}

async function handleGetUserDetails(userId: string): Promise<MessageResponse> {
  console.log('[Content] Processing getUserDetails request for user:', userId);

  try {
    const response = await handleMakeApiRequest(`/api/v1/users/${userId}`, 'GET');

    if (!response.success) {
      return response;
    }

    console.log('[Content] Retrieved user details');

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[Content] getUserDetails error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user details',
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function getXsrfToken(): string {
  const xsrfElement = document.getElementById('_xsrfToken');
  return xsrfElement ? xsrfElement.textContent || '' : '';
}

function extractGroupIdFromUrl(url: string): string | null {
  const match1 = url.match(/\/admin\/group\/([a-zA-Z0-9]+)/);
  if (match1) return match1[1];

  const match2 = url.match(/\/groups\/([a-zA-Z0-9]+)/);
  if (match2) return match2[1];

  return null;
}

function extractGroupNameFromPage(): string | null {
  const selectors = [
    'h1[data-se="group-name"]',
    '.group-profile-header h1',
    '[data-se="group-detail-name"]',
    'h1.okta-form-title',
    '.content-container h1',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent?.trim() || null;
    }
  }

  return null;
}

function extractUserIdFromUrl(url: string): string | null {
  console.log('[extractUserIdFromUrl] Parsing URL:', url);

  // Okta user IDs are typically 20 characters, alphanumeric (e.g., 00u1234567890abcdefg)
  // Some can be shorter or use different formats

  // Pattern list in order of specificity (most specific first)
  const patterns: Array<{ regex: RegExp; name: string }> = [
    // New Okta Identity Engine (OIE) patterns
    { regex: /\/admin\/user\/profile\/view\/([a-zA-Z0-9]+)/, name: '/admin/user/profile/view/{id}' },
    { regex: /\/admin\/user\/profile\/([a-zA-Z0-9]+)/, name: '/admin/user/profile/{id}' },

    // Classic admin patterns
    { regex: /\/admin\/user\/([a-zA-Z0-9]+)(?:\/|$|\?)/, name: '/admin/user/{id}' },
    { regex: /\/admin\/users\/([a-zA-Z0-9]+)(?:\/|$|\?)/, name: '/admin/users/{id}' },

    // Directory patterns (used in some Okta instances)
    { regex: /\/admin\/directory\/people\/([a-zA-Z0-9]+)/, name: '/admin/directory/people/{id}' },

    // End-user dashboard patterns
    { regex: /\/enduser\/settings\/profile\/([a-zA-Z0-9]+)/, name: '/enduser/settings/profile/{id}' },
    { regex: /\/app\/UserHome\/([a-zA-Z0-9]+)/, name: '/app/UserHome/{id}' },

    // API/direct user patterns
    { regex: /\/users\/([a-zA-Z0-9]+)(?:\/|$|\?)/, name: '/users/{id}' },

    // Report/audit patterns that show user details
    { regex: /\/reports\/user\/([a-zA-Z0-9]+)/, name: '/reports/user/{id}' },

    // Query parameter patterns (some Okta UIs use userId in query params)
    { regex: /[?&]userId=([a-zA-Z0-9]+)/, name: '?userId={id}' },
    { regex: /[?&]user=([a-zA-Z0-9]+)/, name: '?user={id}' },
  ];

  for (const { regex, name } of patterns) {
    const match = url.match(regex);
    if (match && match[1]) {
      // Validate it looks like an Okta ID (starts with 00u or is alphanumeric)
      const potentialId = match[1];
      // Skip obvious non-IDs like 'settings', 'profile', 'edit', etc.
      const nonIdKeywords = ['settings', 'profile', 'edit', 'view', 'new', 'create', 'delete', 'list', 'search'];
      if (nonIdKeywords.includes(potentialId.toLowerCase())) {
        continue;
      }
      console.log(`[extractUserIdFromUrl] Matched pattern "${name}":`, potentialId);
      return potentialId;
    }
  }

  console.warn('[extractUserIdFromUrl] No pattern matched. URL:', url);
  return null;
}

function extractUserNameFromPage(): string | null {
  const selectors = [
    // Okta user profile full name (priority)
    '.subheader-fullname',

    // Modern Okta Identity Engine selectors
    '[data-se="user-profile-name"]',
    '[data-se="user-name"]',
    '[data-se="user-detail-name"]',
    '[data-testid="user-name"]',
    '[data-testid="profile-name"]',

    // Profile page headers
    '.user-profile-header h1',
    '.user-header h1',
    '.user-detail-header h1',
    '.profile-header h1',
    '.person-header h1',

    // Directory/people page
    '.directory-person-header h1',
    '.person-profile h1',
    '[class*="ProfileHeader"] h1',
    '[class*="UserHeader"] h1',

    // Generic content headers
    'h1.okta-form-title',
    '.content-container h1',
    'main h1',

    // Breadcrumb or title area (fallback)
    '.page-title',
    '[class*="PageTitle"]',
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        // Skip if it's just generic text like "User Profile" or "Settings"
        if (text && !['User Profile', 'Profile', 'Settings', 'User'].includes(text)) {
          return text;
        }
      }
    } catch {
      // Some selectors might throw on certain pages
      continue;
    }
  }

  return null;
}

function extractAppIdFromUrl(url: string): string | null {
  console.log('[extractAppIdFromUrl] Parsing URL:', url);

  // Okta app IDs are typically 20 characters, alphanumeric (e.g., 0oa1234567890abcdefg)

  const patterns: Array<{ regex: RegExp; name: string }> = [
    // Admin app configuration pages
    { regex: /\/admin\/app\/([a-zA-Z0-9]+)\/instance\/([a-zA-Z0-9]+)/, name: '/admin/app/{appId}/instance/{instanceId}' },
    { regex: /\/admin\/app\/([a-zA-Z0-9]+)\/settings/, name: '/admin/app/{appId}/settings' },
    { regex: /\/admin\/app\/([a-zA-Z0-9]+)\/assignment/, name: '/admin/app/{appId}/assignment' },
    { regex: /\/admin\/app\/([a-zA-Z0-9]+)/, name: '/admin/app/{appId}' },

    // Applications list and detail pages
    { regex: /\/admin\/apps\/active\/([a-zA-Z0-9]+)/, name: '/admin/apps/active/{appId}' },
    { regex: /\/admin\/apps\/([a-zA-Z0-9]+)/, name: '/admin/apps/{appId}' },

    // API patterns
    { regex: /\/api\/v1\/apps\/([a-zA-Z0-9]+)/, name: '/api/v1/apps/{appId}' },

    // Query parameter patterns
    { regex: /[?&]appId=([a-zA-Z0-9]+)/, name: '?appId={appId}' },
    { regex: /[?&]app=([a-zA-Z0-9]+)/, name: '?app={appId}' },
  ];

  for (const { regex, name } of patterns) {
    const match = url.match(regex);
    if (match && match[1]) {
      const potentialId = match[1];
      // Skip obvious non-IDs
      const nonIdKeywords = ['settings', 'new', 'create', 'list', 'active', 'inactive', 'catalog'];
      if (nonIdKeywords.includes(potentialId.toLowerCase())) {
        continue;
      }
      // Okta app IDs typically start with '0oa'
      if (potentialId.startsWith('0oa') || potentialId.length >= 18) {
        console.log(`[extractAppIdFromUrl] Matched pattern "${name}":`, potentialId);
        return potentialId;
      }
    }
  }

  console.warn('[extractAppIdFromUrl] No pattern matched. URL:', url);
  return null;
}

function extractAppNameFromPage(): string | null {
  const selectors = [
    // App configuration page headers
    '[data-se="app-name"]',
    '[data-se="app-label"]',
    '[data-testid="app-name"]',
    '[data-testid="app-label"]',

    // App detail headers
    '.app-header h1',
    '.app-detail-header h1',
    '[class*="AppHeader"] h1',
    '[class*="ApplicationHeader"] h1',

    // Settings page
    '.app-settings-header h1',
    '.application-settings h1',

    // Generic headers in app context
    'h1.okta-form-title',
    '.content-container h1',
    'main h1',

    // Page title
    '.page-title',
    '[class*="PageTitle"]',
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        // Skip generic text
        if (text && !['Application', 'App', 'Settings', 'Configuration'].includes(text)) {
          return text;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

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

function convertToCSV(users: OktaUser[]): string {
  if (users.length === 0) return '';

  const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Status'];
  const rows = users.map(u => [
    u.id,
    u.profile.login,
    u.profile.firstName,
    u.profile.lastName,
    u.status,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Visual Indicator
// ============================================================================

function injectIndicator(): void {
  const indicator = document.createElement('div');
  indicator.id = 'okta-extension-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #1a1a1a;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    z-index: 999999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  indicator.textContent = 'Okta Unbound Active';

  document.body.appendChild(indicator);
  setTimeout(() => {
    indicator.style.transition = 'opacity 0.3s';
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  }, 3000);
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Content] DOMContentLoaded fired');
    injectIndicator();
  });
} else {
  console.log('[Content] DOM already loaded, injecting indicator');
  injectIndicator();
}
