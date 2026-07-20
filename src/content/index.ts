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

import type { MessageRequest, MessageResponse } from '../shared/types';
import { createLogger } from '../shared/utils/logger';
import { extractAppIdFromUrl, extractAppNameFromPage } from './pageContext';
import { handleMakeApiRequest } from './apiRequest';
import { injectIndicator } from './indicator';
import {
  handleFetchGroupRules,
  handleActivateRule,
  handleDeactivateRule,
} from './ruleHandlers';
import {
  handleGetGroupInfo,
  handleExportGroupMembers,
  handleSearchGroups,
} from './groupHandlers';
import {
  handleGetUserInfo,
  handleSearchUsers,
  handleGetUserGroups,
  handleGetUserContext,
  handleGetUserDetails,
} from './userHandlers';

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
