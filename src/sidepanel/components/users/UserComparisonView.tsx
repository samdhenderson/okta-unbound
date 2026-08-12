/**
 * @module sidepanel/components/users/UserComparisonView
 * @description The two-user comparison surface itself, independent of how it is shown.
 *
 * Purely presentational: every piece of state (search, load, bucketing, similarity,
 * optimistic group-copy) is owned by
 * {@link sidepanel/hooks/useUserComparison.useUserComparison} and handed in whole as
 * {@link UserComparisonViewProps.comparison}. This component only renders the search
 * phase or the hero / tab-bar / overview / diff subcomponents and forwards intent.
 *
 * ## Why the hook lives in the host, not here
 *
 * The comparison has two hosts — {@link UserComparisonModal} (the Overview's dialog)
 * and {@link UserComparisonPanel} (the Users tab's pushed view, ADR-0016) — and both
 * must keep the comparison's state alive while the surface is hidden so that
 * `useUserComparison`'s reset effect, not an unmount, is what clears it. A dialog
 * unmounts its children when closed, so a hook called *here* would have a different
 * lifetime in each host. It is therefore instantiated one level up, in each host.
 *
 * "Change user" is rendered here rather than by the host: the dialog has a footer and
 * the pushed view does not, so the one affordance that must exist in both lives with
 * the surface it acts on.
 */
import React from 'react';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import ComparisonSearchPhase from './comparison/ComparisonSearchPhase';
import ComparisonHero from './comparison/ComparisonHero';
import ComparisonTabBar from './comparison/ComparisonTabBar';
import ComparisonOverviewTab from './comparison/ComparisonOverviewTab';
import ComparisonDiffTab from './comparison/ComparisonDiffTab';
import AppScopeIndicator from './comparison/AppScopeIndicator';
import { groupDiffItem } from './comparison/comparisonAnalytics';
import type { UserComparisonState } from '../../hooks/useUserComparison';
import type { OktaUser } from '../../../shared/types';

/** Props for {@link UserComparisonView}. */
export interface UserComparisonViewProps {
  /** The "context" user being compared from (the user currently in focus). */
  contextUser: OktaUser;
  /** The whole comparison view model, from the host's `useUserComparison` instance. */
  comparison: UserComparisonState;
}

/**
 * Renders the comparison of the context user against a second, searched-for user:
 * shared/unique groups and app assignments, with missing groups copyable in either
 * direction.
 *
 * @param props - See {@link UserComparisonViewProps}.
 */
