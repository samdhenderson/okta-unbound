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
import { ExportTab, type ExportRequest } from './components/export';
import AuditLogViewer from './components/AuditLogViewer';
import ActivityBar from './components/ActivityBar';
import { useGroupContext } from './hooks/useGroupContext';
import { useOktaPageContext } from './hooks/useOktaPageContext';
import { SchedulerProvider } from './contexts/SchedulerContext';
import { deriveTabContext, type PinnedContext } from './pinContext';

/** Storage key under which the last-active tab is persisted in `chrome.storage.local`. */
const SELECTED_TAB_KEY = 'okta_unbound_selected_tab';
/** Storage key under which the pinned context snapshot is persisted. */
const PINNED_CONTEXT_KEY = 'okta_unbound_pinned_context';

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
  // A one-shot request to open the Export tab pre-scoped (e.g. from the group
  // Overview's "Export Members"); cleared by the tab once consumed.
  const [exportRequest, setExportRequest] = useState<ExportRequest | null>(null);
  // A one-shot request to scope the Rules tab to a group on arrival (from the
  // group Overview's "View Rules"); cleared by the tab once consumed.
  const [scopeRulesToGroupId, setScopeRulesToGroupId] = useState<string | null>(null);
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

  // The context the feature tabs operate on. When pinned it follows the frozen
  // snapshot (so "View Rules"/exports target the pinned entity, not whatever the
  // live tab drifted to); otherwise it follows the live always-on tab context.
  const tabContext = deriveTabContext(pinned, { targetTabId, groupInfo, oktaOrigin });

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

  // Reconnect: reload the Okta tab so a fresh content script is injected, then
  // re-detect. Used when the connection is genuinely down (e.g. the script was
  // orphaned by an extension reload). Needs no extra permission — reloading a
  // host we already have permission for is allowed. The onUpdated('complete')
  // listeners re-probe once the page reloads; refetch nudges it along.
  const handleReconnect = () => {
    if (targetTabId != null) {
      chrome.tabs.reload(targetTabId, {}, () => {
        void chrome.runtime.lastError; // tab may be gone; ignore
        page.refetch();
      });
    } else {
      page.refetch();
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

  // Open the Export tab pre-scoped to a descriptor + context entity (deep-linked
  // from an Overview action).
  const handleNavigateToExport = (request: ExportRequest) => {
    setExportRequest(request);
    setActiveTab('export');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'export' });
  };

  const handleExportGroup = (groupId: string, groupName: string) =>
    handleNavigateToExport({
      descriptorId: 'group-memberships',
      contextId: groupId,
      contextLabel: groupName,
    });

  const handleExportApp = (descriptorId: string, appId: string, appName: string) =>
    handleNavigateToExport({ descriptorId, contextId: appId, contextLabel: appName });

  // "View Rules" from a group Overview: open the Rules tab scoped to that group.
  const handleViewGroupRules = (groupId: string) => {
    setScopeRulesToGroupId(groupId);
    setActiveTab('rules');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'rules' });
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
          onReconnect={handleReconnect}
        />

        <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

        {activeTab === 'overview' && (
          <OverviewTab
            onTabChange={handleTabChange}
            pageType={effective.pageType}
            groupInfo={effective.groupInfo}
            userInfo={effective.userInfo}
            appInfo={page.appInfo ?? null}
            connectionStatus={effective.connectionStatus}
            targetTabId={effective.targetTabId}
            error={effective.error}
            isLoading={effective.isLoading}
            oktaOrigin={effective.oktaOrigin}
            onRetry={page.refetch}
            onViewAllGroups={() => {
              if (effective.userInfo) handleNavigateToUser(effective.userInfo.userId);
            }}
            onExportGroup={handleExportGroup}
            onExportApp={handleExportApp}
            onViewGroupRules={handleViewGroupRules}
          />
        )}
        {activeTab === 'rules' && (
          <RulesTab
            targetTabId={tabContext.targetTabId ?? undefined}
            currentGroupId={tabContext.currentGroupId}
            oktaOrigin={tabContext.oktaOrigin ?? undefined}
            selectedRuleId={selectedRuleId}
            onRuleSelected={() => setSelectedRuleId(null)}
            onNavigateToGroup={handleNavigateToGroup}
            scopeToGroupId={scopeRulesToGroupId}
            onScopeConsumed={() => setScopeRulesToGroupId(null)}
          />
        )}
        {activeTab === 'users' && (
          <UsersTab
            targetTabId={tabContext.targetTabId ?? undefined}
            currentGroupId={tabContext.currentGroupId}
            onNavigateToRule={handleNavigateToRule}
            selectedUserId={selectedUserId}
            onUserSelected={() => setSelectedUserId(null)}
          />
        )}
        {activeTab === 'groups' && (
          <GroupsTab
            targetTabId={tabContext.targetTabId ?? null}
            oktaOrigin={tabContext.oktaOrigin ?? undefined}
            onNavigateToRule={handleNavigateToRule}
            selectedGroupId={selectedGroupId}
            onGroupSelected={() => setSelectedGroupId(null)}
          />
        )}
        {activeTab === 'export' && (
          <ExportTab
            targetTabId={tabContext.targetTabId ?? undefined}
            oktaOrigin={tabContext.oktaOrigin ?? undefined}
            exportRequest={exportRequest}
            onExportRequestConsumed={() => setExportRequest(null)}
          />
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
