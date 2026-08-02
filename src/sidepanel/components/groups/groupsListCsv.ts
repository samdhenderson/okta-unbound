/**
 * @module sidepanel/components/groups/groupsListCsv
 * @description Pure builder for the Groups tab "export groups list" CSV.
 *
 * Produces the ID/Name/Description/Type/Member Count/Staleness Score/Push Status
 * table. Every cell goes through the shared {@link escapeCSV} guard, so
 * end-user-controllable values (group names, descriptions) get RFC 4180 quote
 * doubling plus the spreadsheet-formula-injection prefix. Cells are then
 * unconditionally quoted to preserve this export's long-standing byte format
 * (pinned by the GroupsTab characterization suite).
 */
import type { GroupSummary } from '../../../shared/types';
import { escapeCSV } from '../../../shared/utils/csvUtils';

/** Column headers of the groups-list export, in emission order. */
const HEADERS = [
  'ID',
  'Name',
  'Description',
  'Type',
  'Member Count',
  'Staleness Score',
  'Push Status',
];

/**
 * Escape one cell through the shared guard, then force the quote wrap.
 *
 * `escapeCSV` only wraps when RFC 4180 requires it; this export has always
 * quoted every cell, so an unwrapped result (which can never itself contain a
 * double quote — such values are already wrapped) is wrapped here to keep the
 * output format stable while still applying the formula-injection guard.
 */
function quoteCell(value: string | number): string {
  const escaped = escapeCSV(value);
  return escaped.startsWith('"') ? escaped : `"${escaped}"`;
}

/**
 * Build the groups-list CSV document for the given groups.
 *
 * Each group becomes one row; all cells are escaped through the shared
 * `escapeCSV` guard, neutralizing formula-injection payloads in
 * names/descriptions before the unconditional quote wrap.
 *
 * @param groups - The (already filtered) groups to export.
 * @returns The complete CSV text, ready for `downloadCSV`.
 */
export function buildGroupsListCsv(groups: GroupSummary[]): string {
  const rows = groups.map((g) => [
    g.id,
    g.name,
    g.description || '',
    g.type || '',
    g.memberCount ?? 0,
    g.staleness?.score ?? '',
    g.pushMappings?.length ? `Pushed (${g.pushMappings.length})` : 'Not Pushed',
  ]);
  return [HEADERS, ...rows].map((row) => row.map(quoteCell).join(',')).join('\n');
}
