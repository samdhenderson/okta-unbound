/**
 * @module sidepanel/components/groups/GroupsListPanel
 * @description The windowed groups list plus its mode-specific empty states.
 *
 * Renders one {@link GroupListItem} per visible filtered group inside a shared
 * `ScrollableList` — in its `scrolls={false}` mode, so the rows scroll the panel's
 * one scroller rather than a box of their own (ADR-0051 §5) — and picks the
 * appropriate empty state for live-search vs cached-with-filters. Only the first `visibleCount` rows are mounted (the same
 * incremental-window pattern as the member explorer's MemberList), growing via a
 * "Load more" footer and an IntersectionObserver sentinel so a 5000-group org
 * does not mount 5000 rich rows at once.
 *
 * The rows render inside a `.rise-in-stagger` wrapper driven by
 * `useStaggerReveal`: each row holds until it scrolls into view, then cascades
 * with the batch it arrived in. Rows are keyed by `group.id`, so paging in the
 * next 50 only appends fresh nodes at the bottom — the rows already on screen
 * keep their DOM nodes and do not replay their entrance.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStaggerReveal } from '../../hooks/useStaggerReveal';
import EmptyState from '../shared/EmptyState';
import ScrollableList from '../shared/ScrollableList';
import Skeleton from '../shared/Skeleton';
import Button from '../shared/Button';
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
  /** Drills into a group's read-only detail view (pushes onto the tab's view stack). */
  onOpenDetail?: (group: GroupSummary) => void;
  /**
   * Runs the (paid) member-source analysis for a group, offered per row while no
   * breakdown is cached. Rows never analyze on their own — see
   * {@link sidepanel/components/groups/GroupListItem}.
   */
  onAnalyzeSource?: (group: GroupSummary) => void;
  /** Group id to highlight (deep-link target from the Rules tab). */
  highlightedGroupId?: string;
  /**
   * Optional ref on the list's box. No longer a scroll container — the rung gave
   * that up so its strip could dock — but still handed down so a caller can find
   * the rows' box without a query.
   */
  scrollRef?: React.Ref<HTMLDivElement>;
}

/** Number of additional rows revealed per "Load more" (same as MemberList). */
const PAGE = 50;

/**
 * The scrollable group list plus its two mutually-exclusive empty states. The
 * three-way empty-state condition (live+query+not-searching / cached+hasGroups /
 * otherwise none) is preserved verbatim.
 *
 * Windowing: only the first `visibleCount` rows are mounted, growing by
 * {@link PAGE} via the footer button or the sentinel auto-pager; the window
 * resets whenever the filtered result set changes. A deep-linked
 * `highlightedGroupId` outside the window raises `visibleCount` to cover its
 * index so the parent's scroll-to-row lookup always finds a mounted row.
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
  onOpenDetail,
  onAnalyzeSource,
  highlightedGroupId,
  scrollRef,
}) => {
  const setStaggerRef = useStaggerReveal();

  const [visibleCount, setVisibleCount] = useState(PAGE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset the visible window whenever the filtered result set changes (identity
  // change of the memoized array = new search/filter/sort/source). Done during
  // render (not in an effect) per the React pattern for deriving state, mirroring
  // MemberExplorer's reset.
  const [lastGroups, setLastGroups] = useState(filteredGroups);
  if (filteredGroups !== lastGroups) {
    setLastGroups(filteredGroups);
    setVisibleCount(PAGE);
  }

  // Deep-link support: the parent scrolls to `[data-group-id]` on a timeout, so
  // the highlighted row must be mounted even when it sits beyond the current
  // window. Raise the window (in whole pages) to cover its index — also a
  // render-phase derived-state update, so the row is mounted in this very
  // render pass, ahead of the parent's scroll timeout.
  if (highlightedGroupId) {
    const index = filteredGroups.findIndex((g) => g.id === highlightedGroupId);
    if (index >= visibleCount) {
      setVisibleCount(Math.ceil((index + 1) / PAGE) * PAGE);
    }
  }

  const hasMore = visibleCount < filteredGroups.length;
  const visibleGroups = hasMore ? filteredGroups.slice(0, visibleCount) : filteredGroups;

  const loadMore = useCallback(() => {
    setVisibleCount((count) => Math.min(count + PAGE, filteredGroups.length));
  }, [filteredGroups.length]);

  // Auto-load more when the sentinel scrolls into view (same as MemberList).
  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: '120px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <>
      <ScrollableList
        loading={loading}
        loadingMessage="Loading groups from Okta..."
        // `size="sm"` (p-2) is the compact `GroupListItem` header (`px-3 py-2`);
        // the richer `lg` used by Apps and Rules would draw a taller row than the
        // one that replaces it.
        skeleton={
          <Skeleton variant="row" size="sm" count={6} label="Loading groups from Okta..." />
        }
        className="mt-(--sp-rung)"
        /* The rung scrolls the panel's one scroller now, so this list is not a
           scroll box of its own — that is what lets the strip above it dock and
           merge like every other `ActionBar` (ADR-0051 §5). */
        scrolls={false}
        fillAvailable={false}
        scrollRef={scrollRef}
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
        {/*
          `useStaggerReveal` holds each row until it scrolls into view, then cascades
          the arriving batch within one `--dur-travel` budget. Rows are keyed by
          `group.id`, so a "Load more" page only *appends* fresh DOM nodes at the end
          — the already-mounted rows above them keep their nodes and never replay. A
          filter/search change resets `visibleCount` to `PAGE` (above) and typically
          swaps most keys, so that case intentionally re-enters as a fresh rise-in.
        */}
        {visibleGroups.length > 0 && (
          <div ref={setStaggerRef} className="rise-in-stagger space-y-(--sp-rung)">
            {visibleGroups.map((group) => (
              <GroupListItem
                key={group.id}
                group={group}
                selected={selectedGroupIds.has(group.id)}
                onToggleSelect={onToggleSelect}
                oktaOrigin={oktaOrigin}
                onOpenDetail={onOpenDetail}
                onAnalyzeSource={onAnalyzeSource}
                isHighlighted={highlightedGroupId === group.id}
              />
            ))}
          </div>
        )}
        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
      </ScrollableList>

      {hasMore && (
        <div className="shrink-0 flex items-center justify-between pt-(--sp-rung) text-xs text-neutral-500">
          <span>
            Showing {visibleGroups.length.toLocaleString()} of{' '}
            {filteredGroups.length.toLocaleString()}
          </span>
          <Button variant="secondary" size="sm" onClick={loadMore}>
            Load more (+{Math.min(PAGE, filteredGroups.length - visibleCount)})
          </Button>
        </div>
      )}
    </>
  );
};

export default GroupsListPanel;
