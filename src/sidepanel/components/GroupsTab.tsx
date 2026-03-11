import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PageHeader from './shared/PageHeader';
import AlertMessage from './shared/AlertMessage';
import Button from './shared/Button';
import EmptyState from './shared/EmptyState';
import ScrollableList from './shared/ScrollableList';
import { useOktaApi } from '../hooks/useOktaApi';
import type { GroupSummary, OktaUser } from '../../shared/types';
import GroupListItem from './groups/GroupListItem';
import GroupExportModal from './groups/GroupExportModal';
import GroupComparisonModal from './groups/GroupComparisonModal';
import CrossGroupSearch from './groups/CrossGroupSearch';
import BulkOperationsPanel from './groups/BulkOperationsPanel';
import GroupCollections from './groups/GroupCollections';

interface GroupsTabProps {
  targetTabId: number | null;
  oktaOrigin?: string;
}

const GROUPS_CACHE_KEY = 'okta_unbound_groups_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day

type ActivePanel = 'none' | 'bulk' | 'crossSearch' | 'collections';
type SortField = 'name' | 'memberCount' | 'lastUpdated' | 'staleness';
type StalenessLevel = '' | 'healthy' | 'monitor' | 'stale' | 'very_stale';
type PushFilter = '' | 'pushed' | 'not_pushed';

