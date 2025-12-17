import React, { useState, useEffect, useMemo } from 'react';
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

  const handleToggleSelect = (groupId: string) => {
    const newSelected = new Set(selectedGroupIds);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroupIds(newSelected);
  };

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
    <div className="tab-content active">
      <div className="section">
        <div className="section-header">
          <div>
            <h2>Multi-Group Operations</h2>
            <p className="section-description">
              Manage and operate on multiple groups at once
            </p>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="view-mode-selector">
          <button
            className={`view-mode-btn ${viewMode === 'browse' ? 'active' : ''}`}
            onClick={() => setViewMode('browse')}
          >
            Browse Groups
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'search' ? 'active' : ''}`}
            onClick={() => setViewMode('search')}
          >
            Find User
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'bulk' ? 'active' : ''}`}
            onClick={() => setViewMode('bulk')}
          >
            Bulk Operations
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'compare' ? 'active' : ''}`}
            onClick={() => setViewMode('compare')}
          >
            Compare Groups
          </button>
        </div>

        {/* Browse Groups View */}
        {viewMode === 'browse' && (
          <>
            <div className="groups-browser">
              <div className="browser-controls">
                {groups.length === 0 ? (
                  <button
                    className="btn-primary btn-large"
                    onClick={loadAllGroups}
                    disabled={loading || !targetTabId}
                  >
                    {loading ? 'Loading Groups...' : 'Load All Groups'}
                  </button>
                ) : (
                  <>
                    <div className="search-box">
                      <input
                        type="text"
                        placeholder="Search groups by name, description, or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    <div className="filters">
                      <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="">All Types</option>
                        <option value="OKTA_GROUP">Okta Groups</option>
                        <option value="APP_GROUP">App Groups</option>
                        <option value="BUILT_IN">Built-in Groups</option>
                      </select>

                      <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
                        <option value="">All Sizes</option>
                        <option value="empty">Empty (0 members)</option>
                        <option value="small">Small (1-50 members)</option>
                        <option value="medium">Medium (50-200 members)</option>
                        <option value="large">Large (200-1000 members)</option>
                        <option value="xlarge">X-Large (1000+ members)</option>
                      </select>

                      <select value={stalenessFilter} onChange={(e) => setStalenessFilter(e.target.value)}>
                        <option value="">All Activity Levels</option>
                        <option value="stale">Stale Groups</option>
                        <option value="active">Active Groups</option>
                      </select>

                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                        <option value="name">Sort by Name</option>
                        <option value="memberCount">Sort by Size</option>
                        <option value="lastUpdated">Sort by Last Updated</option>
                        <option value="lastMembershipUpdated">Sort by Last Activity</option>
                        <option value="stalenessScore">Sort by Staleness</option>
                      </select>
                    </div>

                    <div className="selection-controls">
                      <span className="selection-count">
                        {selectedGroupIds.size} of {filteredGroups.length} selected
                      </span>
                      <button className="btn-link" onClick={handleSelectAll}>
                        Select All
                      </button>
                      <button className="btn-link" onClick={handleDeselectAll}>
                        Deselect All
                      </button>
                      {selectedGroupIds.size > 0 && (
                        <button className="btn-secondary" onClick={exportMultiGroupMembers}>
                          Export Selected ({selectedGroupIds.size})
                        </button>
                      )}
                      <button className="btn-secondary" onClick={loadAllGroups}>
                        Refresh
                      </button>
                    </div>
                  </>
                )}
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              {loading && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading groups from Okta...</p>
                </div>
              )}

              {groups.length > 0 && (
                <div className="groups-list">
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
