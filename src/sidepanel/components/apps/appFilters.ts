/**
 * @module sidepanel/components/apps/appFilters
 * @description Pure filter/sort helpers for the read-only Applications list.
 *
 * The search predicate, the status bucket predicate, the sort comparator, the
 * combined {@link filterAndSortApps} pipeline, and the status → badge-variant
 * mapping — all side-effect free, mirroring `groups/groupFilters.ts`.
 */
import { isGroupPushApp, type OktaAppListItem } from '../../../shared/schemas/okta';
import { parseRegexQuery } from '../../../shared/utils/regexQuery';

/** Status bucket filter (`''` = all). */
export type AppStatusFilter = '' | 'ACTIVE' | 'INACTIVE';

/**
 * Group-assignment filter (`''` = all).
 *
 * `no-groups` means **Group Push is on and the app pushes nothing** — a
 * configured integration doing no work.
 *
 * It is deliberately not "no group is assigned to this app", which this
 * extension cannot answer for free. The org snapshot walks
 * `/api/v1/apps/{id}/groups` only for the apps Okta flags `GROUP_PUSH`
 * (`APP_GROUPS_SPEC`'s shards), so for every other app an absent assignment
 * means *we never asked*. Widening the bucket to those apps would report the
 * whole inventory as unassigned. Answering it properly costs one request per
 * app, which is not a list filter.
 */
export type AppGroupsFilter = '' | 'no-groups';

/** Field the applications list can be sorted by. */
export type AppSortField = 'label' | 'status' | 'created';

/** Badge variant for an app's lifecycle status (`danger` vocabulary, ADR-0002). */
export type AppStatusVariant = 'success' | 'neutral' | 'danger';

/** The full filter/sort state driving {@link filterAndSortApps}. */
export interface AppFilterState {
  searchQuery: string;
  statusFilter: AppStatusFilter;
  groupsFilter: AppGroupsFilter;
  sortBy: AppSortField;
  sortDesc: boolean;
}

/**
 * The name to show for an app.
 *
 * `label` is the admin-facing display name, `name` the app-type key; both are
 * optional on the lenient list-item schema (ADR-0006), so the id is the last
 * resort — a row is never rendered nameless.
 *
 * @param app - The validated app list row.
 * @returns The display label.
 */
export function appDisplayLabel(app: OktaAppListItem): string {
  return app.label || app.name || app.id;
}

/**
 * Whether an app matches the search query, across display label / app name / id.
 *
 * A slash-wrapped query (`/pattern/flags`) is matched as a regex (via the shared
 * {@link parseRegexQuery}); anything else is a case-insensitive substring match.
 * An empty query matches everything.
 *
 * @param app - The app to test.
 * @param query - The raw search text.
 * @returns `true` if the app matches.
 */
export function matchesAppSearch(app: OktaAppListItem, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const label = appDisplayLabel(app);
  const name = app.name ?? '';

  const regex = parseRegexQuery(trimmed);
  if (regex) {
    return regex.test(label) || (name ? regex.test(name) : false) || regex.test(app.id);
  }

  const q = trimmed.toLowerCase();
  return (
    label.toLowerCase().includes(q) ||
    name.toLowerCase().includes(q) ||
    app.id.toLowerCase().includes(q)
  );
}

/**
 * Status bucket predicate.
 *
 * `ACTIVE` matches only an `ACTIVE` app; `INACTIVE` is its complement — anything
 * that is not active, INCLUDING an app whose status the Okta response omitted, so
 * the two buckets partition the list and nothing can hide from both.
 *
 * @param status - The raw Okta app status, when present.
 * @param filter - The selected bucket (`''` = all).
 */
export function matchesAppStatus(status: string | undefined, filter: AppStatusFilter): boolean {
  if (!filter) return true;
  const normalized = status?.toUpperCase();
  return filter === 'ACTIVE' ? normalized === 'ACTIVE' : normalized !== 'ACTIVE';
}

/**
 * Group-push predicate: is this a push app that pushes no groups?
 *
 * Total in the safe direction — an app without the `GROUP_PUSH` feature is
 * `false` whatever `appsWithPushedGroups` holds, because the snapshot never
 * asked about it and silence is not an answer (see {@link AppGroupsFilter}).
 *
 * @param app - The app to test.
 * @param appsWithPushedGroups - Ids of apps the snapshot holds at least one
 * group assignment for.
 * @returns `true` when Group Push is enabled and no assignment is stored.
 */
export function pushesNoGroups(
  app: OktaAppListItem,
  appsWithPushedGroups: ReadonlySet<string>,
): boolean {
  return isGroupPushApp(app.features) && !appsWithPushedGroups.has(app.id);
}

/**
 * Undirected comparator for the sort field; callers apply the sort direction.
 *
 * `created` sorts a missing date LAST in ascending order (returns 1/-1 for the
 * absent side regardless of the other's value), matching `compareGroupsBy`'s
 * `lastUpdated` handling.
 */
export function compareAppsBy(
  a: OktaAppListItem,
  b: OktaAppListItem,
  sortBy: AppSortField,
): number {
  switch (sortBy) {
    case 'label':
      return appDisplayLabel(a).localeCompare(appDisplayLabel(b));
    case 'status':
      return (a.status ?? '').localeCompare(b.status ?? '');
    case 'created': {
      if (!a.created) return 1;
      if (!b.created) return -1;
      return new Date(a.created).getTime() - new Date(b.created).getTime();
    }
    default:
      return 0;
  }
}

/**
 * The filter + sort pipeline: copies the input (never mutates it), applies the
 * search, status and group-push axes conjunctively, then sorts in place on the
 * copy.
 *
 * @param apps - The loaded app inventory.
 * @param state - The current filter/sort state.
 * @param appsWithPushedGroups - Ids of apps the snapshot holds a group
 * assignment for. Defaults to empty, which only matters when `groupsFilter` is
 * set — and an empty set there is the honest reading of a snapshot that holds
 * no assignments.
 * @returns A new, filtered and sorted array.
 */
export function filterAndSortApps(
  apps: OktaAppListItem[],
  state: AppFilterState,
  appsWithPushedGroups: ReadonlySet<string> = new Set(),
): OktaAppListItem[] {
  let filtered = [...apps];

  if (state.searchQuery.trim()) {
    filtered = filtered.filter((app) => matchesAppSearch(app, state.searchQuery));
  }

  if (state.statusFilter) {
    filtered = filtered.filter((app) => matchesAppStatus(app.status, state.statusFilter));
  }

  if (state.groupsFilter === 'no-groups') {
    filtered = filtered.filter((app) => pushesNoGroups(app, appsWithPushedGroups));
  }

  filtered.sort((a, b) => {
    const cmp = compareAppsBy(a, b, state.sortBy);
    return state.sortDesc ? -cmp : cmp;
  });

  return filtered;
}

/**
 * Badge variant for an app status. `ACTIVE` reads as success, a deleted app as
 * `danger` (never `error` — ADR-0002), and everything else (including an absent
 * status) as an uncoloured neutral badge.
 *
 * @param status - The raw Okta app status, when present.
 */
export function appStatusVariant(status: string | undefined): AppStatusVariant {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return 'success';
    case 'DELETED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * Badge count for the toolbar: one per selected bucket (status, group push). The
 * search query is deliberately NOT counted (the `computeActiveFilterCount`
 * precedent in `groupFilters`).
 */
export function computeActiveAppFilterCount(
  state: Pick<AppFilterState, 'statusFilter' | 'groupsFilter'>,
): number {
  return (state.statusFilter ? 1 : 0) + (state.groupsFilter ? 1 : 0);
}