const GroupsTab: React.FC<GroupsTabProps> = ({ targetTabId, oktaOrigin }) => {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sizeFilter, setSizeFilter] = useState<string>('');
  const [pushFilter, setPushFilter] = useState<PushFilter>('');
  const [pushAppFilter, setPushAppFilter] = useState<Set<string>>(new Set());
  const [stalenessFilter, setStalenessFilter] = useState<StalenessLevel>('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDesc, setSortDesc] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Active filter count for badge
  const activeFilterCount = [typeFilter, sizeFilter, pushFilter, stalenessFilter].filter(Boolean).length + (pushAppFilter.size > 0 ? 1 : 0);

  // Hybrid search mode state
  const [searchMode, setSearchMode] = useState<'live' | 'cached'>('live');
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState<GroupSummary[]>([]);
  const [isLiveSearching, setIsLiveSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modal/panel state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportGroups, setExportGroups] = useState<GroupSummary[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');

  // Group members cache (built up by comparison/export operations)
  const [groupMembersCache, setGroupMembersCache] = useState<Map<string, OktaUser[]>>(new Map());

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

      let groupSummaries: GroupSummary[] = allGroups.map((group: any) => {
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

      // Calculate staleness for each group
      groupSummaries = groupSummaries.map((g) => ({
        ...g,
        staleness: api.calculateStaleness(g),
      }));

      // Auto-detect and apply push group mappings
      try {
        groupSummaries = await api.applyPushGroupMappings(groupSummaries);
      } catch (err) {
        console.warn('[GroupsTab] Failed to load push group mappings:', err);
      }

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

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.id.toLowerCase().includes(q)
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
          case 'empty': return g.memberCount === 0;
          case 'small': return g.memberCount > 0 && g.memberCount < 50;
          case 'medium': return g.memberCount >= 50 && g.memberCount < 200;
          case 'large': return g.memberCount >= 200 && g.memberCount < 1000;
          case 'xlarge': return g.memberCount >= 1000;
          default: return true;
        }
      });
    }

    // Push filter
    if (pushFilter) {
      filtered = filtered.filter((g) => {
        const hasPush = g.pushMappings && g.pushMappings.length > 0;
        return pushFilter === 'pushed' ? hasPush : !hasPush;
      });
    }

    // Push App filter
    if (pushAppFilter.size > 0) {
      filtered = filtered.filter((g) => {
        if (!g.pushMappings || g.pushMappings.length === 0) return false;
        return g.pushMappings.some(m => pushAppFilter.has(m.appId));
      });
    }

    // Staleness filter
    if (stalenessFilter) {
      filtered = filtered.filter((g) => {
        const score = g.staleness?.score || 0;
        switch (stalenessFilter) {
          case 'healthy': return score <= 25;
          case 'monitor': return score > 25 && score <= 50;
          case 'stale': return score > 50 && score <= 75;
          case 'very_stale': return score > 75;
          default: return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'memberCount':
          cmp = a.memberCount - b.memberCount;
          break;
        case 'lastUpdated':
          if (!a.lastUpdated) cmp = 1;
          else if (!b.lastUpdated) cmp = -1;
          else cmp = a.lastUpdated.getTime() - b.lastUpdated.getTime();
          break;
        case 'staleness':
          cmp = (a.staleness?.score || 0) - (b.staleness?.score || 0);
          break;
      }
      return sortDesc ? -cmp : cmp;
    });

    return filtered;
  }, [searchMode, liveSearchResults, groups, searchQuery, typeFilter, sizeFilter, pushFilter, pushAppFilter, stalenessFilter, sortBy, sortDesc]);

  const handleExportSelection = useCallback(() => {
    if (selectedGroupIds.size === 0) {
      alert('Please select at least one group');
      return;
    }
    setExportGroups(groups.filter((g) => selectedGroupIds.has(g.id)));
    setShowExportModal(true);
  }, [selectedGroupIds, groups]);

  const handleExportGroupsList = useCallback(() => {
    const headers = ['ID', 'Name', 'Description', 'Type', 'Member Count', 'Staleness Score', 'Push Status'];
    const rows = filteredGroups.map((g) => [
      g.id,
      g.name,
      g.description || '',
      g.type || '',
      String(g.memberCount ?? 0),
      String(g.staleness?.score ?? ''),
      g.pushMappings?.length ? `Pushed (${g.pushMappings.length})` : 'Not Pushed',
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
      const members = await apiRef.current.getAllGroupMembers(groupId);
      // Populate cache
      setGroupMembersCache((prev) => {
        const next = new Map(prev);
        next.set(groupId, members);
        return next;
      });
      return members;
    },
    []
  );

  const handleRemoveUserFromGroups = useCallback(async (userId: string, groupIds: string[]) => {
    for (const groupId of groupIds) {
      const groupName = groups.find((g) => g.id === groupId)?.name || groupId;
      await apiRef.current.makeApiRequest(`/api/v1/groups/${groupId}/users/${userId}`, 'DELETE');
      console.log(`[GroupsTab] Removed user ${userId} from group ${groupName}`);
    }
  }, [groups]);

  const handleLoadCollection = useCallback((groupIds: string[]) => {
    setSelectedGroupIds(new Set(groupIds));
  }, []);

  const groupNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const g of groups) {
      names.set(g.id, g.name);
    }
    return names;
  }, [groups]);

  const availablePushApps = useMemo(() => {
    const apps = new Map<string, string>();
    for (const group of groups) {
      if (group.pushMappings) {
        for (const mapping of group.pushMappings) {
          if (!apps.has(mapping.appId)) {
            apps.set(mapping.appId, mapping.appName || mapping.appId);
          }
        }
      }
    }
    return Array.from(apps.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groups]);

  const selectedGroups = useMemo(
    () => groups.filter((g) => selectedGroupIds.has(g.id)),
    [groups, selectedGroupIds]
  );

  const handleClearFilters = useCallback(() => {
    setTypeFilter('');
    setSizeFilter('');
    setPushFilter('');
    setPushAppFilter(new Set());
    setStalenessFilter('');
    setSearchQuery('');
  }, []);

  const togglePanel = useCallback((panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    if (sortBy === field) {
      setSortDesc((prev) => !prev);
    } else {
      setSortBy(field);
      setSortDesc(field !== 'name'); // default desc for numeric fields
    }
  }, [sortBy]);

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
          <div className="shrink-0 space-y-3">
            {/* Search Bar + Filter Toggle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
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
                    placeholder="Search by name, description, or ID..."
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

              {/* Filter Toggle Button */}
              {searchMode === 'cached' && (
                <button
                  onClick={() => setShowFilters((prev) => !prev)}
                  className={`px-4 py-3 rounded-md border text-sm font-medium transition-all duration-100 flex items-center gap-2 ${
                    showFilters || activeFilterCount > 0
                      ? 'bg-primary-light border-primary text-primary-text'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400'
                  }`}
                  title="Toggle filters"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-primary text-white min-w-[20px] text-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Expandable Filter Panel */}
            {searchMode === 'cached' && showFilters && (
              <div className="p-4 bg-white rounded-md border border-neutral-200 space-y-4 animate-in slide-in-from-top-2 duration-100">
                {/* Active Filters Chips */}
                {activeFilterCount > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-neutral-500">Active:</span>
                    {typeFilter && (
                      <FilterChip label={`Type: ${typeFilter.replace('_', ' ')}`} onRemove={() => setTypeFilter('')} />
                    )}
                    {sizeFilter && (
                      <FilterChip label={`Size: ${sizeFilter}`} onRemove={() => setSizeFilter('')} />
                    )}
                    {pushFilter && (
                      <FilterChip label={`Push: ${pushFilter}`} onRemove={() => setPushFilter('')} />
                    )}
                    {stalenessFilter && (
                      <FilterChip label={`Health: ${stalenessFilter.replace('_', ' ')}`} onRemove={() => setStalenessFilter('')} />
                    )}
                    {pushAppFilter.size > 0 && (
                      <FilterChip
                        label={`Apps: ${Array.from(pushAppFilter).map(id =>
                          availablePushApps.find(a => a.id === id)?.name || id
                        ).join(', ')}`}
                        onRemove={() => setPushAppFilter(new Set())}
                      />
                    )}
                    <button onClick={handleClearFilters} className="text-xs text-primary-text hover:underline ml-1">
                      Clear all
                    </button>
                  </div>
                )}

                {/* Filter Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Type Filter */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Group Type</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { value: '', label: 'All' },
                        { value: 'OKTA_GROUP', label: 'Okta' },
                        { value: 'APP_GROUP', label: 'App' },
                        { value: 'BUILT_IN', label: 'Built-in' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setTypeFilter(opt.value)}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            typeFilter === opt.value
                              ? 'bg-primary text-white'
                              : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Size Filter */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Group Size</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { value: '', label: 'All' },
                        { value: 'empty', label: 'Empty' },
                        { value: 'small', label: '1-50' },
                        { value: 'medium', label: '50-200' },
                        { value: 'large', label: '200-1K' },
                        { value: 'xlarge', label: '1K+' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSizeFilter(opt.value)}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            sizeFilter === opt.value
                              ? 'bg-primary text-white'
                              : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Push Status Filter */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Push Status</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { value: '' as PushFilter, label: 'All' },
                        { value: 'pushed' as PushFilter, label: 'Pushed' },
                        { value: 'not_pushed' as PushFilter, label: 'Not Pushed' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setPushFilter(opt.value)}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            pushFilter === opt.value
                              ? 'bg-primary text-white'
                              : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Health / Staleness Filter */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Group Health</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { value: '' as StalenessLevel, label: 'All', color: '' },
                        { value: 'healthy' as StalenessLevel, label: 'Healthy', color: 'bg-success-light text-success-text border-success-light' },
                        { value: 'monitor' as StalenessLevel, label: 'Monitor', color: 'bg-warning-light text-warning-text border-warning-light' },
                        { value: 'stale' as StalenessLevel, label: 'Stale', color: 'bg-warning-light text-danger-text border-warning-light' },
                        { value: 'very_stale' as StalenessLevel, label: 'Critical', color: 'bg-danger-light text-danger-text border-danger-light' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setStalenessFilter(opt.value)}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                            stalenessFilter === opt.value
                              ? 'bg-primary text-white border-primary'
                              : opt.color || 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Push Target App Filter */}
                {availablePushApps.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">Push Target App</label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setPushAppFilter(new Set())}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          pushAppFilter.size === 0
                            ? 'bg-primary text-white'
                            : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        All
                      </button>
                      {availablePushApps.map((app) => (
                        <button
                          key={app.id}
                          onClick={() => {
                            setPushAppFilter(prev => {
                              const next = new Set(prev);
                              if (next.has(app.id)) next.delete(app.id);
                              else next.add(app.id);
                              return next;
                            });
                          }}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            pushAppFilter.has(app.id)
                              ? 'bg-primary text-white'
                              : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {app.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sort Controls */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Sort by</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 'name' as SortField, label: 'Name' },
                      { value: 'memberCount' as SortField, label: 'Size' },
                      { value: 'lastUpdated' as SortField, label: 'Last Updated' },
                      { value: 'staleness' as SortField, label: 'Staleness' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => toggleSort(opt.value)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                          sortBy === opt.value
                            ? 'bg-primary text-white'
                            : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        {opt.label}
                        {sortBy === opt.value && (
                          <svg className={`w-3 h-3 transition-transform ${sortDesc ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Selection & Action Bar - Only in cached mode */}
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
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Compare Button */}
                  {selectedGroupIds.size >= 2 && selectedGroupIds.size <= 5 && (
                    <Button variant="secondary" size="sm" icon="chart" onClick={() => setShowComparisonModal(true)}>
                      Compare ({selectedGroupIds.size})
                    </Button>
                  )}

                  {/* Bulk Actions */}
                  {selectedGroupIds.size > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="list"
                      onClick={() => togglePanel('bulk')}
                      className={activePanel === 'bulk' ? 'ring-2 ring-primary/20' : ''}
                    >
                      Bulk Actions
                    </Button>
                  )}

                  {/* Cross-Group Search */}
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="search"
                    onClick={() => togglePanel('crossSearch')}
                    className={activePanel === 'crossSearch' ? 'ring-2 ring-primary/20' : ''}
                    badge={groupMembersCache.size > 0 ? String(groupMembersCache.size) : undefined}
                  >
                    Cross-Search
                  </Button>

                  {/* Collections */}
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="clipboard"
                    onClick={() => togglePanel('collections')}
                    className={activePanel === 'collections' ? 'ring-2 ring-primary/20' : ''}
                  >
                    Collections
                  </Button>

                  {/* Export buttons */}
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

            {/* Active Panel */}
            {activePanel === 'bulk' && selectedGroupIds.size > 0 && (
              <BulkOperationsPanel
                selectedGroups={selectedGroups}
                executeBulkOperation={api.executeBulkOperation}
                onClose={() => setActivePanel('none')}
                onExportSelection={handleExportSelection}
              />
            )}

            {activePanel === 'crossSearch' && (
              <CrossGroupSearch
                groupMembersCache={groupMembersCache}
                groupNames={groupNames}
                searchUserAcrossGroups={api.searchUserAcrossGroups}
                onRemoveUserFromGroups={handleRemoveUserFromGroups}
                onClose={() => setActivePanel('none')}
              />
            )}

            {activePanel === 'collections' && (
              <GroupCollections
                selectedGroupIds={selectedGroupIds}
                groups={groups}
                onLoadCollection={handleLoadCollection}
                onClose={() => setActivePanel('none')}
              />
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
                  actions={activeFilterCount > 0 ? [
                    { label: 'Clear Filters', onClick: handleClearFilters, variant: 'secondary' }
                  ] : undefined}
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

      {/* Comparison Modal */}
      <GroupComparisonModal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        groups={selectedGroups}
        compareGroups={api.compareGroups}
        memberCache={groupMembersCache}
      />
    </div>
  );
};

/** Small chip for showing active filters with remove button */
const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light text-primary-text rounded-full text-xs font-medium border border-primary-highlight">
    {label}
    <button onClick={onRemove} className="p-0.5 hover:bg-primary-highlight rounded-full transition-colors">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </span>
);

export default GroupsTab;
