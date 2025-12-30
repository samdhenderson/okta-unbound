import React from 'react';
import { useOktaPageContext } from '../hooks/useOktaPageContext';
import PageHeader from './shared/PageHeader';
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
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Detecting page context...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (connectionStatus === 'error' || error) {
    return (
      <div className="tab-content active">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-lg bg-red-50 border border-red-200 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-red-900">Connection Error</h3>
                <p className="text-red-700 mt-2 leading-relaxed">
                  {error || 'Please open an Okta admin page in this window'}
                </p>
                <button
                  onClick={refetch}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-sm">
            <h4 className="text-base font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Quick Start</span>
            </h4>
            <ol className="text-sm text-blue-800 space-y-2 ml-6 list-decimal leading-relaxed">
              <li>Open an Okta admin page (e.g., okta.com or okta-emea.com)</li>
              <li>Navigate to a group, user, or app page</li>
              <li>The Overview tab will automatically detect the context</li>
            </ol>
          </div>
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
          <button
            onClick={refetch}
            disabled={isLoading}
            className="flex-shrink-0 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow"
            title="Refresh context and data"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
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
          <div className="py-12">
            <div className="text-center">
              <span className="text-6xl mb-4 block">🔍</span>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Waiting for Context
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Navigate to a group, user, or app page in Okta to see contextual insights and quick actions.
              </p>
              <div className="mt-6 flex gap-3 justify-center">
                <button
                  onClick={() => onTabChange('groups')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Browse Groups
                </button>
                <button
                  onClick={() => onTabChange('users')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Search Users
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewTab;
