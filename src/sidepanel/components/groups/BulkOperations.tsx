import React, { useState } from 'react';
import type { BulkOperation, BulkOperationResult } from '../../../shared/types';

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
  const [userIdToRemove, setUserIdToRemove] = useState('');

  const handleExecute = async () => {
    if (selectedGroupIds.length === 0) {
      alert('Please select at least one group');
      return;
    }

    // Validate operation-specific config
    if (operationType === 'remove_user' && !userIdToRemove.trim()) {
      alert('Please enter a user ID to remove');
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
      config: operationType === 'remove_user' ? { userId: userIdToRemove } : undefined,
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
      case 'cleanup_inactive':
        return `Remove ALL inactive users (deprovisioned, suspended, locked out) from ${groupCount} group${groupCount !== 1 ? 's' : ''}?`;
      case 'export_all':
        return `Export members from ${groupCount} group${groupCount !== 1 ? 's' : ''}?`;
      case 'remove_user':
        return `Remove user ${userIdToRemove} from ${groupCount} group${groupCount !== 1 ? 's' : ''}?`;
      case 'security_scan':
        return `Run security scan on ${groupCount} group${groupCount !== 1 ? 's' : ''}?`;
      default:
        return `Execute operation on ${groupCount} group${groupCount !== 1 ? 's' : ''}?`;
    }
  };

  const getOperationDescription = () => {
    switch (operationType) {
      case 'cleanup_inactive':
        return 'Remove all inactive users (deprovisioned, suspended, locked out) from selected groups';
      case 'export_all':
        return 'Export members from all selected groups into a combined CSV file';
      case 'remove_user':
        return 'Remove a specific user from all selected groups';
      case 'security_scan':
        return 'Run security posture analysis on all selected groups';
      default:
        return '';
    }
  };

  const successCount = results?.filter((r) => r.status === 'success').length || 0;
  const failedCount = results?.filter((r) => r.status === 'failed').length || 0;
  const totalProcessed = results?.reduce((sum, r) => sum + r.itemsProcessed, 0) || 0;

  return (
    <div className="bulk-operations">
      <h3>Bulk Operations</h3>
      <p className="section-description">
        Apply operations across multiple groups at once. Select groups from the list above.
      </p>

      <div className="operation-config">
        <div className="form-group">
          <label>Operation Type:</label>
          <select
            value={operationType}
            onChange={(e) => setOperationType(e.target.value as BulkOperation['type'])}
            disabled={executing}
          >
            <option value="cleanup_inactive">Remove Inactive Users</option>
            <option value="export_all">Export All Members</option>
            <option value="remove_user">Remove Specific User</option>
            <option value="security_scan">Run Security Scan</option>
          </select>
        </div>

        <p className="operation-description">{getOperationDescription()}</p>

        {operationType === 'remove_user' && (
          <div className="form-group">
            <label>User ID to Remove:</label>
            <input
              type="text"
              value={userIdToRemove}
              onChange={(e) => setUserIdToRemove(e.target.value)}
              placeholder="Enter Okta user ID"
              disabled={executing}
            />
          </div>
        )}

        <div className="operation-summary">
          <strong>Selected Groups:</strong> {selectedGroupIds.length}
        </div>

        <button
          className="btn-primary btn-large"
          onClick={handleExecute}
          disabled={executing || selectedGroupIds.length === 0}
        >
          {executing ? 'Executing...' : `Execute on ${selectedGroupIds.length} Group${selectedGroupIds.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {executing && (
        <div className="progress-section">
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}>
              {Math.round(progress)}%
            </div>
          </div>
          <p className="progress-text">
            Processing: {currentGroup}
          </p>
        </div>
      )}

      {results && (
        <div className="results-section">
          <h4>Operation Results</h4>
          <div className="results-summary">
            <div className="summary-stat">
              <strong>Total Groups:</strong> {results.length}
            </div>
            <div className="summary-stat success">
              <strong>Successful:</strong> {successCount}
            </div>
            <div className="summary-stat failed">
              <strong>Failed:</strong> {failedCount}
            </div>
            <div className="summary-stat">
              <strong>Items Processed:</strong> {totalProcessed}
            </div>
          </div>

          <div className="results-details">
            {results.map((result) => (
              <div
                key={result.groupId}
                className={`result-item ${result.status}`}
              >
                <div className="result-header">
                  <span className={`status-icon ${result.status}`}>
                    {result.status === 'success' ? '✓' : '✗'}
                  </span>
                  <span className="group-name">{result.groupName}</span>
                  <span className="items-processed">
                    {result.itemsProcessed} item{result.itemsProcessed !== 1 ? 's' : ''}
                  </span>
                </div>
                {result.errors && result.errors.length > 0 && (
                  <div className="result-errors">
                    {result.errors.map((error, idx) => (
                      <div key={idx} className="error-message">
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
