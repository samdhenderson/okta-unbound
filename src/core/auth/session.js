// Authentication utilities
// Handles XSRF token extraction from Okta pages

class SessionManager {
  // Extract XSRF token from the page DOM
  static getXsrfToken() {
    const xsrfElement = document.getElementById('_xsrfToken');
    return xsrfElement ? xsrfElement.textContent : '';
  }

  // Check if XSRF token is available
  static hasXsrfToken() {
    return !!this.getXsrfToken();
  }

  // Build authentication headers for API requests
  static buildAuthHeaders(xsrfToken) {
    const headers = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (xsrfToken) {
      headers['X-Okta-Xsrftoken'] = xsrfToken;
    }

    return headers;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionManager;
}
