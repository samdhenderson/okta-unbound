/**
 * AppBulkAssignment Component
 *
 * Interface for bulk assigning multiple groups to multiple apps.
 * Accepts IDs in comma-separated, newline-separated, or space-separated format.
 */

import React, { useState, useCallback, memo } from 'react';
import { parseIds, validateGroupId, validateAppId, formatValidationErrors } from '../../../shared/utils/validation';
import { useValidation, FieldError } from '../../hooks/useValidation';
import type { BulkAppAssignmentRequest, BulkAppAssignmentResult } from '../../../shared/types';

interface AppBulkAssignmentProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setResultMessage: (message: { text: string; type: 'info' | 'success' | 'warning' | 'error' } | null) => void;
  bulkAssignGroupsToApps: (request: BulkAppAssignmentRequest) => Promise<BulkAppAssignmentResult>;
}

const AppBulkAssignment: React.FC<AppBulkAssignmentProps> = memo(({
  isLoading,
  setIsLoading,
  setResultMessage,
  bulkAssignGroupsToApps,
}) => {
  const [groupIds, setGroupIds] = useState('');
  const [appIds, setAppIds] = useState('');
  const [priority, setPriority] = useState(0);
  const [results, setResults] = useState<BulkAppAssignmentResult | null>(null);

  const { errors, validate, setError, clearError, hasErrors } = useValidation();

  const validateInputs = useCallback((): { groupIds: string[]; appIds: string[] } | null => {
    // Parse and validate group IDs
    const parsedGroups = parseIds(groupIds, 'group');
    if (parsedGroups.valid.length === 0) {
      setError('groupIds', parsedGroups.errors.length > 0
        ? formatValidationErrors(parsedGroups.errors)
        : 'Enter at least one valid group ID (starts with 00g)');
      return null;
    }
    if (parsedGroups.invalid.length > 0) {
      setError('groupIds', `${parsedGroups.invalid.length} invalid IDs: ${parsedGroups.invalid.join(', ')}`);
      return null;
    }
    clearError('groupIds');

    // Parse and validate app IDs
    const parsedApps = parseIds(appIds, 'app');
    if (parsedApps.valid.length === 0) {
      setError('appIds', parsedApps.errors.length > 0
        ? formatValidationErrors(parsedApps.errors)
        : 'Enter at least one valid app ID (starts with 0oa)');
      return null;
    }
    if (parsedApps.invalid.length > 0) {
      setError('appIds', `${parsedApps.invalid.length} invalid IDs: ${parsedApps.invalid.join(', ')}`);
      return null;
    }
    clearError('appIds');

    return {
      groupIds: parsedGroups.valid,
      appIds: parsedApps.valid,
    };
  }, [groupIds, appIds, setError, clearError]);

  const handleSubmit = useCallback(async () => {
    const validated = validateInputs();
    if (!validated) return;

    setIsLoading(true);
    setResults(null);

    try {
      const request: BulkAppAssignmentRequest = {
        groupIds: validated.groupIds,
        appIds: validated.appIds,
        priority,
      };

      const result = await bulkAssignGroupsToApps(request);
      setResults(result);

      const message = `Bulk assignment complete: ${result.successful}/${result.totalOperations} succeeded`;
      setResultMessage({
        text: message,
        type: result.failed === 0 ? 'success' : result.successful > 0 ? 'warning' : 'error',
      });
    } catch (error: any) {
      setResultMessage({ text: `Bulk assignment failed: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [validateInputs, priority, bulkAssignGroupsToApps, setIsLoading, setResultMessage]);

  return (
    <div className="bulk-content">
      <h3>Bulk Group-to-App Assignment</h3>
      <p className="feature-description">
        Assign multiple groups to multiple apps in a single operation.
        Get IDs from Okta URLs or the Admin Console (Groups start with 00g, Apps start with 0oa).
      </p>

      <div className="form-group">
        <label htmlFor="bulkGroupIds">
          Group IDs
          <span className="tooltip-icon" title="Find group IDs in Okta Admin → Directory → Groups → click group → ID in URL (00g...)">?</span>
        </label>
        <textarea
          id="bulkGroupIds"
          value={groupIds}
          onChange={(e) => {
            setGroupIds(e.target.value);
            clearError('groupIds');
          }}
          placeholder="Paste group IDs, one per line or comma-separated&#10;Example: 00g1234567890abcdef"
          rows={3}
          className={errors.groupIds ? 'input-error' : ''}
        />
        <span className="input-hint">Group IDs start with "00g"</span>
        <FieldError error={errors.groupIds} />
      </div>

      <div className="form-group">
        <label htmlFor="bulkAppIds">
          App IDs
          <span className="tooltip-icon" title="Find app IDs in Okta Admin → Applications → click app → ID in URL (0oa...)">?</span>
        </label>
        <textarea
          id="bulkAppIds"
          value={appIds}
          onChange={(e) => {
            setAppIds(e.target.value);
            clearError('appIds');
          }}
          placeholder="Paste app IDs, one per line or comma-separated&#10;Example: 0oa1234567890abcdef"
          rows={3}
          className={errors.appIds ? 'input-error' : ''}
        />
        <span className="input-hint">App IDs start with "0oa"</span>
        <FieldError error={errors.appIds} />
      </div>

      <div className="form-group">
        <label htmlFor="bulkPriority">
          Priority
          <span className="tooltip-icon" title="Lower numbers = higher priority for group-based app access">?</span>
        </label>
        <input
          id="bulkPriority"
          type="number"
          value={priority}
          onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
          min={0}
        />
      </div>

      <button
        className="primary-button"
        onClick={handleSubmit}
        disabled={isLoading || !groupIds.trim() || !appIds.trim()}
      >
        {isLoading ? 'Assigning...' : 'Run Bulk Assignment'}
      </button>

      {/* Results */}
      {results && (
        <div className="bulk-results">
          <h4>Results</h4>
          <div className="results-summary">
            <div className={`summary-stat ${results.failed === 0 ? 'success' : 'warning'}`}>
              <span className="stat-value">{results.successful}</span>
              <span className="stat-label">Succeeded</span>
            </div>
            <div className={`summary-stat ${results.failed > 0 ? 'error' : ''}`}>
              <span className="stat-value">{results.failed}</span>
              <span className="stat-label">Failed</span>
            </div>
            <div className="summary-stat">
              <span className="stat-value">{results.totalOperations}</span>
              <span className="stat-label">Total</span>
            </div>
          </div>

          {results.results && results.results.length > 0 && (
            <div className="results-details">
              <details>
                <summary>View Details ({results.results.length} operations)</summary>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>App</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.map((r, idx) => (
                      <tr key={idx} className={r.success ? 'success' : 'error'}>
                        <td>{r.groupName || r.groupId}</td>
                        <td>{r.appName || r.appId}</td>
                        <td>
                          <span className={`status-badge ${r.success ? 'success' : 'error'}`}>
                            {r.success ? '✓' : '✗'}
                          </span>
                        </td>
                        <td>{r.error || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

AppBulkAssignment.displayName = 'AppBulkAssignment';

export default AppBulkAssignment;
