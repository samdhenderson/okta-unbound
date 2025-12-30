import React from 'react';
import StatCard from './shared/StatCard';
import QuickActionsPanel, { type ActionSection } from './shared/QuickActionsPanel';
import Button from '../shared/Button';

interface AppOverviewProps {
  appId: string;
  appName: string;
  appLabel?: string;
  targetTabId: number;
  onTabChange: (tab: 'apps') => void;
}

const AppOverview: React.FC<AppOverviewProps> = ({
  appId,
  appName,
  appLabel,
  onTabChange,
}) => {
  // Placeholder data - would be fetched from API in real implementation
  const stats = {
    totalAssignments: 0,
    userAssignments: 0,
    groupAssignments: 0,
    orphanedAssignments: 0,
  };

  const actionSections: ActionSection[] = [
    {
      title: 'Assignment Operations',
      icon: 'link',
      expanded: true,
      actions: [
        {
          label: 'Assign Groups',
          icon: 'users',
          variant: 'primary',
          onClick: () => onTabChange('apps'),
          tooltip: 'Assign groups to this application',
        },
        {
          label: 'Assign Users',
          icon: 'user',
          variant: 'secondary',
          onClick: () => alert('Assign users - coming soon'),
          tooltip: 'Assign individual users to this application',
        },
        {
          label: 'Remove Orphaned',
          icon: 'trash',
          variant: 'danger',
          onClick: () => alert('Remove orphaned - coming soon'),
          disabled: stats.orphanedAssignments === 0,
          badge: stats.orphanedAssignments > 0 ? `${stats.orphanedAssignments}` : undefined,
          tooltip: 'Remove assignments for deactivated users',
        },
      ],
    },
    {
      title: 'Configuration',
      icon: 'settings',
      expanded: false,
      actions: [
        {
          label: 'View Settings',
          icon: 'settings',
          variant: 'ghost',
          onClick: () => alert('View settings - coming soon'),
          tooltip: 'Open app configuration in Okta',
        },
        {
          label: 'Test SSO',
          icon: 'lock',
          variant: 'secondary',
          onClick: () => alert('Test SSO - coming soon'),
          tooltip: 'Test single sign-on configuration',
        },
        {
          label: 'Export Assignments',
          icon: 'download',
          variant: 'secondary',
          onClick: () => alert('Export assignments - coming soon'),
          tooltip: 'Export all app assignments to CSV',
        },
      ],
    },
    {
      title: 'Analysis',
      icon: 'search',
      expanded: false,
      actions: [
        {
          label: 'Security Scan',
          icon: 'shield',
          variant: 'ghost',
          onClick: () => onTabChange('apps'),
          tooltip: 'Run security analysis on app assignments',
        },
        {
          label: 'Find Redundant',
          icon: 'refresh',
          variant: 'ghost',
          onClick: () => alert('Find redundant - coming soon'),
          tooltip: 'Find users assigned both directly and via group',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Assignments"
          value={stats.totalAssignments}
          color="primary"
          icon="link"
        />
        <StatCard
          title="User Assignments"
          value={stats.userAssignments}
          color="neutral"
          icon="user"
        />
        <StatCard
          title="Group Assignments"
          value={stats.groupAssignments}
          color="neutral"
          icon="users"
        />
        <StatCard
          title="Orphaned"
          value={stats.orphanedAssignments}
          color={stats.orphanedAssignments > 0 ? 'warning' : 'success'}
          icon="alert"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* App Info Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Application Info</h3>

            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-semibold text-gray-900">{appName}</h4>
                {appLabel && appLabel !== appName && (
                  <p className="text-gray-600">{appLabel}</p>
                )}
                <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ACTIVE
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">App ID</span>
                <span className="font-mono text-xs text-gray-900">{appId}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Sign-On Mode</span>
                <span className="font-medium text-gray-900">SAML 2.0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Provisioning</span>
                <span className="font-medium text-gray-900">Enabled</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <QuickActionsPanel sections={actionSections} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Assignment Type Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Distribution</h3>
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="text-5xl font-bold text-green-600">{stats.totalAssignments}</div>
                <div className="text-gray-600 mt-2">Total Assignments</div>
                <div className="mt-4 flex gap-4 justify-center text-sm">
                  <div>
                    <span className="font-semibold text-gray-900">{stats.userAssignments}</span>
                    <span className="text-gray-600"> Users</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">{stats.groupAssignments}</span>
                    <span className="text-gray-600"> Groups</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* App Insights */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights</h3>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-blue-900">App Context Detection</p>
                    <p className="text-blue-700 mt-1">
                      This is a preview of app-specific features. Full functionality coming soon.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  Navigate to the Apps tab for full app management capabilities including bulk assignments,
                  security scanning, and user-to-group conversion.
                </div>
                <Button variant="ghost" size="sm" onClick={() => onTabChange('apps')} className="mt-2">
                  Go to Apps Tab →
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppOverview;
