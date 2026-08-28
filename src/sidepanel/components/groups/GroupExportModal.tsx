/**
 * @module sidepanel/components/groups/GroupExportModal
 * @description Modal for exporting a set of groups (a selection or a saved collection)
 * to CSV, with column selection and an optional member-list export.
 *
 * The groups CSV honours the enabled columns; enabling "Include member list" fetches
 * each group's members (through the shared entity-cache-backed fetch path) and writes
 * a second CSV. Both documents are assembled with the shared `generateCSV`, and
 * failures surface as an inline {@link AlertMessage} notice instead of `alert()`.
 */
import React, { useState, useCallback } from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import AlertMessage from '../shared/AlertMessage';
import LoadingSpinner from '../shared/LoadingSpinner';
import Icon from '../shared/Icon';
import { Checkbox } from '../shared';
import type { GroupSummary, OktaUser } from '../../../shared/types';
import {
  generateCSV,
  downloadCSV,
  formatDateForCSV,
  sanitizeFilename,
  getDateForFilename,
} from '../../../shared/utils/csvUtils';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('GroupExportModal');

/** A selectable CSV column with its toggle state. */
interface ExportColumn {
  id: string;
  label: string;
  enabled: boolean;
  description?: string;
}

interface GroupExportModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Closes the modal. */
  onClose: () => void;
  /** Groups included in the export. */
  groups: GroupSummary[];
  /** Connected Okta tab id; export is blocked when null. */
  targetTabId: number | null;
  /** Whether the source is an ad-hoc selection or a saved collection (affects filename). */
  exportType: 'selection' | 'collection';
  /** Collection name, used for the title/filename when {@link GroupExportModalProps.exportType} is `collection`. */
  collectionName?: string;
  /** Fetches a group's members for the optional member-list CSV. */
  onFetchMembers: (groupId: string) => Promise<OktaUser[]>;
}

const DEFAULT_COLUMNS: ExportColumn[] = [
  { id: 'groupName', label: 'Group Name', enabled: true },
  { id: 'groupId', label: 'Group ID', enabled: true },
  { id: 'description', label: 'Description', enabled: true },
  { id: 'type', label: 'Type', enabled: true },
  { id: 'memberCount', label: 'Member Count', enabled: true },
  { id: 'hasRules', label: 'Has Rules', enabled: false },
  { id: 'ruleCount', label: 'Rule Count', enabled: false },
  { id: 'created', label: 'Created Date', enabled: false },
  { id: 'lastUpdated', label: 'Last Updated', enabled: false },
];

/**
 * Resolve a group's value for a given column id as a CSV-ready string.
 * @returns The stringified field value, or `''` for an unknown column id.
 */
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

