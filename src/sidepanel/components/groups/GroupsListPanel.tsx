import React from 'react';
import EmptyState from '../shared/EmptyState';
import ScrollableList from '../shared/ScrollableList';
import GroupListItem from './GroupListItem';
import type { GroupSummary } from '../../../shared/types';

interface GroupsListPanelProps {
  loading: boolean;
  searchMode: 'live' | 'cached';
  liveSearchQuery: string;
  isLiveSearching: boolean;
  /** groups.length > 0 — gates the cached-mode empty state. */
  hasGroups: boolean;
  activeFilterCount: number;
  filteredGroups: GroupSummary[];
  selectedGroupIds: Set<string>;
  onToggleSelect: (groupId: string) => void;
  oktaOrigin?: string;
  onLoadAllGroups: () => void;
  onClearFilters: () => void;
}

/**
 * The scrollable group list plus its two mutually-exclusive empty states. The
 * three-way empty-state condition (live+query+not-searching / cached+hasGroups /
 * otherwise none) is preserved verbatim.
 */
const GroupsListPanel: React.FC<GroupsListPanelProps> = ({
  loading,
  searchMode,
  liveSearchQuery,
  isLiveSearching,
  hasGroups,
  activeFilterCount,
  filteredGroups,
  selectedGroupIds,
  onToggleSelect,
  oktaOrigin,
  onLoadAllGroups,
  onClearFilters,
}) => (
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
          actions={[{ label: 'Load All Groups', onClick: onLoadAllGroups, variant: 'primary' }]}
        />
      ) : searchMode === 'cached' && hasGroups ? (
        <EmptyState
          icon="users"
          title="No groups match your filters"
          description="Try adjusting your search or filter criteria"
          actions={
            activeFilterCount > 0
              ? [{ label: 'Clear Filters', onClick: onClearFilters, variant: 'secondary' }]
              : undefined
          }
        />
      ) : undefined
    }
  >
    {filteredGroups.map((group) => (
      <GroupListItem
        key={group.id}
        group={group}
        selected={selectedGroupIds.has(group.id)}
        onToggleSelect={onToggleSelect}
        oktaOrigin={oktaOrigin}
      />
    ))}
  </ScrollableList>
);

export default GroupsListPanel;
