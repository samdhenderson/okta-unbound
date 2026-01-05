// Undo Panel Component
// Displays undo history and allows users to undo recent actions

import React, { useState, useEffect } from 'react';
import type { UndoAction } from '../../shared/types';
import type {
  BulkActionSubItem,
} from '../../shared/undoTypes';
import { formatActionTime, initializeSubItemsForBulkActions } from '../../shared/undoManager';
import { useUndoManager, BulkUndoProgress } from '../hooks/useUndoManager';
import Button from './shared/Button';
import AlertMessage from './shared/AlertMessage';
import EmptyState from './shared/EmptyState';

interface UndoPanelProps {
  targetTabId?: number;
  onUndoComplete?: () => void;
}

const UndoPanel: React.FC<UndoPanelProps> = ({ targetTabId, onUndoComplete }) => {
  const { undoableActions, isLoading, error, performUndo, clearHistory } = useUndoManager();
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [undoingActionId, setUndoingActionId] = useState<string | null>(null);
  const [localProgress, setLocalProgress] = useState<BulkUndoProgress | null>(null);

  // Initialize sub-items for backward compatibility
  useEffect(() => {
    initializeSubItemsForBulkActions();
  }, []);

  const handleUndo = async (action: UndoAction) => {
    if (!targetTabId) {
      alert('No Okta tab connected');
      return;
    }

    // Custom confirmation for bulk operations
    const isBulkAction = action.type.startsWith('BULK_') || action.type === 'CONVERT_USER_TO_GROUP_ASSIGNMENT';
    let confirmMessage = `Are you sure you want to undo: ${action.description}?`;

    if (isBulkAction && action.subItems) {
      const remainingItems = action.subItems.filter(si => si.status === 'completed');
      const itemCount = remainingItems.length;

      if (itemCount === 0) {
        alert('All items in this action have already been undone.');
        return;
      }

      const metadata = action.metadata;
      if (metadata.type === 'BULK_REMOVE_USERS_FROM_GROUP') {
        confirmMessage = `This will restore ${itemCount} user${itemCount !== 1 ? 's' : ''} to ${metadata.groupName}.\n\nAre you sure you want to proceed?`;
      } else if (metadata.type === 'BULK_ADD_USERS_TO_GROUP') {
        confirmMessage = `This will remove ${itemCount} user${itemCount !== 1 ? 's' : ''} from ${metadata.groupName}.\n\nAre you sure you want to proceed?`;
      } else if (metadata.type === 'BULK_ACTIVATE_RULES') {
        confirmMessage = `This will deactivate ${itemCount} rule${itemCount !== 1 ? 's' : ''}.\n\nAre you sure you want to proceed?`;
      } else if (metadata.type === 'BULK_DEACTIVATE_RULES') {
        confirmMessage = `This will activate ${itemCount} rule${itemCount !== 1 ? 's' : ''}.\n\nAre you sure you want to proceed?`;
      } else if (metadata.type === 'BULK_REMOVE_USERS_FROM_APP') {
        confirmMessage = `This will restore ${itemCount} user${itemCount !== 1 ? 's' : ''} to ${metadata.appName}.\n\nAre you sure you want to proceed?`;
      } else if (metadata.type === 'BULK_REMOVE_GROUPS_FROM_APP') {
        confirmMessage = `This will restore ${itemCount} group${itemCount !== 1 ? 's' : ''} to ${metadata.appName}.\n\nAre you sure you want to proceed?`;
      } else if (metadata.type === 'CONVERT_USER_TO_GROUP_ASSIGNMENT') {
        confirmMessage = `This will revert ${itemCount} app assignment conversion${itemCount !== 1 ? 's' : ''} for ${metadata.userName}.\n\nAre you sure you want to proceed?`;
      }
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
      case 'BULK_ACTIVATE_RULES':
        return '✅📋';
      case 'BULK_DEACTIVATE_RULES':
        return '⏸️📋';
      case 'REMOVE_USER_FROM_APP':
        return '📱➖👤';
      case 'REMOVE_GROUP_FROM_APP':
        return '📱➖👥';
      case 'BULK_REMOVE_USERS_FROM_APP':
        return '📱➖👥';
      case 'BULK_REMOVE_GROUPS_FROM_APP':
        return '📱➖👥👥';
      case 'CONVERT_USER_TO_GROUP_ASSIGNMENT':
        return '🔄📱';
      default:
        return '⚙️';
    }
  };

  const getActionTypeLabel = (action: UndoAction): string => {
    const metadata = action.metadata;
    const remainingCount = action.subItems?.filter(si => si.status === 'completed').length || 0;
    const totalCount = action.subItems?.length || 0;
    const hasPartial = remainingCount < totalCount && remainingCount > 0;

    switch (metadata.type) {
      case 'REMOVE_USER_FROM_GROUP':
        return 'User Removal';
      case 'ADD_USER_TO_GROUP':
        return 'User Addition';
      case 'BULK_REMOVE_USERS_FROM_GROUP':
        return hasPartial ? `Bulk Removal (${remainingCount}/${totalCount})` : `Bulk Removal (${totalCount})`;
      case 'BULK_ADD_USERS_TO_GROUP':
        return hasPartial ? `Bulk Addition (${remainingCount}/${totalCount})` : `Bulk Addition (${totalCount})`;
      case 'ACTIVATE_RULE':
        return 'Rule Activation';
      case 'DEACTIVATE_RULE':
        return 'Rule Deactivation';
      case 'BULK_ACTIVATE_RULES':
        return hasPartial ? `Bulk Activation (${remainingCount}/${totalCount})` : `Bulk Activation (${totalCount})`;
      case 'BULK_DEACTIVATE_RULES':
        return hasPartial ? `Bulk Deactivation (${remainingCount}/${totalCount})` : `Bulk Deactivation (${totalCount})`;
      case 'REMOVE_USER_FROM_APP':
        return 'App User Removal';
      case 'REMOVE_GROUP_FROM_APP':
        return 'App Group Removal';
      case 'BULK_REMOVE_USERS_FROM_APP':
        return hasPartial ? `App Bulk Removal (${remainingCount}/${totalCount})` : `App Bulk Removal (${totalCount})`;
      case 'BULK_REMOVE_GROUPS_FROM_APP':
        return hasPartial ? `App Group Removal (${remainingCount}/${totalCount})` : `App Group Removal (${totalCount})`;
      case 'CONVERT_USER_TO_GROUP_ASSIGNMENT':
        return hasPartial ? `Assignment Conversion (${remainingCount}/${totalCount})` : `Assignment Conversion (${totalCount})`;
      default:
        return 'Unknown';
    }
  };

  const renderBulkActionSubItems = (action: UndoAction) => {
    if (!action.subItems || action.subItems.length === 0) {
      return null;
    }

    const metadata = action.metadata;
    const remainingItems = action.subItems.filter(si => si.status === 'completed');

    if (remainingItems.length === 0) {
      return (
        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-800 font-medium">✓ All items in this bulk action have been undone</p>
        </div>
      );
    }

    let items: Array<{ id: string; name: string; status: BulkActionSubItem['status'] }> = [];

    // Map sub-items to their data based on action type
    if (metadata.type === 'BULK_REMOVE_USERS_FROM_GROUP' || metadata.type === 'BULK_ADD_USERS_TO_GROUP') {
      items = action.subItems.map(subItem => {
        const user = metadata.users.find(u => u.userId === subItem.id);
        return {
          id: subItem.id,
          name: user ? `${user.userName} (${user.userEmail})` : subItem.id,
          status: subItem.status
        };
      });
    } else if (metadata.type === 'BULK_ACTIVATE_RULES' || metadata.type === 'BULK_DEACTIVATE_RULES') {
      items = action.subItems.map(subItem => {
        const rule = metadata.rules.find(r => r.ruleId === subItem.id);
        return {
          id: subItem.id,
          name: rule ? rule.ruleName : subItem.id,
          status: subItem.status
        };
      });
    } else if (metadata.type === 'BULK_REMOVE_USERS_FROM_APP') {
      items = action.subItems.map(subItem => {
        const user = metadata.users.find(u => u.userId === subItem.id);
        return {
          id: subItem.id,
          name: user ? `${user.userName} (${user.userEmail})` : subItem.id,
          status: subItem.status
        };
      });
    } else if (metadata.type === 'BULK_REMOVE_GROUPS_FROM_APP') {
      items = action.subItems.map(subItem => {
        const group = metadata.groups.find(g => g.groupId === subItem.id);
        return {
          id: subItem.id,
          name: group ? group.groupName : subItem.id,
          status: subItem.status
        };
      });
    } else if (metadata.type === 'CONVERT_USER_TO_GROUP_ASSIGNMENT') {
      items = action.subItems.map(subItem => {
        const app = metadata.apps.find(a => a.appId === subItem.id);
        return {
          id: subItem.id,
          name: app ? app.appName : subItem.id,
          status: subItem.status
        };
      });
    }

    return (
      <details className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center justify-between">
          <span>View all {action.subItems.length} items ({remainingItems.length} remaining)</span>
          <span className="text-xs text-gray-500">Click to expand</span>
        </summary>
        <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 text-sm py-2 px-2 rounded ${
                item.status === 'undone' ? 'bg-green-100 opacity-60' :
                item.status === 'failed' ? 'bg-red-100 opacity-60' :
                'hover:bg-gray-100'
              }`}
            >
              <span className="text-gray-500 min-w-[30px] text-xs">{index + 1}.</span>
              <span className={`flex-1 ${item.status === 'completed' ? 'font-medium text-gray-900' : 'text-gray-600 line-through'}`}>
                {item.name}
              </span>
              {item.status === 'undone' && (
                <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded">Undone</span>
              )}
              {item.status === 'failed' && (
                <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded">Failed</span>
              )}
              {item.status === 'completed' && (
                <span className="text-xs px-2 py-0.5 bg-gray-500 text-white rounded">Pending</span>
              )}
            </div>
          ))}
        </div>
      </details>
    );
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
            {renderBulkActionSubItems(action)}
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

      case 'BULK_ACTIVATE_RULES':
      case 'BULK_DEACTIVATE_RULES':
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Rules affected:</span>
              <span className="text-gray-900 font-semibold">{metadata.rules.length}</span>
            </div>
            {renderBulkActionSubItems(action)}
          </div>
        );

      case 'REMOVE_USER_FROM_APP':
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">User:</span>
              <span className="text-gray-900">{metadata.userName} ({metadata.userEmail})</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">App:</span>
              <span className="text-gray-900">{metadata.appName}</span>
            </div>
          </div>
        );

      case 'REMOVE_GROUP_FROM_APP':
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Group:</span>
              <span className="text-gray-900">{metadata.groupName}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">App:</span>
              <span className="text-gray-900">{metadata.appName}</span>
            </div>
          </div>
        );

      case 'BULK_REMOVE_USERS_FROM_APP':
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">App:</span>
              <span className="text-gray-900">{metadata.appName}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Users affected:</span>
              <span className="text-gray-900 font-semibold">{metadata.users.length}</span>
            </div>
            {renderBulkActionSubItems(action)}
          </div>
        );

      case 'BULK_REMOVE_GROUPS_FROM_APP':
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">App:</span>
              <span className="text-gray-900">{metadata.appName}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Groups affected:</span>
              <span className="text-gray-900 font-semibold">{metadata.groups.length}</span>
            </div>
            {renderBulkActionSubItems(action)}
          </div>
        );

      case 'CONVERT_USER_TO_GROUP_ASSIGNMENT':
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">User:</span>
              <span className="text-gray-900">{metadata.userName} ({metadata.userEmail})</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Target Group:</span>
              <span className="text-gray-900">{metadata.targetGroupName}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">Apps converted:</span>
              <span className="text-gray-900 font-semibold">{metadata.apps.length}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-semibold text-gray-700 min-w-[100px]">User removed:</span>
              <span className={metadata.userAssignmentsRemoved ? 'text-green-700 font-semibold' : 'text-gray-600'}>
                {metadata.userAssignmentsRemoved ? 'Yes' : 'No'}
              </span>
            </div>
            {renderBulkActionSubItems(action)}
          </div>
        );

      default:
        return null;
    }
  };

  const getRemainingCount = (action: UndoAction): number => {
    if (!action.subItems) return 0;
    return action.subItems.filter(si => si.status === 'completed').length;
  };

  if (undoableActions.length === 0) {
    return (
      <EmptyState
        icon="list"
        title="No actions to undo"
        description="Recent bulk actions (up to 10) will appear here and can be undone"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">
          Recent Actions ({undoableActions.length}/10)
        </h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClearHistory}
          disabled={isLoading}
        >
          Clear History
        </Button>
      </div>

      {error && (
        <AlertMessage
          message={{ text: error, type: 'error' }}
        />
      )}

      <div className="space-y-3">
        {undoableActions.map((action) => {
          const remainingCount = getRemainingCount(action);
          const hasPartiallyCompleted = action.subItems && remainingCount < action.subItems.length && remainingCount > 0;

          return (
            <div
              key={action.id}
              className={`bg-white rounded-lg border border-gray-200 shadow-sm transition-all duration-300 overflow-hidden hover:shadow-md ${
                expandedActionId === action.id ? 'ring-2 ring-blue-200' : ''
              } ${hasPartiallyCompleted ? 'border-l-4 border-l-yellow-400' : ''}`}
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
                      {hasPartiallyCompleted && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-md">
                          Partially Undone
                        </span>
                      )}
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
                      className="w-full px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:from-amber-300 disabled:to-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUndo(action);
                      }}
                      disabled={isLoading || undoingActionId === action.id || remainingCount === 0}
                    >
                      {undoingActionId === action.id
                        ? (localProgress ? `Undoing... ${localProgress.current}/${localProgress.total}` : 'Undoing...')
                        : remainingCount === 0
                        ? 'All Items Undone'
                        : 'Undo This Action'}
                    </button>
                    <p className="text-xs text-gray-600 italic">
                      {action.metadata.type === 'BULK_REMOVE_USERS_FROM_GROUP'
                        ? `This will restore ${remainingCount} users to the group`
                        : action.metadata.type === 'BULK_ADD_USERS_TO_GROUP'
                        ? `This will remove ${remainingCount} users from the group`
                        : action.metadata.type === 'BULK_ACTIVATE_RULES'
                        ? `This will deactivate ${remainingCount} rules`
                        : action.metadata.type === 'BULK_DEACTIVATE_RULES'
                        ? `This will activate ${remainingCount} rules`
                        : action.metadata.type === 'BULK_REMOVE_USERS_FROM_APP'
                        ? `This will restore ${remainingCount} users to the app`
                        : action.metadata.type === 'BULK_REMOVE_GROUPS_FROM_APP'
                        ? `This will restore ${remainingCount} groups to the app`
                        : action.metadata.type === 'CONVERT_USER_TO_GROUP_ASSIGNMENT'
                        ? `This will revert ${remainingCount} app assignment conversions`
                        : 'This will reverse the action shown above'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UndoPanel;
