import React, { useState } from 'react';
import type { BulkOperation, BulkOperationResult, UserStatus } from '../../../shared/types';

interface BulkOperationsProps {
  selectedGroupIds: string[];
  onExecute: (operation: BulkOperation, onProgress: (current: number, total: number, groupName: string) => void) => Promise<BulkOperationResult[]>;
}

const BulkOperations: React.FC<BulkOperationsProps> = ({
  selectedGroupIds,
  onExecute,
}) => {
  const [operationType, setOperationType] = useState<BulkOperation['type']>('cleanup_inactive');
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentGroup, setCurrentGroup] = useState('');
  const [results, setResults] = useState<BulkOperationResult[] | null>(null);

  // Multi-status selection for cleanup operation
  const [selectedStatuses, setSelectedStatuses] = useState<Set<UserStatus>>(
    new Set(['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT'])
  );

  const toggleStatus = (status: UserStatus) => {
    const newStatuses = new Set(selectedStatuses);
    if (newStatuses.has(status)) {
      newStatuses.delete(status);
    } else {
      newStatuses.add(status);
    }
    setSelectedStatuses(newStatuses);
  };

  const handleExecute = async () => {
    if (selectedGroupIds.length === 0) {
      alert('Please select at least one group');
      return;
    }

    // Validate cleanup operation has at least one status selected
    if (operationType === 'cleanup_inactive' && selectedStatuses.size === 0) {
      alert('Please select at least one user status to remove');
      return;
    }

    const confirmMessage = getConfirmationMessage();
    if (!confirm(confirmMessage)) {
      return;
    }

    const operation: BulkOperation = {
      id: crypto.randomUUID(),
      type: operationType,
      targetGroups: [...selectedGroupIds],
      status: 'running',
      progress: 0,
      results: [],
      config: operationType === 'cleanup_inactive'
        ? { statuses: Array.from(selectedStatuses) }
        : undefined,
    };

    setExecuting(true);
    setProgress(0);
    setCurrentGroup('');
    setResults(null);

    try {
      const operationResults = await onExecute(operation, (current, total, groupName) => {
        setProgress((current / total) * 100);
        setCurrentGroup(groupName);
      });
      setResults(operationResults);
    } catch (error) {
      alert(`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExecuting(false);
      setProgress(100);
      setCurrentGroup('');
    }
  };

  const getConfirmationMessage = () => {
    const groupCount = selectedGroupIds.length;
    switch (operationType) {
      case 'cleanup_inactive': {
        const statusList = Array.from(selectedStatuses).join(', ');
        return `Remove users with status: ${statusList} from ${groupCount} group${groupCount !== 1 ? 's' : ''}?`;
      }
      case 'export_all':
        return `Export members from ${groupCount} group${groupCount !== 1 ? 's' : ''}?`;
      default:
        return `Execute operation on ${groupCount} group${groupCount !== 1 ? 's' : ''}?`;
    }
  };

  const getOperationDescription = () => {
    switch (operationType) {
      case 'cleanup_inactive':
        return 'Remove users with selected statuses from all selected groups (choose which statuses below)';
      case 'export_all':
        return 'Export members from all selected groups into a combined CSV file';
      default:
        return '';
    }
  };

  const successCount = results?.filter((r) => r.status === 'success').length || 0;
  const failedCount = results?.filter((r) => r.status === 'failed').length || 0;
  const totalProcessed = results?.reduce((sum, r) => sum + r.itemsProcessed, 0) || 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Bulk Operations</h3>
        <p className="text-sm text-gray-600">
          Apply operations across multiple groups at once. Select groups from the list above.
        </p>
      </div>

      {/* Operation Config */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Operation Type
          </label>
          <select
            value={operationType}
            onChange={(e) => setOperationType(e.target.value as BulkOperation['type'])}
            disabled={executing}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-200"
          >
            <option value="cleanup_inactive">Remove Users by Status</option>
            <option value="export_all">Export All Members</option>
          </select>
        </div>

        <div className="p-4 bg-blue-50/50 rounded-lg border-l-4 border-[#007dc1]">
          <p className="text-sm text-gray-700">{getOperationDescription()}</p>
        </div>

        {operationType === 'cleanup_inactive' && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              Select User Statuses to Remove
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT', 'STAGED', 'PROVISIONED', 'RECOVERY', 'PASSWORD_EXPIRED'] as UserStatus[]).map((status) => (
                <label
                  key={status}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                    selectedStatuses.has(status)
                      ? 'border-[#007dc1] bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  } ${executing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.has(status)}
                    onChange={() => toggleStatus(status)}
                    disabled={executing}
                    className="w-4 h-4 rounded border-gray-300 text-[#007dc1] focus:ring-[#007dc1]/30"
                  />
                  <span className="text-sm font-medium text-gray-900">{status.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selectedStatuses.size} status{selectedStatuses.size !== 1 ? 'es' : ''} selected
            </p>
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <span className="text-sm font-semibold text-gray-700">Selected Groups:</span>
          <span className="text-lg font-bold text-gray-900">{selectedGroupIds.length}</span>
        </div>

        <button
          onClick={handleExecute}
          disabled={executing || selectedGroupIds.length === 0}
          className="w-full px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {executing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Executing...
            </span>
          ) : (
            `Execute on ${selectedGroupIds.length} Group${selectedGroupIds.length !== 1 ? 's' : ''}`
          )}
        </button>
      </div>

      {/* Progress Section */}
      {executing && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-3">
          <div className="space-y-2">
            <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Progress: {Math.round(progress)}%</span>
              <span className="text-gray-900 font-medium">{currentGroup}</span>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {results && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-900">Operation Results</h4>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-gray-900">{results.length}</div>
              <div className="text-sm text-gray-600 mt-1">Total Groups</div>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="text-2xl font-bold text-gray-900">{successCount}</div>
              <div className="text-sm text-gray-600 mt-1">Successful</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-gray-900">{failedCount}</div>
              <div className="text-sm text-gray-600 mt-1">Failed</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{totalProcessed}</div>
              <div className="text-sm text-gray-600 mt-1">Items Processed</div>
            </div>
          </div>

          {/* Results Details */}
          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.groupId}
                className={`p-4 rounded-lg border ${
                  result.status === 'success'
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : 'bg-red-50/30 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-white text-sm font-bold ${
                      result.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                    }`}>
                      {result.status === 'success' ? '✓' : '✗'}
                    </span>
                    <span className="font-medium text-gray-900">{result.groupName}</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {result.itemsProcessed} item{result.itemsProcessed !== 1 ? 's' : ''}
                  </span>
                </div>
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {result.errors.map((error, idx) => (
                      <div key={idx} className="text-sm text-red-700 bg-red-50 p-2 rounded border-l-2 border-red-400">
                        {error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkOperations;
