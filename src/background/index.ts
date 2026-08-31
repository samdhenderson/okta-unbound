/**
 * @module background/index
 * @description Background service worker for the Okta Unbound Chrome extension.
 *
 * This service worker is the core coordination layer that runs persistently in the background.
 * It manages:
 *
 * **Core Responsibilities:**
 * - Global API request scheduling and rate limit management
 * - Tab state persistence across browser sessions
 * - Audit log retention and cleanup
 * - Extension lifecycle events (install, update, icon clicks)
 * - Message routing between content scripts and sidepanel
 *
 * **API Scheduler:**
 * The global scheduler prevents rate limiting by:
 * - Queuing all API requests with priority levels
 * - Enforcing concurrent request limits
 * - Tracking rate limit headers and implementing cooldowns
 * - Automatically retrying failed requests with exponential backoff
 * - Broadcasting scheduler state to all extension components
 *
 * **Tab State Management:**
 * Preserves user interface state (filters, selections, etc.) across:
 * - Browser restarts
 * - Extension updates
 * - Tab switches
 *
 * **Audit Retention:**
 * Automatically cleans up old audit logs daily based on retention settings.
 *
 * @see {@link ApiScheduler} for rate limiting details
 * @see {@link TabStateManager} for state persistence
 * @see {@link auditStore} for audit logging
 */

// Background service worker for Okta Unbound extension
import { auditStore } from '../shared/storage/auditStore';
import { ApiScheduler } from '../shared/scheduler/apiScheduler';
import { TabStateManager } from '../shared/tabState/tabStateManager';
import type { SchedulerState } from '../shared/scheduler/types';
import type { SchedulerStateChangedMessage, UpdateOperationPlanMessage } from '../shared/types';
import { createLogger } from '../shared/utils/logger';
import { isOktaUrl } from '../shared/utils/oktaUrl';
import { createThrottledRelay } from './throttledRelay';
import { reinjectContentScripts } from './reinjectContentScripts';
import { syncSnapshot } from './snapshotBridge';
import { ensureRateLimitThreshold } from './rateLimitThreshold';
import { startSnapshotScheduler } from './snapshotScheduler';

const log = createLogger('Background');

log.info('Service worker started');

// ============================================================================
// Global API Scheduler
// ============================================================================

// Initialize the global API scheduler
const globalScheduler = new ApiScheduler({
  maxConcurrent: 5,
  minRemainingThreshold: 10, // Cooldown at 10% remaining
  cooldownDuration: 30000, // 30 seconds fallback
  retryDelay: 2000,
  maxRetries: 3,
  requestTimeout: 30000,
});

log.info('Global API scheduler initialized');

// Broadcast scheduler state changes to all sidepanel instances. Metrics ride
// along so the side panel's failed/coalesced counters stay live instead of
// freezing at their mount-time fetch.
//
// The relay is throttled: the event-driven scheduler can settle many requests
// within milliseconds, and rebroadcasting each change would flood the runtime
// messaging channel. Status transitions (idle→processing, →cooldown, →paused…)
// flush immediately; volume-only changes (queue length, metrics counters)
// coalesce into one trailing send per window.
const relaySchedulerState = createThrottledRelay<SchedulerStateChangedMessage>(
  (message) => {
    // Broadcast to all extension contexts
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors if no listeners (sidepanel not open)
    });
  },
  { isUrgent: (previous, next) => previous.state.status !== next.state.status },
);

globalScheduler.onStateChange((state: SchedulerState) => {
  relaySchedulerState({
    action: 'schedulerStateChanged',
    state,
    metrics: globalScheduler.getMetrics(),
  });
});

// Expired tab states are cleaned up hourly via the `tabStateCleanup` alarm
// (see the alarms section below) — chrome.alarms survives service-worker
// suspension, unlike a setInterval that would keep the worker alive.

// ============================================================================
// Message Handlers for Scheduler and Tab State
// ============================================================================

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_PRIORITIES = new Set(['interactive', 'high', 'normal', 'low']);
/** Bounds a `reason` string so a malformed/huge value can't bloat the request audit log. */
const MAX_REASON_LENGTH = 80;

/**
 * Validate the structure of a `scheduleApiRequest` message before it reaches the
 * scheduler: endpoint must be a plain same-origin path (no absolute or
 * protocol-relative URLs), method/priority must come from the closed allow-lists,
 * tabId must be a number, and an optional `reason` (the verbose audit log's
 * "why") must be a short plain string.
 */
