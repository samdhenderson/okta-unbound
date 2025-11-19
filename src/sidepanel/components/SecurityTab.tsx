import React, { useState, useEffect, useCallback } from 'react';
import { useOktaApi } from '../hooks/useOktaApi';
import { useSecurityAnalysis } from '../hooks/useSecurityAnalysis';
import type {
  OrphanedAccount,
  StaleGroupMembership,
  SecurityPosture,
  OktaUser,
} from '../../shared/types';
import SecurityFindingsCard from './security/SecurityFindingsCard';
import OrphanedAccountsList from './security/OrphanedAccountsList';
import StaleMembershipsList from './security/StaleMembershipsList';
import ConfirmationModal from './ConfirmationModal';
import { exportSecurityReportToCSV } from '../../shared/utils/securityExport';

interface SecurityTabProps {
  groupId: string | undefined;
  groupName: string | undefined;
  targetTabId: number | null;
}

type SecuritySubTab = 'orphaned' | 'stale' | 'findings';

const SecurityTab: React.FC<SecurityTabProps> = ({ groupId, groupName, targetTabId }) => {
  const [activeSubTab, setActiveSubTab] = useState<SecuritySubTab>('orphaned');
  const [scanData, setScanData] = useState<{
    orphanedAccounts: OrphanedAccount[];
    staleMemberships: StaleGroupMembership[];
    posture: SecurityPosture | null;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, message: '' });
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [usersToRemove, setUsersToRemove] = useState<string[]>([]);
  const [isRemoving, setIsRemoving] = useState(false);

  const { getAllGroupMembers, removeUserFromGroup, batchGetUserDetails } = useOktaApi({
    targetTabId,
    onResult: (message, type) => {
      console.log(`[SecurityTab] ${type}: ${message}`);
    },
    onProgress: (current, total, message) => {
      setScanProgress({ current, total, message });
    },
  });

  const {
    detectOrphanedAccounts,
    analyzeStaleMemberships,
    calculateSecurityPosture,
    loadCachedScan,
    saveScanToCache,
  } = useSecurityAnalysis({
    onProgress: (current, total, message) => {
      setScanProgress({ current, total, message });
    },
  });

  // Load cached scan on mount
  useEffect(() => {
    if (groupId) {
      loadCachedScan(groupId).then((cache) => {
        if (cache) {
          setScanData({
            orphanedAccounts: cache.orphanedAccounts,
            staleMemberships: cache.staleMemberships,
            posture: cache.posture,
          });
        }
      });
    }
  }, [groupId, loadCachedScan]);

  const runSecurityScan = useCallback(async () => {
    if (!groupId || !groupName || !targetTabId) {
      return;
    }

    setIsScanning(true);
    setScanProgress({ current: 0, total: 100, message: 'Starting security scan...' });

    try {
      // Step 1: Fetch all group members
      setScanProgress({ current: 10, total: 100, message: 'Fetching group members...' });
      const members = await getAllGroupMembers(groupId);

      // Step 2: Batch fetch user details (including lastLogin)
      setScanProgress({ current: 30, total: 100, message: 'Fetching user details...' });
      const userIds = members.map((m) => m.id);
      const userDetailsMap = await batchGetUserDetails(userIds, (current, total) => {
        const progress = 30 + Math.floor((current / total) * 30);
        setScanProgress({ current: progress, total: 100, message: `Loading user details ${current}/${total}...` });
      });

      // Step 3: Detect orphaned accounts
      setScanProgress({ current: 60, total: 100, message: 'Detecting orphaned accounts...' });
      const orphanedAccounts = await detectOrphanedAccounts(members, userDetailsMap);

      // Step 4: Analyze stale memberships
      setScanProgress({ current: 80, total: 100, message: 'Analyzing stale memberships...' });
      const staleMemberships = await analyzeStaleMemberships(members, userDetailsMap, []);

      // Step 5: Calculate security posture
      setScanProgress({ current: 90, total: 100, message: 'Calculating security posture...' });
      const posture = calculateSecurityPosture(groupId, groupName, orphanedAccounts, staleMemberships);

      // Save results
      const newScanData = { orphanedAccounts, staleMemberships, posture };
      setScanData(newScanData);

      // Cache the results
      await saveScanToCache({
        ...newScanData,
        timestamp: Date.now(),
        groupId,
      });

      setScanProgress({ current: 100, total: 100, message: 'Security scan complete!' });
    } catch (error) {
      console.error('[SecurityTab] Security scan failed:', error);
      setScanProgress({ current: 0, total: 0, message: 'Scan failed' });
    } finally {
      setIsScanning(false);
    }
  }, [
    groupId,
    groupName,
    targetTabId,
    getAllGroupMembers,
    batchGetUserDetails,
    detectOrphanedAccounts,
    analyzeStaleMemberships,
    calculateSecurityPosture,
    saveScanToCache,
  ]);

  const handleRemoveSelected = (userIds: string[]) => {
    setUsersToRemove(userIds);
    setShowRemoveModal(true);
  };

  const confirmRemoveUsers = async () => {
    if (!groupId || !groupName || !scanData) return;

    setIsRemoving(true);
    setShowRemoveModal(false);

    try {
      let removed = 0;
      for (const userId of usersToRemove) {
        const account = scanData.orphanedAccounts.find((a) => a.userId === userId);
        if (!account) continue;

        const userObj: OktaUser = {
          id: userId,
          status: account.status,
          profile: {
            email: account.email,
            login: account.email,
            firstName: account.firstName,
            lastName: account.lastName,
          },
        };

        const result = await removeUserFromGroup(groupId, groupName, userObj);
        if (result.success) {
          removed++;
        }

        // Small delay for rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Refresh scan after removal
      if (removed > 0) {
        await runSecurityScan();
      }
    } catch (error) {
      console.error('[SecurityTab] Failed to remove users:', error);
    } finally {
      setIsRemoving(false);
      setUsersToRemove([]);
    }
  };

  const handleExportFullReport = () => {
    if (scanData && scanData.posture) {
      exportSecurityReportToCSV(scanData.posture, scanData.orphanedAccounts, scanData.staleMemberships);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#28a745';
    if (score >= 60) return '#ffc107';
    if (score >= 40) return '#fd7e14';
    return '#dc3545';
  };

  if (!groupId || !targetTabId) {
    return (
      <div className="tab-content active">
        <div className="section">
          <div className="empty-state">
            <h3>Not Connected</h3>
            <p>Please navigate to an Okta group page to run security analysis.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content active">
      <div className="section">
        {/* Header */}
        <div className="section-header">
          <div>
            <h2>Security Analysis</h2>
            <p className="section-description">
              Identify orphaned accounts, stale memberships, and security risks based on Okta ISPM best practices
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {scanData && scanData.posture && (
              <button className="btn btn-secondary btn-sm" onClick={handleExportFullReport}>
                Export Report
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={runSecurityScan} disabled={isScanning}>
              {isScanning ? 'Scanning...' : 'Run Security Scan'}
            </button>
          </div>
        </div>

        {/* Scan Progress */}
        {isScanning && (
          <div className="scan-progress" style={{ marginBottom: '20px' }}>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${(scanProgress.current / scanProgress.total) * 100}%`,
                  backgroundColor: '#0066cc',
                  height: '8px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>{scanProgress.message}</p>
          </div>
        )}

        {/* Security Score */}
        {scanData && scanData.posture && (
          <div className="security-score-card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div className="score-gauge" style={{ flex: '0 0 120px' }}>
                <div
                  className="score-circle"
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    border: `8px solid ${getScoreColor(scanData.posture.overallScore)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: getScoreColor(scanData.posture.overallScore) }}>
                    {scanData.posture.overallScore}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Security Score</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Last Scan:</strong> {scanData.posture.lastScanDate.toLocaleString()}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                      {scanData.posture.findings.filter((f) => f.severity === 'critical').length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Critical</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fd7e14' }}>
                      {scanData.posture.findings.filter((f) => f.severity === 'high').length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>High</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                      {scanData.posture.findings.filter((f) => f.severity === 'medium').length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Medium</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6c757d' }}>
                      {scanData.posture.findings.filter((f) => f.severity === 'low').length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Low</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sub-tab Navigation */}
        {scanData && (
          <div className="security-subtabs" style={{ marginBottom: '20px' }}>
            <button
              className={`subtab-button ${activeSubTab === 'orphaned' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('orphaned')}
            >
              Orphaned Accounts ({scanData.orphanedAccounts.length})
            </button>
            <button
              className={`subtab-button ${activeSubTab === 'stale' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('stale')}
            >
              Stale Memberships ({scanData.staleMemberships.length})
            </button>
            <button
              className={`subtab-button ${activeSubTab === 'findings' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('findings')}
            >
              All Findings ({scanData.posture?.findings.length || 0})
            </button>
          </div>
        )}

        {/* Content */}
        {!scanData && !isScanning && (
          <div className="empty-state">
            <h3>No Scan Results</h3>
            <p>Click &ldquo;Run Security Scan&rdquo; to analyze this group for security risks.</p>
            <div style={{ marginTop: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '4px', textAlign: 'left' }}>
              <strong>What does the security scan check?</strong>
              <ul style={{ marginTop: '12px', paddingLeft: '20px' }}>
                <li>Deprovisioned users still in groups (Critical)</li>
                <li>Users who never logged in (30+ days old)</li>
                <li>Users inactive for 90+ days</li>
                <li>Users inactive for 180+ days</li>
                <li>Stale group memberships (90+ days)</li>
              </ul>
            </div>
          </div>
        )}

        {scanData && (
          <>
            {activeSubTab === 'orphaned' && (
              <OrphanedAccountsList
                accounts={scanData.orphanedAccounts}
                groupName={groupName || 'Unknown Group'}
                onRemoveSelected={handleRemoveSelected}
                isRemoving={isRemoving}
              />
            )}

            {activeSubTab === 'stale' && (
              <StaleMembershipsList memberships={scanData.staleMemberships} groupName={groupName || 'Unknown Group'} />
            )}

            {activeSubTab === 'findings' && scanData.posture && (
              <div className="findings-view">
                {scanData.posture.findings.length === 0 ? (
                  <div className="empty-state">
                    <h3>No Security Findings</h3>
                    <p>This group looks secure! No issues detected.</p>
                  </div>
                ) : (
                  <div className="findings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {scanData.posture.findings.map((finding, index) => (
                      <SecurityFindingsCard
                        key={index}
                        finding={finding}
                        onViewDetails={() => {
                          if (finding.category === 'orphaned_accounts') {
                            setActiveSubTab('orphaned');
                          } else if (finding.category === 'stale_memberships') {
                            setActiveSubTab('stale');
                          }
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {scanData.posture.recommendations.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <h3 style={{ marginBottom: '16px' }}>Recommendations</h3>
                    <div className="recommendations-list">
                      {scanData.posture.recommendations.map((reco, index) => (
                        <div key={index} className="recommendation-card" style={{ marginBottom: '12px', padding: '16px', background: '#f8f9fa', borderRadius: '4px', borderLeft: `4px solid ${reco.priority === 'high' ? '#fd7e14' : reco.priority === 'medium' ? '#ffc107' : '#6c757d'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                              <strong>{reco.title}</strong>
                              <p style={{ marginTop: '8px', marginBottom: '0', color: '#666' }}>{reco.description}</p>
                            </div>
                            <span className={`priority-badge priority-${reco.priority}`} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: reco.priority === 'high' ? '#fff3cd' : reco.priority === 'medium' ? '#d4edda' : '#d1ecf1' }}>
                              {reco.priority.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      {showRemoveModal && (
        <ConfirmationModal
          isOpen={showRemoveModal}
          title="Confirm Bulk Removal"
          message={
            <div>
              <p>You are about to remove {usersToRemove.length} user(s) from {groupName}.</p>
              {scanData && (
                <div style={{ marginTop: '12px' }}>
                  <strong>Breakdown by risk level:</strong>
                  <ul style={{ marginTop: '8px' }}>
                    <li>
                      Critical:{' '}
                      {scanData.orphanedAccounts.filter((a) => usersToRemove.includes(a.userId) && a.riskLevel === 'critical').length}
                    </li>
                    <li>
                      High:{' '}
                      {scanData.orphanedAccounts.filter((a) => usersToRemove.includes(a.userId) && a.riskLevel === 'high').length}
                    </li>
                    <li>
                      Medium:{' '}
                      {scanData.orphanedAccounts.filter((a) => usersToRemove.includes(a.userId) && a.riskLevel === 'medium').length}
                    </li>
                  </ul>
                </div>
              )}
              <p style={{ marginTop: '12px', color: '#dc3545' }}>
                <strong>Warning:</strong> This action cannot be undone via the extension. You will need to manually re-add these users if needed.
              </p>
            </div>
          }
          apiCost={`${usersToRemove.length} API request(s) will be made`}
          onConfirm={confirmRemoveUsers}
          onCancel={() => {
            setShowRemoveModal(false);
            setUsersToRemove([]);
          }}
        />
      )}
    </div>
  );
};

export default SecurityTab;
