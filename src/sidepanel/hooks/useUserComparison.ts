/**
 * @module sidepanel/hooks/useUserComparison
 * @description Orchestrator for the two-user comparison surface.
 *
 * Composes the search, memberships, apps and group-copy hooks, owns the phase
 * switch (`comparedUser`) and `activeTab`, drives the two reset paths (the
 * surface going away and change-user), and derives the shared/only buckets plus
 * Jaccard similarity for groups and apps.
 *
 * ## Two hosts, one hook
 *
 * The comparison has two mount sites and they hide it differently:
 * {@link UserComparisonModal} (the Overview's dialog, which has no view stack) and
 * {@link UserComparisonPanel} (the Users tab's pushed view, ADR-0016). So the hook
 * takes an abstract {@link UseUserComparisonOptions.isActive} — "the surface is on
 * screen" — rather than the dialog's `isOpen`: the dialog passes `isOpen`, the
 * pushed view passes `!nav.isRoot`. Both hosts keep the hook mounted while the
 * surface is away, so that flag going false is the **only** thing preventing a
 * stale comparison from coming back on the next open/push.
 *
 * A mounted-but-hidden surface must also stay inert (ADR-0018): the debounced user
 * search is the one thing here that reaches Okta without a click, so it is gated on
 * {@link UseUserComparisonOptions.searchEnabled}, which the Users tab additionally
 * folds its own tab-level `isActive` into.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserSearch } from './useUserSearch';
import { useComparisonProfileEdit } from './useComparisonProfileEdit';
import { useUserMemberships } from './useUserMemberships';
import { useComparisonApps } from './useComparisonApps';
import { useGroupCopy } from './useGroupCopy';
import { useOktaApi } from './useOktaApi';
import { useProfileDisplayConfig } from './useProfileDisplayConfig';
import { useEntityQuery } from '../cache/useEntityQuery';
import { cacheKeys, TTL_LONG } from '../cache/keys';
import { userDisplayName } from '../../shared/utils/userDisplay';
import {
  jaccard,
  bucketGroups,
  bucketApps,
  type TabKey,
} from '../components/users/comparison/comparisonAnalytics';
import { classifyAccessCauses } from '../components/users/comparison/accessCause';
import {
  attributeParityRows,
  type AttributeParityResult,
} from '../components/users/comparison/attributeParity';
import {
  allProfileAttributes,
  type AttributeDescriptor,
} from '../components/users/profileAttributes';
import { profileMastering } from '../components/users/profileEditability';
import { profileRuleReads } from '../components/users/profileRuleReads';
import { loadCachedGroupNames } from './fetchGroupRulesRequest';
import type { OktaUser, GroupMembership } from '../../shared/types';
import type { OktaUserProfileSchema } from '../../shared/schemas/okta';

/**
 * The attribute dimension before a second user is picked: no rows, no hidden
 * rows, no differences. A frozen module-level constant so the memo below hands
 * back one stable reference across every render of the search phase.
 */
const NO_ATTRIBUTE_PARITY: AttributeParityResult = Object.freeze({
  rows: [],
  hiddenRows: [],
  hiddenDifferences: 0,
  differenceCount: 0,
});

/** No attribute is read by any granting rule — the answer before rules resolve. */
const NO_RULE_READS: Record<string, string[]> = Object.freeze({});

/** The compared side's inventory before a second user is picked. One stable reference. */
const NO_ATTRIBUTES: readonly AttributeDescriptor[] = Object.freeze([]);

/**
 * Union two `profileRuleReads` maps, preserving each map's rule order.
 *
 * The chip beside an attribute has to answer "does a rule read this?" for the
 * **pair**, not for the baseline alone. A rule reading `department` to grant the
 * *compared* user a group the context user lacks is precisely the explanation
 * this tab exists to surface, and keying the chips off one user would drop it.
 */
function mergeRuleReads(
  first: Record<string, string[]>,
  second: Record<string, string[]>,
): Record<string, string[]> {
  const merged: Record<string, string[]> = { ...first };
  for (const [name, ruleNames] of Object.entries(second)) {
    const held = merged[name];
    if (!held) {
      merged[name] = [...ruleNames];
      continue;
    }
    merged[name] = [...held, ...ruleNames.filter((ruleName) => !held.includes(ruleName))];
  }
  return merged;
}

