// Content script for Okta Unbound
// Runs on Okta pages and handles API requests with proper session authentication

import type { MessageRequest, MessageResponse, OktaUser, GroupInfo, ApiResponse } from '../shared/types';

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
        handleFetchGroupRules().then(sendResponse);
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
      } catch (e) {
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

async function handleFetchGroupRules(): Promise<MessageResponse> {
  console.log('[Content] Processing fetchGroupRules request');

  try {
    const response = await handleMakeApiRequest('/api/v1/groups/rules?limit=200', 'GET');

    if (!response.success) {
      return response;
    }

    const rules: any[] = response.data || [];
    console.log('[Content] Fetched', rules.length, 'rules');

    // Get current group ID if on a group page
    const currentGroupId = extractGroupIdFromUrl(window.location.href);

    // Collect all unique group IDs from all rules
    const allGroupIds = new Set<string>();
    rules.forEach((rule) => {
      const groupIds = rule.actions?.assignUserToGroups?.groupIds || [];
      groupIds.forEach((id: string) => allGroupIds.add(id));
    });

    // Fetch group details for all group IDs
    const groupNameMap = new Map<string, string>();
    console.log('[Content] Fetching names for', allGroupIds.size, 'groups');

    for (const groupId of allGroupIds) {
      try {
        const groupResponse = await handleMakeApiRequest(`/api/v1/groups/${groupId}`, 'GET');
        if (groupResponse.success && groupResponse.data?.profile?.name) {
          groupNameMap.set(groupId, groupResponse.data.profile.name);
        }
      } catch (err) {
        console.warn('[Content] Failed to fetch group name for', groupId, err);
        // Continue with other groups even if one fails
      }
    }

    console.log('[Content] Successfully fetched', groupNameMap.size, 'group names');

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

      // Map group IDs to their names
      const groupNames = groupIds.map((id: string) => groupNameMap.get(id) || id);

      return {
        id: rule.id,
        name: rule.name,
        status: rule.status,
        condition: simpleCondition,
        conditionExpression: expression,
        groupIds,
        groupNames,
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
