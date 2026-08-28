/**
 * @module sidepanel/hooks/useOrgFigures
 * @description The Home tab's org snapshot card: four figures, their combined
 * age, and the one button that refreshes them.
 *
 * Reads nothing of its own. The three collections are already mounted by
 * {@link module:sidepanel/hooks/useOrgEntityIndex} for the jump bar, so the card
 * costs **zero additional IndexedDB reads and zero additional broadcast
 * listeners** — it takes the same handles and derives numbers from them.
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
  buildFigure,
  oldestWalkAt,
  type FigureSource,
  type OrgFigure,
} from '../components/home/orgFigures';
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
  /** The four figures, in display order. */
  figures: OrgFigure[];
  /**
   * Epoch millis of the oldest finished walk behind the card, or `null` when
   * some collection has never finished one — in which case the card states no
   * age rather than a misleading one.
   */
  readAt: number | null;
  /** `true` while a refresh requested from here is in flight. */
  isRefreshing: boolean;
  /** Force a full walk of all three collections. */
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
  const { groups, rules, apps } = index;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const groupSource = toSource(groups);
  const ruleSource = toSource(rules);
  const appSource = toSource(apps);

  const pausedRules = useMemo(
    () => rules.rows.filter((rule) => rule.status === 'INACTIVE').length,
    [rules.rows],
  );

  const figures = useMemo(
    () => [
      buildFigure('groups', 'Groups', 'users', groupSource),
      buildFigure('apps', 'Applications', 'app', appSource),
      buildFigure('rules', 'Group rules', 'bolt', ruleSource),
      // A filter over the rules collection, so it inherits that collection's
      // trustworthiness rather than being judged on its own count — a paused
      // count of 0 from an unwalked org must not read as "none are paused".
      buildFigure('paused', 'Rules paused', 'pause', ruleSource, pausedRules),
    ],
    // Rebuilt from the three sources, which are fresh objects each render; the
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
      pausedRules,
    ],
  );

  const readAt = oldestWalkAt([groupSource, appSource, ruleSource]);

  // One top-up per mount, on the first activation. Held in refs rather than
  // state because re-rendering on either would say nothing new — and because a
  // second activation must not re-arm the decision.
  const toppedUp = useRef(false);

  // `useOrgSnapshot` starts at `isReading: false` and flips it true inside its
  // own mount effect, so on the very first commit all three collections look
  // *settled and never walked* — which is exactly the shape of a cold org.
  // Deciding then would top up a warm org on every single mount. So the
  // decision waits until a read has actually been observed to start.
  const sawReading = useRef(false);
  const anyReading = groups.isReading || apps.isReading || rules.isReading;
  const syncers = { groups: groups.sync, apps: apps.sync, rules: rules.sync };
  const syncersRef = useRef(syncers);
  syncersRef.current = syncers;

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
    const { groups: syncGroups, apps: syncApps, rules: syncRules } = syncersRef.current;
    void syncGroups(false);
    void syncApps(false);
    void syncRules(false);
  }, [enabled, connected, readAt, anyReading]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    const { groups: syncGroups, apps: syncApps, rules: syncRules } = syncersRef.current;
    void Promise.all([syncGroups(true), syncApps(true), syncRules(true)]).finally(() =>
      setIsRefreshing(false),
    );
  }, []);

  return {
    figures,
    readAt,
    isRefreshing: isRefreshing || groups.isSyncing || apps.isSyncing || rules.isSyncing,
    refresh,
    canRefresh: connected,
  };
}
