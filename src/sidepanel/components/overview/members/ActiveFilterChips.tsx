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
      <span className="text-xs font-medium text-neutral-500">Active:</span>
      {filters.map((filter) => (
        <span
          key={`${filter.dimension}:${filter.value}`}
          className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light text-primary-text rounded-full text-xs font-medium border border-primary-highlight"
        >
          {filter.label}
          <button
            type="button"
            onClick={() => onRemove(filter)}
            className="p-0.5 hover:bg-primary-highlight rounded-full transition-colors"
            aria-label={`Remove ${filter.label} filter`}
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
      ))}
      <button onClick={onClearAll} className="text-xs text-primary-text hover:underline ml-1">
        Clear all
      </button>
    </div>
  );
};

export default ActiveFilterChips;
