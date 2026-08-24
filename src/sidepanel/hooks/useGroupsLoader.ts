/**
 * @module sidepanel/hooks/useGroupsLoader
 * @description Supplies the Groups tab's list from the background-owned org
 * snapshot (ADR-0040).
 *
 * Before ADR-0040 this hook ran the whole load itself, and it ran it three times
 * over in series: page the org's groups, then — after that finished — page the
 * org's rules, then resolve one `/api/v1/apps/{id}` label per unique source app
 * and page that app's group assignments. In a 1000-group org that was ~92
 * requests, and the list painted once, at the end of all of them.
 *
 * It now **reads**. The background walks groups and rules concurrently and
 * streams them into IndexedDB; this hook maps what is there into
 * `GroupSummary`s and repaints as more arrives. A returning visit paints from
 * the store with no request at all.
 *
 * Two things changed shape rather than being deleted:
 * - Rule attribution still happens here, but against snapshot rules rather than
 *   a second cache with its own TTL of its own.
 * - Push-group mappings moved **off the critical path**, not out of the product.
 *   They were roughly half the old request budget and they answer a question
 *   only two filters ask, so they now run after the list is on screen and patch
 *   rows in as they resolve.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GroupSummary, OktaGroupRule, PushGroupMapping } from '../../shared/types';
import { detectConflicts, formatRuleForDisplay } from '../../shared/ruleUtils';
import { annotateGroupsWithRuleCounts } from '../../shared/rules/groupRuleIndex';
import { toGroupSummary, type RawOktaGroup } from '../components/groups/groupSummary';
import { useOrgSnapshot } from '../cache/useOrgSnapshot';
import { createLogger } from '../../shared/utils/logger';
import type { useOktaApi } from './useOktaApi';

/** The API facade shape, for the one operation this hook still needs from it. */
type OktaApiSurface = ReturnType<typeof useOktaApi>;

const log = createLogger('useGroupsLoader');

/** What the deferred push-mapping pass contributes back to a row. */
interface PushEnrichment {
  /** `sourceAppId` → the app's resolved label. */
  appNames: Map<string, string>;
  /** Group id → the push mappings targeting it. */
  mappingsByGroup: Map<string, PushGroupMapping[]>;
}

/** Nothing enriched yet — a stable identity, so it never re-triggers the memo. */
const NO_ENRICHMENT: PushEnrichment = { appNames: new Map(), mappingsByGroup: new Map() };

/** Inputs to {@link useGroupsLoader}. */
interface UseGroupsLoaderOptions {
  /**
   * The Okta API surface, used **only** for the deferred push-mapping pass —
   * the list itself no longer comes from here.
   */
  api: Pick<OktaApiSurface, 'applyPushGroupMappings'>;
  /** Connected Okta tab id; syncing is disabled while it is `null`. */
  targetTabId: number | null;
  /** Connected org origin — what the snapshot is scoped by. */
  oktaOrigin?: string | null;
  /** The shell's shared error setter (shows the banner on a load failure). */
  setError: Dispatch<SetStateAction<string | null>>;
  /** Switches the tab between live-search and cached-list modes. */
  setSearchMode: Dispatch<SetStateAction<'live' | 'cached'>>;
  /** Called after a successful load to clear live-search state. */
  onLoaded: () => void;
  /**
   * Whether the Groups tab is the visible one. The tab stays mounted while
   * hidden (ADR-0018), so a hidden tab must not drive an org-wide walk.
   */
  enabled?: boolean;
}

/** What {@link useGroupsLoader} returns. */
export interface UseGroupsLoaderResult {
  /** The org's groups, rule-annotated, as far as the snapshot has them. */
  groups: GroupSummary[];
  /** `true` while a sync is in flight. */
  loading: boolean;
  /**
   * Whether the snapshot's last group walk finished. `false` means the list is
   * a genuine prefix of the org, not the whole of it — a caller that wants to
   * caveat has the fact available rather than having to infer it (ADR-0040 §7).
   */
  complete: boolean;
  /** Epoch millis the groups were last fully walked, or `null`. */
  lastFullWalkAt: number | null;
  /**
   * Ask the background to bring this org up to date.
   *
   * @param force - Skip the cheap delta/drift modes and walk the org in full.
   * What a user-pressed **Refresh** means. Leave it off for "get me the
   * groups": the freshness ladder then picks the cheapest honest mode, which
   * for an org already on disk is one request or none (ADR-0040 §4).
   */
  loadAllGroups: (force?: boolean) => Promise<void>;
}

