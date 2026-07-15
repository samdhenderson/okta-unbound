/**
 * @module sidepanel/components/overview/members/ActiveFilterChips
 * @description Removable chips summarizing the member explorer's active facet filters.
 *
 * Renders one chip per active {@link MemberFilter} (each with a remove button)
 * plus a "Clear all" action. Renders nothing when no filters are active.
 */
import React from 'react';
import { IconButton } from '../../shared';
import type { MemberFilter } from './memberAnalytics';

/** Props for {@link ActiveFilterChips}. */
interface ActiveFilterChipsProps {
  /** Currently active facet filters. */
  filters: MemberFilter[];
  /** Remove a single filter. */
  onRemove: (filter: MemberFilter) => void;
  /** Remove every active filter. */
  onClearAll: () => void;
}

/** Renders active-filter chips; collapses to nothing when `filters` is empty. */
const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({ filters, onRemove, onClearAll }) => {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-neutral-500">Active:</span>
      {filters.map((filter) => (
        <span
          key={`${filter.dimension}:${filter.value}`}
          className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light text-primary-text rounded-full text-xs font-medium border border-primary-highlight"
        >
          {filter.label}
          <IconButton
            label={`Remove ${filter.label} filter`}
            onClick={() => onRemove(filter)}
            variant="ghost"
            size="sm"
            className="rounded-full"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </IconButton>
        </span>
      ))}
      <button onClick={onClearAll} className="text-xs text-primary-text hover:underline ml-1">
        Clear all
      </button>
    </div>
  );
};

export default ActiveFilterChips;
