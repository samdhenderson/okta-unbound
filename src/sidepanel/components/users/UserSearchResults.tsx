/**
 * @module sidepanel/components/users/UserSearchResults
 * @description Clickable list of user search results with status badges.
 *
 * ## The heading is a label, not a headline
 *
 * The block used to open with an `<h3 className="text-lg font-semibold">Search
 * Results</h3>` beside a `px-3 py-1 bg-neutral-100` count pill — two elements
 * saying one thing, and the pair outweighed the `PageHeader` title sitting
 * directly above it. Both are replaced by a single quiet
 * {@link sidepanel/components/shared/Eyebrow} reading `"{n} matches"`. It is
 * rendered as a `div` rather than a heading on purpose: the count labels the
 * region, it does not title a section, and re-entering it into the document
 * outline under the page's `<h1>` is what made it look like a headline in the
 * first place.
 *
 * ## Rows are two lines at `compact`
 *
 * Each row is {@link sidepanel/components/shared/ListRow} at `compact` density
 * rendered `as="button"` (ADR-0029). It used to be a `<div onClick>` with no
 * role, no `tabIndex` and no focus ring, so a keyboard user could not reach a
 * search result at all; `ListRow` supplies the button semantics, the pointer
 * cursor and the focus ring. A plain `as="button"` is safe here because the
 * interior is text and a status mark — no nested control, so no
 * `nested-interactive` violation.
 *
 * The third line (`Login:` in mono) is gone. A login duplicated the email in
 * every real case, so it cost a third line per row to restate the second one.
 * The interior otherwise follows the row typography contract in
 * `docs/design-system.md`, whose sized primary line fixed a title that carried
 * no size class at all and rendered at 16px beside every peer row's 14px.
 *
 * The status mark is the shared {@link sidepanel/components/shared/Badge}. This
 * file previously carried its own `VARIANT_CLASSES` palette — one of three
 * hand-rolled copies of the recipe ADR-0030 had already moved into `Badge`.
 * `BadgeVariant` is a superset of `UserStatusVariant`, so `userStatusVariant()`
 * drops straight into `variant` with no mapping layer between them.
 *
 * The row list uses `.rise-in-stagger` (a wrapper class, not a per-row index prop)
 * so results feel like they land one after another rather than appearing as one
 * block — see `hooks/useStaggerReveal` for the scroll-triggered cascade.
 */
import React from 'react';
import { useStaggerReveal } from '../../hooks/useStaggerReveal';
import type { OktaUser } from '../../../shared/types';
import { Badge, Eyebrow, ListRow, userStatusVariant } from '../shared';

/** Props for {@link UserSearchResults}. */
interface UserSearchResultsProps {
  /** Matching users to render; an empty array renders nothing. */
  results: OktaUser[];
  /** Invoked with the chosen user when a result row is clicked. */
  onSelectUser: (user: OktaUser) => void;
}

/**
 * Displays a list of user search results as compact, clickable rows; renders
 * nothing when there are no results.
 */
const UserSearchResults: React.FC<UserSearchResultsProps> = ({ results, onSelectUser }) => {
  const setStaggerRef = useStaggerReveal();

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 animate-rise-in">
      <Eyebrow as="div">
        {results.length} {results.length === 1 ? 'match' : 'matches'}
      </Eyebrow>
      <div ref={setStaggerRef} className="space-y-3 rise-in-stagger">
        {results.map((user) => (
          // `className="group"` only names the hover group — `ListRow` owns the
          // chrome, and the title's hover colour is the one interior effect kept.
          <ListRow
            key={user.id}
            as="button"
            density="compact"
            onClick={() => onSelectUser(user)}
            className="group"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0 text-left">
                <h4 className="truncate text-sm font-semibold text-neutral-900 group-hover:text-primary-text transition-colors duration-(--dur-instant)">
                  {user.profile.firstName} {user.profile.lastName}
                </h4>
                <div className="truncate text-xs text-neutral-600">{user.profile.email}</div>
              </div>
              <Badge variant={userStatusVariant(user.status)} className="shrink-0">
                {user.status}
              </Badge>
            </div>
          </ListRow>
        ))}
      </div>
    </div>
  );
};

export default UserSearchResults;
