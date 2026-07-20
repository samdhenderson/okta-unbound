/**
 * @module sidepanel/components/groups/GroupFilterPanel
 * @description Expandable cached-mode filter + sort panel for the groups list.
 *
 * A controlled component: all filter/sort state lives in the parent hook and is passed
 * down with its setters. See `filterAndSortGroups` for how these axes are applied.
 */
import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { FilterPill, SortPill } from '../shared';
import type { SortField, StalenessLevel, PushFilter } from './groupFilters';

interface GroupFilterPanelProps {
  /** Number of active filters (drives the active-chips row). */
  activeFilterCount: number;
  /** Selected group-type filter (`''` = all). */
  typeFilter: string;
  setTypeFilter: (value: string) => void;
  /** Selected member-count bucket (`''` = all). */
  sizeFilter: string;
  setSizeFilter: (value: string) => void;
  /** Push-status filter. */
  pushFilter: PushFilter;
  setPushFilter: (value: PushFilter) => void;
  /** Set of push-target app ids to filter by (empty = all). */
  pushAppFilter: Set<string>;
  setPushAppFilter: Dispatch<SetStateAction<Set<string>>>;
  /** Selected health/staleness bucket (`''` = all). */
  stalenessFilter: StalenessLevel;
  setStalenessFilter: (value: StalenessLevel) => void;
  /** Push-target apps available as filter chips. */
  availablePushApps: { id: string; name: string }[];
  /** Active sort field. */
  sortBy: SortField;
  /** Whether the active sort is descending. */
  sortDesc: boolean;
  /** Toggles the sort field (or flips direction if already active). */
  toggleSort: (field: SortField) => void;
  /** Resets all filters (and the search query). */
  clearFilters: () => void;
}

/**
 * The expandable filter panel: active-filter chips, the 2×2 type/size/push/health
 * grid, the push-target-app row, and the sort row. The five filter/toggle groups
 * (type, size, push status, push-target app, and the semantic-colored health pills
 * via `FilterPill`'s `inactiveClassName` escape hatch) route through the shared
 * `FilterPill`, and the sort row through the shared `SortPill` (§3). Two controls
 * stay raw as documented exceptions: the "Clear all" text-link (no shared text-link
 * primitive) and the active-filter chip's close button (a bespoke `rounded-full`
 * chip-remove).
 */
