/**
 * @module sidepanel/components/groups/GroupSearchBar
 * @description The groups search input row; swaps its bound query by search mode.
 */
import React from 'react';

interface GroupSearchBarProps {
  /** `live` queries Okta directly; `cached` filters the loaded list. */
  searchMode: 'live' | 'cached';
  /** Query bound in live mode. */
  liveSearchQuery: string;
  onLiveSearchQueryChange: (value: string) => void;
  /** Query bound in cached mode. */
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  /** Whether a live search is in flight (shows the trailing spinner). */
  isLiveSearching: boolean;
}

/**
 * The search input row. Swaps placeholder/value/onChange by mode, with a leading
 * search glyph and a trailing spinner while a live search is in flight.
 *
 * The two raw <input>s use `py-3` + a custom icon slot; routing them through the
 * shared Input would shrink the bar (§3 records this — migrate only once Input gains
 * a size prop).
 */
const GroupSearchBar: React.FC<GroupSearchBarProps> = ({
  searchMode,
  liveSearchQuery,
  onLiveSearchQueryChange,
  searchQuery,
  onSearchQueryChange,
  isLiveSearching,
}) => (
  <div className="relative flex-1">
    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
      <svg
        className="h-5 w-5 text-neutral-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
    {searchMode === 'live' ? (
      <input
        type="text"
        placeholder="Search groups by name..."
        value={liveSearchQuery}
        onChange={(e) => onLiveSearchQueryChange(e.target.value)}
        className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-200 rounded-md text-sm placeholder-neutral-400 focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary transition-all duration-100"
      />
    ) : (
      <input
        type="text"
        placeholder="Search by name, description, ID — or /regex/"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-200 rounded-md text-sm placeholder-neutral-400 focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary transition-all duration-100"
      />
    )}
    {isLiveSearching && (
      <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
        <div className="w-5 h-5 border-2 border-neutral-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    )}
  </div>
);

export default GroupSearchBar;
