import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { OktaUser, GroupMembership } from '../../shared/types';
import { RulesCache } from '../../shared/rulesCache';
import { useUserContext } from '../hooks/useUserContext';

// Helper to format dates in a readable way
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

// Helper to calculate relative time (e.g., "3 days ago")
const getRelativeTime = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return null;
  }
};

// Fields to explicitly exclude from display (security sensitive)
const EXCLUDED_PROFILE_FIELDS = new Set([
  'securityQuestion',
  'securityQuestionAnswer',
  'security_question',
  'security_answer',
  'recoveryQuestion',
  'recoveryAnswer',
  'password',
  'credentials',
]);

interface UsersTabProps {
  targetTabId?: number;
  currentGroupId?: string;
  onNavigateToRule?: (ruleId: string) => void;
}

// Collapsible section component
interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  itemCount?: number;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultOpen = true,
  children,
  itemCount,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`collapsible-section ${isOpen ? 'open' : 'collapsed'}`}>
      <button
        className="collapsible-header"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="collapsible-icon">{isOpen ? '▼' : '▶'}</span>
        <span className="collapsible-title">{title}</span>
        {itemCount !== undefined && (
          <span className="collapsible-count">{itemCount}</span>
        )}
      </button>
      {isOpen && <div className="collapsible-content">{children}</div>}
    </div>
  );
};

