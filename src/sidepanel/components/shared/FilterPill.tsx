/**
 * @module sidepanel/components/shared/FilterPill
 * @description Small toggle pill for filter panels — solid primary when active, outlined when not.
 *
 * A two-state toggle button that reflects its state as `aria-pressed`. For
 * icon-only buttons use `IconButton`; for text CTAs use `Button`.
 */
import React from 'react';

interface FilterPillProps {
  /** Toggle state; when true the pill is filled and `aria-pressed` is set. */
  active: boolean;
  onClick: () => void;
  /** Pill label content. */
  children: React.ReactNode;
  title?: string;
  /** Optional custom classes for the inactive state (e.g. semantic colors). */
  inactiveClassName?: string;
}

/**
 * A small pill/toggle used inside filter panels: solid primary when active,
 * neutral outline when inactive. Reflects its state as `aria-pressed`.
 * For icon-only buttons use `IconButton`; for text CTAs use `Button`.
 *
 * @example
 * ```tsx
 * <FilterPill active={showActiveOnly} onClick={() => setShowActiveOnly((v) => !v)}>
 *   Active only
 * </FilterPill>
 * ```
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
