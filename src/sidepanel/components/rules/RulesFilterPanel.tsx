/**
 * @module sidepanel/components/rules/RulesFilterPanel
 * @description The Rules rung's disclosed filter panel: the status/conflict/current-group
 * chips and the list sort order.
 *
 * It is the second half of the old `RulesToolbar`, which was one card holding a search
 * field, five chips and a sort `Select`. That card sat above the list and scrolled away
 * with it, so the filter narrowing the list was invisible exactly when you were reading
 * the narrowed list. The search field moved into the action strip's `subRow` (ADR-0051 §5)
 * where it docks; everything else moved here, behind the strip's `FilterToggle`, and the
 * count on that toggle is what stays visible once this panel is closed.
 *
 * Chips route through the shared {@link FilterPill} and the sort row through the shared
 * {@link Select}, exactly as they did in the toolbar — this is a relocation, not a
 * redesign, and the container is the same `GroupFilterPanel` recipe the Groups rung's
 * panel uses so the two rungs read as one pattern.
 */
import React from 'react';
import FilterPill from '../shared/FilterPill';
import Select from '../shared/Select';
import { RULE_SORT_LABELS, type RuleSortMode } from '../../../shared/rules/similarity';

/** Client-side filter applied on top of the text search over loaded rules. */
export type RulesFilterType = 'all' | 'active' | 'paused' | 'conflicts' | 'current-group';

/** Order in which the sort options are offered. */
const SORT_OPTIONS: RuleSortMode[] = ['default', 'similarity', 'name'];

/**
 * How many filters the reader has applied — the number on the strip's
 * {@link sidepanel/components/shared/FilterToggle} badge, and the only statement of this
 * panel's state once it is closed.
 *
 * A non-default sort counts. It reorders the list without removing anything, but
 * `Group similar` is the entire affordance for the fuzzy near-duplicate detector, and a
 * reader who left it on and forgot has a list whose order they cannot otherwise explain.
 *
 * @param activeFilter - The active filter chip.
 * @param sortMode - The active sort order.
 * @returns The badge count, 0–2.
 */
export const countActiveRuleFilters = (
  activeFilter: RulesFilterType,
  sortMode: RuleSortMode,
): number => (activeFilter !== 'all' ? 1 : 0) + (sortMode !== 'default' ? 1 : 0);

interface RulesFilterPanelProps {
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

/** Renders the Rules rung's filter chips and sort selector. */
const RulesFilterPanel: React.FC<RulesFilterPanelProps> = ({
  activeFilter,
  onFilterChange,
  conflictsCount,
  showCurrentGroup,
  sortMode,
  onSortChange,
}) => (
  <div className="animate-rise-in space-y-(--sp-field) rounded-md border border-neutral-200 bg-white p-(--sp-card)">
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
        {/*
          Disabled rather than omitted, and it keeps its `(0)`. Unlike a
          selection-scoped verb (ADR-0051 §3), "how many rules conflict" is a
          finding about the loaded set, and zero is the good answer — worth
          stating rather than making the reader wonder whether the check ran.
        */}
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

export default RulesFilterPanel;
