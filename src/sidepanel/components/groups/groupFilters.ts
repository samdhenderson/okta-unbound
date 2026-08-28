/**
 * @module sidepanel/components/groups/groupFilters
 * @description Pure filter/sort helpers for the cached-mode groups list.
 *
 * Bucket predicates, the sort comparator, the combined {@link filterAndSortGroups}
 * pipeline, and the {@link computeActiveFilterCount} badge helper — all side-effect free.
 */
import type { GroupSummary } from '../../../shared/types';
import { parseRegexQuery } from '../../../shared/utils/regexQuery';

// Promoted to shared/utils/regexQuery so other searchable lists can reuse it;
// re-exported here so existing consumers (and groupFilters.test.ts) stay put.
export { parseRegexQuery } from '../../../shared/utils/regexQuery';

/** Field the groups list can be sorted by. */
export type SortField = 'name' | 'memberCount' | 'lastUpdated';
/** Push-status filter (`''` = all). */
export type PushFilter = '' | 'pushed' | 'not_pushed';
/**
 * Rule-attribution filter (`''` = all).
 *
 * `unruled` is the interesting one, and the reason this axis exists: a group no
 * rule assigns anyone to is a group whose membership is maintained by hand, and
 * it will drift as people change roles. It does **not** mean unused — Okta
 * Workflows, SCIM, and direct API calls all add members without a group rule,
 * and none of them are visible from here.
 */
export type RuleFilter = '' | 'ruled' | 'unruled';

/** The full cached-mode filter/sort state driving {@link filterAndSortGroups}. */
export interface GroupFilterState {
  searchQuery: string;
  typeFilter: string;
  sizeFilter: string;
  pushFilter: PushFilter;
  pushAppFilter: Set<string>;
  ruleFilter: RuleFilter;
  sortBy: SortField;
  sortDesc: boolean;
}

/**
 * Whether a group matches the search query, across name / description / id.
 *
 * A slash-wrapped query (`/pattern/flags`) is matched as a regex; anything else is
 * a case-insensitive substring match (the long-standing behavior). An empty query
 * matches everything.
 *
 * @param group - The group to test.
 * @param query - The raw search text.
 * @returns `true` if the group matches.
 */
export function matchesSearchQuery(group: GroupSummary, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const regex = parseRegexQuery(trimmed);
  if (regex) {
    return (
      regex.test(group.name) ||
      (group.description ? regex.test(group.description) : false) ||
      regex.test(group.id)
    );
  }

  const q = trimmed.toLowerCase();
  return (
    group.name.toLowerCase().includes(q) ||
    (group.description?.toLowerCase().includes(q) ?? false) ||
    group.id.toLowerCase().includes(q)
  );
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
    default:
      return 0;
  }
}

/**
 * The cached-mode filter + sort pipeline: copies the input (never mutates it),
 * applies the five axes conjunctively, then sorts in place on the copy.
 */
export function filterAndSortGroups(
  groups: GroupSummary[],
  state: GroupFilterState,
): GroupSummary[] {
  let filtered = [...groups];

  if (state.searchQuery.trim()) {
    filtered = filtered.filter((g) => matchesSearchQuery(g, state.searchQuery));
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

  if (state.ruleFilter) {
    // `hasRules` counts rules that ASSIGN users to the group, not rules that
    // merely mention it in a condition (`usedInRuleCount`). A group used to
    // decide someone else's rule still has nothing filling it.
    filtered = filtered.filter((g) => (state.ruleFilter === 'ruled' ? g.hasRules : !g.hasRules));
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
    'typeFilter' | 'sizeFilter' | 'pushFilter' | 'pushAppFilter' | 'ruleFilter'
  >,
): number {
  return (
    [state.typeFilter, state.sizeFilter, state.pushFilter, state.ruleFilter].filter(Boolean)
      .length + (state.pushAppFilter.size > 0 ? 1 : 0)
  );
}
