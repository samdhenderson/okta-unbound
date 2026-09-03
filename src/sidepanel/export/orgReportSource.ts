/**
 * @module sidepanel/export/orgReportSource
 * @description The snapshot join behind Home's reports, as an export row source.
 *
 * One question over rows the org snapshot already holds, so an export from here
 * costs **zero requests** (ADR-0065 §3). Nothing in this module fetches, syncs,
 * or tops up: it is handed an
 * {@link module:sidepanel/export/snapshot.OrgSnapshotView}, which exposes no
 * `sync` to call.
 *
 * ## Nothing here re-decides an honesty rule
 *
 * The joins are
 * {@link module:sidepanel/components/groups/ruleOrphans}'s, unchanged and
 * uncapped — `REPORT_PREVIEW_LIMIT` is a Home *presentation* rule and does not
 * follow the rows anywhere, which is the whole point of the export. The verdict
 * on whether a number may be published is
 * {@link module:sidepanel/components/home/homeReports.resolveReportCount},
 * the same function `buildReport` calls, with the identical
 * `counted` / `gates` / `floors` roles `useHomeReports` declares. A report whose
 * gate was not read yields **no rows**, not a short list.
 *
 * ## Every row is re-validated, because disk is not trust
 *
 * Snapshot rows are cached Okta responses sitting in plaintext IndexedDB, and a
 * round-trip through disk makes none of them trustworthy (ADR-0006,
 * ADR-0065 §4). So the join parses them in memory with the same `parseOktaList`
 * path the wire uses, dropping and counting malformed rows identically. Group
 * names and app labels are end-user-authored; they reach the CSV only through
 * `escapeCSV`, and they never reach the logger.
 *
 * ## The caveat is a cell, not chrome
 *
 * Both the caveat and the completeness note ride on every row rather than
 * sitting in a `#`-prefixed preamble: a preamble is not RFC 4180, and it is the
 * first thing discarded when someone sorts, filters, or pastes a subset into a
 * ticket. ADR-0067 §5 permits exporting the dormant-access findings *because*
 * the claim travels with the rows.
 */

import { z } from 'zod';
import { parseOktaList } from '@/shared/schemas/okta';
import { splitShardedId } from '@/shared/snapshot/types';
import { formatDateShort } from '@/shared/utils/dateFormat';
import {
  appNamesByGroup,
  dormantAccessCaveat,
  dormantAnchorNote,
  findCleanupCandidates,
  findDormantAccess,
  findUnmaintainedAppAccess,
  groupIdsFilledByRules,
  resolveDormantAnchor,
  APP_ACCESS_CAVEAT,
  CLEANUP_CAVEAT,
  DORMANT_ACCESS_CAVEAT_UNANCHORED,
  type GroupFinding,
  type OrphanCandidateGroup,
} from '@/sidepanel/components/groups/ruleOrphans';
import { resolveReportCount } from '@/sidepanel/components/home/homeReports';
import type { CountResolution, NamedSource } from '@/sidepanel/components/home/orgFigures';
import { collectionSource, type OrgSnapshotView } from './snapshot';
import type { SnapshotRows } from './types';

/**
 * One exported finding.
 *
 * Five flat cells, and the last two are not decoration. `caveat` is constant
 * across the file and states what the join cannot see; `completeness` is the
 * resolution's own note and is blank unless the answer is a floor. A CSV that
 * drops either one reads as a delete list the moment it lands in a spreadsheet.
 */
export const reportRowSchema = z.object({
  /** Okta group id — the deep-link target. */
  groupId: z.string(),
  /** Group name, exactly as Home names it. Tenant data; escaped on the way out. */
  groupName: z.string(),
  /** The one-line explanation Home shows under the name. */
  finding: z.string(),
  /** What this report cannot see. Constant across rows. */
  caveat: z.string(),
  /** The resolution's completeness note, or `''` when the answer is complete. */
  completeness: z.string(),
});

/** A single exported finding row. */
export type ReportRow = z.infer<typeof reportRowSchema>;

/**
 * The `columnCatalog` id of the completeness column.
 *
 * Named once and referenced by every report descriptor's
 * {@link module:sidepanel/export/types.EntityRowSource} so the id the engine
 * force-appends on a `partial` resolution cannot drift from the id the catalog
 * declares.
 */
export const COMPLETENESS_COLUMN_ID = 'completeness';

/**
 * Only the fields these joins read, validated. Everything else passes through
 * untouched and unread.
 *
 * Every optional field is `.nullish().catch(undefined)` on the
 * {@link module:shared/schemas/okta.oktaAppListItemSchema} precedent: a row that
 * fails validation is *dropped*, so an unexpected `null` on a field this join
 * only reads defensively would cost the report a whole group.
 */
