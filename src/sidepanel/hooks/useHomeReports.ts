/**
 * @module sidepanel/hooks/useHomeReports
 * @description The Home tab's reports, derived from rows already on disk.
 *
 * Reads nothing of its own and issues nothing. The collections are mounted once
 * by {@link module:sidepanel/hooks/useOrgEntityIndex} for the jump bar and
 * shared with {@link module:sidepanel/hooks/useOrgFigures}, so every report is a
 * join over the same handles: **zero requests, zero extra IndexedDB reads,
 * zero extra broadcast listeners.** The dormant report is free for the same
 * reason as the others — `lastMembershipUpdated` is already on the group rows
 * the snapshot holds, and `lastFullWalkAt` is already on the handle.
 *
 * There is no sync ladder here for the same reason. `useOrgFigures` already owns
 * the one top-up Home is allowed to spend per mount; a second consumer deciding
 * independently that the snapshot looked stale would double it.
 *
 * The joins live in {@link module:sidepanel/components/groups/ruleOrphans} and
 * the honesty rules in {@link module:sidepanel/components/home/homeReports},
 * both pure. What is left here is the projection from snapshot rows onto their
 * inputs — and the two details that only exist at this layer: an app-group
 * assignment's app is recoverable only from the snapshot's compound record id,
 * so this reads `records`, never `rows`; and the dormant report's clock is read
 * off the group handle's `lastFullWalkAt` here and passed down, so the pure
 * module never reaches for a wall clock of its own (ADR-0067 §3).
 */
import { useMemo } from 'react';
import { buildReport, type HomeReport } from '../components/home/homeReports';
import {
  appNamesByGroup,
  findUnmaintainedAppAccess,
  groupIdsFilledByRules,
  APP_ACCESS_CAVEAT,
  type OrphanCandidateGroup,
} from '../components/groups/ruleOrphans';
import { pluralize } from '../../shared/utils/plural';
import {
  figureStatus,
  type FigureSource,
  type OrgFigureStatus,
} from '../components/home/orgFigures';
import type { EntityChoice } from '../components/home/EntityChooser';
import type { OrgEntityIndex } from './useOrgEntityIndex';

/** What {@link useHomeReports} exposes. */
export interface UseHomeReportsResult {
  /** The report rows, in display order. */
  reports: HomeReport[];
  /**
   * Every group in the snapshot, as the MFA launcher's chooser offers them.
   *
   * The same projection the reports themselves count, so a group named by a
   * report and a group offered by the chooser cannot disagree about its name.
   * Uncapped on purpose: the chooser filters locally and states its own visible
   * cap, and truncating here would hide groups from a filter that could have
   * found them.
   */
  groupChoices: EntityChoice[];
  /**
   * Read state of the group collection behind
   * {@link UseHomeReportsResult.groupChoices} — whether a chooser may be offered
   * at all, and whether it has to admit to being partial.
   */
  groupChoicesStatus: OrgFigureStatus;
}

/** Options for {@link useHomeReports}. */
export interface UseHomeReportsOptions {
  /** The already-mounted snapshot handles. */
  index: OrgEntityIndex;
}

/** Project a snapshot handle onto the pure module's input shape. */
function toSource(snapshot: {
  isReading: boolean;
  complete: boolean;
  lastFullWalkAt: number | null;
  rows: unknown[];
  error: string | null;
}): FigureSource {
  return {
    isReading: snapshot.isReading,
    complete: snapshot.complete,
    lastFullWalkAt: snapshot.lastFullWalkAt,
    count: snapshot.rows.length,
    error: snapshot.error,
  };
}

/**
 * Derive the Home tab's report rows.
 *
 * @param options - See {@link UseHomeReportsOptions}.
 * @returns See {@link UseHomeReportsResult}.
 */
export function useHomeReports({ index }: UseHomeReportsOptions): UseHomeReportsResult {
  const { groups, rules, apps, appGroups } = index;

  // `?? 0` and `|| id` match `toGroupSummary` exactly, so a group named here is
  // named the same way on the tab this row sends the reader to.
  const candidates = useMemo<OrphanCandidateGroup[]>(
    () =>
      groups.rows.map((group) => ({
        id: group.id,
        name: group.profile?.name || group.id,
        memberCount: group._embedded?.stats?.usersCount ?? 0,
        type: group.type,
        lastMembershipUpdated: group.lastMembershipUpdated,
      })),
    [groups.rows],
  );

  const filled = useMemo(
    () =>
      groupIdsFilledByRules(
        rules.rows.map((rule) => ({ groupIds: rule.actions?.assignUserToGroups?.groupIds ?? [] })),
      ),
    [rules.rows],
  );

  const appNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const app of apps.rows) names.set(app.id, app.label || app.name || app.id);
    return names;
  }, [apps.rows]);

  const byGroup = useMemo(
    () =>
      appNamesByGroup(
        appGroups.records.map((record) => record.id),
        appNames,
      ),
    [appGroups.records, appNames],
  );

  // Reuses the report rows' own projection, so the chooser and the reports name
  // the same group the same way. `memberCount` is the snapshot's embedded stat,
  // which is exactly the fact that decides whether a coverage scan is cheap.
  const groupChoices = useMemo<EntityChoice[]>(
    () =>
      candidates.map((group) => ({
        id: group.id,
        name: group.name,
        detail: pluralize(group.memberCount, 'members'),
      })),
    [candidates],
  );

  const groupSource = toSource(groups);
  const ruleSource = toSource(rules);
  const appSource = toSource(apps);
  const appGroupSource = toSource(appGroups);

  const groupsNamed = { source: groupSource, noun: 'groups' };
  const rulesNamed = { source: ruleSource, noun: 'group rules' };
  const appsNamed = { source: appSource, noun: 'applications' };
  const appGroupsNamed = { source: appGroupSource, noun: 'app group assignments' };

  const reports = useMemo(
    () => [
      buildReport({
        key: 'unmaintained-app-access',
        label: 'App access no rule maintains',
        // The population comes *out of* the assignments, so an unfinished
        // assignment walk shortens this list without corrupting it — a floor,
        // and the row says "at least". The app inventory rides along because it
        // supplies the names. Rules stay a gate: they are subtracted.
        counted: groupsNamed,
        floors: [appGroupsNamed, appsNamed],
        gates: [rulesNamed],
        findings: findUnmaintainedAppAccess(candidates, filled, byGroup),
        caveat: APP_ACCESS_CAVEAT,
      }),
    ],
    // The four sources are fresh objects each render; their members are what
    // actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      candidates,
      filled,
      byGroup,
      groupSource.isReading,
      groupSource.complete,
      groupSource.lastFullWalkAt,
      groupSource.count,
      groupSource.error,
      ruleSource.isReading,
      ruleSource.complete,
      ruleSource.lastFullWalkAt,
      ruleSource.count,
      ruleSource.error,
      appSource.isReading,
      appSource.complete,
      appSource.lastFullWalkAt,
      appSource.count,
      appSource.error,
      appGroupSource.isReading,
      appGroupSource.complete,
      appGroupSource.lastFullWalkAt,
      appGroupSource.count,
      appGroupSource.error,
    ],
  );

  return { reports, groupChoices, groupChoicesStatus: figureStatus(groupSource) };
}