const GroupFilterPanel: React.FC<GroupFilterPanelProps> = ({
  activeFilterCount,
  typeFilter,
  setTypeFilter,
  sizeFilter,
  setSizeFilter,
  pushFilter,
  setPushFilter,
  pushAppFilter,
  setPushAppFilter,
  stalenessFilter,
  setStalenessFilter,
  availablePushApps,
  sortBy,
  sortDesc,
  toggleSort,
  clearFilters,
}) => (
  <div className="p-4 bg-white rounded-md border border-neutral-200 space-y-4 animate-in slide-in-from-top-2 duration-100">
    {/* Active Filters Chips */}
    {activeFilterCount > 0 && (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-neutral-500">Active:</span>
        {typeFilter && (
          <FilterChip
            label={`Type: ${typeFilter.replace('_', ' ')}`}
            onRemove={() => setTypeFilter('')}
          />
        )}
        {sizeFilter && (
          <FilterChip label={`Size: ${sizeFilter}`} onRemove={() => setSizeFilter('')} />
        )}
        {pushFilter && (
          <FilterChip label={`Push: ${pushFilter}`} onRemove={() => setPushFilter('')} />
        )}
        {stalenessFilter && (
          <FilterChip
            label={`Health: ${stalenessFilter.replace('_', ' ')}`}
            onRemove={() => setStalenessFilter('')}
          />
        )}
        {pushAppFilter.size > 0 && (
          <FilterChip
            label={`Apps: ${Array.from(pushAppFilter)
              .map((id) => availablePushApps.find((a) => a.id === id)?.name || id)
              .join(', ')}`}
            onRemove={() => setPushAppFilter(new Set())}
          />
        )}
        {/* §3 exception: chromeless text-link — no shared text-link primitive. */}
        <button
          type="button"
          onClick={clearFilters}
          className="text-xs text-primary-text hover:underline ml-1"
        >
          Clear all
        </button>
      </div>
    )}

    {/* Filter Grid */}
    <div className="grid grid-cols-2 gap-3">
      {/* Type Filter */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Group Type</label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: '', label: 'All' },
            { value: 'OKTA_GROUP', label: 'Okta' },
            { value: 'APP_GROUP', label: 'App' },
            { value: 'BUILT_IN', label: 'Built-in' },
          ].map((opt) => (
            <FilterPill
              key={opt.value}
              active={typeFilter === opt.value}
              onClick={() => setTypeFilter(opt.value)}
            >
              {opt.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Size Filter */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Group Size</label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: '', label: 'All' },
            { value: 'empty', label: 'Empty' },
            { value: 'small', label: '1-50' },
            { value: 'medium', label: '50-200' },
            { value: 'large', label: '200-1K' },
            { value: 'xlarge', label: '1K+' },
          ].map((opt) => (
            <FilterPill
              key={opt.value}
              active={sizeFilter === opt.value}
              onClick={() => setSizeFilter(opt.value)}
            >
              {opt.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Push Status Filter */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Push Status</label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: '' as PushFilter, label: 'All' },
            { value: 'pushed' as PushFilter, label: 'Pushed' },
            { value: 'not_pushed' as PushFilter, label: 'Not Pushed' },
          ].map((opt) => (
            <FilterPill
              key={opt.value}
              active={pushFilter === opt.value}
              onClick={() => setPushFilter(opt.value)}
            >
              {opt.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Health / Staleness Filter */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Group Health</label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: '' as StalenessLevel, label: 'All', color: '' },
            {
              value: 'healthy' as StalenessLevel,
              label: 'Healthy',
              color: 'bg-success-light text-success-text border-success-light',
            },
            {
              value: 'monitor' as StalenessLevel,
              label: 'Monitor',
              color: 'bg-warning-light text-warning-text border-warning-light',
            },
            {
              value: 'stale' as StalenessLevel,
              label: 'Stale',
              color: 'bg-warning-light text-danger-text border-warning-light',
            },
            {
              value: 'very_stale' as StalenessLevel,
              label: 'Critical',
              color: 'bg-danger-light text-danger-text border-danger-light',
            },
          ].map((opt) => (
            // The colored inactive states carry their own semantic border+fill via
            // `inactiveClassName`; the neutral "All" option falls back to FilterPill's
            // default. Active uses FilterPill's standard borderless primary fill (the
            // raw markup's invisible `border-primary` on the active pill is dropped).
            <FilterPill
              key={opt.value}
              active={stalenessFilter === opt.value}
              onClick={() => setStalenessFilter(opt.value)}
              inactiveClassName={opt.color ? `border ${opt.color}` : undefined}
            >
              {opt.label}
            </FilterPill>
          ))}
        </div>
      </div>
    </div>

    {/* Push Target App Filter */}
    {availablePushApps.length > 0 && (
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Push Target App</label>
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={pushAppFilter.size === 0} onClick={() => setPushAppFilter(new Set())}>
            All
          </FilterPill>
          {availablePushApps.map((app) => (
            <FilterPill
              key={app.id}
              active={pushAppFilter.has(app.id)}
              onClick={() => {
                setPushAppFilter((prev) => {
                  const next = new Set(prev);
                  if (next.has(app.id)) next.delete(app.id);
                  else next.add(app.id);
                  return next;
                });
              }}
            >
              {app.name}
            </FilterPill>
          ))}
        </div>
      </div>
    )}

    {/* Sort Controls */}
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1.5">Sort by</label>
      <div className="flex flex-wrap gap-1.5">
        {[
          { value: 'name' as SortField, label: 'Name' },
          { value: 'memberCount' as SortField, label: 'Size' },
          { value: 'lastUpdated' as SortField, label: 'Last Updated' },
          { value: 'staleness' as SortField, label: 'Staleness' },
        ].map((opt) => (
          <SortPill
            key={opt.value}
            field={opt.value}
            label={opt.label}
            activeField={sortBy}
            descending={sortDesc}
            onToggle={toggleSort}
          />
        ))}
      </div>
    </div>
  </div>
);

/**
 * Small chip for showing active filters with remove button. §3 exception: the
 * `rounded-full` chip and its bespoke chip-remove close button (no matching `x`
 * glyph in the Icon registry; IconButton is `rounded-md`, not pixel-neutral here).
 */
const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light text-primary-text rounded-full text-xs font-medium border border-primary-highlight">
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label}`}
      className="p-0.5 hover:bg-primary-highlight rounded-full transition-colors"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </span>
);

export default GroupFilterPanel;
