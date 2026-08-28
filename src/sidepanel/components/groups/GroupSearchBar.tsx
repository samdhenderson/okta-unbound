/**
 * @module sidepanel/components/groups/GroupSearchBar
 * @description The groups search input row; swaps its bound query by search mode.
 */
import React from 'react';
import { Input, LoadingSpinner } from '../shared';
import Icon from '../shared/Icon';

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
 *
 * `size="lg"` reproduces the original hand-rolled field exactly: `lg`'s
 * `pl-11`/`py-3` match the pre-migration `pl-11 py-3`. The spinner stays a
 * manually-positioned sibling (not `Input`'s `trailing` slot) because the
 * original field's right padding was a constant `pr-4` — the same value as
 * `lg`'s own base horizontal padding — with no extra room reserved for the
 * spinner; routing it through `trailing` would add a `pr-12` reservation the
 * original never had.
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
        size="lg"
        icon={<Icon type="search" size="md" />}
      />
    ) : (
      <Input
        type="text"
        placeholder="Search by name, description, ID — or /regex/"
        value={searchQuery}
        onChange={onSearchQueryChange}
        size="lg"
        icon={<Icon type="search" size="md" />}
      />
    )}
    {isLiveSearching && (
      <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
        <LoadingSpinner size="md" />
      </div>
    )}
  </div>
);

export default GroupSearchBar;
