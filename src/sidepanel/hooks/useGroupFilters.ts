/**
 * @module sidepanel/hooks/useGroupFilters
 * @description Owns the Groups tab filter/sort state and derives the visible group list.
 *
 * Holds the six filter axes (search, type, size, push, push-app, rule) plus sort
 * field/direction, and produces `filteredGroups` — either the live-search results
 * (live mode) or the locally filtered+sorted cached list (cached mode).
 */

import { useState, useMemo, useCallback } from 'react';
import type { GroupSummary } from '../../shared/types';
import {
  filterAndSortGroups,
  computeActiveFilterCount,
  type SortField,
  type PushFilter,
  type RuleFilter,
} from '../components/groups/groupFilters';

/** Inputs to {@link useGroupFilters}. */
interface UseGroupFiltersOptions {
  /** Full cached group list to filter/sort in cached mode. */
  groups: GroupSummary[];
  /** Which list feeds `filteredGroups`: server-side `live` results or the `cached` list. */
  searchMode: 'live' | 'cached';
  /** Results from the live per-keystroke search, used verbatim in live mode. */
  liveSearchResults: GroupSummary[];
}

/**
 * Owns the six-axis filter/sort state and derives `filteredGroups`.
 *
 * CHARACTERIZED: the live-mode branch returns `liveSearchResults` BY REFERENCE
 * (uncopied) — only the cached path copies before sorting. `activeFilterCount`
 * counts the 4 scalar filters + any push-app selection but NOT `searchQuery`, while
 * `clearFilters` DOES clear `searchQuery`. This inconsistency is intentional; do not
 * harmonize it.
 *
 * @returns The filter/sort state and setters, plus derived `filteredGroups`,
 * `activeFilterCount`, `availablePushApps`, `clearFilters`, and `toggleSort`.
 */
export function useGroupFilters({ groups, searchMode, liveSearchResults }: UseGroupFiltersOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sizeFilter, setSizeFilter] = useState<string>('');
  const [pushFilter, setPushFilter] = useState<PushFilter>('');
  const [pushAppFilter, setPushAppFilter] = useState<Set<string>>(new Set());
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDesc, setSortDesc] = useState(false);

  const activeFilterCount = computeActiveFilterCount({
    typeFilter,
    sizeFilter,
    pushFilter,
    pushAppFilter,
    ruleFilter,
  });

  const filteredGroups = useMemo(() => {
    if (searchMode === 'live') return liveSearchResults;

    return filterAndSortGroups(groups, {
      searchQuery,
      typeFilter,
      sizeFilter,
      pushFilter,
      pushAppFilter,
      ruleFilter,
      sortBy,
      sortDesc,
    });
  }, [
    searchMode,
    liveSearchResults,
    groups,
    searchQuery,
    typeFilter,
    sizeFilter,
    pushFilter,
    pushAppFilter,
    ruleFilter,
    sortBy,
    sortDesc,
  ]);

  const availablePushApps = useMemo(() => {
    const apps = new Map<string, string>();
    for (const group of groups) {
      if (group.pushMappings) {
        for (const mapping of group.pushMappings) {
          if (!apps.has(mapping.appId)) {
            apps.set(mapping.appId, mapping.appName || mapping.appId);
          }
        }
      }
    }
    return Array.from(apps.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groups]);

  const clearFilters = useCallback(() => {
    setTypeFilter('');
    setSizeFilter('');
    setPushFilter('');
    setPushAppFilter(new Set());
    setRuleFilter('');
    setSearchQuery('');
  }, []);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortDesc((prev) => !prev);
      } else {
        setSortBy(field);
        setSortDesc(field !== 'name'); // default desc for numeric fields
      }
    },
    [sortBy],
  );

  return {
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    sizeFilter,
    setSizeFilter,
    pushFilter,
    setPushFilter,
    pushAppFilter,
    setPushAppFilter,
    ruleFilter,
    setRuleFilter,
    sortBy,
    sortDesc,
    filteredGroups,
    activeFilterCount,
    availablePushApps,
    clearFilters,
    toggleSort,
  };
}
