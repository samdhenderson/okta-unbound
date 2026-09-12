/**
 * @module sidepanel/components/groups/detail/GroupMfaCoverageSection
 * @description The MFA-coverage scan's trigger, its two reports, and its
 * large-group confirmation gate, for
 * {@link module:sidepanel/components/groups/detail/GroupInsightsPane}.
 *
 * Purely presentational — the caller owns `useMemberMfaScan` and passes its state
 * and controls through.
 *
 * ## Why this is two cards and not one bar
 *
 * The scan makes one API call per member and used to report a single sentence:
 * "N of M members have no MFA factor enrolled". That sentence is still here — it
 * is the section's collapsed summary, written by the pane — but it was the whole
 * of what a per-member scan bought, and everything else the scan learned was
 * either thrown away or duplicated in a second section.
 *
 * The obvious fix, one card in the {@link AttributeHealthCard} shape over
 * {@link module:sidepanel/components/members/memberAnalytics.computeMfaBreakdown},
 * is not available: those rows **overlap**. A member holding Okta Verify and SMS
 * is counted in `multiple` and again in each `has:` row, so the rows sum past the
 * group and a spread bar drawn over them would be a picture of a partition that
 * is not one. So the two questions get separated, and each is rendered in the
 * shape that is honest for it:
 *
 * 1. **Enrollment** — a real partition (`none` / `single` / `multiple`) that sums
 *    to the scanned count, which is what earns it a bar and a set of signals.
 * 2. **Factor types** — the `has:` tally, which is not a partition and therefore
 *    gets **no bar**. It says so in words rather than leaving a reader to work it
 *    out from arithmetic that does not close.
 *
 * ## The denominator is the scan, not the group
 *
 * Every figure on both cards is over the members the scan actually reached. A
 * cancelled scan has learned nothing about the members it never got to, and
 * dividing by the roster would report their absence as coverage. When the two
 * differ, the `partial-scan` signal says so on the card itself rather than
 * leaving it to be inferred from a count.
 */
import React, { useMemo } from 'react';
import {
  AlertMessage,
  Badge,
  Button,
  InsightCard,
  ListRow,
  Modal,
  SpreadBar,
  type BadgeVariant,
} from '../../shared';
import MfaScanButton from '../../members/MfaScanButton';
import { mfaEnrollmentSegments } from './mfaSpread';
import { MFA_ENROLLMENT_PAINT } from '../../../theme/chartPalette';
import {
  computeMfaEnrollment,
  computeMfaFactorTypes,
  mfaSignals,
  type BreakdownRow,
  type MemberFilter,
  type MfaSignalKind,
} from '../../members/memberAnalytics';
import { mfaScanNeedsConfirm } from '../../../hooks/useMemberMfaScan';
import type { OktaUser, MemberMfaResult, MfaScanStatus } from '../../../../shared/types';

/**
 * Badge treatment per signal.
 *
 * `unprotected` is the only `warning`: it is the only signal that says something
 * is *wrong*. A thin single factor is `neutral` because it is a fact about how
 * the group is covered rather than a fault, and `partial-scan` is `neutral`
 * because it describes this card's own scope, not the group's.
 */
const SIGNAL_VARIANT: Record<MfaSignalKind, BadgeVariant> = {
  unprotected: 'warning',
  'single-factor': 'neutral',
  'partial-scan': 'neutral',
};

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
  /**
   * Applies one bucket or factor type as a member filter and moves to the Members
   * tab.
   *
   * **Omit and the rows render inert** rather than offering a jump nothing can
   * honour. The cards themselves still render either way — unlike a grid made
   * entirely of value clicks (ADR-0039), these carry a bar, badges and counts
   * that are worth reading with no destination wired.
   */
  onFilterMembers?: (filter: MemberFilter) => void;
}

/** One distribution row, as a line — a real control when it has somewhere to go. */
const DistributionRow: React.FC<{
  row: BreakdownRow;
  swatch?: string;
  denominator: string;
  onSelect?: () => void;
}> = ({ row, swatch, denominator, onSelect }) => {
  const line = (
    <span className="flex w-full items-center justify-between gap-(--sp-inline) text-xs">
      <span className="flex min-w-0 items-center gap-(--sp-inline)">
        {swatch && (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-xs"
            style={{ background: swatch }}
          />
        )}
        <span className="min-w-0 truncate text-neutral-700">{row.label}</span>
      </span>
      <span className="shrink-0 tabular-nums text-neutral-500">
        {row.count.toLocaleString()} ({Math.round(row.pct)}%)
      </span>
    </span>
  );

  // Nothing to honour a click, so the row is a line of text rather than a
  // control that promises a destination it does not have.
  if (!onSelect) return <li className="px-1 py-1">{line}</li>;

  return (
    <li>
      <ListRow
        as="button"
        density="compact"
        onClick={onSelect}
        // The row names its destination *and* its filter before it is taken —
        // this list leaves the tab, and a reader should not discover that
        // mid-navigation.
        ariaLabel={`Open Members filtered by ${row.label} — ${row.count.toLocaleString()} of ${denominator}`}
      >
        {line}
      </ListRow>
    </li>
  );
};

