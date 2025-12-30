import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PageHeader from './shared/PageHeader';
import { useOktaApi } from '../hooks/useOktaApi';
import type { GroupSummary, LinkedGroup } from '../../shared/types';
import GroupListItem from './groups/GroupListItem';
import GroupCollections from './groups/GroupCollections';
import BulkOperations from './groups/BulkOperations';
import GroupComparison from './groups/GroupComparison';
import { applyStalenessScore } from '../../shared/utils/stalenessCalculator';

interface GroupsTabProps {
  targetTabId: number | null;
  oktaOrigin?: string;
}

type ViewMode = 'browse' | 'bulk' | 'compare';

const GROUPS_CACHE_KEY = 'okta_unbound_groups_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day

const GroupsTab: React.FC<GroupsTabProps> = ({ targetTabId, oktaOrigin }) => {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sizeFilter, setSizeFilter] = useState<string>('');
  const [stalenessFilter, setStalenessFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'memberCount' | 'lastUpdated' | 'stalenessScore' | 'lastMembershipUpdated'>('name');

  // Hybrid search mode state
  const [searchMode, setSearchMode] = useState<'live' | 'cached'>('live');
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState<GroupSummary[]>([]);
  const [isLiveSearching, setIsLiveSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load options modal state
  const [showLoadOptionsModal, setShowLoadOptionsModal] = useState(false);

  const api = useOktaApi({
    targetTabId,
    onResult: (message, type) => {
      if (type === 'error') {
        setError(message);
      }
    },
  });

  // Handler to show modal before loading
  const handleLoadGroupsClick = () => {
    setShowLoadOptionsModal(true);
  };

  // Handler for modal confirmation
  const handleConfirmLoad = (includePushGroups: boolean) => {
    setShowLoadOptionsModal(false);
    loadAllGroups(includePushGroups);
  };

  // Load groups from cache on mount and determine search mode
  useEffect(() => {
    chrome.storage.local.get([GROUPS_CACHE_KEY], (result) => {
      if (result[GROUPS_CACHE_KEY]) {
        try {
          const cached = JSON.parse(result[GROUPS_CACHE_KEY] as string);
          const age = Date.now() - cached.timestamp;

          if (age < CACHE_DURATION) {
            // Cache is valid - switch to cached mode
            const parsedGroups = cached.groups.map((g: any) => ({
              ...g,
              lastUpdated: g.lastUpdated ? new Date(g.lastUpdated) : undefined,
              lastMembershipUpdated: g.lastMembershipUpdated ? new Date(g.lastMembershipUpdated) : undefined,
              created: g.created ? new Date(g.created) : undefined,
            }));
            setGroups(parsedGroups);
            setSearchMode('cached'); // IMPORTANT: Switch to cached mode
            console.log('[GroupsTab] Loaded from cache, using cached search mode');
          } else {
            // Cache expired - use live mode
            setSearchMode('live');
            console.log('[GroupsTab] Cache expired, using live search mode');
          }
        } catch (err) {
          console.error('Failed to parse groups cache:', err);
          setSearchMode('live');
        }
      } else {
        // No cache - use live mode (new default behavior)
        setSearchMode('live');
        console.log('[GroupsTab] No cache found, using live search mode');
      }
    });
  }, []);

  const loadAllGroups = async (fetchPushGroups: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all groups (paginated automatically)
      const allGroups = await api.getAllGroups((_loaded, _total) => {
        // Progress callback
      });

      // Transform to GroupSummary format with member counts extracted from stats
      const groupSummaries: GroupSummary[] = allGroups.map((group: any) => {
        // Extract member count from _embedded.stats.usersCount (from expand=stats parameter)
        // Falls back to 0 if stats are not available
        const memberCount = group._embedded?.stats?.usersCount ?? 0;

        // Extract source app info from existing data (no API call needed)
        let sourceAppId: string | undefined;
        let sourceAppName: string | undefined;

        if (group.type === 'APP_GROUP') {
          // Try to get app ID from _links
          if (group._links?.apps?.href) {
            const appIdMatch = group._links.apps.href.match(/\/apps\/([^/]+)/);
            if (appIdMatch) {
              sourceAppId = appIdMatch[1];
            }
          }
          // Prefer source object if available
          if (group.source) {
            sourceAppId = group.source.id;
            if (group.source.name && group.source.name !== group.source.id) {
              sourceAppName = group.source.name;
            }
          }
        }

        const summary: GroupSummary = {
          id: group.id,
          name: group.profile?.name || group.id,
          description: group.profile?.description,
          type: group.type,
          memberCount,
          lastUpdated: group.lastUpdated ? new Date(group.lastUpdated) : undefined,
          created: group.created ? new Date(group.created) : undefined,
          lastMembershipUpdated: group.lastMembershipUpdated ? new Date(group.lastMembershipUpdated) : undefined,
          hasRules: false,
          ruleCount: 0,
          selected: false,
          sourceAppId,
          sourceAppName,
        };

        // Apply staleness calculation
        return applyStalenessScore(summary);
      });

      // Collect unique app IDs from APP_GROUPs for source app name resolution
      const appIdsFromGroups = new Set<string>();
      groupSummaries.forEach(g => {
        if (g.sourceAppId) {
          appIdsFromGroups.add(g.sourceAppId);
        }
      });

      // Fetch app details and push group mappings in parallel
      const appNameMap = new Map<string, string>();
      // Maps sourceUserGroupId (Okta group) -> array of { appId, appName } for each app it's pushed to
      const pushGroupMappings = new Map<string, Array<{ appId: string, appName?: string }>>();

      // Only fetch push group mappings if requested (slow operation)
      if (fetchPushGroups) {
        // Fetch ALL apps to check for Group Push mappings
        // (OKTA_GROUPs can be pushed to any app, not just those with APP_GROUPs)
        console.log('[GroupsTab] Fetching all apps for Group Push mapping check...');
        const allApps = await api.getAllApps().catch(() => []);
        const allAppIds = new Set<string>(allApps.map((app: any) => app.id));
        console.log(`[GroupsTab] Found ${allAppIds.size} total apps in org`);

        // Merge APP_GROUP source app IDs with all apps
        allAppIds.forEach(appId => appIdsFromGroups.add(appId));

        if (allAppIds.size > 0) {
        console.log(`[GroupsTab] Fetching Group Push Mappings for ${allAppIds.size} apps...`);
        const appPromises = Array.from(allAppIds).map(async (appId) => {
          try {
            // Fetch app details and push group mappings in parallel for each app
            const [detailsResult, mappingsResult] = await Promise.all([
              api.getAppDetails(appId).catch(() => null),
              api.getAppPushGroupMappings(appId).catch(() => []),
            ]);

            const appLabel = detailsResult?.app?.label;
            if (appLabel) {
              appNameMap.set(appId, appLabel);
            }

            // Log mappings found
            if (mappingsResult.length > 0) {
              console.log(`[GroupsTab] App "${appLabel}" (${appId}) has ${mappingsResult.length} push mappings:`, mappingsResult);
            }

            // Process push group mappings
            // Each mapping shows which OKTA_GROUP is pushed to this app
            for (const mapping of mappingsResult) {
              console.log(`[GroupsTab] Processing mapping:`, mapping);
              if (mapping.sourceUserGroupId && mapping.status === 'ACTIVE') {
                // Add this app to the list of apps this group is pushed to
                const existingMappings = pushGroupMappings.get(mapping.sourceUserGroupId) || [];
                // Avoid duplicates
                if (!existingMappings.some(m => m.appId === appId)) {
                  existingMappings.push({
                    appId,
                    appName: appLabel,
                  });
                  pushGroupMappings.set(mapping.sourceUserGroupId, existingMappings);
                  console.log(`[GroupsTab] Added push mapping: Group ${mapping.sourceUserGroupId} → App "${appLabel}"`);
                }
              } else {
                console.log(`[GroupsTab] Skipping mapping (sourceUserGroupId: ${mapping.sourceUserGroupId}, status: ${mapping.status})`);
              }
            }

            return { appId, label: appLabel };
          } catch (err) {
            console.warn(`Failed to fetch details for app ${appId}:`, err);
            return { appId, label: null };
          }
        });

        await Promise.all(appPromises);

        console.log(`[GroupsTab] Total push group mappings found: ${pushGroupMappings.size}`);
        console.log('[GroupsTab] Push group mappings by group ID:', Object.fromEntries(pushGroupMappings));

        // Update groups with resolved app names
        groupSummaries.forEach(g => {
          if (g.sourceAppId && !g.sourceAppName && appNameMap.has(g.sourceAppId)) {
            g.sourceAppName = appNameMap.get(g.sourceAppId);
          }
        });
        }
      } else {
        // Just fetch app names for APP_GROUPs without push mappings
        console.log('[GroupsTab] Skipping push group mappings (not requested)');
        if (appIdsFromGroups.size > 0) {
          const appPromises = Array.from(appIdsFromGroups).map(async (appId) => {
            try {
              const detailsResult = await api.getAppDetails(appId).catch(() => null);
              const appLabel = detailsResult?.app?.label;
              if (appLabel) {
                appNameMap.set(appId, appLabel);
              }
            } catch (err) {
              console.warn(`Failed to fetch details for app ${appId}:`, err);
            }
          });
          await Promise.all(appPromises);

          // Update groups with resolved app names
          groupSummaries.forEach(g => {
            if (g.sourceAppId && !g.sourceAppName && appNameMap.has(g.sourceAppId)) {
              g.sourceAppName = appNameMap.get(g.sourceAppId);
            }
          });
        }
      }

      // Apply push group mappings to OKTA_GROUPs
      console.log('[GroupsTab] Applying push group mappings to OKTA_GROUPs...');
      const mergedGroups = applyPushGroupMappings(groupSummaries, pushGroupMappings);
      console.log('[GroupsTab] Groups after applying push mappings:', mergedGroups.filter(g => g.isPushGroup));

      setGroups(mergedGroups);

      // Cache the results
      chrome.storage.local.set({
        [GROUPS_CACHE_KEY]: JSON.stringify({
          groups: mergedGroups,
          timestamp: Date.now(),
        }),
      });

      // NEW: Switch to cached mode after successful load
      setSearchMode('cached');
      setLiveSearchQuery(''); // Clear live search
      setLiveSearchResults([]); // Clear live results
      console.log('[GroupsTab] Switched to cached mode after loading all groups');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  // Apply push group mappings to OKTA_GROUPs to show which apps they're pushed to
  const applyPushGroupMappings = (
    summaries: GroupSummary[],
    pushGroupMappings: Map<string, Array<{ appId: string; appName?: string }>>
  ): GroupSummary[] => {
    return summaries.map(group => {
      // Only apply to OKTA_GROUPs
      if (group.type === 'OKTA_GROUP') {
        const mappings = pushGroupMappings.get(group.id);
        if (mappings && mappings.length > 0) {
          // Convert mappings to linkedGroups format for display
          const linkedGroups: LinkedGroup[] = mappings.map(m => ({
            id: m.appId, // Use appId as identifier
            name: m.appName || 'App',
            type: 'APP_GROUP' as const,
            sourceAppId: m.appId,
            sourceAppName: m.appName,
            memberCount: 0, // We don't have member count for the remote app group
          }));

          return {
            ...group,
            isPushGroup: true,
            linkedGroups,
          };
        }
      }
      return group;
    });
  };

  // Live search handler - mirrors UsersTab pattern
  const handleLiveSearch = useCallback(async (query: string) => {
    if (!targetTabId) {
      setError('No Okta tab connected');
      return;
    }

    // Clear results if query is empty
    if (!query.trim()) {
      setLiveSearchResults([]);
      return;
    }

    setIsLiveSearching(true);
    setError(null);

    try {
      console.log('[GroupsTab] Live searching groups:', query);

      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'searchGroups',
        query: query.trim(),
      });

      if (response.success) {
        // Convert raw API results to GroupSummary format (simplified)
        const results = (response.data || []).map((group: any) => ({
          id: group.id,
          name: group.profile?.name || group.id,
          description: group.profile?.description,
          type: group.type,
          memberCount: group._embedded?.stats?.usersCount ?? 0,
          lastUpdated: group.lastUpdated ? new Date(group.lastUpdated) : undefined,
          created: group.created ? new Date(group.created) : undefined,
          lastMembershipUpdated: group.lastMembershipUpdated ? new Date(group.lastMembershipUpdated) : undefined,
          hasRules: false, // Not available in live search
          ruleCount: 0,
          selected: false,
          // Note: staleness scores, push mappings not computed for speed
        }));

        setLiveSearchResults(results);
        console.log('[GroupsTab] Live search found:', results.length, 'groups');
      } else {
        setError(response.error || 'Failed to search groups');
        setLiveSearchResults([]);
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to communicate with Okta tab');
      setLiveSearchResults([]);
      console.error('[GroupsTab] Live search error:', err);
    } finally {
      setIsLiveSearching(false);
    }
  }, [targetTabId]);

  // Debounced search effect - only runs in live mode
  useEffect(() => {
    if (searchMode === 'live') {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer (300ms debounce - same as UsersTab)
      debounceTimerRef.current = setTimeout(() => {
        handleLiveSearch(liveSearchQuery);
      }, 300);

      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }
  }, [liveSearchQuery, searchMode, handleLiveSearch]);

  const handleToggleSelect = useCallback((groupId: string) => {
    setSelectedGroupIds((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(groupId)) {
        newSelected.delete(groupId);
      } else {
        newSelected.add(groupId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = () => {
    setSelectedGroupIds(new Set(filteredGroups.map((g) => g.id)));
  };

  const handleDeselectAll = () => {
    setSelectedGroupIds(new Set());
  };

  const handleLoadCollection = (groupIds: string[]) => {
    setSelectedGroupIds(new Set(groupIds));
  };

  // Filter and sort groups - behavior depends on search mode
  const filteredGroups = useMemo(() => {
    // LIVE MODE: Use live search results directly (no client-side filtering)
    if (searchMode === 'live') {
      return liveSearchResults; // Already filtered by API
    }

    // CACHED MODE: Use powerful client-side filtering
    let filtered = [...groups];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          g.description?.toLowerCase().includes(query) ||
          g.id.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter) {
      filtered = filtered.filter((g) => g.type === typeFilter);
    }

    // Size filter
    if (sizeFilter) {
      filtered = filtered.filter((g) => {
        switch (sizeFilter) {
          case 'empty':
            return g.memberCount === 0;
          case 'small':
            return g.memberCount > 0 && g.memberCount < 50;
          case 'medium':
            return g.memberCount >= 50 && g.memberCount < 200;
          case 'large':
            return g.memberCount >= 200 && g.memberCount < 1000;
          case 'xlarge':
            return g.memberCount >= 1000;
          default:
            return true;
        }
      });
    }

    // Staleness filter
    if (stalenessFilter) {
      filtered = filtered.filter((g) => {
        switch (stalenessFilter) {
          case 'stale':
            return g.isStale === true;
          case 'active':
            return g.isStale === false;
          default:
            return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'memberCount':
          return b.memberCount - a.memberCount;
        case 'lastUpdated':
          if (!a.lastUpdated) return 1;
          if (!b.lastUpdated) return -1;
          return b.lastUpdated.getTime() - a.lastUpdated.getTime();
        case 'lastMembershipUpdated':
          if (!a.lastMembershipUpdated) return 1;
          if (!b.lastMembershipUpdated) return -1;
          return b.lastMembershipUpdated.getTime() - a.lastMembershipUpdated.getTime();
        case 'stalenessScore':
          return (b.stalenessScore || 0) - (a.stalenessScore || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [searchMode, liveSearchResults, groups, searchQuery, typeFilter, sizeFilter, stalenessFilter, sortBy]);

  // Export multi-group members
  const exportMultiGroupMembers = async () => {
    if (selectedGroupIds.size === 0) {
      alert('Please select at least one group');
      return;
    }

    try {
      // Collect all members from selected groups
      const allMembers: any[] = [];
      const userGroupMap = new Map<string, string[]>();

      for (const groupId of Array.from(selectedGroupIds)) {
        const group = groups.find((g) => g.id === groupId);
        const members = await api.getAllGroupMembers(groupId);

        members.forEach((member: any) => {
          if (!userGroupMap.has(member.id)) {
            userGroupMap.set(member.id, []);
            allMembers.push(member);
          }
          userGroupMap.get(member.id)!.push(group?.name || groupId);
        });
      }

      // Create CSV
      let csv = 'User ID,Email,First Name,Last Name,Status,Groups\n';
      allMembers.forEach((user) => {
        const groupsList = userGroupMap.get(user.id)?.join('; ') || '';
        csv += `${user.id},"${user.profile.email}","${user.profile.firstName}","${user.profile.lastName}",${user.status},"${groupsList}"\n`;
      });

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `multi-group-export-${selectedGroupIds.size}-groups-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`Exported ${allMembers.length} unique users from ${selectedGroupIds.size} groups`);
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Group Operations"
        subtitle="Browse, search, compare, and manage groups"
        icon="users"
        badge={selectedGroupIds.size > 0 ? { text: `${selectedGroupIds.size} Selected`, variant: 'primary' } : undefined}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* View Mode Selector */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2 flex-wrap">
            <button
              className={`
                px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200
                ${viewMode === 'browse'
                  ? 'bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }
              `}
              onClick={() => setViewMode('browse')}
            >
              Browse Groups
            </button>
            <button
              className={`
                px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200
                ${viewMode === 'bulk'
                  ? 'bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }
              `}
              onClick={() => setViewMode('bulk')}
            >
              Bulk Operations
            </button>
            <button
              className={`
                px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200
                ${viewMode === 'compare'
                  ? 'bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }
              `}
              onClick={() => setViewMode('compare')}
            >
              Compare Groups
            </button>
          </div>

          {/* Info icon for advanced filtering - Only show in live mode */}
          {searchMode === 'live' && viewMode === 'browse' && (
            <button
              onClick={handleLoadGroupsClick}
              disabled={loading || !targetTabId}
              className="group relative p-2 text-gray-400 hover:text-[#007dc1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Load all groups for advanced filtering"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <div className="font-semibold mb-1">Advanced Filtering Available</div>
                <div className="text-gray-300">
                  Click to load all groups and unlock type, size, and staleness filters
                </div>
                {/* Arrow */}
                <div className="absolute -top-1 right-3 w-2 h-2 bg-gray-900 transform rotate-45"></div>
              </div>
            </button>
          )}
        </div>

        {/* Browse Groups View */}
        {viewMode === 'browse' && (
          <>
            <div className="space-y-4">
              {/* Mode Indicator Badge */}
              {searchMode === 'live' ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-medium">Live Search Mode</span>
                  <span className="text-blue-600">- searching Okta API directly (fast, up to 20 results)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Cached Mode</span>
                  <span className="text-green-600">- using loaded groups ({groups.length} total) with powerful filtering</span>
                </div>
              )}

              {/* Search Bar - Changes based on mode */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchMode === 'live' ? (
                  <input
                    type="text"
                    placeholder="Search groups by name (live API search)..."
                    value={liveSearchQuery}
                    onChange={(e) => setLiveSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
                  />
                ) : (
                  <input
                    type="text"
                    placeholder="Search groups by name, description, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
                  />
                )}
                {isLiveSearching && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-[#007dc1] rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* Filters Row - Only show in cached mode */}
              {searchMode === 'cached' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
                  >
                    <option value="">All Types</option>
                    <option value="OKTA_GROUP">Okta Groups</option>
                    <option value="APP_GROUP">App Groups</option>
                    <option value="BUILT_IN">Built-in Groups</option>
                  </select>

                  <select
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
                  >
                    <option value="">All Sizes</option>
                    <option value="empty">Empty (0 members)</option>
                    <option value="small">Small (1-50)</option>
                    <option value="medium">Medium (50-200)</option>
                    <option value="large">Large (200-1000)</option>
                    <option value="xlarge">X-Large (1000+)</option>
                  </select>

                  <select
                    value={stalenessFilter}
                    onChange={(e) => setStalenessFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
                  >
                    <option value="">All Activity Levels</option>
                    <option value="stale">Stale Groups</option>
                    <option value="active">Active Groups</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
                  >
                    <option value="name">Sort by Name</option>
                    <option value="memberCount">Sort by Size</option>
                    <option value="lastUpdated">Sort by Last Updated</option>
                    <option value="lastMembershipUpdated">Sort by Last Activity</option>
                    <option value="stalenessScore">Sort by Staleness</option>
                  </select>
                </div>
              )}

              {/* Selection Controls Bar - Only show in cached mode */}
              {searchMode === 'cached' && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">
                      {selectedGroupIds.size} of {filteredGroups.length} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-sm text-[#007dc1] hover:text-[#005a8f] font-medium transition-colors hover:underline"
                        onClick={handleSelectAll}
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        className="text-sm text-[#007dc1] hover:text-[#005a8f] font-medium transition-colors hover:underline"
                        onClick={handleDeselectAll}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedGroupIds.size > 0 && (
                      <button
                        className="px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow flex items-center gap-2"
                        onClick={exportMultiGroupMembers}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export ({selectedGroupIds.size})
                      </button>
                    )}
                    <button
                      className="px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow flex items-center gap-2"
                      onClick={handleLoadGroupsClick}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                </div>
              )}

              {error && <div className="alert alert-error">{error}</div>}

              {loading && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading groups from Okta...</p>
                </div>
              )}

              {/* Results List */}
              {filteredGroups.length > 0 && (
                <div className="space-y-3">
                  {filteredGroups.map((group) => (
                    <GroupListItem
                      key={group.id}
                      group={group}
                      selected={selectedGroupIds.has(group.id)}
                      onToggleSelect={handleToggleSelect}
                      oktaOrigin={oktaOrigin}
                    />
                  ))}
                </div>
              )}

              {/* No results message - Live mode */}
              {searchMode === 'live' && liveSearchQuery.trim() && !isLiveSearching && filteredGroups.length === 0 && (
                <div className="text-center py-12 px-4 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-700 font-medium mb-1">No groups found matching "{liveSearchQuery}"</p>
                  <p className="text-sm text-gray-500">Try a different search term or load all groups for advanced filtering</p>
                </div>
              )}

              {/* No results message - Cached mode */}
              {searchMode === 'cached' && filteredGroups.length === 0 && groups.length > 0 && (
                <div className="text-center py-12 px-4 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-700 font-medium mb-1">No groups match your filters</p>
                  <p className="text-sm text-gray-500">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>

            {/* Group Collections - Only show in cached mode */}
            {searchMode === 'cached' && groups.length > 0 && (
              <GroupCollections
                selectedGroupIds={Array.from(selectedGroupIds)}
                onLoadCollection={handleLoadCollection}
              />
            )}
          </>
        )}

        {/* Bulk Operations View */}
        {viewMode === 'bulk' && (
          <BulkOperations
            selectedGroupIds={Array.from(selectedGroupIds)}
            onExecute={api.executeBulkOperation}
          />
        )}

        {/* Group Comparison View */}
        {viewMode === 'compare' && (
          <GroupComparison
            selectedGroupIds={Array.from(selectedGroupIds)}
            onCompare={api.compareGroups}
          />
        )}
      </div>

      {/* Load Options Modal */}
      {showLoadOptionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowLoadOptionsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Load All Groups</h3>
            <p className="text-sm text-gray-600 mb-6">
              Choose whether to include Group Push mappings. This shows which apps OKTA groups are pushed to, but is slower.
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleConfirmLoad(false)}
                className="w-full px-4 py-3 text-left bg-white border-2 border-gray-200 rounded-lg hover:border-[#007dc1] hover:bg-blue-50 transition-all group"
              >
                <div className="font-medium text-gray-900 group-hover:text-[#007dc1]">Fast Load</div>
                <div className="text-xs text-gray-500 mt-1">Load groups without push mappings (Recommended)</div>
              </button>

              <button
                onClick={() => handleConfirmLoad(true)}
                className="w-full px-4 py-3 text-left bg-white border-2 border-gray-200 rounded-lg hover:border-[#007dc1] hover:bg-blue-50 transition-all group"
              >
                <div className="font-medium text-gray-900 group-hover:text-[#007dc1]">Full Load</div>
                <div className="text-xs text-gray-500 mt-1">Include push group mappings (slower)</div>
              </button>
            </div>

            <button
              onClick={() => setShowLoadOptionsModal(false)}
              className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsTab;
