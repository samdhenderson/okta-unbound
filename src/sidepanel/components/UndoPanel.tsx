// Undo Panel Component
// Displays undo history and allows users to undo recent actions

import React, { useState } from 'react';
import type { UndoAction } from '../../shared/types';
import { formatActionTime } from '../../shared/undoManager';
import { useUndoManager } from '../hooks/useUndoManager';

interface UndoPanelProps {
  targetTabId?: number;
  onUndoComplete?: () => void;
}

const UndoPanel: React.FC<UndoPanelProps> = ({ targetTabId, onUndoComplete }) => {
  const { undoableActions, isLoading, error, performUndo, clearHistory } = useUndoManager();
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [undoingActionId, setUndoingActionId] = useState<string | null>(null);

  const handleUndo = async (action: UndoAction) => {
    if (!targetTabId) {
      alert('No Okta tab connected');
      return;
    }

    if (!confirm(`Are you sure you want to undo: ${action.description}?`)) {
      return;
    }

    setUndoingActionId(action.id);

    try {
      const result = await performUndo(action, targetTabId);

      if (result.success) {
        alert(`Successfully undone: ${action.description}`);
        onUndoComplete?.();
      } else {
        alert(`Failed to undo: ${result.error}`);
      }
    } finally {
      setUndoingActionId(null);
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
      case 'ACTIVATE_RULE':
        return '✅';
      case 'DEACTIVATE_RULE':
        return '⏸️';
      default:
        return '⚙️';
    }
  };

  const getActionTypeLabel = (type: UndoAction['type']): string => {
    switch (type) {
      case 'REMOVE_USER_FROM_GROUP':
        return 'User Removal';
      case 'ADD_USER_TO_GROUP':
        return 'User Addition';
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
                    <span className="badge badge-muted">{getActionTypeLabel(action.type)}</span>
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
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUndo(action);
                    }}
                    disabled={isLoading || undoingActionId === action.id}
                  >
                    {undoingActionId === action.id ? 'Undoing...' : 'Undo This Action'}
                  </button>
                  <p className="undo-warning muted-small">
                    This will reverse the action shown above
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
