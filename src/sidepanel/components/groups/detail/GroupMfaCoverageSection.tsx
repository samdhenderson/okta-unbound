/**
 * @module sidepanel/components/groups/detail/GroupMfaCoverageSection
 * @description The MFA-coverage trigger, result summary, and large-group
 * confirmation gate for {@link module:sidepanel/components/groups/detail/GroupInsightsPane}.
 *
 * Purely presentational — the caller owns `useMemberMfaScan` and passes its
 * state and controls through. Same shape as `MemberExplorer.tsx`'s MFA panel
 * (`MfaScanButton` plus a `Modal` confirm once
 * {@link module:sidepanel/hooks/useMemberMfaScan.mfaScanNeedsConfirm} says so),
 * scoped to one coverage summary line instead of the full
 * factor-distribution breakdown that surface renders.
 */
import React, { useMemo } from 'react';
import { AlertMessage, Button, Modal } from '../../shared';
import MfaScanButton from '../../members/MfaScanButton';
import { computeMfaBreakdown } from '../../members/memberAnalytics';
import { mfaScanNeedsConfirm } from '../../../hooks/useMemberMfaScan';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../../shared/types';

/** Props for {@link GroupMfaCoverageSection}. */
export interface GroupMfaCoverageSectionProps {
  /** The group's roster — the scan reads exactly these members. */
  members: OktaUser[];
  /** Per-member MFA scan results, or `null` before a scan has run/restored. */
  mfaResults: Map<string, MemberMfaResult> | null;
  /** Current MFA scan lifecycle status. */
  scanStatus: MfaScanStatus;
  /** Run the MFA scan now. */
  onRunScan: () => void;
  /** Move the MFA scan to its confirmation gate (large groups). */
  onRequestConfirm: () => void;
  /** Dismiss the MFA scan's confirmation gate. */
  onCancelConfirm: () => void;
}

/**
 * Renders the MFA scan/rescan trigger, a one-line coverage summary once a scan
 * completes, and the large-group confirmation `Modal`.
 *
 * @example
 * ```tsx
 * <GroupMfaCoverageSection
 *   members={members}
 *   mfaResults={mfaScan.mfaResults}
 *   scanStatus={mfaScan.scanStatus}
 *   onRunScan={mfaScan.runScan}
 *   onRequestConfirm={mfaScan.requestConfirm}
 *   onCancelConfirm={mfaScan.cancelConfirm}
 * />
 * ```
 */
const GroupMfaCoverageSection: React.FC<GroupMfaCoverageSectionProps> = ({
  members,
  mfaResults,
  scanStatus,
  onRunScan,
  onRequestConfirm,
  onCancelConfirm,
}) => {
  const handleScanClick = (): void => {
    if (mfaScanNeedsConfirm(members.length)) onRequestConfirm();
    else onRunScan();
  };

  const noFactorsRow = useMemo(() => {
    if (!mfaResults) return undefined;
    return computeMfaBreakdown(members, mfaResults).find((row) => row.value === 'none');
  }, [members, mfaResults]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* `min-w-0 flex-1`, so the paragraph is a sized column rather than a
            plain flex item that re-wraps every time the button's label changes
            length (D-053d). */}
        <p className="min-w-0 flex-1 text-sm text-neutral-600">
          {mfaResults && scanStatus === 'complete' && noFactorsRow
            ? `${noFactorsRow.count.toLocaleString()} of ${members.length.toLocaleString()} members (${Math.round(
                noFactorsRow.pct,
              )}%) have no MFA factor enrolled.`
            : 'Scan each member for enrolled MFA factors — one API call per member.'}
        </p>
        <MfaScanButton
          mfaResults={mfaResults}
          scanStatus={scanStatus}
          memberCount={members.length}
          onScanClick={handleScanClick}
        />
      </div>

      {scanStatus === 'error' && (
        <AlertMessage
          message={{ text: 'The MFA scan failed. Please try again.', type: 'danger' }}
        />
      )}

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
          This group has <strong>{members.length.toLocaleString()}</strong> members. Scanning makes
          roughly <strong>{members.length.toLocaleString()}</strong> API calls (one per member) and
          may take a while on large groups. Results are cached until you reload the panel.
        </p>
      </Modal>
    </div>
  );
};

export default GroupMfaCoverageSection;
