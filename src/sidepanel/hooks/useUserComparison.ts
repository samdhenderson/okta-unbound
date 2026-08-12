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
import { useUserMemberships } from './useUserMemberships';
import { useComparisonApps } from './useComparisonApps';
import { useGroupCopy } from './useGroupCopy';
import { userDisplayName } from '../../shared/utils/userDisplay';
import {
  jaccard,
  bucketGroups,
  bucketApps,
  type TabKey,
} from '../components/users/comparison/comparisonAnalytics';
import type { OktaUser, GroupMembership } from '../../shared/types';

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
  /** Called after groups are copied so the parent can refresh context data. */
  onGroupsChanged: () => void;
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
 *   plus `overallSimilarity`, aggregated `isLoading` / `loadError`, group-copy
 *   state (`addingGroupId`, `addError`) and the bidirectional `addToContext` /
 *   `addToCompared` actions, display names, and the `selectUser` / `changeUser`
 *   actions.
 */
export function useUserComparison({
  isActive,
  searchEnabled,
  contextUser,
  contextGroups,
  targetTabId,
  onGroupsChanged,
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
    loadMemberships,
    clearMemberships,
  } = useUserMemberships({ targetTabId });

  const [comparedUser, setComparedUser] = useState<OktaUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const { contextApps, comparedApps, isLoadingApps, appsError, resetApps } = useComparisonApps({
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

  const groupDiffCount = groupBuckets.onlyCompared.length + groupBuckets.onlyContext.length;
  const appDiffCount = appBuckets.onlyCompared.length + appBuckets.onlyContext.length;

  const groupSimilarity = jaccard(
    groupBuckets.shared.length,
    groupBuckets.shared.length + groupBuckets.onlyCompared.length + groupBuckets.onlyContext.length,
  );
  const appSimilarity = jaccard(
    appBuckets.shared.length,
    appBuckets.shared.length + appBuckets.onlyCompared.length + appBuckets.onlyContext.length,
  );
  const overallSimilarity = comparedUser ? Math.round((groupSimilarity + appSimilarity) / 2) : 0;

  const isLoading = isLoadingGroups || isLoadingApps;
  const loadError = groupsError || appsError;

  const contextName = userDisplayName(contextUser);
  const comparedName = comparedUser ? userDisplayName(comparedUser) : '';

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
    groupDiffCount,
    appDiffCount,
    groupSimilarity,
    appSimilarity,
    overallSimilarity,
    isLoading,
    loadError,
    addingGroupId,
    addError,
    setAddError,
    addToContext,
    addToCompared,
    contextName,
    comparedName,
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
