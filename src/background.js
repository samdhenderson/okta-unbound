// Background service worker for Okta Unbound extension

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Okta Unbound installed successfully');

    // Set default preferences
    chrome.storage.sync.set({
      version: '0.2.0',
      operationDelay: 100,
      defaultView: 'operations'
    });
  }

  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    console.log(`Okta Unbound updated from ${previousVersion} to 0.2.0`);
  }
});

// Open sidebar when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  // Check if we're on an Okta page
  if (tab.url && (
    tab.url.includes('okta.com') ||
    tab.url.includes('oktapreview.com') ||
    tab.url.includes('okta-emea.com')
  )) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  } else {
    // Show notification if not on Okta page
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/assets/icons/icon128.png',
      title: 'Okta Unbound',
      message: 'Please navigate to an Okta page to use this extension.'
    });
  }
});

// Context menu for quick access (optional enhancement)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'openSidebar',
    title: 'Open Okta Unbound',
    contexts: ['page'],
    documentUrlPatterns: [
      'https://*.okta.com/*',
      'https://*.oktapreview.com/*',
      'https://*.okta-emea.com/*'
    ]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openSidebar') {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
