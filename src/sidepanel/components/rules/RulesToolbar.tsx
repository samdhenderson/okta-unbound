/**
 * @module sidepanel/components/rules/RulesToolbar
 * @description Search + filter controls for the Rules tab.
 *
 * The filter chips route through the shared {@link FilterPill}. The search field
 * stays a raw `<input>` composite (leading search glyph) — the same documented
 * exception as `GroupSearchBar`/`UserSearchBar`, since the shared `Input` lacks a
 * size prop and would shrink the bar.
 */
import React from 'react';
import FilterPill from '../shared/FilterPill';
import Select from '../shared/Select';
import { RULE_SORT_LABELS, type RuleSortMode } from '../../../shared/rules/similarity';

/** Client-side filter applied on top of the text search over loaded rules. */
export type RulesFilterType = 'all' | 'active' | 'conflicts' | 'current-group';

/** Order in which the sort options are offered. */
const SORT_OPTIONS: RuleSortMode[] = ['default', 'similarity', 'name'];

interface RulesToolbarProps {
  /** Current search text. */
  searchQuery: string;
  onSearchChange: (value: string) => void;
  /** Active filter chip. */
  activeFilter: RulesFilterType;
  onFilterChange: (filter: RulesFilterType) => void;
  /** Conflict count shown on (and gating) the Conflicts chip. */
  conflictsCount: number;
  /** Whether to show the "Current Group" chip (a group is detected). */
  showCurrentGroup: boolean;
  /** Active list sort mode. */
  sortMode: RuleSortMode;
  /** Change the list sort mode. */
  onSortChange: (mode: RuleSortMode) => void;
}

/** Renders the Rules tab search field, filter chips, and sort selector. */
const RulesToolbar: React.FC<RulesToolbarProps> = ({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  conflictsCount,
  showCurrentGroup,
  sortMode,
  onSortChange,
}) => (
  <div className="space-y-3">
    {/* Search Bar (documented composite: leading search glyph) */}
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="text"
        className="w-full pl-11 pr-4 py-2.5 bg-white border border-neutral-200 rounded-md text-sm placeholder-neutral-400 focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary transition-all duration-100"
        placeholder="Search rules by name, condition, or attributes..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>

    {/* Filter chips + sort selector */}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        <FilterPill active={activeFilter === 'all'} onClick={() => onFilterChange('all')}>
          All Rules
        </FilterPill>
        <FilterPill active={activeFilter === 'active'} onClick={() => onFilterChange('active')}>
          Active Only
        </FilterPill>
        <FilterPill
          active={activeFilter === 'conflicts'}
          onClick={() => onFilterChange('conflicts')}
          disabled={conflictsCount === 0}
        >
          Conflicts ({conflictsCount})
        </FilterPill>
        {showCurrentGroup && (
          <FilterPill
            active={activeFilter === 'current-group'}
            onClick={() => onFilterChange('current-group')}
          >
            Current Group
          </FilterPill>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-neutral-500">Sort</span>
        <Select
          value={sortMode}
          onChange={(value) => onSortChange(value as RuleSortMode)}
          options={SORT_OPTIONS.map((mode) => ({ value: mode, label: RULE_SORT_LABELS[mode] }))}
          fullWidth={false}
          ariaLabel="Sort rules"
        />
      </div>
    </div>
  </div>
);

export default RulesToolbar;
