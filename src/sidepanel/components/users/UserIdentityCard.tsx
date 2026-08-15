/**
 * @module sidepanel/components/users/UserIdentityCard
 * @description Compact identity header for a single Okta user.
 *
 * Avatar, name, status badge, title/department, email, an optional copyable user id, and
 * an optional "Open in Okta" link.
 *
 * The Overview tab is its only remaining consumer. Everywhere the panel has a `PageHeader`
 * the header now describes the entity (ADR-0032), and the Users tab's detail rung dropped
 * this card entirely — along with the `showName` prop that existed only to stop it
 * repeating the title above it. Overview has no header to move into yet, so the card
 * survives there, and with it the last of the four badge palettes: `VARIANT_CLASSES` below
 * still recolours the shared `userStatusVariant()` decision through raw Tailwind hues
 * rather than tokens. It goes when Overview gains a header.
 */
import React from 'react';
import type { OktaUser } from '../../../shared/types';
import { CopyableId, OpenInOktaLink, userStatusVariant, type UserStatusVariant } from '../shared';

/** Props for {@link UserIdentityCard}. */
interface UserIdentityCardProps {
  /** The user whose identity to render. */
  user: OktaUser;
  /** Okta origin used to build the "Open in Okta" admin link; the link hides when absent. */
  oktaOrigin?: string | null;
  /** Whether to render the "Open in Okta" deep link. Defaults to `true`. */
  showOktaLink?: boolean;
  /**
   * Whether to show the copyable user id row. Defaults to `true`. The Overview
   * passes `false` because the masthead already shows the context entity's id.
   */
  showId?: boolean;
}

/** Per-variant badge palette (this component's rich palette, keyed by shared variant). */
const VARIANT_CLASSES: Record<UserStatusVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  info: 'bg-blue-50 text-blue-700 border border-blue-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-700 border border-red-200',
  neutral: 'bg-neutral-100 text-neutral-700 border border-neutral-300',
};

/** Maps an Okta user status to its status-badge Tailwind classes via the shared variant map. */
const getStatusBadgeClass = (status: string): string => {
  const base = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold';
  return `${base} ${VARIANT_CLASSES[userStatusVariant(status)]}`;
};

/**
 * Renders the compact user identity header (avatar, name, status, contact line,
 * optional id + Okta link). Presentational; copy-to-clipboard is self-contained.
 */
const UserIdentityCard: React.FC<UserIdentityCardProps> = ({
  user,
  oktaOrigin,
  showOktaLink = true,
  showId = true,
}) => {
  const initials =
    `${user.profile.firstName?.[0] ?? '?'}${user.profile.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="bg-white rounded-md border border-neutral-200 p-4">
      <div className="flex items-start gap-3.5">
        {/* Avatar */}
        <div className="shrink-0 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-base font-bold shadow-sm ring-4 ring-primary-highlight">
          {initials}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-neutral-900 truncate">
              {user.profile.firstName} {user.profile.lastName}
            </h2>
            <span className={getStatusBadgeClass(user.status)}>{user.status}</span>
          </div>

          {(user.profile.title || user.profile.department) && (
            <div className="text-xs text-neutral-600 mt-0.5 flex items-center gap-1.5 truncate">
              {user.profile.title && <span>{user.profile.title}</span>}
              {user.profile.title && user.profile.department && (
                <span className="text-neutral-400">·</span>
              )}
              {user.profile.department && <span>{user.profile.department}</span>}
            </div>
          )}

          <div className="text-xs text-neutral-700 mt-0.5 truncate">{user.profile.email}</div>

          {showId && <CopyableId value={user.id} label="Copy user id" className="mt-1" />}

          {user.profile.genderPronouns && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-[11px] font-medium rounded-md border border-purple-200 mt-1.5">
              {user.profile.genderPronouns}
            </div>
          )}
        </div>

        {showOktaLink && (
          <div className="shrink-0">
            <OpenInOktaLink oktaOrigin={oktaOrigin} entityType="user" entityId={user.id} />
          </div>
        )}
      </div>
    </div>
  );
};

export default UserIdentityCard;
