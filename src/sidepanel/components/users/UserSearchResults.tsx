/**
 * @module sidepanel/components/users/UserSearchResults
 * @description Clickable list of user search results with status badges.
 *
 * Each row is {@link sidepanel/components/shared/ListRow} at `comfortable` density
 * rendered `as="button"` (ADR-0029). It used to be a `<div onClick>` with no role,
 * no `tabIndex` and no focus ring, so a keyboard user could not reach a search
 * result at all; `ListRow` supplies the button semantics, the pointer cursor and
 * the focus ring, and the row is now tab-reachable and Enter/Space-activatable.
 * A plain `as="button"` is safe here because the interior is text and a status
 * pill — no nested control, so no `nested-interactive` violation.
 *
 * The interior follows the row typography contract in `docs/design-system.md`,
 * which fixed a title that carried no size class (rendering at 16px beside every
 * peer row's 14px) and a secondary line a step too large.
 *
 * The row list uses `.rise-in-stagger` (a wrapper class, not a per-row index prop)
 * so results feel like they land one after another rather than appearing as one
 * block — see `hooks/useStaggerReveal` for the scroll-triggered cascade.
 */
import React from 'react';
import { useStaggerReveal } from '../../hooks/useStaggerReveal';
import type { OktaUser } from '../../../shared/types';
import { ListRow, userStatusVariant, type UserStatusVariant } from '../shared';

/** Props for {@link UserSearchResults}. */
interface UserSearchResultsProps {
  /** Matching users to render; an empty array renders nothing. */
  results: OktaUser[];
  /** Invoked with the chosen user when a result row is clicked. */
  onSelectUser: (user: OktaUser) => void;
}

/** Per-variant badge color classes (token palette, keyed by the shared variant map). */
const VARIANT_CLASSES: Record<UserStatusVariant, string> = {
  success: 'bg-success-light text-success-text',
  info: 'bg-primary-light text-primary-text',
  warning: 'bg-warning-light text-warning-text',
  danger: 'bg-danger-light text-danger-text',
  neutral: 'bg-neutral-100 text-neutral-700',
};

/** Maps an Okta user status to its badge classes via the shared variant map (ADR-0002). */
const getStatusBadgeClass = (status: string) =>
  `px-2 py-0.5 rounded-md text-xs font-medium ${VARIANT_CLASSES[userStatusVariant(status)]}`;

/**
 * Displays a list of user search results as clickable cards; renders nothing when
 * there are no results.
 */
const UserSearchResults: React.FC<UserSearchResultsProps> = ({ results, onSelectUser }) => {
  const setStaggerRef = useStaggerReveal();

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 animate-rise-in">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-900">Search Results</h3>
        <span className="px-3 py-1 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-md">
          {results.length} {results.length === 1 ? 'user' : 'users'}
        </span>
      </div>
      <div ref={setStaggerRef} className="space-y-3 rise-in-stagger">
        {results.map((user) => (
          // `className="group"` only names the hover group — `ListRow` owns the
          // chrome, and the title's hover colour is the one interior effect kept.
          <ListRow
            key={user.id}
            as="button"
            density="comfortable"
            onClick={() => onSelectUser(user)}
            className="group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="mb-1 text-sm font-semibold text-neutral-900 group-hover:text-primary-text transition-colors duration-(--dur-instant)">
                  {user.profile.firstName} {user.profile.lastName}
                </h4>
                <div className="mb-1 text-xs text-neutral-600">{user.profile.email}</div>
                <div className="font-mono text-xs text-neutral-500">
                  Login: {user.profile.login}
                </div>
              </div>
              <span className={getStatusBadgeClass(user.status)}>{user.status}</span>
            </div>
          </ListRow>
        ))}
      </div>
    </div>
  );
};

export default UserSearchResults;
