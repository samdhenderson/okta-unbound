// Background service worker for Okta Unbound extension
import { auditStore } from '../shared/storage/auditStore';

console.log('[Background] Service worker started');

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
