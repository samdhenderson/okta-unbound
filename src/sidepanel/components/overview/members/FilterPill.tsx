import React from 'react';

interface FilterPillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  /** Optional custom classes for the inactive state (e.g. semantic colors). */
  inactiveClassName?: string;
}

/**
 * A small pill/button used inside filter panels. Matches the Groups tab filter
 * button styling: solid primary when active, neutral outline when inactive.
 */
const FilterPill: React.FC<FilterPillProps> = ({
  active,
  onClick,
  children,
  title,
  inactiveClassName = 'bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-400',
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-pressed={active}
    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
      active ? 'bg-primary text-white' : inactiveClassName
    }`}
  >
    {children}
  </button>
);

export default FilterPill;
