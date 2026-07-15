import React, { useState, useCallback } from 'react';
import PageHeader from './shared/PageHeader';
import AlertMessage from './shared/AlertMessage';
import Button from './shared/Button';
import { useOktaApi } from '../hooks/useOktaApi';
import { useGroupsLoader } from '../hooks/useGroupsLoader';
import { useGroupLiveSearch } from '../hooks/useGroupLiveSearch';
import { useGroupFilters } from '../hooks/useGroupFilters';
import { useGroupSelection } from '../hooks/useGroupSelection';
import { useGroupMembersCache } from '../hooks/useGroupMembersCache';
import type { GroupSummary } from '../../shared/types';
import GroupExportModal from './groups/GroupExportModal';
import GroupComparisonModal from './groups/GroupComparisonModal';
import CrossGroupSearch from './groups/CrossGroupSearch';
import BulkOperationsPanel from './groups/BulkOperationsPanel';
import GroupCollections from './groups/GroupCollections';
import GroupSearchBar from './groups/GroupSearchBar';
import GroupFilterToggle from './groups/GroupFilterToggle';
import GroupFilterPanel from './groups/GroupFilterPanel';
import GroupSelectionBar, { type ActivePanel } from './groups/GroupSelectionBar';
import GroupsListPanel from './groups/GroupsListPanel';
import { getDateForFilename } from '../../shared/utils/csvUtils';

interface GroupsTabProps {
  targetTabId: number | null;
  oktaOrigin?: string;
}

const GroupsTab: React.FC<GroupsTabProps> = ({ targetTabId, oktaOrigin }) => {
  // Shell-owned state: error has three producers (loader, live search, useOktaApi
  // onResult) so it stays here; searchMode is read by three hooks so it stays above
  // them; showFilters and the modal/panel flags are pure UI.
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'live' | 'cached'>('live');
  const [showFilters, setShowFilters] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportGroups, setExportGroups] = useState<GroupSummary[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');

  // Must be stable: useOktaApi memoizes its operations on this callback's identity.
  const handleResult = useCallback(
    (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
      if (type === 'error') setError(message);
    },
    [],
  );

  const api = useOktaApi({ targetTabId, onResult: handleResult });

  const liveSearch = useGroupLiveSearch({ targetTabId, searchMode, setError });
  const loader = useGroupsLoader({
    api,
    setError,
    setSearchMode,
    onLoaded: liveSearch.resetLiveSearch,
  });
  const filters = useGroupFilters({
    groups: loader.groups,
    searchMode,
    liveSearchResults: liveSearch.liveSearchResults,
  });
  const selection = useGroupSelection(loader.groups);
  const membersCache = useGroupMembersCache(api, loader.groups);

  const { groups, loading, loadAllGroups } = loader;
  const { filteredGroups, activeFilterCount } = filters;
  const { selectedGroupIds, selectedGroups } = selection;

  const handleExportSelection = useCallback(() => {
    if (selectedGroupIds.size === 0) {
      alert('Please select at least one group');
      return;
    }
    setExportGroups(groups.filter((g) => selectedGroupIds.has(g.id)));
    setShowExportModal(true);
  }, [selectedGroupIds, groups]);

  const handleExportGroupsList = useCallback(() => {
    const headers = [
      'ID',
      'Name',
      'Description',
      'Type',
      'Member Count',
      'Staleness Score',
      'Push Status',
    ];
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
    a.download = `okta_groups_${getDateForFilename()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredGroups]);

  const togglePanel = useCallback((panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  }, []);

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Groups"
        subtitle="Browse, search, and manage groups"
        badge={
          selectedGroupIds.size > 0
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
            <Button variant="secondary" icon="refresh" onClick={loadAllGroups} loading={loading}>
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
              <GroupSearchBar
                searchMode={searchMode}
                liveSearchQuery={liveSearch.liveSearchQuery}
                onLiveSearchQueryChange={liveSearch.setLiveSearchQuery}
                searchQuery={filters.searchQuery}
                onSearchQueryChange={filters.setSearchQuery}
                isLiveSearching={liveSearch.isLiveSearching}
              />

              {searchMode === 'cached' && (
                <GroupFilterToggle
                  showFilters={showFilters}
                  activeFilterCount={activeFilterCount}
                  onToggle={() => setShowFilters((prev) => !prev)}
                />
              )}
            </div>

            {/* Expandable Filter Panel */}
            {searchMode === 'cached' && showFilters && (
              <GroupFilterPanel
                activeFilterCount={activeFilterCount}
                typeFilter={filters.typeFilter}
                setTypeFilter={filters.setTypeFilter}
                sizeFilter={filters.sizeFilter}
                setSizeFilter={filters.setSizeFilter}
                pushFilter={filters.pushFilter}
                setPushFilter={filters.setPushFilter}
                pushAppFilter={filters.pushAppFilter}
                setPushAppFilter={filters.setPushAppFilter}
                stalenessFilter={filters.stalenessFilter}
                setStalenessFilter={filters.setStalenessFilter}
                availablePushApps={filters.availablePushApps}
                sortBy={filters.sortBy}
                sortDesc={filters.sortDesc}
                toggleSort={filters.toggleSort}
                clearFilters={filters.clearFilters}
              />
            )}

            {/* Selection & Action Bar - Only in cached mode */}
            {searchMode === 'cached' && (
              <GroupSelectionBar
                selectedCount={selectedGroupIds.size}
                filteredCount={filteredGroups.length}
                activePanel={activePanel}
                crossSearchBadge={membersCache.groupMembersCache.size}
                onSelectAll={() => selection.replaceSelection(filteredGroups.map((g) => g.id))}
                onDeselectAll={selection.deselectAll}
                onCompare={() => setShowComparisonModal(true)}
                onTogglePanel={togglePanel}
                onExportSelection={handleExportSelection}
                onExportGroupsList={handleExportGroupsList}
              />
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
                groupMembersCache={membersCache.groupMembersCache}
                groupNames={membersCache.groupNames}
                searchUserAcrossGroups={api.searchUserAcrossGroups}
                onRemoveUserFromGroups={membersCache.removeUserFromGroups}
                onClose={() => setActivePanel('none')}
              />
            )}

            {activePanel === 'collections' && (
              <GroupCollections
                selectedGroupIds={selectedGroupIds}
                groups={groups}
                onLoadCollection={selection.replaceSelection}
                onClose={() => setActivePanel('none')}
              />
            )}

            {error && (
              <AlertMessage
                message={{ text: error, type: 'danger' }}
                onDismiss={() => setError(null)}
              />
            )}
          </div>

          {/* Scrollable Group List */}
          <GroupsListPanel
            loading={loading}
            searchMode={searchMode}
            liveSearchQuery={liveSearch.liveSearchQuery}
            isLiveSearching={liveSearch.isLiveSearching}
            hasGroups={groups.length > 0}
            activeFilterCount={activeFilterCount}
            filteredGroups={filteredGroups}
            selectedGroupIds={selectedGroupIds}
            onToggleSelect={selection.toggleSelect}
            oktaOrigin={oktaOrigin}
            onLoadAllGroups={loadAllGroups}
            onClearFilters={filters.clearFilters}
          />
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
        onFetchMembers={membersCache.fetchMembers}
      />

      {/* Comparison Modal */}
      <GroupComparisonModal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        groups={selectedGroups}
        compareGroups={api.compareGroups}
        memberCache={membersCache.groupMembersCache}
      />
    </div>
  );
};

export default GroupsTab;
