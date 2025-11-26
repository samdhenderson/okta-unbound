/**
 * AppConverter Component
 *
 * Wizard-style interface for converting user app assignments to group assignments.
 * Handles complex profile attributes (like Salesforce permission sets) with
 * deep merge capabilities and preview functionality.
 *
 * Steps:
 * 1. Select source user and target group
 * 2. Select which apps to convert
 * 3. Configure options and execute conversion
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import type {
  SelectedUser,
  SelectedGroup,
  ConversionPreviewData,
  MergeStrategy,
  UserAppAssignment,
  AssignmentConversionResult,
} from './types';
import type { AssignmentConversionRequest } from '../../../shared/types';

interface AppConverterProps {
  groupId?: string;
  groupName?: string;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setResultMessage: (message: { text: string; type: 'info' | 'success' | 'warning' | 'error' } | null) => void;
  // API functions passed from parent
  searchUsers: (query: string) => Promise<SelectedUser[]>;
  searchGroups: (query: string) => Promise<SelectedGroup[]>;
  getUserApps: (userId: string) => Promise<UserAppAssignment[]>;
  previewConversion: (userId: string, groupId: string, appId: string) => Promise<any>;
  convertUserToGroupAssignment: (request: AssignmentConversionRequest) => Promise<AssignmentConversionResult[]>;
}

type ConverterStep = 1 | 2 | 3;

const AppConverter: React.FC<AppConverterProps> = memo(({
  groupId,
  groupName,
  isLoading,
  setIsLoading,
  setResultMessage,
  searchUsers,
  searchGroups,
  getUserApps,
  previewConversion,
  convertUserToGroupAssignment,
}) => {
  // User/Group selection state
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<SelectedUser[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<SelectedGroup[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);

  // App selection state
  const [userApps, setUserApps] = useState<UserAppAssignment[]>([]);
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);

  // Conversion options
  const [removeUserAssignment, setRemoveUserAssignment] = useState(true);
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>('prefer_user');

  // Results and preview
  const [conversionResults, setConversionResults] = useState<AssignmentConversionResult[]>([]);
  const [converterStep, setConverterStep] = useState<ConverterStep>(1);
  const [previewData, setPreviewData] = useState<ConversionPreviewData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

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

  // Debounced user search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (userSearchQuery.length >= 2 && !selectedUser) {
        setIsSearchingUsers(true);
        try {
          const results = await searchUsers(userSearchQuery);
          setUserSearchResults(results);
          setShowUserDropdown(results.length > 0);
        } catch (error) {
          console.error('User search error:', error);
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

  // Handlers
  const handleSelectUser = useCallback((user: SelectedUser) => {
    setSelectedUser(user);
    setUserSearchQuery(`${user.firstName} ${user.lastName}`);
    setShowUserDropdown(false);
    setUserSearchResults([]);
  }, []);

  const handleSelectGroup = useCallback((group: SelectedGroup) => {
    setSelectedGroup(group);
    setGroupSearchQuery(group.name);
    setShowGroupDropdown(false);
    setGroupSearchResults([]);
  }, []);

  const clearUserSelection = useCallback(() => {
    setSelectedUser(null);
    setUserSearchQuery('');
    setUserApps([]);
    setSelectedAppIds([]);
    setConverterStep(1);
  }, []);

  const clearGroupSelection = useCallback(() => {
    setSelectedGroup(null);
    setGroupSearchQuery('');
  }, []);

  const loadUserAppsForConverter = useCallback(async () => {
    if (!selectedUser) {
      setResultMessage({ text: 'Please select a user first', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const apps = await getUserApps(selectedUser.id);
      setUserApps(apps);
      setSelectedAppIds([]);
      setConverterStep(2);
      setResultMessage({
        text: `Found ${apps.length} apps assigned to ${selectedUser.firstName} ${selectedUser.lastName}`,
        type: 'success'
      });
    } catch (error: any) {
      setResultMessage({ text: `Failed to load apps: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedUser, getUserApps, setIsLoading, setResultMessage]);

  const handlePreviewApp = useCallback(async (appId: string) => {
    if (!selectedUser || !selectedGroup) {
      setResultMessage({ text: 'User and group are required for preview', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const preview = await previewConversion(selectedUser.id, selectedGroup.id, appId);
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
  }, [selectedUser, selectedGroup, previewConversion, userApps, setIsLoading, setResultMessage]);

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

      const results = await convertUserToGroupAssignment(request);
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
  }, [selectedUser, selectedGroup, selectedAppIds, removeUserAssignment, mergeStrategy, convertUserToGroupAssignment, setIsLoading, setResultMessage]);

  return (
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
          {isLoading ? 'Loading...' : "Load User's Apps →"}
        </button>
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
                      {result.profileChanges?.hasArrayFields && <span className="badge badge-info">Arrays merged</span>}
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
  );
});

AppConverter.displayName = 'AppConverter';

export default AppConverter;
