/**
 * @module sidepanel/components/groups/GroupFilterPanel
 * @description Expandable cached-mode filter + sort panel for the groups list.
 *
 * A controlled component: all filter/sort state lives in the parent hook and is passed
 * down with its setters. See `filterAndSortGroups` for how these axes are applied.
 */
import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
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
 * grid, the push-target-app row, and the sort row. The health pills carry their own
 * semantic colors; the raw <button>s here are the §3 debt migrated during a later,
 * deliberate pass — kept raw for pixel parity in the decompose-only split.
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
        <button onClick={clearFilters} className="text-xs text-primary-text hover:underline ml-1">
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
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
              }`}
            >
              {opt.label}
            </button>
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
            <button
              key={opt.value}
              onClick={() => setSizeFilter(opt.value)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                sizeFilter === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
              }`}
            >
              {opt.label}
            </button>
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
            <button
              key={opt.value}
              onClick={() => setPushFilter(opt.value)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                pushFilter === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
              }`}
            >
              {opt.label}
            </button>
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
            <button
              key={opt.value}
              onClick={() => setStalenessFilter(opt.value)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                stalenessFilter === opt.value
                  ? 'bg-primary text-white border-primary'
                  : opt.color ||
                    'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Push Target App Filter */}
    {availablePushApps.length > 0 && (
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">Push Target App</label>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setPushAppFilter(new Set())}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              pushAppFilter.size === 0
                ? 'bg-primary text-white'
                : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
            }`}
          >
            All
          </button>
          {availablePushApps.map((app) => (
            <button
              key={app.id}
              onClick={() => {
                setPushAppFilter((prev) => {
                  const next = new Set(prev);
                  if (next.has(app.id)) next.delete(app.id);
                  else next.add(app.id);
                  return next;
                });
              }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                pushAppFilter.has(app.id)
                  ? 'bg-primary text-white'
                  : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
              }`}
            >
              {app.name}
            </button>
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
          <button
            key={opt.value}
            onClick={() => toggleSort(opt.value)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              sortBy === opt.value
                ? 'bg-primary text-white'
                : 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400'
            }`}
          >
            {opt.label}
            {sortBy === opt.value && (
              <svg
                className={`w-3 h-3 transition-transform ${sortDesc ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  </div>
);

/** Small chip for showing active filters with remove button */
const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light text-primary-text rounded-full text-xs font-medium border border-primary-highlight">
    {label}
    <button
      onClick={onRemove}
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
