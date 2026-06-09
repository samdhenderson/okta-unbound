import React from 'react';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../../shared/types';
import Button from '../../shared/Button';
import Modal from '../../shared/Modal';
import BreakdownReport from './BreakdownReport';
import {
  type BreakdownRow,
  type MemberFilter,
  computeMfaBreakdown,
} from './memberAnalytics';

/** Above this member count, scanning requires explicit confirmation. */
export const MFA_AUTO_THRESHOLD = 500;

interface MfaScanPanelProps {
  members: OktaUser[];
  mfaResults: Map<string, MemberMfaResult> | null;
  scanStatus: MfaScanStatus;
  filters: MemberFilter[];
  onRunScan: () => void;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
  onToggleMfaFilter: (row: BreakdownRow) => void;
}

const MfaScanPanel: React.FC<MfaScanPanelProps> = ({
  members,
  mfaResults,
  scanStatus,
  filters,
  onRunScan,
  onRequestConfirm,
  onCancelConfirm,
  onToggleMfaFilter,
}) => {
  const memberCount = members.length;
  const scanning = scanStatus === 'scanning';

  const handleClick = () => {
    if (memberCount > MFA_AUTO_THRESHOLD) onRequestConfirm();
    else onRunScan();
  };

  const mfaRows = React.useMemo(
    () => computeMfaBreakdown(members, mfaResults),
    [members, mfaResults]
  );
  const activeValues = new Set(filters.filter((f) => f.dimension === 'mfa').map((f) => f.value));

  const enrolledCount = mfaResults
    ? Array.from(mfaResults.values()).filter((r) => r.enrolled).length
    : 0;

  return (
    <div className="bg-white rounded-md border border-neutral-200 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">MFA Factors</h3>
          <p className="text-xs text-neutral-500">
            {mfaResults
              ? `${enrolledCount.toLocaleString()} of ${memberCount.toLocaleString()} members have a factor enrolled`
              : 'See which factors each member has enrolled (1 API call per member).'}
          </p>
        </div>
        <Button
          variant={mfaResults ? 'secondary' : 'primary'}
          size="sm"
          icon="shield"
          loading={scanning}
          disabled={scanning || memberCount === 0}
          onClick={handleClick}
        >
          {scanning ? 'Scanning…' : mfaResults ? 'Rescan' : 'Run MFA scan'}
        </Button>
      </div>

      {scanStatus === 'error' && (
        <p className="text-xs text-danger-text">The MFA scan failed. Please try again.</p>
      )}

      {mfaResults && (
        <BreakdownReport
          rows={mfaRows}
          activeValues={activeValues}
          onRowClick={onToggleMfaFilter}
          emptyMessage="No factor data"
        />
      )}

      {/* Confirmation gate for large groups */}
      <Modal
        isOpen={scanStatus === 'confirming'}
        onClose={onCancelConfirm}
        title="Run MFA scan?"
        footer={
          <>
            <Button variant="secondary" onClick={onCancelConfirm}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onRunScan}>
              Scan anyway
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          This group has <strong>{memberCount.toLocaleString()}</strong> members. Scanning makes
          roughly <strong>{memberCount.toLocaleString()}</strong> API calls (one per member) and may
          take a while on large groups. Results are cached until you reload the panel.
        </p>
      </Modal>
    </div>
  );
};

export default MfaScanPanel;