const UserComparisonView: React.FC<UserComparisonViewProps> = ({ contextUser, comparison }) => {
  const {
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
  } = comparison;

  return (
    <>
      {!comparedUser && (
        <ComparisonSearchPhase
          contextUser={contextUser}
          contextName={contextName}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearching={isSearching}
          searchResults={searchResults}
          onSelectUser={selectUser}
        />
      )}

      {comparedUser && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={changeUser} icon="refresh">
              Change user
            </Button>
          </div>

          <ComparisonHero
            contextUser={contextUser}
            comparedUser={comparedUser}
            contextName={contextName}
            comparedName={comparedName}
            similarity={overallSimilarity}
            isLoading={isLoading}
          />

          <ComparisonTabBar
            activeTab={activeTab}
            onChange={setActiveTab}
            groupDiff={groupDiffCount}
            appDiff={appDiffCount}
          />

          {isLoading && (
            <div className="py-8">
              <LoadingSpinner size="md" message="Crunching memberships and assignments…" centered />
            </div>
          )}

          {!isLoading && loadError && (
            <AlertMessage message={{ text: loadError, type: 'danger' }} />
          )}

          {!isLoading && !loadError && (
            <>
              {addError && (
                <AlertMessage
                  message={{ text: addError, type: 'danger' }}
                  onDismiss={() => setAddError(null)}
                />
              )}

              {activeTab === 'overview' && (
                <ComparisonOverviewTab
                  contextName={contextName}
                  comparedName={comparedName}
                  groupBuckets={groupBuckets}
                  appBuckets={appBuckets}
                  groupSimilarity={groupSimilarity}
                  appSimilarity={appSimilarity}
                  onJumpToGroups={() => setActiveTab('groups')}
                  onJumpToApps={() => setActiveTab('apps')}
                />
              )}

              {activeTab === 'groups' && (
                <ComparisonDiffTab
                  contextName={contextName}
                  comparedName={comparedName}
                  // groupDiffItem carries the whole membership onto the row, so the
                  // diff can say why a group is held and not merely that it is.
                  comparedItems={groupBuckets.onlyCompared.map(groupDiffItem)}
                  sharedItems={groupBuckets.shared.map(groupDiffItem)}
                  contextItems={groupBuckets.onlyContext.map(groupDiffItem)}
                  emptyComparedText={`${comparedName} has no groups ${contextName} is missing.`}
                  emptySharedText="No groups in common yet."
                  emptyContextText={`No groups unique to ${contextName}.`}
                  noun="group"
                  renderAction={(item) => {
                    // Re-find the group in the LIVE onlyCompared bucket: after a
                    // successful add it moves to `shared`, the find returns undefined,
                    // and the Add button vanishes — that disappearance IS the success
                    // affordance. `disabled={addingGroupId !== null}` is a GLOBAL
                    // single-flight lock, not a per-row one. Keep both verbatim.
                    // (`item.membership` holds the same membership, but re-finding
                    // in the live bucket is what makes the button disappear.)
                    const m = groupBuckets.onlyCompared.find((b) => b.group.id === item.id);
                    if (!m) return null;
                    return (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="plus"
                        loading={addingGroupId === m.group.id}
                        disabled={addingGroupId !== null}
                        onClick={() => addToContext(m.group)}
                      >
                        Add
                      </Button>
                    );
                  }}
                  renderContextAction={(item) => {
                    // Mirror image of renderAction, in the other direction: copy a
                    // group the context user has onto the compared user. On success it
                    // re-buckets from onlyContext into `shared`, so the button vanishes
                    // the same way. Same GLOBAL single-flight lock.
                    const m = groupBuckets.onlyContext.find((b) => b.group.id === item.id);
                    if (!m) return null;
                    return (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="plus"
                        loading={addingGroupId === m.group.id}
                        disabled={addingGroupId !== null}
                        onClick={() => addToCompared(m.group)}
                      >
                        Add
                      </Button>
                    );
                  }}
                />
              )}

              {activeTab === 'apps' && (
                <ComparisonDiffTab
                  contextName={contextName}
                  comparedName={comparedName}
                  comparedItems={appBuckets.onlyCompared.map((a) => ({
                    id: a.id,
                    label: a.label,
                  }))}
                  sharedItems={appBuckets.shared.map((a) => ({
                    id: a.id,
                    label: a.label,
                  }))}
                  contextItems={appBuckets.onlyContext.map((a) => ({
                    id: a.id,
                    label: a.label,
                  }))}
                  emptyComparedText={`${comparedName} has no apps ${contextName} is missing.`}
                  emptySharedText="No apps in common yet."
                  emptyContextText={`No apps unique to ${contextName}.`}
                  noun="app"
                  renderMeta={(item, bucket) => {
                    // The `shared` bucket is derived from the COMPARED user's
                    // assignments alone (see `bucketApps`), so the only scope in
                    // hand for a shared row describes one of the two users the row
                    // is about. Rendering it would present one user's source as if
                    // it described both, so the row says that instead. Naming both
                    // would mean carrying both sides through bucketing.
                    if (bucket === 'shared') return <AppScopeIndicator state="notCompared" />;

                    // Re-find the entry in the LIVE bucket rather than widening the
                    // row model, mirroring `renderAction` above. A row whose entry
                    // cannot be found reads as unknown, never as "via group".
                    const entries =
                      bucket === 'onlyCompared' ? appBuckets.onlyCompared : appBuckets.onlyContext;
                    const entry = entries.find((a) => a.id === item.id);
                    return <AppScopeIndicator state={entry?.scope ?? 'unknown'} />;
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};

export default UserComparisonView;
