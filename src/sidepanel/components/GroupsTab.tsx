import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PageHeader from './shared/PageHeader';
import AlertMessage from './shared/AlertMessage';
import Button from './shared/Button';
import EmptyState from './shared/EmptyState';
import ScrollableList from './shared/ScrollableList';
import { useOktaApi } from '../hooks/useOktaApi';
import type { GroupSummary } from '../../shared/types';
import GroupListItem from './groups/GroupListItem';
import GroupExportModal from './groups/GroupExportModal';

interface GroupsTabProps {
  targetTabId: number | null;
  oktaOrigin?: string;
}

const GROUPS_CACHE_KEY = 'okta_unbound_groups_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day

const GroupsTab: React.FC<GroupsTabProps> = ({ targetTabId, oktaOrigin }) => {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sizeFilter, setSizeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'memberCount' | 'lastUpdated'>('name');

  // Hybrid search mode state
  const [searchMode, setSearchMode] = useState<'live' | 'cached'>('live');
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState<GroupSummary[]>([]);
  const [isLiveSearching, setIsLiveSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportGroups, setExportGroups] = useState<GroupSummary[]>([]);

  const api = useOktaApi({
    targetTabId,
    onResult: (message, type) => {
      if (type === 'error') setError(message);
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
            const parsedGroups = cached.groups.map((g: any) => ({
              ...g,
              lastUpdated: g.lastUpdated ? new Date(g.lastUpdated) : undefined,
              created: g.created ? new Date(g.created) : undefined,
            }));
            setGroups(parsedGroups);
            setSearchMode('cached');
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
      const allGroups = await api.getAllGroups(() => {});

      const groupSummaries: GroupSummary[] = allGroups.map((group: any) => {
        const memberCount = group._embedded?.stats?.usersCount ?? 0;

        let sourceAppId: string | undefined;
        let sourceAppName: string | undefined;

        if (group.type === 'APP_GROUP') {
          if (group._links?.apps?.href) {
            const appIdMatch = group._links.apps.href.match(/\/apps\/([^/]+)/);
            if (appIdMatch) sourceAppId = appIdMatch[1];
          }
          if (group.source) {
            sourceAppId = group.source.id;
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
          created: group.created ? new Date(group.created) : undefined,
          hasRules: false,
          ruleCount: 0,
          selected: false,
          sourceAppId,
          sourceAppName,
        };
      });

      setGroups(groupSummaries);
      setSearchMode('cached');
      setLiveSearchQuery('');
      setLiveSearchResults([]);

      // Cache results
      chrome.storage.local.set({
        [GROUPS_CACHE_KEY]: JSON.stringify({
          groups: groupSummaries,
          timestamp: Date.now(),
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  // Live search handler
  const handleLiveSearch = useCallback(async (query: string) => {
    if (!targetTabId) {
      setError('No Okta tab connected');
      return;
    }

    if (!query.trim()) {
      setLiveSearchResults([]);
      return;
    }

    setIsLiveSearching(true);
    setError(null);

    try {
      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: 'searchGroups',
        query: query.trim(),
      });

      if (response.success) {
        const results = (response.data || []).map((group: any) => ({
          id: group.id,
          name: group.profile?.name || group.id,
          description: group.profile?.description,
          type: group.type,
          memberCount: group._embedded?.stats?.usersCount ?? 0,
          lastUpdated: group.lastUpdated ? new Date(group.lastUpdated) : undefined,
          created: group.created ? new Date(group.created) : undefined,
          hasRules: false,
          ruleCount: 0,
          selected: false,
        }));
        setLiveSearchResults(results);
      } else {
        setError(response.error || 'Failed to search groups');
        setLiveSearchResults([]);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to communicate with Okta tab');
      setLiveSearchResults([]);
    } finally {
      setIsLiveSearching(false);
    }
  }, [targetTabId]);

  // Debounced search effect
  useEffect(() => {
    if (searchMode === 'live') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        handleLiveSearch(liveSearchQuery);
      }, 300);
      return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      };
    }
  }, [liveSearchQuery, searchMode, handleLiveSearch]);

  const handleToggleSelect = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // Filter and sort groups
  const filteredGroups = useMemo(() => {
    if (searchMode === 'live') return liveSearchResults;

    let filtered = [...groups];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.id.toLowerCase().includes(q)
      );
    }

    if (typeFilter) {
      filtered = filtered.filter((g) => g.type === typeFilter);
    }

    if (sizeFilter) {
      filtered = filtered.filter((g) => {
        switch (sizeFilter) {
          case 'empty': return g.memberCount === 0;
          case 'small': return g.memberCount > 0 && g.memberCount < 50;
          case 'medium': return g.memberCount >= 50 && g.memberCount < 200;
          case 'large': return g.memberCount >= 200 && g.memberCount < 1000;
          case 'xlarge': return g.memberCount >= 1000;
          default: return true;
        }
      });
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'memberCount': return b.memberCount - a.memberCount;
        case 'lastUpdated':
          if (!a.lastUpdated) return 1;
          if (!b.lastUpdated) return -1;
          return b.lastUpdated.getTime() - a.lastUpdated.getTime();
        default: return 0;
      }
    });

    return filtered;
  }, [searchMode, liveSearchResults, groups, searchQuery, typeFilter, sizeFilter, sortBy]);

  const handleExportSelection = useCallback(() => {
    if (selectedGroupIds.size === 0) {
      alert('Please select at least one group');
      return;
    }
    setExportGroups(groups.filter((g) => selectedGroupIds.has(g.id)));
    setShowExportModal(true);
  }, [selectedGroupIds, groups]);

  const handleExportGroupsList = useCallback(() => {
    const headers = ['ID', 'Name', 'Description', 'Type', 'Member Count'];
    const rows = filteredGroups.map((g) => [
      g.id,
      g.name,
      g.description || '',
      g.type || '',
      String(g.memberCount ?? 0),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `okta_groups_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredGroups]);

  const apiRef = useRef(api);
  apiRef.current = api;

  const handleFetchMembers = useCallback(
    async (groupId: string) => {
      return await apiRef.current.getAllGroupMembers(groupId);
    },
    []
  );

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Groups"
        subtitle="Browse, search, and manage groups"
        badge={selectedGroupIds.size > 0
          ? { text: `${selectedGroupIds.size} Selected`, variant: 'primary' }
          : searchMode === 'cached'
            ? { text: `${groups.length} Cached`, variant: 'success' }
            : { text: 'Live', variant: 'primary' }
        }
        actions={
          searchMode === 'live' ? (
            <Button
              variant="primary"
              onClick={loadAllGroups}
              disabled={loading || !targetTabId}
              loading={loading}
            >
              Load All Groups
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon="refresh"
              onClick={loadAllGroups}
              loading={loading}
            >
              Refresh
            </Button>
          )
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
          {/* Fixed Header Section */}
          <div className="shrink-0 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searchMode === 'live' ? (
                <input
                  type="text"
                  placeholder="Search groups by name..."
                  value={liveSearchQuery}
                  onChange={(e) => setLiveSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-200 rounded-md text-sm placeholder-neutral-400 focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary transition-all duration-100"
                />
              ) : (
                <input
                  type="text"
                  placeholder="Search groups by name, description, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-200 rounded-md text-sm placeholder-neutral-400 focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary transition-all duration-100"
                />
              )}
              {isLiveSearching && (
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  <div className="w-5 h-5 border-2 border-neutral-200 border-t-primary rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            {/* Filters - Only in cached mode */}
            {searchMode === 'cached' && (
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-neutral-200 rounded-md bg-white focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary"
                >
                  <option value="">All Types</option>
                  <option value="OKTA_GROUP">Okta Groups</option>
                  <option value="APP_GROUP">App Groups</option>
                  <option value="BUILT_IN">Built-in Groups</option>
                </select>

                <select
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-neutral-200 rounded-md bg-white focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary"
                >
                  <option value="">All Sizes</option>
                  <option value="empty">Empty (0)</option>
                  <option value="small">Small (1-50)</option>
                  <option value="medium">Medium (50-200)</option>
                  <option value="large">Large (200-1000)</option>
                  <option value="xlarge">X-Large (1000+)</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-neutral-200 rounded-md bg-white focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary"
                >
                  <option value="name">Sort by Name</option>
                  <option value="memberCount">Sort by Size</option>
                  <option value="lastUpdated">Sort by Last Updated</option>
                </select>
              </div>
            )}

            {/* Selection Controls - Only in cached mode */}
            {searchMode === 'cached' && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 rounded-md border border-neutral-200">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-700">
                    {selectedGroupIds.size} of {filteredGroups.length} selected
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedGroupIds(new Set(filteredGroups.map(g => g.id)))}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedGroupIds(new Set())}>
                    Deselect All
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {selectedGroupIds.size > 0 && (
                    <Button variant="secondary" size="sm" icon="download" onClick={handleExportSelection}>
                      Export ({selectedGroupIds.size})
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="download"
                    onClick={handleExportGroupsList}
                    disabled={filteredGroups.length === 0}
                    title="Export the current groups list as CSV"
                  >
                    Export List
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <AlertMessage
                message={{ text: error, type: 'error' }}
                onDismiss={() => setError(null)}
              />
            )}
          </div>

          {/* Scrollable Group List */}
          <ScrollableList
            loading={loading}
            loadingMessage="Loading groups from Okta..."
            className="mt-4"
            emptyState={
              searchMode === 'live' && liveSearchQuery.trim() && !isLiveSearching ? (
                <EmptyState
                  icon="users"
                  title={`No groups found matching "${liveSearchQuery}"`}
                  description="Try a different search term or load all groups for advanced filtering"
                  actions={[
                    { label: 'Load All Groups', onClick: loadAllGroups, variant: 'primary' }
                  ]}
                />
              ) : searchMode === 'cached' && groups.length > 0 ? (
                <EmptyState
                  icon="users"
                  title="No groups match your filters"
                  description="Try adjusting your search or filter criteria"
                />
              ) : undefined
            }
          >
            {filteredGroups.map((group) => (
              <GroupListItem
                key={group.id}
                group={group}
                selected={selectedGroupIds.has(group.id)}
                onToggleSelect={handleToggleSelect}
                oktaOrigin={oktaOrigin}
              />
            ))}
          </ScrollableList>
        </div>
      </div>

      {/* Export Modal */}
      <GroupExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        groups={exportGroups}
        targetTabId={targetTabId}
        exportType="selection"
        collectionName=""
        onFetchMembers={handleFetchMembers}
      />
    </div>
  );
};

export default GroupsTab;
