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
import { Button, Modal, OpenInOktaLink } from '../shared';
import LoadingSpinner from '../shared/LoadingSpinner';
import StatCard from './shared/StatCard';
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
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
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
    setConfirmRemoveOpen(false);
    // removeDeprovisioned drives the global activity bar itself (via runOperation),
    // so no manual start/completeProgress here.
    await removeDeprovisioned(groupId);
    // Membership changed — drop the stale MFA scan and reload members.
    invalidate(['mfaScan', groupId]);
    await refetchMembers();
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

      {/* Member operations act directly on the list below, so they sit atop it as a
          flat toolbar (no collapsible panel). */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            icon="trash"
            onClick={() => setConfirmRemoveOpen(true)}
            disabled={deprovisionedCount === 0 || isApiLoading}
            title="Remove only deprovisioned users from this group"
          >
            Remove Deprovisioned
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={() => setExportModalOpen(true)}
            disabled={isApiLoading}
            title="Export member list to CSV or JSON"
          >
            Export Members
          </Button>
        </div>

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
      </div>

      {/* Secondary navigation + Admin Console link (group id lives in the context bar) */}
      <div className="flex flex-wrap items-center gap-2">
        <OpenInOktaLink
          oktaOrigin={oktaOrigin}
          entityType="group"
          entityId={groupId}
          label="Open in Admin Console"
        />
        <Button
          variant="secondary"
          size="sm"
          icon="list"
          onClick={() => onTabChange('rules')}
          title="View group rules affecting this group"
        >
          View Rules
        </Button>
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

      {/* Confirm destructive bulk removal */}
      <Modal
        isOpen={confirmRemoveOpen}
        onClose={() => setConfirmRemoveOpen(false)}
        title="Remove Deprovisioned Members"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemoveDeprovisioned}>
              Remove {deprovisionedCount}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          This will remove <strong>{deprovisionedCount}</strong> deprovisioned{' '}
          {deprovisionedCount === 1 ? 'member' : 'members'} from <strong>{groupName}</strong>. This
          action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default GroupOverview;
