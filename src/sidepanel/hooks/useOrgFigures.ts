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
 * ## The row budget — read this before adding a row
 *
 * There are **two** findings, and that is a budget rather than an accident.
 * A row must pass all four of these tests; a row that fails one does not go on
 * the card, however interesting it is.
 *
 * 1. **It costs no walk of its own.** Groups and group rules are already on
 *    disk for the jump bar. Applications are not, and an apps walk plus a
 *    per-app assignment read is the tightest rate budget in the org — it must
 *    never be spent merely because a tab opened.
 * 2. **It names a subject.** Pressing it opens a list of the actual entities.
 * 3. **A verb exists, here.** Resume the rule, delete the group. If the only
 *    response is "noted", the row is trivia.
 * 4. **It is not a superset.** When one row is another plus noise, ship the
 *    sharp one. A count reached by subtraction needs a complete walk of what it
 *    subtracts, or it shows an em dash.
 *
 * The eight findings this card and the reports under it once carried, and where
 * each of them went:
 *
 * | Was | Verdict | Why |
 * | --- | --- | --- |
 * | Paused group rules | **Row 1** | An access freeze nobody chose to keep. One collection, no subtraction, verb one press away. |
 * | Empty groups nothing fills | **Row 2** | The only defensible group claim: nothing in it, nothing on its way in. Promoted from a report. |
 * | Groups with no members | Merged into row 2 | An empty group a rule fills is a cohort waiting for its first hire. Survives as a Groups-tab filter pill. |
 * | Groups no rule fills | Merged into row 2 | 208 of 412 implies half the org is broken; SCIM, IdPs, Workflows and humans are legitimate maintainers. Filter pill. |
 * | App access no rule maintains | Costed report | Needs apps plus every app's group assignments. Stays in `ReportsCard`, which states its scope. |
 * | Push apps pushing nothing | One level deeper | A per-app configuration fact; it belongs in that app's Group Push section, where its reads are already paid for. |
 * | Dormant app access | Cut | "Dormant" is a threshold this panel does not own, and it needs system-log reads on top of the apps fan-out. It survives on the Groups tab's cleanup panel and in the export. |
 * | Deactivated applications | Cut | Inventory, not hygiene. No verb at the end of the row. |
 *
 * The next candidate, deliberately not shipped: *rules whose expression reads an
 * attribute no user has*. It stays a report until it can be answered as a join
 * over rows already on disk rather than a read per rule.
 *
 * ## Row 2 is computed by subtraction, and that is why it is gated
 *
 * "Groups with no members that no rule fills" removes the groups some rule
 * targets, and that is where the honesty rules bite. A rule list missing half
 * its pages does not under-report it; it reports every group those missing
 * rules fed as unfilled. So `subCountStatus` holds group rules as a **gate**
 * rather than a floor, and suppresses the number entirely rather than
 * publishing a wrong one.
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
  /**
   * HTTP status of the collection's last sync attempt (`useOrgSnapshot`,
   * ultimately `SyncMeta.status`), or `null`/`undefined` when it succeeded or
   * carried no status. Threaded straight through to {@link FigureSource.status}
   * so `unavailableNote` can name a 401/403 specifically (D-068) — this
   * function makes no honesty decision of its own.
   */
  status?: number | null;
}): FigureSource {
  return {
    isReading: snapshot.isReading,
    complete: snapshot.complete,
    lastFullWalkAt: snapshot.lastFullWalkAt,
    count: snapshot.rows.length,
    error: snapshot.error,
    status: snapshot.status,
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
  // Two collections, not four. `apps` and `appGroups` are deliberately not read
  // here — see the row budget in the module header: an apps walk is the org's
  // tightest rate budget and no row on this card is allowed to depend on one.
  const { groups, rules } = index;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const groupSource = toSource(groups);
  const ruleSource = toSource(rules);

  const pausedRules = useMemo(
    () => rules.rows.filter((rule) => rule.status === 'INACTIVE').length,
    [rules.rows],
  );

  // Row 2. Empty **and** unfilled, in one pass: the two old rows were a
  // superset of this one apiece, and neither was defensible alone. An empty
  // group a rule fills is a cohort waiting for its first hire; a filled group
  // no rule maintains has SCIM, an IdP, Workflows or a human behind it. The
  // intersection is the only claim this extension can make without guessing.
  //
  // `?? 0` on the member count matches `toGroupSummary` exactly, and "no rules"
  // reads the *assignment* index (`assignUserToGroups`) rather than the
  // reference one, because a group merely named in some rule's condition still
  // has nothing filling it. Both match what the Groups tab filters on, so the
  // number on the card and the list it opens cannot disagree.
  const emptyUnfilledGroups = useMemo(() => {
    const assigned = countRulesByGroup(
      rules.rows.map((rule) => ({ groupIds: rule.actions?.assignUserToGroups?.groupIds ?? [] })),
    );
    return groups.rows.filter(
      (group) =>
        (group._embedded?.stats?.usersCount ?? 0) === 0 && (assigned.get(group.id) ?? 0) === 0,
    ).length;
  }, [groups.rows, rules.rows]);

  // The nouns the findings and the totals caption speak in. Declared once so a
  // sentence and the caption under it cannot end up calling the same collection
  // two different things.
  const groupsNamed = { source: groupSource, noun: 'groups' };
  const rulesNamed = { source: ruleSource, noun: 'group rules' };

  const boxes = useMemo(
    () => [
      // Row 1 first, and the box order is the row order: an access freeze
      // nobody chose to keep outranks a group nobody has filled yet.
      buildBox(buildFigure('rules', 'Group rules', 'bolt', ruleSource), 'rules', 'group rules', [
        // A filter over the rules collection, so it inherits that collection's
        // trustworthiness rather than being judged on its own count — a paused
        // count of 0 from an unwalked org must not read as "none are paused".
        buildSubCount({
          key: 'rules-paused',
          label: 'Group rules paused',
          icon: 'pause',
          counted: rulesNamed,
          count: pausedRules,
          request: { tab: 'rules', view: 'paused' },
        }),
      ]),
      buildBox(buildFigure('groups', 'Groups', 'users', groupSource), 'groups', 'groups', [
        // Group rules are a **gate**, not a floor: this count is reached by
        // subtracting the groups some rule targets, so anything short of a
        // complete rule walk suppresses the number entirely rather than
        // reporting every group those missing rules fed as unfilled.
        buildSubCount({
          key: 'groups-empty-unfilled',
          label: 'Groups with no members that no rule fills',
          icon: 'users',
          counted: groupsNamed,
          gates: [rulesNamed],
          count: emptyUnfilledGroups,
          request: { tab: 'groups', view: 'empty-no-rules' },
        }),
      ]),
    ],
    // Rebuilt from the two sources, which are fresh objects each render; the
    // members are what actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      groupSource.isReading,
      groupSource.complete,
      groupSource.lastFullWalkAt,
      groupSource.count,
      groupSource.error,
      groupSource.status,
      ruleSource.isReading,
      ruleSource.complete,
      ruleSource.lastFullWalkAt,
      ruleSource.count,
      ruleSource.error,
      ruleSource.status,
      emptyUnfilledGroups,
      pausedRules,
    ],
  );

  // Exactly the two collections the card speaks about. Quoting a collection no
  // row is drawn from would date the card by something the reader cannot see —
  // which is how the apps walk used to send people to Refresh for numbers that
  // were already current.
  const readAt = oldestWalkAt([groupSource, ruleSource]);

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
  const anyReading = groups.isReading || rules.isReading;
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
    isRefreshing: isRefreshing || groups.isSyncing || rules.isSyncing,
    refresh,
    canRefresh: connected,
  };
}
