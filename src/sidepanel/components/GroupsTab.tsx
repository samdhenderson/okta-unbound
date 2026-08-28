/**
 * @module sidepanel/components/GroupsTab
 * @description Groups tab shell: browse, search, filter, and bulk-manage Okta groups.
 *
 * Acts as a thin coordinator that owns cross-cutting shell state (error, live vs.
 * cached search mode, filter/panel visibility) and composes the group hooks
 * (`useGroupsLoader`, `useGroupLiveSearch`, `useGroupFilters`, `useGroupSelection`,
 * `useGroupMembersCache`) with presentational subcomponents (search bar, filter
 * panel, selection bar, list panel) plus the export and comparison modals.
 *
 * ## Sub-navigation
 *
 * The tab owns a {@link sidepanel/hooks/useViewStack.useViewStack} stack whose
 * first (and currently only) pushed view is {@link GroupDetailView}. The browse
 * body is **hidden rather than unmounted** while a detail view is open and the
 * detail renders as its sibling, so every piece of list state — filters,
 * selection, the loaded window, per-row expansion — survives a push→pop round
 * trip. Scroll offset is DOM state that `display: none` destroys, so it is
 * captured before the push and restored after the pop by
 * {@link sidepanel/hooks/useScrollPreservation.useScrollPreservation}. One
 * `PageHeader` stays mounted throughout and swaps its contents, per ADR-0008's
 * stable-region precedent.
 *
 * ## Leaving the tab
 *
 * {@link App} applies the same treatment one level up: the tab is hidden, not
 * unmounted, when another top-level tab is selected, so the pushed detail view and
 * everything behind it survive a trip to the Rules tab and back. In exchange the
 * tab must stay inert while hidden — `isActive` gates the live-search debounce (the
 * one hook here that can issue an Okta request without a click) and extends the
 * list's scroll preservation to cover the tab-level hide as well as the push/pop one.
 *
 * ## The detail view's own mutations
 *
 * {@link GroupDetailView} is no longer purely read-only: it owns a page-level
 * "Export members" action (`onExportGroup`, forwarded straight through and left
 * optional here) and a Members section with per-member add/remove. Neither is
 * shell state — both live in the detail view itself (its own hook,
 * `useGroupMembersSection`), since only that view knows a section's load/gate
 * status well enough to mutate it safely.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import PageHeader from './shared/PageHeader';
import Breadcrumbs from './shared/Breadcrumbs';
import AlertMessage from './shared/AlertMessage';
import Button from './shared/Button';
import EntityIdentity from './shared/EntityIdentity';
import OpenInOktaLink from './shared/OpenInOktaLink';
import WorkingSetPinButton from './shared/WorkingSetPinButton';
import { groupIdentity } from './groups/groupIdentity';
import { useOktaApi } from '../hooks/useOktaApi';
import type { OperationResult } from '../hooks/useOktaApi/types';
import { useGroupsLoader } from '../hooks/useGroupsLoader';
import { useGroupLiveSearch } from '../hooks/useGroupLiveSearch';
import { useGroupFilters } from '../hooks/useGroupFilters';
import type { GroupsListView } from '../listViewRequest';
import { useGroupSelection } from '../hooks/useGroupSelection';
import { useGroupMembersCache } from '../hooks/useGroupMembersCache';
import { useGroupMerge } from '../hooks/useGroupMerge';
import { useViewStack } from '../hooks/useViewStack';
import { useWorkingSet } from '../hooks/useWorkingSet';
import { useScrollPreservation } from '../hooks/useScrollPreservation';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { GroupSummary } from '../../shared/types';
import GroupExportModal from './groups/GroupExportModal';
import GroupComparisonModal from './groups/GroupComparisonModal';
import CrossGroupSearch from './groups/CrossGroupSearch';
import BulkOperationsPanel from './groups/BulkOperationsPanel';
import GroupCollections from './groups/GroupCollections';
import GroupCleanupPanel from './groups/GroupCleanupPanel';
import GroupSearchBar from './groups/GroupSearchBar';
import GroupFilterToggle from './groups/GroupFilterToggle';
import GroupFilterPanel from './groups/GroupFilterPanel';
import GroupSelectionBar, { type ActivePanel } from './groups/GroupSelectionBar';
import GroupsListPanel from './groups/GroupsListPanel';
import GroupDetailView from './groups/detail/GroupDetailView';
import GroupMergeModal from './groups/GroupMergeModal';
import { downloadCSV, getDateForFilename } from '../../shared/utils/csvUtils';
import { buildGroupsListCsv } from './groups/groupsListCsv';

interface GroupsTabProps {
  /** Chrome tab id of the connected Okta tab; API/search actions are disabled when null. */
  targetTabId: number | null;
  /** Okta org origin used to build deep links to group admin pages. */
  oktaOrigin?: string;
  /** Deep-link to a rule in the Rules tab (from a group's feeding rules, A2 → B/A4). */
  onNavigateToRule?: (ruleId: string) => void;
  /** Group id to scroll to and highlight when navigated here from the Rules tab. */
  selectedGroupId?: string | null;
  /** Called once the highlighted group has been shown, so the parent can clear it. */
  onGroupSelected?: () => void;
  /**
   * Opens the Export tab pre-scoped to a group's members — the detail view's
   * page-level "Export members" action (ADR-0030). Optional: `App.tsx` already
   * owns a `handleExportGroup` of this shape for the Overview tab but does not
   * yet wire it through to the Groups tab, so this stays a no-op action rather
   * than a hard requirement until that wiring lands.
   */
  onExportGroup?: (groupId: string, groupName: string) => void;
  /**
   * Whether this is the selected top-level tab. The tab stays mounted while
   * hidden, so background work that could reach Okta (the live-search debounce)
   * is gated on it. Defaults to `true` for standalone use.
   */
  isActive?: boolean;
  /**
   * A pre-filtered view requested from another tab (the Home card's group
   * sub-counts). Applied once on arrival, then cleared via
   * {@link GroupsTabProps.onListViewConsumed}.
   */
  listView?: GroupsListView | null;
  /** Invoked once {@link GroupsTabProps.listView} has been applied. */
  onListViewConsumed?: () => void;
}

