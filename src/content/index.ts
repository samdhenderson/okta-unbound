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
 * - Display visual indicators when active
 *
 * **Supported Operations:**
 * - Page context (current group / user / app / auth-policy info, Okta origin)
 * - Generic API requests (GET, POST, PUT, DELETE) relayed by the background scheduler
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

import type { AppInfo, MessageRequest, MessageResponse, PolicyInfo } from '../shared/types';
import { createLogger } from '../shared/utils/logger';
import { oktaPolicyListItemSchema, parseOkta } from '../shared/schemas/okta';
import {
  extractAppIdFromUrl,
  extractAppNameFromPage,
  extractPolicyIdFromUrl,
  extractPolicyNameFromPage,
} from './pageContext';
import { handleMakeApiRequest } from './apiRequest';
import { injectIndicator } from './indicator';
import { handleGetGroupInfo } from './groupHandlers';
import { handleGetUserInfo } from './userHandlers';

declare global {
  interface Window {
    /**
     * Liveness probe left by the content script that claimed this page. The
     * closure reads `chrome.runtime.id` from the *claimant's* extension
     * context, so only a still-live script of the same extension can return
     * the current id — an orphaned script's context is invalidated and
     * throws or returns a non-matching value. Used to skip duplicate
     * initialization. See {@link isDuplicateInjection}.
     */
    __oktaUnboundClaim?: () => string | undefined;
  }
}

const log = createLogger('Content');

log.debug('Content script loaded', {
  readyState: document.readyState,
});

// ============================================================================
// Double-injection guard
// ============================================================================

// `onInstalled` re-injects this script into already-open Okta tabs (see
// background/reinjectContentScripts.ts). A tab that Chrome had *already* given a
// fresh script would then run two copies, and both would answer every message —
// duplicate API calls and a racing `sendResponse`. The claim is a window-scoped
// *liveness probe*, not a static flag: a static id (or id+version) marker would
// survive from a pre-update orphaned script — `chrome.runtime.id` is stable
// across updates, and the version doesn't change on a same-version dev reload —
// and would wrongly make the re-injected script bail, leaving the tab with no
// live listener at all. Calling the closure evaluates `chrome.runtime.id` in
// the *claimant's* extension context: a live same-extension claimant returns
// the current id (genuine duplicate — skip); an orphaned claimant's context is
// invalidated and throws or returns undefined (stale claim — proceed).
const isDuplicateInjection = (() => {
  try {
    return window.__oktaUnboundClaim?.() === chrome.runtime.id;
  } catch {
    // The previous claimant's extension context is invalidated — stale claim.
    return false;
  }
})();

if (isDuplicateInjection) {
  log.debug('Content script already active on this page; skipping initialization');
} else {
  window.__oktaUnboundClaim = () => chrome.runtime.id;
}

// ============================================================================
// Message Listener
// ============================================================================

/**
 * Route one runtime message. Returns `true` whenever a response will be sent (a
 * literal `true`, never a promise — MV3 closes the channel on a promise), and
 * `false` for a rejected sender.
 */
function handleMessage(
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void,
): boolean {
  // Only trust messages from this extension's own contexts (the side panel /
  // background). `onMessage` should never fire for other extensions or web
  // pages, but — mirroring the background listener — reject any foreign sender
  // explicitly so the invariant is enforced and future-proof.
  if (sender.id !== chrome.runtime.id) {
    log.warn('Ignoring message from foreign sender');
    return false;
  }

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

    case 'getPolicyInfo':
      handleGetPolicyInfo().then(sendResponse);
      return true;

    case 'makeApiRequest':
      if (!request.endpoint) {
        sendResponse({ success: false, error: 'Missing endpoint' });
        return true;
      }
      handleMakeApiRequest(request.endpoint, request.method, request.body).then(sendResponse);
      return true;

    case 'getOktaOrigin':
      sendResponse({ success: true, data: window.location.origin });
      return true;

    default:
      log.warn('Unknown action', { action: request.action });
      sendResponse({ success: false, error: 'Unknown action' });
      return true;
  }
}

if (!isDuplicateInjection) {
  chrome.runtime.onMessage.addListener(handleMessage);
}

async function handleGetAppInfo(): Promise<MessageResponse<AppInfo>> {
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

/**
 * Resolve the current page's authentication/access policy ID, name and status.
 *
 * Mirrors {@link handleGetAppInfo}: the id comes from the URL, the name is scraped
 * from the page heading (page wins), and a single `GET /api/v1/policies/{id}` read
 * fills in whatever the page did not supply. Unlike the app handler the API payload
 * is zod-validated (`oktaPolicyListItemSchema`) before any field is read — a
 * validation failure, like a failed request, degrades silently to the URL/DOM data.
 *
 * Read-only and identity-only: nothing here scrapes policy settings or rules out of
 * the page markup.
 *
 * @returns A response carrying {@link PolicyInfo}, or an error when not on a policy page.
 */
async function handleGetPolicyInfo(): Promise<MessageResponse<PolicyInfo>> {
  log.debug('Processing getPolicyInfo request');

  try {
    const url = window.location.href;
    log.debug('Current page location', { path: window.location.pathname });

    const policyId = extractPolicyIdFromUrl(url);
    log.debug('Extracted policyId', { policyId });

    if (!policyId) {
      return {
        success: false,
        error: 'Not on an authentication policy page. Please navigate to a specific policy page.',
      };
    }

    let policyName = extractPolicyNameFromPage();
    let policyStatus: string | undefined;
    log.debug('Extracted policyName from page', { found: Boolean(policyName) });

    // Enrich from the API. `policyId` already matched the strict `rst`/`00p`
    // alphanumeric shape guard in extractPolicyIdFromUrl, so it is safe to
    // interpolate into the same-origin path (mirroring the group/app handlers).
    log.debug('Fetching policy details from API');
    try {
      const response = await handleMakeApiRequest(`/api/v1/policies/${policyId}`, 'GET');
      if (response.success && response.data) {
        const policy = parseOkta(
          oktaPolicyListItemSchema,
          response.data,
          'GET /api/v1/policies/{id}',
        );
        policyName = policyName || policy.name || null;
        policyStatus = policy.status;
        log.debug('Fetched policy details from API', {
          hasName: Boolean(policyName),
          hasStatus: Boolean(policyStatus),
        });
      }
    } catch (e) {
      log.warn('Failed to fetch policy details from API', e);
    }

    const result: PolicyInfo = { policyId, policyName, policyStatus };

    log.debug('getPolicyInfo result', {
      policyId: result.policyId,
      hasName: Boolean(result.policyName),
      hasStatus: Boolean(result.policyStatus),
    });
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    log.error('getPolicyInfo error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Initialization
// ============================================================================

// Initialize (skipped entirely for a duplicate injection — the page already has a
// live script and its indicator).
if (!isDuplicateInjection) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      log.debug('DOMContentLoaded fired');
      injectIndicator();
    });
  } else {
    log.debug('DOM already loaded, injecting indicator');
    injectIndicator();
  }
}
