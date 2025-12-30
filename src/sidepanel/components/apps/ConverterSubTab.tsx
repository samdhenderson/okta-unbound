import React, { useState, useCallback, useEffect } from 'react';
import SearchDropdown from '../shared/SearchDropdown';
import Modal from '../shared/Modal';
import { useSearchWithDropdown } from '../../hooks/useSearchWithDropdown';
import type {
  UserAppAssignment,
  AssignmentConversionRequest,
  AssignmentConversionResult,
} from '../../../shared/types';

interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  login: string;
  status: string;
}

interface GroupItem {
  id: string;
  name: string;
  description: string;
  type: string;
}

type ConversionMode = 'user-to-group' | 'user-to-user';
type MergeStrategy = 'preserve_user' | 'prefer_user' | 'prefer_default';

interface PreviewData {
  appId: string;
  appName: string;
  userProfile: Record<string, unknown>;
  groupProfile: Record<string, unknown>;
  mergedProfile: Record<string, unknown>;
  differences: Array<{
    field: string;
    userValue: unknown;
    groupValue: unknown;
    mergedValue: unknown;
    fieldType: string;
  }>;
  warnings: string[];
}

interface ConverterSubTabProps {
  groupId?: string;
  groupName?: string;
  oktaApi: {
    searchUsers: (query: string) => Promise<UserItem[]>;
    searchGroups: (query: string) => Promise<GroupItem[]>;
    getUserApps: (userId: string, expand?: boolean) => Promise<UserAppAssignment[]>;
    previewConversion: (
      userId: string,
      groupId: string,
      appId: string
    ) => Promise<Omit<PreviewData, 'appId' | 'appName'>>;
    convertUserToGroupAssignment: (
      request: AssignmentConversionRequest
    ) => Promise<AssignmentConversionResult[]>;
    copyUserToUserAssignment: (
      sourceUserId: string,
      targetUserId: string,
      appIds: string[],
      mergeStrategy: MergeStrategy
    ) => Promise<AssignmentConversionResult[]>;
  };
  onResult: (message: { text: string; type: 'info' | 'success' | 'warning' | 'error' }) => void;
  onProgress?: (current: number, total: number, message: string) => void;
}

/**
 * Assignment Converter sub-tab.
 * 3-step wizard for converting user app assignments to group-based or copying to another user.
 */
