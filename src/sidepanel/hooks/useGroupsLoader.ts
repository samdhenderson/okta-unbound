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
 * Everything it shows is now a join over stored collections, computed here and
 * cached nowhere:
 * - **Rule attribution** — `usedInRuleCount` and `hasRules`, from snapshot rules.
 * - **Push-group mappings** — from the `appGroups` collection. These were the
 *   last thing the panel re-fetched on every open, roughly one request per
 *   push-enabled app; the background walks them now, so a returning visit shows
 *   them with no request at all.
 * - **Source app names** — from the `expand=app` embed on the group walk, and
 *   from the app inventory when the embed did not carry one.
 *
 * Each of those is a function of collections that change on their own schedules,
 * so caching the join would only be a fourth thing to invalidate.
 */

import { useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GroupSummary, OktaGroupRule, PushGroupMapping } from '../../shared/types';
import { detectConflicts, formatRuleForDisplay } from '../../shared/ruleUtils';
import { annotateGroupsWithRuleCounts } from '../../shared/rules/groupRuleIndex';
import { toGroupSummary, type RawOktaGroup } from '../components/groups/groupSummary';
import { useOrgSnapshot } from '../cache/useOrgSnapshot';
import { splitShardedId } from '../../shared/snapshot/types';
import type { OktaAppGroupAssignment, OktaAppListItem } from '../../shared/schemas/okta';

/** Inputs to {@link useGroupsLoader}. */
interface UseGroupsLoaderOptions {
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
  const appSnapshot = useOrgSnapshot<OktaAppListItem>('apps', oktaOrigin, targetTabId, {
    enabled,
  });
  const appGroupSnapshot = useOrgSnapshot<OktaAppGroupAssignment>(
    'appGroups',
    oktaOrigin,
    targetTabId,
    { enabled },
  );

  const { rows: rawGroups } = groupSnapshot;
  const { rows: rawRules } = ruleSnapshot;
  const { rows: rawApps } = appSnapshot;
  // Records, not rows: which app an assignment belongs to lives in the storage
  // key. Okta returns only the assigned group's id on an assignment, so the app
  // is not recoverable from the entity alone (ADR-0040, `APP_GROUPS_SPEC`).
  const { records: assignmentRecords } = appGroupSnapshot;

  /** App id → the label to show for it. */
  const appNames = useMemo(() => {
    const byId = new Map<string, string>();
    for (const app of rawApps) {
      const label = app.label || app.name;
      if (app.id && label) byId.set(app.id, label);
    }
    return byId;
  }, [rawApps]);

  /** Group id → the push mappings targeting it. */
  const mappingsByGroup = useMemo(() => {
    const byGroup = new Map<string, PushGroupMapping[]>();
    for (const record of assignmentRecords) {
      const key = splitShardedId(record.id);
      if (!key) continue;
      const appId = key.shardKey;
      const assignment = record.entity;
      // The `_links` href is the authoritative group reference; the key's half is
      // the fallback, and the two agree in every response Okta actually sends.
      const linked = assignment._links?.group?.href?.split('/').pop();
      const groupId = linked || key.entityId;
      if (!groupId) continue;

      const mappings = byGroup.get(groupId) ?? [];
      mappings.push({
        mappingId: assignment.id || `${appId}_${groupId}`,
        sourceUserGroupId: groupId,
        targetGroupName: assignment.profile?.name || assignment.profile?.groupName || '',
        priority: assignment.priority,
        appId,
        appName: appNames.get(appId),
      });
      byGroup.set(groupId, mappings);
    }
    return byGroup;
  }, [appNames, assignmentRecords]);

  // Every derived field is computed here rather than stored: each is a function
  // of collections that change on their own schedules, so caching the join would
  // only be another thing to invalidate. `formatRuleForDisplay` is passed no
  // `currentGroupId` for the reason `groupDiscovery` did not: the rules are
  // org-wide, so baking one group's `affectsCurrentGroup` flag into them would be
  // wrong for every other row.
  const groups = useMemo(() => {
    let summaries = rawGroups.map(toGroupSummary);
    if (rawRules.length > 0) {
      const conflicts = detectConflicts(rawRules);
      const rules = rawRules.map((rule) => formatRuleForDisplay(rule, undefined, conflicts));
      summaries = annotateGroupsWithRuleCounts(summaries, rules);
    }
    if (mappingsByGroup.size === 0 && appNames.size === 0) return summaries;

    return summaries.map((group) => {
      const mappings = mappingsByGroup.get(group.id);
      const updates: Partial<GroupSummary> = {};
      if (mappings && mappings.length > 0) updates.pushMappings = mappings;
      // The group walk's `expand=app` embed usually names the source app already;
      // the inventory answers for the rows where it did not, at no request cost.
      if (!group.sourceAppName && group.sourceAppId) {
        const appName = appNames.get(group.sourceAppId);
        if (appName && appName !== group.sourceAppId) updates.sourceAppName = appName;
      }
      return Object.keys(updates).length > 0 ? { ...group, ...updates } : group;
    });
  }, [appNames, mappingsByGroup, rawGroups, rawRules]);

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

  return {
    groups,
    loading: groupSnapshot.isSyncing || groupSnapshot.isReading,
    complete: groupSnapshot.complete,
    lastFullWalkAt: groupSnapshot.lastFullWalkAt,
    loadAllGroups,
  };
}
