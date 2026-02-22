import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageHeader from './shared/PageHeader';
import AlertMessage from './shared/AlertMessage';
import Button from './shared/Button';
import Modal from './shared/Modal';
import CollapsibleSection from './shared/CollapsibleSection';
import EmptyState from './shared/EmptyState';
import LoadingSpinner from './shared/LoadingSpinner';
import type { OktaUser, GroupMembership } from '../../shared/types';
import type { AlertMessageData } from './shared/AlertMessage';
import { RulesCache } from '../../shared/rulesCache';
import { useUserContext } from '../hooks/useUserContext';
import { useOktaApi } from '../hooks/useOktaApi';

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

type LifecycleAction = 'suspend' | 'unsuspend' | 'resetPassword';

// Shape returned by searchGroups in groupDiscovery.ts
interface GroupSearchResult {
  id: string;
  name: string;
  description: string;
  type: string;
}

const UsersTab: React.FC<UsersTabProps> = ({ targetTabId, currentGroupId, onNavigateToRule }) => {
  const { userInfo, isLoading: isLoadingUserContext, oktaOrigin } = useUserContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OktaUser | null>(null);
  const [searchResults, setSearchResults] = useState<OktaUser[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<AlertMessageData | null>(null);
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<LifecycleAction | null>(null);
  const [isLifecycleLoading, setIsLifecycleLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasAutoLoadedUser, setHasAutoLoadedUser] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Add to Group modal state
  const [isAddToGroupModalOpen, setIsAddToGroupModalOpen] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<GroupSearchResult[]>([]);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupSearchResult | null>(null);
  const [isAddingToGroup, setIsAddingToGroup] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const groupDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { suspendUser, unsuspendUser, resetPassword, getUserById, searchGroups, addUserToGroup } = useOktaApi({
    targetTabId: targetTabId ?? null,
  });

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
    setResultMessage(null);
    searchInputRef.current?.focus();
  };

  const handleLifecycleAction = async () => {
    if (!selectedUser || !pendingLifecycleAction) return;

    // Capture before clearing so success message lookup still works
    const action = pendingLifecycleAction;
    setIsLifecycleLoading(true);
    setPendingLifecycleAction(null);

    try {
      let result: { success: boolean; error?: string };

      if (action === 'suspend') {
        result = await suspendUser(selectedUser.id);
      } else if (action === 'unsuspend') {
        result = await unsuspendUser(selectedUser.id);
      } else {
        result = await resetPassword(selectedUser.id);
      }

      if (result.success) {
        const successMessages: Record<LifecycleAction, string> = {
          suspend: 'User suspended successfully. They can no longer sign in.',
          unsuspend: 'User unsuspended successfully. They can now sign in.',
          resetPassword: 'Password reset email sent successfully.',
        };
        setResultMessage({ text: successMessages[action], type: 'success' });

        // Refresh user status cheaply without reloading memberships
        if (action !== 'resetPassword') {
          const refreshed = await getUserById(selectedUser.id);
          if (refreshed) {
            setSelectedUser((prev) =>
              prev ? { ...prev, status: refreshed.status as OktaUser['status'] } : prev
            );
          }
        }
      } else {
        setResultMessage({
          text: result.error || 'The operation failed. Please try again.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setResultMessage({ text: message, type: 'error' });
    } finally {
      setIsLifecycleLoading(false);
    }
  };

  // Debounced group search for the Add to Group modal
  useEffect(() => {
    if (groupDebounceTimerRef.current) {
      clearTimeout(groupDebounceTimerRef.current);
    }

    if (groupSearchQuery.trim().length < 2) {
      setGroupSearchResults([]);
      setShowGroupDropdown(false);
      return;
    }

    groupDebounceTimerRef.current = setTimeout(async () => {
      setIsSearchingGroups(true);
      try {
        const results = await searchGroups(groupSearchQuery.trim());
        setGroupSearchResults(results);
        setShowGroupDropdown(results.length > 0);
      } catch {
        setGroupSearchResults([]);
        setShowGroupDropdown(false);
      } finally {
        setIsSearchingGroups(false);
      }
    }, 300);

    return () => {
      if (groupDebounceTimerRef.current) {
        clearTimeout(groupDebounceTimerRef.current);
      }
    };
  }, [groupSearchQuery, searchGroups]);

  const handleOpenAddToGroupModal = () => {
    setGroupSearchQuery('');
    setGroupSearchResults([]);
    setSelectedGroup(null);
    setShowGroupDropdown(false);
    setIsAddToGroupModalOpen(true);
  };

  const handleCloseAddToGroupModal = () => {
    setIsAddToGroupModalOpen(false);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
    setSelectedGroup(null);
    setShowGroupDropdown(false);
  };

  const handleConfirmAddToGroup = async () => {
    if (!selectedUser || !selectedGroup) return;

    setIsAddingToGroup(true);
    try {
      const result = await addUserToGroup(selectedGroup.id, selectedGroup.name, {
        id: selectedUser.id,
        profile: {
          login: selectedUser.profile.login,
          firstName: selectedUser.profile.firstName,
          lastName: selectedUser.profile.lastName,
          email: selectedUser.profile.email,
        },
      });

      if (result.success) {
        handleCloseAddToGroupModal();
        // Refresh memberships so the new group appears immediately
        await handleSelectUser(selectedUser);
      } else {
        setResultMessage({
          text: result.error || 'Failed to add user to group. Please try again.',
          type: 'error',
        });
        handleCloseAddToGroupModal();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setResultMessage({ text: message, type: 'error' });
      handleCloseAddToGroupModal();
    } finally {
      setIsAddingToGroup(false);
    }
  };

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="User Search"
        subtitle="Search users and analyze their group memberships"
        badge={selectedUser ? { text: `${memberships.length} Groups`, variant: 'primary' } : undefined}
        actions={
          oktaOrigin && selectedUser ? (
            <Button
              variant="primary"
              icon="link"
              onClick={() => window.open(`${oktaOrigin}/admin/user/profile/view/${selectedUser.id}`, '_blank')}
              title="Open user in Okta Admin"
            >
              Open in Okta
            </Button>
          ) : undefined
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Search Section */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="w-full pl-11 pr-12 py-3 bg-white border border-neutral-200 rounded-md text-sm placeholder-neutral-400 focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary transition-all duration-100"
              placeholder="Search by email, name, or login..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {(searchQuery || selectedUser) && (
              <button
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors duration-100"
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
                <div className="w-4 h-4 border-2 border-neutral-200 border-t-primary rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Detected user hint */}
          {userInfo && !selectedUser && !searchQuery && (
            <div className="px-4 py-2.5 bg-primary-light border border-primary-highlight rounded-md flex items-center gap-2">
              <span className="text-sm text-neutral-700">
                Detected: <strong className="text-neutral-900">{userInfo.userName}</strong>
              </span>
              {userInfo.userStatus && (
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-md ${
                  userInfo.userStatus === 'ACTIVE' ? 'bg-success-light text-success-text' :
                  userInfo.userStatus === 'DEPROVISIONED' ? 'bg-danger-light text-danger-text' : 'bg-warning-light text-warning-text'
                }`}>
                  {userInfo.userStatus}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <AlertMessage
            message={{ text: error, type: 'error' }}
            onDismiss={() => setError(null)}
            className="animate-in slide-in-from-top-2 duration-300"
          />
        )}

        {/* Lifecycle operation result */}
        {resultMessage && (
          <AlertMessage
            message={resultMessage}
            onDismiss={() => setResultMessage(null)}
            className="animate-in slide-in-from-top-2 duration-300"
          />
        )}

        {/* Search Results */}
        {searchResults.length > 0 && !selectedUser && (
          <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Search Results</h3>
              <span className="px-3 py-1 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-md">
                {searchResults.length} {searchResults.length === 1 ? 'user' : 'users'}
              </span>
            </div>
            <div className="space-y-3">
              {searchResults.map(user => (
                <div
                  key={user.id}
                  className="group bg-white rounded-md border border-neutral-200 p-5 cursor-pointer transition-all duration-100 hover:border-neutral-500 hover:shadow-sm"
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-neutral-900 mb-1 group-hover:text-primary-text transition-colors duration-100">
                        {user.profile.firstName} {user.profile.lastName}
                      </h4>
                      <p className="text-sm text-neutral-600 mb-1">{user.profile.email}</p>
                      <p className="text-xs text-neutral-500 font-mono">Login: {user.profile.login}</p>
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
            <div className="bg-white rounded-md border border-neutral-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start gap-5">
                  {/* Avatar */}
                  <div className="shrink-0 w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold ring-4 ring-primary-highlight">
                    {selectedUser.profile.firstName?.[0]?.toUpperCase() || '?'}
                    {selectedUser.profile.lastName?.[0]?.toUpperCase() || ''}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-neutral-900 mb-1">
                      {selectedUser.profile.firstName} {selectedUser.profile.lastName}
                    </h2>
                    {(selectedUser.profile.title || selectedUser.profile.department) && (
                      <div className="text-sm text-neutral-600 mb-2 flex items-center gap-2">
                        {selectedUser.profile.title && <span>{selectedUser.profile.title}</span>}
                        {selectedUser.profile.title && selectedUser.profile.department && (
                          <span className="text-neutral-400">•</span>
                        )}
                        {selectedUser.profile.department && <span>{selectedUser.profile.department}</span>}
                      </div>
                    )}
                    <div className="text-sm text-neutral-700 mb-1">{selectedUser.profile.email}</div>
                    {selectedUser.profile.genderPronouns && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-50 text-neutral-700 text-xs font-medium rounded-md border border-neutral-200 mt-2">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        {selectedUser.profile.genderPronouns}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    <span className={getStatusBadgeClass(selectedUser.status)}>
                      {selectedUser.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 grid grid-cols-3 gap-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-neutral-600 mb-1">Last Login</span>
                  <span className="text-neutral-900 font-medium">
                    {selectedUser.lastLogin
                      ? getRelativeTime(selectedUser.lastLogin) || formatDate(selectedUser.lastLogin)
                      : 'Never'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-neutral-600 mb-1">Created</span>
                  <span className="text-neutral-900 font-medium">
                    {getRelativeTime(selectedUser.created) || formatDate(selectedUser.created)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-neutral-600 mb-1">Groups</span>
                  <span className="text-neutral-900 font-medium">{memberships.length}</span>
                </div>
              </div>
            </div>

            {/* Lifecycle Actions */}
            {selectedUser.status !== 'DEPROVISIONED' ? (
              <div className="bg-white rounded-md border border-neutral-200 px-5 py-4">
                <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-3">
                  Lifecycle Actions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.status === 'ACTIVE' && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isLifecycleLoading}
                      onClick={() => setPendingLifecycleAction('suspend')}
                    >
                      Suspend User
                    </Button>
                  )}
                  {selectedUser.status === 'SUSPENDED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isLifecycleLoading}
                      onClick={() => setPendingLifecycleAction('unsuspend')}
                    >
                      Unsuspend User
                    </Button>
                  )}
                  {(selectedUser.status === 'ACTIVE' ||
                    selectedUser.status === 'RECOVERY' ||
                    selectedUser.status === 'LOCKED_OUT' ||
                    selectedUser.status === 'PASSWORD_EXPIRED') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isLifecycleLoading}
                      onClick={() => setPendingLifecycleAction('resetPassword')}
                    >
                      Reset Password
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-5 py-3 bg-neutral-50 rounded-md border border-neutral-200">
                <p className="text-xs text-neutral-500">
                  No lifecycle actions are available for deprovisioned users.
                </p>
              </div>
            )}

            {/* Confirmation modal for lifecycle actions */}
            <Modal
              isOpen={pendingLifecycleAction !== null}
              onClose={() => setPendingLifecycleAction(null)}
              title={
                pendingLifecycleAction === 'suspend'
                  ? 'Suspend User'
                  : pendingLifecycleAction === 'unsuspend'
                  ? 'Unsuspend User'
                  : 'Reset Password'
              }
              size="sm"
              footer={
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPendingLifecycleAction(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant={pendingLifecycleAction === 'suspend' ? 'danger' : 'primary'}
                    size="sm"
                    onClick={handleLifecycleAction}
                  >
                    {pendingLifecycleAction === 'suspend'
                      ? 'Suspend'
                      : pendingLifecycleAction === 'unsuspend'
                      ? 'Unsuspend'
                      : 'Send Reset Email'}
                  </Button>
                </>
              }
            >
              <p className="text-sm text-neutral-700">
                {pendingLifecycleAction === 'suspend' && (
                  <>
                    Are you sure you want to suspend{' '}
                    <strong className="text-neutral-900">
                      {selectedUser.profile.firstName} {selectedUser.profile.lastName}
                    </strong>
                    ? They will be unable to sign in until unsuspended.
                  </>
                )}
                {pendingLifecycleAction === 'unsuspend' && (
                  <>
                    Unsuspend{' '}
                    <strong className="text-neutral-900">
                      {selectedUser.profile.firstName} {selectedUser.profile.lastName}
                    </strong>
                    ? They will regain the ability to sign in.
                  </>
                )}
                {pendingLifecycleAction === 'resetPassword' && (
                  <>
                    Send a password reset email to{' '}
                    <strong className="text-neutral-900">{selectedUser.profile.email}</strong>?
                  </>
                )}
              </p>
            </Modal>

            {/* Collapsible Details Sections */}
            <div className="space-y-4">
              {/* Account Details */}
              <CollapsibleSection title="Account Details" defaultOpen={false}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">Login</span>
                    <span className="text-sm text-neutral-900 block">{selectedUser.profile.login}</span>
                  </div>
                  <div className="p-3 bg-white rounded-md border border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-600 mb-1 block">User ID</span>
                    <span className="text-xs font-mono bg-neutral-100 px-1.5 py-0.5 rounded select-all">{selectedUser.id}</span>
                  </div>
                  {selectedUser.profile.secondEmail && (
                    <div className="p-3 bg-white rounded-md border border-neutral-200">
                      <span className="text-xs font-semibold text-neutral-600 mb-1 block">Secondary Email</span>
                      <span className="text-sm text-neutral-900 block">{selectedUser.profile.secondEmail}</span>
                    </div>
                  )}
                  {selectedUser.activated && (
                    <div className="p-3 bg-white rounded-md border border-neutral-200">
                      <span className="text-xs font-semibold text-neutral-600 mb-1 block">Activated</span>
                      <span className="text-sm text-neutral-900 block">{formatDate(selectedUser.activated)}</span>
                    </div>
                  )}
                  {selectedUser.statusChanged && (
                    <div className="p-3 bg-white rounded-md border border-neutral-200">
                      <span className="text-xs font-semibold text-neutral-600 mb-1 block">Status Changed</span>
                      <span className="text-sm text-neutral-900 block">{formatDate(selectedUser.statusChanged)}</span>
                    </div>
                  )}
                  {selectedUser.passwordChanged && (
                    <div className="p-3 bg-white rounded-md border border-neutral-200">
                      <span className="text-xs font-semibold text-neutral-600 mb-1 block">Password Changed</span>
                      <span className="text-sm text-neutral-900 block">{formatDate(selectedUser.passwordChanged)}</span>
                    </div>
                  )}
                  {selectedUser.lastUpdated && (
                    <div className="p-3 bg-white rounded-md border border-neutral-200">
                      <span className="text-xs font-semibold text-neutral-600 mb-1 block">Profile Updated</span>
                      <span className="text-sm text-neutral-900 block">{formatDate(selectedUser.lastUpdated)}</span>
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
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Title</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.title}</span>
                      </div>
                    )}
                    {selectedUser.profile.department && (
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Department</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.department}</span>
                      </div>
                    )}
                    {selectedUser.profile.division && (
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Division</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.division}</span>
                      </div>
                    )}
                    {selectedUser.profile.organization && (
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Organization</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.organization}</span>
                      </div>
                    )}
                    {selectedUser.profile.manager && (
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Manager</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.manager}</span>
                      </div>
                    )}
                    {selectedUser.profile.costCenter && (
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Cost Center</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.costCenter}</span>
                      </div>
                    )}
                    {selectedUser.profile.employeeNumber && (
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Employee #</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.employeeNumber}</span>
                      </div>
                    )}
                    {selectedUser.profile.userType && (
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">User Type</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.userType}</span>
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
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Phone</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.primaryPhone}</span>
                      </div>
                    )}
                    {selectedUser.profile.mobilePhone && (
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Mobile</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.mobilePhone}</span>
                      </div>
                    )}
                    {(selectedUser.profile.streetAddress ||
                      selectedUser.profile.city ||
                      selectedUser.profile.state) && (
                      <div className="p-3 bg-white rounded-md border border-neutral-200 md:col-span-2">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Location</span>
                        <span className="text-sm text-neutral-900 block">
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
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Locale</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.locale}</span>
                      </div>
                    )}
                    {selectedUser.profile.timezone && (
                      <div className="p-3 bg-white rounded-md border border-neutral-200">
                        <span className="text-xs font-semibold text-neutral-600 mb-1 block">Timezone</span>
                        <span className="text-sm text-neutral-900 block">{selectedUser.profile.timezone}</span>
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
                        <div className="p-3 bg-white rounded-md border border-neutral-200" key={key}>
                          <span className="text-xs font-semibold text-neutral-600 mb-1 block">{key}</span>
                          <span className="text-sm text-neutral-900 block">
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
            <div className="rounded-md border border-neutral-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Group Memberships ({memberships.length})
                </h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenAddToGroupModal}
                  disabled={isLoadingMemberships}
                >
                  Add to Group
                </Button>
              </div>

              {isLoadingMemberships ? (
                <LoadingSpinner size="lg" message="Loading group memberships..." centered />
              ) : memberships.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-neutral-500 text-sm">This user is not a member of any groups</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {memberships.map((membership) => (
                    <div
                      key={membership.group.id}
                      className={`
                        rounded-md border p-4 transition-all duration-100
                        ${highlightCurrentGroup(membership.group.id)
                          ? 'border-primary bg-primary-light ring-1 ring-primary/20'
                          : 'border-neutral-200 bg-white hover:border-neutral-500'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h4 className="font-semibold text-neutral-900 text-sm">
                              {membership.group.profile.name}
                            </h4>
                            {highlightCurrentGroup(membership.group.id) && (
                              <span className="px-2 py-0.5 rounded-md bg-primary text-white text-xs font-bold">
                                Current Group
                              </span>
                            )}
                            {oktaOrigin && (
                              <button
                                onClick={() => window.open(`${oktaOrigin}/admin/group/${membership.group.id}`, '_blank')}
                                className="p-1.5 text-neutral-400 hover:text-primary-text hover:bg-primary-light rounded-md transition-all duration-100"
                                title="Open group in Okta admin"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {membership.group.profile.description && (
                            <p className="text-xs text-neutral-600">
                              {membership.group.profile.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <span className={getMembershipTypeBadge(membership.membershipType)}>
                            {membership.membershipType.replace('_', ' ')}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-xs font-medium border border-neutral-200">
                            {membership.group.type}
                          </span>
                        </div>
                      </div>

                      {/* Show rule details if rule-based */}
                      {membership.membershipType === 'RULE_BASED' && membership.rule && (
                        <div className="mt-3 p-3 bg-primary-light rounded-md border border-primary-highlight">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-primary-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-sm font-semibold text-primary-dark">Added by Rule:</span>
                            <span className="text-sm text-primary-text">{membership.rule.name}</span>
                            {onNavigateToRule && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onNavigateToRule(membership.rule!.id)}
                                title="View this rule in Rules tab"
                                className="ml-auto"
                              >
                                View Rule
                              </Button>
                            )}
                          </div>
                          {membership.rule.conditions?.expression?.value && (
                            <div className="mt-2">
                              <span className="text-xs font-semibold text-primary-text block mb-1">Condition:</span>
                              <code className="block text-xs font-mono text-neutral-900 bg-white p-2 rounded-md border border-primary-highlight overflow-x-auto">
                                {membership.rule.conditions.expression.value}
                              </code>
                            </div>
                          )}
                        </div>
                      )}

                      {membership.membershipType === 'DIRECT' && (
                        <div className="mt-3 p-3 bg-neutral-50 rounded-md border border-neutral-200">
                          <p className="text-xs text-neutral-600 flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
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
          <EmptyState
            icon="user"
            title="User Membership Tracing"
            description="Search for users to analyze their group memberships and understand why they're in specific groups"
          />
        )}
      </div>

      {/* Add to Group Modal */}
      <Modal
        isOpen={isAddToGroupModalOpen}
        onClose={handleCloseAddToGroupModal}
        title={`Add ${selectedUser?.profile?.firstName || 'User'} to Group`}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={handleCloseAddToGroupModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmAddToGroup}
              disabled={!selectedGroup || isAddingToGroup}
              loading={isAddingToGroup}
            >
              Add to Group
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Search for a group
            </label>
            <input
              type="text"
              value={groupSearchQuery}
              onChange={(e) => setGroupSearchQuery(e.target.value)}
              placeholder="Type to search by group name..."
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {isSearchingGroups && (
              <div className="absolute right-3 top-8">
                <LoadingSpinner size="sm" />
              </div>
            )}

            {/* Search results dropdown */}
            {showGroupDropdown && groupSearchResults.length > 0 && !selectedGroup && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {groupSearchResults.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      setSelectedGroup(group);
                      setShowGroupDropdown(false);
                      setGroupSearchQuery('');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                  >
                    <div className="text-sm font-medium text-neutral-900">{group.name}</div>
                    <div className="text-xs text-neutral-500">{group.type}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected group display */}
          {selectedGroup && (
            <div className="flex items-center justify-between p-3 bg-primary-light border border-primary-highlight rounded-md">
              <div>
                <div className="text-sm font-medium text-neutral-900">{selectedGroup.name}</div>
                <div className="text-xs text-neutral-500">{selectedGroup.type}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedGroup(null);
                  setGroupSearchQuery('');
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default UsersTab;
