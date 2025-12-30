import React, { useState, useCallback } from 'react';
import { useGroupHealth } from '../../hooks/useGroupHealth';
import { useOktaApi } from '../../hooks/useOktaApi';
import { useProgress } from '../../contexts/ProgressContext';
import StatCard from './shared/StatCard';
import QuickActionsPanel, { type ActionSection } from './shared/QuickActionsPanel';
import RiskGauge from '../dashboard/RiskGauge';
import GroupDistributionPieChart from '../dashboard/GroupDistributionPieChart';
import type { UserStatus } from '../../../shared/types';
import { getUserFriendlyStatus } from '../../../shared/utils/statusNormalizer';

interface GroupOverviewProps {
  groupId: string;
  groupName: string;
  targetTabId: number;
  onTabChange: (tab: 'rules' | 'security' | 'users', selectedRuleId?: string) => void;
}

const GroupOverview: React.FC<GroupOverviewProps> = ({
  groupId,
  groupName,
  targetTabId,
  onTabChange,
}) => {
  const { metrics, members, isLoading, error, refresh } = useGroupHealth({ groupId, targetTabId });
  const { startProgress, completeProgress, updateProgress } = useProgress();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportFilter, setExportFilter] = useState<UserStatus | ''>('');
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<UserStatus[]>([]);

  const handleResult = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error') => {
    console.log(`[GroupOverview] ${type}:`, message);
  }, []);

  const handleProgress = useCallback((current: number, total: number, message: string, apiCalls?: number) => {
    updateProgress(current, total, message, apiCalls);
  }, [updateProgress]);

  const { removeDeprovisioned, customFilterMultiple, exportMembers, isLoading: isApiLoading } = useOktaApi({
    targetTabId,
    onResult: handleResult,
    onProgress: handleProgress,
  });


  const handleRemoveDeprovisioned = async () => {
    startProgress('Remove Deprovisioned', 'Removing deprovisioned users...');
    try {
      await removeDeprovisioned(groupId);
      refresh();
    } finally {
      completeProgress();
    }
  };

  const handleCustomCleanup = async () => {
    if (selectedStatuses.length === 0) return;

    startProgress('Custom Cleanup', `Removing users with status: ${selectedStatuses.join(', ')}...`);
    try {
      await customFilterMultiple(groupId, selectedStatuses, 'remove');
      refresh();
      setCustomFilterOpen(false);
      setSelectedStatuses([]);
    } finally {
      completeProgress();
    }
  };

  const handleExportConfirm = async () => {
    setExportModalOpen(false);
    startProgress('Export', `Exporting members to ${exportFormat.toUpperCase()}...`);
    try {
      await exportMembers(groupId, groupName, exportFormat, exportFilter);
    } finally {
      completeProgress();
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading group metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <div className="flex items-start">
          <span className="text-2xl mr-3">⚠️</span>
          <div>
            <h3 className="font-semibold text-red-900">Error loading dashboard</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <button
              onClick={refresh}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const actionSections: ActionSection[] = [
    {
      title: 'Member Operations',
      icon: 'users',
      expanded: true,
      actions: [
        {
          label: 'Remove Deprovisioned',
          icon: 'trash',
          variant: 'primary',
          onClick: handleRemoveDeprovisioned,
          disabled: (metrics.statusBreakdown?.DEPROVISIONED ?? 0) === 0 || isApiLoading,
          badge: (metrics.statusBreakdown?.DEPROVISIONED ?? 0) > 0 ? `${metrics.statusBreakdown.DEPROVISIONED}` : undefined,
          tooltip: 'Remove only deprovisioned users',
        },
        {
          label: 'Custom Filter...',
          icon: 'settings',
          variant: 'secondary',
          onClick: () => setCustomFilterOpen(true),
          disabled: isApiLoading,
          tooltip: 'Choose specific user statuses to remove',
        },
      ],
    },
    {
      title: 'Export & Reports',
      icon: 'chart',
      expanded: false,
      actions: [
        {
          label: 'Export Members',
          icon: 'download',
          variant: 'secondary',
          onClick: () => setExportModalOpen(true),
          disabled: isApiLoading,
          tooltip: 'Export member list to CSV or JSON',
        },
        {
          label: 'Security Report',
          icon: 'lock',
          variant: 'secondary',
          onClick: () => onTabChange('security'),
          tooltip: 'View detailed security analysis',
        },
      ],
    },
    {
      title: 'Navigation',
      icon: 'search',
      expanded: false,
      actions: [
        {
          label: 'View Rules',
          icon: 'list',
          variant: 'ghost',
          onClick: () => onTabChange('rules'),
          tooltip: 'View group rules affecting this group',
        },
        {
          label: 'View Members',
          icon: 'user',
          variant: 'ghost',
          onClick: () => onTabChange('users'),
          tooltip: 'Search and manage individual members',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Members"
          value={metrics.totalUsers ?? 0}
          color="primary"
          icon="users"
        />
        <StatCard
          title="Active Members"
          value={metrics.statusBreakdown?.ACTIVE ?? 0}
          color="success"
          icon="check"
        />
        <StatCard
          title="Inactive Members"
          value={
            (metrics.statusBreakdown?.DEPROVISIONED ?? 0) +
            (metrics.statusBreakdown?.SUSPENDED ?? 0) +
            (metrics.statusBreakdown?.LOCKED_OUT ?? 0)
          }
          color={((metrics.statusBreakdown?.DEPROVISIONED ?? 0) + (metrics.statusBreakdown?.SUSPENDED ?? 0) + (metrics.statusBreakdown?.LOCKED_OUT ?? 0)) > 0 ? 'warning' : 'success'}
          icon="alert"
        />
        <StatCard
          title="Rule-Based"
          value={metrics.membershipSources?.ruleBased ?? 0}
          color="neutral"
          icon="bolt"
          subtitle={`${metrics.membershipSources?.direct ?? 0} manual (*approx)`}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Health Score */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Score</h3>
            <RiskGauge riskScore={metrics.riskScore} riskFactors={metrics.riskFactors} />
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <QuickActionsPanel sections={actionSections} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Group Distribution */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm focus:outline-none active:border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Distribution</h3>
            {metrics.statusBreakdown ? (
              <GroupDistributionPieChart
                statusBreakdown={metrics.statusBreakdown}
                members={members}
                onRuleClick={(ruleId) => onTabChange('rules', ruleId)}
              />
            ) : (
              <div className="text-center text-gray-500 py-8">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setExportModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Export Group Members</h3>
              <button onClick={() => setExportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status (optional)</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={exportFilter}
                  onChange={(e) => setExportFilter(e.target.value as UserStatus | '')}
                >
                  <option value="">All Users</option>
                  <option value="ACTIVE">{getUserFriendlyStatus('ACTIVE')} Only</option>
                  <option value="DEPROVISIONED">{getUserFriendlyStatus('DEPROVISIONED')} Only</option>
                  <option value="SUSPENDED">{getUserFriendlyStatus('SUSPENDED')} Only</option>
                  <option value="LOCKED_OUT">{getUserFriendlyStatus('LOCKED_OUT')} Only</option>
                </select>
              </div>
              <p className="text-sm text-gray-600">
                This will export members from <strong>{groupName}</strong> to a {exportFormat.toUpperCase()} file.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExportConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Filter Modal */}
      {customFilterOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setCustomFilterOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Custom Status Filter</h3>
              <button onClick={() => setCustomFilterOpen(false)} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-4">Select user statuses to remove from this group:</p>
              <div className="space-y-2">
                {(['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT', 'STAGED', 'PROVISIONED', 'RECOVERY', 'PASSWORD_EXPIRED'] as UserStatus[]).map(status => (
                  <label key={status} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStatuses([...selectedStatuses, status]);
                        } else {
                          setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm">{getUserFriendlyStatus(status)}</span>
                    <span className="ml-auto text-xs text-gray-500">
                      ({metrics.statusBreakdown[status] || 0})
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setCustomFilterOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomCleanup}
                disabled={selectedStatuses.length === 0}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove Selected ({selectedStatuses.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupOverview;
