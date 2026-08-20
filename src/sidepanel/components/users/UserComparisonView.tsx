/**
 * @module sidepanel/components/users/UserComparisonView
 * @description The two-user comparison surface itself, independent of how it is shown.
 *
 * Purely presentational: every piece of state (search, load, bucketing, similarity,
 * optimistic group-copy) is owned by
 * {@link sidepanel/hooks/useUserComparison.useUserComparison} and handed in whole as
 * {@link UserComparisonViewProps.comparison}. This component only renders the search
 * phase or the hero / tab-bar / overview / diff / attributes subcomponents and
 * forwards intent.
 *
 * The four tabs answer four different questions. Groups and apps are *set*
 * diffs — who holds what. {@link ComparisonAttributesTab} is a *value* diff, and
 * it is the one that usually explains the other two, because the attributes are
 * the evidence group rules read. It feeds no similarity figure: `overallSimilarity`
 * averages exactly two Jaccard terms, and attributes are not access.
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
 *
 * ## Why `onViewClauses` is not passed to the overview tab
 *
 * {@link ComparisonOverviewTab} accepts an optional `onViewClauses` that would deep-link
 * a worklist row into a full clause checklist. It is left unpassed, which the worklist
 * degrades to cleanly: every row still renders its failing-clause evidence inline and
 * simply offers no jump.
 *
 * Passing it would put an "Open clause checklist" button on **every** row —
 * `CauseWorklistRow` renders the button whenever the callback exists, and that is
 * pinned by its tests. But a `manual-add` row is, by construction, one that **no rule
 * targets at all**, and a rule-less `cannot-determine` row carries no `ruleId` either
 * ({@link AccessCause} names a rule only when exactly one is implicated), so for a
 * whole remedy group there would be no condition to explain and the button would
 * dead-end. Wiring it therefore needs a per-row decision about whether the jump exists
 * plus a clause-detail surface that does not exist yet — a UX change, not the
 * integration this module performs.
 */
import React from 'react';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import OpenInOktaLink from '../shared/OpenInOktaLink';
import ComparisonSearchPhase from './comparison/ComparisonSearchPhase';
import ComparisonHero from './comparison/ComparisonHero';
import ComparisonTabBar from './comparison/ComparisonTabBar';
import ComparisonOverviewTab from './comparison/ComparisonOverviewTab';
import ComparisonDiffTab from './comparison/ComparisonDiffTab';
import ComparisonAttributesTab from './comparison/ComparisonAttributesTab';
import AppScopeIndicator from './comparison/AppScopeIndicator';
import GroupSourceIndicator from './comparison/GroupSourceIndicator';
import { groupParityRows, appParityRows } from './comparison/comparisonAnalytics';
import type { UserComparisonState } from '../../hooks/useUserComparison';
import type { OktaUser } from '../../../shared/types';

/** Props for {@link UserComparisonView}. */
export interface UserComparisonViewProps {
  /** The "context" user being compared from (the user currently in focus). */
  contextUser: OktaUser;
  /** The whole comparison view model, from the host's `useUserComparison` instance. */
  comparison: UserComparisonState;
  /**
   * Okta org origin, for the deep link offered against a group the context user
   * must *leave*. Absent, {@link OpenInOktaLink} renders nothing and the group is
   * named without an action — which is the correct degradation, not a failure.
   */
  oktaOrigin?: string | null;
}

/**
 * Renders the comparison of the context user against a second, searched-for user:
 * shared/unique groups and app assignments, with missing groups copyable in either
 * direction.
 *
 * @param props - See {@link UserComparisonViewProps}.
 */