function isValidScheduleRequest(request: {
  endpoint?: unknown;
  tabId?: unknown;
  method?: unknown;
  priority?: unknown;
  reason?: unknown;
}): boolean {
  if (
    typeof request.endpoint !== 'string' ||
    !request.endpoint.startsWith('/') ||
    request.endpoint.startsWith('//')
  ) {
    return false;
  }
  if (typeof request.tabId !== 'number' || !Number.isInteger(request.tabId)) {
    return false;
  }
  if (request.method !== undefined && !ALLOWED_METHODS.has(String(request.method).toUpperCase())) {
    return false;
  }
  if (request.priority !== undefined && !ALLOWED_PRIORITIES.has(String(request.priority))) {
    return false;
  }
  if (
    request.reason !== undefined &&
    (typeof request.reason !== 'string' || request.reason.length > MAX_REASON_LENGTH)
  ) {
    return false;
  }
  return true;
}

/** Bounds a plan `name` the same way `reason` is bounded, and for the same reason. */
const MAX_PLAN_NAME_LENGTH = 80;
/** Bounds an opaque plan id, which is only ever compared, never parsed. */
const MAX_PLAN_ID_LENGTH = 64;
/** Mirrors `MAX_LEGS_PER_PLAN`; rejected here so an oversized message is never even unpacked. */
const MAX_PLAN_LEGS = 16;
const PLAN_OPS = new Set(['declare', 'refine', 'complete', 'cancel']);
const ESTIMATE_KINDS = new Set(['exact', 'atLeast', 'unknown']);

/** Structural check for one declared or refined estimate. */
function isValidPlanEstimate(estimate: unknown): boolean {
  if (typeof estimate !== 'object' || estimate === null) return false;
  const { kind, requests } = estimate as { kind?: unknown; requests?: unknown };
  if (typeof kind !== 'string' || !ESTIMATE_KINDS.has(kind)) return false;
  if (kind === 'unknown') return true;
  return typeof requests === 'number' && Number.isFinite(requests) && requests >= 0;
}

/**
 * Validate an `updateOperationPlan` message.
 *
 * The plan ledger is advisory — nothing here can gate, reserve, or redirect a
 * request — so the risk this guards is not privilege but volume and noise: an
 * unbounded `name` reaching the state broadcast, or an unbounded leg array
 * reaching the registry. Every string is therefore length-capped and every
 * endpoint is held to the same same-origin single-`/` shape
 * `isValidScheduleRequest` enforces, since a leg endpoint is bucketed by the
 * same rule a real request is.
 */
function isValidPlanUpdate(request: {
  op?: unknown;
  planId?: unknown;
  name?: unknown;
  tabId?: unknown;
  legs?: unknown;
  endpoint?: unknown;
  estimate?: unknown;
}): request is UpdateOperationPlanMessage {
  if (typeof request.op !== 'string' || !PLAN_OPS.has(request.op)) return false;
  if (
    typeof request.planId !== 'string' ||
    request.planId.length === 0 ||
    request.planId.length > MAX_PLAN_ID_LENGTH
  ) {
    return false;
  }

  const isPlainPath = (value: unknown): boolean =>
    typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');

  if (request.op === 'declare') {
    if (
      typeof request.name !== 'string' ||
      request.name.length === 0 ||
      request.name.length > MAX_PLAN_NAME_LENGTH
    ) {
      return false;
    }
    if (typeof request.tabId !== 'number' || !Number.isInteger(request.tabId)) return false;
    if (!Array.isArray(request.legs) || request.legs.length === 0) return false;
    if (request.legs.length > MAX_PLAN_LEGS) return false;

    return request.legs.every((leg: unknown) => {
      if (typeof leg !== 'object' || leg === null) return false;
      const { endpoint, method, estimate } = leg as {
        endpoint?: unknown;
        method?: unknown;
        estimate?: unknown;
      };
      if (!isPlainPath(endpoint)) return false;
      if (method !== undefined && !ALLOWED_METHODS.has(String(method).toUpperCase())) return false;
      return isValidPlanEstimate(estimate);
    });
  }

  if (request.op === 'refine') {
    return isPlainPath(request.endpoint) && isValidPlanEstimate(request.estimate);
  }

  // 'complete' and 'cancel' need nothing beyond a plan id.
  return true;
}