/**
 * Renders the MFA scan trigger, its enrollment and factor-type reports once a
 * scan completes, and the large-group confirmation `Modal`.
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
 *   onFilterMembers={filterMembersBy}
 * />
 * ```
 *
 * @param props - See {@link GroupMfaCoverageSectionProps}.
 */
const GroupMfaCoverageSection: React.FC<GroupMfaCoverageSectionProps> = ({
  members,
  mfaResults,
  scanStatus,
  onRunScan,
  onRequestConfirm,
  onCancelConfirm,
  onFilterMembers,
}) => {
  const handleScanClick = (): void => {
    if (mfaScanNeedsConfirm(members.length)) onRequestConfirm();
    else onRunScan();
  };

  const enrollment = useMemo(
    () => computeMfaEnrollment(members, mfaResults),
    [members, mfaResults],
  );
  const factorTypes = useMemo(
    () => computeMfaFactorTypes(members, mfaResults),
    [members, mfaResults],
  );

  // Reported only once the scan has run to completion. A scan still in flight has
  // a partial map, and a card built on it would restate its own figures every few
  // hundred milliseconds as results land.
  const reported = scanStatus === 'complete' && enrollment !== null && factorTypes !== null;
  const scannedLabel = enrollment ? `${enrollment.scanned.toLocaleString()} scanned` : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* `min-w-0 flex-1`, so the paragraph is a sized column rather than a
            plain flex item that re-wraps every time the button's label changes
            length (D-053d). */}
        <p className="min-w-0 flex-1 text-sm text-neutral-600">
          {reported
            ? `Scanned ${enrollment.scanned.toLocaleString()} of ${enrollment.total.toLocaleString()} members.`
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

      {reported && (
        <div className="grid grid-cols-1 gap-(--sp-rung) sm:grid-cols-2">
          <InsightCard
            title={(titleId) => (
              <span id={titleId} className="truncate text-sm font-semibold text-neutral-900">
                Enrollment
              </span>
            )}
            subject="MFA enrollment"
            revealName="bucket breakdown"
            badges={
              mfaSignals(enrollment).length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {mfaSignals(enrollment).map((signal) => (
                    <li key={signal.kind}>
                      <Badge variant={SIGNAL_VARIANT[signal.kind]} title={signal.description}>
                        {signal.label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : undefined
            }
            headline={
              <>
                <SpreadBar
                  segments={mfaEnrollmentSegments(enrollment.rows).map(({ row, background }) => ({
                    key: row.value,
                    background,
                    count: row.count,
                    title: `${row.label} — ${row.count.toLocaleString()} (${Math.round(row.pct)}%)`,
                  }))}
                />
                <p className="text-xs text-neutral-600">
                  Every member in exactly one bucket, over the {scannedLabel}.
                </p>
              </>
            }
          >
            {/* All three buckets are named even when one is empty: "nobody is
              here" is an answer worth stating in words, and a bucket that
              vanished would read as a bucket that was never measured. */}
            <ul className="space-y-1">
              {enrollment.rows.map((row) => (
                <DistributionRow
                  key={row.value}
                  row={row}
                  swatch={MFA_ENROLLMENT_PAINT[row.value]}
                  denominator={scannedLabel}
                  onSelect={
                    onFilterMembers && row.count > 0
                      ? () =>
                          onFilterMembers({
                            dimension: 'mfa',
                            value: row.value,
                            label: `MFA: ${row.label}`,
                          })
                      : undefined
                  }
                />
              ))}
            </ul>
          </InsightCard>

          <InsightCard
            title={(titleId) => (
              <span id={titleId} className="truncate text-sm font-semibold text-neutral-900">
                Factor types
              </span>
            )}
            subject="MFA factor types"
            revealName="factor list"
            badges={
              factorTypes.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  <li>
                    <Badge
                      variant="neutral"
                      title="Distinct active factor types held by at least one scanned member."
                    >
                      {factorTypes.length} type{factorTypes.length === 1 ? '' : 's'} in use
                    </Badge>
                  </li>
                </ul>
              ) : undefined
            }
            /* No bar. A member can hold several of these, so the counts do not
               partition the group and there is no whole for a proportion bar to
               be a proportion *of*. */
            headline={
              <p className="text-xs text-neutral-600">
                {factorTypes.length === 0
                  ? `No scanned member holds an active factor, over the ${scannedLabel}.`
                  : `Held across the ${scannedLabel}. A member can hold more than one.`}
              </p>
            }
          >
            {factorTypes.length === 0 ? (
              <p className="text-xs text-neutral-500">
                The scan completed and found no active factor on any member it reached.
              </p>
            ) : (
              <>
                <ul className="space-y-1">
                  {factorTypes.map((row) => (
                    <DistributionRow
                      key={row.value}
                      row={row}
                      denominator={scannedLabel}
                      onSelect={
                        onFilterMembers
                          ? () =>
                              onFilterMembers({
                                dimension: 'mfa',
                                value: row.value,
                                label: `MFA: Has ${row.label}`,
                              })
                          : undefined
                      }
                    />
                  ))}
                </ul>
                <p className="border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                  Members can hold more than one factor, so these do not sum to the group.
                </p>
              </>
            )}
          </InsightCard>
        </div>
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
