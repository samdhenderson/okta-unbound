import React from 'react';
import StatCard from './shared/StatCard';
import QuickActionsPanel, { type ActionSection } from './shared/QuickActionsPanel';
import { useOrgStats } from '../../hooks/useOrgStats';

interface AdminOverviewProps {
  targetTabId: number | null;
  onTabChange: (tab: 'groups' | 'users' | 'apps' | 'rules' | 'security' | 'history') => void;
}

const AdminOverview: React.FC<AdminOverviewProps> = ({ onTabChange }) => {
  const { stats: orgStats } = useOrgStats();

  // Format cache age for display
  const formatCacheAge = (ageMs: number | null): string => {
    if (ageMs === null) return '';
    const hours = Math.floor(ageMs / (60 * 60 * 1000));
    const minutes = Math.floor((ageMs % (60 * 60 * 1000)) / (60 * 1000));
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    }
    return `${minutes}m ago`;
  };

  const actionSections: ActionSection[] = [
    {
      title: 'Browse',
      icon: 'search',
      expanded: true,
      actions: [
        {
          label: 'All Groups',
          icon: 'users',
          variant: 'primary',
          onClick: () => onTabChange('groups'),
          tooltip: 'Browse and filter all groups',
        },
        {
          label: 'All Users',
          icon: 'user',
          variant: 'secondary',
          onClick: () => onTabChange('users'),
          tooltip: 'Search users and trace memberships',
        },
        {
          label: 'All Apps',
          icon: 'app',
          variant: 'secondary',
          onClick: () => onTabChange('apps'),
          tooltip: 'Manage application assignments',
        },
      ],
    },
    {
      title: 'Management',
      icon: 'settings',
      expanded: true,
      actions: [
        {
          label: 'Group Rules',
          icon: 'list',
          variant: 'ghost',
          onClick: () => onTabChange('rules'),
          badge: orgStats.activeRules && orgStats.activeRules > 0 ? `${orgStats.activeRules}` : undefined,
          tooltip: 'View and manage group assignment rules',
        },
        {
          label: 'Security Center',
          icon: 'lock',
          variant: 'ghost',
          onClick: () => onTabChange('security'),
          tooltip: 'Run security scans and view findings',
        },
        {
          label: 'Audit History',
          icon: 'refresh',
          variant: 'ghost',
          onClick: () => onTabChange('history'),
          tooltip: 'View operation history and undo actions',
        },
      ],
    },
    {
      title: 'Tools',
      icon: 'sparkles',
      expanded: false,
      actions: [
        {
          label: 'Bulk Operations',
          icon: 'bolt',
          variant: 'secondary',
          onClick: () => onTabChange('groups'),
          tooltip: 'Perform bulk operations across multiple groups',
        },
        {
          label: 'Export Org Data',
          icon: 'download',
          variant: 'secondary',
          onClick: () => alert('Export org data - coming soon'),
          tooltip: 'Export organization-wide data and reports',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner - Premium Design with Okta Brand Colors */}
      <div className="relative overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Gradient Background Layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#007dc1]/5 via-[#3d9dd9]/5 to-transparent"></div>

        {/* Decorative Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#007dc1] via-[#3d9dd9] to-[#007dc1]"></div>

        {/* Content */}
        <div className="relative px-8 py-10">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold mb-3">
              <span className="bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] bg-clip-text text-transparent">
                Welcome to Okta Unbound
              </span>
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Advanced group and user management for Okta administrators.
              Navigate to a specific group, user, or app page to see contextual insights and actions.
            </p>
          </div>
        </div>

        {/* Decorative Corner Elements */}
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-gradient-to-tl from-[#007dc1]/5 to-transparent rounded-tl-full"></div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Groups"
          value={orgStats.totalGroups !== null ? orgStats.totalGroups : '—'}
          subtitle={orgStats.cacheStatus.groupsCached ? formatCacheAge(orgStats.cacheStatus.groupsCacheAge) : 'Load in Groups tab'}
          color="success"
          icon="users"
          onClick={() => onTabChange('groups')}
        />
        <StatCard
          title="Applications"
          value={orgStats.totalApps !== null ? orgStats.totalApps : '—'}
          subtitle={orgStats.cacheStatus.appsCached ? formatCacheAge(orgStats.cacheStatus.appsCacheAge) : 'Load in Apps tab'}
          color="neutral"
          icon="app"
          onClick={() => onTabChange('apps')}
        />
        <StatCard
          title="Active Rules"
          value={orgStats.activeRules !== null ? orgStats.activeRules : '—'}
          subtitle={orgStats.cacheStatus.rulesCached ? 'Cached' : 'Load in Rules tab'}
          color="warning"
          icon="bolt"
          onClick={() => onTabChange('rules')}
        />
        <StatCard
          title="Operations (7d)"
          value={orgStats.recentOperations !== null ? orgStats.recentOperations : '0'}
          subtitle="This week"
          color="primary"
          icon="refresh"
          onClick={() => onTabChange('history')}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Getting Started */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-[#007dc1] to-[#3d9dd9] rounded-full"></div>
              Getting Started
            </h3>
            <div className="space-y-3">
              <div className="group p-4 bg-gradient-to-br from-blue-50/50 to-blue-50/30 rounded-lg border border-blue-100/50 hover:border-[#007dc1]/30 transition-all duration-200 hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#007dc1] to-[#3d9dd9] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    1
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm mb-1">Navigate to an Entity</p>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Visit a group, user, or app page in Okta to see contextual metrics and actions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group p-4 bg-gradient-to-br from-emerald-50/50 to-emerald-50/30 rounded-lg border border-emerald-100/50 hover:border-emerald-400/30 transition-all duration-200 hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    2
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm mb-1">Use Quick Actions</p>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      This Overview tab adapts to show relevant operations for the current context.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group p-4 bg-gradient-to-br from-amber-50/50 to-amber-50/30 rounded-lg border border-amber-100/50 hover:border-amber-400/30 transition-all duration-200 hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    3
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm mb-1">Explore Tabs</p>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Use specialized tabs for advanced features like security scanning and bulk operations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-[#007dc1] to-[#3d9dd9] rounded-full"></div>
              Quick Navigation
            </h3>
            <QuickActionsPanel sections={actionSections} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Features Overview */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-[#007dc1] to-[#3d9dd9] rounded-full"></div>
              Key Features
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50/80 transition-colors duration-150 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center group-hover:from-[#007dc1]/10 group-hover:to-[#3d9dd9]/10 transition-colors duration-200">
                  <svg className="w-5 h-5 text-[#007dc1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1">Context-Aware Dashboard</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Automatically adapts to show relevant metrics for groups, users, and apps.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50/80 transition-colors duration-150 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center group-hover:from-red-100 group-hover:to-red-100/50 transition-colors duration-200">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1">Security Scanning</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Detect orphaned accounts, stale memberships, and security risks.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50/80 transition-colors duration-150 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center group-hover:from-amber-100 group-hover:to-amber-100/50 transition-colors duration-200">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1">Bulk Operations</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Perform operations across multiple groups and users efficiently.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50/80 transition-colors duration-150 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center group-hover:from-emerald-100 group-hover:to-emerald-100/50 transition-colors duration-200">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1">Membership Tracing</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Understand how users got into groups (direct vs rule-based).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50/80 transition-colors duration-150 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center group-hover:from-purple-100 group-hover:to-purple-100/50 transition-colors duration-200">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1">Audit Trail & Undo</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Track all operations with full audit logging and undo support.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Help & Resources */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-[#007dc1] to-[#3d9dd9] rounded-full"></div>
              Help & Resources
            </h3>
            <div className="space-y-1 text-sm">
              <a href="#" className="group flex items-center gap-2 p-3 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent rounded-lg text-gray-700 hover:text-[#007dc1] transition-all duration-200">
                <svg className="w-4 h-4 text-gray-400 group-hover:text-[#007dc1] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">Documentation & Guides</span>
              </a>
              <a href="#" className="group flex items-center gap-2 p-3 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent rounded-lg text-gray-700 hover:text-[#007dc1] transition-all duration-200">
                <svg className="w-4 h-4 text-gray-400 group-hover:text-[#007dc1] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span className="font-medium">Keyboard Shortcuts</span>
              </a>
              <a href="#" className="group flex items-center gap-2 p-3 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent rounded-lg text-gray-700 hover:text-[#007dc1] transition-all duration-200">
                <svg className="w-4 h-4 text-gray-400 group-hover:text-[#007dc1] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">Report an Issue</span>
              </a>
              <a href="#" className="group flex items-center gap-2 p-3 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent rounded-lg text-gray-700 hover:text-[#007dc1] transition-all duration-200">
                <svg className="w-4 h-4 text-gray-400 group-hover:text-[#007dc1] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="font-medium">Release Notes</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
