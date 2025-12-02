// Undo Panel Component
// Displays undo history and allows users to undo recent actions

import React, { useState } from 'react';
import type { UndoAction } from '../../shared/types';
import type { BulkRemoveUsersMetadata, BulkAddUsersMetadata } from '../../shared/undoTypes';
import { formatActionTime } from '../../shared/undoManager';
import { useUndoManager, BulkUndoProgress } from '../hooks/useUndoManager';

interface UndoPanelProps {
  targetTabId?: number;
  onUndoComplete?: () => void;
}

const UndoPanel: React.FC<UndoPanelProps> = ({ targetTabId, onUndoComplete }) => {
  const { undoableActions, isLoading, error, performUndo, clearHistory } = useUndoManager();
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [undoingActionId, setUndoingActionId] = useState<string | null>(null);
  const [localProgress, setLocalProgress] = useState<BulkUndoProgress | null>(null);

  const handleUndo = async (action: UndoAction) => {
    if (!targetTabId) {
      alert('No Okta tab connected');
      return;
    }

    // Custom confirmation for bulk operations
    const isBulkAction = action.type === 'BULK_REMOVE_USERS_FROM_GROUP' || action.type === 'BULK_ADD_USERS_TO_GROUP';
    let confirmMessage = `Are you sure you want to undo: ${action.description}?`;

    if (isBulkAction) {
      const metadata = action.metadata as BulkRemoveUsersMetadata | BulkAddUsersMetadata;
      const userCount = metadata.users.length;
      confirmMessage = action.type === 'BULK_REMOVE_USERS_FROM_GROUP'
        ? `This will restore ${userCount} user${userCount !== 1 ? 's' : ''} to ${metadata.groupName}.\n\nAre you sure you want to proceed?`
        : `This will remove ${userCount} user${userCount !== 1 ? 's' : ''} from ${metadata.groupName}.\n\nAre you sure you want to proceed?`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    setUndoingActionId(action.id);
    setLocalProgress(null);

    try {
      const result = await performUndo(action, targetTabId, (progress) => {
        setLocalProgress(progress);
      });

      if (result.success) {
        alert(`Successfully undone: ${action.description}`);
        onUndoComplete?.();
      } else {
        alert(`Undo completed with issues: ${result.error}`);
        onUndoComplete?.();
      }
    } finally {
      setUndoingActionId(null);
      setLocalProgress(null);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear the entire undo history? This cannot be undone.')) {
      return;
    }

    await clearHistory();
  };

  const getActionIcon = (type: UndoAction['type']): string => {
    switch (type) {
      case 'REMOVE_USER_FROM_GROUP':
        return '👤➖';
      case 'ADD_USER_TO_GROUP':
        return '👤➕';
      case 'BULK_REMOVE_USERS_FROM_GROUP':
        return '👥➖';
      case 'BULK_ADD_USERS_TO_GROUP':
        return '👥➕';
      case 'ACTIVATE_RULE':
        return '✅';
      case 'DEACTIVATE_RULE':
        return '⏸️';
      default:
        return '⚙️';
    }
  };

  const getActionTypeLabel = (action: UndoAction): string => {
    switch (action.type) {
      case 'REMOVE_USER_FROM_GROUP':
        return 'User Removal';
      case 'ADD_USER_TO_GROUP':
        return 'User Addition';
      case 'BULK_REMOVE_USERS_FROM_GROUP': {
        const metadata = action.metadata as BulkRemoveUsersMetadata;
        return `Bulk Removal (${metadata.users.length})`;
      }
      case 'BULK_ADD_USERS_TO_GROUP': {
        const metadata = action.metadata as BulkAddUsersMetadata;
        return `Bulk Addition (${metadata.users.length})`;
      }
      case 'ACTIVATE_RULE':
        return 'Rule Activation';
      case 'DEACTIVATE_RULE':
        return 'Rule Deactivation';
      default:
        return 'Unknown';
    }
  };

  const renderActionDetails = (action: UndoAction) => {
    const metadata = action.metadata;

    switch (metadata.type) {
      case 'REMOVE_USER_FROM_GROUP':
        return (
          <div className="action-details">
            <div className="detail-row">
              <span className="detail-label">User:</span>
              <span className="detail-value">{metadata.userName} ({metadata.userEmail})</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Group:</span>
              <span className="detail-value">{metadata.groupName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">User ID:</span>
              <span className="detail-value metadata-id">{metadata.userId}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Group ID:</span>
              <span className="detail-value metadata-id">{metadata.groupId}</span>
            </div>
          </div>
        );

      case 'ADD_USER_TO_GROUP':
        return (
          <div className="action-details">
            <div className="detail-row">
              <span className="detail-label">User:</span>
              <span className="detail-value">{metadata.userName} ({metadata.userEmail})</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Group:</span>
              <span className="detail-value">{metadata.groupName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">User ID:</span>
              <span className="detail-value metadata-id">{metadata.userId}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Group ID:</span>
              <span className="detail-value metadata-id">{metadata.groupId}</span>
            </div>
          </div>
        );

      case 'BULK_REMOVE_USERS_FROM_GROUP':
      case 'BULK_ADD_USERS_TO_GROUP':
        return (
          <div className="action-details">
            <div className="detail-row">
              <span className="detail-label">Group:</span>
              <span className="detail-value">{metadata.groupName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Users affected:</span>
              <span className="detail-value">{metadata.users.length}</span>
            </div>
            {metadata.type === 'BULK_REMOVE_USERS_FROM_GROUP' && metadata.operationType && (
              <div className="detail-row">
                <span className="detail-label">Operation:</span>
                <span className="detail-value">
                  {metadata.operationType === 'deprovisioned' ? 'Remove Deprovisioned' :
                   metadata.operationType === 'inactive' ? 'Smart Cleanup (Inactive)' :
                   `Custom Status (${metadata.targetStatus})`}
                </span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Group ID:</span>
              <span className="detail-value metadata-id">{metadata.groupId}</span>
            </div>
            <details className="bulk-users-details">
              <summary className="bulk-users-summary">
                View all {metadata.users.length} users
              </summary>
              <div className="bulk-users-list">
                {metadata.users.map((user, index) => (
                  <div key={user.userId} className="bulk-user-item">
                    <span className="bulk-user-number">{index + 1}.</span>
                    <span className="bulk-user-name">{user.userName}</span>
                    <span className="bulk-user-email muted-small">{user.userEmail}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        );

      case 'ACTIVATE_RULE':
      case 'DEACTIVATE_RULE':
        return (
          <div className="action-details">
            <div className="detail-row">
              <span className="detail-label">Rule:</span>
              <span className="detail-value">{metadata.ruleName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Rule ID:</span>
              <span className="detail-value metadata-id">{metadata.ruleId}</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (undoableActions.length === 0) {
    return (
      <div className="undo-panel empty">
        <div className="empty-state">
          <p className="muted">No actions to undo</p>
          <p className="muted-small">
            Recent actions (up to 10) will appear here and can be undone
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="undo-panel">
      <div className="undo-panel-header">
        <h3>Recent Actions ({undoableActions.length}/10)</h3>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleClearHistory}
          disabled={isLoading}
        >
          Clear History
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="undo-actions-list">
        {undoableActions.map((action) => (
          <div
            key={action.id}
            className={`undo-action-card ${expandedActionId === action.id ? 'expanded' : ''}`}
          >
            <div
              className="undo-action-header"
              onClick={() => setExpandedActionId(expandedActionId === action.id ? null : action.id)}
            >
              <div className="undo-action-info">
                <span className="action-icon">{getActionIcon(action.type)}</span>
                <div className="action-text">
                  <div className="action-description">{action.description}</div>
                  <div className="action-meta">
                    <span className="badge badge-muted">{getActionTypeLabel(action)}</span>
                    <span className="action-time muted-small">{formatActionTime(action.timestamp)}</span>
                  </div>
                </div>
              </div>
              <button className="expand-button" type="button">
                {expandedActionId === action.id ? '▼' : '▶'}
              </button>
            </div>

            {expandedActionId === action.id && (
              <div className="undo-action-body">
                {renderActionDetails(action)}

                <div className="undo-action-footer">
                  {/* Progress bar for bulk operations */}
                  {undoingActionId === action.id && localProgress && (
                    <div className="bulk-undo-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${(localProgress.current / localProgress.total) * 100}%` }}
                        />
                      </div>
                      <div className="progress-text">
                        <span>Processing: {localProgress.current} / {localProgress.total}</span>
                        {localProgress.currentUserName && (
                          <span className="muted-small"> - {localProgress.currentUserName}</span>
                        )}
                      </div>
                      <div className="progress-stats">
                        <span className="progress-success">Succeeded: {localProgress.succeeded}</span>
                        {localProgress.failed > 0 && (
                          <span className="progress-failed">Failed: {localProgress.failed}</span>
                        )}
                      </div>
                    </div>
                  )}
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUndo(action);
                    }}
                    disabled={isLoading || undoingActionId === action.id}
                  >
                    {undoingActionId === action.id
                      ? (localProgress ? `Undoing... ${localProgress.current}/${localProgress.total}` : 'Undoing...')
                      : 'Undo This Action'}
                  </button>
                  <p className="undo-warning muted-small">
                    {action.type === 'BULK_REMOVE_USERS_FROM_GROUP'
                      ? `This will restore ${(action.metadata as BulkRemoveUsersMetadata).users.length} users to the group`
                      : action.type === 'BULK_ADD_USERS_TO_GROUP'
                      ? `This will remove ${(action.metadata as BulkAddUsersMetadata).users.length} users from the group`
                      : 'This will reverse the action shown above'}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UndoPanel;
