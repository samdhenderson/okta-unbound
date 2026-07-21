/**
 * @module sidepanel/App
 * @description Root side-panel component: wires page context to the tabbed UI shell.
 *
 * Owns the active-tab selection (persisted to `chrome.storage.local` with legacy-tab
 * migration) and the highlighted rule id. Reads live Okta page context via
 * `useGroupContext`/`useOktaPageContext` and renders the {@link ContextBar} masthead
 * (app wordmark + entity identity + connection), {@link TabNavigation}, the per-tab
 * content, and the fixed {@link ActivityBar} (the unified scheduler + progress bar),
 * all inside the SchedulerProvider.
 */
import React, { useState, useEffect } from 'react';
import ContextBar from './components/ContextBar';
import PageHeader from './components/shared/PageHeader';
import TabNavigation, { type TabType } from './components/TabNavigation';
import OverviewTab from './components/OverviewTab';
import RulesTab from './components/RulesTab';
import UsersTab from './components/UsersTab';
import GroupsTab from './components/GroupsTab';
import { ExportTab } from './components/export';
import AuditLogViewer from './components/AuditLogViewer';
import ActivityBar from './components/ActivityBar';
import { useGroupContext } from './hooks/useGroupContext';
import { useOktaPageContext } from './hooks/useOktaPageContext';
import { SchedulerProvider } from './contexts/SchedulerContext';
import type { GroupInfo, UserInfo } from '../shared/types';

/** Storage key under which the last-active tab is persisted in `chrome.storage.local`. */
const SELECTED_TAB_KEY = 'okta_unbound_selected_tab';
/** Storage key under which the pinned context snapshot is persisted. */
const PINNED_CONTEXT_KEY = 'okta_unbound_pinned_context';

/**
 * A frozen snapshot of the Overview context. When present the panel holds this
 * entity (ignoring live tab navigation) so the user can cross-reference another
 * Okta page without losing their place; unpinning resumes live detection.
 */
interface PinnedContext {
  pageType: 'group' | 'user';
  groupInfo: GroupInfo | null;
  userInfo: UserInfo | null;
  targetTabId: number;
  oktaOrigin: string | null;
}

