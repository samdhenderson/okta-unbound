/**
 * @module sidepanel/components/users/comparison/ComparisonSearchPhase
 * @description Phase 1 of the comparison surface: search for and pick the second user.
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
  /** Display name of the context user, shown in the intro copy. */
  contextName: string;
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
  contextName,
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  onSelectUser,
}) => {
  const filtered = searchResults.filter((u) => u.id !== contextUser.id);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-md border border-primary-highlight bg-primary-light/60 p-4">
        <div
          className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-white p-2 text-primary shadow-sm">
            <Icon type="sparkles" size="md" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-900">Compare with another user</p>
            <p className="mt-0.5 text-xs text-neutral-600 leading-relaxed">
              Find someone to compare side-by-side with{' '}
              <span className="font-semibold text-primary-text">{contextName}</span>. You&rsquo;ll
              see shared and unique groups and app assignments and can quickly copy missing groups
              over.
            </p>
          </div>
        </div>
      </div>

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

      {!isSearching && searchQuery.trim().length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-10 text-center">
          <div className="rounded-full bg-white p-3 text-neutral-400 shadow-sm">
            <Icon type="users" size="lg" />
          </div>
          <p className="mt-3 text-sm font-medium text-neutral-700">Start typing to search</p>
          <p className="mt-1 text-xs text-neutral-500">Try a name, a login, or an email domain.</p>
        </div>
      )}

      <UserSearchResults results={filtered} onSelectUser={onSelectUser} />
    </div>
  );
};

export default ComparisonSearchPhase;
