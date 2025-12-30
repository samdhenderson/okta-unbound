import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from './shared/PageHeader';
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
  const [fetchUserMetadata, setFetchUserMetadata] = useState(false);

  const { getAllGroupMembers, removeUserFromGroup, batchGetUserDetails, getUserAppAssignments, getUserGroupMemberships } = useOktaApi({
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
    fetchUserMetadata,
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
      const orphanedAccounts = await detectOrphanedAccounts(
        members,
        userDetailsMap,
        fetchUserMetadata ? getUserAppAssignments : undefined,
        fetchUserMetadata ? getUserGroupMemberships : undefined
      );

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
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center mb-6 shadow-sm">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Not Connected</h3>
            <p className="text-gray-600 max-w-md">Please navigate to an Okta group page to run security analysis.</p>
          </div>
        </div>
      </div>
    );
  }

  const criticalCount = scanData?.posture?.findings.filter((f) => f.severity === 'critical').length || 0;

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Security Analysis"
        subtitle="Identify orphaned accounts, stale memberships, and security risks"
        icon="shield"
        badge={criticalCount > 0 ? { text: `${criticalCount} Critical`, variant: 'error' } : undefined}
        actions={
          <div className="flex gap-2">
            {scanData && scanData.posture && (
              <button
                className="px-4 py-2.5 bg-white text-gray-700 border border-gray-200 font-semibold rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow flex items-center gap-2"
                onClick={handleExportFullReport}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export Report</span>
              </button>
            )}
            <button
              className="px-5 py-2.5 bg-gradient-to-r from-[#007dc1] to-[#3d9dd9] text-white font-semibold rounded-lg hover:from-[#005a8f] hover:to-[#007dc1] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
              onClick={runSecurityScan}
              disabled={isScanning}
            >
              {isScanning ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Run Security Scan</span>
                </>
              )}
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Scan Options */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={fetchUserMetadata}
              onChange={(e) => setFetchUserMetadata(e.target.checked)}
              disabled={isScanning}
              className="mt-0.5 w-4 h-4 text-[#007dc1] border-gray-300 rounded focus:ring-[#007dc1]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">Fetch detailed user metadata</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded">SLOW</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Includes app assignments and group memberships count for each user. This requires 2 additional API calls per orphaned user and may significantly slow down the scan for large groups.
              </p>
              {fetchUserMetadata && (
                <div className="mt-2 flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Warning: This will make the scan significantly slower. For a group with 100 orphaned users, expect ~200 additional API calls and 30-60 seconds of extra scan time.</span>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Scan Progress */}
        {isScanning && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="space-y-3">
              <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-300"
                  style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 text-center">{scanProgress.message}</p>
            </div>
          </div>
        )}

        {/* Security Score */}
        {scanData && scanData.posture && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-5">
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
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <button
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all duration-200 ${
                activeSubTab === 'orphaned'
                  ? 'bg-gradient-to-b from-red-50 to-white text-gray-900 border-b-2 border-red-500 -mb-0.5'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveSubTab('orphaned')}
            >
              Orphaned Accounts ({scanData.orphanedAccounts.length})
            </button>
            <button
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all duration-200 ${
                activeSubTab === 'stale'
                  ? 'bg-gradient-to-b from-amber-50 to-white text-gray-900 border-b-2 border-amber-500 -mb-0.5'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveSubTab('stale')}
            >
              Stale Memberships ({scanData.staleMemberships.length})
            </button>
            <button
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all duration-200 ${
                activeSubTab === 'findings'
                  ? 'bg-gradient-to-b from-blue-50 to-white text-gray-900 border-b-2 border-[#007dc1] -mb-0.5'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveSubTab('findings')}
            >
              All Findings ({scanData.posture?.findings.length || 0})
            </button>
          </div>
        )}

        {/* Content */}
        {!scanData && !isScanning && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#007dc1]/10 to-[#3d9dd9]/10 flex items-center justify-center mb-6 shadow-sm">
              <svg className="w-10 h-10 text-[#007dc1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Scan Results</h3>
            <p className="text-gray-600 mb-6 max-w-md">Click "Run Security Scan" to analyze this group for security risks.</p>

            <div className="bg-gradient-to-br from-blue-50/50 to-blue-50/30 rounded-lg border border-blue-100 p-6 max-w-2xl text-left">
              <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#007dc1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                What does the security scan check?
              </h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-red-600 mt-0.5">•</span>
                  <span>Deprovisioned users still in groups (Critical)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">•</span>
                  <span>Users who never logged in (30+ days old)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">•</span>
                  <span>Users inactive for 90+ days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">•</span>
                  <span>Users inactive for 180+ days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Stale group memberships (90+ days)</span>
                </li>
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
                showMetadata={fetchUserMetadata}
              />
            )}

            {activeSubTab === 'stale' && (
              <StaleMembershipsList memberships={scanData.staleMemberships} groupName={groupName || 'Unknown Group'} />
            )}

            {activeSubTab === 'findings' && scanData.posture && (
              <div className="findings-view">
                {scanData.posture.findings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center mb-6 shadow-sm">
                      <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Security Findings</h3>
                    <p className="text-gray-600 max-w-md">This group looks secure! No issues detected.</p>
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
                        <div
                          key={index}
                          className={`
                            mb-3 p-4 bg-gray-50 rounded-lg border-l-4
                            ${reco.priority === 'high' ? 'border-orange-500' : reco.priority === 'medium' ? 'border-amber-400' : 'border-gray-500'}
                          `}
                        >
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
