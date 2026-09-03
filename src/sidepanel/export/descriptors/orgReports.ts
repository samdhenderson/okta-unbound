/**
 * @module sidepanel/export/descriptors/orgReports
 * @description Home's reports as Export Engine descriptors (ADR-0065).
 *
 * Three ordinary descriptors whose `context` is `whole-org` and whose rows
 * arrive from the org snapshot rather than a list endpoint. Each declares
 * `source: { kind: 'snapshot', … }`; nothing else about them is special, and no
 * descriptor that omits `source` was touched to make room for them.
 *
 * **One report is one descriptor**, not one `reports` descriptor scoped by a
 * report key. That earns each report a row in the entity hub — findable without
 * going through Home first — and lets its columns and caveat differ from its
 * neighbour's without a discriminated union inside a single descriptor.
 *
 * ## One catalog, one set of columns
 *
 * Home's report row renders the `Group` and `Finding` columns of this same
 * catalog; the CSV offers all five. The two extra columns are the honesty:
 * `Caveat` states what the join cannot see, and `Completeness` carries the
 * resolution's own note when the answer is a floor. Both are cells like any
 * other, so both go through `escapeCSV` — RFC 4180 quoting and the
 * formula-injection guard included. Group names are end-user-authored and reach
 * the CSV only that way.
 *
 * @see {@link module:sidepanel/export/orgReportSource} for the join and the verdict.
 */

import type { EntityExport, ExportColumn } from '../types';
import { dormantAccessLabel } from '../../components/groups/ruleOrphans';
import {
  readDormantAccessRows,
  readGroupCleanupRows,
  readUnmaintainedAppAccessRows,
  reportRowSchema,
  COMPLETENESS_COLUMN_ID,
  type ReportRow,
} from '../orgReportSource';

/**
 * The catalog every report shares.
 *
 * Built per descriptor rather than shared by reference so a future report can
 * add a column of its own without mutating its neighbours'.
 *
 * @returns The five columns, in CSV order.
 */
function reportColumns(): ExportColumn<ReportRow>[] {
  return [
    {
      id: 'group-id',
      label: 'Group ID',
      group: 'base',
      defaultEnabled: true,
      accessor: (row: ReportRow) => row.groupId,
      description: 'The Okta group id — the deep-link target.',
    },
    {
      id: 'group-name',
      label: 'Group',
      group: 'base',
      defaultEnabled: true,
      accessor: (row: ReportRow) => row.groupName,
      description: 'The group name, exactly as the Home report names it.',
    },
    {
      id: 'finding',
      label: 'Finding',
      group: 'base',
      defaultEnabled: true,
      accessor: (row: ReportRow) => row.finding,
      description: 'The one-line explanation shown under the name on Home.',
    },
    {
      id: 'caveat',
      label: 'Caveat',
      group: 'base',
      defaultEnabled: true,
      accessor: (row: ReportRow) => row.caveat,
      description:
        'What this report cannot see. Constant across rows, and on every row on ' +
        'purpose: a caveat that only appears once is the first thing lost when a ' +
        'subset is pasted into a ticket.',
    },
    {
      id: COMPLETENESS_COLUMN_ID,
      label: 'Completeness',
      group: 'base',
      defaultEnabled: true,
      accessor: (row: ReportRow) => row.completeness,
      description:
        'Blank when the answer is complete. When a collection behind it did not ' +
        'finish reading, this names the shortfall — and the column is included ' +
        'even if you turn it off.',
    },
  ];
}

/** The parts every report descriptor states identically. */
const REPORT_SHAPE = {
  context: { kind: 'whole-org' },
  // No endpoint, no query, no filter box: the rows are already on disk, and a
  // filter here would be a second, weaker version of the join itself.
  defaultQuery: {},
  schema: reportRowSchema,
  filter: { kind: 'none' },
  linkify: { entityType: 'group', idColumnId: 'group-id' },
} as const satisfies Partial<EntityExport<ReportRow>>;

/** *Empty groups nothing fills* — every finding, not the first 25. */
export const groupCleanupReportDescriptor: EntityExport<ReportRow> = {
  ...REPORT_SHAPE,
  id: 'report-group-cleanup',
  displayName: 'Report: Empty groups nothing fills',
  icon: 'chart',
  description:
    'Groups with no members that no rule fills and no app is assigned to. Findings, ' +
    'not a delete list — read the caveat column. Costs no requests.',
  columnCatalog: reportColumns(),
  source: {
    kind: 'snapshot',
    completenessColumnId: COMPLETENESS_COLUMN_ID,
    read: readGroupCleanupRows,
  },
};

/** *App access no rule maintains* — every finding. */
export const unmaintainedAppAccessReportDescriptor: EntityExport<ReportRow> = {
  ...REPORT_SHAPE,
  id: 'report-unmaintained-app-access',
  displayName: 'Report: App access no rule maintains',
  icon: 'app',
  description:
    'Groups that hold an app open and that no group rule fills. Findings, not a ' +
    'delete list — read the caveat column. Costs no requests.',
  columnCatalog: reportColumns(),
  source: {
    kind: 'snapshot',
    completenessColumnId: COMPLETENESS_COLUMN_ID,
    read: readUnmaintainedAppAccessRows,
  },
};

/**
 * *App access with no membership change in N months* — every finding. The
 * name is derived from {@link dormantAccessLabel} so the threshold in the label
 * can never drift from the threshold the join actually applies (ADR-0067 §1).
 *
 * Exported under ADR-0067 §5, which permits read-only egress from this report
 * precisely because its caveat rides along as a column. `read` takes the
 * snapshot alone; the anchor clock is resolved inside
 * {@link module:sidepanel/export/orgReportSource.readDormantAccessRows}.
 */
export const dormantAccessReportDescriptor: EntityExport<ReportRow> = {
  ...REPORT_SHAPE,
  id: 'report-dormant-app-access',
  displayName: `Report: ${dormantAccessLabel()}`,
  icon: 'clock',
  description:
    'Groups holding an app open into which no membership write has landed since the ' +
    'last complete read of your groups. Read the caveat column. Costs no requests.',
  columnCatalog: reportColumns(),
  source: {
    kind: 'snapshot',
    completenessColumnId: COMPLETENESS_COLUMN_ID,
    read: (snapshot) => readDormantAccessRows(snapshot),
  },
};

/**
 * All three, registered together.
 *
 * The registry accepts an array from one module so sibling descriptors that
 * share a row shape and a join can live in one file instead of three that only
 * re-export each other.
 */
export default [
  groupCleanupReportDescriptor,
  unmaintainedAppAccessReportDescriptor,
  dormantAccessReportDescriptor,
];