/** Options for {@link useUserComparison}. */
export interface UseUserComparisonOptions {
  /**
   * Whether the comparison surface is on screen — `isOpen` for the dialog host,
   * "a comparison view is pushed" for the Users tab's view-stack host. Going false
   * triggers a full reset, so the next open/push starts pristine.
   */
  isActive: boolean;
  /**
   * Whether the surface may issue background user-search requests. Defaults to
   * {@link UseUserComparisonOptions.isActive}; the Users tab narrows it further with
   * its own tab-level `isActive`, because a hidden tab stays mounted (ADR-0018) and
   * must not spend scheduler budget on a screen nobody is looking at.
   */
  searchEnabled?: boolean;
  /** The anchor user being compared against (left-hand side). */
  contextUser: OktaUser;
  /** The context user's memberships, used to build the group buckets. */
  contextGroups: GroupMembership[];
  /** Tab whose content script performs all comparison API calls. */
  targetTabId: number;
  /**
   * The connected org's origin. Two things need it, both belonging to the
   * Attributes dimension: the org-wide profile schema is cached under
   * `cacheKeys.userSchema(oktaOrigin)`, and the admin's profile display
   * configuration is stored per org.
   *
   * Absent, both degrade rather than fail — the attribute inventory falls back to
   * the user's own profile keys plus `BASE_PROFILE_ATTRIBUTES`, and the display
   * config falls back to its defaults.
   */
  oktaOrigin?: string | null;
  /** Called after groups are copied so the parent can refresh context data. */
  onGroupsChanged: () => void;
  /**
   * Publishes a context user the Attributes tab just saved, so every other
   * surface showing that person sees the new truth.
   *
   * The compared user is local state here and lifting a save is a `setState`;
   * the context user is a **prop** — the Users tab's `selectedUser` — so only
   * the host that owns it can publish it. Optional, and **absent means the
   * context column of the Attributes tab offers no edit affordance at all**: a
   * save nobody publishes leaves the panel rendering values Okta no longer
   * holds, which is worse than a missing button. See
   * {@link module:sidepanel/hooks/useComparisonProfileEdit}.
   */
  onContextUserUpdated?: (user: OktaUser) => void;
}

/**
 * Orchestrates the two-user comparison: composes search, memberships, apps and the
 * group-copy concern; owns `comparedUser` (the phase switch) and `activeTab`, plus
 * the two reset paths and the derived buckets/similarity. This is the single place
 * that knows the reset ordering.
 *
 * @param options - See `UseUserComparisonOptions`.
 * @returns The comparison view model: `comparedUser` and search state, `activeTab`
 *   control, `groupBuckets` / `appBuckets` with their diff counts and per-facet
 *   plus `overallSimilarity`, the `attributeParity` value diff with its own
 *   `attributeDiffCount`, `attributeConfig` and `attributeRuleReads`, the
 *   classified `causes` worklist, aggregated
 *   `isLoading` / `loadError`, group-copy state (`addingGroupId`, `addError`) and
 *   the bidirectional `addToContext` / `addToCompared` actions, display names, and
 *   the `selectUser` / `changeUser` actions.
 *
 *   The two failure channels are deliberately different shapes. `loadError` is the
 *   group side and is **blocking** — the view replaces the tabs with it, because
 *   without memberships there is no comparison. `appsIncomplete` is the app side
 *   and is **advisory**: the group half still loaded, so the view caveats instead
 *   of blanking, `appSimilarity` becomes `null`, and `similarityScope` reports
 *   `'groups-only'` to say what the surviving headline actually covers.
 *
 *   `attributeParity` is the **fourth dimension**: a value diff over both users'
 *   profile attributes, honouring the admin's display configuration, split into
 *   the rows that config makes visible and the rows it hides (kept, and counted,
 *   so the tab can disclose what it is not showing). It feeds no similarity
 *   figure — see `overallSimilarity` below.
 *
 *   `attributeEdit` is that dimension's **write** half: one editor per column
 *   ({@link module:sidepanel/hooks/useComparisonProfileEdit}), each with its own
 *   draft, its own blast-radius prediction and its own confirmation. It is always
 *   present; a column that may not be edited says so through `canEdit` rather
 *   than by being absent, and the context column is read-only unless the host
 *   supplied `onContextUserUpdated`.
 *
 *   `causes` classifies the `onlyCompared` bucket by remedy
 *   ({@link classifyAccessCauses}), and is **`undefined` until the org rule
 *   inventory has been resolved** — "not computed", which consumers must not render
 *   as a finding. Once resolved it is always an array, one entry per difference.
 */
