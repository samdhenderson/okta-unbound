/**
 * @module sidepanel/components/OverviewTab
 * @description Context-aware landing tab that adapts to the detected Okta page.
 *
 * Purely presentational now: the page context (live or pinned) is resolved by
 * {@link App} and passed in as props, so the Overview shows the same entity the
 * {@link ContextBar} names. Renders {@link GroupOverview} or {@link UserOverview}
 * for a group/user page, a retry/quick-start error state when disconnected, or a
 * guidance {@link EmptyState} otherwise.
 */
import React from 'react';
import type { GroupInfo, UserInfo } from '../../shared/types';
import type { PageType } from '../hooks/useOktaPageContext';
import type { ConnectionStatus } from '../hooks/useOktaTabContext';
import AlertMessage from './shared/AlertMessage';
import EmptyState from './shared/EmptyState';
import LoadingSpinner from './shared/LoadingSpinner';
import GroupOverview from './overview/GroupOverview';
import UserOverview from './overview/UserOverview';

interface OverviewTabProps {
  /** Navigates to another tab, optionally deep-linking to a specific rule id. */
  onTabChange: (tab: 'rules' | 'users' | 'groups' | 'history', selectedRuleId?: string) => void;
  /** Detected (or pinned) page type. */
  pageType: PageType;
  /** Group identity when `pageType === 'group'`. */
  groupInfo: GroupInfo | null;
  /** User identity when `pageType === 'user'`. */
  userInfo: UserInfo | null;
  /** Connection state to the Okta tab. */
  connectionStatus: ConnectionStatus;
  /** Tab hosting the Okta session; every API call is routed to it. */
  targetTabId: number | null;
  /** Context error message, or `null` when healthy. */
  error: string | null;
  /** Whether context is still resolving. */
  isLoading: boolean;
  /** Okta org origin for Admin Console deep links. */
  oktaOrigin: string | null;
  /** Re-detect the live context (used by the disconnected retry action). */
  onRetry: () => void;
  /** Open the current user in the Users tab with all groups loaded. */
  onViewAllGroups: () => void;
}

/**
 * Renders the Overview tab, switching between group/user overviews, an
 * error/retry state, and a waiting-for-context empty state based on the supplied
 * page type.
 */
const OverviewTab: React.FC<OverviewTabProps> = ({
  onTabChange,
  pageType,
  groupInfo,
  userInfo,
  connectionStatus,
  targetTabId,
  error,
  isLoading,
  oktaOrigin,
  onRetry,
  onViewAllGroups,
}) => {
  if (isLoading) {
    return (
      <div className="tab-content active">
        <LoadingSpinner size="lg" message="Detecting page context..." centered />
      </div>
    );
  }

  if (connectionStatus === 'error' || error) {
    return (
      <div className="tab-content active">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          <AlertMessage
            message={{
              text: error || 'Please open an Okta admin page in this window',
              type: 'danger',
            }}
            action={{ label: 'Retry Connection', onClick: onRetry }}
          />
          <AlertMessage
            message={{
              text: 'Quick Start: 1) Open an Okta admin page (e.g., okta.com) 2) Navigate to a group, user, or app page 3) The Overview tab will automatically detect the context',
              type: 'info',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <div className="w-full max-w-7xl mx-auto px-6 py-6">
        {pageType === 'group' && groupInfo && targetTabId && (
          <GroupOverview
            groupId={groupInfo.groupId}
            groupName={groupInfo.groupName}
            targetTabId={targetTabId}
            onTabChange={(tab, selectedRuleId) => onTabChange(tab, selectedRuleId)}
            oktaOrigin={oktaOrigin}
          />
        )}

        {pageType === 'user' && userInfo && targetTabId && (
          <UserOverview
            userId={userInfo.userId}
            userName={userInfo.userName}
            targetTabId={targetTabId}
            onViewAllGroups={onViewAllGroups}
            oktaOrigin={oktaOrigin}
          />
        )}

        {(pageType === 'unknown' || pageType === 'admin' || pageType === 'app') && (
          <EmptyState
            icon="search"
            title="Waiting for Context"
            description="Navigate to a group or user page in Okta to see contextual insights and quick actions."
            actions={[
              { label: 'Browse Groups', onClick: () => onTabChange('groups'), variant: 'primary' },
              { label: 'Search Users', onClick: () => onTabChange('users'), variant: 'secondary' },
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default OverviewTab;
