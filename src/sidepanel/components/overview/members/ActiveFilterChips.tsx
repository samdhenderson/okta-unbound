import React from 'react';
import type { MemberFilter } from './memberAnalytics';

interface ActiveFilterChipsProps {
  filters: MemberFilter[];
  onRemove: (filter: MemberFilter) => void;
  onClearAll: () => void;
}

const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({ filters, onRemove, onClearAll }) => {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <span
          key={`${filter.dimension}:${filter.value}`}
          className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-primary-light text-primary-text"
        >
          {filter.label}
          <button
            type="button"
            onClick={() => onRemove(filter)}
            className="hover:text-primary-dark transition-colors duration-100"
            aria-label={`Remove ${filter.label} filter`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-medium text-neutral-500 hover:text-neutral-800 underline transition-colors duration-100"
      >
        Clear all
      </button>
    </div>
  );
};

export default ActiveFilterChips;
