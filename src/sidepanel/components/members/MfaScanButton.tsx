/**
 * @module sidepanel/components/members/MfaScanButton
 * @description Shared trigger button for the group MFA factor scan.
 *
 * Renders the scan/rescan button with the right label, loading, and disabled
 * state for the current {@link MfaScanStatus}. Used both in the filter panel
 * (to enable factor filtering) and in the Composition MFA tab (to populate the
 * breakdown), so the two entry points stay consistent. The large-group
 * confirmation gate is owned by the caller via `onScanClick`.
 */
import React from 'react';
import type { MemberMfaResult, MfaScanStatus } from '../../../shared/types';
import Button from '../shared/Button';
import StableWidth from '../shared/StableWidth';

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
      {/*
        The label runs `Run MFA scan` (12 characters), `Scanning…` (9, plus a
        spinner) and `Rescan` (6), so the button took three widths during one scan
        and re-wrapped whatever sat beside it each time (D-053d). Fixed here rather
        than at the three hosts: the widths are the button's property, and only one
        of the three rows was laid out in a way that showed it.
      */}
      <StableWidth reserve="Run MFA scan" align="center">
        {scanning ? 'Scanning…' : mfaResults ? 'Rescan' : 'Run MFA scan'}
      </StableWidth>
    </Button>
  );
};

export default MfaScanButton;