const snapshotGroupSchema = z
  .object({
    id: z.string(),
    type: z.string().nullish().catch(undefined),
    profile: z
      .object({ name: z.string().nullish().catch(undefined) })
      .passthrough()
      .nullish()
      .catch(undefined),
    _embedded: z
      .object({
        stats: z
          .object({ usersCount: z.number().nullish().catch(undefined) })
          .passthrough()
          .nullish()
          .catch(undefined),
      })
      .passthrough()
      .nullish()
      .catch(undefined),
    lastMembershipUpdated: z.string().nullish().catch(undefined),
  })
  .passthrough();

/** Only the assignments a rule contributes. */
const snapshotRuleSchema = z
  .object({
    actions: z
      .object({
        assignUserToGroups: z
          .object({ groupIds: z.array(z.string()).nullish().catch(undefined) })
          .passthrough()
          .nullish()
          .catch(undefined),
      })
      .passthrough()
      .nullish()
      .catch(undefined),
  })
  .passthrough();

/** Only what names an app. */
const snapshotAppSchema = z
  .object({
    id: z.string(),
    label: z.string().nullish().catch(undefined),
    name: z.string().nullish().catch(undefined),
  })
  .passthrough();

/** The validated, projected inputs every report on this snapshot shares. */
interface JoinInputs {
  /** Group rows in the joins' own input shape. */
  candidates: OrphanCandidateGroup[];
  /** Group ids some rule assigns users to. */
  filled: Set<string>;
  /** Group id → the names of the apps assigned to it. */
  appsByGroup: Map<string, string[]>;
  /** Group ids with a stored app assignment. */
  appLinked: Set<string>;
  /** Rows dropped for failing schema validation, across all four collections. */
  dropped: number;
  /** The collections, named as `resolveCount`'s sentences name them. */
  groups: NamedSource;
  rules: NamedSource;
  apps: NamedSource;
  appGroups: NamedSource;
  /** Epoch millis of the last completed group walk, or `null`. */
  lastGroupWalkAt: number | null;
}

/**
 * Validate and project the snapshot into the shape the joins take.
 *
 * The `?? 0` and `|| id` fallbacks match `toGroupSummary` exactly, so a group
 * named in an exported row is named the same way on the tab that row deep-links
 * to.
 *
 * @param snapshot - The mounted collections, read-only.
 * @returns The validated join inputs plus the drop count.
 */
export function readJoinInputs(snapshot: OrgSnapshotView): JoinInputs {
  const rawGroups = snapshot.groups.rows;
  const rawRules = snapshot.rules.rows;
  const rawApps = snapshot.apps.rows;

  const groupRows = parseOktaList(snapshotGroupSchema, rawGroups, 'SNAPSHOT report groups');
  const ruleRows = parseOktaList(snapshotRuleSchema, rawRules, 'SNAPSHOT report rules');
  const appRows = parseOktaList(snapshotAppSchema, rawApps, 'SNAPSHOT report apps');

  const dropped =
    rawGroups.length -
    groupRows.length +
    (rawRules.length - ruleRows.length) +
    (rawApps.length - appRows.length);

  const candidates: OrphanCandidateGroup[] = groupRows.map((group) => ({
    id: group.id,
    name: group.profile?.name || group.id,
    memberCount: group._embedded?.stats?.usersCount ?? 0,
    type: group.type ?? undefined,
    lastMembershipUpdated: group.lastMembershipUpdated ?? undefined,
  }));

  const filled = groupIdsFilledByRules(
    ruleRows.map((rule) => ({ groupIds: rule.actions?.assignUserToGroups?.groupIds ?? [] })),
  );

  const appNames = new Map<string, string>();
  for (const app of appRows) appNames.set(app.id, app.label || app.name || app.id);

  const recordIds = snapshot.appGroups.records.map((record) => record.id);
  const appsByGroup = appNamesByGroup(recordIds, appNames);

  const appLinked = new Set<string>();
  for (const recordId of recordIds) {
    const split = splitShardedId(recordId);
    if (split) appLinked.add(split.entityId);
  }

  return {
    candidates,
    filled,
    appsByGroup,
    appLinked,
    dropped,
    groups: { source: collectionSource(snapshot.groups), noun: 'groups' },
    rules: { source: collectionSource(snapshot.rules), noun: 'group rules' },
    apps: { source: collectionSource(snapshot.apps), noun: 'applications' },
    appGroups: { source: collectionSource(snapshot.appGroups), noun: 'app group assignments' },
    lastGroupWalkAt: snapshot.groups.lastFullWalkAt,
  };
}

