// Background service worker for the extension
// Handles background tasks and manages extension state

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Okta Unbound extension installed');
  } else if (details.reason === 'update') {
    console.log('Okta Unbound extension updated');
  }
  
  // Create context menu items on install/update
  try {
    chrome.contextMenus.create({
      id: 'okta-remove-deactivated',
      title: 'Remove Deactivated Users',
      contexts: ['page'],
      documentUrlPatterns: [
        'https://*.okta.com/*',
        'https://*.oktapreview.com/*',
        'https://*.okta-emea.com/*'
      ]
    });
  } catch (e) {
    // Context menu might already exist, ignore error
    console.log('Context menu creation skipped:', e.message);
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle any background tasks here if needed
  return true;
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'okta-remove-deactivated') {
    // Open the popup or trigger the action
    chrome.action.openPopup();
  }
});
