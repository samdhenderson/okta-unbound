/**
 * @module sidepanel/components/overview/members/MemberRow
 * @description Single member card: name, email, login, status badge, and MFA factor tags.
 *
 * Memoized (large lists). When an org origin is provided the whole row becomes a
 * deep link to the member's Okta Admin Console profile. Factor tags (or a "No MFA"
 * badge) render only once a scan has completed.
 *
 * The card is {@link sidepanel/components/shared/ListRow} at `compact` density
 * (ADR-0029) — the row used to carry its own hand-written chrome string. The
 * interior follows the typography contract in `docs/design-system.md`, which
 * retired three arbitrary sizes here (`text-[11px]` on the login, `text-[10px]`
 * on the factor tags and the status badge).
 */
import React from 'react';
import type { OktaUser, MemberMfaResult } from '../../../../shared/types';
import { ListRow, userStatusVariant, type UserStatusVariant } from '../../shared';
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

  const adminUrl = oktaAdminEntityUrl(oktaOrigin, 'user', user.id);

  return (
    // `as` follows the deep link: an anchor when there is somewhere to go, a plain
    // container when there is not. `ListRow` sets `rel="noopener noreferrer"` for
    // the `_blank` target itself, so the call site cannot forget it.
    <ListRow
      as={adminUrl ? 'a' : 'div'}
      href={adminUrl ?? undefined}
      target={adminUrl ? '_blank' : undefined}
      density="compact"
      title={adminUrl ? 'Open user in Okta Admin Console' : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-900">{fullName}</div>
          <div className="truncate text-xs text-neutral-600">{user.profile.email}</div>
          <div className="truncate font-mono text-xs text-neutral-500">{user.profile.login}</div>
          {mfaScanned && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {mfa && mfa.factorLabels.length > 0 ? (
                mfa.factorLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-md bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-text"
                  >
                    {label}
                  </span>
                ))
              ) : (
                <span className="rounded-md bg-danger-light px-2 py-0.5 text-xs font-medium text-danger-text">
                  No MFA
                </span>
              )}
            </div>
          )}
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
          {user.status}
        </span>
      </div>
    </ListRow>
  );
};

export default React.memo(MemberRow);
