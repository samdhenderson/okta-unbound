// Background service worker for Okta Unbound extension

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
  }

  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    console.log(`[Background] Extension updated from ${previousVersion} to 0.3.0`);
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
// Utility Functions
// ============================================================================

function isOktaUrl(url: string): boolean {
  return (
    url.includes('okta.com') ||
    url.includes('oktapreview.com') ||
    url.includes('okta-emea.com')
  );
}
