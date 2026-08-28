/**
 * @module sidepanel/hooks/useOrgFigures
 * @description The Home tab's org snapshot card: the findings worth acting on,
 * the totals they came out of, their combined age, and the one control that
 * refreshes them.
 *
 * Reads nothing of its own. The collections are already mounted by
 * {@link module:sidepanel/hooks/useOrgEntityIndex} for the jump bar, so the card
 * costs **zero additional IndexedDB reads and zero additional broadcast
 * listeners** — it takes the same handles and derives numbers from them.
 *
 * ## The sub-counts are the point
 *
 * A headline count is trivia. What an admin can act on is the slice under it —
 * empty groups, groups no rule feeds, paused rules, deactivated apps, push apps
 * pushing nothing — and each of those is a join over rows already on disk, so
 * every one of them is free.
 *
 * Two of them are computed by *subtraction* — "groups no rule feeds" removes the
 * groups some rule targets, "pushing nothing" removes the apps with a stored
 * assignment — and that is where the honesty rules bite. A rule list missing
 * half its pages does not under-report those; it reports every group those
 * missing rules fed as unfed. So `subCountStatus` holds the subtracted-from
 * collection to a stricter bar than the counted one, and suppresses the number
 * rather than publishing a wrong one.
 *
 * ## What a visit to Home costs
 *
 * Warm, nothing: the rows are already on disk and `rows.length` is exact.
 *
 * When the figures are older than {@link ORG_FIGURES_MAX_AGE_MS}, the tab asks
 * the background to top them up on its first activation. That is `sync(false)`,
 * which ADR-0040's ladder resolves to **0–1 requests per collection** — a delta
 * where the org supports one, a single drift check otherwise, and nothing at all
 * where neither is needed. It is never a walk.
 *
 * The age floor is what keeps a tab you flick back to every few minutes from
 * spending a drift check each time. `Refresh` ignores it and forces a real walk,
 * because a person pressing Refresh is asking for exactly that.
 *
 * ## Figures never wait for each other
 *
 * Each collection settles independently, so the card fills in per figure rather
 * than in one block — and one collection failing costs the reader that figure
 * and no other. The honesty rules live in
 * {@link module:sidepanel/components/home/orgFigures}, which is pure.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildBox,
  buildFigure,
  buildSubCount,
  oldestWalkAt,
  type FigureSource,
  type OrgBox,
} from '../components/home/orgFigures';
import { countRulesByGroup } from '../../shared/rules/groupRuleIndex';
import { isGroupPushApp } from '../../shared/schemas/okta';
import { splitShardedId } from '../../shared/snapshot/types';
import type { OrgEntityIndex } from './useOrgEntityIndex';

/**
 * How old the figures may be before Home tops them up on activation.
 *
 * One hour. ADR-0040's ladder already decides *how much* freshening a
 * collection needs; this decides *whether to ask at all*, so a reader flicking
 * between tabs does not spend a drift check every time they pass through Home.
 */
export const ORG_FIGURES_MAX_AGE_MS = 60 * 60 * 1000;

/** What {@link useOrgFigures} exposes. */
export interface UseOrgFiguresResult {
  /**
   * One entry per collection, in display order: its total, and the findings
   * drawn from it. The card lists the findings and demotes the totals to a
   * caption.
   */
  boxes: OrgBox[];
  /**
   * Epoch millis of the oldest finished walk behind the card, or `null` when
   * some collection has never finished one — in which case the card states no
   * age rather than a misleading one.
   */
  readAt: number | null;
  /** `true` while a refresh requested from here is in flight. */
  isRefreshing: boolean;
  /** Force a full walk of every collection behind the card. */
  refresh: () => void;
  /** Whether a refresh can be issued at all (needs a connected Okta tab). */
  canRefresh: boolean;
}