/**
 * Turn findings plus a verdict into export rows.
 *
 * Two rules are enforced here rather than trusted to callers:
 *
 * - **`value === null` yields no rows.** Not an empty CSV — no export at all;
 *   the tab renders the sentence instead of a Download control. The findings
 *   were computed from whatever rows happened to be on disk, and a collection
 *   that cannot support a count cannot support a list of names either.
 * - **A `partial` verdict writes its own note onto every row.** The cell is the
 *   resolution's `note`, never a descriptor-authored sentence: the note names
 *   *which* collection fell short, and a hand-written string could not.
 *
 * @param findings - The join's output, uncapped.
 * @param caveat - What this report cannot see.
 * @param resolution - The verdict from `resolveReportCount`.
 * @param dropped - Snapshot rows dropped in validation.
 * @returns The rows, the verdict, and the drop count.
 */
function toSnapshotRows(
  findings: readonly GroupFinding[],
  caveat: string,
  resolution: CountResolution,
  dropped: number,
): SnapshotRows<ReportRow> {
  const completeness = resolution.status === 'partial' ? (resolution.note ?? '') : '';
  const rows =
    resolution.value === null
      ? []
      : findings.map((finding) => ({
          groupId: finding.id,
          groupName: finding.name,
          finding: finding.detail,
          caveat,
          completeness,
        }));
  return { rows, resolution, dropped };
}

/**
 * *Empty groups nothing fills*, as export rows.
 *
 * Both other collections are read to **exclude** groups, so both are gates: a
 * half-read rule list would report the groups its missing pages fed as
 * unfilled, and a half-read assignment list would report a group holding an app
 * open as carrying no access at all.
 *
 * @param snapshot - The mounted collections.
 * @returns Rows and verdict.
 */
export function readGroupCleanupRows(snapshot: OrgSnapshotView): SnapshotRows<ReportRow> {
  const input = readJoinInputs(snapshot);
  const findings = findCleanupCandidates(input.candidates, input.filled, input.appLinked);
  const resolution = resolveReportCount({
    counted: input.groups,
    gates: [input.rules, input.appGroups],
    count: findings.length,
  });
  return toSnapshotRows(findings, CLEANUP_CAVEAT, resolution, input.dropped);
}

/**
 * *App access no rule maintains*, as export rows.
 *
 * The population comes *out of* the assignments, so an unfinished assignment
 * walk shortens this list without corrupting it — a floor, and every row says
 * "at least". The app inventory rides along because it supplies the names.
 * Rules stay a gate: they are subtracted.
 *
 * @param snapshot - The mounted collections.
 * @returns Rows and verdict.
 */
export function readUnmaintainedAppAccessRows(snapshot: OrgSnapshotView): SnapshotRows<ReportRow> {
  const input = readJoinInputs(snapshot);
  const findings = findUnmaintainedAppAccess(input.candidates, input.filled, input.appsByGroup);
  const resolution = resolveReportCount({
    counted: input.groups,
    floors: [input.appGroups, input.apps],
    gates: [input.rules],
    count: findings.length,
  });
  return toSnapshotRows(findings, APP_ACCESS_CAVEAT, resolution, input.dropped);
}

/**
 * *App access with no membership change in N months*, as export rows.
 *
 * The strongest claim the panel makes, and ADR-0067 bounds it. Two things carry
 * over verbatim from the Home row rather than being restated: the clock is the
 * **anchor** — the last complete group read, never `Date.now()` — and a missing
 * or stale anchor **suppresses** the report outright rather than softening its
 * wording, which here means no rows and no Download control.
 *
 * ADR-0067 §5 permits this export specifically because
 * {@link module:sidepanel/components/groups/ruleOrphans.dormantAccessCaveat}
 * rides along as a cell on every row. Read-only egress is not a mutating verb;
 * a caveat stripped by the trip would make it one.
 *
 * @param snapshot - The mounted collections.
 * @param now - Injected clock, for testability. Decides only whether the anchor
 * is fresh enough to certify anything; every dormancy interval is measured
 * against the anchor itself (ADR-0067 §3).
 * @returns Rows and verdict.
 */
export function readDormantAccessRows(
  snapshot: OrgSnapshotView,
  now: number = Date.now(),
): SnapshotRows<ReportRow> {
  const input = readJoinInputs(snapshot);
  const anchor = resolveDormantAnchor(input.lastGroupWalkAt, now);
  const findings = anchor.usable
    ? findDormantAccess(input.candidates, input.filled, input.appsByGroup, anchor.at)
    : [];
  const resolution = resolveReportCount(
    {
      counted: input.groups,
      floors: [input.appGroups, input.apps],
      gates: [input.rules],
      count: findings.length,
    },
    anchor.usable ? undefined : dormantAnchorNote(anchor.reason, formatDateShort(anchor.at)),
  );
  const caveat = anchor.usable
    ? dormantAccessCaveat(formatDateShort(anchor.at))
    : DORMANT_ACCESS_CAVEAT_UNANCHORED;
  return toSnapshotRows(findings, caveat, resolution, input.dropped);
}