/**
 * Validate a `syncSnapshot` message before it can drive a walk of the org.
 *
 * The origin must be a parsed Okta host, not a substring match
 * (`shared/utils/oktaUrl`, `docs/security.md` §6): it scopes the IndexedDB rows,
 * so accepting an arbitrary string would let one org's inventory be filed under
 * another's key. `tabId` must be a real integer — it selects the content script
 * whose authenticated session performs every fetch.
 */
function isValidSyncSnapshotRequest(request: {
  origin?: unknown;
  tabId?: unknown;
  force?: unknown;
}): boolean {
  if (typeof request.origin !== 'string' || !isOktaUrl(request.origin)) return false;
  if (request.force !== undefined && typeof request.force !== 'boolean') return false;
  return typeof request.tabId === 'number' && Number.isInteger(request.tabId);
}

/**
 * Reject actions that must originate from an extension page (the side panel),
 * never from a tab / content-script context. Extension pages have no
 * `sender.tab`; a content script always does. Returns `true` (and answers via
 * `sendResponse`) when the message came from a tab and must be dropped, so the
 * caller can `return true` to close the channel; `false` when the sender is a
 * legitimate extension page and handling should proceed.
 */
function rejectIfFromTab(
  sender: chrome.runtime.MessageSender,
  action: string,
  sendResponse: (response: { success: false; error: string }) => void,
): boolean {
  if (sender.tab) {
    sendResponse({ success: false, error: `${action} not allowed from tabs` });
    return true;
  }
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Only trust messages from this extension's own contexts. `onMessage` never
  // fires for other extensions or web pages unless externally_connectable is
  // added later — this guard keeps that invariant explicit and future-proof.
  if (sender.id !== chrome.runtime.id) {
    log.warn('Ignoring message from foreign sender');
    return false;
  }

  log.debug('Received message', { action: request.action });

  switch (request.action) {
    case 'scheduleApiRequest':
      // API scheduling is driven only by extension pages (the side panel).
      // Content scripts run inside web pages and must never be able to drive
      // authenticated Okta API calls — reject any tab-originated request.
      if (rejectIfFromTab(sender, 'scheduleApiRequest', sendResponse)) {
        return true;
      }

      if (!request.endpoint || !request.tabId) {
        sendResponse({ success: false, error: 'Missing endpoint or tabId' });
        return true;
      }

      if (!isValidScheduleRequest(request)) {
        sendResponse({ success: false, error: 'Invalid scheduleApiRequest message' });
        return true;
      }

      // Learn this org's own cooldown threshold, once per org per browser
      // session. Deliberately not awaited: this request must not wait on — or
      // be failed by — an optional refinement of the backoff policy.
      ensureRateLimitThreshold(globalScheduler, request.tabId);

      globalScheduler
        .scheduleRequest(
          request.endpoint,
          request.method || 'GET',
          request.body,
          request.tabId,
          request.priority || 'normal',
          request.reason,
          typeof request.planId === 'string' ? request.planId : undefined,
        )
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message || 'Request failed',
          });
        });

      return true; // Keep message channel open for async response

    case 'updateOperationPlan': {
      // Same sender posture as `scheduleApiRequest`: a plan names and sizes
      // authenticated Okta traffic, and a content script must never be able to
      // author what the side panel's own bar reports.
      if (rejectIfFromTab(sender, 'updateOperationPlan', sendResponse)) {
        return true;
      }

      if (!isValidPlanUpdate(request)) {
        sendResponse({ success: false, error: 'Invalid updateOperationPlan message' });
        return true;
      }

      switch (request.op) {
        case 'declare':
          sendResponse({
            success: globalScheduler.declarePlan({
              id: request.planId,
              name: request.name,
              tabId: request.tabId,
              legs: request.legs,
            }),
          });
          break;
        case 'refine':
          globalScheduler.refinePlan(request.planId, request.endpoint, request.estimate);
          sendResponse({ success: true });
          break;
        case 'complete':
          globalScheduler.completePlan(request.planId);
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: true, dropped: globalScheduler.cancelPlan(request.planId) });
          break;
      }

      return true;
    }

    case 'syncSnapshot':
      // Same sender posture as `scheduleApiRequest`, and for the same reason:
      // this drives authenticated Okta traffic, so a content script running
      // inside a web page must never be able to trigger it (ADR-0040 §2).
      if (rejectIfFromTab(sender, 'syncSnapshot', sendResponse)) {
        return true;
      }

      if (!isValidSyncSnapshotRequest(request)) {
        sendResponse({ success: false, error: 'Invalid syncSnapshot message' });
        return true;
      }

      // A snapshot sync is the largest fan-out the extension issues, so it is
      // the traffic that most wants the org's own threshold rather than the
      // configured default. Same fire-and-forget posture as above.
      ensureRateLimitThreshold(globalScheduler, request.tabId);

      syncSnapshot(
        globalScheduler,
        request.origin,
        request.tabId,
        Date.now(),
        request.force === true,
      )
        .then((outcomes) => {
          // A walk that failed mid-way resolves rather than throwing, so
          // "did every collection finish" is the success verdict — otherwise a
          // failed load would report success and banner nothing.
          const failed = outcomes.find((outcome) => !outcome.complete);
          sendResponse({
            success: !failed,
            // Okta's own error summary, the same string the pre-ADR-0040 loader
            // surfaced to the admin. Shown, never logged (docs/security.md).
            error: failed?.error,
            // Counts and completion flags only — the rows themselves are read
            // back from IndexedDB by the panel, never messaged.
            outcomes: outcomes.map((outcome) => ({
              collection: outcome.collection,
              mode: outcome.mode,
              complete: outcome.complete,
              written: outcome.written,
            })),
          });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error?.message || 'Snapshot sync failed' });
        });

      return true; // Keep message channel open for async response

    case 'getSchedulerState':
      // Get current scheduler state
      sendResponse({ success: true, state: globalScheduler.getState() });
      return true;

    case 'getSchedulerMetrics':
      // Get scheduler metrics
      sendResponse({ success: true, metrics: globalScheduler.getMetrics() });
      return true;

    case 'pauseScheduler':
      // Scheduler control is a side-panel-only action — never let a tab pause it.
      if (rejectIfFromTab(sender, 'pauseScheduler', sendResponse)) {
        return true;
      }
      globalScheduler.pause();
      sendResponse({ success: true });
      return true;

    case 'resumeScheduler':
      // Scheduler control is a side-panel-only action — never let a tab resume it.
      if (rejectIfFromTab(sender, 'resumeScheduler', sendResponse)) {
        return true;
      }
      globalScheduler.resume();
      sendResponse({ success: true });
      return true;

    case 'clearSchedulerQueue':
      // Scheduler control is a side-panel-only action — never let a tab clear it.
      if (rejectIfFromTab(sender, 'clearSchedulerQueue', sendResponse)) {
        return true;
      }
      globalScheduler.clearQueue();
      sendResponse({ success: true });
      return true;

    case 'saveTabState':
      // Tab-state persistence belongs to the side panel; a content script must
      // not be able to read or write another tab's UI state.
      if (rejectIfFromTab(sender, 'saveTabState', sendResponse)) {
        return true;
      }
      // Save tab state
      if (!request.tabName || !request.state) {
        sendResponse({ success: false, error: 'Missing tabName or state' });
        return true;
      }

      TabStateManager.saveTabState(request.tabName, request.state, request.options)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });

      return true;

    case 'loadTabState':
      // Tab-state persistence belongs to the side panel; a content script must
      // not be able to read or write another tab's UI state.
      if (rejectIfFromTab(sender, 'loadTabState', sendResponse)) {
        return true;
      }
      // Load tab state
      if (!request.tabName) {
        sendResponse({ success: false, error: 'Missing tabName' });
        return true;
      }

      TabStateManager.loadTabState(request.tabName)
        .then((state) => {
          sendResponse({ success: true, state });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });

      return true;

    case 'clearTabState':
      // Tab-state persistence belongs to the side panel; a content script must
      // not be able to read or write another tab's UI state.
      if (rejectIfFromTab(sender, 'clearTabState', sendResponse)) {
        return true;
      }
      // Clear tab state
      if (!request.tabName) {
        sendResponse({ success: false, error: 'Missing tabName' });
        return true;
      }

      TabStateManager.clearTabState(request.tabName)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });

      return true;

    default:
      // Unknown action - don't handle
      return false;
  }
});

