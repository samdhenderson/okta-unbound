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
import { oktaAppListItemSchema, oktaPolicyListItemSchema, parseOkta } from '../shared/schemas/okta';
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

/**
 * Resolve the current page's app ID and name.
 *
 * The id comes from the URL and the name from the page heading; a single
 * `GET /api/v1/apps/{id}` read runs **only when the DOM came up empty**, in the
 * same shape as {@link handleGetGroupInfo}. That payload is zod-validated
 * (`oktaAppListItemSchema`) before any field is read — a validation failure, like a
 * failed request, degrades silently to the URL/DOM data (D-062, ADR-0006). This handler is on the `ContextBar`
 * masthead's feed, which re-detects on every navigation of the live Okta tab, so
 * an unconditional read cost one request per app page visited (D-059).
 *
 * **`appLabel` is deliberately best-effort and only populated on that fallback
 * path.** The DOM cannot supply it, and as of this change nothing in `src/` reads
 * `AppInfo.appLabel` — the only consumer of app page context is `App.tsx`, which
 * reads `appName` for the masthead's entity name. So when the page heading answers,
 * `appLabel` is left `undefined` rather than spending a request to fill a field no
 * one renders. A future consumer that genuinely needs the label must re-introduce
 * the fetch on its own terms (and say why), not rely on it arriving by accident.
 *
 * @returns A response carrying {@link AppInfo}, or an error when not on an app page.
 */
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

    // Fallback: fetch from API if not found in DOM
    if (!appName) {
      log.debug('Fetching app details from API');
      try {
        const response = await handleMakeApiRequest(`/api/v1/apps/${appId}`, 'GET');
        if (response.success && response.data) {
          // ADR-0006: the payload is validated before any field is read, the same
          // way handleGetPolicyInfo validates its own (D-062). `oktaAppListItemSchema`
          // is the lenient app contract — only `id` is required and every identity
          // field is `.catch(undefined)` — and it is reused rather than redeclared so
          // this handler cannot drift from the schema the app walks already trust.
          // A validation miss throws out to the `catch` below, which degrades to the
          // URL/DOM data exactly as a failed request does; it never breaks detection.
          const app = parseOkta(oktaAppListItemSchema, response.data, 'GET /api/v1/apps/{id}');
          appName = app.name || app.label || 'Unknown';
          appLabel = app.label;
          log.debug('Fetched app details from API', {
            hasName: Boolean(appName),
            hasLabel: Boolean(appLabel),
          });
        }
      } catch (e) {
        log.warn('Failed to fetch app details from API', e);
      }
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
 * The id comes from the URL, the name is scraped from the page heading (page wins),
 * and a single `GET /api/v1/policies/{id}` read fills in whatever the page did not
 * supply. The payload is zod-validated (`oktaPolicyListItemSchema`) before any field
 * is read — a validation failure, like a failed request, degrades silently to the
 * URL/DOM data.
 *
 * **This handler does NOT mirror {@link handleGetAppInfo}'s request policy, and the
 * difference is the point.** The app handler fetches only when the DOM comes up
 * empty (D-059); this one fetches on every policy page, because it also wants
 * `policyStatus`, which no selector can scrape. What that request buys is currently
 * unread: enumerating `PolicyInfo.policyStatus`'s consumers across `src/` finds
 * none — `App.tsx` reads `policyInfo.policyName` for the masthead and nothing else
 * touches the field (D-070). So the unconditional read is **not** justified by a
 * live consumer today; it is left in place here rather than removed because making
 * it conditional is a behavior change that belongs to its own perf item, on the
 * evidence D-059 required. Do not describe this handler as mirroring the app one
 * until that item lands.
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
