import React, { useState, useCallback } from 'react';
import SearchDropdown from '../shared/SearchDropdown';
import SelectionChips from '../shared/SelectionChips';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import type { BulkAppAssignmentRequest } from '../../../shared/types';

interface GroupItem {
  id: string;
  name: string;
  description?: string;
  type: string;
}

interface AppItem {
  id: string;
  label: string;
  name: string;
}

interface BulkAssignSubTabProps {
  groupId?: string;
  groupName?: string;
  oktaApi: {
    searchGroups: (query: string) => Promise<GroupItem[]>;
    makeApiRequest: (endpoint: string) => Promise<{ success: boolean; data?: unknown }>;
    bulkAssignGroupsToApps: (request: BulkAppAssignmentRequest) => Promise<{
      successful: number;
      failed: number;
      totalOperations: number;
    }>;
  };
  onResult: (message: { text: string; type: 'info' | 'success' | 'warning' | 'error' }) => void;
}

interface AssignmentResult {
  groupName: string;
  appName: string;
  success: boolean;
  error?: string;
}

/**
 * Bulk assignment sub-tab for the Apps page.
 * Allows assigning multiple groups to multiple apps.
 */
const BulkAssignSubTab: React.FC<BulkAssignSubTabProps> = ({
  groupId,
  groupName,
  oktaApi,
  onResult,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [bulkPriority, setBulkPriority] = useState(0);
  const [assignmentResults, setAssignmentResults] = useState<AssignmentResult[]>([]);

  // Search function for apps
  const searchApps = useCallback(async (query: string): Promise<AppItem[]> => {
    const response = await oktaApi.makeApiRequest(
      `/api/v1/apps?q=${encodeURIComponent(query)}&limit=10`
    );
    if (response.success && response.data) {
      return (response.data as Array<{ id: string; label: string; name: string }>).map((app) => ({
        id: app.id,
        label: app.label,
        name: app.name,
      }));
    }
    return [];
  }, [oktaApi]);

  // Group selection with search
  const groupSelection = useBulkSelection<GroupItem>({
    searchFn: oktaApi.searchGroups,
    getItemId: (g) => g.id,
  });

  // App selection with search
  const appSelection = useBulkSelection<AppItem>({
    searchFn: searchApps,
    getItemId: (a) => a.id,
  });

  // Pre-populate with current group if available
  React.useEffect(() => {
    if (groupId && groupName && !groupSelection.hasItem(groupId)) {
      groupSelection.addItem({
        id: groupId,
        name: groupName,
        type: 'OKTA_GROUP',
      });
    }
  }, [groupId, groupName, groupSelection]);

  const runBulkAssignment = useCallback(async () => {
    const selectedGroups = groupSelection.selectedItems;
    const selectedApps = appSelection.selectedItems;

    if (selectedGroups.length === 0 || selectedApps.length === 0) {
      onResult({ text: 'Please select at least one group and one app', type: 'warning' });
      return;
    }

    setIsLoading(true);
    setAssignmentResults([]);

    try {
      const request: BulkAppAssignmentRequest = {
        groupIds: selectedGroups.map((g) => g.id),
        appIds: selectedApps.map((a) => a.id),
        priority: bulkPriority,
      };

      const result = await oktaApi.bulkAssignGroupsToApps(request);

      // Build results for display
      const results: AssignmentResult[] = [];
      for (const group of selectedGroups) {
        for (const app of selectedApps) {
          results.push({
            groupName: group.name,
            appName: app.label,
            success: true,
          });
        }
      }
      setAssignmentResults(results);

      onResult({
        text: `Bulk assignment complete: ${result.successful}/${result.totalOperations} successful`,
        type: result.failed === 0 ? 'success' : result.successful > 0 ? 'warning' : 'error',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bulk assignment failed';
      onResult({ text: message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [groupSelection.selectedItems, appSelection.selectedItems, bulkPriority, oktaApi, onResult]);

  const totalAssignments = groupSelection.selectedItems.length * appSelection.selectedItems.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Bulk Group-to-App Assignment</h3>
        <p className="text-sm text-gray-600 mt-1">
          Assign multiple groups to multiple apps in a single operation.
          Search and select groups and apps below.
        </p>
      </div>

      {/* Selection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Groups Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h4 className="text-base font-semibold text-gray-900 mb-4">Select Groups</h4>

          <SearchDropdown<GroupItem>
            placeholder="Search groups by name..."
            query={groupSelection.searchQuery}
            onQueryChange={groupSelection.setSearchQuery}
            isSearching={groupSelection.isSearching}
            results={groupSelection.searchResults}
            showDropdown={groupSelection.showDropdown}
            onSelect={groupSelection.addItem}
            renderResult={(group) => (
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{group.name}</span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {group.type.replace('_', ' ')}
                  </span>
                </div>
                {group.description && (
                  <div className="text-sm text-gray-500 mt-1 truncate">{group.description}</div>
                )}
              </div>
            )}
          />

          <div className="mt-4">
            <SelectionChips<GroupItem>
              items={groupSelection.selectedItems}
              getKey={(g) => g.id}
              getLabel={(g) => g.name}
              onRemove={(g) => groupSelection.removeItem(g.id)}
              onClearAll={groupSelection.clearAll}
              emptyMessage="No groups selected"
            />
          </div>
        </div>

        {/* Apps Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h4 className="text-base font-semibold text-gray-900 mb-4">Select Apps</h4>

          <SearchDropdown<AppItem>
            placeholder="Search apps by name..."
            query={appSelection.searchQuery}
            onQueryChange={appSelection.setSearchQuery}
            isSearching={appSelection.isSearching}
            results={appSelection.searchResults}
            showDropdown={appSelection.showDropdown}
            onSelect={appSelection.addItem}
            renderResult={(app) => (
              <div>
                <div className="font-medium text-gray-900">{app.label}</div>
                <div className="text-sm text-gray-500">{app.name}</div>
              </div>
            )}
          />

          <div className="mt-4">
            <SelectionChips<AppItem>
              items={appSelection.selectedItems}
              getKey={(a) => a.id}
              getLabel={(a) => a.label}
              onRemove={(a) => appSelection.removeItem(a.id)}
              onClearAll={appSelection.clearAll}
              emptyMessage="No apps selected"
            />
          </div>
        </div>
      </div>

      {/* Assignment Preview */}
      {totalAssignments > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Assignment Preview</h4>
          <p className="text-sm text-blue-800">
            This will create <span className="font-bold">{totalAssignments}</span> assignment(s):
          </p>
          <ul className="mt-2 space-y-1 text-sm text-blue-700">
            {groupSelection.selectedItems.slice(0, 3).map((group) => (
              <li key={group.id} className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">-</span>
                <span>
                  <span className="font-medium">{group.name}</span> will be assigned to{' '}
                  {appSelection.selectedItems.map((a) => a.label).join(', ')}
                </span>
              </li>
            ))}
            {groupSelection.selectedItems.length > 3 && (
              <li className="text-blue-600 italic">
                ...and {groupSelection.selectedItems.length - 3} more group(s)
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Priority Setting */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label htmlFor="bulkPriority" className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <input
              id="bulkPriority"
              type="number"
              value={bulkPriority}
              onChange={(e) => setBulkPriority(parseInt(e.target.value) || 0)}
              min={0}
              className="w-24 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007dc1]/30 focus:border-[#007dc1]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lower numbers = higher priority. When a user is in multiple groups with the same app,
              the assignment with lowest priority number wins.
            </p>
          </div>

          <button
            onClick={runBulkAssignment}
            disabled={isLoading || totalAssignments === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white font-medium rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Assigning...
              </span>
            ) : (
              `Assign ${groupSelection.selectedItems.length} Group(s) to ${appSelection.selectedItems.length} App(s)`
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {assignmentResults.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h4 className="text-base font-semibold text-gray-900 mb-4">Assignment Results</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assignmentResults.map((result, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border flex items-center gap-2 ${
                  result.success
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {result.success ? (
                  <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {result.groupName}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    → {result.appName}
                  </div>
                  {result.error && (
                    <div className="text-xs text-red-600 mt-1">{result.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkAssignSubTab;
