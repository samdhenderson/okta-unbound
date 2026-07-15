/**
 * @module sidepanel/components/groups/groupFilters
 * @description Pure filter/sort helpers for the cached-mode groups list.
 *
 * Bucket predicates, the sort comparator, the combined {@link filterAndSortGroups}
 * pipeline, and the {@link computeActiveFilterCount} badge helper — all side-effect free.
 */
import type { GroupSummary } from '../../../shared/types';

/** Field the groups list can be sorted by. */
export type SortField = 'name' | 'memberCount' | 'lastUpdated' | 'staleness';
/** Health/staleness bucket filter (`''` = all). */
export type StalenessLevel = '' | 'healthy' | 'monitor' | 'stale' | 'very_stale';
/** Push-status filter (`''` = all). */
export type PushFilter = '' | 'pushed' | 'not_pushed';

/** The full cached-mode filter/sort state driving {@link filterAndSortGroups}. */
export interface GroupFilterState {
  searchQuery: string;
  typeFilter: string;
  sizeFilter: string;
  pushFilter: PushFilter;
  pushAppFilter: Set<string>;
  stalenessFilter: StalenessLevel;
  sortBy: SortField;
  sortDesc: boolean;
}

/** Member-count bucket predicate. `default` (unrecognised filter) matches everything. */
export function matchesSizeFilter(memberCount: number, sizeFilter: string): boolean {
  switch (sizeFilter) {
    case 'empty':
      return memberCount === 0;
    case 'small':
      return memberCount > 0 && memberCount < 50;
    case 'medium':
      return memberCount >= 50 && memberCount < 200;
    case 'large':
      return memberCount >= 200 && memberCount < 1000;
    case 'xlarge':
      return memberCount >= 1000;
    default:
      return true;
  }
}

/** Staleness-score bucket predicate (<=25 / 25-50 / 50-75 / >75). */
export function matchesStalenessFilter(score: number, level: StalenessLevel): boolean {
  switch (level) {
    case 'healthy':
      return score <= 25;
    case 'monitor':
      return score > 25 && score <= 50;
    case 'stale':
      return score > 50 && score <= 75;
    case 'very_stale':
      return score > 75;
    default:
      return true;
  }
}

/**
 * Undirected comparator for the sort field. Callers apply the sort direction.
 * `lastUpdated` sorts a missing date LAST in ascending order (returns 1/-1 for the
 * absent side regardless of the other's value).
 */
export function compareGroupsBy(a: GroupSummary, b: GroupSummary, sortBy: SortField): number {
  switch (sortBy) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'memberCount':
      return a.memberCount - b.memberCount;
    case 'lastUpdated':
      if (!a.lastUpdated) return 1;
      if (!b.lastUpdated) return -1;
      return a.lastUpdated.getTime() - b.lastUpdated.getTime();
    case 'staleness':
      return (a.staleness?.score || 0) - (b.staleness?.score || 0);
    default:
      return 0;
  }
}

/**
 * The cached-mode filter + sort pipeline: copies the input (never mutates it),
 * applies the six axes conjunctively, then sorts in place on the copy.
 */
export function filterAndSortGroups(
  groups: GroupSummary[],
  state: GroupFilterState,
): GroupSummary[] {
  let filtered = [...groups];

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q),
    );
  }

  if (state.typeFilter) {
    filtered = filtered.filter((g) => g.type === state.typeFilter);
  }

  if (state.sizeFilter) {
    filtered = filtered.filter((g) => matchesSizeFilter(g.memberCount, state.sizeFilter));
  }

  if (state.pushFilter) {
    filtered = filtered.filter((g) => {
      const hasPush = g.pushMappings && g.pushMappings.length > 0;
      return state.pushFilter === 'pushed' ? hasPush : !hasPush;
    });
  }

  if (state.pushAppFilter.size > 0) {
    filtered = filtered.filter((g) => {
      if (!g.pushMappings || g.pushMappings.length === 0) return false;
      return g.pushMappings.some((m) => state.pushAppFilter.has(m.appId));
    });
  }

  if (state.stalenessFilter) {
    filtered = filtered.filter((g) =>
      matchesStalenessFilter(g.staleness?.score || 0, state.stalenessFilter),
    );
  }

  filtered.sort((a, b) => {
    const cmp = compareGroupsBy(a, b, state.sortBy);
    return state.sortDesc ? -cmp : cmp;
  });

  return filtered;
}

/**
 * Badge count for the Filters toggle: the 4 scalar filters (counted via
 * `.filter(Boolean)`) plus 1 if any push-target app is selected. `searchQuery` is
 * deliberately NOT counted — do not "harmonize" this with `handleClearFilters`,
 * which DOES clear the search query.
 */
export function computeActiveFilterCount(
  state: Pick<
    GroupFilterState,
    'typeFilter' | 'sizeFilter' | 'pushFilter' | 'stalenessFilter' | 'pushAppFilter'
  >,
): number {
  return (
    [state.typeFilter, state.sizeFilter, state.pushFilter, state.stalenessFilter].filter(Boolean)
      .length + (state.pushAppFilter.size > 0 ? 1 : 0)
  );
}
