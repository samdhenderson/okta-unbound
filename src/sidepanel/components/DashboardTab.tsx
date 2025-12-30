import React, { useState, useEffect, useCallback } from 'react';
import { useGroupHealth } from '../hooks/useGroupHealth';
import { useOktaApi } from '../hooks/useOktaApi';
import { useProgress } from '../contexts/ProgressContext';
import QuickStatsCard from './dashboard/QuickStatsCard';
import StatusPieChart from './dashboard/StatusPieChart';
import MembershipBarChart from './dashboard/MembershipBarChart';
import RiskGauge from './dashboard/RiskGauge';
import QuickActionsCard from './dashboard/QuickActionsCard';
import AuditStatsCard from './dashboard/AuditStatsCard';
import SecurityWidget from './dashboard/SecurityWidget';
import AuditLogEntryComponent from './AuditLogEntry';
import { auditStore } from '../../shared/storage/auditStore';
import type { AuditLogEntry, UserStatus } from '../../shared/types';

interface DashboardTabProps {
  groupId: string | undefined;
  groupName: string | undefined;
  targetTabId: number | null;
  onTabChange: (tab: 'operations' | 'rules' | 'users' | 'security' | 'undo' | 'dashboard') => void;
  oktaOrigin?: string | null;
}

const DashboardTab: React.FC<DashboardTabProps> = ({
  groupId,
  groupName,
  targetTabId,
  onTabChange,
  oktaOrigin,
}) => {
  const { metrics, isLoading, error, refresh } = useGroupHealth({ groupId, targetTabId });
  const { startProgress, completeProgress, updateProgress } = useProgress();
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLogEntry[]>([]);
  const [resultMessages, setResultMessages] = useState<Array<{ message: string; type: 'info' | 'success' | 'warning' | 'error' }>>([]);

  // API integration for quick actions
  const handleResult = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error') => {
    setResultMessages(prev => [...prev.slice(-9), { message, type }]);
  }, []);

  const handleProgress = useCallback((current: number, total: number, message: string, apiCalls?: number) => {
    updateProgress(current, total, message, apiCalls);
  }, [updateProgress]);

  const { smartCleanup, removeDeprovisioned, customFilterMultiple, exportMembers, isLoading: isApiLoading } = useOktaApi({
    targetTabId,
    onResult: handleResult,
    onProgress: handleProgress,
  });

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportFilter, setExportFilter] = useState<UserStatus | ''>('');

  // Load recent audit logs
  useEffect(() => {
    const loadRecentLogs = async () => {
      try {
        const logs = await auditStore.getHistory({}, 5); // Get last 5 logs
        setRecentAuditLogs(logs);
      } catch (error) {
        console.error('[DashboardTab] Failed to load recent audit logs:', error);
      }
    };

    loadRecentLogs();
  }, []);

  if (!groupId || !targetTabId) {
    return (
      <div className="tab-content active">
        <div className="dashboard-empty-state">
          <div className="empty-state">
            <h3>Not Connected</h3>
            <p>Please navigate to an Okta group page to view the dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !metrics) {
    return (
      <div className="tab-content active">
        <div className="dashboard-loading">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading dashboard metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-content active">
        <div className="dashboard-error">
          <div className="alert alert-error" style={{ margin: '20px' }}>
            <strong>Error loading dashboard:</strong> {error}
            <button className="btn btn-secondary" onClick={refresh} style={{ marginTop: '12px' }}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  // Check if there are inactive users
  const hasInactiveUsers =
    metrics.statusBreakdown.DEPROVISIONED > 0 ||
    metrics.statusBreakdown.SUSPENDED > 0 ||
    metrics.statusBreakdown.LOCKED_OUT > 0;

  const handleCleanupInactive = () => {
    onTabChange('operations');
  };

  const handleExportMembers = () => {
    setExportModalOpen(true);
  };

  const handleExportConfirm = async () => {
    if (!groupId || !groupName) return;

    setExportModalOpen(false);
    startProgress('Export', `Exporting members to ${exportFormat.toUpperCase()}...`);
    setResultMessages([]);

    try {
      await exportMembers(groupId, groupName, exportFormat, exportFilter);
    } finally {
      completeProgress();
    }
  };

  const handleViewRules = () => {
    onTabChange('rules');
  };

  const handleSmartCleanup = async () => {
    if (!groupId) return;

    startProgress('Smart Cleanup', 'Removing inactive users...');
    setResultMessages([]);

    try {
      await smartCleanup(groupId);
      // Refresh dashboard after cleanup
      refresh();
    } finally {
      completeProgress();
    }
  };

  const handleRemoveDeprovisioned = async () => {
    if (!groupId) return;

    startProgress('Remove Deprovisioned', 'Removing deprovisioned users...');
    setResultMessages([]);

    try {
      await removeDeprovisioned(groupId);
      refresh();
    } finally {
      completeProgress();
    }
  };

  const handleCustomCleanup = async (statuses: string[]) => {
    if (!groupId) return;

    startProgress('Custom Cleanup', `Removing users with status: ${statuses.join(', ')}...`);
    setResultMessages([]);

    try {
      await customFilterMultiple(groupId, statuses as any[], 'remove');
      refresh();
    } finally {
      completeProgress();
    }
  };

  return (
    <div className="tab-content active">
      <div className="dashboard-container">
        {/* Header Section */}
        <div className="dashboard-header">
          <div>
            <h2 className="dashboard-title">Dashboard</h2>
            <p className="dashboard-subtitle">At-a-glance insights for {groupName}</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={isLoading}>
            {isLoading ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="stats-grid dashboard-stats-grid">
          <QuickStatsCard title="Total Users" value={metrics.totalUsers} color="primary" />
          <QuickStatsCard
            title="Active Users"
            value={metrics.statusBreakdown.ACTIVE}
            color="success"
          />
          <QuickStatsCard
            title="Inactive Users"
            value={
              metrics.statusBreakdown.DEPROVISIONED +
              metrics.statusBreakdown.SUSPENDED +
              metrics.statusBreakdown.LOCKED_OUT
            }
            color={hasInactiveUsers ? 'warning' : 'success'}
          />
          <QuickStatsCard
            title="Direct Members"
            value={metrics.membershipSources.direct}
            color="primary"
          />
        </div>

        {/* Main Content Grid */}
        <div className="dashboard-grid">
          {/* Left Column */}
          <div className="dashboard-col">
            {/* Health Score Card */}
            <div className="dashboard-card">
              <RiskGauge riskScore={metrics.riskScore} riskFactors={metrics.riskFactors} />
            </div>

            {/* Quick Actions Card */}
            <div className="dashboard-card">
              <QuickActionsCard
                onCleanupInactive={handleCleanupInactive}
                onExportMembers={handleExportMembers}
                onViewRules={handleViewRules}
                hasInactiveUsers={hasInactiveUsers}
                groupId={groupId}
                groupName={groupName}
                onRemoveDeprovisioned={handleRemoveDeprovisioned}
                onSmartCleanup={handleSmartCleanup}
                onCustomCleanup={handleCustomCleanup}
                isLoading={isApiLoading}
              />
            </div>

            {/* Result Messages */}
            {resultMessages.length > 0 && (
              <div className="dashboard-card result-messages">
                <h4 style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Operation Log</h4>
                <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px' }}>
                  {resultMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`result-message result-${msg.type}`}
                      style={{
                        padding: '4px 8px',
                        marginBottom: '2px',
                        borderRadius: '3px',
                        background: msg.type === 'success' ? 'var(--success-bg)' :
                                   msg.type === 'error' ? 'var(--error-bg)' :
                                   msg.type === 'warning' ? 'var(--warning-bg)' : 'var(--info-bg)',
                        color: msg.type === 'success' ? 'var(--success-text)' :
                               msg.type === 'error' ? 'var(--error-text)' :
                               msg.type === 'warning' ? 'var(--warning-text)' : 'var(--info-text)',
                      }}
                    >
                      {msg.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="dashboard-col">
            {/* Status Distribution Chart */}
            <div className="dashboard-card">
              <h3 className="dashboard-card-title">User Status Distribution</h3>
              <StatusPieChart statusBreakdown={metrics.statusBreakdown} />
            </div>

            {/* Membership Sources Chart */}
            <div className="dashboard-card">
              <h3 className="dashboard-card-title">Membership Sources</h3>
              <MembershipBarChart membershipSources={metrics.membershipSources} />
            </div>

            {/* Audit Trail Stats */}
            <div className="dashboard-card">
              <AuditStatsCard />
            </div>

            {/* Security Widget */}
            {groupId && (
              <SecurityWidget groupId={groupId} onViewSecurity={() => onTabChange('security')} />
            )}
          </div>
        </div>

        {/* Recent Audit Log Section */}
        {recentAuditLogs.length > 0 && (
          <div className="dashboard-card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="dashboard-card-title">Recent Activity</h3>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => onTabChange('undo')}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                View All
              </button>
            </div>
            <div>
              {recentAuditLogs.map((log) => (
                <AuditLogEntryComponent key={log.id} entry={log} oktaOrigin={oktaOrigin} />
              ))}
            </div>
          </div>
        )}

        {/* Export Modal */}
        {exportModalOpen && (
          <div className="modal-overlay" onClick={() => setExportModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Export Group Members</h3>
                <button className="modal-close" onClick={() => setExportModalOpen(false)}>&times;</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Format</label>
                  <select
                    className="input"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Filter by Status (optional)</label>
                  <select
                    className="input"
                    value={exportFilter}
                    onChange={(e) => setExportFilter(e.target.value as UserStatus | '')}
                  >
                    <option value="">All Users</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="DEPROVISIONED">Deprovisioned Only</option>
                    <option value="SUSPENDED">Suspended Only</option>
                    <option value="LOCKED_OUT">Locked Out Only</option>
                  </select>
                </div>
                <p className="info-text">
                  This will export members from <strong>{groupName}</strong> to a {exportFormat.toUpperCase()} file.
                </p>
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setExportModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleExportConfirm}>
                  Export
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardTab;
