import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PageHeader from './shared/PageHeader';
import { useOktaApi } from '../hooks/useOktaApi';
import type { GroupSummary, LinkedGroup } from '../../shared/types';
import GroupListItem from './groups/GroupListItem';
import GroupCollections from './groups/GroupCollections';
import CrossGroupUserSearch from './groups/CrossGroupUserSearch';
import BulkOperations from './groups/BulkOperations';
import GroupComparison from './groups/GroupComparison';
import { applyStalenessScore } from '../../shared/utils/stalenessCalculator';

interface GroupsTabProps {
  targetTabId: number | null;
  oktaOrigin?: string;
}

type ViewMode = 'browse' | 'search' | 'bulk' | 'compare';

const GROUPS_CACHE_KEY = 'okta_unbound_groups_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

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

  const api = useOktaApi({
    targetTabId,
    onResult: (message, type) => {
      if (type === 'error') {
        setError(message);
      }
    },
  });

  // Load groups from cache on mount
  useEffect(() => {
    chrome.storage.local.get([GROUPS_CACHE_KEY], (result) => {
      if (result[GROUPS_CACHE_KEY]) {
        try {
          const cached = JSON.parse(result[GROUPS_CACHE_KEY] as string);
          const age = Date.now() - cached.timestamp;
          if (age < CACHE_DURATION) {
            setGroups(cached.groups.map((g: any) => ({
              ...g,
              // Convert all date strings back to Date objects
              lastUpdated: g.lastUpdated ? new Date(g.lastUpdated) : undefined,
              lastMembershipUpdated: g.lastMembershipUpdated ? new Date(g.lastMembershipUpdated) : undefined,
              created: g.created ? new Date(g.created) : undefined,
            })));
          }
        } catch (err) {
          console.error('Failed to parse groups cache:', err);
        }
      }
    });
  }, []);

  const loadAllGroups = async () => {
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

      // Collect unique app IDs from APP_GROUPs
      const appIdsFromGroups = new Set<string>();
      groupSummaries.forEach(g => {
        if (g.sourceAppId) {
          appIdsFromGroups.add(g.sourceAppId);
        }
      });

      // Fetch app details and push group mappings in parallel
      const appNameMap = new Map<string, string>();
      // Maps sourceUserGroupId (Okta group) -> array of { appId, appName } for each app it's pushed to
      const pushGroupMappings = new Map<string, Array<{ appId: string; appName?: string }>>();

      if (appIdsFromGroups.size > 0) {
        const appPromises = Array.from(appIdsFromGroups).map(async (appId) => {
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

            // Process push group mappings
            // Each mapping shows which OKTA_GROUP is pushed to this app
            for (const mapping of mappingsResult) {
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
                }
              }
            }

            return { appId, label: appLabel };
          } catch (err) {
            console.warn(`Failed to fetch details for app ${appId}:`, err);
            return { appId, label: null };
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

      // Apply push group mappings to OKTA_GROUPs
      const mergedGroups = applyPushGroupMappings(groupSummaries, pushGroupMappings);

      setGroups(mergedGroups);

      // Cache the results
      chrome.storage.local.set({
        [GROUPS_CACHE_KEY]: JSON.stringify({
          groups: mergedGroups,
          timestamp: Date.now(),
        }),
      });
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

  const handleRemoveUserFromGroups = async (userId: string, groupIds: string[]) => {
    for (const groupId of groupIds) {
      await api.makeApiRequest(`/api/v1/groups/${groupId}/users/${userId}`, 'DELETE');
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  };

  // Filter and sort groups
  const filteredGroups = useMemo(() => {
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
  }, [groups, searchQuery, typeFilter, sizeFilter, stalenessFilter, sortBy]);

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
        title="Multi-Group Operations"
        subtitle="Browse, search, compare, and manage multiple groups"
        icon="users"
        badge={selectedGroupIds.size > 0 ? { text: `${selectedGroupIds.size} Selected`, variant: 'primary' } : undefined}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* View Mode Selector */}
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
              ${viewMode === 'search'
                ? 'bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }
            `}
            onClick={() => setViewMode('search')}
          >
            Find User
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

        {/* Browse Groups View */}
        {viewMode === 'browse' && (
          <>
            <div className="space-y-4">
              {groups.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <button
                    className="px-6 py-3 text-base font-semibold bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 disabled:hover:translate-y-0"
                    onClick={loadAllGroups}
                    disabled={loading || !targetTabId}
                  >
                    {loading ? 'Loading Groups...' : 'Load All Groups'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Search Bar */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search groups by name, description, or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
                    />
                  </div>

                  {/* Filters Row */}
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

                  {/* Selection Controls Bar */}
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
                        onClick={loadAllGroups}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>
                  </div>
                </>
              )}

              {error && <div className="alert alert-error">{error}</div>}

              {loading && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading groups from Okta...</p>
                </div>
              )}

              {groups.length > 0 && (
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
            </div>

            {groups.length > 0 && (
              <GroupCollections
                selectedGroupIds={Array.from(selectedGroupIds)}
                onLoadCollection={handleLoadCollection}
              />
            )}
          </>
        )}

        {/* Cross-Group User Search View */}
        {viewMode === 'search' && (
          <CrossGroupUserSearch
            targetTabId={targetTabId}
            onFindUser={api.findUserAcrossGroups}
            onRemoveFromGroups={handleRemoveUserFromGroups}
            oktaOrigin={oktaOrigin}
          />
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
    </div>
  );
};

export default GroupsTab;
