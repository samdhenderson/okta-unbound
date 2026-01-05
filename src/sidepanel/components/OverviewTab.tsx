import React from 'react';
import { useOktaPageContext } from '../hooks/useOktaPageContext';
import PageHeader from './shared/PageHeader';
import AlertMessage from './shared/AlertMessage';
import Button from './shared/Button';
import EmptyState from './shared/EmptyState';
import LoadingSpinner from './shared/LoadingSpinner';
import GroupOverview from './overview/GroupOverview';
import UserOverview from './overview/UserOverview';
import AppOverview from './overview/AppOverview';
import AdminOverview from './overview/AdminOverview';

interface OverviewTabProps {
  onTabChange: (tab: 'rules' | 'users' | 'security' | 'groups' | 'apps' | 'history', selectedRuleId?: string) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ onTabChange }) => {
  const {
    pageType,
    groupInfo,
    userInfo,
    appInfo,
    connectionStatus,
    targetTabId,
    error,
    isLoading,
    refetch,
  } = useOktaPageContext();

  // Show loading state
  if (isLoading) {
    return (
      <div className="tab-content active">
        <LoadingSpinner size="lg" message="Detecting page context..." centered />
      </div>
    );
  }

  // Show error state
  if (connectionStatus === 'error' || error) {
    return (
      <div className="tab-content active">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <AlertMessage
            message={{
              text: error || 'Please open an Okta admin page in this window',
              type: 'error'
            }}
            action={{ label: 'Retry Connection', onClick: refetch }}
          />

          {/* Help Text */}
          <AlertMessage
            message={{
              text: 'Quick Start: 1) Open an Okta admin page (e.g., okta.com) 2) Navigate to a group, user, or app page 3) The Overview tab will automatically detect the context',
              type: 'info'
            }}
          />
        </div>
      </div>
    );
  }

  // Map page type to badge configuration
  const getBadgeConfig = (): { text: string; variant: 'primary' | 'success' | 'warning' | 'error' | 'neutral' } | undefined => {
    const badgeMap = {
      group: { text: 'Group', variant: 'primary' as const },
      user: { text: 'User', variant: 'primary' as const },
      app: { text: 'Application', variant: 'success' as const },
      admin: { text: 'Organization', variant: 'neutral' as const },
    };

    return pageType !== 'unknown' ? badgeMap[pageType] : undefined;
  };

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Overview"
        subtitle="Context-aware insights and quick actions"
        icon="chart"
        badge={getBadgeConfig()}
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={refetch}
            disabled={isLoading}
            loading={isLoading}
            title="Refresh context and data"
          >
            Refresh
          </Button>
        }
      />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Context-Specific Content */}
        {pageType === 'group' && groupInfo && targetTabId && (
          <GroupOverview
            groupId={groupInfo.groupId}
            groupName={groupInfo.groupName}
            targetTabId={targetTabId}
            onTabChange={(tab, selectedRuleId) => onTabChange(tab, selectedRuleId)}
          />
        )}

        {pageType === 'user' && userInfo && targetTabId && (
          <UserOverview
            userId={userInfo.userId}
            userName={userInfo.userName}
            targetTabId={targetTabId}
            onTabChange={onTabChange}
          />
        )}

        {pageType === 'app' && appInfo && targetTabId && (
          <AppOverview
            appId={appInfo.appId}
            appName={appInfo.appName}
            appLabel={appInfo.appLabel}
            targetTabId={targetTabId}
            onTabChange={onTabChange}
          />
        )}

        {pageType === 'admin' && (
          <AdminOverview
            targetTabId={targetTabId}
            onTabChange={onTabChange}
          />
        )}

        {pageType === 'unknown' && (
          <EmptyState
            icon="search"
            title="Waiting for Context"
            description="Navigate to a group, user, or app page in Okta to see contextual insights and quick actions."
            actions={[
              { label: 'Browse Groups', onClick: () => onTabChange('groups'), variant: 'primary' },
              { label: 'Search Users', onClick: () => onTabChange('users'), variant: 'secondary' }
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default OverviewTab;
