// Okta API Client
// Handles all API communication with proper authentication and error handling

class OktaApiClient {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.baseUrl = window.location.origin;
  }

  // Make an authenticated API request
  async makeRequest(endpoint, method = 'GET', body = null) {
    try {
      const url = this.baseUrl + endpoint;
      const xsrfToken = this.sessionManager.getXsrfToken();

      const options = {
        method: method,
        headers: this.sessionManager.buildAuthHeaders(xsrfToken),
        credentials: 'include',
        cache: 'no-store',
        mode: 'cors',
        redirect: 'follow'
      };

      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      console.log('Making Okta API request:', {
        url,
        method,
        xsrfTokenFound: !!xsrfToken
      });

      const response = await fetch(url, options);

      console.log('Okta API response:', {
        url,
        status: response.status,
        ok: response.ok
      });

      return this._handleResponse(response, method);

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Handle API response and parse data
  async _handleResponse(response, method) {
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

    // Parse JSON response
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
  }

  // Convenience methods for common operations
  async getGroupDetails(groupId) {
    return this.makeRequest(`/api/v1/groups/${groupId}`);
  }

  async removeUserFromGroup(groupId, userId) {
    return this.makeRequest(`/api/v1/groups/${groupId}/users/${userId}`, 'DELETE');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OktaApiClient;
}
