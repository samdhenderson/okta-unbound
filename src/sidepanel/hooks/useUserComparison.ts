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

interface UseUserComparisonOptions {
  isOpen: boolean;
  contextUser: OktaUser;
  contextGroups: GroupMembership[];
  targetTabId: number;
  onGroupsChanged: () => void;
}

/**
 * Orchestrates the two-user comparison: composes search, memberships, apps and the
 * group-copy concern; owns `comparedUser` (the phase switch) and `activeTab`, plus
 * the two reset paths and the derived buckets/similarity. This is the single place
 * that knows the reset ordering.
 */
export function useUserComparison({
  isOpen,
  contextUser,
  contextGroups,
  targetTabId,
  onGroupsChanged,
}: UseUserComparisonOptions) {
  const { searchQuery, setSearchQuery, searchResults, isSearching, clearSearch } = useUserSearch({
    targetTabId,
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

  const {
    addedGroupIds,
    addingGroupId,
    addError,
    setAddError,
    addGroup,
    resetCopyState,
    resetForChangeUser,
  } = useGroupCopy({ targetTabId, contextUser, onGroupsChanged });

  // Reset everything when the modal closes. The parent keeps this component mounted
  // across close (only Modal's children unmount), so this effect is the sole thing
  // preventing a reopened modal from showing the previous comparison. It also runs
  // harmlessly on first mount (isOpen=false).
  useEffect(() => {
    if (!isOpen) {
      setComparedUser(null);
      resetApps();
      resetCopyState();
      setActiveTab('overview');
      clearSearch();
      clearMemberships();
    }
  }, [isOpen, resetApps, resetCopyState, clearSearch, clearMemberships]);

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
    () => bucketGroups(contextGroups, comparedGroups, addedGroupIds),
    [contextGroups, comparedGroups, addedGroupIds],
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
    addedGroupIds,
    addingGroupId,
    addError,
    setAddError,
    addGroup,
    contextName,
    comparedName,
    selectUser,
    changeUser,
  };
}