// ============================================================================
// Installation Handler
// ============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  const version = chrome.runtime.getManifest().version;

  if (details.reason === 'install') {
    log.info('Extension installed successfully');

    chrome.storage.sync.set({
      version,
      operationDelay: 100,
      // Write-only: nothing reads this key, so the rename needs no migration.
      // Kept accurate anyway — a stale value here would be the first thing to
      // mislead whoever eventually gives it a reader.
      defaultView: 'home',
    });

    // Set up audit log retention alarm (runs daily at midnight)
    setupAuditRetentionAlarm();
  }

  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    log.info(`Extension updated from ${previousVersion} to ${version}`);

    // Ensure alarm is set up after update
    setupAuditRetentionAlarm();
  }

  // An install or update orphans the content script in every already-open Okta
  // tab (invalidated runtime) without injecting the new one, so the side panel
  // reads "Disconnected" until the user reloads each tab. Re-inject instead.
  // `chrome_update` / `shared_module_update` don't replace our scripts, so they
  // are deliberately skipped. Fire-and-forget: nothing else here depends on it.
  if (details.reason === 'install' || details.reason === 'update') {
    reinjectContentScripts().catch((error) => {
      log.error('Content script re-injection failed', error);
    });
  }

  // Create context menu
  chrome.contextMenus.create({
    id: 'openSidebar',
    title: 'Open Okta Unbound',
    contexts: ['page'],
    documentUrlPatterns: [
      'https://*.okta.com/*',
      'https://*.oktapreview.com/*',
      'https://*.okta-emea.com/*',
    ],
  });
});

