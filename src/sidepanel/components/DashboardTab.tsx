import React from 'react';
import { useGroupHealth } from '../hooks/useGroupHealth';
import QuickStatsCard from './dashboard/QuickStatsCard';
import StatusPieChart from './dashboard/StatusPieChart';
import MembershipBarChart from './dashboard/MembershipBarChart';
import RiskGauge from './dashboard/RiskGauge';
import QuickActionsCard from './dashboard/QuickActionsCard';

interface DashboardTabProps {
  groupId: string | undefined;
  groupName: string | undefined;
  targetTabId: number | null;
  onTabChange: (tab: 'operations' | 'rules' | 'users' | 'undo' | 'dashboard') => void;
}

const DashboardTab: React.FC<DashboardTabProps> = ({
  groupId,
  groupName,
  targetTabId,
  onTabChange,
}) => {
  const { metrics, isLoading, error, refresh } = useGroupHealth({ groupId, targetTabId });

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

  // For now, assume no rule conflicts (would need to fetch rules data)
  const hasRuleConflicts = false;

  const handleCleanupInactive = () => {
    onTabChange('operations');
  };

  const handleExportMembers = () => {
    onTabChange('operations');
  };

  const handleViewRules = () => {
    onTabChange('rules');
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
                hasRuleConflicts={hasRuleConflicts}
              />
            </div>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
