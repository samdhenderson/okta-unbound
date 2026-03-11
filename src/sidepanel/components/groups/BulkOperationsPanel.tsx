import React, { useState, useCallback } from 'react';
import Button from '../shared/Button';
import type { GroupSummary, BulkOperationResult } from '../../../shared/types';

type BulkOpType = 'cleanup_inactive' | 'export_all' | 'remove_user';

interface BulkOperationsPanelProps {
  selectedGroups: GroupSummary[];
  executeBulkOperation: (
    operation: any,
    onProgress?: (current: number, total: number, currentGroupName: string) => void
  ) => Promise<any[]>;
  onClose: () => void;
  onExportSelection: () => void;
}

const OPERATIONS: Array<{ type: BulkOpType; label: string; description: string; icon: string; variant: 'secondary' | 'danger' }> = [
  { type: 'cleanup_inactive', label: 'Clean Inactive Users', description: 'Remove deprovisioned, suspended, and locked users', icon: 'trash', variant: 'danger' },
  { type: 'export_all', label: 'Export All Members', description: 'Export member lists for all selected groups', icon: 'download', variant: 'secondary' },
  { type: 'remove_user', label: 'Remove User from All', description: 'Remove a specific user from all selected groups', icon: 'minus', variant: 'danger' },
];

const BulkOperationsPanel: React.FC<BulkOperationsPanelProps> = ({
  selectedGroups,
  executeBulkOperation,
  onClose,
  onExportSelection,
}) => {
  const [running, setRunning] = useState(false);
  const [currentOp, setCurrentOp] = useState<BulkOpType | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, groupName: '' });
  const [results, setResults] = useState<BulkOperationResult[] | null>(null);
  const [removeUserId, setRemoveUserId] = useState('');
  const [showRemoveInput, setShowRemoveInput] = useState(false);

  const handleExecute = useCallback(async (type: BulkOpType, config?: any) => {
    setRunning(true);
    setCurrentOp(type);
    setResults(null);

    try {
      const opResults = await executeBulkOperation(
        {
          id: `bulk_${Date.now()}`,
          type,
          targetGroups: selectedGroups.map((g) => g.id),
          status: 'pending',
          progress: 0,
          results: [],
          config,
        },
        (current, total, groupName) => setProgress({ current, total, groupName })
      );
      setResults(opResults);
    } catch (err) {
      setResults([{
        groupId: 'error',
        groupName: 'Operation failed',
        status: 'failed',
        itemsProcessed: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      }]);
    } finally {
      setRunning(false);
      setCurrentOp(null);
    }
  }, [selectedGroups, executeBulkOperation]);

  const handleRemoveUser = useCallback(() => {
    if (!removeUserId.trim()) return;
    handleExecute('remove_user', { userId: removeUserId.trim() });
    setShowRemoveInput(false);
    setRemoveUserId('');
  }, [removeUserId, handleExecute]);

  const successCount = results?.filter((r) => r.status === 'success').length || 0;
  const failCount = results?.filter((r) => r.status === 'failed').length || 0;

  return (
    <div className="border border-neutral-200 rounded-md bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-neutral-50 border-b border-neutral-200">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900">Bulk Operations</h4>
          <p className="text-xs text-neutral-500 mt-0.5">
            {selectedGroups.length} group{selectedGroups.length !== 1 ? 's' : ''} selected
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Operations */}
      {!running && !results && (
        <div className="p-3 space-y-2">
          {OPERATIONS.map((op) => (
            <button
              key={op.type}
              onClick={() => {
                if (op.type === 'remove_user') {
                  setShowRemoveInput(true);
                } else if (op.type === 'export_all') {
                  onExportSelection();
                } else {
                  handleExecute(op.type);
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-md border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-colors text-left"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-neutral-900">{op.label}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{op.description}</div>
              </div>
              <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}

          {/* Remove User Input */}
          {showRemoveInput && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Enter user ID to remove..."
                value={removeUserId}
                onChange={(e) => setRemoveUserId(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary"
                autoFocus
              />
              <Button variant="danger" size="sm" onClick={handleRemoveUser} disabled={!removeUserId.trim()}>
                Remove
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowRemoveInput(false); setRemoveUserId(''); }}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {running && (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-neutral-200 border-t-primary rounded-full animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-neutral-900">
                {currentOp === 'cleanup_inactive' ? 'Cleaning inactive users' :
                 currentOp === 'export_all' ? 'Exporting members' :
                 'Removing user'} ...
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 truncate">{progress.groupName}</div>
            </div>
            <span className="text-sm font-medium text-neutral-700 shrink-0">
              {progress.current}/{progress.total}
            </span>
          </div>
          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="p-3 space-y-3">
          <div className="flex gap-3">
            {successCount > 0 && (
              <div className="flex-1 p-2 bg-success-light rounded-md text-center">
                <div className="text-lg font-bold text-success-text">{successCount}</div>
                <div className="text-xs text-success-text">Succeeded</div>
              </div>
            )}
            {failCount > 0 && (
              <div className="flex-1 p-2 bg-danger-light rounded-md text-center">
                <div className="text-lg font-bold text-danger-text">{failCount}</div>
                <div className="text-xs text-danger-text">Failed</div>
              </div>
            )}
          </div>

          {/* Error details */}
          {results.filter((r) => r.errors?.length).map((r) => (
            <div key={r.groupId} className="p-2 bg-danger-light rounded-md text-xs text-danger-text">
              <span className="font-medium">{r.groupName}:</span> {r.errors?.join(', ')}
            </div>
          ))}

          <Button variant="secondary" size="sm" fullWidth onClick={() => setResults(null)}>
            Run Another Operation
          </Button>
        </div>
      )}
    </div>
  );
};

export default BulkOperationsPanel;