// ============================================================================
// Extension Icon Click Handler
// ============================================================================

chrome.action.onClicked.addListener((tab) => {
  log.debug('Extension icon clicked', { tabId: tab.id });

  if (tab.url && isOktaUrl(tab.url)) {
    chrome.sidePanel.open({ windowId: tab.windowId });
    log.debug('Side panel opened');
  } else {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/assets/icons/icon128.png',
      title: 'Okta Unbound',
      message: 'Please navigate to an Okta page to use this extension.',
    });
    log.debug('Notification shown - not on Okta page');
  }
});

// ============================================================================
// Context Menu Handler
// ============================================================================

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openSidebar' && tab?.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId });
    log.debug('Side panel opened from context menu');
  }
});

// ============================================================================
// Audit Log Retention
// ============================================================================

function setupAuditRetentionAlarm(): void {
  // Create alarm to run daily at midnight
  chrome.alarms.create('auditRetentionCleanup', {
    periodInMinutes: 24 * 60, // Every 24 hours
    when: getNextMidnight(),
  });
  log.debug('Audit retention alarm created');
}

function getNextMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return tomorrow.getTime();
}

/**
 * Create the hourly alarm that prunes expired persisted tab states. An alarm
 * (rather than `setInterval`) lets the MV3 service worker suspend between runs.
 */
function setupTabStateCleanupAlarm(): void {
  chrome.alarms.create('tabStateCleanup', { periodInMinutes: 60 });
  log.debug('Tab state cleanup alarm created');
}

// Listen for alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'auditRetentionCleanup') {
    log.debug('Running audit retention cleanup');

    try {
      // Get retention settings
      const settings = await auditStore.getSettings();
      const retentionDays = settings.retentionDays || 90;

      // Clear old logs
      await auditStore.clearOldLogs(retentionDays);

      log.debug('Audit retention cleanup completed', { retentionDays });
    } catch (error) {
      log.error('Audit retention cleanup failed', error);
    }
  }

  if (alarm.name === 'tabStateCleanup') {
    log.debug('Running tab state cleanup');

    try {
      await TabStateManager.cleanupExpiredStates();
      log.debug('Tab state cleanup completed');
    } catch (error) {
      log.error('Failed to cleanup expired tab states', error);
    }
  }
});

// Initialize alarms on service worker start
setupAuditRetentionAlarm();
setupTabStateCleanupAlarm();

// ============================================================================
// Org Snapshot (ADR-0040)
// ============================================================================
// Opportunistic, never truly scheduled: the background cannot fetch Okta, so
// this only notices when a live Okta tab makes a sync *possible*. It registers
// its own `chrome.tabs.onUpdated` and `chrome.alarms` listeners; no new
// permission and no manifest change.
startSnapshotScheduler(globalScheduler);
