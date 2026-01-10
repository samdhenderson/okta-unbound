import React, { useState, useCallback } from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import type { GroupSummary, OktaUser } from '../../../shared/types';
import {
  escapeCSV,
  downloadCSV,
  formatDateForCSV,
  sanitizeFilename,
  getDateForFilename,
} from '../../../shared/utils/csvUtils';

interface ExportColumn {
  id: string;
  label: string;
  enabled: boolean;
  description?: string;
}

interface GroupExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: GroupSummary[];
  targetTabId: number | null;
  exportType: 'selection' | 'collection';
  collectionName?: string;
  onFetchMembers: (groupId: string) => Promise<OktaUser[]>;
}

const DEFAULT_COLUMNS: ExportColumn[] = [
  { id: 'groupName', label: 'Group Name', enabled: true },
  { id: 'groupId', label: 'Group ID', enabled: true },
  { id: 'description', label: 'Description', enabled: true },
  { id: 'type', label: 'Type', enabled: true },
  { id: 'memberCount', label: 'Member Count', enabled: true },
  { id: 'daysSinceActivity', label: 'Days Since Last Activity', enabled: true },
  { id: 'pushGroupApps', label: 'Push Group Apps', enabled: true },
  { id: 'hasRules', label: 'Has Rules', enabled: false },
  { id: 'ruleCount', label: 'Rule Count', enabled: false },
  { id: 'created', label: 'Created Date', enabled: false },
  { id: 'lastUpdated', label: 'Last Updated', enabled: false },
];

function calculateDaysSinceLastActivity(group: GroupSummary): number | null {
  const activityDate = group.lastMembershipUpdated || group.lastUpdated;
  if (!activityDate) return null;
  const date = activityDate instanceof Date ? activityDate : new Date(activityDate);
  if (isNaN(date.getTime())) return null;
  const diffTime = Math.abs(Date.now() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getColumnValue(group: GroupSummary, columnId: string): string {
  switch (columnId) {
    case 'groupName':
      return group.name;
    case 'groupId':
      return group.id;
    case 'description':
      return group.description || '';
    case 'type':
      return group.type;
    case 'memberCount':
      return String(group.memberCount);
    case 'daysSinceActivity': {
      const days = calculateDaysSinceLastActivity(group);
      return days !== null ? String(days) : 'N/A';
    }
    case 'pushGroupApps':
      if (!group.isPushGroup || !group.linkedGroups) return '';
      return group.linkedGroups
        .map((lg) => lg.sourceAppName || lg.name || 'Unknown')
        .join(', ');
    case 'hasRules':
      return group.hasRules ? 'Yes' : 'No';
    case 'ruleCount':
      return String(group.ruleCount);
    case 'created':
      return group.created ? formatDateForCSV(group.created) : 'N/A';
    case 'lastUpdated':
      return group.lastUpdated ? formatDateForCSV(group.lastUpdated) : 'N/A';
    default:
      return '';
  }
}

const GroupExportModal: React.FC<GroupExportModalProps> = ({
  isOpen,
  onClose,
  groups,
  targetTabId,
  exportType,
  collectionName,
  onFetchMembers,
}) => {
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS);
  const [includeMemberList, setIncludeMemberList] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  const toggleColumn = useCallback((columnId: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, enabled: !col.enabled } : col))
    );
  }, []);

  const handleExport = useCallback(async () => {
    if (!targetTabId) {
      alert('No Okta tab connected');
      return;
    }

    const enabledColumns = columns.filter((col) => col.enabled);
    if (enabledColumns.length === 0) {
      alert('Please select at least one column to export');
      return;
    }

    setIsExporting(true);
    setExportProgress('Generating groups CSV...');

    try {
      // Generate groups CSV
      const headers = enabledColumns.map((col) => col.label);
      const rows = groups.map((group) =>
        enabledColumns.map((col) => escapeCSV(getColumnValue(group, col.id)))
      );

      const groupsCSV =
        headers.map((h) => escapeCSV(h)).join(',') + '\n' + rows.map((row) => row.join(',')).join('\n');

      // Generate filename
      const date = getDateForFilename();
      let baseFilename: string;
      if (exportType === 'collection' && collectionName) {
        baseFilename = `collection-${sanitizeFilename(collectionName)}`;
      } else {
        baseFilename = `groups-export-${groups.length}-groups`;
      }

      // Download groups CSV
      downloadCSV(groupsCSV, `${baseFilename}-${date}.csv`);

      // If member list is requested, fetch and export members
      if (includeMemberList) {
        setExportProgress('Fetching group members...');

        const memberHeaders = ['Group ID', 'Group Name', 'User ID', 'Email', 'First Name', 'Last Name', 'Status'];
        const memberRows: string[][] = [];

        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          setExportProgress(`Fetching members for group ${i + 1} of ${groups.length}...`);

          try {
            const members = await onFetchMembers(group.id);
            members.forEach((member) => {
              memberRows.push([
                escapeCSV(group.id),
                escapeCSV(group.name),
                escapeCSV(member.id),
                escapeCSV(member.profile.email),
                escapeCSV(member.profile.firstName),
                escapeCSV(member.profile.lastName),
                escapeCSV(member.status),
              ]);
            });
          } catch (err) {
            console.error(`Failed to fetch members for group ${group.name}:`, err);
            // Add error row
            memberRows.push([
              escapeCSV(group.id),
              escapeCSV(group.name),
              'ERROR',
              `Failed to fetch: ${err instanceof Error ? err.message : 'Unknown error'}`,
              '',
              '',
              '',
            ]);
          }
        }

        setExportProgress('Generating members CSV...');
        const membersCSV =
          memberHeaders.map((h) => escapeCSV(h)).join(',') +
          '\n' +
          memberRows.map((row) => row.join(',')).join('\n');

        downloadCSV(membersCSV, `${baseFilename}-members-${date}.csv`);
      }

      setExportProgress(null);
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [columns, groups, includeMemberList, exportType, collectionName, targetTabId, onFetchMembers, onClose]);

  const enabledCount = columns.filter((c) => c.enabled).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={exportType === 'collection' ? `Export Collection: ${collectionName}` : 'Export Groups'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleExport} disabled={isExporting || enabledCount === 0}>
            {isExporting ? 'Exporting...' : `Export (${groups.length})`}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Column Selection */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Select columns to include:</h4>
          <div className="grid grid-cols-2 gap-2">
            {columns.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={col.enabled}
                  onChange={() => toggleColumn(col.id)}
                  className="w-4 h-4 text-[#007dc1] border-gray-300 rounded focus:ring-[#007dc1]/30"
                />
                <span className="text-sm text-gray-700">{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200" />

        {/* Member List Toggle */}
        <div>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includeMemberList}
              onChange={(e) => setIncludeMemberList(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-[#007dc1] border-gray-300 rounded focus:ring-[#007dc1]/30"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Include member list</span>
              <p className="text-xs text-gray-500 mt-0.5">
                Generates a second CSV file with member details (Group ID, Group Name, User ID, Email, First
                Name, Last Name, Status)
              </p>
            </div>
          </label>
        </div>

        {/* Progress */}
        {exportProgress && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm text-blue-700">{exportProgress}</span>
          </div>
        )}

        {/* Warning for large exports with members */}
        {includeMemberList && groups.length > 20 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
            <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-700">
              Exporting members for {groups.length} groups may take a while. Consider exporting fewer groups at a time.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default GroupExportModal;
