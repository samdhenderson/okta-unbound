/**
 * @module sidepanel/components/AppsTab
 * @description Applications tab shell: a READ-ONLY inventory of the org's Okta apps.
 *
 * A thin coordinator that owns only shell state (search text, status and
 * group-push buckets, sort, and the error banner) and composes {@link useAppsData}
 * with the presentational {@link AppsToolbar} and {@link AppsListPanel}. There are
 * no writes anywhere in this tab — every operation it reaches for is a read
 * (`getAppAssignmentCounts`); the inventory itself comes from the org snapshot.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertMessage, PageHeader } from './shared';
import AppsToolbar from './apps/AppsToolbar';
import AppsListPanel from './apps/AppsListPanel';
import {
  computeActiveAppFilterCount,
  filterAndSortApps,
  type AppGroupsFilter,
  type AppSortField,
  type AppStatusFilter,
} from './apps/appFilters';
import { useOktaApi } from '../hooks/useOktaApi';
import type { OperationResult } from '../hooks/useOktaApi/types';
import { useAppsData } from '../hooks/useAppsData';
import { useRefreshSubject } from '../hooks/useRefreshSubject';
import { useOrgSnapshot } from '../cache/useOrgSnapshot';
import { splitShardedId } from '../../shared/snapshot/types';
import type { OktaAppGroupAssignment } from '../../shared/schemas/okta';
import type { AppsListView } from '../listViewRequest';

/** Props for {@link AppsTab}. */
export interface AppsTabProps {
  /** Chrome tab id of the connected Okta tab; loading is disabled when null. */
  targetTabId: number | null;
  /** Okta org origin used to build deep links to app admin pages. */
  oktaOrigin?: string;
  /**
   * Whether this is the selected top-level tab. The tab stays mounted while
   * hidden, so the one-per-connected-tab inventory auto-load is deferred until it
   * is shown rather than firing in the background. Defaults to `true`.
   */
  isActive?: boolean;
  /**
   * A pre-filtered view requested from another tab (the Home card's app
   * sub-counts). Applied once on arrival, then cleared via
   * {@link AppsTabProps.onListViewConsumed}.
   */
  listView?: AppsListView | null;
  /** Invoked once {@link AppsTabProps.listView} has been applied. */
  onListViewConsumed?: () => void;
  /**
   * A single app to arrive at, deep-linked from elsewhere in the panel (the ⌘K
   * palette, an `EntityLink`). This tab is a flat filtered inventory with no
   * detail rung, so arriving at an app means arriving with the list filtered to
   * it. Applied once, then cleared via {@link AppsTabProps.onAppSelected}.
   */
  selectedAppId?: string | null;
  /** Invoked once {@link AppsTabProps.selectedAppId} has been applied. */
  onAppSelected?: () => void;
}

/**
 * Renders the read-only Applications tab: loads the org's app inventory, then
 * filters, sorts, and lists it. Load failures surface as a dismissible `danger`
 * banner rather than an empty list presented as truth.
 */