export function useUserComparison({
  isActive,
  searchEnabled,
  contextUser,
  contextGroups,
  targetTabId,
  oktaOrigin,
  onGroupsChanged,
  onContextUserUpdated,
}: UseUserComparisonOptions) {
  const { searchQuery, setSearchQuery, searchResults, isSearching, clearSearch } = useUserSearch({
    targetTabId,
    // ADR-0018: both hosts keep this hook mounted while the surface is hidden, and
    // the debounce effect re-fires on `targetTabId` changes — so without this gate a
    // hidden comparison would re-run whatever query was last in its box.
    enabled: searchEnabled ?? isActive,
  });

  const {
    memberships: comparedGroups,
    isLoading: isLoadingGroups,
    error: groupsError,
    // The org rule inventory that load already had in hand — re-exported, never
    // re-fetched. `null` ("we could not obtain it") is threaded through as
    // `null`; see `classifyAccessCauses` below.
    rules: ruleInventory,
    loadMemberships,
    clearMemberships,
  } = useUserMemberships({ targetTabId });

  const [comparedUser, setComparedUser] = useState<OktaUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { contextApps, comparedApps, isLoadingApps, appsLoaded, appsIncomplete, resetApps } =
    useComparisonApps({
      targetTabId,
      contextUserId: contextUser.id,
      comparedUser,
    });

  // Refresh the compared user's memberships after a group is copied onto them,
  // so the row re-buckets on the next load (mirrors the context-side refresh the
  // parent drives via onGroupsChanged).
  const onComparedGroupsChanged = useCallback(() => {
    if (comparedUser) void loadMemberships(comparedUser, { force: true });
  }, [comparedUser, loadMemberships]);

  const {
    addedToContextIds,
    addedToComparedIds,
    addingGroupId,
    addError,
    setAddError,
    addToContext,
    addToCompared,
    resetCopyState,
    resetForChangeUser,
  } = useGroupCopy({
    targetTabId,
    contextUser,
    comparedUser,
    onContextGroupsChanged: onGroupsChanged,
    onComparedGroupsChanged,
  });

  // Reset everything when the surface goes away — the dialog closing, or the pushed
  // view being popped. Both hosts keep this hook mounted across that (the dialog
  // unmounts only Modal's children; the pushed view is hidden, not unmounted), so
  // this effect is the sole thing preventing the next open/push from showing the
  // previous comparison. It also runs harmlessly on first mount (isActive=false).
  useEffect(() => {
    if (!isActive) {
      setComparedUser(null);
      resetApps();
      resetCopyState();
      setActiveTab('overview');
      clearSearch();
      clearMemberships();
    }
  }, [isActive, resetApps, resetCopyState, clearSearch, clearMemberships]);

  // Load the compared user's memberships whenever the selection changes.
  // Fire-and-forget and intentionally NOT cancellable (only the apps half is
  // guarded) — a stale membership response is allowed to land. Keyed on
  // [comparedUser] only; loadMemberships is stable (useCallback on [targetTabId]).
  useEffect(() => {
    if (comparedUser) loadMemberships(comparedUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparedUser]);

  const selectUser = useCallback((user: OktaUser) => {
    setComparedUser(user);
    setActiveTab('overview');
  }, []);

  const changeUser = useCallback(() => {
    setComparedUser(null);
    resetApps();
    resetForChangeUser();
    setActiveTab('overview');
    clearMemberships();
    clearSearch();
  }, [resetApps, resetForChangeUser, clearMemberships, clearSearch]);

  const groupBuckets = useMemo(
    () => bucketGroups(contextGroups, comparedGroups, addedToContextIds, addedToComparedIds),
    [contextGroups, comparedGroups, addedToContextIds, addedToComparedIds],
  );

  const appBuckets = useMemo(
    () => bucketApps(contextApps, comparedApps),
    [contextApps, comparedApps],
  );

  // ---------------------------------------------------------------------------
  // The Attributes dimension.
  //
  // Everything below derives from `comparedUser`, the org schema and the admin's
  // display config. There is deliberately **no new state**: the reset-on-hide
  // effect above nulls `comparedUser`, and with it every attribute value here
  // collapses to `NO_ATTRIBUTE_PARITY` / `NO_RULE_READS`, so a stale attribute
  // diff cannot survive a close-and-reopen (ADR-0026 names this hook as the
  // reset-on-hide exemplar). The schema itself is org-wide and cached across
  // comparisons on purpose — it is not part of any one comparison's state.
  //
  // None of this touches `overallSimilarity` or `similarityScope`. Those average
  // exactly two Jaccard terms and publish a number in the hero; attributes are
  // not access, and folding them in would silently change what that number has
  // always meant.
  // ---------------------------------------------------------------------------

  const { getUserProfileSchema } = useOktaApi({ targetTabId });

  // One org-wide request at TTL_LONG, shared with every other consumer of the
  // same key — a second comparison, or the Users tab's profile pane, costs
  // nothing. Gated on the surface being visible AND a user being picked
  // (ADR-0018): a mounted-but-hidden comparison, and the search phase, have
  // nothing to render it into.
  const { data: userSchema } = useEntityQuery<OktaUserProfileSchema | null>(
    cacheKeys.userSchema(oktaOrigin),
    getUserProfileSchema,
    { ttl: TTL_LONG, enabled: isActive && comparedUser !== null },
  );

  // Each side's inventory, derived once and shared by everything that needs it:
  // the reconciled config's vocabulary below, and each side's editor. The
  // editors take the inventory rather than re-deriving it, so an editor can
  // never offer a control for an attribute this surface does not list.
  const contextAttributes = useMemo(
    () => allProfileAttributes(contextUser, userSchema),
    [contextUser, userSchema],
  );

  const comparedAttributes = useMemo(
    () => (comparedUser ? allProfileAttributes(comparedUser, userSchema) : NO_ATTRIBUTES),
    [comparedUser, userSchema],
  );

  // Which profile sources each column's user is actually attached to — the fact
  // that turns an org-wide `PROFILE_MASTER` on a schema property into a verdict
  // about one person (`profileEditability`). It costs nothing extra: these are
  // the app lists the Apps tab already walked. `appsIncomplete` covers both
  // users, so a truncated walk on either side locks the mastered attributes on
  // both — the safe direction, and the one that keeps the two columns telling
  // the same story about the same attribute.
  //
  // `appsLoaded` is the load-bearing half. Both arrays start `[]` with
  // `appsIncomplete` false, so passing them straight through would hand the gate
  // a *completed empty walk* — "this user is attached to no profile source" —
  // for the whole loading window and again after every `resetApps`. That reads
  // as an answer and unlocks every mastered attribute. `undefined` is the honest
  // value until a walk returns, and it locks.
  const contextMastering = useMemo(
    () => profileMastering(appsLoaded ? contextApps : undefined, !appsIncomplete),
    [appsLoaded, contextApps, appsIncomplete],
  );

  const comparedMastering = useMemo(
    () => profileMastering(appsLoaded ? comparedApps : undefined, !appsIncomplete),
    [appsLoaded, comparedApps, appsIncomplete],
  );

  // The attribute vocabulary the config is reconciled against: the union of both
  // users' inventories, because an attribute only the compared user carries still
  // needs a configured placement — it is exactly the kind of difference this tab
  // exists to find.
  const knownAttributeNames = useMemo(() => {
    const names = new Set<string>();
    for (const attribute of contextAttributes) names.add(attribute.name);
    for (const attribute of comparedAttributes) names.add(attribute.name);
    return [...names];
  }, [contextAttributes, comparedAttributes]);

  // The same configuration the Users tab's Profile pane reads: categories, order,
  // labels and visibility. Reused rather than reinvented — two different groupings
  // from one config would be a bug an admin could never explain.
  const { config: attributeConfig } = useProfileDisplayConfig(oktaOrigin, knownAttributeNames);

  // Memoized for the same reason `causes` is: the comparison is a pushed view
  // that re-renders on every nav change (ADR-0016), and rebuilding both users'
  // inventories on each of those is pure waste.
  const attributeParity = useMemo(
    () =>
      comparedUser
        ? attributeParityRows(contextUser, comparedUser, userSchema, attributeConfig)
        : NO_ATTRIBUTE_PARITY,
    [contextUser, comparedUser, userSchema, attributeConfig],
  );

  // Which rules read each attribute and currently grant access — for the pair,
  // not for the baseline alone (see `mergeRuleReads`). `unavailable` and
  // `unresolved` both yield an empty map: a chip is a positive claim that a rule
  // reads this attribute, and no rules were seen.
  const attributeRuleReads = useMemo(() => {
    if (ruleInventory.status !== 'available') return NO_RULE_READS;
    const contextReads = profileRuleReads(ruleInventory.rules, contextUser, contextGroups);
    if (!comparedUser) return contextReads;
    return mergeRuleReads(
      contextReads,
      profileRuleReads(ruleInventory.rules, comparedUser, comparedGroups),
    );
  }, [ruleInventory, contextUser, contextGroups, comparedUser, comparedGroups]);

  const contextName = userDisplayName(contextUser);
  const comparedName = comparedUser ? userDisplayName(comparedUser) : '';

  // Editing, one independent editor per column, composed rather than inlined —
  // two `useProfileEdit` instances plus a blast-radius prediction each is a
  // concern of its own, and this hook is already long. Gated exactly as the
  // schema read above is (ADR-0018/ADR-0026): a hidden comparison, and the
  // search phase, cannot enter edit mode or write.
  const attributeEdit = useComparisonProfileEdit({
    contextUser,
    contextName,
    contextAttributes,
    contextMastering,
    contextMemberships: contextGroups,
    ...(onContextUserUpdated === undefined ? {} : { onContextUserUpdated }),
    comparedUser,
    comparedName,
    comparedAttributes,
    comparedMastering,
    comparedMemberships: comparedGroups,
    onComparedUserUpdated: setComparedUser,
    rules: ruleInventory,
    targetTabId,
    enabled: isActive && comparedUser !== null,
  });

  // Why the compared user has group access the context user lacks, grouped by the
  // remedy that would close it. Memoized because classification parses every
  // targeting rule's condition: the comparison is a pushed view that re-renders on
  // every nav change (ADR-0016), and re-parsing on each of those would be pure
  // waste. The deps are the same references `groupBuckets` is keyed on, so a
  // re-render that changes nothing reuses the previous array.
  //
  // Each inventory state maps to a DIFFERENT answer, and the three must not merge:
  //
  // - `unresolved` → `undefined`, which the worklist renders as "not computed".
  //   Classifying here would report `no-rule-inventory` ("the rules could not be
  //   loaded") for every row during the ordinary gap before they arrive — naming a
  //   failure that has not happened.
  // - `unavailable` → classify against `null`, which really does mean every row is
  //   `cannot-determine`. That is a true finding, not a placeholder.
  // - `available` → classify against the rules, empty array included. Substituting
  //   `[]` for either state above would read as "the org has no rules" and yield a
  //   confident `manual-add` — an instruction to add a user by hand, derived from
  //   rules nobody ever saw.
  const causes = useMemo(() => {
    if (ruleInventory.status === 'unresolved') return undefined;
    return classifyAccessCauses({
      onlyCompared: groupBuckets.onlyCompared,
      contextUser,
      rules: ruleInventory.status === 'available' ? ruleInventory.rules : null,
      // The context user's whole membership list, which is what lets an
      // `isMemberOfGroup` / `isMemberOfAnyGroup` clause resolve instead of
      // reporting "needs investigation". It is the same list the buckets were
      // built from — Okta's own answer for this user, not a filtered view — so
      // a clause finding no match really is a miss.
      contextGroups,
    });
  }, [groupBuckets.onlyCompared, contextUser, contextGroups, ruleInventory]);

  // Group ids embedded in a rule condition — `isMemberOfGroup("00g…")` — are
  // unreadable on their own, and the comparison's rules are fetched with
  // `resolveGroupNames: false`, so nothing upstream labels them. Build the labels
  // here from what is already in hand, cheapest source first and no API traffic:
  //
  // 1. Both users' membership lists, which carry id AND name and cover the common
  //    case (a prerequisite group the compared user qualified through).
  // 2. The Groups tab's `chrome.storage.local` cache — one read, the same source
  //    the Rules tab labels its rule targets from.
  //
  // An id in neither falls back to the id itself at the point of use, exactly as
  // `RuleCard` does. Deliberately NOT solved by flipping `resolveGroupNames` in
  // `useUserMemberships`: that path keeps ids-as-names out of the shared
  // `RulesCache`, and this map also works when the Groups tab was never opened.
  const [cachedGroupNames, setCachedGroupNames] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    void loadCachedGroupNames().then((names) => {
      if (!cancelled) setCachedGroupNames(names);
    });
    return () => {
      cancelled = true;
    };
  }, [isActive]);

  const resolveGroupName = useMemo(() => {
    const byId = new Map(cachedGroupNames);
    // Live memberships last so they win over a possibly stale cache entry.
    for (const membership of [...contextGroups, ...comparedGroups]) {
      byId.set(membership.group.id, membership.group.profile.name);
    }
    return (groupId: string): string | undefined => byId.get(groupId);
  }, [cachedGroupNames, contextGroups, comparedGroups]);

  const groupDiffCount = groupBuckets.onlyCompared.length + groupBuckets.onlyContext.length;
  const appDiffCount = appBuckets.onlyCompared.length + appBuckets.onlyContext.length;
  // The VISIBLE differences only. The badge has to agree with what the tab lists
  // on arrival; the ones a config hides are counted separately and disclosed by
  // the tab itself, which can also offer to reveal them.
  const attributeDiffCount = attributeParity.differenceCount;

  const groupSimilarity = jaccard(
    groupBuckets.shared.length,
    groupBuckets.shared.length + groupBuckets.onlyCompared.length + groupBuckets.onlyContext.length,
  );
  // `null` when the app walk did not finish. An overlap ratio over a list that is
  // short by an unknown amount is not a low percentage — it is not a percentage.
  // The type change is the enforcement: every consumer has to say what it renders
  // instead, rather than inheriting a plausible-looking 0%.
  const appSimilarity = appsIncomplete
    ? null
    : jaccard(
        appBuckets.shared.length,
        appBuckets.shared.length + appBuckets.onlyCompared.length + appBuckets.onlyContext.length,
      );

  // With the app term unavailable the headline falls back to the group figure
  // alone, rather than averaging in a zero. Dropping the headline entirely would
  // throw away the half of the comparison that did load; averaging in a fabricated
  // zero silently halves it. `similarityScope` is what keeps the surviving number
  // honest about what it covers.
  const overallSimilarity = !comparedUser
    ? 0
    : appSimilarity === null
      ? groupSimilarity
      : Math.round((groupSimilarity + appSimilarity) / 2);
  const similarityScope: 'both' | 'groups-only' = appSimilarity === null ? 'groups-only' : 'both';

  const isLoading = isLoadingGroups || isLoadingApps;
  // Only the group side can produce a blocking error: `loadError` replaces the
  // whole comparison body, and a failed app read must not do that — the group half
  // is still worth showing. An incomplete app read travels as `appsIncomplete`
  // instead, which caveats rather than blanks.
  const loadError = groupsError;

  return {
    comparedUser,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    activeTab,
    setActiveTab,
    groupBuckets,
    appBuckets,
    causes,
    groupDiffCount,
    appDiffCount,
    attributeParity,
    attributeDiffCount,
    attributeConfig,
    attributeRuleReads,
    // Both columns' editors and the single confirmation on screen. Undefined is
    // never returned — a column that cannot be edited says so with `canEdit`,
    // not by being absent.
    attributeEdit,
    groupSimilarity,
    appSimilarity,
    overallSimilarity,
    similarityScope,
    appsIncomplete,
    isLoading,
    loadError,
    addingGroupId,
    addError,
    setAddError,
    addToContext,
    addToCompared,
    contextName,
    comparedName,
    resolveGroupName,
    selectUser,
    changeUser,
  };
}

/**
 * The comparison view model produced by {@link useUserComparison}.
 *
 * Passed whole into {@link UserComparisonView}, which is presentational: the hook
 * is instantiated by the *host* (dialog or pushed view) rather than by the view, so
 * that the hook's mount lifetime is the host's, not the visible surface's.
 */
export type UserComparisonState = ReturnType<typeof useUserComparison>;