/** Modal for exporting groups (and optionally their members) to CSV. */
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
  const [exportError, setExportError] = useState<string | null>(null);

  // Drop any stale error notice when the modal is (re)opened — render-phase
  // derived state, so no extra effect pass.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setExportError(null);
  }

  const toggleColumn = useCallback((columnId: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, enabled: !col.enabled } : col)),
    );
  }, []);

  const handleExport = useCallback(async () => {
    setExportError(null);

    if (!targetTabId) {
      setExportError('No Okta tab connected');
      return;
    }

    const enabledColumns = columns.filter((col) => col.enabled);
    if (enabledColumns.length === 0) {
      setExportError('Please select at least one column to export');
      return;
    }

    setIsExporting(true);
    setExportProgress('Generating groups CSV...');

    try {
      // Generate groups CSV via the shared assembler (escapeCSV on every cell).
      const headers = enabledColumns.map((col) => col.label);
      const rows = groups.map((group) =>
        enabledColumns.map((col) => getColumnValue(group, col.id)),
      );
      const groupsCSV = generateCSV(headers, rows);

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
        setExportProgress(`Fetching members for ${groups.length} groups...`);

        const memberHeaders = [
          'Group ID',
          'Group Name',
          'User ID',
          'Email',
          'First Name',
          'Last Name',
          'Status',
        ];

        // Fetch every group through the shared entity-cache-backed path at once:
        // cached groups resolve without a network call, and uncached ones are
        // queued (and rate-limited) by the background scheduler, so there is no
        // need to serialize here. The progress line counts completions; row
        // order stays grouped by `groups` order regardless of completion order.
        let completed = 0;
        const perGroupRows = await Promise.all(
          groups.map(async (group): Promise<string[][]> => {
            let groupRows: string[][];
            try {
              const members = await onFetchMembers(group.id);
              groupRows = members.map((member) => [
                group.id,
                group.name,
                member.id,
                member.profile.email,
                member.profile.firstName,
                member.profile.lastName,
                member.status,
              ]);
            } catch (err) {
              log.error(`Failed to fetch members for group ${group.id}:`, err);
              // Add error row
              groupRows = [
                [
                  group.id,
                  group.name,
                  'ERROR',
                  `Failed to fetch: ${err instanceof Error ? err.message : 'Unknown error'}`,
                  '',
                  '',
                  '',
                ],
              ];
            }
            completed++;
            setExportProgress(`Fetched members for ${completed} of ${groups.length} groups...`);
            return groupRows;
          }),
        );

        setExportProgress('Generating members CSV...');
        const membersCSV = generateCSV(memberHeaders, perGroupRows.flat());

        downloadCSV(membersCSV, `${baseFilename}-members-${date}.csv`);
      }

      setExportProgress(null);
      onClose();
    } catch (err) {
      log.error('Export failed:', err);
      setExportError(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [
    columns,
    groups,
    includeMemberList,
    exportType,
    collectionName,
    targetTabId,
    onFetchMembers,
    onClose,
  ]);

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
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={isExporting || enabledCount === 0}
          >
            {isExporting ? 'Exporting...' : `Export (${groups.length})`}
          </Button>
        </>
      }
    >
      <div className="space-y-(--sp-rung)">
        {/* Inline error notice (replaces the old alert() calls) */}
        {exportError && (
          <AlertMessage
            message={{ text: exportError, type: 'danger' }}
            onDismiss={() => setExportError(null)}
          />
        )}

        {/* Column Selection */}
        <div>
          <h4 className="text-sm font-medium text-neutral-700 mb-3">Select columns to include:</h4>
          <div className="grid grid-cols-2 gap-(--sp-field)">
            {columns.map((col) => (
              <Checkbox
                key={col.id}
                checked={col.enabled}
                onChange={() => toggleColumn(col.id)}
                label={col.label}
                className="px-(--sp-row-x) py-(--sp-row-y) rounded-md hover:bg-neutral-50 transition-colors"
              />
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-neutral-200" />

        {/* Member List Toggle */}
        <div>
          <Checkbox
            checked={includeMemberList}
            onChange={setIncludeMemberList}
            label={<span className="font-medium">Include member list</span>}
            description="Generates a second CSV file with member details (Group ID, Group Name, User ID, Email, First Name, Last Name, Status)"
            className="p-(--sp-card) rounded-md border border-neutral-200 hover:border-neutral-300 transition-colors"
          />
        </div>

        {/* Progress */}
        {exportProgress && (
          <div className="flex items-center gap-(--sp-inline) p-(--sp-card) bg-info-light rounded-md border border-primary/20">
            <LoadingSpinner size="sm" />
            <span className="text-sm text-primary-text">{exportProgress}</span>
          </div>
        )}

        {/* Warning for large exports with members */}
        {includeMemberList && groups.length > 20 && (
          <div className="flex items-start gap-(--sp-inline) p-(--sp-card) bg-warning-light rounded-md border border-warning/20">
            <Icon type="alert" size="sm" className="text-warning-text mt-0.5 shrink-0" />
            <p className="text-sm text-warning-text">
              Exporting members for {groups.length} groups may take a while. Consider exporting
              fewer groups at a time.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default GroupExportModal;
