/**
 * @module sidepanel/components/groups/GroupsListPanel
 * @description The scrollable groups list plus its mode-specific empty states.
 *
 * Renders one {@link GroupListItem} per filtered group inside a shared ScrollableList,
 * and picks the appropriate empty state for live-search vs cached-with-filters.
 */
import React from 'react';
import EmptyState from '../shared/EmptyState';
import ScrollableList from '../shared/ScrollableList';
import GroupListItem from './GroupListItem';
import type { GroupSummary } from '../../../shared/types';

interface GroupsListPanelProps {
  /** Whether the initial group load is in progress. */
  loading: boolean;
  /** `live` queries Okta directly; `cached` filters the loaded list. */
  searchMode: 'live' | 'cached';
  /** Current live-search query (drives the live empty-state copy). */
  liveSearchQuery: string;
  /** Whether a live search is in flight (suppresses the "no results" state). */
  isLiveSearching: boolean;
  /** groups.length > 0 — gates the cached-mode empty state. */
  hasGroups: boolean;
  /** Active-filter count — gates the "Clear Filters" empty-state action. */
  activeFilterCount: number;
  /** Groups to render after filtering/sorting. */
  filteredGroups: GroupSummary[];
  /** Ids of the currently selected groups. */
  selectedGroupIds: Set<string>;
  /** Toggles selection for a group id. */
  onToggleSelect: (groupId: string) => void;
  /** Okta origin passed to each row for deep-linking. */
  oktaOrigin?: string;
  /** Switches to cached mode by loading all groups (live empty-state action). */
  onLoadAllGroups: () => void;
  /** Clears all filters (cached empty-state action). */
  onClearFilters: () => void;
  /** Opens the read-only membership-source insight for a group (A2). */
  onAnalyzeSource?: (group: GroupSummary) => void;
  /** Group id to highlight (deep-link target from the Rules tab). */
  highlightedGroupId?: string;
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
  onAnalyzeSource,
  highlightedGroupId,
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
        onAnalyzeSource={onAnalyzeSource}
        isHighlighted={highlightedGroupId === group.id}
      />
    ))}
  </ScrollableList>
);

export default GroupsListPanel;
