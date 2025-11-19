import React from 'react';
import type { SecurityFinding } from '../../../shared/types';

interface SecurityFindingsCardProps {
  finding: SecurityFinding;
  onViewDetails?: () => void;
}

const SecurityFindingsCard: React.FC<SecurityFindingsCardProps> = ({ finding, onViewDetails }) => {
  const getSeverityColor = (severity: SecurityFinding['severity']): string => {
    switch (severity) {
      case 'critical':
        return '#dc3545';
      case 'high':
        return '#fd7e14';
      case 'medium':
        return '#ffc107';
      case 'low':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const getSeverityIcon = (severity: SecurityFinding['severity']): string => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚡';
      case 'low':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  const getCategoryLabel = (category: SecurityFinding['category']): string => {
    switch (category) {
      case 'orphaned_accounts':
        return 'Orphaned Accounts';
      case 'stale_memberships':
        return 'Stale Memberships';
      case 'rule_conflicts':
        return 'Rule Conflicts';
      case 'permission_anomalies':
        return 'Permission Anomalies';
      default:
        return category;
    }
  };

  return (
    <div className="security-finding-card">
      <div className="finding-header">
        <div className="finding-severity" style={{ color: getSeverityColor(finding.severity) }}>
          <span className="severity-icon">{getSeverityIcon(finding.severity)}</span>
          <span className="severity-label">{finding.severity.toUpperCase()}</span>
        </div>
        <div className="finding-count">{finding.count}</div>
      </div>
      <div className="finding-body">
        <h4 className="finding-category">{getCategoryLabel(finding.category)}</h4>
        <p className="finding-description">{finding.description}</p>
      </div>
      {onViewDetails && (
        <div className="finding-footer">
          <button className="btn btn-sm btn-secondary" onClick={onViewDetails}>
            View Details
          </button>
        </div>
      )}
    </div>
  );
};

export default SecurityFindingsCard;
