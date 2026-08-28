/**
 * @module sidepanel/components/users/UserRungHeader
 * @description What the Users tab's one `PageHeader` says on each rung of its view stack.
 *
 * The tab keeps **one** `PageHeader` mounted and swaps its contents as views are
 * pushed and popped (ADR-0008, ADR-0016) — this is that swap, extracted so the
 * tab shell stays composition. Three rungs, three subjects:
 *
 * | Rung | Title | Identity region |
 * | --- | --- | --- |
 * | search | `User Search` — the stack's own `rootLabel` | none |
 * | detail | the user's display name | `userIdentity(user)` |
 * | compare | `Compare users` | none — the subject is *two* users |
 *
 * The header describes a user **only** on the detail rung, and only once the
 * loaded user is the one that rung is for; otherwise the stack's push-time
 * snapshot name still stands and the status badge would belong to somebody else.
 * The name is re-resolved against the live selection rather than read from the
 * snapshot, because a lifecycle action patches the selected user in place.
 *
 * It never falls back to the entity detected on the live Okta tab: that is
 * `ContextBar`'s subject, and the two must not converge (ADR-0032 §1).
 */
import React from 'react';
import Breadcrumbs from '../shared/Breadcrumbs';
import PageHeader from '../shared/PageHeader';
import { EntityIdentity, OpenInOktaLink, WorkingSetPinButton } from '../shared';
import { userIdentity } from './userIdentity';
import { userDisplayName } from '../../../shared/utils/userDisplay';
import type { OktaUser } from '../../../shared/types';
import { useWorkingSet } from '../../hooks/useWorkingSet';
import type { ViewStack } from '../../hooks/useViewStack';
import type { UsersViewEntry } from '../../hooks/useUsersTabState';

/** Props for {@link UserRungHeader}. */
export interface UserRungHeaderProps {
  /** The tab's sub-navigation stack: search → a user's detail → their comparison. */
  nav: ViewStack<UsersViewEntry>;
  /** Whether a user's detail page is the view on screen. */
  isDetailOpen: boolean;
  /** Whether a comparison is the view on screen. */
  isCompareOpen: boolean;
  /** The user the tab has loaded, or `null`. */
  selectedUser: OktaUser | null;
  /** How many groups that user is in. */
  membershipCount: number;
  /** True while the memberships are loading — the group count is then omitted. */
  isLoadingMemberships: boolean;
  /**
   * How many apps the user has, once the Apps pane has resolved them.
   * `undefined` omits the fact rather than rendering a zero (ADR-0032 §2a).
   */
  appCount?: number;
  /** Okta org origin for the header's "Open in Okta" link; the link hides without one. */
  oktaOrigin: string | null;
  /**
   * Whether the Users tab is the visible one. Passed through to `sticky`: a
   * hidden panel is `display: none`, so its sentinel never intersects and it
   * would otherwise publish a stale `--header-h` (ADR-0032 §3).
   */
  isActive: boolean;
}

/**
 * The Users tab's single page header, filled in for whichever rung is on screen.
 *
 * @param props - See {@link UserRungHeaderProps}.
 */
const UserRungHeader: React.FC<UserRungHeaderProps> = ({
  nav,
  isDetailOpen,
  isCompareOpen,
  selectedUser,
  membershipCount,
  isLoadingMemberships,
  appCount,
  oktaOrigin,
  isActive,
}) => {
  // Re-resolve the pushed entry against the live selection: the entry is a
  // snapshot taken at push time, while `selectedUser` is patched in place (a
  // lifecycle action rewrites its status) and its memberships reload after a
  // group is copied.
  const currentEntry = nav.currentEntry;
  const isLoadedUserThisRung = Boolean(currentEntry && selectedUser?.id === currentEntry.userId);
  const currentName =
    isLoadedUserThisRung && selectedUser ? userDisplayName(selectedUser) : currentEntry?.userName;

  const detailUser =
    isDetailOpen && !isCompareOpen && isLoadedUserThisRung
      ? (selectedUser ?? undefined)
      : undefined;
  // Read only for the pin's own state; the list of pinned entities is Home's.
  const workingSet = useWorkingSet(oktaOrigin);

  const identity = detailUser
    ? userIdentity(detailUser, {
        // Both counts are omitted until their payload lands, so the region shows
        // no count rather than a "0" the panel never asked for (ADR-0032 §2a).
        groupCount: isLoadingMemberships ? undefined : membershipCount,
        // From the full assignment list `useUserApps` walks. A first-page count
        // would silently undercount any user with more than one page of apps.
        appCount,
      })
    : undefined;

  return (
    <PageHeader
      // Root title matches the stack's `rootLabel`, so the header and the
      // breadcrumb trail never disagree about what the root is called.
      title={
        isCompareOpen ? 'Compare users' : isDetailOpen ? (currentName ?? 'User') : 'User Search'
      }
      subtitle={
        isCompareOpen
          ? `${currentName} vs. another user`
          : isDetailOpen
            ? undefined
            : 'Search users and analyze their group memberships'
      }
      onBack={nav.isRoot ? undefined : nav.pop}
      backLabel={isCompareOpen ? 'Back to user' : 'Back to search'}
      breadcrumbs={nav.isRoot ? undefined : <Breadcrumbs items={nav.trail} />}
      sticky={isActive}
      identityKey={identity?.key}
      identity={identity ? <EntityIdentity rows={identity.rows} /> : undefined}
      badge={
        // On the detail rung the badge is reserved for the alarming statuses
        // (`LOCKED_OUT`, `DEPROVISIONED`) — `userIdentity` already decided that
        // and left every calmer status as a `status` fact in the identity rows
        // instead, so most detail views carry no badge at all. Elsewhere the
        // group count stays the badge.
        identity
          ? identity.badge
          : selectedUser
            ? { text: `${membershipCount} Groups`, variant: 'primary' }
            : undefined
      }
      actions={
        identity?.link && (
          <OpenInOktaLink
            oktaOrigin={oktaOrigin}
            entityType={identity.link.entityType}
            entityId={identity.link.entityId}
          />
        )
      }
      cornerAction={
        detailUser && (
          <WorkingSetPinButton
            pinned={workingSet.isPinned('user', detailUser.id)}
            onToggle={() =>
              workingSet.togglePin({
                kind: 'user',
                id: detailUser.id,
                name: userDisplayName(detailUser),
              })
            }
          />
        )
      }
    />
  );
};

export default UserRungHeader;
