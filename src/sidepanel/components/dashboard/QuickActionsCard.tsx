import React from 'react';

interface QuickActionsCardProps {
  onCleanupInactive: () => void;
  onExportMembers: () => void;
  onViewRules: () => void;
  hasInactiveUsers: boolean;
  hasRuleConflicts: boolean;
}

const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  onCleanupInactive,
  onExportMembers,
  onViewRules,
  hasInactiveUsers,
  hasRuleConflicts,
}) => {
  return (
    <div className="quick-actions-card">
      <h3 className="quick-actions-title">Quick Actions</h3>
      <div className="quick-actions-buttons">
        <button
          className={`btn ${hasInactiveUsers ? 'btn-warning' : 'btn-secondary'}`}
          onClick={onCleanupInactive}
        >
          🧹 Clean Up Inactive Users
        </button>
        <button className="btn btn-primary" onClick={onExportMembers}>
          📥 Export All Members
        </button>
        <button
          className={`btn ${hasRuleConflicts ? 'btn-warning' : 'btn-secondary'}`}
          onClick={onViewRules}
        >
          ⚙️ View Rules
        </button>
      </div>
    </div>
  );
};

export default QuickActionsCard;
