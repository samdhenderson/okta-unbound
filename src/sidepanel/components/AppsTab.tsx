/**
 * @module sidepanel/components/AppsTab
 * @description Applications tab shell: a READ-ONLY inventory of the org's Okta apps.
 *
 * A thin coordinator that owns only shell state (search text, status bucket, sort,
 * and the error banner) and composes {@link useAppsData} with the presentational
 * {@link AppsToolbar} and {@link AppsListPanel}. There are no writes anywhere in
 * this tab — every operation it reaches for is a read
 * (`getAllApps`, `getAppAssignmentCounts`).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { AlertMessage, Button, PageHeader } from './shared';
import AppsToolbar from './apps/AppsToolbar';
import AppsListPanel from './apps/AppsListPanel';
import {
  computeActiveAppFilterCount,
  filterAndSortApps,
  type AppSortField,
  type AppStatusFilter,
} from './apps/appFilters';
import { useOktaApi } from '../hooks/useOktaApi';
import { useAppsData } from '../hooks/useAppsData';

/** Props for {@link AppsTab}. */
export interface AppsTabProps {
  /** Chrome tab id of the connected Okta tab; loading is disabled when null. */
  targetTabId: number | null;
  /** Okta org origin used to build deep links to app admin pages. */
  oktaOrigin?: string;
}

/**
 * Renders the read-only Applications tab: loads the org's app inventory, then
 * filters, sorts, and lists it. Load failures surface as a dismissible `danger`
 * banner rather than an empty list presented as truth.
 */
const AppsTab: React.FC<AppsTabProps> = ({ targetTabId, oktaOrigin }) => {
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppStatusFilter>('');
  const [sortBy, setSortBy] = useState<AppSortField>('label');
  const [sortDesc, setSortDesc] = useState(false);

  // Must be stable: useOktaApi memoizes its operations on this callback's identity.
  const handleResult = useCallback(
    (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
      if (type === 'error') setError(message);
    },
    [],
  );

  const api = useOktaApi({ targetTabId, onResult: handleResult });

  // Also stable — `loadApps` lists it as a dependency. An empty message clears the
  // banner, matching the `useRulesData` onError contract.
  const handleError = useCallback((message: string) => {
    setError(message || null);
  }, []);

  const { apps, isLoading, loadApps } = useAppsData({
    api,
    onError: handleError,
    targetTabId,
  });

  const filteredApps = useMemo(
    () => filterAndSortApps(apps, { searchQuery, statusFilter, sortBy, sortDesc }),
    [apps, searchQuery, statusFilter, sortBy, sortDesc],
  );

  const activeFilterCount = computeActiveAppFilterCount({ statusFilter });

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
  }, []);

  const handleRefresh = useCallback(() => {
    void loadApps(true);
  }, [loadApps]);

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Applications"
        subtitle="Browse the org's application inventory (read-only)"
        badge={{ text: `${apps.length.toLocaleString()} Apps`, variant: 'primary' }}
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={handleRefresh}
            loading={isLoading}
            disabled={isLoading || targetTabId == null}
          >
            Refresh
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
          <div className="shrink-0 space-y-3">
            <AppsToolbar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
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
            onReload={handleRefresh}
            oktaOrigin={oktaOrigin}
            fetchAssignmentCounts={api.getAppAssignmentCounts}
          />
        </div>
      </div>
    </div>
  );
};

export default AppsTab;
