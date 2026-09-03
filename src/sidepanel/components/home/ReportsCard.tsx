/**
 * @module sidepanel/components/home/ReportsCard
 * @description Home's fourth region: the questions whose answer is a list of
 * names rather than a number.
 *
 * The same row idiom as the org card directly above it — a number column, a
 * sentence, one bordered surface with hairline separators — because they are two
 * halves of the same reading. The difference is what pressing a row does. A
 * finding sends you to a filtered list; a report **opens in place**, because the
 * dozen or so groups it names are the whole answer and a tab switch to read them
 * would be ceremony.
 *
 * Every report here is a join over rows the snapshot already holds, so opening
 * one costs nothing.
 *
 * ## A report that cannot state a number names nobody
 *
 * The three non-control states are the org card's, for the same reasons: a
 * skeleton while the collections are still being read, and a recessed row with
 * an em dash and a sentence when one of them was never walked. In that last
 * state the row does not expand at all — the joins ran over whatever rows
 * happened to be on disk, and a list of names drawn from a half-read collection
 * is exactly the partial-served-as-complete defect ADR-0040 §7 exists to stop,
 * just spelled with names instead of a count.
 *
 * A report with **zero** findings is the opposite case and reads as one: a real,
 * trustworthy answer, shown as a plain row with nothing to open.
 *
 * ## The caveat is not fine print
 *
 * An admin reading "empty groups nothing fills" is one step from deleting them,
 * and this extension cannot see Okta Workflows, SCIM, an IdP sync, or a direct
 * API write. So the sentence saying so is inside the opened row, above the
 * names, every time — not in a tooltip, and not once at the top of the tab.
 *
 * Group names are tenant data and are rendered through React's escaping. This
 * component logs nothing.
 */
import React from 'react';
import Eyebrow from '../shared/Eyebrow';
import Skeleton from '../shared/Skeleton';
import { EntityChoiceRow, type EntityChoice } from './EntityChooser';
import FigureNumber from './FigureNumber';
import MfaCoverageLauncher from './MfaCoverageLauncher';
import { RowDisclosure, RowLines } from './ReportRow';
import type { HomeReport } from './homeReports';
import type { OrgFigureStatus } from './orgFigures';

/** Props for {@link ReportsCard}. */
export interface ReportsCardProps {
  /** The report rows, in display order. */
  reports: HomeReport[];
  /** Open one of the named groups on the Groups tab. */
  onOpenGroup: (groupId: string) => void;
  /**
   * Every group the org snapshot holds, for the MFA launcher's chooser. Already
   * in memory: this card never asks for them, and the chooser never searches
   * (see {@link module:sidepanel/components/home/EntityChooser}).
   */
  groupChoices: EntityChoice[];
  /**
   * Read state of the collection behind {@link ReportsCardProps.groupChoices},
   * which decides whether the launcher offers a chooser, a caveat beside one, or
   * nothing at all — the same honesty ladder the report rows follow.
   */
  groupChoicesStatus: OrgFigureStatus;
  /**
   * Open a group's Insights pane with its MFA-coverage scan armed and un-run.
   *
   * A verb, not a route: this card knows that picking a group *starts nothing*,
   * and deliberately not which pane on which tab that lands on.
   */
  onScanGroupMfa: (groupId: string) => void;
}

/** The opened body: the caveat, the names, and — when capped — how many are missing. */
const ReportPanel: React.FC<{
  report: HomeReport;
  onOpenGroup: (id: string) => void;
}> = ({ report, onOpenGroup }) => (
  <>
    <p className="text-xs text-neutral-600">{report.caveat}</p>
    <ul className="mt-2 space-y-px">
      {report.findings.map((finding) => (
        <EntityChoiceRow
          key={finding.id}
          choice={finding}
          actionLabel="Open this group"
          onChoose={onOpenGroup}
        />
      ))}
    </ul>
    {report.value !== null && report.value > report.findings.length && (
      // Stated, never silent. A list quietly cut to its first page reads as the
      // complete answer, which is the same lie the counts on this tab exist to
      // avoid.
      <p className="mt-2 text-xs text-neutral-600">
        Showing the first {report.findings.length.toLocaleString()} of{' '}
        {report.value.toLocaleString()}.
      </p>
    )}
  </>
);

/**
 * One report row: a disclosure when there is something to open, plain text when
 * there is not.
 */
const Report: React.FC<{ report: HomeReport; onOpenGroup: (id: string) => void }> = ({
  report,
  onOpenGroup,
}) => {
  const labelId = `home-report-${report.key}`;

  if (report.status === 'reading') {
    return (
      <li className="px-(--sp-row-x) py-(--sp-row-y)">
        <Skeleton variant="text" size="sm" width="w-3/4" label={`Reading ${report.label}`} />
      </li>
    );
  }

  // Nothing to open: either no collection can support the answer (em dash, and
  // recessed so it does not read as a finding), or the answer is genuinely none.
  if (report.value === null || report.findings.length === 0) {
    return (
      <li
        className={`flex items-stretch gap-3 px-(--sp-row-x) py-(--sp-row-y) ${
          report.value === null ? 'bg-neutral-50' : ''
        }`}
      >
        <FigureNumber value={report.value} />
        <RowLines
          label={report.label}
          note={report.note}
          id={labelId}
          recessed={report.value === null}
          warn={report.status === 'partial'}
        />
      </li>
    );
  }

  return (
    <RowDisclosure
      rowKey={report.key}
      figure={<FigureNumber value={report.value} />}
      label={report.label}
      note={report.note}
      warn={report.status === 'partial'}
    >
      <ReportPanel report={report} onOpenGroup={onOpenGroup} />
    </RowDisclosure>
  );
};

/**
 * Render the reports card.
 *
 * @param props - See {@link ReportsCardProps}.
 */
const ReportsCard: React.FC<ReportsCardProps> = ({
  reports,
  onOpenGroup,
  groupChoices,
  groupChoicesStatus,
  onScanGroupMfa,
}) => (
  <section aria-label="Reports" className="space-y-2">
    <Eyebrow as="h3">Reports</Eyebrow>
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200 bg-white">
      {reports.map((report) => (
        <Report key={report.key} report={report} onOpenGroup={onOpenGroup} />
      ))}
      {/* Last, and deliberately: the two rows above are answers, this one is a
          question the reader has to scope before it can be answered. */}
      <MfaCoverageLauncher
        choices={groupChoices}
        status={groupChoicesStatus}
        onScan={onScanGroupMfa}
      />
    </ul>
  </section>
);

export default ReportsCard;
