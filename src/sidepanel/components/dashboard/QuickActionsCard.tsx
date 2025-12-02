import React, { useState } from 'react';
import ConfirmationModal from '../ConfirmationModal';

interface QuickActionsCardProps {
  onCleanupInactive: () => void;
  onExportMembers: () => void;
  onViewRules: () => void;
  hasInactiveUsers: boolean;
  hasRuleConflicts: boolean;
  groupId?: string;
  groupName?: string;
  onRemoveDeprovisioned?: () => void;
  onSmartCleanup?: () => void;
  isLoading?: boolean;
}

const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  onCleanupInactive,
  onExportMembers,
  onViewRules,
  hasInactiveUsers,
  hasRuleConflicts,
  groupId,
  groupName,
  onRemoveDeprovisioned,
  onSmartCleanup,
  isLoading = false,
}) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    apiCost: string;
    onConfirm: () => void;
  } | null>(null);

  const handleCleanupClick = () => {
    if (onSmartCleanup && groupId) {
      // Show confirmation modal for smart cleanup
      setModalState({
        isOpen: true,
        title: 'Clean Up Inactive Users',
        message: `This will remove all inactive users (deprovisioned, suspended, locked out) from ${groupName || 'this group'}. This action cannot be undone.`,
        apiCost: 'Fetch members: 1-5 requests\nRemove users: 1 per user\nTotal: Varies based on group size',
        onConfirm: () => {
          setModalState(null);
          onSmartCleanup();
        },
      });
    } else {
      // Fall back to navigation to operations tab
      onCleanupInactive();
    }
  };

  const handleExportClick = () => {
    // For export, navigate to operations tab since it needs format selection
    onExportMembers();
  };

  return (
    <div className="quick-actions-card">
      <h3 className="quick-actions-title">Quick Actions</h3>
      <div className="quick-actions-buttons">
        <button
          className={`btn ${hasInactiveUsers ? 'btn-warning' : 'btn-secondary'}`}
          onClick={handleCleanupClick}
          disabled={isLoading || !groupId}
        >
          {hasInactiveUsers ? '⚠️' : '🧹'} Clean Up Inactive Users
        </button>
        <button
          className="btn btn-primary"
          onClick={handleExportClick}
          disabled={isLoading || !groupId}
        >
          📥 Export Members
        </button>
        <button
          className={`btn ${hasRuleConflicts ? 'btn-warning' : 'btn-secondary'}`}
          onClick={onViewRules}
          disabled={isLoading}
        >
          ⚙️ View Rules
        </button>
      </div>

      {/* Confirmation Modal */}
      {modalState && (
        <ConfirmationModal
          isOpen={modalState.isOpen}
          title={modalState.title}
          message={modalState.message}
          apiCost={modalState.apiCost}
          onConfirm={modalState.onConfirm}
          onCancel={() => setModalState(null)}
        />
      )}
    </div>
  );
};

export default QuickActionsCard;
