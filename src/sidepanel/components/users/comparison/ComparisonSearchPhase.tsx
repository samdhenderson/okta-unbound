/**
 * @module sidepanel/components/users/comparison/ComparisonSearchPhase
 * @description Phase 1 of the comparison modal: search for and pick the second user.
 */
import React from 'react';
import Icon from '../../overview/shared/Icon';
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
 * Phase 1 of the comparison modal: pick a second user to compare against.
 * The raw <input> and hand-rolled spinner are kept verbatim — migrating them to
 * shared Input/LoadingSpinner is a separate, non-pixel-neutral §3 follow-up.
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
      <div className="relative overflow-hidden rounded-lg border border-primary-highlight bg-primary-light/60 p-4">
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

      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <Icon type="search" size="md" />
        </div>
        <input
          type="text"
          autoFocus
          className="w-full rounded-md border border-neutral-200 bg-white pl-10 pr-4 py-3 text-sm placeholder-neutral-400 shadow-sm transition-all duration-100 focus:border-primary focus:outline-2 focus:outline-offset-2 focus:outline-primary"
          placeholder="Search by email, name, or login…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isSearching && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-neutral-500">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
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
