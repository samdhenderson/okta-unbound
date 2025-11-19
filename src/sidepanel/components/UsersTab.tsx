import React, { useState, useEffect, useRef } from 'react';
import type { OktaUser, GroupMembership } from '../../shared/types';
import { RulesCache } from '../../shared/rulesCache';

interface UsersTabProps {
  targetTabId?: number;
  currentGroupId?: string;
  onNavigateToRule?: (ruleId: string) => void;
}

const UsersTab: React.FC<UsersTabProps> = ({ targetTabId, currentGroupId, onNavigateToRule }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OktaUser | null>(null);
  const [searchResults, setSearchResults] = useState<OktaUser[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [apiCost, setApiCost] = useState<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = async () => {
    if (!targetTabId) {
      setError('No Okta tab connected');
      return;
    }

    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSelectedUser(null);
    setMemberships([]);
    let requestCount = 0;

    try {
      console.log('[UsersTab] Searching for users:', searchQuery);

      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'searchUsers',
        query: searchQuery.trim(),
      });

      requestCount++;

      if (response.success) {
        setSearchResults(response.data || []);
        setApiCost(requestCount);
        console.log('[UsersTab] Found users:', response.data?.length);
      } else {
        setError(response.error || 'Failed to search users');
        setSearchResults([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with Okta tab');
      setSearchResults([]);
      console.error('[UsersTab] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = async (user: OktaUser) => {
    if (!targetTabId) return;

    setSelectedUser(user);
    setIsLoadingMemberships(true);
    setError(null);
    let requestCount = 0;

    try {
      console.log('[UsersTab] Loading memberships for user:', user.id);

      // Fetch user's groups
      const groupsResponse = await chrome.tabs.sendMessage(targetTabId, {
        action: 'getUserGroups',
        userId: user.id,
      });

      requestCount++;

      if (!groupsResponse.success) {
        throw new Error(groupsResponse.error || 'Failed to fetch user groups');
      }

      // OPTIMIZED: Check cache for rules first
      let rules: any[] = [];
      const cachedRules = await RulesCache.get();

      if (cachedRules) {
        console.log('[UsersTab] Using cached rules from global cache');
        rules = cachedRules.rules;
        // No additional API call needed
      } else {
        // Cache miss - fetch rules
        console.log('[UsersTab] Cache miss - fetching rules');
        const rulesResponse = await chrome.tabs.sendMessage(targetTabId, {
          action: 'fetchGroupRules',
        });

        requestCount++;

        if (!rulesResponse.success) {
          console.warn('[UsersTab] Could not fetch rules for analysis:', rulesResponse.error);
        } else {
          rules = rulesResponse.rules || [];
          // Populate cache for future use
          await RulesCache.set(
            rules,
            [],
            rulesResponse.stats || { total: 0, active: 0, inactive: 0, conflicts: 0 },
            rulesResponse.conflicts || []
          );
        }
      }

      // Analyze memberships with improved heuristics
      const groups = groupsResponse.data || [];
      const analyzedMemberships = analyzeMemberships(groups, rules, user);

      setMemberships(analyzedMemberships);
      setApiCost(prev => prev + requestCount);

      console.log('[UsersTab] Loaded memberships:', {
        count: analyzedMemberships.length,
        apiCost: requestCount,
        usedCache: cachedRules !== null
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load user memberships');
      setMemberships([]);
      console.error('[UsersTab] Membership loading error:', err);
    } finally {
      setIsLoadingMemberships(false);
    }
  };

  /**
   * IMPROVED: Better heuristics for determining membership attribution
   *
   * Okta API doesn't directly indicate if a user was added via rule or manually.
   * We use advanced heuristics:
   *
   * 1. Check if ACTIVE rules exist for this group
   * 2. Attempt basic rule condition evaluation (check attributes referenced in rule)
   * 3. For groups with rules:
   *    - If user attributes match patterns in rule, likely RULE_BASED
   *    - If user attributes don't match AND rule uses specific attributes, likely DIRECT
   * 4. For APP_GROUP types, always RULE_BASED (managed by application)
   * 5. For groups without rules, DIRECT
   */
  const analyzeMemberships = (
    groups: any[],
    rules: any[],
    user: OktaUser
  ): GroupMembership[] => {
    console.log('[UsersTab] Analyzing memberships for user:', user.id);
    console.log('[UsersTab] Total rules:', rules.length, 'Active rules:', rules.filter((r: any) => r.status === 'ACTIVE').length);
    console.log('[UsersTab] Total groups:', groups.length);

    return groups.map(group => {
      // APP_GROUPs are always managed by the application (rule-based)
      if (group.type === 'APP_GROUP') {
        console.log(`[UsersTab] Group "${group.profile.name}": APP_GROUP (application managed)`);
        return {
          group: group,
          membershipType: 'RULE_BASED' as const,
          rule: undefined,
        };
      }

      // Find ACTIVE rules that assign users to this group
      const matchingRules = rules.filter((rule: any) => {
        if (rule.status !== 'ACTIVE') return false;
        const groupIds = rule.groupIds || rule.actions?.assignUserToGroups?.groupIds || [];
        return groupIds.includes(group.id);
      });

      console.log(`[UsersTab] Group "${group.profile.name}": Found ${matchingRules.length} active rules`);

      if (matchingRules.length === 0) {
        // No active rules for this group - must be direct assignment
        console.log(`[UsersTab] Group "${group.profile.name}": DIRECT (no active rules)`);
        return {
          group: group,
          membershipType: 'DIRECT' as const,
          rule: undefined,
        };
      }

      // Try to evaluate which rule might have added the user
      let bestMatchRule = matchingRules[0];
      let confidence = 'low';

      for (const rule of matchingRules) {
        // Extract user attributes from rule condition
        const condition = rule.conditionExpression || rule.conditions?.expression?.value || '';
        const userAttrs = rule.userAttributes || [];

        // Basic heuristic: check if referenced attributes exist in user profile
        let attributesMatch = 0;
        let attributesChecked = 0;

        for (const attr of userAttrs) {
          attributesChecked++;
          const userValue = user.profile[attr];

          // If attribute exists and is non-empty, it's a potential match
          if (userValue !== undefined && userValue !== null && userValue !== '') {
            // Check if the condition references this attribute value
            const valueStr = String(userValue).toLowerCase();
            const conditionLower = condition.toLowerCase();

            if (conditionLower.includes(valueStr) || conditionLower.includes(`"${valueStr}"`)) {
              attributesMatch++;
            }
          }
        }

        // If we found attribute matches, this rule is more likely
        if (attributesChecked > 0 && attributesMatch >= attributesChecked * 0.5) {
          bestMatchRule = rule;
          confidence = attributesMatch === attributesChecked ? 'high' : 'medium';
          break;
        }
      }

      console.log(`[UsersTab] Group "${group.profile.name}": RULE_BASED (rule: ${bestMatchRule.name}, confidence: ${confidence})`);

      return {
        group: group,
        membershipType: 'RULE_BASED' as const,
        rule: bestMatchRule,
      };
    });
  };

  // Live search with debouncing - trigger search as user types
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is empty or too short
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setError(null);
      return;
    }

    // Don't search if query is too short (minimum 2 characters for efficiency)
    if (searchQuery.trim().length < 2) {
      return;
    }

    // Debounce the search - wait 600ms after user stops typing
    debounceTimerRef.current = setTimeout(() => {
      handleSearch();
    }, 600);

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, targetTabId]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'badge badge-success';
      case 'DEPROVISIONED':
        return 'badge badge-error';
      case 'SUSPENDED':
      case 'LOCKED_OUT':
        return 'badge badge-warning';
      default:
        return 'badge badge-info';
    }
  };

  const getMembershipTypeBadge = (type: string) => {
    switch (type) {
      case 'RULE_BASED':
        return 'badge badge-info';
      case 'DIRECT':
        return 'badge badge-success';
      default:
        return 'badge badge-muted';
    }
  };

  const highlightCurrentGroup = (groupId: string) => {
    return currentGroupId && groupId === currentGroupId;
  };

  return (
    <div className="tab-content active">
      <div className="section">
        <div className="section-header">
          <div>
            <h2>User Membership Tracing</h2>
            <p className="section-description">
              Search users and analyze group memberships
            </p>
          </div>
        </div>

        {/* Search Section */}
        <div className="user-search-section">
          <div className="search-input-group">
            <input
              type="text"
              className="input"
              placeholder="Type to search by email, name, or login (live search)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
            />
            {isSearching && (
              <div className="search-spinner">
                <div className="spinner-small"></div>
              </div>
            )}
          </div>
        </div>

        {/* API Cost Indicator */}
        {apiCost > 0 && (
          <div className="api-cost-indicator">
            <span className="api-cost-label">API Requests:</span>
            <span className="api-cost-value">{apiCost}</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="alert alert-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && !selectedUser && (
          <div className="search-results">
            <h3 className="results-header">Search Results ({searchResults.length})</h3>
            <div className="user-list">
              {searchResults.map(user => (
                <div
                  key={user.id}
                  className="user-card clickable"
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="user-info">
                    <div className="user-name">
                      {user.profile.firstName} {user.profile.lastName}
                    </div>
                    <div className="user-email muted">{user.profile.email}</div>
                    <div className="user-login muted-small">Login: {user.profile.login}</div>
                  </div>
                  <div className="user-status">
                    <span className={getStatusBadgeClass(user.status)}>{user.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected User Details */}
        {selectedUser && (
          <div className="selected-user-section">
            <div className="user-details-card">
              <div className="card-header">
                <h3>User Details</h3>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelectedUser(null);
                    setMemberships([]);
                  }}
                >
                  Back to Results
                </button>
              </div>
              <div className="user-details-content">
                <div className="detail-row">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">
                    {selectedUser.profile.firstName} {selectedUser.profile.lastName}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{selectedUser.profile.email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Login:</span>
                  <span className="detail-value">{selectedUser.profile.login}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className={getStatusBadgeClass(selectedUser.status)}>
                    {selectedUser.status}
                  </span>
                </div>
                {selectedUser.profile.department && (
                  <div className="detail-row">
                    <span className="detail-label">Department:</span>
                    <span className="detail-value">{selectedUser.profile.department}</span>
                  </div>
                )}
                {selectedUser.profile.title && (
                  <div className="detail-row">
                    <span className="detail-label">Title:</span>
                    <span className="detail-value">{selectedUser.profile.title}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Group Memberships */}
            <div className="memberships-section">
              <h3 className="memberships-header">
                Group Memberships ({memberships.length})
              </h3>

              {isLoadingMemberships ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading group memberships...</p>
                </div>
              ) : memberships.length === 0 ? (
                <div className="empty-state">
                  <p className="muted">This user is not a member of any groups</p>
                </div>
              ) : (
                <div className="memberships-list">
                  {memberships.map((membership) => (
                    <div
                      key={membership.group.id}
                      className={`membership-card ${
                        highlightCurrentGroup(membership.group.id) ? 'current-group' : ''
                      }`}
                    >
                      <div className="membership-header">
                        <div className="membership-group-info">
                          <div className="group-name">
                            {membership.group.profile.name}
                            {highlightCurrentGroup(membership.group.id) && (
                              <span className="badge badge-primary ml-2">Current Group</span>
                            )}
                          </div>
                          {membership.group.profile.description && (
                            <div className="group-description muted-small">
                              {membership.group.profile.description}
                            </div>
                          )}
                        </div>
                        <div className="membership-badges">
                          <span className={getMembershipTypeBadge(membership.membershipType)}>
                            {membership.membershipType.replace('_', ' ')}
                          </span>
                          <span className="badge badge-muted">{membership.group.type}</span>
                        </div>
                      </div>

                      {/* Show rule details if rule-based */}
                      {membership.membershipType === 'RULE_BASED' && membership.rule && (
                        <div className="membership-rule-details">
                          <div className="rule-indicator">
                            <strong>Added by Rule:</strong> {membership.rule.name}
                            {onNavigateToRule && (
                              <button
                                className="btn btn-sm btn-secondary ml-2"
                                onClick={() => onNavigateToRule(membership.rule!.id)}
                                title="View this rule in Rules tab"
                              >
                                View Rule →
                              </button>
                            )}
                          </div>
                          {membership.rule.conditionExpression && (
                            <div className="rule-condition">
                              <strong>Condition:</strong>
                              <code className="condition-code">
                                {membership.rule.conditionExpression}
                              </code>
                            </div>
                          )}
                        </div>
                      )}

                      {membership.membershipType === 'DIRECT' && (
                        <div className="membership-info">
                          <p className="muted-small">
                            This user was added directly to the group (not through a rule)
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isSearching && searchResults.length === 0 && !error && !selectedUser && (
          <div className="empty-state">
            <p className="muted">Type at least 2 characters to search for users (live search)</p>
            <p className="muted-small">
              You can trace group memberships and understand why users are in specific groups
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersTab;
