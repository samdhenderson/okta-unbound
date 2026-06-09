import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import UserSearchResults from './UserSearchResults';
import { useUserSearch } from '../../hooks/useUserSearch';
import { useUserMemberships } from '../../hooks/useUserMemberships';
import { useOktaApi } from '../../hooks/useOktaApi';
import type { OktaUser, OktaGroup, GroupMembership } from '../../../shared/types';

interface UserComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The user the overview page is about (the "add to" target). */
  contextUser: OktaUser;
  /** Context user's already-analyzed group memberships. */
  contextGroups: GroupMembership[];
  targetTabId: number;
  /** Notifies the overview to reload memberships after a group is added. */
  onGroupsChanged: () => void;
}

interface AppEntry {
  id: string;
  label: string;
}

const userDisplayName = (user: OktaUser): string => {
  const name = `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim();
  return name || user.profile.login || user.profile.email || 'User';
};

const UserComparisonModal: React.FC<UserComparisonModalProps> = ({
  isOpen,
  onClose,
  contextUser,
  contextGroups,
  targetTabId,
  onGroupsChanged,
}) => {
  const { searchQuery, setSearchQuery, searchResults, isSearching, clearSearch } =
    useUserSearch({ targetTabId });

  const {
    memberships: comparedGroups,
    isLoading: isLoadingGroups,
    error: groupsError,
    loadMemberships,
    clearMemberships,
  } = useUserMemberships({ targetTabId });

  const { getUserApps, addUserToGroup } = useOktaApi({ targetTabId: targetTabId ?? null });

  const [comparedUser, setComparedUser] = useState<OktaUser | null>(null);
  const [contextApps, setContextApps] = useState<AppEntry[]>([]);
  const [comparedApps, setComparedApps] = useState<AppEntry[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);

  // Groups added to the context user during this session (move to "shared").
  const [addedGroupIds, setAddedGroupIds] = useState<Set<string>>(new Set());
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Reset all internal state whenever the modal is closed.
  useEffect(() => {
    if (!isOpen) {
      setComparedUser(null);
      setContextApps([]);
      setComparedApps([]);
      setAppsError(null);
      setAddedGroupIds(new Set());
      setAddingGroupId(null);
      setAddError(null);
      clearSearch();
      clearMemberships();
    }
  }, [isOpen, clearSearch, clearMemberships]);

  // When a comparison user is selected, load both users' groups and apps.
  useEffect(() => {
    if (!comparedUser) return;

    loadMemberships(comparedUser);

    let cancelled = false;
    setIsLoadingApps(true);
    setAppsError(null);
    Promise.all([getUserApps(contextUser.id), getUserApps(comparedUser.id)])
      .then(([ctxApps, cmpApps]) => {
        if (cancelled) return;
        setContextApps(ctxApps);
        setComparedApps(cmpApps);
      })
      .catch((err) => {
        if (cancelled) return;
        setAppsError(err instanceof Error ? err.message : 'Failed to load app assignments');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApps(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparedUser]);

  const handleSelectUser = useCallback((user: OktaUser) => {
    setComparedUser(user);
  }, []);

  const handleChangeUser = useCallback(() => {
    setComparedUser(null);
    setContextApps([]);
    setComparedApps([]);
    setAppsError(null);
    setAddedGroupIds(new Set());
    setAddError(null);
    clearMemberships();
    clearSearch();
  }, [clearMemberships, clearSearch]);

  const handleAddGroup = useCallback(
    async (group: OktaGroup) => {
      setAddingGroupId(group.id);
      setAddError(null);
      try {
        const result = await addUserToGroup(group.id, group.profile.name, {
          id: contextUser.id,
          profile: {
            login: contextUser.profile.login,
            firstName: contextUser.profile.firstName,
            lastName: contextUser.profile.lastName,
            email: contextUser.profile.email,
          },
        });

        if (result.success) {
          setAddedGroupIds((prev) => new Set(prev).add(group.id));
          onGroupsChanged();
        } else {
          setAddError(result.error || `Failed to add to ${group.profile.name}`);
        }
      } catch (err) {
        setAddError(err instanceof Error ? err.message : 'Failed to add user to group');
      } finally {
        setAddingGroupId(null);
      }
    },
    [addUserToGroup, contextUser, onGroupsChanged]
  );

  // Compute group diff buckets. Added-this-session groups count as shared.
  const groupBuckets = useMemo(() => {
    const contextGroupIds = new Set(contextGroups.map((m) => m.group.id));
    const comparedGroupIds = new Set(comparedGroups.map((m) => m.group.id));

    const onlyCompared: OktaGroup[] = [];
    const shared: OktaGroup[] = [];
    for (const m of comparedGroups) {
      if (contextGroupIds.has(m.group.id) || addedGroupIds.has(m.group.id)) {
        shared.push(m.group);
      } else {
        onlyCompared.push(m.group);
      }
    }

    const onlyContext = contextGroups
      .filter((m) => !comparedGroupIds.has(m.group.id))
      .map((m) => m.group);

    return { onlyCompared, shared, onlyContext };
  }, [contextGroups, comparedGroups, addedGroupIds]);

  // Compute app diff buckets.
  const appBuckets = useMemo(() => {
    const contextAppIds = new Set(contextApps.map((a) => a.id));
    const comparedAppIds = new Set(comparedApps.map((a) => a.id));

    const onlyCompared = comparedApps.filter((a) => !contextAppIds.has(a.id));
    const shared = comparedApps.filter((a) => contextAppIds.has(a.id));
    const onlyContext = contextApps.filter((a) => !comparedAppIds.has(a.id));

    return { onlyCompared, shared, onlyContext };
  }, [contextApps, comparedApps]);

  const isLoading = isLoadingGroups || isLoadingApps;
  const loadError = groupsError || appsError;

  const contextName = userDisplayName(contextUser);
  const comparedName = comparedUser ? userDisplayName(comparedUser) : '';

  const title = comparedUser
    ? `Compare: ${contextName} vs ${comparedName}`
    : `Compare ${contextName} with…`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <>
          {comparedUser && (
            <Button variant="ghost" onClick={handleChangeUser}>
              Change user
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {/* Phase A: pick a user to compare against */}
      {!comparedUser && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Search for another user to compare group memberships and app assignments
            with <span className="font-semibold text-neutral-900">{contextName}</span>.
          </p>
          <input
            type="text"
            autoFocus
            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-md text-sm placeholder-neutral-400 focus:outline-none focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:border-primary transition-all duration-100 shadow-sm"
            placeholder="Search by email, name, or login..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && (
            <div className="text-center py-4 text-sm text-neutral-500">Searching…</div>
          )}
          <UserSearchResults
            results={searchResults.filter((u) => u.id !== contextUser.id)}
            onSelectUser={handleSelectUser}
          />
        </div>
      )}

      {/* Phase B: comparison */}
      {comparedUser && (
        <div className="space-y-5">
          {isLoading && (
            <LoadingSpinner size="md" message="Loading comparison…" centered />
          )}

          {!isLoading && loadError && (
            <AlertMessage message={{ text: loadError, type: 'error' }} />
          )}

          {!isLoading && !loadError && (
            <>
              {addError && (
                <AlertMessage
                  message={{ text: addError, type: 'error' }}
                  onDismiss={() => setAddError(null)}
                />
              )}

              <ComparisonSection
                heading="Group Memberships"
                contextName={contextName}
                comparedName={comparedName}
                onlyComparedCount={groupBuckets.onlyCompared.length}
                sharedCount={groupBuckets.shared.length}
                onlyContextCount={groupBuckets.onlyContext.length}
              >
                <BucketList
                  title={`Only ${comparedName} has — add to ${contextName}`}
                  tone="add"
                  items={groupBuckets.onlyCompared.map((g) => ({
                    id: g.id,
                    label: g.profile.name,
                    action: (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="plus"
                        loading={addingGroupId === g.id}
                        disabled={addingGroupId !== null}
                        onClick={() => handleAddGroup(g)}
                      >
                        Add
                      </Button>
                    ),
                  }))}
                  emptyText={`${comparedName} has no groups ${contextName} is missing.`}
                />
                <BucketList
                  title="Shared"
                  tone="shared"
                  items={groupBuckets.shared.map((g) => ({ id: g.id, label: g.profile.name }))}
                  emptyText="No groups in common."
                />
                <BucketList
                  title={`Only ${contextName} has`}
                  tone="neutral"
                  items={groupBuckets.onlyContext.map((g) => ({ id: g.id, label: g.profile.name }))}
                  emptyText={`No groups unique to ${contextName}.`}
                />
              </ComparisonSection>

              <ComparisonSection
                heading="App Assignments"
                contextName={contextName}
                comparedName={comparedName}
                onlyComparedCount={appBuckets.onlyCompared.length}
                sharedCount={appBuckets.shared.length}
                onlyContextCount={appBuckets.onlyContext.length}
              >
                <BucketList
                  title={`Only ${comparedName} has`}
                  tone="info"
                  items={appBuckets.onlyCompared.map((a) => ({ id: a.id, label: a.label }))}
                  emptyText={`${comparedName} has no apps ${contextName} is missing.`}
                />
                <BucketList
                  title="Shared"
                  tone="shared"
                  items={appBuckets.shared.map((a) => ({ id: a.id, label: a.label }))}
                  emptyText="No apps in common."
                />
                <BucketList
                  title={`Only ${contextName} has`}
                  tone="neutral"
                  items={appBuckets.onlyContext.map((a) => ({ id: a.id, label: a.label }))}
                  emptyText={`No apps unique to ${contextName}.`}
                />
              </ComparisonSection>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};

interface ComparisonSectionProps {
  heading: string;
  contextName: string;
  comparedName: string;
  onlyComparedCount: number;
  sharedCount: number;
  onlyContextCount: number;
  children: React.ReactNode;
}

const ComparisonSection: React.FC<ComparisonSectionProps> = ({
  heading,
  onlyComparedCount,
  sharedCount,
  onlyContextCount,
  children,
}) => (
  <div className="space-y-3">
    <div className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
      {heading}
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div className="p-3 bg-primary-light rounded-md border border-primary-highlight text-center">
        <div className="text-2xl font-bold text-primary-text">{onlyComparedCount}</div>
        <div className="text-xs text-primary-text mt-0.5">Compared only</div>
      </div>
      <div className="p-3 bg-success-light rounded-md border border-success-light text-center">
        <div className="text-2xl font-bold text-success-text">{sharedCount}</div>
        <div className="text-xs text-success-text mt-0.5">Shared</div>
      </div>
      <div className="p-3 bg-neutral-50 rounded-md border border-neutral-200 text-center">
        <div className="text-2xl font-bold text-neutral-900">{onlyContextCount}</div>
        <div className="text-xs text-neutral-600 mt-0.5">Context only</div>
      </div>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

interface BucketItem {
  id: string;
  label: string;
  action?: React.ReactNode;
}

interface BucketListProps {
  title: string;
  tone: 'add' | 'shared' | 'neutral' | 'info';
  items: BucketItem[];
  emptyText: string;
}

const toneClasses: Record<BucketListProps['tone'], string> = {
  add: 'border-primary-highlight',
  shared: 'border-success-light',
  info: 'border-neutral-200',
  neutral: 'border-neutral-200',
};

const BucketList: React.FC<BucketListProps> = ({ title, tone, items, emptyText }) => (
  <div className={`rounded-md border ${toneClasses[tone]} bg-white overflow-hidden`}>
    <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200">
      <span className="text-sm font-semibold text-neutral-800">{title}</span>
      <span className="px-2 py-0.5 bg-white rounded-full text-xs font-medium text-neutral-600 shadow-sm">
        {items.length}
      </span>
    </div>
    {items.length === 0 ? (
      <div className="px-4 py-3 text-xs text-neutral-400">{emptyText}</div>
    ) : (
      <div className="divide-y divide-neutral-100 max-h-48 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-neutral-50"
          >
            <span className="text-sm text-neutral-800 truncate">{item.label}</span>
            {item.action}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default UserComparisonModal;
