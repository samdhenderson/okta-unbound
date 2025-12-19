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
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">User:</span>
              <span className="text-gray-900">{metadata.userName} ({metadata.userEmail})</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Group:</span>
              <span className="text-gray-900">{metadata.groupName}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">User ID:</span>
              <span className="font-mono text-xs text-gray-600">{metadata.userId}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Group ID:</span>
              <span className="font-mono text-xs text-gray-600">{metadata.groupId}</span>
            </div>
          </div>
        );

      case 'ADD_USER_TO_GROUP':
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">User:</span>
              <span className="text-gray-900">{metadata.userName} ({metadata.userEmail})</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Group:</span>
              <span className="text-gray-900">{metadata.groupName}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">User ID:</span>
              <span className="font-mono text-xs text-gray-600">{metadata.userId}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Group ID:</span>
              <span className="font-mono text-xs text-gray-600">{metadata.groupId}</span>
            </div>
          </div>
        );

      case 'BULK_REMOVE_USERS_FROM_GROUP':
      case 'BULK_ADD_USERS_TO_GROUP':
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Group:</span>
              <span className="text-gray-900">{metadata.groupName}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Users affected:</span>
              <span className="text-gray-900 font-semibold">{metadata.users.length}</span>
            </div>
            {metadata.type === 'BULK_REMOVE_USERS_FROM_GROUP' && metadata.operationType && (
              <div className="flex items-start gap-2 text-sm">
                <span className="font-semibold text-gray-700 min-w-[100px]">Operation:</span>
                <span className="text-gray-900">
                  {metadata.operationType === 'deprovisioned' ? 'Remove Deprovisioned' :
                   metadata.operationType === 'inactive' ? 'Smart Cleanup (Inactive)' :
                   `Custom Status (${metadata.targetStatus})`}
                </span>
              </div>
            )}
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Group ID:</span>
              <span className="font-mono text-xs text-gray-600">{metadata.groupId}</span>
            </div>
            <details className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                View all {metadata.users.length} users
              </summary>
              <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {metadata.users.map((user, index) => (
                  <div key={user.userId} className="flex items-center gap-2 text-sm py-1">
                    <span className="text-gray-500 min-w-[30px]">{index + 1}.</span>
                    <span className="font-medium text-gray-900">{user.userName}</span>
                    <span className="text-gray-600 text-xs">({user.userEmail})</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        );

      case 'ACTIVATE_RULE':
      case 'DEACTIVATE_RULE':
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Rule:</span>
              <span className="text-gray-900">{metadata.ruleName}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Rule ID:</span>
              <span className="font-mono text-xs text-gray-600">{metadata.ruleId}</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (undoableActions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200">
        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-900">No actions to undo</p>
        <p className="text-sm text-gray-500 mt-1">
          Recent actions (up to 10) will appear here and can be undone
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">
          Recent Actions ({undoableActions.length}/10)
        </h3>
        <button
          className="px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleClearHistory}
          disabled={isLoading}
        >
          Clear History
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <span className="font-semibold text-red-800">Error:</span>{' '}
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {undoableActions.map((action) => (
          <div
            key={action.id}
            className={`bg-white rounded-lg border border-gray-200 shadow-sm transition-all duration-300 overflow-hidden hover:shadow-md ${
              expandedActionId === action.id ? 'ring-2 ring-blue-200' : ''
            }`}
          >
            <div
              className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors duration-200 flex items-center justify-between gap-4"
              onClick={() => setExpandedActionId(expandedActionId === action.id ? null : action.id)}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-2xl flex-shrink-0">{getActionIcon(action.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 mb-1">{action.description}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-md">
                      {getActionTypeLabel(action)}
                    </span>
                    <span className="text-xs text-gray-500">{formatActionTime(action.timestamp)}</span>
                  </div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100 flex-shrink-0" type="button">
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${expandedActionId === action.id ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {expandedActionId === action.id && (
              <div className="px-5 pb-5 pt-2 space-y-4 bg-gradient-to-b from-gray-50/30 to-white border-t border-gray-100">
                {renderActionDetails(action)}

                <div className="space-y-3 pt-2 border-t border-gray-200">
                  {/* Progress bar for bulk operations */}
                  {undoingActionId === action.id && localProgress && (
                    <div className="space-y-2">
                      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
                          style={{ width: `${(localProgress.current / localProgress.total) * 100}%` }}
                        />
                      </div>
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">Processing: {localProgress.current} / {localProgress.total}</span>
                        {localProgress.currentUserName && (
                          <span className="text-gray-500 ml-2">- {localProgress.currentUserName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-emerald-700 font-medium">Succeeded: {localProgress.succeeded}</span>
                        {localProgress.failed > 0 && (
                          <span className="text-red-700 font-medium">Failed: {localProgress.failed}</span>
                        )}
                      </div>
                    </div>
                  )}
                  <button
                    className="w-full px-4 py-2 text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:from-amber-300 disabled:to-amber-400 disabled:cursor-not-allowed"
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
                  <p className="text-xs text-gray-600 italic">
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
