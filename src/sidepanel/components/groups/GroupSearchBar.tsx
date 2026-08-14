/**
 * @module sidepanel/components/groups/GroupSearchBar
 * @description The groups search input row; swaps its bound query by search mode.
 */
import React from 'react';
import { Input, LoadingSpinner } from '../shared';
import Icon from '../overview/shared/Icon';

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
 * search glyph (`Icon`) and a trailing spinner (`LoadingSpinner`) while a live
 * search is in flight. A thin controlled wrapper over the shared `Input`,
 * following the `MemberSearchBar` pattern.
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
    {searchMode === 'live' ? (
      <Input
        type="text"
        placeholder="Search groups by name..."
        value={liveSearchQuery}
        onChange={onLiveSearchQueryChange}
        icon={<Icon type="search" size="sm" />}
      />
    ) : (
      <Input
        type="text"
        placeholder="Search by name, description, ID — or /regex/"
        value={searchQuery}
        onChange={onSearchQueryChange}
        icon={<Icon type="search" size="sm" />}
      />
    )}
    {isLiveSearching && (
      <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
        <LoadingSpinner size="sm" />
      </div>
    )}
  </div>
);

export default GroupSearchBar;