const AppsTab: React.FC<AppsTabProps> = ({
  targetTabId,
  oktaOrigin,
  isActive = true,
  listView,
  onListViewConsumed,
  selectedAppId,
  onAppSelected,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppStatusFilter>('');
  const [groupsFilter, setGroupsFilter] = useState<AppGroupsFilter>('');
  const [sortBy, setSortBy] = useState<AppSortField>('label');
  const [sortDesc, setSortDesc] = useState(false);

  // Must be stable: useOktaApi memoizes its operations on this callback's identity.
  const handleResult = useCallback(({ message, type }: OperationResult) => {
    if (type === 'error') setError(message);
  }, []);

  const api = useOktaApi({ targetTabId, onResult: handleResult });

  // Also stable — `loadApps` lists it as a dependency. An empty message clears the
  // banner, matching the `useRulesData` onError contract.
  const handleError = useCallback((message: string) => {
    setError(message || null);
  }, []);

  const { apps, isLoading, loadApps } = useAppsData({
    onError: handleError,
    targetTabId,
    oktaOrigin,
    enabled: isActive,
  });

  // Records, not rows: which app an assignment belongs to lives in the storage
  // key (`${appId}::${groupId}`), because Okta returns only the assigned group's
  // id. Same read `useGroupsLoader` does, so the collection is already mounted
  // for this org and this costs no extra request.
  const { records: assignmentRecords } = useOrgSnapshot<OktaAppGroupAssignment>(
    'appGroups',
    oktaOrigin,
    targetTabId,
    { enabled: isActive },
  );

  const appsWithPushedGroups = useMemo(() => {
    const ids = new Set<string>();
    for (const record of assignmentRecords) {
      const split = splitShardedId(record.id);
      if (split) ids.add(split.shardKey);
    }
    return ids;
  }, [assignmentRecords]);

  const filteredApps = useMemo(
    () =>
      filterAndSortApps(
        apps,
        { searchQuery, statusFilter, groupsFilter, sortBy, sortDesc },
        appsWithPushedGroups,
      ),
    [apps, searchQuery, statusFilter, groupsFilter, sortBy, sortDesc, appsWithPushedGroups],
  );

  const activeFilterCount = useMemo(
    () => computeActiveAppFilterCount({ statusFilter, groupsFilter }),
    [statusFilter, groupsFilter],
  );

  // A pre-filtered view requested from the Home card. Both axes are set on every
  // request — the one the card asked for, and the other one back to "All" — so
  // arriving here always shows exactly the population the figure counted, never
  // that population minus whatever was left selected last time. The search box
  // is cleared for the same reason.
  const listViewHandledRef = useRef<AppsListView | null>(null);
  useEffect(() => {
    if (!listView) {
      listViewHandledRef.current = null;
      return;
    }
    if (listViewHandledRef.current === listView) return;
    listViewHandledRef.current = listView;
    setSearchQuery('');
    setStatusFilter(listView === 'inactive' ? 'INACTIVE' : '');
    setGroupsFilter(listView === 'pushes-nothing' ? 'no-groups' : '');
    onListViewConsumed?.();
  }, [listView, onListViewConsumed]);

  // Arriving at one app: filter the inventory down to it, clearing the other
  // axes for the same reason `listView` does — you should see exactly the thing
  // you asked for, not that thing minus whatever was selected last time.
  //
  // Deliberately keyed on the app's *label*, not its id: the search box is what
  // the reader can see and edit, so the filter they land on is one they can
  // widen by pressing backspace. An id typed into a name search would match
  // nothing and read as "that app is gone".
  //
  // An id the inventory does not contain leaves the list alone rather than
  // filtering it to empty. The inventory is the org snapshot, which may still be
  // walking — an absence here is not evidence the app does not exist (ADR-0040
  // §7), and an empty list presented as truth is exactly that claim.
  const selectedAppHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedAppId) {
      selectedAppHandledRef.current = null;
      return;
    }
    if (selectedAppHandledRef.current === selectedAppId) return;
    const match = apps.find((app) => app.id === selectedAppId);
    // Not yet loaded: wait rather than consuming the request against an empty
    // inventory. `useAppsData` fills in on activation and this effect re-runs.
    if (!match) {
      if (apps.length === 0) return;
      selectedAppHandledRef.current = selectedAppId;
      onAppSelected?.();
      return;
    }
    selectedAppHandledRef.current = selectedAppId;
    setSearchQuery(match.label || match.name || match.id);
    setStatusFilter('');
    setGroupsFilter('');
    onAppSelected?.();
  }, [selectedAppId, apps, onAppSelected]);

  const handleToggleSort = useCallback((field: AppSortField) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortDesc((desc) => !desc);
        return prev;
      }
      setSortDesc(false);
      return field;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('');
    setGroupsFilter('');
  }, []);

  /** A forced re-walk of the inventory. Also the list panel's own reload prompt. */
  const reloadApps = useCallback(() => {
    void loadApps(true);
  }, [loadApps]);

  // The rung's answer to the app-level refresh control (ADR-0069 §2/§4). This
  // used to be a `PageHeader.actions` Button — the slot ADR-0030 §2 exists to
  // empty, holding the rung's single most-pressed control. The list panel keeps
  // its own reload prompt, which is where an initial load belongs. Gated on
  // `isActive` like every other fetch here: a hidden tab must not own the
  // refresh (ADR-0018).
  useRefreshSubject('the apps list', reloadApps, isActive);

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Applications"
        subtitle="Browse the org's application inventory (read-only)"
        badge={{ text: `${apps.length.toLocaleString()} Apps`, variant: 'primary' }}
      />

      <div className="max-w-7xl mx-auto px-(--sp-gutter) py-(--sp-gutter) space-y-(--sp-rung)">
        <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
          <div className="shrink-0 space-y-(--sp-toolbar)">
            <AppsToolbar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              groupsFilter={groupsFilter}
              onGroupsFilterChange={setGroupsFilter}
              sortBy={sortBy}
              sortDesc={sortDesc}
              onToggleSort={handleToggleSort}
              resultCount={filteredApps.length}
              totalCount={apps.length}
            />

            {error && (
              <AlertMessage
                message={{ text: error, type: 'danger' }}
                onDismiss={() => setError(null)}
              />
            )}
          </div>

          <AppsListPanel
            loading={isLoading}
            apps={filteredApps}
            hasApps={apps.length > 0}
            activeFilterCount={activeFilterCount}
            hasSearchQuery={searchQuery.trim().length > 0}
            onClearFilters={handleClearFilters}
            onReload={reloadApps}
            oktaOrigin={oktaOrigin}
            fetchAssignmentCounts={api.getAppAssignmentCounts}
          />
        </div>
      </div>
    </div>
  );
};

export default AppsTab;
