// Audit Log Viewer
// Displays action history as a read-only audit trail

import React, { useState, useEffect, useCallback } from 'react';
import type { UndoAction } from '../../shared/undoTypes';
import { getUndoHistory, clearUndoHistory, formatActionTime } from '../../shared/undoManager';
import Button from './shared/Button';
import EmptyState from './shared/EmptyState';

const AuditLogViewer: React.FC = () => {
  const [actions, setActions] = useState<UndoAction[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const history = await getUndoHistory();
    setActions(history.actions);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for storage changes
  useEffect(() => {
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.undoHistory) refresh();
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [refresh]);

  const handleClear = async () => {
    if (!confirm('Clear all audit history? This cannot be undone.')) return;
    await clearUndoHistory();
    setActions([]);
  };

  const getTypeLabel = (type: UndoAction['type']): string => {
    switch (type) {
      case 'REMOVE_USER_FROM_GROUP': return 'User Removal';
      case 'ADD_USER_TO_GROUP': return 'User Addition';
      case 'BULK_REMOVE_USERS_FROM_GROUP': return 'Bulk Removal';
      case 'BULK_ADD_USERS_TO_GROUP': return 'Bulk Addition';
      case 'ACTIVATE_RULE': return 'Rule Activated';
      case 'DEACTIVATE_RULE': return 'Rule Deactivated';
      default: return 'Action';
    }
  };

  const renderDetails = (action: UndoAction) => {
    const m = action.metadata;
    const rows: Array<[string, string]> = [];

    if (m.type === 'REMOVE_USER_FROM_GROUP' || m.type === 'ADD_USER_TO_GROUP') {
      rows.push(['User', `${m.userName} (${m.userEmail})`]);
      rows.push(['Group', m.groupName]);
      rows.push(['User ID', m.userId]);
      rows.push(['Group ID', m.groupId]);
    } else if (m.type === 'BULK_REMOVE_USERS_FROM_GROUP' || m.type === 'BULK_ADD_USERS_TO_GROUP') {
      rows.push(['Group', m.groupName]);
      rows.push(['Users affected', String(m.users.length)]);
      rows.push(['Group ID', m.groupId]);
      if (m.type === 'BULK_REMOVE_USERS_FROM_GROUP' && m.operationType) {
        rows.push(['Operation', m.operationType]);
      }
    } else if (m.type === 'ACTIVATE_RULE' || m.type === 'DEACTIVATE_RULE') {
      rows.push(['Rule', m.ruleName]);
      rows.push(['Rule ID', m.ruleId]);
    }

    return (
      <div className="px-4 pb-4 pt-2 border-t border-neutral-100 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2 text-sm">
            <span className="font-medium text-neutral-600 min-w-25">{label}:</span>
            <span className="text-neutral-900">{value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (actions.length === 0) {
    return (
      <EmptyState
        icon="list"
        title="No audit history"
        description="Actions you perform (user removals, rule changes, etc.) will be logged here"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-md border border-neutral-200">
        <span className="text-sm font-medium text-neutral-700">
          {actions.length} action{actions.length !== 1 ? 's' : ''} logged
        </span>
        <Button variant="secondary" size="sm" onClick={handleClear}>
          Clear History
        </Button>
      </div>

      <div className="space-y-2">
        {actions.map((action) => (
          <div
            key={action.id}
            className="bg-white rounded-md border border-neutral-200 overflow-hidden"
          >
            <div
              className="p-3 cursor-pointer hover:bg-neutral-50 flex items-center justify-between gap-3"
              onClick={() => setExpandedId(expandedId === action.id ? null : action.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-900 truncate">{action.description}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs font-medium rounded">
                    {getTypeLabel(action.type)}
                  </span>
                  <span className="text-xs text-neutral-500">{formatActionTime(action.timestamp)}</span>
                </div>
              </div>
              <svg
                className={`w-4 h-4 text-neutral-400 transition-transform ${expandedId === action.id ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            {expandedId === action.id && renderDetails(action)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditLogViewer;