/** Breadcrumb label for a group pushed onto the view stack. */
const groupCrumbLabel = (group: GroupSummary): string => group.name;

/** Stable breadcrumb key for a group pushed onto the view stack. */
const groupCrumbKey = (group: GroupSummary): string => group.id;

/**
 * Renders the Groups tab and orchestrates the group loading/search/selection hooks
 * and their presentational panels. Also implements CSV export of the selected or
 * filtered groups and the show/hide toggling of the bulk/cross-search/collections panels.
 */
const GroupsTab: React.FC<GroupsTabProps> = ({
  targetTabId,
  oktaOrigin,
  onNavigateToRule,
  selectedGroupId,
  onGroupSelected,
  isActive = true,
  onExportGroup,
  listView,
  onListViewConsumed,
}) => {
  // Shell-owned state: error has three producers (loader, live search, useOktaApi
  // onResult) so it stays here; searchMode is read by three hooks so it stays above
  // them; showFilters and the modal/panel flags are pure UI.
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'live' | 'cached'>('live');
  const [showFilters, setShowFilters] = useState(false);

  // Read once here (not inside the deep-link effect below) so the effect's own
  // dependency list — deliberately pruned to avoid unstable-filters-identity churn
  // — doesn't need to grow just to consume it.
  const reducedMotion = useReducedMotion();

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportGroups, setExportGroups] = useState<GroupSummary[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');

  // Must be stable: useOktaApi memoizes its operations on this callback's identity.
  const handleResult = useCallback(({ message, type }: OperationResult) => {
    if (type === 'error') setError(message);
  }, []);

  const api = useOktaApi({ targetTabId, onResult: handleResult });

  const liveSearch = useGroupLiveSearch({ targetTabId, searchMode, setError, enabled: isActive });
  const loader = useGroupsLoader({
    targetTabId,
    oktaOrigin,
    setError,
    setSearchMode,
    onLoaded: liveSearch.resetLiveSearch,
    enabled: isActive,
  });
  const filters = useGroupFilters({
    groups: loader.groups,
    searchMode,
    liveSearchResults: liveSearch.liveSearchResults,
  });
  const selection = useGroupSelection(loader.groups);
  const membersCache = useGroupMembersCache(api, loader.groups);
  const merge = useGroupMerge(targetTabId ?? undefined);

  // Sub-navigation: the list stays mounted (hidden) and the detail view renders as
  // its sibling, so nothing the list accumulated is lost on the way back.
  const detailViewRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  // Set when a push was requested *in order to* analyze member source, so the
  // pushed detail view runs that analysis instead of waiting for a second click.
  const [autoAnalyzeGroupId, setAutoAnalyzeGroupId] = useState<string | null>(null);
  const nav = useViewStack<GroupSummary>({
    rootLabel: 'Groups',
    getLabel: groupCrumbLabel,
    getKey: groupCrumbKey,
    viewRef: detailViewRef,
  });
  // Visible only when this tab is selected *and* no detail view is pushed — both
  // hide the list with `display: none`, and both destroy its scroll box.
  const captureListScroll = useScrollPreservation(listScrollRef, isActive && nav.isRoot);

  const handleCloseMerge = useCallback(() => {
    setShowMergeModal(false);
    merge.reset();
  }, [merge]);

  const { groups, loading, loadAllGroups } = loader;
  const { filteredGroups, activeFilterCount } = filters;
  const { selectedGroupIds, selectedGroups } = selection;

  // Re-resolve the pushed group against the live list so a refresh while drilled in
  // updates the detail view instead of stranding it on the snapshot that was pushed.
  const pushedGroup = nav.currentEntry;
  const detailGroup = pushedGroup
    ? (groups.find((g) => g.id === pushedGroup.id) ?? pushedGroup)
    : undefined;

  // The header's whole description of this group — title, type badge, member count and
  // deep link — from one pure builder, so those four never disagree with each other.
  const identity = detailGroup ? groupIdentity(detailGroup) : undefined;

  // Read only for the pin's own state; the list of pinned entities is Home's.
  const workingSet = useWorkingSet(oktaOrigin);

  const { push: pushView } = nav;
  const handleOpenDetail = useCallback(
    (group: GroupSummary) => {
      // `display: none` destroys the scroll box, so bank scrollTop before the push.
      captureListScroll();
      setAutoAnalyzeGroupId(null);
      pushView(group);
    },
    [captureListScroll, pushView],
  );

  // A row's "Analyze member source" action: the analysis costs one paginated
  // member read, so it runs in the detail view — the one surface that can show
  // its cost, progress and failure — and banks its result for the row's meter.
  const handleAnalyzeSource = useCallback(
    (group: GroupSummary) => {
      captureListScroll();
      setAutoAnalyzeGroupId(group.id);
      pushView(group);
    },
    [captureListScroll, pushView],
  );

  // Deep-link from the Rules tab: when a group id arrives, switch to cached mode,
  // clear filters/search so it isn't hidden, then scroll to and highlight its row.
  // If the group isn't in the loaded list yet, trigger a cached load on demand
  // (mirrors the Rules tab) rather than sitting inert until a manual load.
  const navHandledRef = useRef<string | null>(null);
  const navLoadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedGroupId) {
      navHandledRef.current = null;
      navLoadRef.current = null;
      return;
    }
    if (navHandledRef.current === selectedGroupId) return;
    if (!groups.some((g) => g.id === selectedGroupId)) {
      // Target isn't in the loaded list (fresh session, live-search mode, or a
      // never-loaded list). Kick a cached load once so it can appear, then wait
      // for `groups`/`loading` to update and re-run this effect — mirroring the
      // Rules tab's load-on-demand deep-link.
      if (!loading && navLoadRef.current !== selectedGroupId) {
        navLoadRef.current = selectedGroupId;
        setSearchMode('cached');
        void loadAllGroups();
      }
      return;
    }
    navHandledRef.current = selectedGroupId;

    // The deep-link contract targets a *row*, so pop any pushed detail view first —
    // otherwise the list is hidden and the scroll-to-row below has nothing to find.
    nav.reset();
    setSearchMode('cached');
    filters.clearFilters();
    filters.setSearchQuery('');

    const scrollT = setTimeout(() => {
      // `scroll-behavior: auto !important` (the CSS reduced-motion override)
      // cannot suppress this JS `behavior` option, so it is gated explicitly.
      document
        .querySelector(`[data-group-id="${selectedGroupId}"]`)
        ?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }, 150);
    const clearT = setTimeout(() => onGroupSelected?.(), 2500);
    return () => {
      clearTimeout(scrollT);
      clearTimeout(clearT);
    };
    // Setters (setSearchMode/filters/onGroupSelected) and loadAllGroups are stable
    // enough; re-running only on id/groups/loading changes avoids the
    // unstable-filters-identity churn while still reacting when a load completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, groups, loading]);

  // A pre-filtered view requested from the Home card.
  //
  // Two things have to happen together or the arrival is a lie. The list must be
  // in cached mode — the live search returns Okta's matches for a query, and no
  // local filter applies to them. And every other axis is cleared, so the rows
  // on screen are the population the figure counted rather than that population
  // intersected with whatever was left selected.
  //
  // The filter panel is deliberately NOT opened. A reader who pressed a finding
  // asked for the list, not for the controls that produced it, and arriving on
  // an expanded panel puts a wall of selects between them and the rows. What
  // stops the short list being unexplained is the toggle's active-filter count,
  // which is already on screen and is one press from the panel.
  //
  // Groups load on demand, so a request can arrive against an empty list; the
  // load is kicked once and the filter simply applies to the rows when they land.
  const listViewHandledRef = useRef<GroupsListView | null>(null);
  useEffect(() => {
    if (!listView) {
      listViewHandledRef.current = null;
      return;
    }
    if (listViewHandledRef.current === listView) return;
    listViewHandledRef.current = listView;

    nav.reset();
    setSearchMode('cached');
    filters.clearFilters();
    if (listView === 'empty') filters.setSizeFilter('empty');
    else filters.setRuleFilter('unruled');

    if (groups.length === 0 && !loading) void loadAllGroups();
    onListViewConsumed?.();
    // `filters` and `nav` are recreated every render; depending on them would
    // re-run this on every keystroke. The ref above is what makes it once-per
    // request, exactly as the `selectedGroupId` deep-link below does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listView, groups.length, loading]);

  const handleExportSelection = useCallback(() => {
    if (selectedGroupIds.size === 0) {
      setError('Please select at least one group');
      return;
    }
    setExportGroups(groups.filter((g) => selectedGroupIds.has(g.id)));
    setShowExportModal(true);
  }, [selectedGroupIds, groups]);

  const handleExportGroupsList = useCallback(() => {
    // Plain `text/csv` (no charset) preserves this export's long-standing blob type.
    downloadCSV(
      buildGroupsListCsv(filteredGroups),
      `okta_groups_${getDateForFilename()}.csv`,
      'text/csv',
    );
  }, [filteredGroups]);

  const togglePanel = useCallback((panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  }, []);

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      {/*
        One header for the whole tab; its contents swap as views push/pop (ADR-0008).
        On the detail rung it also *describes* the group — name, type and member count all
        come from one `groupIdentity()` descriptor, so the detail body below opens on the
        membership source rather than on a card repeating this title.
      */}
      <PageHeader
        title={identity ? identity.name : 'Groups'}
        subtitle={identity ? undefined : 'Browse, search, and manage groups'}
        onBack={detailGroup ? nav.pop : undefined}
        backLabel="Back to groups"
        breadcrumbs={detailGroup ? <Breadcrumbs items={nav.trail} /> : undefined}
        sticky={isActive}
        identityKey={identity?.key}
        identity={identity ? <EntityIdentity rows={identity.rows} /> : undefined}
        badge={
          identity
            ? identity.badge
            : selectedGroupIds.size > 0
              ? { text: `${selectedGroupIds.size} Selected`, variant: 'primary' }
              : searchMode === 'cached'
                ? { text: `${groups.length} Cached`, variant: 'success' }
                : { text: 'Live', variant: 'primary' }
        }
        actions={
          identity ? (
            identity.link && (
              <OpenInOktaLink
                oktaOrigin={oktaOrigin}
                entityType={identity.link.entityType}
                entityId={identity.link.entityId}
              />
            )
          ) : searchMode === 'live' ? (
            <Button
              variant="primary"
              onClick={() => void loadAllGroups()}
              disabled={loading || !targetTabId}
              loading={loading}
            >
              Load All Groups
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon="refresh"
              onClick={() => void loadAllGroups(true)}
              loading={loading}
            >
              Refresh
            </Button>
          )
        }
        cornerAction={
          detailGroup && (
            <WorkingSetPinButton
              pinned={workingSet.isPinned('group', detailGroup.id)}
              onToggle={() =>
                workingSet.togglePin({
                  kind: 'group',
                  id: detailGroup.id,
                  name: detailGroup.name,
                })
              }
            />
          )
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/*
          Hidden, never unmounted: `visibleCount`, per-row `expanded` and the focus
          target the view stack restores to all live inside this subtree. The class
          is swapped wholesale (rather than adding `hidden` alongside `flex`) because
          Tailwind's `flex` would otherwise out-specify the `hidden` display rule.
        */}
        <div
          className={
            nav.isRoot
              ? // `animate-pop-in` (arrive from the left) only after a real pop — the
                // tab's first render is not a navigation. Restarting on each pop is
                // free: the element is coming back from `display: none`, which is
                // when CSS (re)starts an animation.
                `flex flex-col h-[calc(100vh-280px)] min-h-[400px] ${
                  nav.transition === 'pop' ? 'animate-pop-in' : ''
                }`
              : 'hidden'
          }
        >
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
                ruleFilter={filters.ruleFilter}
                setRuleFilter={filters.setRuleFilter}
                pushAppFilter={filters.pushAppFilter}
                setPushAppFilter={filters.setPushAppFilter}
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
                onMerge={() => setShowMergeModal(true)}
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

            {activePanel === 'cleanup' && (
              <GroupCleanupPanel
                groups={groups}
                onSelectGroups={selection.replaceSelection}
                onAnalyzeSource={handleOpenDetail}
                onClose={() => setActivePanel('none')}
              />
            )}

            {error && (
              <AlertMessage
                message={{ text: error, type: 'danger' }}
                onDismiss={() => setError(null)}
              />
            )}

            {/*
              A walk that did not reach its last page leaves a genuine prefix of
              the org in the snapshot, and those rows are real and worth showing —
              but a prefix rendered with no caveat reads as the whole org, which
              is the failure ADR-0040 §7 forbids. Shown whenever the snapshot has
              rows it cannot vouch for as complete, and it clears itself when a
              later walk finishes.
            */}
            {!loader.complete && groups.length > 0 && !loading && (
              <AlertMessage
                message={{
                  text: `Showing ${groups.length} groups — the last load did not finish, so this is part of the org, not all of it. Refresh to complete it.`,
                  type: 'warning',
                }}
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
            onLoadAllGroups={() => void loadAllGroups()}
            onClearFilters={filters.clearFilters}
            onOpenDetail={handleOpenDetail}
            onAnalyzeSource={handleAnalyzeSource}
            highlightedGroupId={selectedGroupId ?? undefined}
            scrollRef={listScrollRef}
          />
        </div>

        {/*
          Pushed detail view — a sibling of the list, never a replacement for it.
          It arrives from the right on a push and from the left when a deeper view
          is popped back to it. Decoration only: `useViewStack`'s focus effect runs
          on this same commit, so focus lands here before the first animated frame
          (ADR-0016 — a pushed view is not a dialog and must not be gated).
        */}
        {detailGroup && (
          <div
            ref={detailViewRef}
            tabIndex={-1}
            className={`focus:outline-none ${
              nav.transition === 'pop' ? 'animate-pop-in' : 'animate-push-in'
            }`}
          >
            <GroupDetailView
              group={detailGroup}
              targetTabId={targetTabId}
              oktaOrigin={oktaOrigin}
              onNavigateToRule={onNavigateToRule}
              autoAnalyze={autoAnalyzeGroupId === detailGroup.id}
              isActive={isActive}
              onExportGroup={onExportGroup}
            />
          </div>
        )}
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

      {/* Merge wizard (A3) */}
      <GroupMergeModal
        isOpen={showMergeModal}
        selectedGroups={selectedGroups}
        phase={merge.phase}
        plan={merge.plan}
        results={merge.results}
        error={merge.error}
        actorNotice={merge.actorNotice}
        onDismissActorNotice={merge.dismissActorNotice}
        onPreview={merge.preview}
        onExecute={merge.execute}
        onClose={handleCloseMerge}
      />
    </div>
  );
};

export default GroupsTab;
