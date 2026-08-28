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
import React, { useId, useState } from 'react';
import Eyebrow from '../shared/Eyebrow';
import Icon from '../shared/Icon';
import Skeleton from '../shared/Skeleton';
import StretchedButton from '../shared/StretchedButton';
import FigureNumber from './FigureNumber';
import type { HomeReport } from './homeReports';
import type { GroupFinding } from '../groups/ruleOrphans';

/** Props for {@link ReportsCard}. */
export interface ReportsCardProps {
  /** The report rows, in display order. */
  reports: HomeReport[];
  /** Open one of the named groups on the Groups tab. */
  onOpenGroup: (groupId: string) => void;
}

/** The title and the line under it — the same two lines a finding shows. */
const ReportLines: React.FC<{ report: HomeReport; id: string }> = ({ report, id }) => (
  <span className="flex min-w-0 flex-1 flex-col gap-px text-left">
    <span
      id={id}
      className={`text-sm ${
        report.value === null ? 'font-medium text-neutral-600' : 'font-semibold text-neutral-900'
      }`}
    >
      {report.label}
    </span>
    {report.note && (
      <span
        className={`text-xs ${
          report.status === 'partial' ? 'text-warning-text' : 'text-neutral-600'
        }`}
      >
        {report.note}
      </span>
    )}
  </span>
);

/**
 * One named entity inside an opened report.
 *
 * A {@link StretchedButton} rather than a wrapping `<button>`, so the name and
 * its explanation stay plain text and the row keeps its flush padding. `hover`
 * lands on white because the panel it sits in is already `neutral-50`.
 */
const FindingRow: React.FC<{ finding: GroupFinding; onOpen: (id: string) => void }> = ({
  finding,
  onOpen,
}) => {
  const nameId = useId();
  return (
    // Padding stays a raw `px-2 py-1.5` rather than the row roles: this is a
    // nested row inside an already-padded disclosure panel, deliberately
    // denser than a top-level row so the hierarchy reads. No `.press` on the
    // row itself — `StretchedButton` carries the response layer's press
    // feedback on its own `:active` (ADR-0046), since the overlay has no
    // visible box for a scale to read on.
    <li className="relative flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors duration-(--dur-instant) hover:bg-white">
      <StretchedButton
        label="Open this group"
        describedBy={nameId}
        onClick={() => onOpen(finding.id)}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={nameId} className="truncate text-sm font-medium text-neutral-900">
          {finding.name}
        </span>
        <span className="truncate text-xs text-neutral-600">{finding.detail}</span>
      </span>
      <Icon type="chevron-right" size="xs" className="shrink-0 text-neutral-400" />
    </li>
  );
};

/** The opened body: the caveat, the names, and — when capped — how many are missing. */
const ReportPanel: React.FC<{
  report: HomeReport;
  id: string;
  onOpenGroup: (id: string) => void;
}> = ({ report, id, onOpenGroup }) => (
  <div id={id} className="border-t border-neutral-100 bg-neutral-50 p-(--sp-card)">
    <p className="text-xs text-neutral-600">{report.caveat}</p>
    <ul className="mt-2 space-y-px">
      {report.findings.map((finding) => (
        <FindingRow key={finding.id} finding={finding} onOpen={onOpenGroup} />
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
  </div>
);

/**
 * One report row: a disclosure when there is something to open, plain text when
 * there is not.
 *
 * The header is a real `<button>` wrapping the row's own content, which is valid
 * here and is not in the org card: a report has no controls of its own until it
 * is open, and everything that *is* a control lives in the panel, outside the
 * button. That buys `aria-expanded`/`aria-controls` with no extra element.
 */
const Report: React.FC<{ report: HomeReport; onOpenGroup: (id: string) => void }> = ({
  report,
  onOpenGroup,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const labelId = `home-report-${report.key}`;
  const panelId = `home-report-panel-${report.key}`;

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
        <ReportLines report={report} id={labelId} />
      </li>
    );
  }

  return (
    <li>
      {/* `.press press-subtle` (ADR-0046): this button IS the row, so `:active`
          applies directly — the same treatment `ListRow` now gives an
          interactive row, and the `active:brightness-90` step `Button`/
          `IconButton` add for the third, darker press state Odyssey specifies
          beyond hover. Its own transition replaces `transition-colors` so the
          two don't fight over the `transition` longhands. */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className="press press-subtle flex w-full items-stretch gap-3 px-(--sp-row-x) py-(--sp-row-y) hover:bg-neutral-50 active:brightness-90 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <FigureNumber value={report.value} />
        <ReportLines report={report} id={labelId} />
        <Icon
          type="chevron-down"
          size="xs"
          className={`shrink-0 self-center text-neutral-400 transition-transform duration-(--dur-quick) ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && <ReportPanel report={report} id={panelId} onOpenGroup={onOpenGroup} />}
    </li>
  );
};

/**
 * Render the reports card.
 *
 * @param props - See {@link ReportsCardProps}.
 */
const ReportsCard: React.FC<ReportsCardProps> = ({ reports, onOpenGroup }) => (
  <section aria-label="Reports" className="space-y-2">
    <Eyebrow as="h3">Reports</Eyebrow>
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200 bg-white">
      {reports.map((report) => (
        <Report key={report.key} report={report} onOpenGroup={onOpenGroup} />
      ))}
    </ul>
  </section>
);

export default ReportsCard;
