/**
 * @module sidepanel/components/overview/members/MfaScanButton
 * @description Shared trigger button for the group MFA factor scan.
 *
 * Renders the scan/rescan button with the right label, loading, and disabled
 * state for the current {@link MfaScanStatus}. Used both in the filter panel
 * (to enable factor filtering) and in the Composition MFA tab (to populate the
 * breakdown), so the two entry points stay consistent. The large-group
 * confirmation gate is owned by the caller via `onScanClick`.
 */
import React from 'react';
import type { MemberMfaResult, MfaScanStatus } from '../../../../shared/types';
import Button from '../../shared/Button';

/** Props for {@link MfaScanButton}. */
interface MfaScanButtonProps {
  /** Per-member MFA scan results, or null before a scan has run. */
  mfaResults: Map<string, MemberMfaResult> | null;
  /** Current MFA scan lifecycle status. */
  scanStatus: MfaScanStatus;
  /** Member count; scanning is disabled for an empty group. */
  memberCount: number;
  /** Start (or confirm) the scan — the caller decides whether to gate large groups. */
  onScanClick: () => void;
  /** Button size; defaults to `sm`. */
  size?: 'sm' | 'md';
}

/** Renders the MFA scan/rescan trigger for the current scan status. */
const MfaScanButton: React.FC<MfaScanButtonProps> = ({
  mfaResults,
  scanStatus,
  memberCount,
  onScanClick,
  size = 'sm',
}) => {
  const scanning = scanStatus === 'scanning';
  return (
    <Button
      variant={mfaResults ? 'secondary' : 'primary'}
      size={size}
      icon="shield"
      loading={scanning}
      disabled={scanning || memberCount === 0}
      onClick={onScanClick}
    >
      {scanning ? 'Scanning…' : mfaResults ? 'Rescan' : 'Run MFA scan'}
    </Button>
  );
};

export default MfaScanButton;
