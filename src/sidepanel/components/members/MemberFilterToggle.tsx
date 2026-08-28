/**
 * @module sidepanel/components/members/MemberFilterToggle
 * @description The "Filters" toggle button with its active-filter count badge,
 * shown beside {@link MemberSearchBar} in the member explorer.
 *
 * Extracted from an inline `<button>` in `MemberExplorer` — the same shape
 * `groups/GroupFilterToggle` already carries for the mirror-image case, so the
 * two entry points read as one control rather than two hand-copied ones.
 */
import React from 'react';

/** Props for {@link MemberFilterToggle}. */
interface MemberFilterToggleProps {
  /** Whether the filter panel is currently expanded (drives the active styling). */
  showFilters: boolean;
  /** Active-filter count shown in the badge (hidden at 0). */
  activeFilterCount: number;
  /** Toggles the filter panel open/closed. */
  onToggle: () => void;
}

/**
 * The Filters toggle button with its active-filter count badge. Kept a raw
 * `<button>` (documented §3 exception, same as `groups/GroupFilterToggle`): the
 * primary-light active styling does not map cleanly onto a shared `Button`
 * variant, and the funnel glyph is not in the shared `Icon` registry.
 */
const MemberFilterToggle: React.FC<MemberFilterToggleProps> = ({
  showFilters,
  activeFilterCount,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={showFilters}
    className={`press flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium ${
      showFilters || activeFilterCount > 0
        ? 'bg-primary-light border-primary text-primary-text'
        : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400'
    }`}
    title="Toggle filters"
  >
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
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

export default MemberFilterToggle;