/** Options for {@link useOrgFigures}. */
export interface UseOrgFiguresOptions {
  /** The already-mounted snapshot handles. */
  index: OrgEntityIndex;
  /** Whether Home is the tab on screen; gates the top-up (ADR-0018). */
  enabled: boolean;
  /** Whether a live Okta tab is connected; without one nothing can sync. */
  connected: boolean;
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
 * Derive the org snapshot card's state.
 *
 * @param options - See {@link UseOrgFiguresOptions}.
 * @returns See {@link UseOrgFiguresResult}.
 */
export function useOrgFigures({
  index,
  enabled,
  connected,
}: UseOrgFiguresOptions): UseOrgFiguresResult {
  const { groups, rules, apps, appGroups } = index;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const groupSource = toSource(groups);
  const ruleSource = toSource(rules);
  const appSource = toSource(apps);
  const appGroupSource = toSource(appGroups);

  const pausedRules = useMemo(
    () => rules.rows.filter((rule) => rule.status === 'INACTIVE').length,
    [rules.rows],
  );

  // `?? 0` matches `toGroupSummary` exactly, which is what the Groups tab's
  // `sizeFilter: 'empty'` runs against. Reading it any other way here would put
  // a number on the card that the list it opens then disagrees with.
  const emptyGroups = useMemo(
    () => groups.rows.filter((group) => (group._embedded?.stats?.usersCount ?? 0) === 0).length,
    [groups.rows],
  );

  // "No rules" means no rule ASSIGNS anyone to the group — the same
  // `hasRules` the Groups tab filters on. A group merely named in some other
  // rule's condition still has nothing filling it, which is why this reads the
  // assignment index rather than the reference one.
  const unruledGroups = useMemo(() => {
    const assigned = countRulesByGroup(
      rules.rows.map((rule) => ({ groupIds: rule.actions?.assignUserToGroups?.groupIds ?? [] })),
    );
    return groups.rows.filter((group) => (assigned.get(group.id) ?? 0) === 0).length;
  }, [groups.rows, rules.rows]);

  const inactiveApps = useMemo(
    () => apps.rows.filter((app) => app.status?.toUpperCase() !== 'ACTIVE').length,
    [apps.rows],
  );

  // Push apps with nothing stored against them. Scoped to `GROUP_PUSH` apps
  // because those are exactly the apps the snapshot walks
  // `/api/v1/apps/{id}/groups` for — for any other app an absent assignment
  // means nobody asked, and counting those would report the whole inventory.
  const idlePushApps = useMemo(() => {
    const withAssignments = new Set<string>();
    for (const record of appGroups.records) {
      const split = splitShardedId(record.id);
      if (split) withAssignments.add(split.shardKey);
    }
    return apps.rows.filter((app) => isGroupPushApp(app.features) && !withAssignments.has(app.id))
      .length;
  }, [apps.rows, appGroups.records]);

  // The nouns the findings and the totals caption speak in. Declared once so a
  // sentence and the caption under it cannot end up calling the same collection
  // two different things.
  const groupsNamed = { source: groupSource, noun: 'groups' };
  const appsNamed = { source: appSource, noun: 'applications' };
  const rulesNamed = { source: ruleSource, noun: 'group rules' };
  const appGroupsNamed = { source: appGroupSource, noun: 'app group assignments' };

  const boxes = useMemo(
    () => [
      buildBox(buildFigure('groups', 'Groups', 'users', groupSource), 'groups', 'groups', [
        buildSubCount({
          key: 'groups-empty',
          label: 'Groups with no members',
          counted: groupsNamed,
          count: emptyGroups,
          request: { tab: 'groups', view: 'empty' },
        }),
        buildSubCount({
          key: 'groups-unruled',
          label: 'Groups no rule fills',
          counted: groupsNamed,
          gates: [rulesNamed],
          count: unruledGroups,
          request: { tab: 'groups', view: 'no-rules' },
        }),
      ]),
      buildBox(buildFigure('apps', 'Applications', 'app', appSource), 'apps', 'applications', [
        buildSubCount({
          key: 'apps-inactive',
          label: 'Deactivated applications',
          counted: appsNamed,
          count: inactiveApps,
          request: { tab: 'apps', view: 'inactive' },
        }),
        buildSubCount({
          key: 'apps-idle-push',
          label: 'Push apps pushing nothing',
          counted: appsNamed,
          gates: [appGroupsNamed],
          count: idlePushApps,
          request: { tab: 'apps', view: 'pushes-nothing' },
        }),
      ]),
      buildBox(buildFigure('rules', 'Group rules', 'bolt', ruleSource), 'rules', 'group rules', [
        // A filter over the rules collection, so it inherits that collection's
        // trustworthiness rather than being judged on its own count — a paused
        // count of 0 from an unwalked org must not read as "none are paused".
        buildSubCount({
          key: 'rules-paused',
          label: 'Paused group rules',
          counted: rulesNamed,
          count: pausedRules,
          request: { tab: 'rules', view: 'paused' },
        }),
      ]),
    ],
    // Rebuilt from the four sources, which are fresh objects each render; the
    // members are what actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      groupSource.isReading,
      groupSource.complete,
      groupSource.lastFullWalkAt,
      groupSource.count,
      groupSource.error,
      appSource.isReading,
      appSource.complete,
      appSource.lastFullWalkAt,
      appSource.count,
      appSource.error,
      ruleSource.isReading,
      ruleSource.complete,
      ruleSource.lastFullWalkAt,
      ruleSource.count,
      ruleSource.error,
      appGroupSource.isReading,
      appGroupSource.complete,
      appGroupSource.lastFullWalkAt,
      appGroupSource.count,
      appGroupSource.error,
      emptyGroups,
      unruledGroups,
      inactiveApps,
      idlePushApps,
      pausedRules,
    ],
  );

