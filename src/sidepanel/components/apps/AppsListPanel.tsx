/**
 * @module sidepanel/components/apps/AppsListPanel
 * @description The scrollable Applications list plus its empty states.
 *
 * Renders one {@link AppListItem} per filtered app inside a shared
 * {@link ScrollableList}, and picks between the "nothing loaded" and "nothing
 * matches" empty states — the same split `GroupsListPanel` makes.
 */
import React from 'react';
import { EmptyState, ScrollableList } from '../shared';
import AppListItem from './AppListItem';
import type { AppAssignmentCounts } from '../../hooks/useOktaApi/appOperations';
import type { OktaAppListItem } from '../../../shared/schemas/okta';

/** Props for {@link AppsListPanel}. */
export interface AppsListPanelProps {
  /** Whether the inventory load is in progress. */
  loading: boolean;
  /** Apps to render, already filtered and sorted. */
  apps: OktaAppListItem[];
  /** Whether any apps are loaded at all — picks which empty state to show. */
  hasApps: boolean;
  /** Active-filter count — gates the "Clear filters" empty-state action. */
  activeFilterCount: number;
  /** Whether a search query is active — also gates "Clear filters". */
  hasSearchQuery: boolean;
  /** Clears the search and status filters (empty-state action). */
  onClearFilters: () => void;
  /** Reloads the inventory (empty-state action when nothing is loaded). */
  onReload: () => void;
  /** Okta origin passed to each row for its "Open in Okta" deep link. */
  oktaOrigin?: string;
  /** Loads a single app's assignment counts, lazily, once its row is expanded. */
  fetchAssignmentCounts?: (appId: string) => Promise<AppAssignmentCounts | null>;
}

/**
 * The scrollable applications list and its two mutually-exclusive empty states:
 * "no applications loaded" (offering a reload) when the inventory is empty, and
 * "no applications match" (offering a filter reset) when filtering excluded
 * everything.
 */
const AppsListPanel: React.FC<AppsListPanelProps> = ({
  loading,
  apps,
  hasApps,
  activeFilterCount,
  hasSearchQuery,
  onClearFilters,
  onReload,
  oktaOrigin,
  fetchAssignmentCounts,
}) => (
  <ScrollableList
    loading={loading}
    loadingMessage="Loading applications from Okta..."
    className="mt-4"
    testId="apps-list"
    emptyState={
      hasApps ? (
        <EmptyState
          icon="app"
          title="No applications match your filters"
          description="Try adjusting your search or status filter."
          actions={
            activeFilterCount > 0 || hasSearchQuery
              ? [{ label: 'Clear filters', onClick: onClearFilters, variant: 'secondary' }]
              : undefined
          }
        />
      ) : (
        <EmptyState
          icon="app"
          title="No applications loaded"
          description="Load the org's application inventory to browse it here."
          actions={[{ label: 'Load applications', onClick: onReload, variant: 'primary' }]}
        />
      )
    }
  >
    {apps.map((app) => (
      <AppListItem
        key={app.id}
        app={app}
        oktaOrigin={oktaOrigin}
        fetchAssignmentCounts={fetchAssignmentCounts}
      />
    ))}
  </ScrollableList>
);

export default AppsListPanel;
