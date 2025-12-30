import React, { memo } from 'react';
import type { SecurityFinding } from '../../../shared/types';

interface SecurityFindingsCardProps {
  finding: SecurityFinding;
  onViewDetails?: () => void;
}

/**
 * Memoized card component for displaying security findings.
 * Uses React.memo to prevent unnecessary re-renders in lists.
 */
const SecurityFindingsCard: React.FC<SecurityFindingsCardProps> = memo(({ finding, onViewDetails }) => {
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

  const getSeverityConfig = (severity: SecurityFinding['severity']) => {
    const configs = {
      critical: {
        color: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        dotColor: 'bg-red-500',
        ringColor: 'ring-red-500/20',
      },
      high: {
        color: 'text-orange-700',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        dotColor: 'bg-orange-500',
        ringColor: 'ring-orange-500/20',
      },
      medium: {
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        dotColor: 'bg-amber-500',
        ringColor: 'ring-amber-500/20',
      },
      low: {
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        dotColor: 'bg-emerald-500',
        ringColor: 'ring-emerald-500/20',
      },
    };
    return configs[severity] || configs.low;
  };

  const config = getSeverityConfig(finding.severity);

  return (
    <div className={`bg-white rounded-lg border ${config.borderColor} shadow-sm transition-all duration-300 overflow-hidden hover:shadow-md`}>
      <div className={`p-4 ${config.bgColor} border-b ${config.borderColor} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${config.dotColor} ring-4 ${config.ringColor}`} />
          <span className={`text-sm font-bold uppercase tracking-wide ${config.color}`}>
            {finding.severity}
          </span>
        </div>
        <div className="px-3 py-1.5 bg-white rounded-full text-sm font-bold text-gray-900 shadow-sm">
          {finding.count}
        </div>
      </div>
      <div className="p-5">
        <h4 className="text-base font-semibold text-gray-900 mb-2">{getCategoryLabel(finding.category)}</h4>
        <p className="text-sm text-gray-600 leading-relaxed">{finding.description}</p>
      </div>
      {onViewDetails && (
        <div className="px-5 pb-4">
          <button
            className="w-full px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow inline-flex items-center justify-center gap-2"
            onClick={onViewDetails}
          >
            View Details
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memoization
  return (
    prevProps.finding.category === nextProps.finding.category &&
    prevProps.finding.severity === nextProps.finding.severity &&
    prevProps.finding.count === nextProps.finding.count &&
    prevProps.finding.description === nextProps.finding.description
  );
});

SecurityFindingsCard.displayName = 'SecurityFindingsCard';

export default SecurityFindingsCard;
