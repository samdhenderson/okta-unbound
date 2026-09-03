/**
 * @module sidepanel/components/users/UserSearchPanel
 * @description The Users tab's "find a user" surface: search box, results, empty state.
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
import UserSearchBar from './UserSearchBar';
import UserSearchResults from './UserSearchResults';
import type { OktaUser } from '../../../shared/types';

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
 * The Users tab's search surface: the search box, the search results and the
 * pre-search empty state.
 *
 * It used to carry a third element — the detected-user banner, a row offering to
 * load whichever user the admin console had open. That offer is now the
 * masthead's handoff affordance, which asks the same question for every
 * detectable kind and spends no row of the tab body to ask it.
 */
const UserSearchPanel: React.FC<UserSearchPanelProps> = ({
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
  isSearching,
  searchResults,
  onSelectUser,
  hasSelectedUser,
  hasError,
  alerts,
}) => {
  return (
    <>
      {/* Search Section */}
      <div className="space-y-(--sp-rung)">
        <UserSearchBar
          searchQuery={searchQuery}
          onSearchChange={onSearchQueryChange}
          onClear={onClearSearch}
          isSearching={isSearching}
          showClearButton={Boolean(searchQuery || hasSelectedUser)}
        />
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
