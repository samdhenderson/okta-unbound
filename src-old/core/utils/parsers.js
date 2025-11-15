// Parsing utilities for extracting data from URLs and responses

class ParserUtils {
  // Extract group ID from Okta URL patterns
  static extractGroupId(url) {
    // Pattern 1: /admin/group/{groupId}
    const match1 = url.match(/\/admin\/group\/([a-zA-Z0-9]+)/);
    if (match1) {
      return match1[1];
    }

    // Pattern 2: /groups/{groupId}
    const match2 = url.match(/\/groups\/([a-zA-Z0-9]+)/);
    if (match2) {
      return match2[1];
    }

    return null;
  }

  // Validate Okta group ID format
  static isValidGroupId(groupId) {
    if (!groupId || typeof groupId !== 'string') {
      return false;
    }
    // Okta group IDs are 20 character alphanumeric starting with 00g
    return /^00g[a-zA-Z0-9]{17}$/.test(groupId);
  }

  // Extract group name from page using various selectors
  static extractGroupNameFromPage() {
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ParserUtils;
}
