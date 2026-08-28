/**
 * @module sidepanel/components/rules/RulesToolbar
 * @description Search + filter controls for the Rules tab.
 *
 * The filter chips route through the shared {@link FilterPill}. The search field
 * is the shared {@link Input} with a leading {@link Icon} — the same composition
 * `MemberSearchBar` uses.
 */
import React from 'react';
import FilterPill from '../shared/FilterPill';
import Select from '../shared/Select';
import Input from '../shared/Input';
import Icon from '../shared/Icon';
import { RULE_SORT_LABELS, type RuleSortMode } from '../../../shared/rules/similarity';

/** Client-side filter applied on top of the text search over loaded rules. */
export type RulesFilterType = 'all' | 'active' | 'paused' | 'conflicts' | 'current-group';

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
  <div className="space-y-(--sp-field)">
    {/* Search Bar */}
    <Input
      type="search"
      value={searchQuery}
      onChange={onSearchChange}
      placeholder="Search rules by name, condition, or attributes..."
      icon={<Icon type="search" size="sm" />}
    />

    {/* Filter chips + sort selector */}
    <div className="flex flex-wrap items-center justify-between gap-(--sp-field)">
      <div className="flex flex-wrap gap-(--sp-inline)">
        <FilterPill active={activeFilter === 'all'} onClick={() => onFilterChange('all')}>
          All Rules
        </FilterPill>
        <FilterPill active={activeFilter === 'active'} onClick={() => onFilterChange('active')}>
          Active Only
        </FilterPill>
        <FilterPill active={activeFilter === 'paused'} onClick={() => onFilterChange('paused')}>
          Paused
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
