/**
 * AppBulkAssignment Component
 *
 * Interface for bulk assigning multiple groups to multiple apps.
 * Accepts IDs in comma-separated, newline-separated, or space-separated format.
 */

import React, { useState, useCallback, memo } from 'react';
import { parseIds, formatValidationErrors } from '../../../shared/utils/validation';
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

  const { errors, setError, clearError } = useValidation();

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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Bulk Group-to-App Assignment</h3>
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-50/30 rounded-lg border-l-4 border-[#007dc1]">
          <p className="text-sm text-gray-700 leading-relaxed">
            Assign multiple groups to multiple apps in a single operation.
            Get IDs from Okta URLs or the Admin Console (Groups start with 00g, Apps start with 0oa).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="bulkGroupIds" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            Group IDs
            <span
              className="inline-flex items-center justify-center w-4 h-4 bg-gray-200 rounded-full text-xs text-gray-600 cursor-help"
              title="Find group IDs in Okta Admin → Directory → Groups → click group → ID in URL (00g...)"
            >
              ?
            </span>
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
            className={`w-full px-4 py-3 bg-white border rounded-lg text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm ${
              errors.groupIds
                ? 'border-red-300 focus:ring-red-500/30 focus:border-red-500'
                : 'border-gray-200 focus:ring-[#007dc1]/30 focus:border-[#007dc1] hover:shadow'
            }`}
          />
          <span className="block mt-1.5 text-xs text-gray-500">Group IDs start with &quot;00g&quot;</span>
          <FieldError error={errors.groupIds} />
        </div>

        <div>
          <label htmlFor="bulkAppIds" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            App IDs
            <span
              className="inline-flex items-center justify-center w-4 h-4 bg-gray-200 rounded-full text-xs text-gray-600 cursor-help"
              title="Find app IDs in Okta Admin → Applications → click app → ID in URL (0oa...)"
            >
              ?
            </span>
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
            className={`w-full px-4 py-3 bg-white border rounded-lg text-sm font-mono placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm ${
              errors.appIds
                ? 'border-red-300 focus:ring-red-500/30 focus:border-red-500'
                : 'border-gray-200 focus:ring-[#007dc1]/30 focus:border-[#007dc1] hover:shadow'
            }`}
          />
          <span className="block mt-1.5 text-xs text-gray-500">App IDs start with &quot;0oa&quot;</span>
          <FieldError error={errors.appIds} />
        </div>

        <div>
          <label htmlFor="bulkPriority" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            Priority
            <span
              className="inline-flex items-center justify-center w-4 h-4 bg-gray-200 rounded-full text-xs text-gray-600 cursor-help"
              title="Lower numbers = higher priority for group-based app access"
            >
              ?
            </span>
          </label>
          <input
            id="bulkPriority"
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            min={0}
            className="w-24 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1] transition-all duration-200 shadow-sm hover:shadow"
          />
        </div>
      </div>

      <button
        className="w-full px-6 py-3 text-sm font-semibold bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200 shadow-md hover:shadow-lg disabled:from-blue-300 disabled:to-blue-400 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        onClick={handleSubmit}
        disabled={isLoading || !groupIds.trim() || !appIds.trim()}
      >
        {isLoading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Assigning...
          </>
        ) : (
          'Run Bulk Assignment'
        )}
      </button>

      {/* Results */}
      {results && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
            <h4 className="text-base font-semibold text-gray-900">Results</h4>
          </div>

          <div className="p-5 grid grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg border ${
              results.failed === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="text-2xl font-bold text-gray-900">{results.successful}</div>
              <div className="text-sm text-gray-600 mt-1">Succeeded</div>
            </div>
            <div className={`p-4 rounded-lg border ${
              results.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="text-2xl font-bold text-gray-900">{results.failed}</div>
              <div className="text-sm text-gray-600 mt-1">Failed</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-gray-900">{results.totalOperations}</div>
              <div className="text-sm text-gray-600 mt-1">Total</div>
            </div>
          </div>

          {results.results && results.results.length > 0 && (
            <div className="p-5 border-t border-gray-200">
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-[#007dc1] hover:text-[#005a8f] flex items-center gap-2">
                  <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  View Details ({results.results.length} operations)
                </summary>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Group</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">App</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {results.results.map((r, idx) => (
                        <tr
                          key={idx}
                          className={`transition-colors duration-150 ${
                            r.success ? 'hover:bg-emerald-50/30' : 'bg-red-50/30 hover:bg-red-50/50'
                          }`}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900">{r.groupName || r.groupId}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{r.appName || r.appId}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                r.success
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {r.success ? '✓' : '✗'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{r.error || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
