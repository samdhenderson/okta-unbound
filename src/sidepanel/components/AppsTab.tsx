import React, { useState, useCallback, useEffect } from 'react';
import { useOktaApi } from '../hooks/useOktaApi';
import type {
  UserAppAssignment,
  GroupAppAssignment,
  AssignmentConversionRequest,
  AssignmentConversionResult,
  BulkAppAssignmentRequest,
  AppAssignmentSecurityAnalysis,
  AssignmentRecommenderResult,
} from '../../shared/types';

interface AppsTabProps {
  groupId: string | undefined;
  groupName: string | undefined;
  targetTabId: number | null;
}

type AppSubTab = 'viewer' | 'converter' | 'security' | 'bulk' | 'recommender';

const AppsTab: React.FC<AppsTabProps> = ({ groupId, groupName, targetTabId }) => {
  const [activeSubTab, setActiveSubTab] = useState<AppSubTab>('viewer');
  const [resultMessage, setResultMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  // Viewer state
  const [userApps, setUserApps] = useState<UserAppAssignment[]>([]);
  const [groupApps, setGroupApps] = useState<GroupAppAssignment[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [viewMode, setViewMode] = useState<'user' | 'group'>('group');

  // Converter state
  const [converterUserId, setConverterUserId] = useState('');
  const [converterTargetGroupId, setConverterTargetGroupId] = useState('');
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [removeUserAssignment, setRemoveUserAssignment] = useState(true);
  const [mergeStrategy, setMergeStrategy] = useState<'preserve_user' | 'prefer_user' | 'prefer_default'>('prefer_user');
  const [conversionResults, setConversionResults] = useState<AssignmentConversionResult[]>([]);

  // Security analysis state
  const [securityAnalysis, setSecurityAnalysis] = useState<AppAssignmentSecurityAnalysis | null>(null);
  const [analysisUserId, setAnalysisUserId] = useState('');

  // Bulk assignment state
  const [bulkGroupIds, setBulkGroupIds] = useState<string>('');
  const [bulkAppIds, setBulkAppIds] = useState<string>('');
  const [bulkPriority, setBulkPriority] = useState(0);

  // Recommender state
  const [recommenderAppIds, setRecommenderAppIds] = useState<string>('');
  const [recommendations, setRecommendations] = useState<AssignmentRecommenderResult | null>(null);

  const oktaApi = useOktaApi({
    targetTabId,
    onResult: (message, type) => {
      setResultMessage({ text: message, type });
    },
    onProgress: (current, total, message) => {
      setProgress({ current, total, message });
    },
  });

  // Auto-set group ID in forms when groupId changes
  useEffect(() => {
    if (groupId) {
      setConverterTargetGroupId(groupId);
    }
  }, [groupId]);

  // FEATURE 1: App Assignment Viewer
  const loadUserApps = useCallback(async () => {
    if (!selectedUserId) {
      setResultMessage({ text: 'Please enter a user ID', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const apps = await oktaApi.getUserApps(selectedUserId, true);
      setUserApps(apps);
      setResultMessage({ text: `Loaded ${apps.length} app assignments for user`, type: 'success' });
    } catch (error: any) {
      setResultMessage({ text: `Failed to load user apps: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId, oktaApi]);

  const loadGroupApps = useCallback(async () => {
    if (!groupId) {
      setResultMessage({ text: 'No group selected', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const apps = await oktaApi.getGroupApps(groupId, true);
      setGroupApps(apps);
      setResultMessage({ text: `Loaded ${apps.length} app assignments for group`, type: 'success' });
    } catch (error: any) {
      setResultMessage({ text: `Failed to load group apps: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [groupId, oktaApi]);

  // FEATURE 2: User-to-Group Assignment Converter
  const runConverter = useCallback(async () => {
    if (!converterUserId || !converterTargetGroupId) {
      setResultMessage({ text: 'Please provide user ID and target group ID', type: 'warning' });
      return;
    }

    if (selectedAppIds.length === 0) {
      setResultMessage({ text: 'Please select apps to convert', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const request: AssignmentConversionRequest = {
        userId: converterUserId,
        targetGroupId: converterTargetGroupId,
        appIds: selectedAppIds,
        removeUserAssignment,
        mergeStrategy,
      };

      const results = await oktaApi.convertUserToGroupAssignment(request);
      setConversionResults(results);

      const successCount = results.filter(r => r.success).length;
      setResultMessage({
        text: `Conversion complete: ${successCount}/${results.length} apps converted successfully`,
        type: successCount === results.length ? 'success' : 'warning'
      });
    } catch (error: any) {
      setResultMessage({ text: `Conversion failed: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [converterUserId, converterTargetGroupId, selectedAppIds, removeUserAssignment, mergeStrategy, oktaApi]);

  // Load user apps for converter
  const loadUserAppsForConverter = useCallback(async () => {
    if (!converterUserId) {
      setResultMessage({ text: 'Please enter a user ID', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const apps = await oktaApi.getUserApps(converterUserId);
      setUserApps(apps);
      setSelectedAppIds([]); // Reset selection
      setResultMessage({ text: `Loaded ${apps.length} apps. Select apps to convert.`, type: 'success' });
    } catch (error: any) {
      setResultMessage({ text: `Failed to load user apps: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [converterUserId, oktaApi]);

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

  // FEATURE 4: Bulk Group-to-App Assignment
  const runBulkAssignment = useCallback(async () => {
    const groupIds = bulkGroupIds.split(',').map(s => s.trim()).filter(Boolean);
    const appIds = bulkAppIds.split(',').map(s => s.trim()).filter(Boolean);

    if (groupIds.length === 0 || appIds.length === 0) {
      setResultMessage({ text: 'Please provide group IDs and app IDs (comma-separated)', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const request: BulkAppAssignmentRequest = {
        groupIds,
        appIds,
        priority: bulkPriority,
      };

      const result = await oktaApi.bulkAssignGroupsToApps(request);
      setResultMessage({
        text: `Bulk assignment complete: ${result.successful}/${result.totalOperations} successful`,
        type: result.failed === 0 ? 'success' : result.successful > 0 ? 'warning' : 'error'
      });
    } catch (error: any) {
      setResultMessage({ text: `Bulk assignment failed: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [bulkGroupIds, bulkAppIds, bulkPriority, oktaApi]);

  // FEATURE 5: App Assignment Recommender
  const runRecommender = useCallback(async () => {
    const appIds = recommenderAppIds.split(',').map(s => s.trim()).filter(Boolean);

    if (appIds.length === 0) {
      setResultMessage({ text: 'Please provide app IDs (comma-separated)', type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const result = await oktaApi.getAppAssignmentRecommender(appIds);
      setRecommendations(result);
    } catch (error: any) {
      setResultMessage({ text: `Failed to generate recommendations: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [recommenderAppIds, oktaApi]);

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
          className={`sub-tab-button ${activeSubTab === 'viewer' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('viewer')}
        >
          📱 Viewer
        </button>
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
        <button
          className={`sub-tab-button ${activeSubTab === 'recommender' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('recommender')}
        >
          💡 Recommender
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
        {/* FEATURE 1: App Assignment Viewer */}
        {activeSubTab === 'viewer' && (
          <div className="viewer-content">
            <div className="view-mode-selector">
              <label>
                <input
                  type="radio"
                  value="user"
                  checked={viewMode === 'user'}
                  onChange={() => setViewMode('user')}
                />
                View User Apps
              </label>
              <label>
                <input
                  type="radio"
                  value="group"
                  checked={viewMode === 'group'}
                  onChange={() => setViewMode('group')}
                />
                View Group Apps
              </label>
            </div>

            {viewMode === 'user' && (
              <div className="user-apps-viewer">
                <div className="input-group">
                  <label htmlFor="userIdInput">User ID:</label>
                  <input
                    id="userIdInput"
                    type="text"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    placeholder="Enter Okta user ID"
                  />
                  <button onClick={loadUserApps} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Load Apps'}
                  </button>
                </div>

                {userApps.length > 0 && (
                  <div className="apps-list">
                    <h3>Apps Assigned to User ({userApps.length})</h3>
                    <div className="apps-table">
                      <table>
                        <thead>
                          <tr>
                            <th>App Name</th>
                            <th>App ID</th>
                            <th>Status</th>
                            <th>Scope</th>
                            <th>Profile</th>
                            <th>Last Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userApps.map((app) => (
                            <tr key={app.id}>
                              <td>{app._embedded?.app?.label || app.id}</td>
                              <td className="monospace">{app.id.substring(0, 20)}...</td>
                              <td>
                                <span className={`status-badge ${app.status.toLowerCase()}`}>
                                  {app.status}
                                </span>
                              </td>
                              <td>{app.scope}</td>
                              <td>
                                {app.profile ? (
                                  <details>
                                    <summary>{Object.keys(app.profile).length} fields</summary>
                                    <pre>{JSON.stringify(app.profile, null, 2)}</pre>
                                  </details>
                                ) : 'None'}
                              </td>
                              <td>{new Date(app.lastUpdated).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'group' && (
              <div className="group-apps-viewer">
                <div className="input-group">
                  <p>Current Group: <strong>{groupName || 'No group selected'}</strong></p>
                  <button onClick={loadGroupApps} disabled={isLoading || !groupId}>
                    {isLoading ? 'Loading...' : 'Load Group Apps'}
                  </button>
                </div>

                {groupApps.length > 0 && (
                  <div className="apps-list">
                    <h3>Apps Assigned to Group ({groupApps.length})</h3>
                    <div className="apps-table">
                      <table>
                        <thead>
                          <tr>
                            <th>App Name</th>
                            <th>App ID</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Profile</th>
                            <th>Last Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupApps.map((app) => (
                            <tr key={app.id}>
                              <td>{app._embedded?.app?.label || app.id}</td>
                              <td className="monospace">{app.id.substring(0, 20)}...</td>
                              <td>
                                <span className={`status-badge ${app.status.toLowerCase()}`}>
                                  {app.status}
                                </span>
                              </td>
                              <td>{app.priority}</td>
                              <td>
                                {app.profile ? (
                                  <details>
                                    <summary>{Object.keys(app.profile).length} fields</summary>
                                    <pre>{JSON.stringify(app.profile, null, 2)}</pre>
                                  </details>
                                ) : 'None'}
                              </td>
                              <td>{new Date(app.lastUpdated).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* FEATURE 2: User-to-Group Assignment Converter */}
        {activeSubTab === 'converter' && (
          <div className="converter-content">
            <h3>Convert User Assignments to Group Assignments</h3>
            <p className="feature-description">
              This tool converts individual user app assignments to group-based assignments,
              helping you standardize on group-based provisioning.
            </p>

            <div className="form-group">
              <label htmlFor="converterUserId">User ID:</label>
              <input
                id="converterUserId"
                type="text"
                value={converterUserId}
                onChange={(e) => setConverterUserId(e.target.value)}
                placeholder="Enter user ID to convert"
              />
              <button onClick={loadUserAppsForConverter} disabled={isLoading}>
                Load User Apps
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="converterTargetGroupId">Target Group ID:</label>
              <input
                id="converterTargetGroupId"
                type="text"
                value={converterTargetGroupId}
                onChange={(e) => setConverterTargetGroupId(e.target.value)}
                placeholder="Enter target group ID"
              />
              {groupId && (
                <button onClick={() => setConverterTargetGroupId(groupId)}>
                  Use Current Group
                </button>
              )}
            </div>

            {userApps.length > 0 && (
              <div className="app-selection">
                <h4>Select Apps to Convert ({selectedAppIds.length} selected)</h4>
                <div className="checkbox-list">
                  {userApps.map((app) => (
                    <label key={app.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedAppIds.includes(app.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAppIds([...selectedAppIds, app.id]);
                          } else {
                            setSelectedAppIds(selectedAppIds.filter(id => id !== app.id));
                          }
                        }}
                      />
                      <span>{app._embedded?.app?.label || app.id}</span>
                      {app.profile && <span className="badge">Has Profile</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <h4>Conversion Options</h4>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={removeUserAssignment}
                  onChange={(e) => setRemoveUserAssignment(e.target.checked)}
                />
                Remove user assignment after conversion
              </label>

              <div className="radio-group">
                <label>Profile Merge Strategy:</label>
                <label>
                  <input
                    type="radio"
                    value="preserve_user"
                    checked={mergeStrategy === 'preserve_user'}
                    onChange={() => setMergeStrategy('preserve_user')}
                  />
                  Preserve existing group profile
                </label>
                <label>
                  <input
                    type="radio"
                    value="prefer_user"
                    checked={mergeStrategy === 'prefer_user'}
                    onChange={() => setMergeStrategy('prefer_user')}
                  />
                  Use user&apos;s profile values
                </label>
                <label>
                  <input
                    type="radio"
                    value="prefer_default"
                    checked={mergeStrategy === 'prefer_default'}
                    onChange={() => setMergeStrategy('prefer_default')}
                  />
                  Use defaults
                </label>
              </div>
            </div>

            <button
              className="primary-button"
              onClick={runConverter}
              disabled={isLoading || selectedAppIds.length === 0}
            >
              {isLoading ? 'Converting...' : `Convert ${selectedAppIds.length} App(s)`}
            </button>

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
                        <th>User Assignment Removed</th>
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
                            {result.profileChanges?.differences.length || 0} difference(s)
                          </td>
                          <td>{result.userAssignmentRemoved ? 'Yes' : 'No'}</td>
                          <td>
                            {result.error || (result.profileChanges && (
                              <details>
                                <summary>View Changes</summary>
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

        {/* FEATURE 4: Bulk Assignment */}
        {activeSubTab === 'bulk' && (
          <div className="bulk-content">
            <h3>Bulk Group-to-App Assignment</h3>
            <p className="feature-description">
              Assign multiple groups to multiple apps in a single operation.
            </p>

            <div className="form-group">
              <label htmlFor="bulkGroupIds">Group IDs (comma-separated):</label>
              <textarea
                id="bulkGroupIds"
                value={bulkGroupIds}
                onChange={(e) => setBulkGroupIds(e.target.value)}
                placeholder="00g1234abcd, 00g5678efgh, ..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bulkAppIds">App IDs (comma-separated):</label>
              <textarea
                id="bulkAppIds"
                value={bulkAppIds}
                onChange={(e) => setBulkAppIds(e.target.value)}
                placeholder="0oa1234abcd, 0oa5678efgh, ..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bulkPriority">Priority:</label>
              <input
                id="bulkPriority"
                type="number"
                value={bulkPriority}
                onChange={(e) => setBulkPriority(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>

            <button
              className="primary-button"
              onClick={runBulkAssignment}
              disabled={isLoading}
            >
              {isLoading ? 'Assigning...' : 'Run Bulk Assignment'}
            </button>
          </div>
        )}

        {/* FEATURE 5: Recommender */}
        {activeSubTab === 'recommender' && (
          <div className="recommender-content">
            <h3>App-to-Group Assignment Recommender</h3>
            <p className="feature-description">
              Analyze apps with direct user assignments and get recommendations for
              group-based assignments to reduce maintenance overhead.
            </p>

            <div className="form-group">
              <label htmlFor="recommenderAppIds">App IDs to Analyze (comma-separated):</label>
              <textarea
                id="recommenderAppIds"
                value={recommenderAppIds}
                onChange={(e) => setRecommenderAppIds(e.target.value)}
                placeholder="0oa1234abcd, 0oa5678efgh, ..."
                rows={3}
              />
            </div>

            <button onClick={runRecommender} disabled={isLoading}>
              {isLoading ? 'Analyzing...' : 'Generate Recommendations'}
            </button>

            {recommendations && (
              <div className="recommendations-results">
                <div className="overall-stats">
                  <h4>Overall Statistics</h4>
                  <p>Apps Analyzed: {recommendations.overallStats.totalAppsAnalyzed}</p>
                  <p>Total Direct Assignments: {recommendations.overallStats.totalDirectAssignments}</p>
                  <p>Potential Group Assignments: {recommendations.overallStats.potentialGroupAssignments}</p>
                  <p>
                    Estimated Maintenance Reduction: {recommendations.overallStats.estimatedMaintenanceReduction.toFixed(1)}%
                  </p>
                </div>

                <div className="recommendations-list">
                  <h4>Top Recommendations ({recommendations.topRecommendations.length})</h4>
                  {recommendations.topRecommendations.map((rec, idx) => (
                    <div key={idx} className={`recommendation ${rec.implementationPriority}`}>
                      <h5>
                        {rec.appName}
                        <span className={`priority-badge ${rec.implementationPriority}`}>
                          {rec.implementationPriority} priority
                        </span>
                      </h5>
                      <p>Current Direct Assignments: {rec.currentDirectAssignments}</p>
                      <p>Estimated Reduction: {rec.estimatedReduction.toFixed(1)}%</p>

                      <div className="recommended-groups">
                        <strong>Recommended Group Assignments:</strong>
                        {rec.recommendedGroupAssignments.map((groupRec, gIdx) => (
                          <div key={gIdx} className="group-recommendation">
                            <p><strong>{groupRec.group.profile.name}</strong></p>
                            <p>Covers: {groupRec.matchingUsers} users ({groupRec.percentageOfAppUsers.toFixed(1)}%)</p>
                            <p>Confidence: {groupRec.confidence.toFixed(0)}%</p>
                            <p className="rationale">{groupRec.rationale}</p>
                          </div>
                        ))}
                      </div>

                      <div className="coverage-analysis">
                        <p>
                          <strong>Coverage:</strong> {rec.coverageAnalysis.usersCoveredByRecommendations}/
                          {rec.coverageAnalysis.totalAppUsers} users (
                          {rec.coverageAnalysis.percentageCovered.toFixed(1)}%)
                        </p>
                      </div>
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
      `}</style>
    </div>
  );
};

export default AppsTab;
