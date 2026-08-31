/**
 * @module sidepanel/components/rules/RulesSearchRow
 * @description The Rules rung's search field and its filter disclosure, side by side —
 * the node the action strip renders in its `subRow`.
 *
 * This is the first half of the old `RulesToolbar`. It is a separate component from
 * {@link sidepanel/components/rules/RulesFilterPanel} because the two now live in
 * different places: the field goes *inside* the strip's band, where it docks with the
 * verbs and stays reachable at any scroll offset (ADR-0051 §5), and the panel it
 * discloses renders below the band.
 *
 * The shape — `Input size="lg"` with a leading glyph, then a `FilterToggle` beside it —
 * is the Groups rung's `searchRow`, deliberately. Two list rungs that filter the same way
 * should not read as two different controls.
 */
import React from 'react';
import Input from '../shared/Input';
import Icon from '../shared/Icon';
import FilterToggle from '../shared/FilterToggle';

interface RulesSearchRowProps {
  /** Current search text. */
  searchQuery: string;
  onSearchChange: (value: string) => void;
  /** Whether the filter panel below the band is open. */
  filtersOpen: boolean;
  /** Toggles that panel. */
  onToggleFilters: () => void;
  /** Number of filters applied — the toggle's badge, and the panel's only trace once closed. */
  activeFilterCount: number;
}

/** Renders the Rules rung's search field beside its filter disclosure. */
const RulesSearchRow: React.FC<RulesSearchRowProps> = ({
  searchQuery,
  onSearchChange,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
}) => (
  <div className="flex gap-2">
    <div className="min-w-0 flex-1">
      <Input
        type="search"
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Search rules by name, condition, or attributes..."
        size="lg"
        icon={<Icon type="search" size="md" />}
      />
    </div>
    <FilterToggle
      open={filtersOpen}
      activeCount={activeFilterCount}
      onToggle={onToggleFilters}
      size="lg"
      title="Filter and sort the rules list"
    />
  </div>
);

export default RulesSearchRow;
