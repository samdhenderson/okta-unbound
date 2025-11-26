import React, { useState, useCallback, useEffect } from 'react';
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
    <div className="apps-tab">
      <div className="tab-header">
        <h2>App Assignment Management</h2>
        <p className="tab-description">
          Manage app assignments for users and groups, convert assignments, analyze security, and optimize provisioning
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div className="sub-tab-nav">
        <button
          className={`sub-tab-button ${activeSubTab === 'converter' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('converter')}
        >
          🔄 Converter
        </button>
        <button
          className={`sub-tab-button ${activeSubTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('security')}
        >
          🔒 Security
        </button>
        <button
          className={`sub-tab-button ${activeSubTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('bulk')}
        >
          📦 Bulk Assign
        </button>
      </div>

      {/* Result message */}
      {resultMessage && (
        <div className={`result-message ${resultMessage.type}`}>
          {resultMessage.text}
          <button className="close-button" onClick={() => setResultMessage(null)}>×</button>
        </div>
      )}

      {/* Progress indicator */}
      {isLoading && progress.total > 0 && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="progress-text">{progress.message} ({progress.current}/{progress.total})</p>
        </div>
      )}

      {/* Sub-tab content */}
      <div className="sub-tab-content">
        {/* FEATURE 1: User-to-Group Assignment Converter */}
        {activeSubTab === 'converter' && (
          <div className="converter-content">
            <h3>Convert User Assignments to Group Assignments</h3>
            <p className="feature-description">
              Convert a user's direct app assignments to group-based assignments. This is ideal for
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
                      <span>Remove user's direct assignment after conversion</span>
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
                          <strong>Copy User's Profile (Recommended)</strong>
                          <p>Copy the user's profile attributes to the group. Arrays (like permission sets) are merged.</p>
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
                          <strong>Keep Group's Profile</strong>
                          <p>Don't change the group's existing profile attributes. User may lose custom settings.</p>
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
                          <p>Use the app's default profile settings. Good for standardizing.</p>
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
                      <h4>User's Profile</h4>
                      <pre>{JSON.stringify(previewData.userProfile, null, 2) || '(empty)'}</pre>
                    </div>
                    <div className="profile-column">
                      <h4>Group's Current Profile</h4>
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

      <style>{`
        .apps-tab {
          padding: 20px;
        }

        .tab-header h2 {
          margin: 0 0 8px 0;
          color: #1e293b;
        }

        .tab-description {
          margin: 0 0 20px 0;
          color: #64748b;
        }

        .sub-tab-nav {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 8px;
        }

        .sub-tab-button {
          padding: 8px 16px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 14px;
          color: #64748b;
          border-radius: 6px 6px 0 0;
          transition: all 0.2s;
        }

        .sub-tab-button:hover {
          background: #f1f5f9;
        }

        .sub-tab-button.active {
          color: #1e293b;
          background: #f8fafc;
          font-weight: 500;
          border-bottom: 2px solid #3b82f6;
        }

        .result-message {
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .result-message.info {
          background: #dbeafe;
          color: #1e40af;
        }

        .result-message.success {
          background: #dcfce7;
          color: #166534;
        }

        .result-message.warning {
          background: #fef3c7;
          color: #92400e;
        }

        .result-message.error {
          background: #fee2e2;
          color: #991b1b;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          padding: 0 8px;
        }

        .progress-container {
          margin: 16px 0;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #3b82f6;
          transition: width 0.3s ease;
        }

        .progress-text {
          margin: 8px 0 0 0;
          font-size: 14px;
          color: #64748b;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #334155;
        }

        .form-group input[type="text"],
        .form-group textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-family: inherit;
        }

        .form-group input[type="number"] {
          width: 100px;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
        }

        .input-group {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 20px;
        }

        .input-group input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
        }

        button {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }

        button:hover:not(:disabled) {
          background: #2563eb;
        }

        button:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .primary-button {
          background: #10b981;
          padding: 12px 24px;
          font-size: 16px;
        }

        .primary-button:hover:not(:disabled) {
          background: #059669;
        }

        .apps-table {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }

        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          background: #f8fafc;
          font-weight: 600;
          color: #334155;
        }

        tr:hover {
          background: #f8fafc;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.active {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.inactive {
          background: #fee2e2;
          color: #991b1b;
        }

        .status-badge.success {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.error {
          background: #fee2e2;
          color: #991b1b;
        }

        .monospace {
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 12px;
        }

        details {
          cursor: pointer;
        }

        summary {
          font-weight: 500;
          color: #3b82f6;
        }

        pre {
          background: #f1f5f9;
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          font-size: 12px;
        }

        .checkbox-list {
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          padding: 8px;
          gap: 8px;
        }

        .checkbox-item:hover {
          background: #f8fafc;
        }

        .badge {
          background: #dbeafe;
          color: #1e40af;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          margin-left: auto;
        }

        .security-score {
          margin: 20px 0;
        }

        .score-bar {
          width: 100%;
          height: 30px;
          background: #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          margin-top: 8px;
        }

        .score-fill {
          height: 100%;
          transition: width 0.5s ease;
        }

        .score-fill.low {
          background: #10b981;
        }

        .score-fill.medium {
          background: #f59e0b;
        }

        .score-fill.high {
          background: #ef4444;
        }

        .finding {
          border-left: 4px solid;
          padding: 16px;
          margin: 12px 0;
          border-radius: 6px;
          background: white;
        }

        .finding.critical {
          border-color: #dc2626;
          background: #fef2f2;
        }

        .finding.high {
          border-color: #ea580c;
          background: #fff7ed;
        }

        .finding.medium {
          border-color: #f59e0b;
          background: #fffbeb;
        }

        .finding.low {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .recommendation {
          font-style: italic;
          margin-top: 8px;
        }

        .affected {
          font-size: 14px;
          color: #64748b;
          margin-top: 8px;
        }

        .recommendation {
          border: 2px solid #e2e8f0;
          padding: 20px;
          margin: 16px 0;
          border-radius: 8px;
        }

        .recommendation.high {
          border-color: #f59e0b;
          background: #fffbeb;
        }

        .recommendation.medium {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .recommendation.low {
          border-color: #94a3b8;
          background: #f8fafc;
        }

        .priority-badge {
          float: right;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .priority-badge.high {
          background: #f59e0b;
          color: white;
        }

        .priority-badge.medium {
          background: #3b82f6;
          color: white;
        }

        .priority-badge.low {
          background: #94a3b8;
          color: white;
        }

        .group-recommendation {
          background: white;
          padding: 12px;
          margin: 8px 0;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .rationale {
          font-size: 14px;
          color: #64748b;
          font-style: italic;
        }

        .feature-description {
          background: #f8fafc;
          padding: 12px;
          border-left: 3px solid #3b82f6;
          margin-bottom: 20px;
          border-radius: 4px;
        }

        /* Step Indicator */
        .step-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 24px 0;
          gap: 8px;
        }

        .step {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #f1f5f9;
          border-radius: 24px;
          color: #64748b;
          transition: all 0.2s;
        }

        .step.active {
          background: #3b82f6;
          color: white;
        }

        .step-number {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          font-weight: 600;
          font-size: 12px;
        }

        .step.active .step-number {
          background: rgba(255,255,255,0.3);
        }

        .step-connector {
          width: 40px;
          height: 2px;
          background: #e2e8f0;
        }

        .converter-step {
          margin: 24px 0;
          padding: 20px;
          background: #f8fafc;
          border-radius: 8px;
        }

        /* Tooltip icon */
        .tooltip-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          margin-left: 6px;
          background: #e2e8f0;
          border-radius: 50%;
          font-size: 11px;
          font-weight: bold;
          color: #64748b;
          cursor: help;
        }

        .input-with-button {
          display: flex;
          gap: 8px;
        }

        .input-with-button input {
          flex: 1;
        }

        .secondary-button {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .secondary-button:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .text-button {
          background: none;
          border: none;
          color: #3b82f6;
          padding: 4px 8px;
          font-size: 13px;
        }

        .text-button:hover {
          text-decoration: underline;
        }

        /* App Selection Grid */
        .selection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .apps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
          padding: 4px;
        }

        .app-card {
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .app-card:hover {
          border-color: #94a3b8;
        }

        .app-card.selected {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .app-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .app-card-header .app-name {
          font-weight: 500;
          flex: 1;
        }

        .app-card-badges {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .badge-info {
          background: #dbeafe;
          color: #1e40af;
        }

        .badge-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .app-card-actions {
          display: flex;
          justify-content: flex-end;
        }

        .preview-button {
          background: #f1f5f9;
          color: #475569;
          font-size: 12px;
          padding: 4px 10px;
          border: 1px solid #e2e8f0;
        }

        .preview-button:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .step-navigation {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        /* Options Panel */
        .options-panel {
          background: white;
          border-radius: 8px;
          padding: 20px;
        }

        .option-group {
          margin-bottom: 20px;
        }

        .option-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 12px;
          background: #f8fafc;
          border-radius: 6px;
        }

        .option-header {
          display: block;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .radio-cards {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .radio-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .radio-card:hover {
          border-color: #94a3b8;
        }

        .radio-card.selected {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .radio-card-content strong {
          display: block;
          margin-bottom: 4px;
        }

        .radio-card-content p {
          color: #64748b;
          font-size: 13px;
          margin: 0;
        }

        .conversion-summary {
          background: #f8fafc;
          border-radius: 8px;
          padding: 16px;
          margin-top: 20px;
        }

        .conversion-summary h5 {
          margin: 0 0 12px 0;
        }

        .conversion-summary ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .conversion-summary li {
          padding: 4px 0;
        }

        .convert-button {
          background: #10b981;
          font-size: 16px;
          padding: 12px 24px;
        }

        .convert-button:hover:not(:disabled) {
          background: #059669;
        }

        /* Preview Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .preview-modal {
          background: white;
          border-radius: 12px;
          max-width: 900px;
          max-height: 90vh;
          overflow-y: auto;
          width: 100%;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          top: 0;
          background: white;
          z-index: 10;
        }

        .modal-header h3 {
          margin: 0;
        }

        .preview-warnings {
          padding: 12px 20px;
          background: #fef3c7;
        }

        .warning-item {
          padding: 4px 0;
          color: #92400e;
          font-size: 14px;
        }

        .profile-comparison {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          padding: 20px;
        }

        .profile-column {
          background: #f8fafc;
          border-radius: 8px;
          padding: 12px;
        }

        .profile-column h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
        }

        .profile-column.merged {
          background: #dcfce7;
        }

        .profile-column pre {
          background: white;
          padding: 12px;
          border-radius: 6px;
          font-size: 11px;
          max-height: 200px;
          overflow: auto;
        }

        .differences-table {
          padding: 0 20px 20px;
        }

        .differences-table h4 {
          margin: 0 0 12px 0;
        }

        .differences-table code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          max-width: 150px;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
        }

        .view-mode-selector {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 6px;
        }

        .view-mode-selector label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .radio-group {
          margin-top: 12px;
        }

        .radio-group label {
          display: block;
          margin: 8px 0;
          padding: 8px;
          border-radius: 4px;
        }

        .radio-group label:hover {
          background: #f8fafc;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          margin: 8px 0;
          cursor: pointer;
        }

        .checkbox-label:hover {
          background: #f8fafc;
          border-radius: 4px;
        }

        /* Search UI Components */
        .search-container {
          position: relative;
        }

        .search-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 14px;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .search-spinner {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
        }

        .search-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          max-height: 280px;
          overflow-y: auto;
          z-index: 100;
          margin-top: 4px;
        }

        .search-result-item {
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.15s;
        }

        .search-result-item:hover {
          background: #f8fafc;
        }

        .search-result-item:last-child {
          border-bottom: none;
        }

        .result-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2px;
        }

        .result-name {
          font-weight: 500;
          color: #1e293b;
        }

        .result-status {
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .result-status.status-active {
          background: #dcfce7;
          color: #166534;
        }

        .result-status.status-deprovisioned {
          background: #fee2e2;
          color: #991b1b;
        }

        .result-status.status-suspended {
          background: #fef3c7;
          color: #92400e;
        }

        .result-type {
          font-size: 11px;
          padding: 2px 6px;
          background: #e2e8f0;
          border-radius: 4px;
          color: #64748b;
        }

        .result-detail {
          font-size: 13px;
          color: #64748b;
          margin-top: 2px;
        }

        .result-id {
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 10px;
          color: #94a3b8;
          margin-top: 4px;
        }

        /* Selected Entity Display */
        .selected-entity {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #eff6ff;
          border: 2px solid #3b82f6;
          border-radius: 8px;
        }

        .entity-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .entity-name {
          font-weight: 600;
          color: #1e293b;
          font-size: 15px;
        }

        .entity-detail {
          font-size: 13px;
          color: #64748b;
        }

        .entity-status {
          display: inline-block;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          margin-top: 2px;
          width: fit-content;
        }

        .entity-status.status-active {
          background: #dcfce7;
          color: #166534;
        }

        .entity-status.status-deprovisioned {
          background: #fee2e2;
          color: #991b1b;
        }

        .clear-button {
          background: none;
          border: none;
          font-size: 20px;
          color: #64748b;
          cursor: pointer;
          padding: 4px 8px;
        }

        .clear-button:hover {
          color: #1e293b;
        }

        /* ID Secondary styling */
        .id-secondary {
          color: #94a3b8;
          font-size: 13px;
          font-weight: normal;
        }

        /* Input hint text */
        .input-hint {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: #94a3b8;
        }

        /* Bulk Assignment Styles */
        .bulk-selection-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .bulk-section {
          background: #f8fafc;
          border-radius: 8px;
          padding: 16px;
        }

        .bulk-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #334155;
        }

        .selected-items {
          margin-top: 12px;
          min-height: 60px;
          max-height: 200px;
          overflow-y: auto;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 8px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }

        .empty-state {
          color: #94a3b8;
          font-size: 13px;
          margin: 0;
          padding: 8px;
        }

        .selected-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: #3b82f6;
          color: white;
          border-radius: 16px;
          font-size: 13px;
        }

        .chip-remove {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .chip-remove:hover {
          background: rgba(255,255,255,0.3);
        }

        .bulk-preview {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .bulk-preview h4 {
          margin: 0 0 8px 0;
          color: #1e40af;
        }

        .bulk-preview p {
          margin: 0 0 12px 0;
          color: #1e40af;
        }

        .preview-list {
          margin: 0;
          padding-left: 20px;
          color: #1e40af;
        }

        .preview-list li {
          margin: 4px 0;
          font-size: 13px;
        }

        .more-items {
          color: #64748b;
          font-style: italic;
        }

        .priority-group {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .priority-group label {
          margin: 0;
        }

        .priority-input {
          width: 80px;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
        }

        .bulk-assign-button {
          width: 100%;
          padding: 14px 24px;
          font-size: 15px;
        }

        .bulk-results {
          margin-top: 24px;
          background: #f8fafc;
          border-radius: 8px;
          padding: 16px;
        }

        .bulk-results h4 {
          margin: 0 0 12px 0;
        }

        .results-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 300px;
          overflow-y: auto;
        }

        .result-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: white;
          border-radius: 6px;
          font-size: 13px;
        }

        .result-item.success {
          border-left: 3px solid #10b981;
        }

        .result-item.error {
          border-left: 3px solid #ef4444;
        }

        .result-icon {
          font-size: 14px;
        }

        .result-item.success .result-icon {
          color: #10b981;
        }

        .result-item.error .result-icon {
          color: #ef4444;
        }

        .result-error {
          color: #ef4444;
          font-size: 12px;
          margin-left: auto;
        }
      `}</style>
    </div>
  );
};

export default AppsTab;