/**
 * Root application shell for the Okta Unbound side panel.
 *
 * Restores the saved tab on mount (migrating retired tab ids such as
 * `dashboard`/`operations`/`undo` to their current equivalents), routes tab
 * changes, and supports cross-tab navigation to a specific rule via
 * `handleNavigateToRule`.
 */
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  // A one-shot request to open a specific user in the Users tab (e.g. from the
  // Overview's "View all groups"); cleared by the tab once consumed.
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // The pinned snapshot (null = following the live tab). Persisted across reopen.
  const [pinned, setPinned] = useState<PinnedContext | null>(null);
  const isPinned = pinned !== null;

  // Always-on tab targeting + connection health (used by every tab and the header).
  const { groupInfo, connectionStatus, targetTabId, error, isLoading, oktaOrigin } =
    useGroupContext();
  // Single live page detector feeding the ContextBar + Overview. It re-probes only
  // while Overview is active AND not pinned; otherwise it holds the last-known
  // context (and records that a resync is owed, surfaced as `resyncPending`).
  const page = useOktaPageContext(activeTab === 'overview' && !isPinned);

  // Restore a persisted pin on mount.
  useEffect(() => {
    chrome.storage.local.get([PINNED_CONTEXT_KEY], (result) => {
      const saved = result[PINNED_CONTEXT_KEY] as PinnedContext | undefined;
      if (saved) setPinned(saved);
    });
  }, []);

  // The identity shown in the bar + Overview: the pinned snapshot, or live detection.
  const isLivePinnable = page.pageType === 'group' || page.pageType === 'user';
  const effective = pinned
    ? {
        pageType: pinned.pageType,
        groupInfo: pinned.groupInfo,
        userInfo: pinned.userInfo,
        targetTabId: pinned.targetTabId as number | null,
        oktaOrigin: pinned.oktaOrigin,
        connectionStatus: 'connected' as const,
        error: null as string | null,
        isLoading: false,
      }
    : {
        pageType: page.pageType,
        groupInfo: page.groupInfo,
        userInfo: page.userInfo,
        targetTabId: page.targetTabId,
        oktaOrigin: page.oktaOrigin,
        connectionStatus: page.connectionStatus,
        error: page.error,
        isLoading: page.isLoading,
      };

  const entityName =
    effective.pageType === 'group'
      ? (effective.groupInfo?.groupName ?? undefined)
      : effective.pageType === 'user'
        ? (effective.userInfo?.userName ?? undefined)
        : effective.pageType === 'app'
          ? (page.appInfo?.appName ?? undefined)
          : undefined;
  const entityId =
    effective.pageType === 'group'
      ? (effective.groupInfo?.groupId ?? undefined)
      : effective.pageType === 'user'
        ? (effective.userInfo?.userId ?? undefined)
        : effective.pageType === 'app'
          ? (page.appInfo?.appId ?? undefined)
          : undefined;

  const handleTogglePin = () => {
    if (pinned) {
      setPinned(null);
      chrome.storage.local.remove(PINNED_CONTEXT_KEY);
      return;
    }
    if (isLivePinnable && page.targetTabId != null) {
      const snapshot: PinnedContext = {
        pageType: page.pageType as 'group' | 'user',
        groupInfo: page.groupInfo,
        userInfo: page.userInfo,
        targetTabId: page.targetTabId,
        oktaOrigin: page.oktaOrigin,
      };
      setPinned(snapshot);
      chrome.storage.local.set({ [PINNED_CONTEXT_KEY]: snapshot });
    }
  };

  // Load saved tab preference on mount with legacy migration
  useEffect(() => {
    chrome.storage.local.get([SELECTED_TAB_KEY], (result) => {
      if (result[SELECTED_TAB_KEY]) {
        const savedTab = result[SELECTED_TAB_KEY] as string;
        let migratedTab: TabType;

        switch (savedTab) {
          case 'dashboard':
          case 'operations':
            migratedTab = 'overview';
            break;
          case 'undo':
            migratedTab = 'history';
            break;
          case 'security':
          case 'apps':
            migratedTab = 'overview';
            break;
          default:
            migratedTab = savedTab as TabType;
        }

        setActiveTab(migratedTab);
        if (migratedTab !== savedTab) {
          chrome.storage.local.set({ [SELECTED_TAB_KEY]: migratedTab });
        }
      }
    });
  }, []);

  const handleTabChange = (tab: TabType, selectedRuleId?: string) => {
    setActiveTab(tab);
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: tab });

    if (tab === 'rules' && selectedRuleId) {
      setSelectedRuleId(selectedRuleId);
    }
  };

  const handleNavigateToRule = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    setActiveTab('rules');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'rules' });
  };

  const handleNavigateToGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setActiveTab('groups');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'groups' });
  };

  const handleNavigateToUser = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('users');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'users' });
  };

  return (
    <SchedulerProvider>
      <div className="flex flex-col h-screen overflow-y-auto pb-14 bg-canvas">
        <ContextBar
          pageType={effective.pageType}
          entityName={entityName}
          entityId={entityId}
          connectionStatus={connectionStatus}
          isLoading={isLoading}
          error={error}
          isPinned={isPinned}
          canPin={isLivePinnable}
          liveContextChanged={isPinned && page.resyncPending}
          onTogglePin={handleTogglePin}
          onRefresh={page.refetch}
        />

        <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

        {activeTab === 'overview' && (
          <OverviewTab
            onTabChange={handleTabChange}
            pageType={effective.pageType}
            groupInfo={effective.groupInfo}
            userInfo={effective.userInfo}
            connectionStatus={effective.connectionStatus}
            targetTabId={effective.targetTabId}
            error={effective.error}
            isLoading={effective.isLoading}
            oktaOrigin={effective.oktaOrigin}
            onRetry={page.refetch}
            onViewAllGroups={() => {
              if (effective.userInfo) handleNavigateToUser(effective.userInfo.userId);
            }}
          />
        )}
        {activeTab === 'rules' && (
          <RulesTab
            targetTabId={targetTabId ?? undefined}
            currentGroupId={groupInfo?.groupId}
            oktaOrigin={oktaOrigin ?? undefined}
            selectedRuleId={selectedRuleId}
            onRuleSelected={() => setSelectedRuleId(null)}
            onNavigateToGroup={handleNavigateToGroup}
          />
        )}
        {activeTab === 'users' && (
          <UsersTab
            targetTabId={targetTabId ?? undefined}
            currentGroupId={groupInfo?.groupId}
            onNavigateToRule={handleNavigateToRule}
            selectedUserId={selectedUserId}
            onUserSelected={() => setSelectedUserId(null)}
          />
        )}
        {activeTab === 'groups' && (
          <GroupsTab
            targetTabId={targetTabId ?? null}
            oktaOrigin={oktaOrigin ?? undefined}
            onNavigateToRule={handleNavigateToRule}
            selectedGroupId={selectedGroupId}
            onGroupSelected={() => setSelectedGroupId(null)}
          />
        )}
        {activeTab === 'export' && (
          <ExportTab targetTabId={targetTabId ?? undefined} oktaOrigin={oktaOrigin ?? undefined} />
        )}
        {activeTab === 'history' && (
          <div
            className="tab-content active"
            style={{ fontFamily: 'var(--font-primary)', padding: 0 }}
          >
            <PageHeader title="Audit Log" subtitle="View history of actions performed" />
            <div className="max-w-7xl mx-auto px-6 py-6">
              <AuditLogViewer />
            </div>
          </div>
        )}

        <ActivityBar />
      </div>
    </SchedulerProvider>
  );
};

export default App;
