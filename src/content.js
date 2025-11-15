// Content script that runs on Okta pages
// This script can access the DOM and make authenticated requests
// Core modules are loaded first by manifest.json: SessionManager, OktaApiClient, etc.

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Received message:', {
    action: request.action,
    from: sender.id,
    timestamp: new Date().toISOString()
  });

  if (request.action === 'getGroupInfo') {
    console.log('[Content] Processing getGroupInfo request');
    getGroupInfo().then(result => {
      console.log('[Content] getGroupInfo result:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('[Content] getGroupInfo error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'makeApiRequest') {
    console.log('[Content] Processing makeApiRequest:', request.endpoint);
    makeApiRequest(request.endpoint, request.method, request.body).then(result => {
      console.log('[Content] makeApiRequest result:', {
        success: result.success,
        status: result.status
      });
      sendResponse(result);
    }).catch(error => {
      console.error('[Content] makeApiRequest error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'exportGroupMembers') {
    console.log('[Content] Processing exportGroupMembers request');
    handleExportRequest(request).then(sendResponse).catch(error => {
      console.error('[Content] exportGroupMembers error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'fetchGroupRules') {
    console.log('[Content] Processing fetchGroupRules request');
    handleFetchRulesRequest(request).then(sendResponse).catch(error => {
      console.error('[Content] fetchGroupRules error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  console.warn('[Content] Unknown action:', request.action);
});

// Handle export request
async function handleExportRequest(request) {
  try {
    const { groupId, groupName, format, statusFilter } = request;

    const apiClient = new OktaApiClient(SessionManager);
    const exporter = new GroupExporter(apiClient, PaginationHelper, ExportFormatter);

    const result = await exporter.exportGroupMembers(
      groupId,
      groupName.replace(/[^a-zA-Z0-9]/g, '_'),
      format,
      {
        statusFilter: statusFilter || null,
        onProgress: (progress) => {
          console.log('Export progress:', progress);
        }
      }
    );

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Extract group information from the current page
async function getGroupInfo() {
  try {
    const url = window.location.href;
    console.log('[Content] getGroupInfo - Current URL:', url);

    const groupId = extractGroupIdFromUrl(url);
    console.log('[Content] Extracted groupId:', groupId);

    if (!groupId) {
      console.warn('[Content] No groupId found in URL');
      return {
        success: false,
        error: 'Not on a group page. Please navigate to a specific group page.'
      };
    }

    let groupName = extractGroupNameFromPage();
    console.log('[Content] Extracted groupName from page:', groupName);

    // If we still don't have the name, try to fetch it via API
    if (!groupName) {
      console.log('[Content] Fetching group name from API...');
      try {
        const groupData = await makeApiRequest(`/api/v1/groups/${groupId}`, 'GET');
        if (groupData.success && groupData.data.profile) {
          groupName = groupData.data.profile.name;
          console.log('[Content] Fetched groupName from API:', groupName);
        }
      } catch (e) {
        console.warn('[Content] Failed to fetch group name from API:', e);
        // Continue without name
      }
    }

    const result = {
      success: true,
      groupId: groupId,
      groupName: groupName || 'Unknown'
    };
    console.log('[Content] getGroupInfo result:', result);
    return result;

  } catch (error) {
    console.error('[Content] getGroupInfo error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper functions using utility modules where available
function extractGroupIdFromUrl(url) {
  const match1 = url.match(/\/admin\/group\/([a-zA-Z0-9]+)/);
  if (match1) return match1[1];

  const match2 = url.match(/\/groups\/([a-zA-Z0-9]+)/);
  if (match2) return match2[1];

  return null;
}

function extractGroupNameFromPage() {
  const nameSelectors = [
    'h1[data-se="group-name"]',
    '.group-profile-header h1',
    '[data-se="group-detail-name"]',
    'h1.okta-form-title',
    '.content-container h1'
  ];

  for (const selector of nameSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent.trim();
    }
  }

  return null;
}

// Make an authenticated API request using the existing Okta session
async function makeApiRequest(endpoint, method = 'GET', body = null) {
  console.log('[Content] makeApiRequest called:', { endpoint, method, hasBody: !!body });
  try {
    const url = window.location.origin + endpoint;

    // Extract XSRF token from hidden span element in the page
    const xsrfTokenElement = document.getElementById('_xsrfToken');
    const xsrfToken = xsrfTokenElement ? xsrfTokenElement.textContent : '';
    console.log('[Content] XSRF token check:', {
      elementExists: !!xsrfTokenElement,
      tokenLength: xsrfToken.length,
      tokenPreview: xsrfToken ? xsrfToken.substring(0, 20) + '...' : 'none'
    });
    
    const options = {
      method: method,
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include', // Include cookies for authentication (includes JSESSIONID)
      cache: 'no-store', // Prevent caching
      mode: 'cors', // Explicitly set CORS mode
      redirect: 'follow' // Follow redirects
    };
    
    // Add XSRF token if available
    if (xsrfToken) {
      options.headers['X-Okta-Xsrftoken'] = xsrfToken;
    }
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
      // Content-Length is automatically set by the browser based on body
    }
    
    console.log('[Content] Making Okta API request:', {
      url: url,
      method: method,
      headers: options.headers,
      credentials: options.credentials,
      cache: options.cache,
      xsrfTokenFound: !!xsrfToken,
      xsrfTokenLength: xsrfToken.length
    });

    console.log('[Content] About to call fetch() - check Network tab now');
    const response = await fetch(url, options);
    console.log('[Content] fetch() completed');

    console.log('[Content] Okta API response:', {
      url: url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Array.from(response.headers.entries())
    });
    
    // Get response headers
    // Note: Okta returns multiple Link headers (one for self, one for next)
    // The Headers API combines them with commas
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // For DELETE requests, empty response is success
    if (method === 'DELETE' && response.ok) {
      return {
        success: true,
        data: null,
        headers: headers,
        status: response.status
      };
    }
    
    // Try to parse JSON response
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (e) {
        // Response might be empty or not JSON
      }
    }
    
    if (!response.ok) {
      return {
        success: false,
        error: data?.errorSummary || data?.message || `Request failed with status ${response.status}`,
        status: response.status,
        data: data
      };
    }
    
    return {
      success: true,
      data: data,
      headers: headers,
      status: response.status
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Handle fetch rules request
async function handleFetchRulesRequest(request) {
  try {
    const apiClient = new OktaApiClient(SessionManager);
    const inspector = new RuleInspector(apiClient, PaginationHelper);

    const result = await inspector.fetchAllRules(progress => {
      console.log('Fetch rules progress:', progress);
    });

    if (result.success) {
      const stats = inspector.getRuleStats();
      const formattedRules = result.rules.map(rule => inspector.formatRuleForDisplay(rule));

      return {
        success: true,
        rules: formattedRules,
        stats: stats
      };
    } else {
      return result;
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Inject a visual indicator that the extension is active
function injectIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'okta-extension-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #007aff;
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
  
  // Remove after 3 seconds
  document.body.appendChild(indicator);
  setTimeout(() => {
    indicator.style.transition = 'opacity 0.3s';
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  }, 3000);
}

// Initialize when content script loads
console.log('[Content] Content script loaded', {
  url: window.location.href,
  readyState: document.readyState,
  timestamp: new Date().toISOString()
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Content] DOMContentLoaded fired');
    injectIndicator();
  });
} else {
  console.log('[Content] DOM already loaded, injecting indicator');
  injectIndicator();
}
