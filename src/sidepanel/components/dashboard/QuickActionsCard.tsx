import React, { useState } from 'react';
import ConfirmationModal from '../ConfirmationModal';

type CleanupType = 'deprovisioned' | 'pending_action' | 'all_inactive';

interface QuickActionsCardProps {
  onCleanupInactive: () => void;
  onExportMembers: () => void;
  onViewRules: () => void;
  hasInactiveUsers: boolean;
  groupId?: string;
  groupName?: string;
  onRemoveDeprovisioned?: () => Promise<void>;
  onSmartCleanup?: () => Promise<void>;
  onCustomCleanup?: (statuses: string[]) => Promise<void>;
  isLoading?: boolean;
}

const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  onCleanupInactive,
  onExportMembers,
  onViewRules,
  hasInactiveUsers,
  groupId,
  groupName,
  onRemoveDeprovisioned,
  onSmartCleanup,
  onCustomCleanup,
  isLoading = false,
}) => {
  const [showCleanupOptions, setShowCleanupOptions] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    apiCost: string;
    confirmLabel: string;
    confirmVariant: 'primary' | 'warning' | 'danger';
    onConfirm: () => void;
  } | null>(null);

  const cleanupOptions: { type: CleanupType; label: string; description: string; statuses: string[] }[] = [
    {
      type: 'deprovisioned',
      label: 'Deprovisioned Only',
      description: 'Remove users who have been deprovisioned',
      statuses: ['DEPROVISIONED'],
    },
    {
      type: 'pending_action',
      label: 'Pending Action',
      description: 'Remove users requiring action (suspended, locked out, password expired)',
      statuses: ['SUSPENDED', 'LOCKED_OUT', 'PASSWORD_EXPIRED'],
    },
    {
      type: 'all_inactive',
      label: 'All Inactive',
      description: 'Remove all non-active users (deprovisioned, suspended, locked out)',
      statuses: ['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT'],
    },
  ];

  const handleCleanupSelect = (option: typeof cleanupOptions[0]) => {
    setShowCleanupOptions(false);

    const statusLabel = option.statuses.join(', ');
    setModalState({
      isOpen: true,
      title: `Remove ${option.label}`,
      message: `This will remove all users with status: ${statusLabel} from "${groupName || 'this group'}". This action can be undone from the Undo tab.`,
      apiCost: 'Fetch members: 1-5 requests\nRemove users: 1 per user\nTotal: Varies based on matches',
      confirmLabel: 'Remove Users',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setModalState(null);
        if (option.type === 'deprovisioned' && onRemoveDeprovisioned) {
          await onRemoveDeprovisioned();
        } else if (option.type === 'all_inactive' && onSmartCleanup) {
          await onSmartCleanup();
        } else if (onCustomCleanup) {
          await onCustomCleanup(option.statuses);
        } else {
          // Fallback to operations tab
          onCleanupInactive();
        }
      },
    });
  };

  const handleExportClick = () => {
    onExportMembers();
  };

  return (
    <div className="quick-actions-card">
      <h3 className="quick-actions-title">Quick Actions</h3>
      <div className="quick-actions-buttons">
        <div className="cleanup-dropdown-container">
          <button
            className={`btn ${hasInactiveUsers ? 'btn-warning' : 'btn-secondary'} cleanup-trigger`}
            onClick={() => setShowCleanupOptions(!showCleanupOptions)}
            disabled={isLoading || !groupId}
          >
            {hasInactiveUsers ? '⚠️' : '🧹'} Clean Up Users ▾
          </button>
          {showCleanupOptions && (
            <div className="cleanup-dropdown">
              {cleanupOptions.map((option) => (
                <button
                  key={option.type}
                  className="cleanup-option"
                  onClick={() => handleCleanupSelect(option)}
                >
                  <span className="cleanup-option-label">{option.label}</span>
                  <span className="cleanup-option-desc">{option.description}</span>
                </button>
              ))}
              <div className="cleanup-dropdown-footer">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setShowCleanupOptions(false);
                    onCleanupInactive();
                  }}
                >
                  More Options →
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={handleExportClick}
          disabled={isLoading || !groupId}
        >
          📥 Export Members
        </button>
        <button
          className="btn btn-secondary"
          onClick={onViewRules}
          disabled={isLoading}
        >
          ⚙️ View Rules
        </button>
      </div>

      {/* Click outside handler */}
      {showCleanupOptions && (
        <div
          className="cleanup-dropdown-backdrop"
          onClick={() => setShowCleanupOptions(false)}
        />
      )}

      {/* Confirmation Modal */}
      {modalState && (
        <ConfirmationModal
          isOpen={modalState.isOpen}
          title={modalState.title}
          message={modalState.message}
          apiCost={modalState.apiCost}
          confirmLabel={modalState.confirmLabel}
          confirmVariant={modalState.confirmVariant}
          onConfirm={modalState.onConfirm}
          onCancel={() => setModalState(null)}
        />
      )}
    </div>
  );
};

export default QuickActionsCard;