/**
 * Read the org's groups from the snapshot, rule-annotated and ready for the list.
 *
 * @param options - See {@link UseGroupsLoaderOptions}.
 * @returns See {@link UseGroupsLoaderResult}.
 */
export function useGroupsLoader({
  api,
  targetTabId,
  oktaOrigin,
  setError,
  setSearchMode,
  onLoaded,
  enabled = true,
}: UseGroupsLoaderOptions): UseGroupsLoaderResult {
  const groupSnapshot = useOrgSnapshot<RawOktaGroup>('groups', oktaOrigin, targetTabId, {
    enabled,
  });
  const ruleSnapshot = useOrgSnapshot<OktaGroupRule>('rules', oktaOrigin, targetTabId, {
    enabled,
  });

  const { rows: rawGroups } = groupSnapshot;
  const { rows: rawRules } = ruleSnapshot;

  // Rule attribution, derived rather than stored: `usedInRuleCount` and
  // `hasRules` are a function of two collections that each change on their own
  // schedule, so caching the join would just be a third thing to invalidate.
  // `formatRuleForDisplay` is passed no `currentGroupId` for the same reason
  // `groupDiscovery` did not: the rules are org-wide, so baking one group's
  // `affectsCurrentGroup` flag into them would be wrong for every other row.
  const [enrichment, setEnrichment] = useState<PushEnrichment>(NO_ENRICHMENT);

  const groups = useMemo(() => {
    let summaries = rawGroups.map(toGroupSummary);
    if (rawRules.length > 0) {
      const conflicts = detectConflicts(rawRules);
      const rules = rawRules.map((rule) => formatRuleForDisplay(rule, undefined, conflicts));
      summaries = annotateGroupsWithRuleCounts(summaries, rules);
    }
    if (enrichment === NO_ENRICHMENT) return summaries;

    // The deferred pass's answers are folded in here rather than written back to
    // the snapshot: they are a client-side join over two collections, not
    // something Okta returned about a group, and the store holds the latter.
    return summaries.map((group) => {
      const mappings = enrichment.mappingsByGroup.get(group.id);
      const appName = group.sourceAppId ? enrichment.appNames.get(group.sourceAppId) : undefined;
      const updates: Partial<GroupSummary> = {};
      if (mappings && mappings.length > 0) updates.pushMappings = mappings;
      if (appName && appName !== group.sourceAppId) updates.sourceAppName = appName;
      return Object.keys(updates).length > 0 ? { ...group, ...updates } : group;
    });
  }, [enrichment, rawGroups, rawRules]);

  const { sync: syncGroups } = groupSnapshot;

  const loadAllGroups = useCallback(
    async (force: boolean = false) => {
      setError(null);
      // One request syncs the whole org, so only the groups hook issues it; the
      // rules hook repaints off the same walk's broadcast.
      //
      // Unforced by default, and that default is the point. "Load All Groups"
      // and the empty-state CTA both mean *get me the groups*, not *discard
      // what you have and re-walk the org* — answering them with a forced full
      // walk made the delta and drift modes unreachable from the only flow that
      // actually loads this tab, so the org paid ~5 requests every time to
      // re-derive rows it already had. Only Refresh forces.
      const failure = await syncGroups(force);
      if (failure) {
        setError(failure);
        return;
      }
      setSearchMode('cached');
      onLoaded();
    },
    [onLoaded, setError, setSearchMode, syncGroups],
  );

  // A seeded snapshot is a cached list, so the tab shows it rather than sitting
  // in live-search mode with real rows already in hand. This replaces the old
  // mount-time `chrome.storage.local` rehydrate — and closes the race that came
  // with it, where a late storage callback could overwrite freshly loaded groups.
  const hasRows = rawGroups.length > 0;
  useEffect(() => {
    if (hasRows) setSearchMode('cached');
  }, [hasRows, setSearchMode]);

  // ---------------------------------------------------------------------------
  // Deferred push-mapping enrichment
  // ---------------------------------------------------------------------------
  // This is the ~45 requests that used to sit on the critical path, blocking the
  // first paint of every row in the org. It answers a question only two filters
  // ask, so it now runs *after* the list is on screen and patches rows in as it
  // resolves. `applyPushGroupMappings` already runs at `low` priority through the
  // operation runner, so it is visible in the activity bar and cancellable.
  const applyPushGroupMappings = api.applyPushGroupMappings;
  // Latched per (org, set of source apps): re-running it on every render, or on
  // every repaint during a walk, would spend the org's rate limit re-deriving an
  // answer that has not changed.
  const enrichedFor = useRef<string | null>(null);

  const enrichmentKey = useMemo(() => {
    if (rawGroups.length === 0) return null;
    // Keyed on *which* source apps are present, not on how many groups there
    // are, so a walk's twenty repaints re-run this once. The key stays a stable
    // `origin::` for an org with no app-sourced groups at all — which is a real
    // answer ("nothing to resolve"), not a reason to skip the pass: deciding
    // there is no work is `applyPushGroupMappings`'s own job, and it returns its
    // input having issued zero requests. Duplicating that guard here only made
    // the deferred pass unobservable in the one case it is cheapest to run.
    const ids = new Set<string>();
    for (const group of rawGroups) {
      if (group.type === 'APP_GROUP' && (group.source?.id || group._links?.apps?.href)) {
        ids.add(group.source?.id ?? (group._links?.apps?.href as string));
      }
    }
    return `${oktaOrigin ?? ''}::${[...ids].sort().join(',')}`;
  }, [oktaOrigin, rawGroups]);

  useEffect(() => {
    // Gated on visibility (ADR-0018): a hidden tab must not spend an admin's
    // rate limit on a pane nobody is looking at.
    if (!enabled || enrichmentKey === null || targetTabId === null) return;
    if (enrichedFor.current === enrichmentKey) return;
    enrichedFor.current = enrichmentKey;
    // The previous org's — or the previous app set's — answers are dropped
    // before the new ones are asked for, so a stale mapping can never outlive
    // the rows it described.
    setEnrichment(NO_ENRICHMENT);

    let cancelled = false;
    const summaries = rawGroups.map(toGroupSummary);
    void applyPushGroupMappings(summaries)
      .then((enriched) => {
        if (cancelled) return;
        const appNames = new Map<string, string>();
        const mappingsByGroup = new Map<string, PushGroupMapping[]>();
        for (const group of enriched) {
          if (group.sourceAppId && group.sourceAppName) {
            appNames.set(group.sourceAppId, group.sourceAppName);
          }
          if (group.pushMappings?.length) mappingsByGroup.set(group.id, group.pushMappings);
        }
        // Nothing resolved — leave the sentinel in place rather than swapping in
        // an equivalent empty pair, which would re-run the join for no change.
        if (appNames.size === 0 && mappingsByGroup.size === 0) return;
        setEnrichment({ appNames, mappingsByGroup });
      })
      .catch(() => {
        // Non-fatal, exactly as before: the list is already on screen and
        // complete, and push mappings are an embellishment on two filters.
        // Re-armed so a later load can retry. Outcome code only.
        if (!cancelled) enrichedFor.current = null;
        log.warn('Push-group mapping enrichment failed', { code: 'push_enrichment_failed' });
      });

    return () => {
      cancelled = true;
    };
    // `rawGroups` is deliberately not a dependency: it changes on every page of a
    // walk, and the latch key already captures the only thing this pass depends
    // on — which source apps are present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyPushGroupMappings, enabled, enrichmentKey, targetTabId]);

  return {
    groups,
    loading: groupSnapshot.isSyncing || groupSnapshot.isReading,
    complete: groupSnapshot.complete,
    lastFullWalkAt: groupSnapshot.lastFullWalkAt,
    loadAllGroups,
  };
}