const ConverterSubTab: React.FC<ConverterSubTabProps> = ({
  groupId,
  groupName,
  oktaApi,
  onResult,
}) => {
  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [conversionMode, setConversionMode] = useState<ConversionMode>('user-to-group');

  // Source user selection
  const sourceUserSearch = useSearchWithDropdown<UserItem>({
    searchFn: oktaApi.searchUsers,
    debounceMs: 300,
    minQueryLength: 2,
  });

  // Target group selection (for user-to-group mode)
  const groupSearch = useSearchWithDropdown<GroupItem>({
    searchFn: oktaApi.searchGroups,
    debounceMs: 300,
    minQueryLength: 2,
  });

  // Target user selection (for user-to-user mode)
  const targetUserSearch = useSearchWithDropdown<UserItem>({
    searchFn: oktaApi.searchUsers,
    debounceMs: 300,
    minQueryLength: 2,
  });

  // App selection state
  const [userApps, setUserApps] = useState<UserAppAssignment[]>([]);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);

  // Conversion options
  const [removeUserAssignment, setRemoveUserAssignment] = useState(true);
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>('prefer_user');

  // Update merge strategy default when mode changes
  useEffect(() => {
    if (conversionMode === 'user-to-user') {
      setMergeStrategy('preserve_user'); // Keep target's existing settings
    } else {
      setMergeStrategy('prefer_user'); // Copy user's profile to group
    }
  }, [conversionMode]);

  // Preview modal state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Conversion results
  const [conversionResults, setConversionResults] = useState<AssignmentConversionResult[]>([]);

  // Auto-set group when viewing a group page
  useEffect(() => {
    if (groupId && groupName && !groupSearch.selectedItem && conversionMode === 'user-to-group') {
      groupSearch.setSelectedItem({
        id: groupId,
        name: groupName,
        description: '',
        type: 'OKTA_GROUP',
      });
      groupSearch.setQuery(groupName);
    }
  }, [groupId, groupName, groupSearch, conversionMode]);

  // Clear inappropriate target selection when mode changes
  useEffect(() => {
    if (conversionMode === 'user-to-group') {
      targetUserSearch.clearSearch();
    } else {
      groupSearch.clearSearch();
    }
  }, [conversionMode, targetUserSearch, groupSearch]);

  // Load source user's apps when moving to step 2
  const loadUserApps = useCallback(async () => {
    if (!sourceUserSearch.selectedItem) {
      onResult({ text: 'Please select a source user first', type: 'warning' });
      return;
    }

    // Validate target selection based on mode
    if (conversionMode === 'user-to-group' && !groupSearch.selectedItem) {
      onResult({ text: 'Please select a target group', type: 'warning' });
      return;
    }

    if (conversionMode === 'user-to-user' && !targetUserSearch.selectedItem) {
      onResult({ text: 'Please select a target user', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const apps = await oktaApi.getUserApps(sourceUserSearch.selectedItem.id, true);
      setUserApps(apps);
      setSelectedAppIds([]);
      setStep(2);
      onResult({
        text: `Found ${apps.length} apps assigned to ${sourceUserSearch.selectedItem.firstName} ${sourceUserSearch.selectedItem.lastName}`,
        type: 'success',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load apps';
      onResult({ text: message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [sourceUserSearch.selectedItem, conversionMode, groupSearch.selectedItem, targetUserSearch.selectedItem, oktaApi, onResult]);

  // Preview a single app conversion
  const handlePreviewApp = useCallback(
    async (appId: string) => {
      if (!sourceUserSearch.selectedItem || !groupSearch.selectedItem) {
        onResult({ text: 'User and group are required for preview', type: 'warning' });
        return;
      }

      setIsLoading(true);
      try {
        const preview = await oktaApi.previewConversion(
          sourceUserSearch.selectedItem.id,
          groupSearch.selectedItem.id,
          appId
        );
        const app = userApps.find((a) => a.appId === appId);
        setPreviewData({
          appId,
          appName: app?._embedded?.app?.label || appId,
          ...preview,
        });
        setShowPreviewModal(true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Preview failed';
        onResult({ text: message, type: 'error' });
      } finally {
        setIsLoading(false);
      }
    },
    [sourceUserSearch.selectedItem, groupSearch.selectedItem, oktaApi, userApps, onResult]
  );

  // Run the conversion
  const runConverter = useCallback(async () => {
    // Validation based on mode
    if (!sourceUserSearch.selectedItem) {
      onResult({ text: 'Please select a source user', type: 'warning' });
      return;
    }

    if (conversionMode === 'user-to-group' && !groupSearch.selectedItem) {
      onResult({ text: 'Please select a target group', type: 'warning' });
      return;
    }

    if (conversionMode === 'user-to-user' && !targetUserSearch.selectedItem) {
      onResult({ text: 'Please select a target user', type: 'warning' });
      return;
    }

    if (selectedAppIds.length === 0) {
      onResult({ text: 'Please select apps to process', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      let results: AssignmentConversionResult[];

      if (conversionMode === 'user-to-group') {
        // User-to-Group conversion
        const request: AssignmentConversionRequest = {
          userId: sourceUserSearch.selectedItem.id,
          targetGroupId: groupSearch.selectedItem!.id,
          appIds: selectedAppIds,
          removeUserAssignment,
          mergeStrategy,
        };
        results = await oktaApi.convertUserToGroupAssignment(request);
      } else {
        // User-to-User copy
        results = await oktaApi.copyUserToUserAssignment(
          sourceUserSearch.selectedItem.id,
          targetUserSearch.selectedItem!.id,
          selectedAppIds,
          mergeStrategy
        );
      }

      setConversionResults(results);

      const successCount = results.filter((r) => r.success).length;
      onResult({
        text: `${conversionMode === 'user-to-group' ? 'Conversion' : 'Copy'} complete: ${successCount}/${results.length} apps processed`,
        type: successCount === results.length ? 'success' : 'warning',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Operation failed';
      onResult({ text: message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [
    sourceUserSearch.selectedItem,
    conversionMode,
    groupSearch.selectedItem,
    targetUserSearch.selectedItem,
    selectedAppIds,
    removeUserAssignment,
    mergeStrategy,
    oktaApi,
    onResult,
  ]);

  // Toggle app selection
  const toggleAppSelection = (appId: string) => {
    setSelectedAppIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
  };

  // Reset wizard
  const resetWizard = () => {
    setStep(1);
    setUserApps([]);
    setSelectedAppIds([]);
    setConversionResults([]);
    sourceUserSearch.clearSearch();
    groupSearch.clearSearch();
    targetUserSearch.clearSearch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {conversionMode === 'user-to-group'
            ? 'Convert User Assignments to Group Assignments'
            : 'Copy User Assignments to Another User'}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {conversionMode === 'user-to-group'
            ? "Convert a user's direct app assignments to group-based assignments. Ideal for scaling single-person departments into RBAC groups."
            : "Copy all app assignments from one user to another user. Useful for onboarding new team members with the same app access."}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                step >= s
                  ? 'bg-[#007dc1] text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                {s}
              </span>
              <span className="text-sm font-medium">
                {s === 1
                  ? conversionMode === 'user-to-group'
                    ? 'Select User & Group'
                    : 'Select Source & Target'
                  : s === 2
                  ? 'Select Apps'
                  : 'Configure & Convert'}
              </span>
            </div>
            {s < 3 && (
              <div className={`w-8 h-0.5 ${step > s ? 'bg-[#007dc1]' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Select User & Group/Target */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
          {/* Mode Selector */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">Conversion Mode</div>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  conversionMode === 'user-to-group'
                    ? 'border-[#007dc1] bg-[#007dc1]/5 ring-1 ring-[#007dc1]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="conversionMode"
                    checked={conversionMode === 'user-to-group'}
                    onChange={() => setConversionMode('user-to-group')}
                    className="mt-1 w-4 h-4 text-[#007dc1] border-gray-300 focus:ring-[#007dc1]"
                  />
                  <div>
                    <div className="font-medium text-gray-900">User → Group</div>
                    <div className="text-sm text-gray-500">Convert to group-based assignments</div>
                  </div>
                </div>
              </label>
              <label
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  conversionMode === 'user-to-user'
                    ? 'border-[#007dc1] bg-[#007dc1]/5 ring-1 ring-[#007dc1]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="conversionMode"
                    checked={conversionMode === 'user-to-user'}
                    onChange={() => setConversionMode('user-to-user')}
                    className="mt-1 w-4 h-4 text-[#007dc1] border-gray-300 focus:ring-[#007dc1]"
                  />
                  <div>
                    <div className="font-medium text-gray-900">User → User</div>
                    <div className="text-sm text-gray-500">Copy to another user</div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Source User Search */}
          <SearchDropdown<UserItem>
            label="Source User"
            hint={
              conversionMode === 'user-to-group'
                ? "The user whose direct app assignments you want to convert"
                : "The user whose app assignments you want to copy"
            }
            placeholder="Search by name or email..."
            query={sourceUserSearch.query}
            onQueryChange={sourceUserSearch.setQuery}
            isSearching={sourceUserSearch.isSearching}
            results={sourceUserSearch.results}
            showDropdown={sourceUserSearch.showDropdown}
            onSelect={sourceUserSearch.selectItem}
            selectedItem={sourceUserSearch.selectedItem}
            onClear={sourceUserSearch.clearSearch}
            renderResult={(user) => (
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      user.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {user.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">{user.email}</div>
                <div className="text-xs text-gray-400 font-mono">{user.id}</div>
              </div>
            )}
            renderSelected={(user) => (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#007dc1] to-[#3d9dd9] flex items-center justify-center text-white font-bold">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
                <span
                  className={`ml-auto text-xs px-2 py-1 rounded-full ${
                    user.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {user.status}
                </span>
              </div>
            )}
          />

          {/* Conditional: Group Search or Target User Search */}
          {conversionMode === 'user-to-group' ? (
            <SearchDropdown<GroupItem>
              label="Target Group"
              hint="All members of this group will receive the app assignments"
              placeholder="Search groups..."
              query={groupSearch.query}
              onQueryChange={groupSearch.setQuery}
              isSearching={groupSearch.isSearching}
              results={groupSearch.results}
              showDropdown={groupSearch.showDropdown}
              onSelect={groupSearch.selectItem}
              selectedItem={groupSearch.selectedItem}
              onClear={groupSearch.clearSearch}
              renderResult={(group) => (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{group.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {group.type.replace('_', ' ')}
                    </span>
                  </div>
                  {group.description && (
                    <div className="text-sm text-gray-500 truncate">{group.description}</div>
                  )}
                  <div className="text-xs text-gray-400 font-mono">{group.id}</div>
                </div>
              )}
              renderSelected={(group) => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{group.name}</div>
                    <div className="text-sm text-gray-500">{group.type.replace('_', ' ')}</div>
                  </div>
                </div>
              )}
            />
          ) : (
            <SearchDropdown<UserItem>
              label="Target User"
              hint="The user who will receive the copied app assignments"
              placeholder="Search by name or email..."
              query={targetUserSearch.query}
              onQueryChange={targetUserSearch.setQuery}
              isSearching={targetUserSearch.isSearching}
              results={targetUserSearch.results}
              showDropdown={targetUserSearch.showDropdown}
              onSelect={targetUserSearch.selectItem}
              selectedItem={targetUserSearch.selectedItem}
              onClear={targetUserSearch.clearSearch}
              renderResult={(user) => (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        user.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {user.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                  <div className="text-xs text-gray-400 font-mono">{user.id}</div>
                </div>
              )}
              renderSelected={(user) => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold">
                    {user.firstName[0]}
                    {user.lastName[0]}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                  <span
                    className={`ml-auto text-xs px-2 py-1 rounded-full ${
                      user.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {user.status}
                  </span>
                </div>
              )}
            />
          )}

          <button
            onClick={loadUserApps}
            disabled={
              isLoading ||
              !sourceUserSearch.selectedItem ||
              (conversionMode === 'user-to-group' ? !groupSearch.selectedItem : !targetUserSearch.selectedItem)
            }
            className="w-full px-6 py-3 bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white font-medium rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              "Load User's Apps"
            )}
          </button>
        </div>
      )}

      {/* Step 2: Select Apps */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-gray-900">
              Select Apps to Convert ({selectedAppIds.length} of {userApps.length})
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedAppIds(userApps.map((a) => a.appId))}
                className="text-sm text-[#007dc1] hover:text-[#005a8f] font-medium"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedAppIds([])}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
            {userApps.map((app) => {
              const isSelected = selectedAppIds.includes(app.appId);
              const hasComplexProfile =
                app.profile &&
                Object.values(app.profile).some(
                  (v) => Array.isArray(v) || (typeof v === 'object' && v !== null)
                );

              return (
                <div
                  key={app.id}
                  onClick={() => toggleAppSelection(app.appId)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#007dc1] bg-[#007dc1]/5 ring-1 ring-[#007dc1]'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-1 w-4 h-4 text-[#007dc1] border-gray-300 rounded focus:ring-[#007dc1]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {app._embedded?.app?.label || app.id}
                      </div>
                      <div className="flex gap-2 mt-1">
                        {app.profile && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {Object.keys(app.profile).length} attrs
                          </span>
                        )}
                        {hasComplexProfile && (
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                            Complex
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewApp(app.appId);
                      }}
                      disabled={!groupSearch.selectedItem}
                      className="text-xs text-[#007dc1] hover:text-[#005a8f] font-medium disabled:opacity-50"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedAppIds.length === 0}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white font-medium rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Configure Options
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configure & Convert */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
          <h4 className="text-base font-semibold text-gray-900">
            {conversionMode === 'user-to-group' ? 'Conversion Options' : 'Copy Options'}
          </h4>

          {/* Remove assignment option (only for user-to-group mode) */}
          {conversionMode === 'user-to-group' && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={removeUserAssignment}
                onChange={(e) => setRemoveUserAssignment(e.target.checked)}
                className="mt-1 w-4 h-4 text-[#007dc1] border-gray-300 rounded focus:ring-[#007dc1]"
              />
              <div>
                <div className="font-medium text-gray-900">
                  Remove user&apos;s direct assignment after conversion
                </div>
                <div className="text-sm text-gray-500">
                  If checked, the user will only have access through the group.
                </div>
              </div>
            </label>
          )}

          {/* Merge strategy (only for user-to-group mode) */}
          {conversionMode === 'user-to-group' && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-3">Profile Merge Strategy</div>
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    value: 'prefer_user' as MergeStrategy,
                    label: "Copy User's Profile (Recommended)",
                    desc: "Copy the user's profile attributes to the group. Arrays are merged.",
                  },
                  {
                    value: 'preserve_user' as MergeStrategy,
                    label: "Keep Group's Profile",
                    desc: "Don't change existing group profile. User may lose custom settings.",
                  },
                  {
                    value: 'prefer_default' as MergeStrategy,
                    label: 'Use Defaults',
                    desc: "Use the app's default profile settings. Good for standardizing.",
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      mergeStrategy === option.value
                        ? 'border-[#007dc1] bg-[#007dc1]/5 ring-1 ring-[#007dc1]'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="mergeStrategy"
                        checked={mergeStrategy === option.value}
                        onChange={() => setMergeStrategy(option.value)}
                        className="mt-1 w-4 h-4 text-[#007dc1] border-gray-300 focus:ring-[#007dc1]"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{option.label}</div>
                        <div className="text-sm text-gray-500">{option.desc}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Info box for user-to-user mode */}
          {conversionMode === 'user-to-user' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-medium text-blue-900 text-sm">How User-to-User Copy Works</div>
                  <div className="text-sm text-blue-700 mt-1">
                    Apps will be copied to the target user while preserving their existing settings. Personal information (email, name, etc.) is never copied.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h5 className="text-sm font-semibold text-gray-700 mb-2">
              {conversionMode === 'user-to-group' ? 'Conversion Summary' : 'Copy Summary'}
            </h5>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>
                {conversionMode === 'user-to-group' ? 'Converting' : 'Copying'}{' '}
                <span className="font-medium">{selectedAppIds.length}</span> app(s)
              </li>
              <li>
                From user:{' '}
                <span className="font-medium">
                  {sourceUserSearch.selectedItem?.firstName} {sourceUserSearch.selectedItem?.lastName}
                </span>
              </li>
              <li>
                {conversionMode === 'user-to-group' ? (
                  <>
                    To group: <span className="font-medium">{groupSearch.selectedItem?.name}</span>
                  </>
                ) : (
                  <>
                    To user:{' '}
                    <span className="font-medium">
                      {targetUserSearch.selectedItem?.firstName} {targetUserSearch.selectedItem?.lastName}
                    </span>
                  </>
                )}
              </li>
              <li>
                {conversionMode === 'user-to-group'
                  ? `User assignments will be ${removeUserAssignment ? 'removed' : 'kept'}`
                  : 'Source user assignments will be kept'}
              </li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all"
            >
              Back
            </button>
            <button
              onClick={runConverter}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white font-medium rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {conversionMode === 'user-to-group' ? 'Converting...' : 'Copying...'}
                </span>
              ) : (
                `${conversionMode === 'user-to-group' ? 'Convert' : 'Copy'} ${selectedAppIds.length} App(s)`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Conversion Results */}
      {conversionResults.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-gray-900">
              {conversionMode === 'user-to-group' ? 'Conversion Results' : 'Copy Results'}
            </h4>
            <button
              onClick={resetWizard}
              className="text-sm text-[#007dc1] hover:text-[#005a8f] font-medium"
            >
              {conversionMode === 'user-to-group' ? 'Start New Conversion' : 'Start New Copy'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">App</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Changes</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">User Removed</th>
                </tr>
              </thead>
              <tbody>
                {conversionResults.map((result, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-900">{result.appName}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          result.success
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {result.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-600">
                      {result.profileChanges?.differences.length || 0} field(s)
                    </td>
                    <td className="py-2 px-3">
                      {result.userAssignmentRemoved ? (
                        <span className="text-emerald-600">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={`Profile Preview: ${previewData?.appName}`}
        size="lg"
      >
        {previewData && (
          <div className="space-y-4">
            {previewData.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                {previewData.warnings.map((warning, idx) => (
                  <div key={idx} className="text-sm text-amber-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    {warning}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">User Profile</h5>
                <pre className="p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-48">
                  {JSON.stringify(previewData.userProfile, null, 2) || '(empty)'}
                </pre>
              </div>
              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Group Profile</h5>
                <pre className="p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-48">
                  {JSON.stringify(previewData.groupProfile, null, 2) || '(no existing)'}
                </pre>
              </div>
              <div>
                <h5 className="text-sm font-semibold text-emerald-700 mb-2">Merged Result</h5>
                <pre className="p-3 bg-emerald-50 rounded-lg text-xs overflow-auto max-h-48">
                  {JSON.stringify(previewData.mergedProfile, null, 2)}
                </pre>
              </div>
            </div>

            {previewData.differences.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-2">
                  Field Differences ({previewData.differences.length})
                </h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2">Field</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">User</th>
                        <th className="text-left py-2 px-2">Group</th>
                        <th className="text-left py-2 px-2">Merged</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.differences.map((diff, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-2 px-2 font-mono">{diff.field}</td>
                          <td className="py-2 px-2">
                            <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                              {diff.fieldType}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono text-blue-600">
                            {JSON.stringify(diff.userValue)}
                          </td>
                          <td className="py-2 px-2 font-mono text-gray-500">
                            {JSON.stringify(diff.groupValue)}
                          </td>
                          <td className="py-2 px-2 font-mono text-emerald-600">
                            {JSON.stringify(diff.mergedValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ConverterSubTab;