  // `appGroups` is deliberately absent from the age: it is a derived collection
  // that only re-walks every six hours, so quoting it would date the whole card
  // by the slowest thing on it and send a reader to Refresh for numbers that are
  // already current.
  const readAt = oldestWalkAt([groupSource, appSource, ruleSource]);

  // One top-up per mount, on the first activation. Held in refs rather than
  // state because re-rendering on either would say nothing new — and because a
  // second activation must not re-arm the decision.
  const toppedUp = useRef(false);

  // `useOrgSnapshot` starts at `isReading: false` and flips it true inside its
  // own mount effect, so on the very first commit every collection looks
  // *settled and never walked* — which is exactly the shape of a cold org.
  // Deciding then would top up a warm org on every single mount. So the
  // decision waits until a read has actually been observed to start.
  const sawReading = useRef(false);
  const anyReading = groups.isReading || apps.isReading || rules.isReading || appGroups.isReading;
  // One sync, not one per collection: `syncSnapshot` is org-wide — it walks
  // every collection and coalesces concurrent callers per origin — so asking
  // four times would send four messages to be answered by the same run.
  const syncRef = useRef(groups.sync);
  syncRef.current = groups.sync;

  useEffect(() => {
    // Still reading: the age is not yet known, so deciding on it now would top
    // up a snapshot that turns out to be minutes old.
    if (anyReading) {
      sawReading.current = true;
      return;
    }
    if (!sawReading.current) return;
    if (!enabled || !connected || toppedUp.current) return;
    toppedUp.current = true;
    // The clock is read here rather than during render: it is not a render
    // input, and a `Date.now()` in the body would make every render disagree
    // with the last one for no visible reason.
    if (readAt !== null && Date.now() - readAt <= ORG_FIGURES_MAX_AGE_MS) return;
    void syncRef.current(false);
  }, [enabled, connected, readAt, anyReading]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    void syncRef.current(true).finally(() => setIsRefreshing(false));
  }, []);

  return {
    boxes,
    readAt,
    isRefreshing: isRefreshing || groups.isSyncing || apps.isSyncing || rules.isSyncing,
    refresh,
    canRefresh: connected,
  };
}
