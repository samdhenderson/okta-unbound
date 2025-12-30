import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageHeader from './shared/PageHeader';
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

// Premium collapsible section component matching Overview tab design
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
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 text-left font-semibold text-gray-900 bg-gradient-to-r from-gray-50 to-gray-100/50 hover:from-gray-100 hover:to-gray-200/50 transition-all duration-200 border-b border-gray-200/50"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold">{title}</span>
          {itemCount !== undefined && (
            <span className="px-2 py-0.5 bg-white rounded-full text-xs font-medium text-gray-600 shadow-sm">
              {itemCount}
            </span>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="p-5 bg-gradient-to-b from-white to-gray-50/30 animate-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
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
      // Note: groupsResponse.data is an array of { group, membershipType, addedDate } objects
      // We need to extract the raw groups for analysis
      const membershipData = groupsResponse.data || [];
      const rawGroups = membershipData.map((m: any) => m.group || m);
      const analyzedMemberships = analyzeMemberships(rawGroups, rules, user);

      setMemberships(analyzedMemberships);

      console.log('[UsersTab] Loaded memberships:', {
        count: analyzedMemberships.length,
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

        // Note: groupsResponse.data is an array of { group, membershipType, addedDate } objects
        const membershipData = groupsResponse.data || [];
        const rawGroups = membershipData.map((m: any) => m.group || m);
        const analyzedMemberships = analyzeMemberships(rawGroups, rules, user);
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
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="User Search"
        subtitle="Search users and analyze their group memberships"
        icon="user"
        badge={selectedUser ? { text: `${memberships.length} Groups`, variant: 'primary' } : undefined}
        actions={
          oktaOrigin && selectedUser ? (
            <a
              href={`${oktaOrigin}/admin/user/profile/view/${selectedUser.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white font-semibold rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
              title="Open user in Okta Admin"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>Open in Okta</span>
            </a>
          ) : undefined
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Search Section */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="w-full pl-11 pr-12 py-3 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
              placeholder="Search by email, name, or login..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {(searchQuery || selectedUser) && (
              <button
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                onClick={handleClearSearch}
                title="Clear search"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {isSearching && (
              <div className="absolute inset-y-0 right-12 flex items-center pr-3">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-[#007dc1] rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Detected user hint */}
          {userInfo && !selectedUser && !searchQuery && (
            <div className="px-4 py-2.5 bg-gradient-to-br from-blue-50 to-cyan-50/50 border border-blue-200/60 rounded-lg shadow-sm flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
              <span className="text-sm text-gray-700">
                Detected: <strong className="text-gray-900">{userInfo.userName}</strong>
              </span>
              {userInfo.userStatus && (
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                  userInfo.userStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                  userInfo.userStatus === 'DEPROVISIONED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {userInfo.userStatus}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && !selectedUser && (
          <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Search Results</h3>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                {searchResults.length} {searchResults.length === 1 ? 'user' : 'users'}
              </span>
            </div>
            <div className="space-y-3">
              {searchResults.map(user => (
                <div
                  key={user.id}
                  className="group bg-white rounded-lg border border-gray-200 p-5 cursor-pointer transition-all duration-200 hover:border-[#007dc1] hover:shadow-md hover:-translate-y-0.5"
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-[#007dc1] transition-colors">
                        {user.profile.firstName} {user.profile.lastName}
                      </h4>
                      <p className="text-sm text-gray-600 mb-1">{user.profile.email}</p>
                      <p className="text-xs text-gray-500 font-mono">Login: {user.profile.login}</p>
                    </div>
                    <span className={getStatusBadgeClass(user.status)}>{user.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected User Details - Positioned directly under search */}
        {selectedUser && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
            {/* Premium User ID Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
              <div className="p-6 bg-gradient-to-br from-white via-gray-50/30 to-white">
                <div className="flex items-start gap-5">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-[#007dc1] to-[#3d9dd9] flex items-center justify-center text-white text-xl font-bold shadow-lg ring-4 ring-blue-100">
                    {selectedUser.profile.firstName?.[0]?.toUpperCase() || '?'}
                    {selectedUser.profile.lastName?.[0]?.toUpperCase() || ''}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      {selectedUser.profile.firstName} {selectedUser.profile.lastName}
                    </h2>
                    {(selectedUser.profile.title || selectedUser.profile.department) && (
                      <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                        {selectedUser.profile.title && <span>{selectedUser.profile.title}</span>}
                        {selectedUser.profile.title && selectedUser.profile.department && (
                          <span className="text-gray-400">•</span>
                        )}
                        {selectedUser.profile.department && <span>{selectedUser.profile.department}</span>}
                      </div>
                    )}
                    <div className="text-sm text-gray-700 mb-1">{selectedUser.profile.email}</div>
                    {selectedUser.profile.genderPronouns && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md border border-purple-200 mt-2">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        {selectedUser.profile.genderPronouns}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    <span className={getStatusBadgeClass(selectedUser.status)}>
                      {selectedUser.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 grid grid-cols-3 gap-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-600 mb-1">Last Login</span>
                  <span className="text-gray-900 font-medium">
                    {selectedUser.lastLogin
                      ? getRelativeTime(selectedUser.lastLogin) || formatDate(selectedUser.lastLogin)
                      : 'Never'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-600 mb-1">Created</span>
                  <span className="text-gray-900 font-medium">
                    {getRelativeTime(selectedUser.created) || formatDate(selectedUser.created)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-600 mb-1">Groups</span>
                  <span className="text-gray-900 font-medium">{memberships.length}</span>
                </div>
              </div>
            </div>

            {/* Collapsible Details Sections */}
            <div className="space-y-4">
              {/* Account Details */}
              <CollapsibleSection title="Account Details" defaultOpen={false}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 mb-1 block">Login</span>
                    <span className="text-sm text-gray-900 block">{selectedUser.profile.login}</span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 mb-1 block">User ID</span>
                    <span className="detail-value detail-value-mono">{selectedUser.id}</span>
                  </div>
                  {selectedUser.profile.secondEmail && (
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-xs font-semibold text-gray-600 mb-1 block">Secondary Email</span>
                      <span className="text-sm text-gray-900 block">{selectedUser.profile.secondEmail}</span>
                    </div>
                  )}
                  {selectedUser.activated && (
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-xs font-semibold text-gray-600 mb-1 block">Activated</span>
                      <span className="text-sm text-gray-900 block">{formatDate(selectedUser.activated)}</span>
                    </div>
                  )}
                  {selectedUser.statusChanged && (
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-xs font-semibold text-gray-600 mb-1 block">Status Changed</span>
                      <span className="text-sm text-gray-900 block">{formatDate(selectedUser.statusChanged)}</span>
                    </div>
                  )}
                  {selectedUser.passwordChanged && (
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-xs font-semibold text-gray-600 mb-1 block">Password Changed</span>
                      <span className="text-sm text-gray-900 block">{formatDate(selectedUser.passwordChanged)}</span>
                    </div>
                  )}
                  {selectedUser.lastUpdated && (
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-xs font-semibold text-gray-600 mb-1 block">Profile Updated</span>
                      <span className="text-sm text-gray-900 block">{formatDate(selectedUser.lastUpdated)}</span>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {selectedUser.profile.title && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Title</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.title}</span>
                      </div>
                    )}
                    {selectedUser.profile.department && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Department</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.department}</span>
                      </div>
                    )}
                    {selectedUser.profile.division && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Division</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.division}</span>
                      </div>
                    )}
                    {selectedUser.profile.organization && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Organization</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.organization}</span>
                      </div>
                    )}
                    {selectedUser.profile.manager && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Manager</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.manager}</span>
                      </div>
                    )}
                    {selectedUser.profile.costCenter && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Cost Center</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.costCenter}</span>
                      </div>
                    )}
                    {selectedUser.profile.employeeNumber && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Employee #</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.employeeNumber}</span>
                      </div>
                    )}
                    {selectedUser.profile.userType && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">User Type</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.userType}</span>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {selectedUser.profile.primaryPhone && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Phone</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.primaryPhone}</span>
                      </div>
                    )}
                    {selectedUser.profile.mobilePhone && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Mobile</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.mobilePhone}</span>
                      </div>
                    )}
                    {(selectedUser.profile.streetAddress ||
                      selectedUser.profile.city ||
                      selectedUser.profile.state) && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200 md:col-span-2">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Location</span>
                        <span className="text-sm text-gray-900 block">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {selectedUser.profile.locale && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Locale</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.locale}</span>
                      </div>
                    )}
                    {selectedUser.profile.timezone && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 mb-1 block">Timezone</span>
                        <span className="text-sm text-gray-900 block">{selectedUser.profile.timezone}</span>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {customFields.map(([key, value]) => (
                        <div className="p-3 bg-white rounded-lg border border-gray-200" key={key}>
                          <span className="text-xs font-semibold text-gray-600 mb-1 block">{key}</span>
                          <span className="text-sm text-gray-900 block">
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
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200/50">
                <h3 className="text-sm font-semibold text-gray-900">
                  Group Memberships ({memberships.length})
                </h3>
              </div>

              {isLoadingMemberships ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-gray-200 border-t-[#007dc1] rounded-full animate-spin" />
                  </div>
                  <p className="mt-4 text-gray-600 text-sm">Loading group memberships...</p>
                </div>
              ) : memberships.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-gray-500 text-sm">This user is not a member of any groups</p>
                </div>
              ) : (
                <div className="p-4 space-y-3 bg-gradient-to-b from-white to-gray-50/30">
                  {memberships.map((membership) => (
                    <div
                      key={membership.group.id}
                      className={`
                        rounded-lg border p-4 transition-all duration-200
                        ${highlightCurrentGroup(membership.group.id)
                          ? 'border-[#007dc1] bg-gradient-to-br from-blue-50/50 to-white ring-2 ring-[#007dc1]/20 shadow-lg shadow-[#007dc1]/10'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h4 className="font-semibold text-gray-900 text-sm">
                              {membership.group.profile.name}
                            </h4>
                            {highlightCurrentGroup(membership.group.id) && (
                              <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white text-xs font-bold">
                                Current Group
                              </span>
                            )}
                            {oktaOrigin && (
                              <button
                                onClick={() => window.open(`${oktaOrigin}/admin/group/${membership.group.id}`, '_blank')}
                                className="p-1.5 text-gray-400 hover:text-[#007dc1] hover:bg-blue-50 rounded transition-all duration-200"
                                title="Open group in Okta admin"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {membership.group.profile.description && (
                            <p className="text-xs text-gray-600">
                              {membership.group.profile.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <span className={getMembershipTypeBadge(membership.membershipType)}>
                            {membership.membershipType.replace('_', ' ')}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200">
                            {membership.group.type}
                          </span>
                        </div>
                      </div>

                      {/* Show rule details if rule-based */}
                      {membership.membershipType === 'RULE_BASED' && membership.rule && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-sm font-semibold text-blue-900">Added by Rule:</span>
                            <span className="text-sm text-blue-800">{membership.rule.name}</span>
                            {onNavigateToRule && (
                              <button
                                className="ml-auto px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm inline-flex items-center gap-1"
                                onClick={() => onNavigateToRule(membership.rule!.id)}
                                title="View this rule in Rules tab"
                              >
                                <span>View Rule</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {membership.rule.conditions?.expression?.value && (
                            <div className="mt-2">
                              <span className="text-xs font-semibold text-blue-800 block mb-1">Condition:</span>
                              <code className="block text-xs font-mono text-blue-900 bg-white p-2 rounded border border-blue-200 overflow-x-auto">
                                {membership.rule.conditions.expression.value}
                              </code>
                            </div>
                          )}
                        </div>
                      )}

                      {membership.membershipType === 'DIRECT' && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-600 flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
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
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
              <svg className="w-10 h-10 text-[#007dc1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">User Membership Tracing</h3>
            <p className="text-sm text-gray-600 text-center max-w-md">
              Search for users to analyze their group memberships and understand why they're in specific groups
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersTab;
