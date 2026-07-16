/**
 * @module sidepanel/components/overview/GroupOverview
 * @description Overview tab for a single Okta group: quick stats, bulk actions, and the member explorer.
 *
 * Loads the group's full membership (via the scheduler/content-script path in
 * {@link useOktaApi}), derives status counts for the stat cards, and hosts the
 * bulk operations (remove deprovisioned, export) plus the in-group
 * {@link MemberExplorer} (search, composition reports, MFA scan).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOktaApi } from '../../hooks/useOktaApi';
import { useEntityQuery } from '../../cache/useEntityQuery';
import { peek, setEntry, invalidate } from '../../cache/entityCache';
import { useProgress } from '../../contexts/ProgressContext';
import AlertMessage from '../shared/AlertMessage';
import { Button, IconButton } from '../shared';
import LoadingSpinner from '../shared/LoadingSpinner';
import Modal from '../shared/Modal';
import StatCard from './shared/StatCard';
import QuickActionsPanel, { type ActionSection } from './shared/QuickActionsPanel';
import MemberExplorer from './members/MemberExplorer';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../shared/types';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('GroupOverview');

/** Props for {@link GroupOverview}. */
interface GroupOverviewProps {
  /** Okta group id whose members and stats are shown. */
  groupId: string;
  /** Group display name (used in headings and the export filename). */
  groupName: string;
  /** Browser tab hosting the Okta session; every API call is routed to it. */
  targetTabId: number;
  /** Switch the side panel to another primary tab (optionally focusing a rule). */
  onTabChange: (tab: 'rules' | 'users' | 'groups', selectedRuleId?: string) => void;
  /** Okta org origin, used to build Admin Console deep links (null when unknown). */
  oktaOrigin?: string | null;
}

/**
 * Renders the group Overview tab. Fetches all members on mount / group change,
 * shows status stat cards and quick actions, and embeds the member explorer.
 */