const UsersTab: React.FC<UsersTabProps> = ({ targetTabId, currentGroupId, onNavigateToRule }) => {
  const { userInfo, isLoading: isLoadingUserContext, oktaOrigin } = useUserContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OktaUser | null>(null);
  const [searchResults, setSearchResults] = useState<OktaUser[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [apiCost, setApiCost] = useState<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasAutoLoadedUser, setHasAutoLoadedUser] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async () => {
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
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to communicate with Okta tab');
      setSearchResults([]);
      console.error('[UsersTab] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [targetTabId, searchQuery]);

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
  }, [searchQuery, targetTabId, handleSearch]);

  // Auto-load detected user from page context
  useEffect(() => {
    if (!targetTabId || isLoadingUserContext) return;
    if (!userInfo?.userId) {
      // Not on a user page - reset auto-load state
      if (hasAutoLoadedUser) {
        setHasAutoLoadedUser(null);
      }
      return;
    }

    // Only auto-load if we haven't already loaded this user
    if (hasAutoLoadedUser === userInfo.userId) return;

    const autoLoadUser = async () => {
      console.log('[UsersTab] Auto-loading detected user:', userInfo.userId);
      setHasAutoLoadedUser(userInfo.userId);
      setIsLoadingMemberships(true);
      setError(null);
      setSearchResults([]); // Clear search results when auto-loading
      setSearchQuery(''); // Clear search query

      try {
        // First fetch user details
        const userResponse = await chrome.tabs.sendMessage(targetTabId, {
          action: 'getUserDetails',
          userId: userInfo.userId,
        });

        if (!userResponse.success) {
          throw new Error(userResponse.error || 'Failed to fetch user details');
        }

        const user: OktaUser = userResponse.data;
        setSelectedUser(user);

        // Then fetch groups (same logic as handleSelectUser)
        const groupsResponse = await chrome.tabs.sendMessage(targetTabId, {
          action: 'getUserGroups',
          userId: user.id,
        });

        if (!groupsResponse.success) {
          throw new Error(groupsResponse.error || 'Failed to fetch user groups');
        }

        // Check cache for rules
        let rules: any[] = [];
        const cachedRules = await RulesCache.get();

        if (cachedRules) {
          rules = cachedRules.rules;
        } else {
          const rulesResponse = await chrome.tabs.sendMessage(targetTabId, {
            action: 'fetchGroupRules',
          });
          if (rulesResponse.success) {
            rules = rulesResponse.rules || [];
            await RulesCache.set(
              rules,
              [],
              rulesResponse.stats || { total: 0, active: 0, inactive: 0, conflicts: 0 },
              rulesResponse.conflicts || []
            );
          }
        }

        const groups = groupsResponse.data || [];
        const analyzedMemberships = analyzeMemberships(groups, rules, user);
        setMemberships(analyzedMemberships);
      } catch (err: any) {
        setError(err.message || 'Failed to load detected user');
        setSelectedUser(null);
        setMemberships([]);
      } finally {
        setIsLoadingMemberships(false);
      }
    };

    autoLoadUser();
  }, [userInfo?.userId, targetTabId, isLoadingUserContext, hasAutoLoadedUser]);

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

  // Clear search and reset to initial state
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setMemberships([]);
    setHasAutoLoadedUser(null);
    setError(null);
    searchInputRef.current?.focus();
  };

  return (
    <div className="tab-content active">
      <div className="section">
        {/* Search Section - Always at the very top */}
        <div className="user-search-container">
          <div className="user-search-row">
            <div className="user-search-input-wrapper">
              <input
                ref={searchInputRef}
                type="text"
                className="input user-search-input"
                placeholder="Search by email, name, or login..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {(searchQuery || selectedUser) && (
                <button
                  className="user-search-clear-btn"
                  onClick={handleClearSearch}
                  title="Clear search"
                  type="button"
                >
                  &times;
                </button>
              )}
              {isSearching && (
                <div className="user-search-spinner">
                  <div className="spinner-small"></div>
                </div>
              )}
            </div>
            {oktaOrigin && selectedUser && (
              <a
                href={`${oktaOrigin}/admin/user/profile/view/${selectedUser.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary user-search-action-btn"
                title="Open user in Okta Admin"
              >
                Open in Okta
              </a>
            )}
          </div>
          {/* Detected user hint - subtle, non-intrusive */}
          {userInfo && !selectedUser && !searchQuery && (
            <div className="user-detected-hint">
              Detected: <strong>{userInfo.userName}</strong>
              {userInfo.userStatus && (
                <span className={`badge badge-sm ml-2 ${
                  userInfo.userStatus === 'ACTIVE' ? 'badge-success' :
                  userInfo.userStatus === 'DEPROVISIONED' ? 'badge-error' : 'badge-warning'
                }`}>
                  {userInfo.userStatus}
                </span>
              )}
            </div>
          )}
        </div>

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

        {/* Selected User Details - Positioned directly under search */}
        {selectedUser && (
          <div className="selected-user-section">
            {/* Compact User ID Card */}
            <div className="user-id-card compact">
              <div className="user-id-card-header">
                <div className="user-avatar">
                  {selectedUser.profile.firstName?.[0]?.toUpperCase() || '?'}
                  {selectedUser.profile.lastName?.[0]?.toUpperCase() || ''}
                </div>
                <div className="user-id-card-info">
                  <h2 className="user-id-card-name">
                    {selectedUser.profile.firstName} {selectedUser.profile.lastName}
                  </h2>
                  <div className="user-id-card-title">
                    {selectedUser.profile.title && (
                      <span>{selectedUser.profile.title}</span>
                    )}
                    {selectedUser.profile.title && selectedUser.profile.department && (
                      <span className="user-id-card-separator">•</span>
                    )}
                    {selectedUser.profile.department && (
                      <span>{selectedUser.profile.department}</span>
                    )}
                  </div>
                  <div className="user-id-card-email">{selectedUser.profile.email}</div>
                  {selectedUser.profile.genderPronouns && (
                    <div className="user-id-card-pronouns">{selectedUser.profile.genderPronouns}</div>
                  )}
                </div>
                <div className="user-id-card-status">
                  <span className={getStatusBadgeClass(selectedUser.status)}>
                    {selectedUser.status}
                  </span>
                </div>
              </div>
              <div className="user-id-card-meta">
                <div className="user-id-card-meta-item">
                  <span className="meta-label">Last Login</span>
                  <span className="meta-value">
                    {selectedUser.lastLogin
                      ? getRelativeTime(selectedUser.lastLogin) || formatDate(selectedUser.lastLogin)
                      : 'Never'}
                  </span>
                </div>
                <div className="user-id-card-meta-item">
                  <span className="meta-label">Created</span>
                  <span className="meta-value">
                    {getRelativeTime(selectedUser.created) || formatDate(selectedUser.created)}
                  </span>
                </div>
                <div className="user-id-card-meta-item">
                  <span className="meta-label">Groups</span>
                  <span className="meta-value">{memberships.length}</span>
                </div>
              </div>
            </div>

            {/* Collapsible Details Sections */}
            <div className="user-details-sections">
              {/* Account Details */}
              <CollapsibleSection title="Account Details" defaultOpen={false}>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Login</span>
                    <span className="detail-value">{selectedUser.profile.login}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">User ID</span>
                    <span className="detail-value detail-value-mono">{selectedUser.id}</span>
                  </div>
                  {selectedUser.profile.secondEmail && (
                    <div className="detail-item">
                      <span className="detail-label">Secondary Email</span>
                      <span className="detail-value">{selectedUser.profile.secondEmail}</span>
                    </div>
                  )}
                  {selectedUser.activated && (
                    <div className="detail-item">
                      <span className="detail-label">Activated</span>
                      <span className="detail-value">{formatDate(selectedUser.activated)}</span>
                    </div>
                  )}
                  {selectedUser.statusChanged && (
                    <div className="detail-item">
                      <span className="detail-label">Status Changed</span>
                      <span className="detail-value">{formatDate(selectedUser.statusChanged)}</span>
                    </div>
                  )}
                  {selectedUser.passwordChanged && (
                    <div className="detail-item">
                      <span className="detail-label">Password Changed</span>
                      <span className="detail-value">{formatDate(selectedUser.passwordChanged)}</span>
                    </div>
                  )}
                  {selectedUser.lastUpdated && (
                    <div className="detail-item">
                      <span className="detail-label">Profile Updated</span>
                      <span className="detail-value">{formatDate(selectedUser.lastUpdated)}</span>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* Organization - only show if any org fields exist */}
              {(selectedUser.profile.title ||
                selectedUser.profile.department ||
                selectedUser.profile.division ||
                selectedUser.profile.organization ||
                selectedUser.profile.manager ||
                selectedUser.profile.costCenter ||
                selectedUser.profile.employeeNumber ||
                selectedUser.profile.userType) && (
                <CollapsibleSection title="Organization" defaultOpen={false}>
                  <div className="detail-grid">
                    {selectedUser.profile.title && (
                      <div className="detail-item">
                        <span className="detail-label">Title</span>
                        <span className="detail-value">{selectedUser.profile.title}</span>
                      </div>
                    )}
                    {selectedUser.profile.department && (
                      <div className="detail-item">
                        <span className="detail-label">Department</span>
                        <span className="detail-value">{selectedUser.profile.department}</span>
                      </div>
                    )}
                    {selectedUser.profile.division && (
                      <div className="detail-item">
                        <span className="detail-label">Division</span>
                        <span className="detail-value">{selectedUser.profile.division}</span>
                      </div>
                    )}
                    {selectedUser.profile.organization && (
                      <div className="detail-item">
                        <span className="detail-label">Organization</span>
                        <span className="detail-value">{selectedUser.profile.organization}</span>
                      </div>
                    )}
                    {selectedUser.profile.manager && (
                      <div className="detail-item">
                        <span className="detail-label">Manager</span>
                        <span className="detail-value">{selectedUser.profile.manager}</span>
                      </div>
                    )}
                    {selectedUser.profile.costCenter && (
                      <div className="detail-item">
                        <span className="detail-label">Cost Center</span>
                        <span className="detail-value">{selectedUser.profile.costCenter}</span>
                      </div>
                    )}
                    {selectedUser.profile.employeeNumber && (
                      <div className="detail-item">
                        <span className="detail-label">Employee #</span>
                        <span className="detail-value">{selectedUser.profile.employeeNumber}</span>
                      </div>
                    )}
                    {selectedUser.profile.userType && (
                      <div className="detail-item">
                        <span className="detail-label">User Type</span>
                        <span className="detail-value">{selectedUser.profile.userType}</span>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Contact - only show if any contact fields exist */}
              {(selectedUser.profile.mobilePhone ||
                selectedUser.profile.primaryPhone ||
                selectedUser.profile.streetAddress ||
                selectedUser.profile.city ||
                selectedUser.profile.state ||
                selectedUser.profile.zipCode ||
                selectedUser.profile.countryCode) && (
                <CollapsibleSection title="Contact" defaultOpen={false}>
                  <div className="detail-grid">
                    {selectedUser.profile.primaryPhone && (
                      <div className="detail-item">
                        <span className="detail-label">Phone</span>
                        <span className="detail-value">{selectedUser.profile.primaryPhone}</span>
                      </div>
                    )}
                    {selectedUser.profile.mobilePhone && (
                      <div className="detail-item">
                        <span className="detail-label">Mobile</span>
                        <span className="detail-value">{selectedUser.profile.mobilePhone}</span>
                      </div>
                    )}
                    {(selectedUser.profile.streetAddress ||
                      selectedUser.profile.city ||
                      selectedUser.profile.state) && (
                      <div className="detail-item detail-item-full">
                        <span className="detail-label">Location</span>
                        <span className="detail-value">
                          {[
                            selectedUser.profile.streetAddress,
                            selectedUser.profile.city,
                            selectedUser.profile.state,
                            selectedUser.profile.zipCode,
                            selectedUser.profile.countryCode,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Preferences - only show if any exist */}
              {(selectedUser.profile.locale || selectedUser.profile.timezone) && (
                <CollapsibleSection title="Preferences" defaultOpen={false}>
                  <div className="detail-grid">
                    {selectedUser.profile.locale && (
                      <div className="detail-item">
                        <span className="detail-label">Locale</span>
                        <span className="detail-value">{selectedUser.profile.locale}</span>
                      </div>
                    )}
                    {selectedUser.profile.timezone && (
                      <div className="detail-item">
                        <span className="detail-label">Timezone</span>
                        <span className="detail-value">{selectedUser.profile.timezone}</span>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Custom Attributes - show any non-standard profile fields */}
              {(() => {
                const standardFields = new Set([
                  'login', 'email', 'firstName', 'lastName', 'secondEmail',
                  'mobilePhone', 'primaryPhone', 'streetAddress', 'city', 'state',
                  'zipCode', 'countryCode', 'department', 'title', 'manager',
                  'managerId', 'division', 'organization', 'costCenter',
                  'employeeNumber', 'userType', 'locale', 'timezone', 'genderPronouns',
                ]);
                const customFields = Object.entries(selectedUser.profile).filter(
                  ([key, value]) =>
                    !standardFields.has(key) &&
                    !EXCLUDED_PROFILE_FIELDS.has(key) &&
                    !EXCLUDED_PROFILE_FIELDS.has(key.toLowerCase()) &&
                    value !== null &&
                    value !== undefined &&
                    value !== ''
                );

                if (customFields.length === 0) return null;

                return (
                  <CollapsibleSection
                    title="Custom Attributes"
                    defaultOpen={false}
                    itemCount={customFields.length}
                  >
                    <div className="detail-grid">
                      {customFields.map(([key, value]) => (
                        <div className="detail-item" key={key}>
                          <span className="detail-label">{key}</span>
                          <span className="detail-value">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                );
              })()}
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
                          {membership.rule.conditions?.expression?.value && (
                            <div className="rule-condition">
                              <strong>Condition:</strong>
                              <code className="condition-code">
                                {membership.rule.conditions.expression.value}
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

        {/* Empty State - Show only when no search and no user selected */}
        {!isSearching && searchResults.length === 0 && !error && !selectedUser && !searchQuery && (
          <div className="empty-state user-empty-state">
            <div className="empty-state-icon">&#128100;</div>
            <h3>User Membership Tracing</h3>
            <p className="muted">Search for users to analyze their group memberships and understand why they're in specific groups</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersTab;
