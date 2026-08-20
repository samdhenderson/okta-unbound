/**
 * @module sidepanel/components/users/UserAppsList
 * @description The Users tab's Apps pane: which apps this user has, and which group grants each one.
 *
 * ## The group is named on load
 *
 * An earlier design put a "Name the group" button on every group-granted row,
 * because naming the grantor was assumed to cost a request per app. It does not:
 * `getUserApps` already asks for `expand=user/{id}`, and Okta names the granting
 * group in that embed. So the answer arrives with the list, and there is no
 * per-row button here at all — `useUserApps` handles the minority of rows the
 * embed left silent, once, as a tracked and cancellable operation.
 *
 * ## Three things this pane will not do
 *
 * - **Render a `Direct` badge as "direct only".** Okta reports one scope per
 *   app-user and prefers `USER`, so a `Direct` row that also names a group shows
 *   both, and the caveat rides on the badge's `title` in every state.
 * - **Render an unknown source as an empty line.** A row with no known grantor
 *   says so, in italic, in `AppScopeIndicator`'s own words.
 * - **Render a partial walk as a complete answer.** `complete: false` raises a
 *   standing warning above the list rather than letting a short list read as
 *   this user's whole access.
 *
 * Filter, bucket and disclosure state are local `useState`. The panes are hidden
 * rather than unmounted (ADR-0016/0018), so that state survives a pane switch
 * without being lifted into the tab (`docs/state-management.md`).
 *
 * All display state is derived by {@link module:sidepanel/components/users/appSourceSummary},
 * which has no I/O — scrolling this list cannot trigger a request.
 */
import React, { useMemo, useState } from 'react';
import { AlertMessage, EmptyState, FilterPill, Input, Skeleton } from '../shared';
import Icon from '../overview/shared/Icon';
import UserAppRow from './UserAppRow';
import { summarizeAppSources, type AppSourceBucket } from './appSourceSummary';
import type { GroupMembership } from '../../../shared/types';
import type { UserAppAssignment } from '../../hooks/useOktaApi/userOperations';

/** The pill set, in the order it renders. `all` is not a bucket — it is the absence of one. */
type AppFilter = 'all' | AppSourceBucket;

/** Pill labels, keyed so a new bucket is a compile error here rather than a missing pill. */
const FILTER_LABELS: Record<AppFilter, string> = {
  all: 'All',
  direct: 'Direct',
  viaGroup: 'Via group',
  unknown: 'Unknown',
};

const FILTER_ORDER: readonly AppFilter[] = ['all', 'direct', 'viaGroup', 'unknown'];

/** Props for {@link UserAppsList}. */
export interface UserAppsListProps {
  /**
   * The user's app assignments, with `grantGroupId` already filled in wherever it
   * is known. Supplied by `useUserApps`; this component performs no I/O.
   */
  apps: UserAppAssignment[];
  /**
   * The user's group memberships, used only to name a group Okta already credited
   * and to explain how that group was itself granted.
   */
  memberships: GroupMembership[];
  /** Shows row placeholders instead of the list. */
  isLoading: boolean;
  /**
   * Whether the pagination walk behind {@link apps} finished. `false` raises a
   * non-dismissible warning: a list short by an unknown amount must never be read
   * as this user's complete access.
   */
  complete: boolean;
  /** Okta origin for the per-row admin-console deep links; they hide when absent. */
  oktaOrigin?: string | null;
}

/**
 * Lists a user's app assignments with the group behind each one.
 *
 * @param props - See {@link UserAppsListProps}.
 */
const UserAppsList: React.FC<UserAppsListProps> = ({
  apps,
  memberships,
  isLoading,
  complete,
  oktaOrigin,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AppFilter>('all');

  const { rows, counts, summary } = useMemo(
    () => summarizeAppSources(apps, memberships),
    [apps, memberships],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (filter === 'all' || row.bucket === filter) &&
        // `filterText` already carries the app label and the granting group name,
        // so one field matches both halves of the placeholder's promise.
        (needle === '' || row.filterText.includes(needle)),
    );
  }, [rows, filter, query]);

  const clearFilters = () => {
    setQuery('');
    setFilter('all');
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton variant="row" size="lg" count={4} label="Loading app assignments…" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!complete && (
        // Deliberately not dismissible. The caveat describes the list itself, so
        // it must remain true for as long as the list is on screen.
        <AlertMessage
          message={{
            type: 'warning',
            text: 'This list may be incomplete — the walk of this user’s app assignments did not finish, so it is short by an unknown number of apps. Treat any count or “not assigned” conclusion drawn from it as unavailable rather than as zero.',
          }}
        />
      )}

      {summary && <p className="text-xs text-neutral-600">{summary}</p>}

      <Input
        size="sm"
        value={query}
        onChange={setQuery}
        type="search"
        ariaLabel="Filter apps or granting group"
        placeholder="Filter apps or granting group…"
        icon={<Icon type="search" size="sm" className="text-neutral-400" />}
      />

      <div className="flex flex-wrap gap-2">
        {FILTER_ORDER.map((key) => (
          <FilterPill
            key={key}
            active={filter === key}
            onClick={() => setFilter(key)}
            // The count is on the pill rather than only in the summary, so a
            // reader can see that filtering to an empty bucket found nothing
            // because there is nothing, not because the filter is broken.
            title={key === 'all' ? `${rows.length} apps` : `${counts[key]} apps`}
          >
            {FILTER_LABELS[key]} {key === 'all' ? rows.length : counts[key]}
          </FilterPill>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="app"
          title="No apps assigned"
          description="Okta reports no application assignments for this user."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="app"
          title="No apps match"
          description="No app matches this filter. Clearing it brings the whole list back."
          actions={[{ label: 'Clear filters', onClick: clearFilters, variant: 'secondary' }]}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => (
            <UserAppRow key={row.id} row={row} oktaOrigin={oktaOrigin} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default UserAppsList;
