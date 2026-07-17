/**
 * @module sidepanel/components/users/DetectedUserBanner
 * @description Presentational "detected in admin" banner for the Users tab.
 *
 * Shown when the Okta admin page has a user open that differs from the one
 * explicitly selected in the tab. Loading is MANUAL only (the Load button), so admin
 * navigation never hijacks the tab. All visibility/dismiss logic lives in the parent;
 * this component only renders the detected user and forwards Load / Dismiss intent.
 */
import React from 'react';
import { Button } from '../shared';
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
 * The Users tab's detected-user banner: shows the page's user with a status badge
 * and manual Load / Dismiss actions. Purely presentational.
 */
const DetectedUserBanner: React.FC<DetectedUserBannerProps> = ({
  userInfo,
  isLoading,
  onLoad,
  onDismiss,
}) => {
  return (
    <div className="px-4 py-2.5 bg-primary-light border border-primary-highlight rounded-md flex items-center gap-2">
      <span className="text-sm text-neutral-700">
        Detected in admin: <strong className="text-neutral-900">{userInfo.userName}</strong>
      </span>
      {userInfo.userStatus && (
        <span
          className={`px-2.5 py-0.5 text-xs font-bold rounded-md ${
            userInfo.userStatus === 'ACTIVE'
              ? 'bg-success-light text-success-text'
              : userInfo.userStatus === 'DEPROVISIONED'
                ? 'bg-danger-light text-danger-text'
                : 'bg-warning-light text-warning-text'
          }`}
        >
          {userInfo.userStatus}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onLoad} disabled={isLoading}>
          Load
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
};

export default DetectedUserBanner;