const GroupOverview: React.FC<GroupOverviewProps> = ({
  groupId,
  groupName,
  targetTabId,
  onTabChange,
  oktaOrigin,
}) => {
  const { startProgress, completeProgress, updateProgress } = useProgress();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [idCopied, setIdCopied] = useState(false);
  const [mfaResults, setMfaResults] = useState<Map<string, MemberMfaResult> | null>(null);
  const [scanStatus, setScanStatus] = useState<MfaScanStatus>('idle');

  const handleResult = useCallback(
    (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
      log.debug(`${type}:`, message);
    },
    [],
  );

  const handleProgress = useCallback(
    (current: number, total: number, message: string, apiCalls?: number) => {
      updateProgress(current, total, message, apiCalls);
    },
    [updateProgress],
  );

  const {
    getAllGroupMembers,
    removeDeprovisioned,
    exportMembers,
    scanGroupMfa,
    isLoading: isApiLoading,
  } = useOktaApi({
    targetTabId,
    onResult: handleResult,
    onProgress: handleProgress,
  });

  // Members come from the shared entity cache, so switching tabs / re-navigating
  // back to this group serves instantly with no refetch (5-min TTL, then revalidate).
  const {
    data: membersData,
    isLoading,
    error,
    refetch: refetchMembers,
  } = useEntityQuery<OktaUser[]>(
    ['groupMembers', groupId],
    async () => (await getAllGroupMembers(groupId)) ?? [],
    { enabled: Boolean(targetTabId && groupId) },
  );
  const members = useMemo(() => membersData ?? [], [membersData]);

  // Restore any previous MFA scan for this group from the cache (so navigating
  // away and back does not force a rescan). Reset to idle when none is cached.
  useEffect(() => {
    const cached = peek<Map<string, MemberMfaResult>>(['mfaScan', groupId]);
    if (cached) {
      setMfaResults(cached);
      setScanStatus('complete');
    } else {
      setMfaResults(null);
      setScanStatus('idle');
    }
  }, [groupId]);

  // Compute status counts from members
  const statusCounts = members.reduce<Record<string, number>>((acc, user) => {
    acc[user.status] = (acc[user.status] || 0) + 1;
    return acc;
  }, {});

  const deprovisionedCount = statusCounts['DEPROVISIONED'] || 0;
  const suspendedCount = statusCounts['SUSPENDED'] || 0;
  const lockedOutCount = statusCounts['LOCKED_OUT'] || 0;
  const inactiveCount = deprovisionedCount + suspendedCount + lockedOutCount;

  const handleRemoveDeprovisioned = async () => {
    // removeDeprovisioned drives the global activity bar itself (via runOperation),
    // so no manual start/completeProgress here.
    await removeDeprovisioned(groupId);
    // Membership changed — drop the stale MFA scan and reload members.
    invalidate(['mfaScan', groupId]);
    await refetchMembers();
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(groupId).then(() => {
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1500);
    });
  };

  const handleExportConfirm = async () => {
    setExportModalOpen(false);
    startProgress('Export', `Exporting members to ${exportFormat.toUpperCase()}...`);
    try {
      await exportMembers(groupId, groupName, exportFormat);
    } finally {
      completeProgress();
    }
  };

  const runMfaScan = useCallback(async () => {
    setScanStatus('scanning');
    // scanGroupMfa drives the global activity bar itself (via runOperation).
    try {
      const result = await scanGroupMfa(members.map((m) => m.id));
      setMfaResults(result);
      setScanStatus('complete');
      // Cache the scan so navigating away and back restores it without rescanning.
      setEntry(['mfaScan', groupId], result);
    } catch (err) {
      log.error('MFA scan failed:', err);
      setScanStatus('error');
    }
  }, [groupId, members, scanGroupMfa]);

  const requestMfaConfirm = useCallback(() => setScanStatus('confirming'), []);
  const cancelMfaConfirm = useCallback(() => setScanStatus('idle'), []);

  if (isLoading && members.length === 0) {
    return <LoadingSpinner size="lg" message="Loading group members..." centered />;
  }

  if (error) {
    return (
      <AlertMessage
        message={{ text: error, type: 'danger' }}
        action={{ label: 'Retry', onClick: refetchMembers }}
      />
    );
  }

  const actionSections: ActionSection[] = [
    {
      title: 'Member Operations',
      icon: 'users',
      expanded: true,
      actions: [
        {
          label: 'Remove Deprovisioned',
          icon: 'trash',
          variant: 'primary',
          onClick: handleRemoveDeprovisioned,
          disabled: deprovisionedCount === 0 || isApiLoading,
          badge: deprovisionedCount > 0 ? `${deprovisionedCount}` : undefined,
          tooltip: 'Remove only deprovisioned users',
        },
        {
          label: 'Export Members',
          icon: 'download',
          variant: 'secondary',
          onClick: () => setExportModalOpen(true),
          disabled: isApiLoading,
          tooltip: 'Export member list to CSV or JSON',
        },
      ],
    },
    {
      title: 'Navigation',
      icon: 'search',
      expanded: false,
      actions: [
        {
          label: 'View Rules',
          icon: 'list',
          variant: 'ghost',
          onClick: () => onTabChange('rules'),
          tooltip: 'View group rules affecting this group',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Total Members" value={members.length} color="primary" icon="users" />
        <StatCard title="Active" value={statusCounts['ACTIVE'] || 0} color="success" icon="check" />
        <StatCard
          title="Inactive"
          value={inactiveCount}
          color={inactiveCount > 0 ? 'warning' : 'success'}
          icon="alert"
        />
        <StatCard
          title="Deprovisioned"
          value={deprovisionedCount}
          color={deprovisionedCount > 0 ? 'error' : 'success'}
          icon="trash"
        />
      </div>

      {/* Quick Actions */}
      <QuickActionsPanel sections={actionSections} />

      {/* In-group member explorer: search, composition reports, MFA scan */}
      <MemberExplorer
        members={members}
        mfaResults={mfaResults}
        scanStatus={scanStatus}
        onRunScan={runMfaScan}
        onRequestConfirm={requestMfaConfirm}
        onCancelConfirm={cancelMfaConfirm}
        oktaOrigin={oktaOrigin}
      />

      {/* Admin Console Link and Group ID */}
      <div className="flex flex-wrap items-center gap-2">
        {oktaOrigin && (
          <a
            href={`${oktaOrigin}/admin/group/${groupId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white text-neutral-900 border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-500 transition-colors duration-100"
            style={{ fontFamily: 'var(--font-heading)' }}
            title="Open this group in the Okta Admin Console"
          >
            <span>Open in Admin Console</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md">
          <span className="text-xs text-neutral-500 font-medium">ID:</span>
          <code className="text-xs font-mono text-neutral-700">{groupId}</code>
          <IconButton
            label={idCopied ? 'Copied!' : 'Copy group ID'}
            onClick={handleCopyId}
            variant="ghost"
            size="sm"
          >
            {idCopied ? (
              <svg
                className="w-3.5 h-3.5 text-success-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M8 5a2 2 0 002 2h4a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2"
                />
              </svg>
            )}
          </IconButton>
        </div>
      </div>

      {/* Export Modal */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Export Group Members"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExportModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleExportConfirm}>
              Export
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Format</label>
            <select
              className="w-full px-3 py-2 border border-neutral-200 rounded-md focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <p className="text-sm text-neutral-600">
            This will export all members from <strong>{groupName}</strong> to a{' '}
            {exportFormat.toUpperCase()} file.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default GroupOverview;
