/**
 * @module sidepanel/components/users/comparison/ComparisonSearchPhase
 * @description Phase 1 of the comparison surface: search for and pick the second user.
 *
 * The screen is the search box and its results, and nothing else. It previously
 * opened with an intro card naming the context user and a dashed "Start typing to
 * search" panel, which between them pushed the only control on the screen below
 * the fold in a 360px panel. Neither stated a fact the screen does not already
 * carry: the admin arrived here through the **Compare** action and the header
 * names what they are comparing, so the card explained the button they had just
 * pressed and the panel explained the field beneath it.
 */
import React from 'react';
import Icon from '../../shared/Icon';
import Input from '../../shared/Input';
import LoadingSpinner from '../../shared/LoadingSpinner';
import UserSearchResults from '../UserSearchResults';
import type { OktaUser } from '../../../../shared/types';

/** Props for {@link ComparisonSearchPhase}. */
interface ComparisonSearchPhaseProps {
  /** The context user; excluded from results so users can't compare with themselves. */
  contextUser: OktaUser;
  /** Current search text (controlled). */
  searchQuery: string;
  /** Updates the search text. */
  setSearchQuery: (v: string) => void;
  /** When true, shows the "Searching directory…" indicator. */
  isSearching: boolean;
  /** Raw search results; the context user is filtered out before rendering. */
  searchResults: OktaUser[];
  /** Invoked with the chosen user to enter the comparison phase. */
  onSelectUser: (u: OktaUser) => void;
}

/**
 * Phase 1 of the comparison surface: pick a second user to compare against.
 */
const ComparisonSearchPhase: React.FC<ComparisonSearchPhaseProps> = ({
  contextUser,
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  onSelectUser,
}) => {
  const filtered = searchResults.filter((u) => u.id !== contextUser.id);

  return (
    <div className="space-y-(--sp-rung)">
      {/*
        No `autoFocus`: neither host has ever produced focus here (Modal's own
        effect focuses its close button after the child commit — characterized in
        the retired Overview dialog), and the pushed host mounts this input while
        the view is popped, where autofocusing would steal focus from the tab.
        Focus into a pushed view is `useViewStack`'s job, and it lands here.
      */}
      <Input
        size="lg"
        type="text"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by email, name, or login…"
        icon={<Icon type="search" size="sm" />}
      />

      {isSearching && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-neutral-500">
          <LoadingSpinner size="sm" />
          Searching directory…
        </div>
      )}

      <UserSearchResults results={filtered} onSelectUser={onSelectUser} />
    </div>
  );
};

export default ComparisonSearchPhase;
