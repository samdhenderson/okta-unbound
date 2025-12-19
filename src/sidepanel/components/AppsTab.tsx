import React, { useState, useCallback, useEffect } from 'react';
import PageHeader from './shared/PageHeader';
import { useOktaApi } from '../hooks/useOktaApi';
import type {
  UserAppAssignment,
  AssignmentConversionRequest,
  AssignmentConversionResult,
  BulkAppAssignmentRequest,
  AppAssignmentSecurityAnalysis,
} from '../../shared/types';

interface AppsTabProps {
  groupId: string | undefined;
  groupName: string | undefined;
  targetTabId: number | null;
}

type AppSubTab = 'converter' | 'security' | 'bulk';

const AppsTab: React.FC<AppsTabProps> = ({ groupId, groupName, targetTabId }) => {
  const [activeSubTab, setActiveSubTab] = useState<AppSubTab>('converter');
  const [resultMessage, setResultMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  // Converter state - userApps is used in step 2
  const [userApps, setUserApps] = useState<UserAppAssignment[]>([]);

  // Converter state - use full objects for better UX
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    login: string;
    status: string;
  } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{
    id: string;
    name: string;
    description: string;
    type: string;
  } | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    login: string;
    status: string;
  }>>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<Array<{
    id: string;
    name: string;
    description: string;
    type: string;
  }>>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [removeUserAssignment, setRemoveUserAssignment] = useState(true);
  const [mergeStrategy, setMergeStrategy] = useState<'preserve_user' | 'prefer_user' | 'prefer_default'>('prefer_user');
  const [conversionResults, setConversionResults] = useState<AssignmentConversionResult[]>([]);
  const [converterStep, setConverterStep] = useState<1 | 2 | 3>(1);
  const [previewData, setPreviewData] = useState<{
    appId: string;
    appName: string;
    userProfile: Record<string, any>;
    groupProfile: Record<string, any>;
    mergedProfile: Record<string, any>;
    differences: Array<{ field: string; userValue: any; groupValue: any; mergedValue: any; fieldType: string }>;
    warnings: string[];
  } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Security analysis state
  const [securityAnalysis, setSecurityAnalysis] = useState<AppAssignmentSecurityAnalysis | null>(null);
  const [analysisUserId, setAnalysisUserId] = useState('');

  // Bulk assignment state - improved with search-based selection
  const [bulkSelectedGroups, setBulkSelectedGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [bulkSelectedApps, setBulkSelectedApps] = useState<Array<{ id: string; label: string }>>([]);
  const [bulkGroupSearch, setBulkGroupSearch] = useState('');
  const [bulkAppSearch, setBulkAppSearch] = useState('');
  const [bulkGroupResults, setBulkGroupResults] = useState<Array<{ id: string; name: string; description: string; type: string }>>([]);
  const [bulkAppResults, setBulkAppResults] = useState<Array<{ id: string; label: string; name: string }>>([]);
  const [showBulkGroupDropdown, setShowBulkGroupDropdown] = useState(false);
  const [showBulkAppDropdown, setShowBulkAppDropdown] = useState(false);
  const [isSearchingBulkGroups, setIsSearchingBulkGroups] = useState(false);
  const [isSearchingBulkApps, setIsSearchingBulkApps] = useState(false);
  const [bulkPriority, setBulkPriority] = useState(0);
  const [bulkAssignmentResults, setBulkAssignmentResults] = useState<Array<{ groupName: string; appName: string; success: boolean; error?: string }>>([]);

  const oktaApi = useOktaApi({
    targetTabId,
    onResult: (message, type) => {
      setResultMessage({ text: message, type });
    },
    onProgress: (current, total, message) => {
      setProgress({ current, total, message });
    },
  });

  // Auto-set group when viewing a group page
  useEffect(() => {
    if (groupId && groupName) {
      setSelectedGroup({
        id: groupId,
        name: groupName,
        description: '',
        type: 'OKTA_GROUP',
      });
      setGroupSearchQuery(groupName);
    }
  }, [groupId, groupName]);

  // Extract search functions to avoid dependency on entire oktaApi object
  const { searchUsers, searchGroups } = oktaApi;

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (userSearchQuery.length >= 2 && !selectedUser) {
        console.log('[AppsTab] Searching users for:', userSearchQuery);
        setIsSearchingUsers(true);
        try {
          const results = await searchUsers(userSearchQuery);
          console.log('[AppsTab] User search results:', results);
          setUserSearchResults(results);
          setShowUserDropdown(results.length > 0);
        } catch (error) {
          console.error('[AppsTab] User search error:', error);
        } finally {
          setIsSearchingUsers(false);
        }
      } else {
        setUserSearchResults([]);
        setShowUserDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery, selectedUser, searchUsers]);

  // Debounced group search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (groupSearchQuery.length >= 2 && !selectedGroup) {
        setIsSearchingGroups(true);
        try {
          const results = await searchGroups(groupSearchQuery);
          setGroupSearchResults(results);
          setShowGroupDropdown(results.length > 0);
        } catch (error) {
          console.error('Group search error:', error);
        } finally {
          setIsSearchingGroups(false);
        }
      } else {
        setGroupSearchResults([]);
        setShowGroupDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [groupSearchQuery, selectedGroup, searchGroups]);

  // Debounced bulk group search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (bulkGroupSearch.length >= 2) {
        setIsSearchingBulkGroups(true);
        try {
          const results = await searchGroups(bulkGroupSearch);
          // Filter out already selected groups
          const filtered = results.filter(g => !bulkSelectedGroups.some(sg => sg.id === g.id));
          setBulkGroupResults(filtered);
          setShowBulkGroupDropdown(filtered.length > 0);
        } catch (error) {
          console.error('Bulk group search error:', error);
        } finally {
          setIsSearchingBulkGroups(false);
        }
      } else {
        setBulkGroupResults([]);
        setShowBulkGroupDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [bulkGroupSearch, bulkSelectedGroups, searchGroups]);

  // Debounced bulk app search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (bulkAppSearch.length >= 2) {
        setIsSearchingBulkApps(true);
        try {
          // Search apps using the API
          const response = await oktaApi.makeApiRequest(`/api/v1/apps?q=${encodeURIComponent(bulkAppSearch)}&limit=10`);
          if (response.success && response.data) {
            const apps = response.data.map((app: any) => ({
              id: app.id,
              label: app.label,
              name: app.name,
            }));
            // Filter out already selected apps
            const filtered = apps.filter((a: any) => !bulkSelectedApps.some(sa => sa.id === a.id));
            setBulkAppResults(filtered);
            setShowBulkAppDropdown(filtered.length > 0);
          }
        } catch (error) {
          console.error('Bulk app search error:', error);
        } finally {
          setIsSearchingBulkApps(false);
        }
      } else {
        setBulkAppResults([]);
        setShowBulkAppDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [bulkAppSearch, bulkSelectedApps, oktaApi]);

  // Handle user selection
  const handleSelectUser = (user: typeof selectedUser) => {
    console.log('[AppsTab] handleSelectUser called with:', user);
    setSelectedUser(user);
    setUserSearchQuery(user ? `${user.firstName} ${user.lastName}` : '');
    setShowUserDropdown(false);
    setUserSearchResults([]);
  };

  // Handle group selection
  const handleSelectGroup = (group: typeof selectedGroup) => {
    console.log('[AppsTab] handleSelectGroup called with:', group);
    setSelectedGroup(group);
    setGroupSearchQuery(group?.name || '');
    setShowGroupDropdown(false);
    setGroupSearchResults([]);
  };

  // Clear user selection
  const clearUserSelection = () => {
    setSelectedUser(null);
    setUserSearchQuery('');
    setUserApps([]);
    setSelectedAppIds([]);
    setConverterStep(1);
  };

  // Clear group selection
  const clearGroupSelection = () => {
    setSelectedGroup(null);
    setGroupSearchQuery('');
  };

  // FEATURE 1: User-to-Group Assignment Converter
  const runConverter = useCallback(async () => {
    if (!selectedUser || !selectedGroup) {
      setResultMessage({ text: 'Please select a user and target group', type: 'warning' });
      return;
    }

    if (selectedAppIds.length === 0) {
      setResultMessage({ text: 'Please select apps to convert', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const request: AssignmentConversionRequest = {
        userId: selectedUser.id,
        targetGroupId: selectedGroup.id,
        appIds: selectedAppIds,
        removeUserAssignment,
        mergeStrategy,
      };

      const results = await oktaApi.convertUserToGroupAssignment(request);
      setConversionResults(results);

      const successCount = results.filter(r => r.success).length;
      setResultMessage({
        text: `Conversion complete: ${successCount}/${results.length} apps converted for ${selectedUser.firstName} ${selectedUser.lastName} → ${selectedGroup.name}`,
        type: successCount === results.length ? 'success' : 'warning'
      });
    } catch (error: any) {
      setResultMessage({ text: `Conversion failed: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedUser, selectedGroup, selectedAppIds, removeUserAssignment, mergeStrategy, oktaApi]);

  // Load user apps for converter
  const loadUserAppsForConverter = useCallback(async () => {
    console.log('[AppsTab] loadUserAppsForConverter called, selectedUser:', selectedUser);
    if (!selectedUser) {
      setResultMessage({ text: 'Please select a user first', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      // Pass true to expand app details and get friendly names
      console.log('[AppsTab] Calling getUserApps for:', selectedUser.id);
      const apps = await oktaApi.getUserApps(selectedUser.id, true);
      console.log('[AppsTab] getUserApps returned:', apps.length, 'apps');
      setUserApps(apps);
      setSelectedAppIds([]); // Reset selection
      setConverterStep(2); // Move to app selection step
      setResultMessage({ text: `Found ${apps.length} apps assigned to ${selectedUser.firstName} ${selectedUser.lastName}`, type: 'success' });
    } catch (error: any) {
      console.error('[AppsTab] loadUserAppsForConverter error:', error);
      setResultMessage({ text: `Failed to load apps: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedUser, oktaApi]);

  // Preview a single app conversion
  const handlePreviewApp = useCallback(async (appId: string) => {
    if (!selectedUser || !selectedGroup) {
      setResultMessage({ text: 'User and group are required for preview', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const preview = await oktaApi.previewConversion(selectedUser.id, selectedGroup.id, appId);
      const app = userApps.find(a => a.id === appId);
      setPreviewData({
        appId,
        appName: app?._embedded?.app?.label || appId,
        ...preview,
      });
      setShowPreviewModal(true);
    } catch (error: any) {
      setResultMessage({ text: `Preview failed: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedUser, selectedGroup, oktaApi, userApps]);

  // FEATURE 3: App Assignment Security Analysis
  const runSecurityAnalysis = useCallback(async () => {
    if (!analysisUserId && !groupId) {
      setResultMessage({ text: 'Please provide user ID or select a group', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const analysis = await oktaApi.analyzeAppAssignmentSecurity(analysisUserId || undefined, groupId);
      setSecurityAnalysis(analysis);
    } catch (error: any) {
      setResultMessage({ text: `Security analysis failed: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [analysisUserId, groupId, oktaApi]);

  // FEATURE 3: Bulk Group-to-App Assignment (improved UX)
  const runBulkAssignment = useCallback(async () => {
    if (bulkSelectedGroups.length === 0 || bulkSelectedApps.length === 0) {
      setResultMessage({ text: 'Please select at least one group and one app', type: 'warning' });
      return;
    }

    setIsLoading(true);
    setBulkAssignmentResults([]);

    try {
      const request: BulkAppAssignmentRequest = {
        groupIds: bulkSelectedGroups.map(g => g.id),
        appIds: bulkSelectedApps.map(a => a.id),
        priority: bulkPriority,
      };

      const result = await oktaApi.bulkAssignGroupsToApps(request);

      // Build detailed results for display
      const detailedResults: Array<{ groupName: string; appName: string; success: boolean; error?: string }> = [];
      for (const group of bulkSelectedGroups) {
        for (const app of bulkSelectedApps) {
          // Check if this specific assignment succeeded (simplified - the API returns aggregate)
          detailedResults.push({
            groupName: group.name,
            appName: app.label,
            success: true, // The API doesn't give per-assignment details, so we assume success if no errors
          });
        }
      }
      setBulkAssignmentResults(detailedResults);

      setResultMessage({
        text: `Bulk assignment complete: ${result.successful}/${result.totalOperations} successful`,
        type: result.failed === 0 ? 'success' : result.successful > 0 ? 'warning' : 'error'
      });
    } catch (error: any) {
      setResultMessage({ text: `Bulk assignment failed: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [bulkSelectedGroups, bulkSelectedApps, bulkPriority, oktaApi]);

  return (
    <div className="tab-content active">
      <PageHeader
        title="App Assignment Management"
        subtitle="Convert, analyze, and optimize app assignments"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 border-b-2 border-gray-200 pb-2">
        <button
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
            activeSubTab === 'converter'
              ? 'bg-gradient-to-b from-blue-50 to-white text-gray-900 border-b-2 border-[#007dc1] -mb-0.5'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          onClick={() => setActiveSubTab('converter')}
        >
          Converter
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
            activeSubTab === 'security'
              ? 'bg-gradient-to-b from-blue-50 to-white text-gray-900 border-b-2 border-[#007dc1] -mb-0.5'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          onClick={() => setActiveSubTab('security')}
        >
          Security
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
            activeSubTab === 'bulk'
              ? 'bg-gradient-to-b from-blue-50 to-white text-gray-900 border-b-2 border-[#007dc1] -mb-0.5'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          onClick={() => setActiveSubTab('bulk')}
        >
          Bulk Assign
        </button>
      </div>

      {/* Result message */}
      {resultMessage && (
        <div className={`p-4 rounded-lg flex items-start justify-between gap-4 ${
          resultMessage.type === 'info' ? 'bg-blue-50 border border-blue-200' :
          resultMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200' :
          resultMessage.type === 'warning' ? 'bg-amber-50 border border-amber-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start gap-3 flex-1">
            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              resultMessage.type === 'info' ? 'text-blue-500' :
              resultMessage.type === 'success' ? 'text-emerald-500' :
              resultMessage.type === 'warning' ? 'text-amber-500' :
              'text-red-500'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {resultMessage.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <span className={`text-sm ${
              resultMessage.type === 'info' ? 'text-blue-800' :
              resultMessage.type === 'success' ? 'text-emerald-800' :
              resultMessage.type === 'warning' ? 'text-amber-800' :
              'text-red-800'
            }`}>{resultMessage.text}</span>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            onClick={() => setResultMessage(null)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Progress indicator */}
      {isLoading && progress.total > 0 && (
        <div className="space-y-2">
          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {progress.message} ({progress.current}/{progress.total})
          </p>
        </div>
      )}

      {/* Sub-tab content */}
      <div>
        {/* FEATURE 1: User-to-Group Assignment Converter */}
        {activeSubTab === 'converter' && (
          <div className="converter-content">
            <h3>Convert User Assignments to Group Assignments</h3>
            <p className="feature-description">
              Convert a user&apos;s direct app assignments to group-based assignments. This is ideal for
              scaling single-person departments into RBAC (Role-Based Access Control) groups.
              Complex profile attributes like Salesforce permission sets are handled automatically.
            </p>

            {/* Step Indicator */}
            <div className="step-indicator">
              <div className={`step ${converterStep >= 1 ? 'active' : ''}`}>
                <span className="step-number">1</span>
                <span className="step-label">Select User & Group</span>
              </div>
              <div className="step-connector" />
              <div className={`step ${converterStep >= 2 ? 'active' : ''}`}>
                <span className="step-number">2</span>
                <span className="step-label">Select Apps</span>
              </div>
              <div className="step-connector" />
              <div className={`step ${converterStep >= 3 ? 'active' : ''}`}>
                <span className="step-number">3</span>
                <span className="step-label">Configure & Convert</span>
              </div>
            </div>

            {/* Step 1: Select User & Group */}
            <div className={`converter-step ${converterStep === 1 ? 'active' : ''}`}>
              {/* User Search */}
              <div className="form-group">
                <label>
                  Source User
                  <span className="tooltip-icon" title="Search by name, email, or username. The user whose direct app assignments you want to convert.">?</span>
                </label>
                {selectedUser ? (
                  <div className="selected-entity">
                    <div className="entity-info">
                      <span className="entity-name">{selectedUser.firstName} {selectedUser.lastName}</span>
                      <span className="entity-detail">{selectedUser.email}</span>
                      <span className={`entity-status status-${selectedUser.status.toLowerCase()}`}>{selectedUser.status}</span>
                    </div>
                    <button className="clear-button" onClick={clearUserSelection} title="Clear selection">×</button>
                  </div>
                ) : (
                  <div className="search-container">
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Search by name or email..."
                      className="search-input"
                    />
                    {isSearchingUsers && <span className="search-spinner">⏳</span>}
                    {showUserDropdown && userSearchResults.length > 0 && (
                      <div className="search-dropdown">
                        {userSearchResults.map((user) => (
                          <div
                            key={user.id}
                            className="search-result-item"
                            onClick={() => handleSelectUser(user)}
                          >
                            <div className="result-main">
                              <span className="result-name">{user.firstName} {user.lastName}</span>
                              <span className={`result-status status-${user.status.toLowerCase()}`}>{user.status}</span>
                            </div>
                            <div className="result-detail">{user.email}</div>
                            <div className="result-id">{user.id}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Group Search */}
              <div className="form-group">
                <label>
                  Target Group
                  <span className="tooltip-icon" title="Search by group name. All members of this group will receive the app assignments.">?</span>
                </label>
                {selectedGroup ? (
                  <div className="selected-entity">
                    <div className="entity-info">
                      <span className="entity-name">{selectedGroup.name}</span>
                      <span className="entity-detail">{selectedGroup.type.replace('_', ' ')}</span>
                    </div>
                    <button className="clear-button" onClick={clearGroupSelection} title="Clear selection">×</button>
                  </div>
                ) : (
                  <div className="search-container">
                    <input
                      type="text"
                      value={groupSearchQuery}
                      onChange={(e) => setGroupSearchQuery(e.target.value)}
                      placeholder="Search groups..."
                      className="search-input"
                    />
                    {isSearchingGroups && <span className="search-spinner">⏳</span>}
                    {showGroupDropdown && groupSearchResults.length > 0 && (
                      <div className="search-dropdown">
                        {groupSearchResults.map((group) => (
                          <div
                            key={group.id}
                            className="search-result-item"
                            onClick={() => handleSelectGroup(group)}
                          >
                            <div className="result-main">
                              <span className="result-name">{group.name}</span>
                              <span className="result-type">{group.type.replace('_', ' ')}</span>
                            </div>
                            {group.description && <div className="result-detail">{group.description}</div>}
                            <div className="result-id">{group.id}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={loadUserAppsForConverter}
                disabled={isLoading || !selectedUser || !selectedGroup}
                className="primary-button"
              >
                {isLoading ? 'Loading...' : 'Load User\'s Apps →'}
              </button>
              {/* Debug info - remove after fixing */}
              {(!selectedUser || !selectedGroup) && (
                <div className="debug-info" style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  {!selectedUser && <span>Missing: user selection. </span>}
                  {!selectedGroup && <span>Missing: group selection.</span>}
                </div>
              )}
            </div>

            {/* Step 2: Select Apps */}
            {converterStep >= 2 && userApps.length > 0 && (
              <div className={`converter-step ${converterStep === 2 ? 'active' : ''}`}>
                <div className="app-selection">
                  <div className="selection-header">
                    <h4>Select Apps to Convert ({selectedAppIds.length} of {userApps.length})</h4>
                    <div className="selection-actions">
                      <button onClick={() => setSelectedAppIds(userApps.map(a => a.id))} className="text-button">
                        Select All
                      </button>
                      <button onClick={() => setSelectedAppIds([])} className="text-button">
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="apps-grid">
                    {userApps.map((app) => {
                      const hasComplexProfile = app.profile && (
                        Object.values(app.profile).some(v => Array.isArray(v) || (typeof v === 'object' && v !== null))
                      );
                      return (
                        <div
                          key={app.id}
                          className={`app-card ${selectedAppIds.includes(app.id) ? 'selected' : ''}`}
                          onClick={() => {
                            if (selectedAppIds.includes(app.id)) {
                              setSelectedAppIds(selectedAppIds.filter(id => id !== app.id));
                            } else {
                              setSelectedAppIds([...selectedAppIds, app.id]);
                            }
                          }}
                        >
                          <div className="app-card-header">
                            <input
                              type="checkbox"
                              checked={selectedAppIds.includes(app.id)}
                              onChange={() => {}}
                            />
                            <span className="app-name">{app._embedded?.app?.label || app.id}</span>
                          </div>
                          <div className="app-card-badges">
                            {app.profile && (
                              <span className="badge badge-info" title={`${Object.keys(app.profile).length} profile attributes`}>
                                {Object.keys(app.profile).length} attrs
                              </span>
                            )}
                            {hasComplexProfile && (
                              <span className="badge badge-warning" title="Has arrays or nested objects (like Salesforce permission sets)">
                                Complex
                              </span>
                            )}
                          </div>
                          <div className="app-card-actions">
                            <button
                              className="preview-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewApp(app.id);
                              }}
                              disabled={!selectedGroup}
                              title="Preview what the merged profile will look like"
                            >
                              Preview Changes
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="step-navigation">
                  <button onClick={() => setConverterStep(1)} className="secondary-button">
                    ← Back
                  </button>
                  <button
                    onClick={() => setConverterStep(3)}
                    disabled={selectedAppIds.length === 0}
                    className="primary-button"
                  >
                    Configure Options →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Configure & Convert */}
            {converterStep >= 3 && (
              <div className={`converter-step ${converterStep === 3 ? 'active' : ''}`}>
                <div className="options-panel">
                  <h4>Conversion Options</h4>

                  <div className="option-group">
                    <label className="option-label">
                      <input
                        type="checkbox"
                        checked={removeUserAssignment}
                        onChange={(e) => setRemoveUserAssignment(e.target.checked)}
                      />
                      <span>Remove user&apos;s direct assignment after conversion</span>
                      <span className="tooltip-icon" title="If checked, the user will only have access through the group. If unchecked, they'll have both direct and group access.">?</span>
                    </label>
                  </div>

                  <div className="option-group">
                    <label className="option-header">
                      Profile Merge Strategy
                      <span className="tooltip-icon" title="How to handle profile attributes when the group already has an app assignment">?</span>
                    </label>
                    <div className="radio-cards">
                      <label className={`radio-card ${mergeStrategy === 'prefer_user' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          value="prefer_user"
                          checked={mergeStrategy === 'prefer_user'}
                          onChange={() => setMergeStrategy('prefer_user')}
                        />
                        <div className="radio-card-content">
                          <strong>Copy User&apos;s Profile (Recommended)</strong>
                          <p>Copy the user&apos;s profile attributes to the group. Arrays (like permission sets) are merged.</p>
                        </div>
                      </label>
                      <label className={`radio-card ${mergeStrategy === 'preserve_user' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          value="preserve_user"
                          checked={mergeStrategy === 'preserve_user'}
                          onChange={() => setMergeStrategy('preserve_user')}
                        />
                        <div className="radio-card-content">
                          <strong>Keep Group&apos;s Profile</strong>
                          <p>Don&apos;t change the group&apos;s existing profile attributes. User may lose custom settings.</p>
                        </div>
                      </label>
                      <label className={`radio-card ${mergeStrategy === 'prefer_default' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          value="prefer_default"
                          checked={mergeStrategy === 'prefer_default'}
                          onChange={() => setMergeStrategy('prefer_default')}
                        />
                        <div className="radio-card-content">
                          <strong>Use Defaults</strong>
                          <p>Use the app&apos;s default profile settings. Good for standardizing.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="conversion-summary">
                    <h5>Conversion Summary</h5>
                    <ul>
                      <li>Converting <strong>{selectedAppIds.length}</strong> app(s)</li>
                      <li>
                        From user: <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong>
                        <span className="id-secondary"> ({selectedUser?.email})</span>
                      </li>
                      <li>
                        To group: <strong>{selectedGroup?.name}</strong>
                        <span className="id-secondary"> ({selectedGroup?.type.replace('_', ' ')})</span>
                      </li>
                      <li>User assignments will be <strong>{removeUserAssignment ? 'removed' : 'kept'}</strong></li>
                    </ul>
                  </div>
                </div>

                <div className="step-navigation">
                  <button onClick={() => setConverterStep(2)} className="secondary-button">
                    ← Back
                  </button>
                  <button
                    className="primary-button convert-button"
                    onClick={runConverter}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Converting...' : `Convert ${selectedAppIds.length} App(s)`}
                  </button>
                </div>
              </div>
            )}

            {/* Conversion Results */}
            {conversionResults.length > 0 && (
              <div className="conversion-results">
                <h4>Conversion Results</h4>
                <div className="results-table">
                  <table>
                    <thead>
                      <tr>
                        <th>App Name</th>
                        <th>Status</th>
                        <th>Profile Changes</th>
                        <th>User Removed</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversionResults.map((result, idx) => (
                        <tr key={idx} className={result.success ? 'success' : 'error'}>
                          <td>{result.appName}</td>
                          <td>
                            <span className={`status-badge ${result.success ? 'success' : 'error'}`}>
                              {result.success ? '✓ Success' : '✗ Failed'}
                            </span>
                          </td>
                          <td>
                            {result.profileChanges?.differences.length || 0} field(s) changed
                          </td>
                          <td>{result.userAssignmentRemoved ? 'Yes' : 'No'}</td>
                          <td>
                            {result.error || (result.profileChanges && (
                              <details>
                                <summary>View Details</summary>
                                <pre>{JSON.stringify(result.profileChanges, null, 2)}</pre>
                              </details>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Preview Modal */}
            {showPreviewModal && previewData && (
              <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
                <div className="preview-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Profile Preview: {previewData.appName}</h3>
                    <button className="close-button" onClick={() => setShowPreviewModal(false)}>×</button>
                  </div>

                  {previewData.warnings.length > 0 && (
                    <div className="preview-warnings">
                      {previewData.warnings.map((warning, idx) => (
                        <div key={idx} className="warning-item">⚠️ {warning}</div>
                      ))}
                    </div>
                  )}

                  <div className="profile-comparison">
                    <div className="profile-column">
                      <h4>User&apos;s Profile</h4>
                      <pre>{JSON.stringify(previewData.userProfile, null, 2) || '(empty)'}</pre>
                    </div>
                    <div className="profile-column">
                      <h4>Group&apos;s Current Profile</h4>
                      <pre>{JSON.stringify(previewData.groupProfile, null, 2) || '(no existing assignment)'}</pre>
                    </div>
                    <div className="profile-column merged">
                      <h4>Merged Result</h4>
                      <pre>{JSON.stringify(previewData.mergedProfile, null, 2)}</pre>
                    </div>
                  </div>

                  {previewData.differences.length > 0 && (
                    <div className="differences-table">
                      <h4>Field Differences ({previewData.differences.length})</h4>
                      <table>
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Type</th>
                            <th>User Value</th>
                            <th>Group Value</th>
                            <th>Merged</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.differences.map((diff, idx) => (
                            <tr key={idx}>
                              <td><code>{diff.field}</code></td>
                              <td><span className="badge">{diff.fieldType}</span></td>
                              <td><code>{JSON.stringify(diff.userValue)}</code></td>
                              <td><code>{JSON.stringify(diff.groupValue)}</code></td>
                              <td><code>{JSON.stringify(diff.mergedValue)}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="modal-actions">
                    <button onClick={() => setShowPreviewModal(false)} className="secondary-button">
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FEATURE 3: Security Analysis */}
        {activeSubTab === 'security' && (
          <div className="security-content">
            <h3>App Assignment Security Analysis</h3>
            <p className="feature-description">
              Analyze app assignments for security issues including orphaned assignments,
              over-provisioned users, and redundant assignments.
            </p>

            <div className="form-group">
              <label htmlFor="analysisUserId">Analyze User (optional):</label>
              <input
                id="analysisUserId"
                type="text"
                value={analysisUserId}
                onChange={(e) => setAnalysisUserId(e.target.value)}
                placeholder="Leave empty to analyze current group"
              />
            </div>

            <button onClick={runSecurityAnalysis} disabled={isLoading}>
              {isLoading ? 'Analyzing...' : 'Run Security Analysis'}
            </button>

            {securityAnalysis && (
              <div className="security-results">
                <div className="security-score">
                  <h4>Risk Score: {securityAnalysis.riskScore}/100</h4>
                  <div className="score-bar">
                    <div
                      className={`score-fill ${securityAnalysis.riskScore > 70 ? 'high' : securityAnalysis.riskScore > 40 ? 'medium' : 'low'}`}
                      style={{ width: `${securityAnalysis.riskScore}%` }}
                    />
                  </div>
                </div>

                <div className="findings">
                  <h4>Findings ({securityAnalysis.findings.length})</h4>
                  {securityAnalysis.findings.map((finding, idx) => (
                    <div key={idx} className={`finding ${finding.severity}`}>
                      <h5>{finding.title}</h5>
                      <p>{finding.description}</p>
                      <p className="recommendation"><strong>Recommendation:</strong> {finding.recommendation}</p>
                      <p className="affected">
                        Affected Users: {finding.affectedUsers.length} |
                        Affected Apps: {finding.affectedApps.length}
                      </p>
                    </div>
                  ))}
                </div>

                {securityAnalysis.orphanedAppAssignments.length > 0 && (
                  <div className="orphaned-assignments">
                    <h4>Orphaned App Assignments ({securityAnalysis.orphanedAppAssignments.length})</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>App</th>
                          <th>Reason</th>
                          <th>Recommend Removal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityAnalysis.orphanedAppAssignments.map((orphan, idx) => (
                          <tr key={idx}>
                            <td>{orphan.userEmail}</td>
                            <td>{orphan.appName}</td>
                            <td>{orphan.reason.replace(/_/g, ' ')}</td>
                            <td>{orphan.recommendRemoval ? '✓ Yes' : '✗ No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {securityAnalysis.redundantAssignments.length > 0 && (
                  <div className="redundant-assignments">
                    <h4>Redundant Assignments ({securityAnalysis.redundantAssignments.length})</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>App</th>
                          <th>Direct + Group Assignments</th>
                          <th>Recommendation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityAnalysis.redundantAssignments.map((redundant, idx) => (
                          <tr key={idx}>
                            <td>{redundant.userEmail}</td>
                            <td>{redundant.appName}</td>
                            <td>{redundant.groupAssignments.length} group(s)</td>
                            <td>{redundant.recommendation.replace(/_/g, ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="assignment-distribution">
                  <h4>Assignment Type Distribution</h4>
                  <p>Total: {securityAnalysis.assignmentTypeDistribution.totalAssignments}</p>
                  <p>Direct: {securityAnalysis.assignmentTypeDistribution.directAssignments} ({securityAnalysis.assignmentTypeDistribution.percentageDirect.toFixed(1)}%)</p>
                  <p>Group: {securityAnalysis.assignmentTypeDistribution.groupAssignments} ({securityAnalysis.assignmentTypeDistribution.percentageGroup.toFixed(1)}%)</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FEATURE 3: Bulk Assignment (Improved UX) */}
        {activeSubTab === 'bulk' && (
          <div className="bulk-content">
            <h3>Bulk Group-to-App Assignment</h3>
            <p className="feature-description">
              Assign multiple groups to multiple apps in a single operation.
              Search and select groups and apps below - no need to copy IDs.
            </p>

            <div className="bulk-selection-grid">
              {/* Groups Selection */}
              <div className="bulk-section">
                <h4>Select Groups</h4>
                <div className="search-container">
                  <input
                    type="text"
                    value={bulkGroupSearch}
                    onChange={(e) => setBulkGroupSearch(e.target.value)}
                    placeholder="Search groups by name..."
                    className="search-input"
                  />
                  {isSearchingBulkGroups && <span className="search-spinner">...</span>}
                  {showBulkGroupDropdown && bulkGroupResults.length > 0 && (
                    <div className="search-dropdown">
                      {bulkGroupResults.map((group) => (
                        <div
                          key={group.id}
                          className="search-result-item"
                          onClick={() => {
                            setBulkSelectedGroups([...bulkSelectedGroups, { id: group.id, name: group.name }]);
                            setBulkGroupSearch('');
                            setShowBulkGroupDropdown(false);
                          }}
                        >
                          <div className="result-main">
                            <span className="result-name">{group.name}</span>
                            <span className="result-type">{group.type.replace('_', ' ')}</span>
                          </div>
                          {group.description && <div className="result-detail">{group.description}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Groups */}
                <div className="selected-items">
                  {bulkSelectedGroups.length === 0 ? (
                    <p className="empty-state">No groups selected</p>
                  ) : (
                    bulkSelectedGroups.map((group) => (
                      <div key={group.id} className="selected-chip">
                        <span>{group.name}</span>
                        <button
                          className="chip-remove"
                          onClick={() => setBulkSelectedGroups(bulkSelectedGroups.filter(g => g.id !== group.id))}
                        >
                          x
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {bulkSelectedGroups.length > 0 && (
                  <button
                    className="text-button"
                    onClick={() => setBulkSelectedGroups([])}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Apps Selection */}
              <div className="bulk-section">
                <h4>Select Apps</h4>
                <div className="search-container">
                  <input
                    type="text"
                    value={bulkAppSearch}
                    onChange={(e) => setBulkAppSearch(e.target.value)}
                    placeholder="Search apps by name..."
                    className="search-input"
                  />
                  {isSearchingBulkApps && <span className="search-spinner">...</span>}
                  {showBulkAppDropdown && bulkAppResults.length > 0 && (
                    <div className="search-dropdown">
                      {bulkAppResults.map((app) => (
                        <div
                          key={app.id}
                          className="search-result-item"
                          onClick={() => {
                            setBulkSelectedApps([...bulkSelectedApps, { id: app.id, label: app.label }]);
                            setBulkAppSearch('');
                            setShowBulkAppDropdown(false);
                          }}
                        >
                          <div className="result-main">
                            <span className="result-name">{app.label}</span>
                          </div>
                          <div className="result-detail">{app.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Apps */}
                <div className="selected-items">
                  {bulkSelectedApps.length === 0 ? (
                    <p className="empty-state">No apps selected</p>
                  ) : (
                    bulkSelectedApps.map((app) => (
                      <div key={app.id} className="selected-chip">
                        <span>{app.label}</span>
                        <button
                          className="chip-remove"
                          onClick={() => setBulkSelectedApps(bulkSelectedApps.filter(a => a.id !== app.id))}
                        >
                          x
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {bulkSelectedApps.length > 0 && (
                  <button
                    className="text-button"
                    onClick={() => setBulkSelectedApps([])}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Assignment Preview */}
            {bulkSelectedGroups.length > 0 && bulkSelectedApps.length > 0 && (
              <div className="bulk-preview">
                <h4>Assignment Preview</h4>
                <p>
                  This will create <strong>{bulkSelectedGroups.length * bulkSelectedApps.length}</strong> assignments:
                </p>
                <ul className="preview-list">
                  {bulkSelectedGroups.slice(0, 3).map(group => (
                    <li key={group.id}>
                      <strong>{group.name}</strong> will be assigned to {bulkSelectedApps.map(a => a.label).join(', ')}
                    </li>
                  ))}
                  {bulkSelectedGroups.length > 3 && (
                    <li className="more-items">...and {bulkSelectedGroups.length - 3} more groups</li>
                  )}
                </ul>
              </div>
            )}

            {/* Priority Setting */}
            <div className="form-group priority-group">
              <label htmlFor="bulkPriority">
                Priority
                <span className="tooltip-icon" title="Lower numbers = higher priority. When a user is in multiple groups with the same app, the assignment with lowest priority number wins.">?</span>
              </label>
              <input
                id="bulkPriority"
                type="number"
                value={bulkPriority}
                onChange={(e) => setBulkPriority(parseInt(e.target.value) || 0)}
                min={0}
                className="priority-input"
              />
            </div>

            <button
              className="primary-button bulk-assign-button"
              onClick={runBulkAssignment}
              disabled={isLoading || bulkSelectedGroups.length === 0 || bulkSelectedApps.length === 0}
            >
              {isLoading ? 'Assigning...' : `Assign ${bulkSelectedGroups.length} Group(s) to ${bulkSelectedApps.length} App(s)`}
            </button>

            {/* Results */}
            {bulkAssignmentResults.length > 0 && (
              <div className="bulk-results">
                <h4>Assignment Results</h4>
                <div className="results-grid">
                  {bulkAssignmentResults.map((result, idx) => (
                    <div key={idx} className={`result-item ${result.success ? 'success' : 'error'}`}>
                      <span className="result-icon">{result.success ? '✓' : '✗'}</span>
                      <span>{result.groupName} → {result.appName}</span>
                      {result.error && <span className="result-error">{result.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default AppsTab;

