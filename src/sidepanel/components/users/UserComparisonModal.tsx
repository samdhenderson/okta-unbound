import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import Icon from '../overview/shared/Icon';
import UserSearchResults from './UserSearchResults';
import { useUserSearch } from '../../hooks/useUserSearch';
import { useUserMemberships } from '../../hooks/useUserMemberships';
import { useOktaApi } from '../../hooks/useOktaApi';
import type { OktaUser, OktaGroup, GroupMembership } from '../../../shared/types';

interface UserComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextUser: OktaUser;
  contextGroups: GroupMembership[];
  targetTabId: number;
  onGroupsChanged: () => void;
}

interface AppEntry {
  id: string;
  label: string;
}

type TabKey = 'overview' | 'groups' | 'apps';

const userDisplayName = (user: OktaUser): string => {
  const name = `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim();
  return name || user.profile.login || user.profile.email || 'User';
};

const initialsOf = (user: OktaUser): string => {
  const first = (user.profile.firstName || '').trim();
  const last = (user.profile.lastName || '').trim();
  if (first || last) {
    return `${first[0] || ''}${last[0] || ''}`.toUpperCase() || '?';
  }
  const fallback = user.profile.login || user.profile.email || '?';
  return fallback.slice(0, 2).toUpperCase();
};

// Stable hue per user id so avatar colors are consistent across renders.
const hueFromId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
};

const jaccard = (sharedCount: number, unionCount: number): number =>
  unionCount === 0 ? 0 : Math.round((sharedCount / unionCount) * 100);

const UserComparisonModal: React.FC<UserComparisonModalProps> = ({
  isOpen,
  onClose,
  contextUser,
  contextGroups,
  targetTabId,
  onGroupsChanged,
}) => {
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

  const { getUserApps, addUserToGroup } = useOktaApi({ targetTabId: targetTabId ?? null });

  const [comparedUser, setComparedUser] = useState<OktaUser | null>(null);
  const [contextApps, setContextApps] = useState<AppEntry[]>([]);
  const [comparedApps, setComparedApps] = useState<AppEntry[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);

  const [addedGroupIds, setAddedGroupIds] = useState<Set<string>>(new Set());
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  useEffect(() => {
    if (!isOpen) {
      setComparedUser(null);
      setContextApps([]);
      setComparedApps([]);
      setAppsError(null);
      setAddedGroupIds(new Set());
      setAddingGroupId(null);
      setAddError(null);
      setActiveTab('overview');
      clearSearch();
      clearMemberships();
    }
  }, [isOpen, clearSearch, clearMemberships]);

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
    setActiveTab('overview');
  }, []);

  const handleChangeUser = useCallback(() => {
    setComparedUser(null);
    setContextApps([]);
    setComparedApps([]);
    setAppsError(null);
    setAddedGroupIds(new Set());
    setAddError(null);
    setActiveTab('overview');
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
    [addUserToGroup, contextUser, onGroupsChanged],
  );

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

  const appBuckets = useMemo(() => {
    const contextAppIds = new Set(contextApps.map((a) => a.id));
    const comparedAppIds = new Set(comparedApps.map((a) => a.id));

    const onlyCompared = comparedApps.filter((a) => !contextAppIds.has(a.id));
    const shared = comparedApps.filter((a) => contextAppIds.has(a.id));
    const onlyContext = contextApps.filter((a) => !comparedAppIds.has(a.id));

    return { onlyCompared, shared, onlyContext };
  }, [contextApps, comparedApps]);

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={comparedUser ? 'Side-by-side comparison' : 'Compare with another user'}
      size="xl"
      footer={
        <>
          {comparedUser && (
            <Button variant="ghost" onClick={handleChangeUser} icon="refresh">
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
        <SearchPhase
          contextUser={contextUser}
          contextName={contextName}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearching={isSearching}
          searchResults={searchResults}
          onSelectUser={handleSelectUser}
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

          <TabBar
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

          {!isLoading && loadError && <AlertMessage message={{ text: loadError, type: 'error' }} />}

          {!isLoading && !loadError && (
            <>
              {addError && (
                <AlertMessage
                  message={{ text: addError, type: 'error' }}
                  onDismiss={() => setAddError(null)}
                />
              )}

              {activeTab === 'overview' && (
                <OverviewTab
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
                <DiffTab
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
                    const group = groupBuckets.onlyCompared.find((g) => g.id === item.id);
                    if (!group) return null;
                    return (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="plus"
                        loading={addingGroupId === group.id}
                        disabled={addingGroupId !== null}
                        onClick={() => handleAddGroup(group)}
                      >
                        Add
                      </Button>
                    );
                  }}
                />
              )}

              {activeTab === 'apps' && (
                <DiffTab
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

// ------------------------------------------------------------------ Search phase

interface SearchPhaseProps {
  contextUser: OktaUser;
  contextName: string;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  isSearching: boolean;
  searchResults: OktaUser[];
  onSelectUser: (u: OktaUser) => void;
}

const SearchPhase: React.FC<SearchPhaseProps> = ({
  contextUser,
  contextName,
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  onSelectUser,
}) => {
  const filtered = searchResults.filter((u) => u.id !== contextUser.id);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-lg border border-primary-highlight bg-primary-light/60 p-4">
        <div
          className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-white p-2 text-primary shadow-sm">
            <Icon type="sparkles" size="md" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-900">Compare with another user</p>
            <p className="mt-0.5 text-xs text-neutral-600 leading-relaxed">
              Find someone to compare side-by-side with{' '}
              <span className="font-semibold text-primary-text">{contextName}</span>. You&rsquo;ll
              see shared and unique groups and app assignments and can quickly copy missing groups
              over.
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <Icon type="search" size="md" />
        </div>
        <input
          type="text"
          autoFocus
          className="w-full rounded-md border border-neutral-200 bg-white pl-10 pr-4 py-3 text-sm placeholder-neutral-400 shadow-sm transition-all duration-100 focus:border-primary focus:outline-2 focus:outline-offset-2 focus:outline-primary"
          placeholder="Search by email, name, or login…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isSearching && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-neutral-500">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Searching directory…
        </div>
      )}

      {!isSearching && searchQuery.trim().length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-10 text-center">
          <div className="rounded-full bg-white p-3 text-neutral-400 shadow-sm">
            <Icon type="users" size="lg" />
          </div>
          <p className="mt-3 text-sm font-medium text-neutral-700">Start typing to search</p>
          <p className="mt-1 text-xs text-neutral-500">Try a name, a login, or an email domain.</p>
        </div>
      )}

      <UserSearchResults results={filtered} onSelectUser={onSelectUser} />
    </div>
  );
};

// ------------------------------------------------------------------ Hero (split-screen)

interface ComparisonHeroProps {
  contextUser: OktaUser;
  comparedUser: OktaUser;
  contextName: string;
  comparedName: string;
  similarity: number;
  isLoading: boolean;
}

const ComparisonHero: React.FC<ComparisonHeroProps> = ({
  contextUser,
  comparedUser,
  contextName,
  comparedName,
  similarity,
  isLoading,
}) => (
  <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-white via-white to-primary-light/40 shadow-sm">
    <div
      className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      aria-hidden
    />
    <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
      <UserSide user={contextUser} name={contextName} align="left" label="Context" />

      <div className="relative flex flex-col items-center justify-center px-2 py-3">
        <div
          className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-neutral-200"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col items-center gap-0.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-500">
            {isLoading ? '— —' : 'Match'}
          </span>
          <span
            className="font-mono text-base font-bold leading-none"
            style={{ color: similarityColor(similarity) }}
          >
            {isLoading ? '··' : `${similarity}%`}
          </span>
        </div>
      </div>

      <UserSide user={comparedUser} name={comparedName} align="right" label="Compared" />
    </div>
  </div>
);

const similarityColor = (pct: number): string => {
  if (pct >= 75) return 'var(--color-success-text)';
  if (pct >= 40) return 'var(--color-primary-text)';
  if (pct >= 15) return 'var(--color-warning-text)';
  return 'var(--color-neutral-700)';
};

const UserSide: React.FC<{
  user: OktaUser;
  name: string;
  align: 'left' | 'right';
  label: string;
}> = ({ user, name, align, label }) => {
  const hue = hueFromId(user.id);
  const initials = initialsOf(user);
  const isRight = align === 'right';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${isRight ? 'flex-row-reverse text-right' : 'text-left'}`}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white shadow-sm"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 65% 38%))`,
          fontFamily: 'var(--font-heading)',
        }}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
          {label}
        </div>
        <div className="truncate text-sm font-semibold text-neutral-900" title={name}>
          {name}
        </div>
        <div
          className="truncate text-[11px] text-neutral-500"
          title={user.profile.email || user.profile.login}
        >
          {user.profile.email || user.profile.login}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ Tabs

