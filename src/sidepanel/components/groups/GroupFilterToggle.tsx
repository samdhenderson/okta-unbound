import React from 'react';

interface GroupFilterToggleProps {
  showFilters: boolean;
  activeFilterCount: number;
  onToggle: () => void;
}

/**
 * The Filters toggle button with its active-filter count badge. Rendered next to the
 * search bar in cached mode only. Kept a raw <button> (documented §3 exception — the
 * primary-light active styling does not map cleanly onto a shared Button variant).
 */
const GroupFilterToggle: React.FC<GroupFilterToggleProps> = ({
  showFilters,
  activeFilterCount,
  onToggle,
}) => (
  <button
    onClick={onToggle}
    className={`px-4 py-3 rounded-md border text-sm font-medium transition-all duration-100 flex items-center gap-2 ${
      showFilters || activeFilterCount > 0
        ? 'bg-primary-light border-primary text-primary-text'
        : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400'
    }`}
    title="Toggle filters"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
    Filters
    {activeFilterCount > 0 && (
      <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-primary text-white min-w-[20px] text-center">
        {activeFilterCount}
      </span>
    )}
  </button>
);

export default GroupFilterToggle;
