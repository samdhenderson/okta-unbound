/**
 * @module sidepanel/components/apps/AppsToolbar
 * @description Search, status filter, and sort controls for the Applications list.
 *
 * A fully controlled presentational row: the search {@link Input} (which accepts a
 * `/regex/` query, matched by `appFilters`), the status {@link FilterPill} bucket
 * toggles, and one {@link SortPill} per sort field, plus a "showing X of Y" count.
 */
import React from 'react';
import { FilterPill, Input, SortPill } from '../shared';
import Icon from '../overview/shared/Icon';
import type { AppSortField, AppStatusFilter } from './appFilters';

/** The status buckets offered, in display order. */
const STATUS_OPTIONS: ReadonlyArray<{ value: AppStatusFilter; label: string }> = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

/** The sortable fields, in display order. */
const SORT_OPTIONS: ReadonlyArray<{ field: AppSortField; label: string }> = [
  { field: 'label', label: 'Name' },
  { field: 'status', label: 'Status' },
  { field: 'created', label: 'Created' },
];

/** Props for {@link AppsToolbar}. */
export interface AppsToolbarProps {
  /** Current search text (`/pattern/flags` is treated as a regex). */
  searchQuery: string;
  /** Called with the new search text. */
  onSearchQueryChange: (value: string) => void;
  /** Selected status bucket (`''` = all). */
  statusFilter: AppStatusFilter;
  /** Called with the newly selected status bucket. */
  onStatusFilterChange: (value: AppStatusFilter) => void;
  /** The active sort field. */
  sortBy: AppSortField;
  /** Whether the active sort is descending. */
  sortDesc: boolean;
  /** Select a sort field, or flip the direction when it is already active. */
  onToggleSort: (field: AppSortField) => void;
  /** Number of apps after filtering. */
  resultCount: number;
  /** Number of apps loaded in total. */
  totalCount: number;
}

/**
 * The Applications list toolbar: search box, status buckets, and sort pills.
 *
 * Stateless by design — the tab shell owns the filter state so the same values
 * drive both this row and the filtered list.
 */
const AppsToolbar: React.FC<AppsToolbarProps> = ({
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  sortDesc,
  onToggleSort,
  resultCount,
  totalCount,
}) => (
  <div className="space-y-3">
    <Input
      type="search"
      value={searchQuery}
      onChange={onSearchQueryChange}
      ariaLabel="Search applications"
      placeholder="Search by name, app key, ID — or /regex/"
      icon={<Icon type="search" size="md" />}
    />

    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5" role="group" aria-label="Filter by status">
        <span className="text-xs font-medium text-neutral-600">Status</span>
        {STATUS_OPTIONS.map((option) => (
          <FilterPill
            key={option.value || 'all'}
            active={statusFilter === option.value}
            onClick={() => onStatusFilterChange(option.value)}
          >
            {option.label}
          </FilterPill>
        ))}
      </div>

      <div className="flex items-center gap-1.5" role="group" aria-label="Sort applications">
        <span className="text-xs font-medium text-neutral-600">Sort</span>
        {SORT_OPTIONS.map((option) => (
          <SortPill
            key={option.field}
            field={option.field}
            label={option.label}
            activeField={sortBy}
            descending={sortDesc}
            onToggle={onToggleSort}
          />
        ))}
      </div>

      <span className="ml-auto text-xs text-neutral-500">
        Showing {resultCount.toLocaleString()} of {totalCount.toLocaleString()}
      </span>
    </div>
  </div>
);

export default AppsToolbar;
