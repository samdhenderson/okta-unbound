// Content script that runs on Okta pages
// This script can access the DOM and make authenticated requests

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getGroupInfo') {
    getGroupInfo().then(sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'makeApiRequest') {
    makeApiRequest(request.endpoint, request.method, request.body).then(sendResponse);
    return true;
  }
});

// Extract group information from the current page
async function getGroupInfo() {
  try {
    // Get group ID from URL
    const url = window.location.href;
    let groupId = null;
    let groupName = null;
    
    // Try to extract group ID from URL patterns
    // Pattern 1: /admin/group/{groupId}
    const match1 = url.match(/\/admin\/group\/([a-zA-Z0-9]+)/);
    if (match1) {
      groupId = match1[1];
    }
    
    // Pattern 2: /groups/{groupId}
    const match2 = url.match(/\/groups\/([a-zA-Z0-9]+)/);
    if (match2) {
      groupId = match2[1];
    }
    
    if (!groupId) {
      return {
        success: false,
        error: 'Not on a group page. Please navigate to a specific group page.'
      };
    }
    
    // Try to get group name from the page
    // This selector may need adjustment based on Okta's UI version
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
        groupName = element.textContent.trim();
        break;
      }
    }
    
    // If we still don't have the name, try to fetch it via API
    if (!groupName) {
      try {
        const groupData = await makeApiRequest(`/api/v1/groups/${groupId}`, 'GET');
        if (groupData.success && groupData.data.profile) {
          groupName = groupData.data.profile.name;
        }
      } catch (e) {
        // Continue without name
      }
    }
    
    return {
      success: true,
      groupId: groupId,
      groupName: groupName || 'Unknown'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Make an authenticated API request using the existing Okta session
async function makeApiRequest(endpoint, method = 'GET', body = null) {
  try {
    const url = window.location.origin + endpoint;
    
    // Extract XSRF token from hidden span element in the page
    const xsrfTokenElement = document.getElementById('_xsrfToken');
    const xsrfToken = xsrfTokenElement ? xsrfTokenElement.textContent : '';
    
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
    
    console.log('Making Okta API request:', {
      url: url,
      method: method,
      headers: options.headers,
      credentials: options.credentials,
      cache: options.cache,
      xsrfTokenFound: !!xsrfToken,
      xsrfTokenLength: xsrfToken.length
    });
    
    const response = await fetch(url, options);
    
    console.log('Okta API response:', {
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
  indicator.textContent = '🔧 Okta Manager Active';
  
  // Remove after 3 seconds
  document.body.appendChild(indicator);
  setTimeout(() => {
    indicator.style.transition = 'opacity 0.3s';
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  }, 3000);
}

// Initialize when content script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectIndicator);
} else {
  injectIndicator();
}
