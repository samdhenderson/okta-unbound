import React from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import ComparisonSearchPhase from './comparison/ComparisonSearchPhase';
import ComparisonHero from './comparison/ComparisonHero';
import ComparisonTabBar from './comparison/ComparisonTabBar';
import ComparisonOverviewTab from './comparison/ComparisonOverviewTab';
import ComparisonDiffTab from './comparison/ComparisonDiffTab';
import { useUserComparison } from '../../hooks/useUserComparison';
import type { OktaUser, GroupMembership } from '../../../shared/types';

interface UserComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextUser: OktaUser;
  contextGroups: GroupMembership[];
  targetTabId: number;
  onGroupsChanged: () => void;
}

const UserComparisonModal: React.FC<UserComparisonModalProps> = ({
  isOpen,
  onClose,
  contextUser,
  contextGroups,
  targetTabId,
  onGroupsChanged,
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
    addGroup,
    contextName,
    comparedName,
    selectUser,
    changeUser,
  } = useUserComparison({ isOpen, contextUser, contextGroups, targetTabId, onGroupsChanged });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={comparedUser ? 'Side-by-side comparison' : 'Compare with another user'}
      size="xl"
      footer={
        <>
          {comparedUser && (
            <Button variant="ghost" onClick={changeUser} icon="refresh">
              Change user
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
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
                  comparedItems={groupBuckets.onlyCompared.map((g) => ({
                    id: g.id,
                    label: g.profile.name,
                  }))}
                  sharedItems={groupBuckets.shared.map((g) => ({
                    id: g.id,
                    label: g.profile.name,
                  }))}
                  contextItems={groupBuckets.onlyContext.map((g) => ({
                    id: g.id,
                    label: g.profile.name,
                  }))}
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
                    const group = groupBuckets.onlyCompared.find((g) => g.id === item.id);
                    if (!group) return null;
                    return (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="plus"
                        loading={addingGroupId === group.id}
                        disabled={addingGroupId !== null}
                        onClick={() => addGroup(group)}
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
                />
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
};

export default UserComparisonModal;