const UserComparisonView: React.FC<UserComparisonViewProps> = ({
  contextUser,
  comparison,
  oktaOrigin,
}) => {
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
    causes,
    groupDiffCount,
    appDiffCount,
    attributeParity,
    attributeDiffCount,
    attributeConfig,
    attributeRuleReads,
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
            // Says what the surviving number covers when the app half could not be
            // read. Without it the headline is a group-overlap figure wearing the
            // label of an overall match.
            scopeNote={similarityScope === 'groups-only' ? 'groups only' : undefined}
            isLoading={isLoading}
          />

          <ComparisonTabBar
            activeTab={activeTab}
            onChange={setActiveTab}
            groupDiff={groupDiffCount}
            appDiff={appDiffCount}
            attributeDiff={attributeDiffCount}
          />

          {isLoading && (
            <div className="py-8">
              <LoadingSpinner size="xl" message="Crunching memberships and assignments…" centered />
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

              {/* Advisory, not blocking — the group half of the comparison loaded
                  and is worth showing. Rendered above the tab content rather than
                  inside the Apps tab so the caveat is visible from the Overview,
                  which is where the app counts and the match score are read.
                  Deliberately not dismissible: the numbers it qualifies stay on
                  screen, so the caveat has to as well. */}
              {appsIncomplete && (
                <AlertMessage
                  message={{
                    text: 'Some app assignments could not be loaded. The app comparison is incomplete, and the match score covers groups only.',
                    type: 'warning',
                  }}
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
                  // Classified upstream (`useUserComparison`), not here: the
                  // classification is a memoized derivation of the same buckets,
                  // and this component stays presentational. `onViewClauses` is
                  // deliberately not passed — see the module header.
                  causes={causes}
                  renderGroupAction={(reference) => {
                    // A rule names a prerequisite group by id or by name; granting
                    // it needs a real OktaGroup. The only groups we hold in full
                    // are the compared user's own — which is the common case, since
                    // they qualified for the rule this clause belongs to. Anything
                    // else is named without an action rather than fetched.
                    const match = groupBuckets.onlyCompared.find((m) =>
                      reference.match === 'id'
                        ? m.group.id === reference.value
                        : m.group.profile.name === reference.value,
                    );
                    if (!match) return null;
                    return (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="plus"
                        loading={addingGroupId === match.group.id}
                        // The same GLOBAL single-flight lock the diff rows use, so
                        // a copy started here cannot race one started there.
                        disabled={addingGroupId !== null}
                        onClick={() => addToContext(match.group)}
                      >
                        Add
                      </Button>
                    );
                  }}
                  resolveGroupName={resolveGroupName}
                  renderBlockingGroupAction={(reference) => {
                    // Deliberately NOT a Remove button. Dropping a membership is
                    // a destructive write on a group this surface never granted,
                    // and the admin needs the group's own page — its other
                    // members, its rules, why they are in it — to judge whether
                    // removing them is right. So: name it, and open it in Okta.
                    //
                    // `matchedGroupName` proves the user is in this group, but
                    // only an `id` reference carries something linkable; a
                    // name/prefix match resolves through their own memberships.
                    const groupId =
                      reference.match === 'id'
                        ? reference.value
                        : groupBuckets.onlyContext
                            .concat(groupBuckets.shared)
                            .find((m) => m.group.profile.name === reference.matchedGroupName)?.group
                            .id;
                    return (
                      <OpenInOktaLink
                        oktaOrigin={oktaOrigin}
                        entityType="group"
                        entityId={groupId}
                        label="Open group"
                      />
                    );
                  }}
                />
              )}

              {activeTab === 'groups' && (
                <ComparisonDiffTab
                  contextName={contextName}
                  comparedName={comparedName}
                  // One row per group either user holds, differences first. The
                  // buckets stay the source of truth — `groupParityRows` only
                  // reshapes them — so the worklist and this list can never
                  // disagree about which groups are shared.
                  rows={groupParityRows(groupBuckets)}
                  noun="group"
                  emptyText="Neither user is in any groups."
                  renderContextAction={(row, recipientName) => {
                    // Re-find in the LIVE bucket rather than trusting the row:
                    // after a successful add the group moves to `shared`, the
                    // find returns undefined, and the cell flips to a check —
                    // which is the success affordance, in place.
                    const m = groupBuckets.onlyCompared.find((b) => b.group.id === row.id);
                    // An app masters its own roster; adding a member through the
                    // group API would be rejected. The row states "Managed by
                    // app" instead of offering a button that cannot work.
                    if (!m || m.group.type === 'APP_GROUP') return null;
                    return (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="plus"
                        // Fills its third, so the cell matches the named cell
                        // opposite it instead of floating in the middle of it.
                        fullWidth
                        loading={addingGroupId === m.group.id}
                        // GLOBAL single-flight lock, not a per-row one: a copy
                        // started anywhere disables every other Add. Keep verbatim.
                        disabled={addingGroupId !== null}
                        onClick={() => addToContext(m.group)}
                      >
                        {/* Names the recipient — this cell's own user, who is
                            exactly who `addToContext` adds the group to. */}
                        Add {recipientName}
                      </Button>
                    );
                  }}
                  renderComparedAction={(row, recipientName) => {
                    // Mirror image, on the other side. Same lock, same in-place
                    // success, and the same "the button names who receives" rule.
                    const m = groupBuckets.onlyContext.find((b) => b.group.id === row.id);
                    if (!m || m.group.type === 'APP_GROUP') return null;
                    return (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="plus"
                        fullWidth
                        loading={addingGroupId === m.group.id}
                        disabled={addingGroupId !== null}
                        onClick={() => addToCompared(m.group)}
                      >
                        Add {recipientName}
                      </Button>
                    );
                  }}
                  renderMeta={(row) => {
                    // A shared row's membership is ONE user's — the compared
                    // user's, except for a context-only group optimistically
                    // copied onto them (see `bucketGroups`). Stating a source
                    // there would present one user's provenance as if it
                    // described both, so a shared row says nothing about how the
                    // group was granted.
                    if (row.inContext && row.inCompared) return null;
                    return <GroupSourceIndicator membership={row.membership} />;
                  }}
                />
              )}

              {activeTab === 'attributes' && (
                <ComparisonAttributesTab
                  contextName={contextName}
                  comparedName={comparedName}
                  // Ordered by the pure module (differences first, then the
                  // config's order, then A–Z) and handed over untouched — the tab
                  // filters and groups, it never re-sorts.
                  rows={attributeParity.rows}
                  // Kept and counted rather than dropped: a compare that silently
                  // omitted the one differing attribute explaining an access gap
                  // would be worse than no compare at all.
                  hiddenRows={attributeParity.hiddenRows}
                  hiddenDifferences={attributeParity.hiddenDifferences}
                  config={attributeConfig}
                  ruleReads={attributeRuleReads}
                />
              )}

              {activeTab === 'apps' && (
                <ComparisonDiffTab
                  contextName={contextName}
                  comparedName={comparedName}
                  rows={appParityRows(appBuckets)}
                  noun="app"
                  // An empty list means two different things. "Neither user is
                  // assigned any apps" is a finding; when the walk failed, the
                  // only true statement is that we do not know.
                  emptyText={
                    appsIncomplete
                      ? 'App assignments could not be loaded for this comparison.'
                      : 'Neither user is assigned any apps.'
                  }
                  // No actions: an app assignment is not copyable from this
                  // surface, so both sides are read-only and the row is a pure
                  // parity statement.
                  renderMeta={(row) => {
                    // `shared` is derived from the COMPARED user's assignments
                    // alone (see `bucketApps`), so the only scope in hand for a
                    // shared row describes one of the two users it is about.
                    if (row.inContext && row.inCompared) {
                      return <AppScopeIndicator state="notCompared" />;
                    }
                    const entries = row.inCompared
                      ? appBuckets.onlyCompared
                      : appBuckets.onlyContext;
                    const entry = entries.find((a) => a.id === row.id);
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
