/**
 * @module sidepanel/components/users/UserSearchPanel
 * @description The Users tab's "find a user" surface: search box, detected-user banner, results, empty state.
 *
 * Purely presentational — every piece of state (the debounced query, the banner's
 * visibility, the results) is owned by
 * {@link sidepanel/hooks/useUsersTabState.useUsersTabState}; this component only
 * renders it and forwards intent.
 *
 * It renders its parts as siblings of the tab body (a fragment, so the tab's
 * `space-y-6` rhythm is unchanged) and exposes an {@link UserSearchPanelProps.alerts}
 * slot for the tab's merged error / result banners, which sit between the search box
 * and the results exactly as they did before the decomposition.
 */
import React from 'react';
import { EmptyState } from '../shared';
import DetectedUserBanner from './DetectedUserBanner';
import UserSearchBar from './UserSearchBar';
import UserSearchResults from './UserSearchResults';
import type { OktaUser, UserInfo } from '../../../shared/types';

/** Props for {@link UserSearchPanel}. */
export interface UserSearchPanelProps {
  /** Current search box value. */
  searchQuery: string;
  /** Invoked on every keystroke; the caller's debounce decides when to search. */
  onSearchQueryChange: (query: string) => void;
  /** Clears the search, selection and banners (the search box's clear button). */
  onClearSearch: () => void;
  /** True while a debounced search is in flight (drives the box's spinner). */
  isSearching: boolean;
  /** Latest committed search results; an empty array renders no results block. */
  searchResults: OktaUser[];
  /** Invoked with the chosen user when a result row is clicked. */
  onSelectUser: (user: OktaUser) => void;
  /**
   * The user detected on the current admin page, or `null` to hide the banner.
   * Loading is manual only, so the tab is never hijacked by admin navigation.
   */
  detectedUser: UserInfo | null;
  /** Disables the banner's Load button while a load/analysis is in flight. */
  isDetectedUserLoading: boolean;
  /** Load the detected user + their memberships into the tab. */
  onLoadDetectedUser: () => void;
  /** Dismiss the detected-user banner without loading. */
  onDismissDetectedUser: () => void;
  /** Whether a user is selected — hides the results and the empty state. */
  hasSelectedUser: boolean;
  /** Whether the tab is showing an error — suppresses the empty state. */
  hasError: boolean;
  /**
   * The tab's merged error / result banners, rendered between the search box and
   * the results.
   */
  alerts?: React.ReactNode;
}

/**
 * The Users tab's search surface: the search box, the manual-load detected-user
 * banner, the search results and the pre-search empty state.
 */
const UserSearchPanel: React.FC<UserSearchPanelProps> = ({
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
  isSearching,
  searchResults,
  onSelectUser,
  detectedUser,
  isDetectedUserLoading,
  onLoadDetectedUser,
  onDismissDetectedUser,
  hasSelectedUser,
  hasError,
  alerts,
}) => {
  return (
    <>
      {/* Search Section */}
      <div className="space-y-3">
        <UserSearchBar
          searchQuery={searchQuery}
          onSearchChange={onSearchQueryChange}
          onClear={onClearSearch}
          isSearching={isSearching}
          showClearButton={Boolean(searchQuery || hasSelectedUser)}
        />

        {/* Detected-user banner: manual load only, so the tab is never hijacked. */}
        {detectedUser && (
          <DetectedUserBanner
            userInfo={detectedUser}
            isLoading={isDetectedUserLoading}
            onLoad={onLoadDetectedUser}
            onDismiss={onDismissDetectedUser}
          />
        )}
      </div>

      {alerts}

      {/* Search Results (the component self-hides when empty; caller gates on selection) */}
      {!hasSelectedUser && (
        <UserSearchResults results={searchResults} onSelectUser={onSelectUser} />
      )}

      {/* Empty State - Show only when no search and no user selected */}
      {!isSearching &&
        searchResults.length === 0 &&
        !hasError &&
        !hasSelectedUser &&
        !searchQuery && (
          <EmptyState
            icon="user"
            title="User Membership Tracing"
            description="Search for users to analyze their group memberships and understand why they're in specific groups"
          />
        )}
    </>
  );
};

export default UserSearchPanel;
