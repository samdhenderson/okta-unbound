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
 * @see {@link module:shared/scheduler/apiScheduler|ApiScheduler} for rate limiting details
 * @see {@link module:shared/tabState/tabStateManager|TabStateManager} for state persistence
 * @see {@link module:shared/storage/auditStore|AuditStore} for audit logging
 */

// Background service worker for Okta Unbound extension
import { auditStore } from '../shared/storage/auditStore';
import { ApiScheduler } from '../shared/scheduler/apiScheduler';
import { TabStateManager } from '../shared/tabState/tabStateManager';
import type { SchedulerState } from '../shared/scheduler/types';

console.log('[Background] Service worker started');

// ============================================================================
// Global API Scheduler
// ============================================================================

// Initialize the global API scheduler
const globalScheduler = new ApiScheduler({
  maxConcurrent: 3,
  minRemainingThreshold: 10, // Cooldown at 10% remaining
  cooldownDuration: 60000, // 60 seconds
  retryDelay: 2000,
  maxRetries: 3,
  requestTimeout: 30000,
});

console.log('[Background] Global API scheduler initialized');

// Broadcast scheduler state changes to all sidepanel instances
globalScheduler.onStateChange((state: SchedulerState) => {
  // Broadcast to all extension contexts
  chrome.runtime.sendMessage({
    action: 'schedulerStateChanged',
    state,
  }).catch(() => {
    // Ignore errors if no listeners (sidepanel not open)
  });
});

// Cleanup expired tab states periodically (every hour)
setInterval(() => {
  TabStateManager.cleanupExpiredStates().catch((err) => {
    console.error('[Background] Failed to cleanup expired tab states:', err);
  });
}, 60 * 60 * 1000);

// ============================================================================
// Message Handlers for Scheduler and Tab State
// ============================================================================

chrome.runtime.onMessage.addListener(
  (request, _sender, sendResponse) => {
    console.log('[Background] Received message:', request.action);

    switch (request.action) {
      case 'scheduleApiRequest':
        // Schedule an API request through the global scheduler
        if (!request.endpoint || !request.tabId) {
          sendResponse({ success: false, error: 'Missing endpoint or tabId' });
          return true;
        }

        globalScheduler
          .scheduleRequest(
            request.endpoint,
            request.method || 'GET',
            request.body,
            request.tabId,
            request.priority || 'normal'
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

      case 'getSchedulerState':
        // Get current scheduler state
        sendResponse({ success: true, state: globalScheduler.getState() });
        return true;

      case 'getSchedulerMetrics':
        // Get scheduler metrics
        sendResponse({ success: true, metrics: globalScheduler.getMetrics() });
        return true;

      case 'pauseScheduler':
        // Pause the scheduler
        globalScheduler.pause();
        sendResponse({ success: true });
        return true;

      case 'resumeScheduler':
        // Resume the scheduler
        globalScheduler.resume();
        sendResponse({ success: true });
        return true;

      case 'clearSchedulerQueue':
        // Clear the scheduler queue
        globalScheduler.clearQueue();
        sendResponse({ success: true });
        return true;

      case 'saveTabState':
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
  }
);

// ============================================================================
// Installation Handler
// ============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Background] Extension installed successfully');

    chrome.storage.sync.set({
      version: '0.3.0',
      operationDelay: 100,
      defaultView: 'operations',
    });

    // Set up audit log retention alarm (runs daily at midnight)
    setupAuditRetentionAlarm();
  }

  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    console.log(`[Background] Extension updated from ${previousVersion} to 0.3.0`);

    // Ensure alarm is set up after update
    setupAuditRetentionAlarm();
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
  console.log('[Background] Extension icon clicked for tab:', tab.id);

  if (tab.url && isOktaUrl(tab.url)) {
    chrome.sidePanel.open({ windowId: tab.windowId });
    console.log('[Background] Side panel opened');
  } else {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/assets/icons/icon128.png',
      title: 'Okta Unbound',
      message: 'Please navigate to an Okta page to use this extension.',
    });
    console.log('[Background] Notification shown - not on Okta page');
  }
});

// ============================================================================
// Context Menu Handler
// ============================================================================

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openSidebar' && tab?.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId });
    console.log('[Background] Side panel opened from context menu');
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
  console.log('[Background] Audit retention alarm created');
}

function getNextMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return tomorrow.getTime();
}

// Listen for alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'auditRetentionCleanup') {
    console.log('[Background] Running audit retention cleanup...');

    try {
      // Get retention settings
      const settings = await auditStore.getSettings();
      const retentionDays = settings.retentionDays || 90;

      // Clear old logs
      await auditStore.clearOldLogs(retentionDays);

      console.log(`[Background] Audit retention cleanup completed (${retentionDays} days retention)`);
    } catch (error) {
      console.error('[Background] Audit retention cleanup failed:', error);
    }
  }
});

// ============================================================================
// Utility Functions
// ============================================================================

function isOktaUrl(url: string): boolean {
  return (
    url.includes('okta.com') ||
    url.includes('oktapreview.com') ||
    url.includes('okta-emea.com')
  );
}

// Initialize alarm on service worker start
setupAuditRetentionAlarm();
