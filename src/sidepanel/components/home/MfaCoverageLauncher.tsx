/**
 * @module sidepanel/components/home/MfaCoverageLauncher
 * @description Home's third report row, and the only one that is not free: MFA
 * coverage for a group.
 *
 * The two rows above it are joins over rows already on disk, so they can state a
 * number for the whole org at no cost. Coverage cannot be — it is a factor read
 * per member — so this row inverts the shape. Instead of a number with a list
 * behind it, it is a **scope first**: choose a group from the snapshot (zero
 * requests, no search per keystroke), then land on that group's Insights pane
 * with the scan armed and deliberately *not* started.
 *
 * That inversion is the whole design. A row that ran the scan for you would
 * either pick the group itself or walk the org; a row that only linked to the
 * Groups tab would make the reader re-find the group they were just told about.
 * Choosing here and starting there keeps the cost visible at both ends.
 *
 * Group names are tenant data and are rendered through React's escaping. This
 * module fetches nothing and logs nothing.
 */
import React from 'react';
import Icon from '../shared/Icon';
import Skeleton from '../shared/Skeleton';
import EntityChooser, { type EntityChoice } from './EntityChooser';
import { RowDisclosure, RowLines } from './ReportRow';
import { MFA_PARTIAL_NOTE, MFA_SCAN_CAVEAT, MFA_UNAVAILABLE_NOTE } from './homeReports';
import type { OrgFigureStatus } from './orgFigures';

/** Props for {@link MfaCoverageLauncher}. */
export interface MfaCoverageLauncherProps {
  /** Every group the org snapshot holds, already in memory. */
  choices: EntityChoice[];
  /** Read state of the collection behind {@link MfaCoverageLauncherProps.choices}. */
  status: OrgFigureStatus;
  /** Open the chosen group's Insights pane with its scan armed and un-run. */
  onScan: (groupId: string) => void;
}

/**
 * The left column when a row heads a launcher rather than a count.
 *
 * A glyph, not an em dash: the dash is this card's word for "no collection can
 * support a number here", and the launcher's answer is not missing — it is
 * unasked. Sized to the same `2.6ch` column {@link FigureNumber} reserves so the
 * sentences beside every row still share one left edge.
 */
const LauncherGlyph: React.FC = () => (
  <span className="flex shrink-0 items-center self-stretch">
    <span className="flex min-w-[2.6ch] justify-end">
      <Icon type="shield" size="lg" className="text-neutral-400" />
    </span>
  </span>
);

/**
 * The MFA-coverage launcher: the card's one row whose answer is not free.
 *
 * @param props - See {@link MfaCoverageLauncherProps}.
 *
 * Scope first. The chooser reads the groups the snapshot already holds — zero
 * requests, no search per keystroke — and picking one lands on that group's
 * Insights pane with the scan armed and **not** started. The cost is stated on
 * the way in rather than discovered on arrival.
 */
const MfaCoverageLauncher: React.FC<MfaCoverageLauncherProps> = ({ choices, status, onScan }) => {
  if (status === 'reading') {
    return (
      <li className="px-(--sp-row-x) py-(--sp-row-y)">
        <Skeleton variant="text" size="sm" width="w-3/4" label="Reading groups" />
      </li>
    );
  }

  // Nothing to choose from. Recessed and inert rather than an empty chooser: a
  // filter field over zero rows reads as "this org has no groups", which is the
  // partial-served-as-complete defect wearing a control's clothes.
  if (status === 'unavailable' || choices.length === 0) {
    return (
      <li className="flex items-stretch gap-3 bg-neutral-50 px-(--sp-row-x) py-(--sp-row-y)">
        <LauncherGlyph />
        <RowLines
          label="MFA coverage for a group"
          note={MFA_UNAVAILABLE_NOTE}
          id="home-report-mfa-coverage"
          recessed
        />
      </li>
    );
  }

  return (
    <RowDisclosure
      rowKey="mfa-coverage"
      figure={<LauncherGlyph />}
      label="MFA coverage for a group"
      note="Pick a group — nothing is read until you do."
      warn={status === 'partial'}
    >
      <p className="text-xs text-neutral-600">{MFA_SCAN_CAVEAT}</p>
      {status === 'partial' && <p className="mt-1 text-xs text-warning-text">{MFA_PARTIAL_NOTE}</p>}
      <div className="mt-2">
        <EntityChooser
          choices={choices}
          filterLabel="Filter groups"
          actionLabel="Scan MFA coverage for this group"
          onChoose={onScan}
          emptyLabel="No group matches that name."
        />
      </div>
    </RowDisclosure>
  );
};

export default MfaCoverageLauncher;