interface TabBarProps {
  activeTab: TabKey;
  onChange: (t: TabKey) => void;
  groupDiff: number;
  appDiff: number;
}

const TabBar: React.FC<TabBarProps> = ({ activeTab, onChange, groupDiff, appDiff }) => {
  const tabs: { key: TabKey; label: string; icon: 'chart' | 'users' | 'app'; badge?: number }[] = [
    { key: 'overview', label: 'Overview', icon: 'chart' },
    { key: 'groups', label: 'Groups', icon: 'users', badge: groupDiff },
    { key: 'apps', label: 'Apps', icon: 'app', badge: appDiff },
  ];

  return (
    <div
      role="tablist"
      className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-1"
    >
      {tabs.map((t) => {
        const active = activeTab === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-100 ${
              active
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <Icon type={t.icon} size="sm" />
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span
                className={`ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none ${
                  active ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------ Overview tab

interface OverviewTabProps {
  contextName: string;
  comparedName: string;
  groupBuckets: { onlyCompared: OktaGroup[]; shared: OktaGroup[]; onlyContext: OktaGroup[] };
  appBuckets: { onlyCompared: AppEntry[]; shared: AppEntry[]; onlyContext: AppEntry[] };
  groupSimilarity: number;
  appSimilarity: number;
  onJumpToGroups: () => void;
  onJumpToApps: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  contextName,
  comparedName,
  groupBuckets,
  appBuckets,
  groupSimilarity,
  appSimilarity,
  onJumpToGroups,
  onJumpToApps,
}) => (
  <div className="space-y-4">
    <OverviewCard
      icon="users"
      heading="Group memberships"
      similarity={groupSimilarity}
      contextName={contextName}
      comparedName={comparedName}
      onlyContext={groupBuckets.onlyContext.length}
      shared={groupBuckets.shared.length}
      onlyCompared={groupBuckets.onlyCompared.length}
      onJump={onJumpToGroups}
    />
    <OverviewCard
      icon="app"
      heading="App assignments"
      similarity={appSimilarity}
      contextName={contextName}
      comparedName={comparedName}
      onlyContext={appBuckets.onlyContext.length}
      shared={appBuckets.shared.length}
      onlyCompared={appBuckets.onlyCompared.length}
      onJump={onJumpToApps}
    />
  </div>
);

interface OverviewCardProps {
  icon: 'users' | 'app';
  heading: string;
  similarity: number;
  contextName: string;
  comparedName: string;
  onlyContext: number;
  shared: number;
  onlyCompared: number;
  onJump: () => void;
}

const OverviewCard: React.FC<OverviewCardProps> = ({
  icon,
  heading,
  similarity,
  contextName,
  comparedName,
  onlyContext,
  shared,
  onlyCompared,
  onJump,
}) => {
  const total = onlyContext + shared + onlyCompared;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-neutral-100 p-1.5 text-neutral-700">
            <Icon type={icon} size="sm" />
          </span>
          <h4 className="text-sm font-semibold text-neutral-900">{heading}</h4>
        </div>
        <button
          onClick={onJump}
          className="flex items-center gap-1 text-xs font-semibold text-primary-text hover:text-primary-dark"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          View details
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <ProportionStack onlyContext={onlyContext} shared={shared} onlyCompared={onlyCompared} />

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat value={onlyContext} label={`Only ${contextName}`} dotClass="bg-neutral-400" />
        <Stat value={shared} label="Shared" dotClass="bg-success" emphasis />
        <Stat value={onlyCompared} label={`Only ${comparedName}`} dotClass="bg-primary" />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs">
        <span className="text-neutral-500">
          {total} total · {similarity}% overlap
        </span>
        {onlyCompared > 0 && icon === 'users' && (
          <span className="flex items-center gap-1 font-semibold text-primary-text">
            <Icon type="plus" size="sm" />
            {onlyCompared} can be copied over
          </span>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{
  value: number;
  label: string;
  dotClass: string;
  emphasis?: boolean;
}> = ({ value, label, dotClass, emphasis }) => (
  <div className="rounded-md bg-neutral-50/70 px-2 py-2">
    <div
      className={`font-mono text-xl font-bold leading-none ${
        emphasis ? 'text-success-text' : 'text-neutral-900'
      }`}
    >
      {value}
    </div>
    <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] font-medium text-neutral-600">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <span className="truncate" title={label}>
        {label}
      </span>
    </div>
  </div>
);

const ProportionStack: React.FC<{
  onlyContext: number;
  shared: number;
  onlyCompared: number;
}> = ({ onlyContext, shared, onlyCompared }) => {
  const total = onlyContext + shared + onlyCompared;
  if (total === 0) {
    return <div className="mt-3 h-2 w-full rounded-full bg-neutral-100" aria-hidden />;
  }
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-neutral-100" aria-hidden>
      {onlyContext > 0 && (
        <div className="h-full bg-neutral-400" style={{ width: `${pct(onlyContext)}%` }} />
      )}
      {shared > 0 && <div className="h-full bg-success" style={{ width: `${pct(shared)}%` }} />}
      {onlyCompared > 0 && (
        <div className="h-full bg-primary" style={{ width: `${pct(onlyCompared)}%` }} />
      )}
    </div>
  );
};

// ------------------------------------------------------------------ Diff tab (Groups / Apps)

interface DiffItem {
  id: string;
  label: string;
}

interface DiffTabProps {
  contextName: string;
  comparedName: string;
  comparedItems: DiffItem[];
  sharedItems: DiffItem[];
  contextItems: DiffItem[];
  emptyComparedText: string;
  emptySharedText: string;
  emptyContextText: string;
  noun: string;
  renderAction?: (item: DiffItem) => React.ReactNode;
}

const DiffTab: React.FC<DiffTabProps> = ({
  contextName,
  comparedName,
  comparedItems,
  sharedItems,
  contextItems,
  emptyComparedText,
  emptySharedText,
  emptyContextText,
  noun,
  renderAction,
}) => (
  <div className="space-y-3">
    <BucketCard
      tone="add"
      title={`Only ${comparedName}`}
      subtitle={renderAction ? `Add ${noun}s to ${contextName}` : `Unique to ${comparedName}`}
      count={comparedItems.length}
      items={comparedItems}
      emptyText={emptyComparedText}
      renderAction={renderAction}
    />
    <BucketCard
      tone="shared"
      title="Shared"
      subtitle={`Common ${noun}s between both users`}
      count={sharedItems.length}
      items={sharedItems}
      emptyText={emptySharedText}
    />
    <BucketCard
      tone="neutral"
      title={`Only ${contextName}`}
      subtitle={`${noun.charAt(0).toUpperCase() + noun.slice(1)}s ${comparedName} doesn't have`}
      count={contextItems.length}
      items={contextItems}
      emptyText={emptyContextText}
    />
  </div>
);

type Tone = 'add' | 'shared' | 'neutral';

interface BucketCardProps {
  tone: Tone;
  title: string;
  subtitle: string;
  count: number;
  items: DiffItem[];
  emptyText: string;
  renderAction?: (item: DiffItem) => React.ReactNode;
}

const toneStyles: Record<
  Tone,
  {
    border: string;
    bar: string;
    iconBg: string;
    iconColor: string;
    badge: string;
    icon: 'plus' | 'check' | 'minus';
  }
> = {
  add: {
    border: 'border-primary-highlight',
    bar: 'bg-primary',
    iconBg: 'bg-primary-light',
    iconColor: 'text-primary-text',
    badge: 'bg-primary text-white',
    icon: 'plus',
  },
  shared: {
    border: 'border-success-light',
    bar: 'bg-success',
    iconBg: 'bg-success-light',
    iconColor: 'text-success-text',
    badge: 'bg-success text-white',
    icon: 'check',
  },
  neutral: {
    border: 'border-neutral-200',
    bar: 'bg-neutral-400',
    iconBg: 'bg-neutral-100',
    iconColor: 'text-neutral-600',
    badge: 'bg-neutral-200 text-neutral-700',
    icon: 'minus',
  },
};

const BucketCard: React.FC<BucketCardProps> = ({
  tone,
  title,
  subtitle,
  count,
  items,
  emptyText,
  renderAction,
}) => {
  const s = toneStyles[tone];
  return (
    <div className={`overflow-hidden rounded-lg border ${s.border} bg-white`}>
      <div className="flex items-stretch">
        <div className={`w-1 ${s.bar}`} aria-hidden />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${s.iconBg} ${s.iconColor}`}
              >
                <Icon type={s.icon} size="sm" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-neutral-900" title={title}>
                  {title}
                </div>
                <div className="truncate text-[11px] text-neutral-500" title={subtitle}>
                  {subtitle}
                </div>
              </div>
            </div>
            <span
              className={`inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${s.badge}`}
            >
              {count}
            </span>
          </div>
          {items.length === 0 ? (
            <div className="border-t border-neutral-100 px-4 py-3 text-xs italic text-neutral-400">
              {emptyText}
            </div>
          ) : (
            <ul className="scrollable-list max-h-44 divide-y divide-neutral-100 overflow-y-auto border-t border-neutral-100">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-neutral-50/70"
                >
                  <span className="truncate text-sm text-neutral-800" title={item.label}>
                    {item.label}
                  </span>
                  {renderAction?.(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserComparisonModal;
