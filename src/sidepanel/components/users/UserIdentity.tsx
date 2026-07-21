/**
 * @module sidepanel/components/users/UserIdentity
 * @description Compact identity header for a single Okta user.
 *
 * The slim replacement for the former tall "user ID card": avatar, name, status
 * badge, title/department, email, an optional copyable user id, and an optional
 * "Open in Okta" link. Shared by {@link UserProfileCard} (Users tab) and
 * {@link UserOverview} so both render user identity consistently.
 */
import React, { useState } from 'react';
import type { OktaUser } from '../../../shared/types';
import { IconButton, OpenInOktaLink } from '../shared';
import Icon from '../overview/shared/Icon';

/** Props for {@link UserIdentity}. */
interface UserIdentityProps {
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

/** Maps an Okta user status to its status-badge Tailwind classes (color-coded per status). */
const getStatusBadgeClass = (status: string): string => {
  const base = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold';
  switch (status) {
    case 'ACTIVE':
      return `${base} bg-emerald-50 text-emerald-700 border border-emerald-200`;
    case 'PROVISIONED':
      return `${base} bg-blue-50 text-blue-700 border border-blue-200`;
    case 'STAGED':
      return `${base} bg-neutral-100 text-neutral-700 border border-neutral-300`;
    case 'SUSPENDED':
      return `${base} bg-amber-50 text-amber-700 border border-amber-200`;
    case 'RECOVERY':
      return `${base} bg-purple-50 text-purple-700 border border-purple-200`;
    case 'PASSWORD_EXPIRED':
      return `${base} bg-orange-50 text-orange-700 border border-orange-200`;
    case 'LOCKED_OUT':
      return `${base} bg-rose-50 text-rose-700 border border-rose-200`;
    case 'DEPROVISIONED':
      return `${base} bg-red-50 text-red-700 border border-red-200`;
    default:
      return `${base} bg-neutral-100 text-neutral-700 border border-neutral-300`;
  }
};

/**
 * Renders the compact user identity header (avatar, name, status, contact line,
 * optional id + Okta link). Presentational; copy-to-clipboard is self-contained.
 */
const UserIdentity: React.FC<UserIdentityProps> = ({
  user,
  oktaOrigin,
  showOktaLink = true,
  showId = true,
}) => {
  const [idCopied, setIdCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id).then(
      () => {
        setIdCopied(true);
        setTimeout(() => setIdCopied(false), 1500);
      },
      () => {
        /* clipboard blocked — fail quietly */
      },
    );
  };

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

          {showId && (
            <div className="flex items-center gap-1 mt-1">
              <code className="text-[11px] font-mono text-neutral-500 truncate">{user.id}</code>
              <IconButton
                label={idCopied ? 'Copied!' : 'Copy user id'}
                onClick={handleCopyId}
                variant="ghost"
                size="sm"
                className="shrink-0"
              >
                <Icon
                  type={idCopied ? 'clipboard-check' : 'clipboard'}
                  size="sm"
                  className={`w-3.5 h-3.5 ${idCopied ? 'text-success-text' : ''}`}
                />
              </IconButton>
            </div>
          )}

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

export default UserIdentity;
