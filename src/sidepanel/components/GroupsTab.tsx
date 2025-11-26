import React, { useState, useEffect, useMemo } from 'react';
import { useOktaApi } from '../hooks/useOktaApi';
import type { GroupSummary, LinkedGroup } from '../../shared/types';
import GroupListItem from './groups/GroupListItem';
import GroupCollections from './groups/GroupCollections';
import CrossGroupUserSearch from './groups/CrossGroupUserSearch';
import BulkOperations from './groups/BulkOperations';
import GroupComparison from './groups/GroupComparison';

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
  const [sortBy, setSortBy] = useState<'name' | 'memberCount' | 'lastUpdated'>('name');

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
              lastUpdated: g.lastUpdated ? new Date(g.lastUpdated) : undefined,
            })));
          }
        } catch (err) {
          console.error('Failed to parse groups cache:', err);
        }
      }
    });
  }, []);

  // Normalize group name for matching (remove common prefixes/suffixes from app push groups)
  const normalizeGroupName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/^(azure|google|salesforce|slack|okta|ad|ldap)[\s_-]*/i, '')
      .replace(/[\s_-]*(push|sync|app)$/i, '')
      .trim();
  };

  const loadAllGroups = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all groups (paginated automatically)
      const allGroups = await api.getAllGroups((_loaded, _total) => {
        // Progress callback
      });

      // Transform to GroupSummary format with member counts (parallel API calls)
      // This is the original approach - Okta's rate limiting handles the parallelism
      const groupSummaries: GroupSummary[] = await Promise.all(
        allGroups.map(async (group: any) => {
          // Get member count - 1 API call per group
          const memberCount = await api.getGroupMemberCount(group.id);

          // Extract source app info from existing data (no API call needed)
          // Only set sourceAppName if we have a real name, not just the ID
          let sourceAppId: string | undefined;
          let sourceAppName: string | undefined;

          if (group.type === 'APP_GROUP') {
            // Try to get app ID from _links
            if (group._links?.apps?.href) {
              const appIdMatch = group._links.apps.href.match(/\/apps\/([^/]+)/);
              if (appIdMatch) {
                sourceAppId = appIdMatch[1];
                // Don't set sourceAppName to the ID - leave it undefined
              }
            }
            // Prefer source object if available (it may have the actual name)
            if (group.source) {
              sourceAppId = group.source.id;
              // Only use name if it's an actual name, not the ID
              if (group.source.name && group.source.name !== group.source.id) {
                sourceAppName = group.source.name;
              }
            }
          }

          return {
            id: group.id,
            name: group.profile?.name || group.id,
            description: group.profile?.description,
            type: group.type,
            memberCount,
            lastUpdated: group.lastUpdated ? new Date(group.lastUpdated) : undefined,
            hasRules: false, // Skip rules for speed - can be loaded on-demand
            ruleCount: 0,
            selected: false,
            sourceAppId,
            sourceAppName,
          };
        })
      );

      // Resolve app names for groups that have sourceAppId but no sourceAppName
      const appIdsNeedingNames = new Set<string>();
      groupSummaries.forEach(g => {
        if (g.sourceAppId && !g.sourceAppName) {
          appIdsNeedingNames.add(g.sourceAppId);
        }
      });

      // Fetch app details in parallel to get friendly names
      const appNameMap = new Map<string, string>();
      if (appIdsNeedingNames.size > 0) {
        const appDetailsPromises = Array.from(appIdsNeedingNames).map(async (appId) => {
          try {
            const details = await api.getAppDetails(appId);
            return { appId, label: details.app.label };
          } catch (err) {
            console.warn(`Failed to fetch app details for ${appId}:`, err);
            return { appId, label: null };
          }
        });

        const results = await Promise.all(appDetailsPromises);
        results.forEach(({ appId, label }) => {
          if (label) {
            appNameMap.set(appId, label);
          }
        });

        // Update groups with resolved app names
        groupSummaries.forEach(g => {
          if (g.sourceAppId && !g.sourceAppName && appNameMap.has(g.sourceAppId)) {
            g.sourceAppName = appNameMap.get(g.sourceAppId);
          }
        });
      }

      // Detect and merge push groups (pass appNameMap to resolve linked group names)
      const mergedGroups = mergePushGroups(groupSummaries, appNameMap);

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

  // Merge OKTA_GROUP and APP_GROUP pairs that represent push groups
  const mergePushGroups = (summaries: GroupSummary[], appNameMap: Map<string, string>): GroupSummary[] => {
    const oktaGroups = summaries.filter(g => g.type === 'OKTA_GROUP');
    const appGroups = summaries.filter(g => g.type === 'APP_GROUP');
    const builtInGroups = summaries.filter(g => g.type === 'BUILT_IN');

    // Track which APP_GROUPs have been merged
    const mergedAppGroupIds = new Set<string>();

    // For each OKTA_GROUP, find matching APP_GROUPs
    const mergedOktaGroups = oktaGroups.map(oktaGroup => {
      const normalizedName = normalizeGroupName(oktaGroup.name);

      // Find APP_GROUPs with similar names
      const linkedAppGroups = appGroups.filter(appGroup => {
        if (mergedAppGroupIds.has(appGroup.id)) return false;

        const appNormalizedName = normalizeGroupName(appGroup.name);

        // Match if names are similar (exact match or one contains the other)
        return normalizedName === appNormalizedName ||
               appGroup.name.toLowerCase().includes(oktaGroup.name.toLowerCase()) ||
               oktaGroup.name.toLowerCase().includes(appGroup.name.toLowerCase().replace(/\s*\(.*\)$/, ''));
      });

      if (linkedAppGroups.length > 0) {
        // Mark these APP_GROUPs as merged
        linkedAppGroups.forEach(g => mergedAppGroupIds.add(g.id));

        // Create linked groups array, resolving app names from the map
        const linkedGroups: LinkedGroup[] = linkedAppGroups.map(g => ({
          id: g.id,
          name: g.name,
          type: g.type,
          sourceAppId: g.sourceAppId,
          sourceAppName: g.sourceAppName || (g.sourceAppId ? appNameMap.get(g.sourceAppId) : undefined),
          memberCount: g.memberCount,
        }));

        return {
          ...oktaGroup,
          isPushGroup: true,
          linkedGroups,
        };
      }

      return oktaGroup;
    });

    // Include unmerged APP_GROUPs
    const unmergedAppGroups = appGroups.filter(g => !mergedAppGroupIds.has(g.id));

    return [...mergedOktaGroups, ...unmergedAppGroups, ...builtInGroups];
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
          case 'small':
            return g.memberCount < 50;
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
        default:
          return 0;
      }
    });

    return filtered;
  }, [groups, searchQuery, typeFilter, sizeFilter, sortBy]);

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
                        <option value="small">&lt; 50 members</option>
                        <option value="medium">50-200 members</option>
                        <option value="large">200-1000 members</option>
                        <option value="xlarge">1000+ members</option>
                      </select>

                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                        <option value="name">Sort by Name</option>
                        <option value="memberCount">Sort by Size</option>
                        <option value="lastUpdated">Sort by Last Updated</option>
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
