// Okta API endpoint definitions
// Provides consistent endpoint patterns for all API calls

const OKTA_API_BASE = '/api/v1';

const endpoints = {
  // Group endpoints
  getGroup: (groupId) => `${OKTA_API_BASE}/groups/${groupId}`,
  getGroupMembers: (groupId, limit = 200) => `${OKTA_API_BASE}/groups/${groupId}/users?limit=${limit}`,
  removeFromGroup: (groupId, userId) => `${OKTA_API_BASE}/groups/${groupId}/users/${userId}`,
  addToGroup: (groupId, userId) => `${OKTA_API_BASE}/groups/${groupId}/users/${userId}`,

  // User endpoints
  getUser: (userId) => `${OKTA_API_BASE}/users/${userId}`,
  getUserGroups: (userId) => `${OKTA_API_BASE}/users/${userId}/groups`,

  // Group rules endpoints (future features)
  getGroupRules: () => `${OKTA_API_BASE}/groups/rules`,
  getGroupRule: (ruleId) => `${OKTA_API_BASE}/groups/rules/${ruleId}`,
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = endpoints;
}
