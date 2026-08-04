/**
 * @module sidepanel/components/overview/members/MemberRow
 * @description Single member card: name, email, login, status badge, and MFA factor tags.
 *
 * Memoized (large lists). When an org origin is provided the whole row becomes a
 * deep link to the member's Okta Admin Console profile. Factor tags (or a "No MFA"
 * badge) render only once a scan has completed.
 */
import React from 'react';
import type { OktaUser, MemberMfaResult } from '../../../../shared/types';
import { userStatusVariant, type UserStatusVariant } from '../../shared';
import { oktaAdminEntityUrl } from '../../../../shared/utils/oktaUrl';

/** Props for {@link MemberRow}. */
interface MemberRowProps {
  /** The member to render. */
  user: OktaUser;
  /** This member's MFA scan result, if available. */
  mfa?: MemberMfaResult;
  /** True once an MFA scan has completed, so we can show "No MFA" for 0-factor users. */
  mfaScanned?: boolean;
  /** Okta org origin; when set, the row links to the member's Admin Console profile. */
  oktaOrigin?: string | null;
}

/** Per-variant badge color classes (token palette, keyed by the shared variant map). */
const VARIANT_CLASSES: Record<UserStatusVariant, string> = {
  success: 'bg-success-light text-success-text',
  info: 'bg-primary-light text-primary-text',
  warning: 'bg-warning-light text-warning-text',
  danger: 'bg-danger-light text-danger-text',
  neutral: 'bg-neutral-100 text-neutral-700',
};

/** Renders one member card, optionally wrapped as an Admin Console deep link. */
const MemberRow: React.FC<MemberRowProps> = ({ user, mfa, mfaScanned, oktaOrigin }) => {
  const badgeClass = VARIANT_CLASSES[userStatusVariant(user.status)];
  const fullName =
    `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() || user.profile.login;

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-neutral-900 truncate">{fullName}</div>
        <div className="text-xs text-neutral-600 truncate">{user.profile.email}</div>
        <div className="text-[11px] text-neutral-500 font-mono truncate">{user.profile.login}</div>
        {mfaScanned && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {mfa && mfa.factorLabels.length > 0 ? (
              mfa.factorLabels.map((label) => (
                <span
                  key={label}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-light text-primary-text"
                >
                  {label}
                </span>
              ))
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-light text-danger-text">
                No MFA
              </span>
            )}
          </div>
        )}
      </div>
      <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}>
        {user.status}
      </span>
    </div>
  );

  const baseClass =
    'block bg-white rounded-md border border-neutral-200 p-3 transition-colors duration-(--dur-instant) hover:border-neutral-500';

  const adminUrl = oktaAdminEntityUrl(oktaOrigin, 'user', user.id);
  if (adminUrl) {
    return (
      <a
        href={adminUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClass}
        title="Open user in Okta Admin Console"
      >
        {content}
      </a>
    );
  }

  return <div className={baseClass}>{content}</div>;
};

export default React.memo(MemberRow);
