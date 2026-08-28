/**
 * @module sidepanel/components/users/DetectedUserBanner
 * @description Presentational "open in admin" banner for the Users tab.
 *
 * Shown when the Okta admin page has a user open that differs from the one
 * explicitly selected in the tab. Loading is MANUAL only (the Load button), so admin
 * navigation never hijacks the tab. All visibility/dismiss logic lives in the parent;
 * this component only renders the detected user and forwards Load / Dismiss intent.
 *
 * ## One line, one clear choice
 *
 * The banner used to offer two equal-weight buttons — a `secondary` Load beside a
 * `ghost` Dismiss — so the choice read as ambiguous: nothing said which one the
 * banner was for. It is now a single row: an {@link sidepanel/components/shared/Eyebrow}
 * naming the source, the user and their status, then one `primary` Load and an
 * `IconButton` to dismiss. The verb wins the row; declining it is a close control.
 *
 * The status no longer has a pill of its own. That pill was a hand-rolled palette
 * (a nested ternary over `ACTIVE` / `DEPROVISIONED` / everything else) — one of the
 * copies of the recipe ADR-0030 moved into shared `Badge`, and the third element on
 * a line that is trying to be one line. The status rides in the `{name} · {STATUS}`
 * line instead.
 */
import React from 'react';
import { Button, Eyebrow, IconButton } from '../shared';
import Icon from '../shared/Icon';
import type { UserInfo } from '../../../shared/types';

/** Props for {@link DetectedUserBanner}. */
interface DetectedUserBannerProps {
  /** The user detected on the current Okta admin page. */
  userInfo: UserInfo;
  /** Disables the Load button while a load/analysis is in flight. */
  isLoading: boolean;
  /** Load the detected user + their memberships into the tab. */
  onLoad: () => void;
  /** Dismiss the banner without loading. */
  onDismiss: () => void;
}

/**
 * The Users tab's detected-user banner: one line naming the user open in the admin
 * console, with a single Load verb and a dismiss control. Purely presentational.
 */
const DetectedUserBanner: React.FC<DetectedUserBannerProps> = ({
  userInfo,
  isLoading,
  onLoad,
  onDismiss,
}) => {
  return (
    <div className="px-(--sp-row-x) py-(--sp-row-y) bg-primary-light border border-primary-highlight rounded-md flex items-center gap-(--sp-inline)">
      <Eyebrow className="shrink-0">Open in admin</Eyebrow>
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
        <strong className="font-semibold text-neutral-900">{userInfo.userName}</strong>
        {userInfo.userStatus ? ` · ${userInfo.userStatus}` : ''}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="primary" size="sm" onClick={onLoad} disabled={isLoading}>
          Load
        </Button>
        <IconButton label="Dismiss" size="sm" onClick={onDismiss}>
          <Icon type="close" size="sm" />
        </IconButton>
      </div>
    </div>
  );
};

export default DetectedUserBanner;
