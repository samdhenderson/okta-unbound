/**
 * @module sidepanel/hooks/useMemberMfaScan
 * @description Per-group MFA-enrollment scan state machine.
 *
 * Extracted from `GroupOverview.tsx` so a second surface (Group Detail's
 * attributes/health tab) can reuse the same explicit, opt-in scan without
 * duplicating the confirm/cancel/cache-restore wiring. Owns the scan's
 * lifecycle status, its per-member results, and restoring a previously cached
 * scan for the group on mount. The scan itself is one `GET
 * /api/v1/users/{id}/factors` per member, issued through
 * `useOktaApi().scanGroupMfa` (`low`-priority scheduler requests, cancellable,
 * with progress reported to the shared {@link module:sidepanel/contexts/ProgressContext}).
 */
import { useState, useEffect, useCallback } from 'react';
import { useOktaApi } from './useOktaApi';
import { peek, setEntry } from '../cache/entityCache';
import { cacheKeys } from '../cache/keys';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useMemberMfaScan');

/**
 * Above this member count, starting a scan requires an explicit confirmation:
 * the scan is one `GET /api/v1/users/{id}/factors` per member, so a press on a
 * large roster is a request storm the reader should have agreed to.
 *
 * It lives here, beside the state machine it gates, rather than in either
 * surface that renders the gate — `MemberExplorer` and
 * `GroupMfaCoverageSection` held identical unexported copies, and a threshold
 * that disagrees between two views of the same operation is a bug waiting for
 * whichever copy gets tuned first.
 */
export const MFA_AUTO_THRESHOLD = 500;

/**
 * Whether a roster of `memberCount` members is large enough that scanning
 * should go through the confirmation gate rather than starting immediately.
 *
 * The predicate rather than the bare constant is what callers want: both
 * surfaces branch on exactly this comparison, and exporting the comparison
 * keeps the boundary condition (`>`, not `>=`) from being re-derived — and
 * re-derived differently — at each call site.
 *
 * @param memberCount - Number of members the scan would cover.
 * @returns `true` when the caller should move to the `'confirming'` gate.
 */
export function mfaScanNeedsConfirm(memberCount: number): boolean {
  return memberCount > MFA_AUTO_THRESHOLD;
}

/** Options for {@link useMemberMfaScan}. */
export interface UseMemberMfaScanOptions {
  /** Okta group id the scan is scoped to; also the cache key's scope. */
  groupId: string;
  /** The group's current member set — `runScan` scans exactly these ids. */
  members: OktaUser[];
  /** Browser tab hosting the Okta session the scan's requests are routed to. */
  targetTabId: number | undefined;
}

/** Return shape of {@link useMemberMfaScan}. */
export interface UseMemberMfaScanResult {
  /** Per-member MFA scan results, or `null` before a scan has run/restored. */
  mfaResults: Map<string, MemberMfaResult> | null;
  /** Current scan lifecycle status. */
  scanStatus: MfaScanStatus;
  /** Run the scan now (one `GET .../factors` per member in `members`). */
  runScan: () => Promise<void>;
  /** Move to the `'confirming'` gate (used for large groups before scanning). */
  requestConfirm: () => void;
  /** Dismiss the confirmation gate, returning to `'idle'`. */
  cancelConfirm: () => void;
}

/**
 * Owns one group's MFA-enrollment scan: lifecycle status, results, and
 * restoring a previously cached scan for `groupId` on mount (so navigating away
 * and back does not force a rescan). Never auto-runs — `runScan` is always an
 * explicit caller action.
 *
 * @param options - See {@link UseMemberMfaScanOptions}.
 * @returns The scan's state plus `runScan`/`requestConfirm`/`cancelConfirm`. See
 * {@link UseMemberMfaScanResult}.
 */
export function useMemberMfaScan({
  groupId,
  members,
  targetTabId,
}: UseMemberMfaScanOptions): UseMemberMfaScanResult {
  const [mfaResults, setMfaResults] = useState<Map<string, MemberMfaResult> | null>(null);
  const [scanStatus, setScanStatus] = useState<MfaScanStatus>('idle');

  const { scanGroupMfa } = useOktaApi({ targetTabId: targetTabId ?? null });

  // Restore any previous MFA scan for this group from the cache (so navigating
  // away and back does not force a rescan). Reset to idle when none is cached.
  useEffect(() => {
    const cached = peek<Map<string, MemberMfaResult>>(cacheKeys.mfaScan(groupId));
    if (cached) {
      setMfaResults(cached);
      setScanStatus('complete');
    } else {
      setMfaResults(null);
      setScanStatus('idle');
    }
  }, [groupId]);

  const runScan = useCallback(async () => {
    setScanStatus('scanning');
    // scanGroupMfa drives the global activity bar itself (via runOperation).
    try {
      const result = await scanGroupMfa(members.map((m) => m.id));
      setMfaResults(result);
      setScanStatus('complete');
      // Cache the scan so navigating away and back restores it without rescanning.
      setEntry(cacheKeys.mfaScan(groupId), result);
    } catch (err) {
      log.error('MFA scan failed:', err);
      setScanStatus('error');
    }
  }, [groupId, members, scanGroupMfa]);

  const requestConfirm = useCallback(() => setScanStatus('confirming'), []);
  const cancelConfirm = useCallback(() => setScanStatus('idle'), []);

  return { mfaResults, scanStatus, runScan, requestConfirm, cancelConfirm };
}
