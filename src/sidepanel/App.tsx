/**
 * @module sidepanel/App
 * @description Root side-panel component: wires page context to the tabbed UI shell.
 *
 * Owns the active-tab selection (persisted to `chrome.storage.local` with legacy-tab
 * migration) and the highlighted rule id. Reads live Okta page context via
 * `useGroupContext`/`useOktaPageContext` and renders the {@link ContextBar} masthead
 * (app wordmark + entity identity + connection), {@link TabNavigation}, the per-tab
 * content, the fixed {@link ActivityBar} (the unified scheduler + progress bar), and
 * the ⌘K {@link TabJumpPalette}, all inside the SchedulerProvider.
 *
 * The shell is also the **single owner of app-wide keyboard shortcuts**
 * ({@link useCommandPalette}) — see the tab-lifetime note below for why a `window`
 * listener may not live in a tab.
 *
 * ## Tab lifetime
 *
 * A tab **mounts on its first activation and stays mounted from then on**; the
 * inactive ones are hidden with the shared `.tab-content` rule rather than
 * unmounted. Unmounting used to destroy everything component-local — the Groups
 * tab's pushed detail view, its filters, selection, loaded window, scroll offset
 * and per-row expansion — so leaving a tab and coming back lost the user's place.
 * `React.lazy` is unaffected: a never-visited tab still costs no chunk.
 *
 * Eight live tabs mean eight sets of live effects, so **every tab is told whether
 * it is active** and gates its own background work on it (auto-loads, page-context
 * re-probes, debounced search, window listeners). No hidden tab may issue Okta API
 * traffic. `useOktaPageContext(activeTab === 'overview' && !isPinned)` below is the
 * original instance of that pattern.
 */
import React, { useState, useEffect, useCallback, useRef, lazy } from 'react';
import ContextBar from './components/ContextBar';
import PageHeader from './components/shared/PageHeader';
import TabNavigation from './components/TabNavigation';
import TabPanel from './components/TabPanel';
import TabJumpPalette from './components/TabJumpPalette';
import { useCommandPalette } from './hooks/useCommandPalette';
import { migrateLegacyTabId, type TabType } from './tabs';
import OverviewTab from './components/OverviewTab';
import type { ExportRequest } from './components/export';
import ActivityBar from './components/ActivityBar';

// Code-split the non-default tabs so the initial side-panel load only ships the
// Overview (the default tab). Each import lands in its own chunk, fetched on
// first activation of that tab; that tab's own Suspense boundary (inside
// `TabPanel`) shows the standard spinner during the one-time fetch, without
// disturbing the tabs already mounted beside it. ExportTab is a named export from
// its barrel, so it is re-shaped into a default export for React.lazy.
const RulesTab = lazy(() => import('./components/RulesTab'));
const UsersTab = lazy(() => import('./components/UsersTab'));
const GroupsTab = lazy(() => import('./components/GroupsTab'));
const AppsTab = lazy(() => import('./components/AppsTab'));
const AuthPoliciesTab = lazy(() => import('./components/AuthPoliciesTab'));
const ExportTab = lazy(() => import('./components/export').then((m) => ({ default: m.ExportTab })));
const AuditLogViewer = lazy(() => import('./components/AuditLogViewer'));
import { useGroupContext } from './hooks/useGroupContext';
import { useOktaPageContext } from './hooks/useOktaPageContext';
import { SchedulerProvider } from './contexts/SchedulerContext';
import { deriveTabContext, revalidatePinnedContext, type PinnedContext } from './pinContext';

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
  // Tabs that have been activated at least once, and are therefore mounted. Kept
  // as state (not a ref) so first activation triggers the render that mounts the
  // tab; every path that sets `activeTab` funnels through the effect below, so
  // deep links and the persisted-tab restore mount their target too.
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<TabType>>(
    () => new Set<TabType>(['overview']),
  );
  useEffect(() => {
    setMountedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

  // The one element that actually scrolls (see the JSX below). Handed to every
  // `TabPanel` so each can bank and restore its own offset on it.
  const scrollRootRef = useRef<HTMLDivElement>(null);

  // The ⌘K jump-to palette. The shortcut listener lives here, in the shell, and
  // nowhere else: every tab is mounted at once (ADR-0018), so the same `window`
  // listener registered inside a tab would be registered up to eight times and
  // fire once per mounted tab.
  const jumpPalette = useCommandPalette();

  // Always-on tab targeting + connection health (used by every tab and the header).
  const {
    groupInfo,
    connectionStatus,
    targetTabId,
    error,
    isLoading,
    oktaOrigin,
    refetch: refetchGroupContext,
  } = useGroupContext();
  // Single live page detector feeding the ContextBar + Overview. It re-probes only
  // while Overview is active AND not pinned; otherwise it holds the last-known
  // context (and records that a resync is owed, surfaced as `resyncPending`).
  const page = useOktaPageContext(activeTab === 'overview' && !isPinned);

  // Restore a persisted pin on mount. The snapshot's `targetTabId` is a per-session
  // Chrome id, so it is revalidated before use: it may be re-targeted at a live Okta
  // tab, or the pin dropped entirely when the browser has no Okta tab open.
  useEffect(() => {
    chrome.storage.local.get([PINNED_CONTEXT_KEY], (result) => {
      const saved = result[PINNED_CONTEXT_KEY] as PinnedContext | undefined;
      if (!saved) return;
      void revalidatePinnedContext(saved).then((revalidated) => {
        if (!revalidated) {
          chrome.storage.local.remove(PINNED_CONTEXT_KEY);
          return;
        }
        setPinned(revalidated);
        if (revalidated.targetTabId !== saved.targetTabId) {
          chrome.storage.local.set({ [PINNED_CONTEXT_KEY]: revalidated });
        }
      });
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
        // Identity stays frozen, but connection health must not: a pinned panel
        // reporting a permanent green "connected" hid genuinely dead sessions.
        // These come from the always-on `useGroupContext`, which keeps probing
        // while pinned.
        connectionStatus,
        error,
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
          : effective.pageType === 'policy'
            ? (page.policyInfo?.policyName ?? undefined)
            : undefined;
  const entityId =
    effective.pageType === 'group'
      ? (effective.groupInfo?.groupId ?? undefined)
      : effective.pageType === 'user'
        ? (effective.userInfo?.userId ?? undefined)
        : effective.pageType === 'app'
          ? (page.appInfo?.appId ?? undefined)
          : effective.pageType === 'policy'
            ? (page.policyInfo?.policyId ?? undefined)
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

  // Re-probe *both* context engines. The panel runs two independent
  // `useOktaTabContext` instances — the always-on `useGroupContext` (which drives
  // the ContextBar's connection dot and the feature tabs' target tab) and the
  // Overview-scoped `useOktaPageContext`. Every recovery affordance used to nudge
  // only the latter, so a latched `error` on the always-on engine had no manual
  // exit and the bar stayed "Disconnected" forever. Both promises are fired and
  // voided: the hooks own their own error handling and never reject.
  const refetchPageContext = page.refetch;
  const handleRefreshAll = useCallback(() => {
    void refetchGroupContext();
    void refetchPageContext();
  }, [refetchGroupContext, refetchPageContext]);

  // Reconnect: reload the Okta tab so a fresh content script is injected, then
  // re-detect. Used when the connection is genuinely down (e.g. the script was
  // orphaned by an extension reload). Needs no extra permission — reloading a
  // host we already have permission for is allowed. The onUpdated('complete')
  // listeners re-probe once the page reloads; refetch nudges it along.
  const handleReconnect = () => {
    if (targetTabId != null) {
      chrome.tabs.reload(targetTabId, {}, () => {
        void chrome.runtime.lastError; // tab may be gone; ignore
        handleRefreshAll();
      });
    } else {
      handleRefreshAll();
    }
  };

  // Load saved tab preference on mount with legacy migration
  useEffect(() => {
    chrome.storage.local.get([SELECTED_TAB_KEY], (result) => {
      if (result[SELECTED_TAB_KEY]) {
        const savedTab = result[SELECTED_TAB_KEY] as string;
        const migratedTab = migrateLegacyTabId(savedTab);

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

  /**
   * Render one tab panel: nothing until the tab has been activated once, then a
   * permanently mounted {@link TabPanel} — visibility, its own Suspense boundary,
   * and its own slice of the shared root scroller's offset all live in there.
   *
   * @param tab - The tab this panel hosts.
   * @param content - Builds the tab's element, given whether it is currently active.
   */
  const renderTabPanel = (tab: TabType, content: (isActive: boolean) => React.ReactNode) => {
    if (!mountedTabs.has(tab)) return null;
    const isActive = tab === activeTab;
    return (
      <TabPanel isActive={isActive} scrollRef={scrollRootRef}>
        {content(isActive)}
      </TabPanel>
    );
  };

  return (
    <SchedulerProvider>
      {/* `h-screen` + `overflow-y-auto` make *this* div the scroller, not the
          document — every root-scrolling tab shares it, which is why each
          `TabPanel` needs the ref to preserve its own offset across a tab switch. */}
      <div
        ref={scrollRootRef}
        data-testid="app-scroll-root"
        className="flex flex-col h-screen overflow-y-auto pb-14 bg-canvas"
      >
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
          onRefresh={handleRefreshAll}
          onReconnect={handleReconnect}
        />

        <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Each tab mounts on first activation and is hidden — never unmounted —
            thereafter, so its local state survives leaving the tab. */}
        {renderTabPanel('overview', () => (
          <OverviewTab
            onTabChange={handleTabChange}
            pageType={effective.pageType}
            groupInfo={effective.groupInfo}
            userInfo={effective.userInfo}
            appInfo={page.appInfo ?? null}
            policyInfo={page.policyInfo ?? null}
            connectionStatus={effective.connectionStatus}
            targetTabId={effective.targetTabId}
            error={effective.error}
            isLoading={effective.isLoading}
            oktaOrigin={effective.oktaOrigin}
            onRetry={handleRefreshAll}
            onViewAllGroups={() => {
              if (effective.userInfo) handleNavigateToUser(effective.userInfo.userId);
            }}
            onExportGroup={handleExportGroup}
            onExportApp={handleExportApp}
            onViewGroupRules={handleViewGroupRules}
          />
        ))}
        {renderTabPanel('rules', (isActive) => (
          <RulesTab
            isActive={isActive}
            targetTabId={tabContext.targetTabId ?? undefined}
            currentGroupId={tabContext.currentGroupId}
            oktaOrigin={tabContext.oktaOrigin ?? undefined}
            selectedRuleId={selectedRuleId}
            onRuleSelected={() => setSelectedRuleId(null)}
            onNavigateToGroup={handleNavigateToGroup}
            scopeToGroupId={scopeRulesToGroupId}
            onScopeConsumed={() => setScopeRulesToGroupId(null)}
          />
        ))}
        {renderTabPanel('users', (isActive) => (
          <UsersTab
            isActive={isActive}
            targetTabId={tabContext.targetTabId ?? undefined}
            currentGroupId={tabContext.currentGroupId}
            onNavigateToRule={handleNavigateToRule}
            selectedUserId={selectedUserId}
            onUserSelected={() => setSelectedUserId(null)}
          />
        ))}
        {renderTabPanel('groups', (isActive) => (
          <GroupsTab
            isActive={isActive}
            targetTabId={tabContext.targetTabId ?? null}
            oktaOrigin={tabContext.oktaOrigin ?? undefined}
            onNavigateToRule={handleNavigateToRule}
            selectedGroupId={selectedGroupId}
            onGroupSelected={() => setSelectedGroupId(null)}
          />
        ))}
        {renderTabPanel('apps', (isActive) => (
          <AppsTab
            isActive={isActive}
            targetTabId={tabContext.targetTabId ?? null}
            oktaOrigin={tabContext.oktaOrigin ?? undefined}
          />
        ))}
        {renderTabPanel('policies', (isActive) => (
          <AuthPoliciesTab
            isActive={isActive}
            targetTabId={tabContext.targetTabId ?? undefined}
            oktaOrigin={tabContext.oktaOrigin ?? undefined}
          />
        ))}
        {renderTabPanel('export', (isActive) => (
          <ExportTab
            isActive={isActive}
            targetTabId={tabContext.targetTabId ?? undefined}
            oktaOrigin={tabContext.oktaOrigin ?? undefined}
            exportRequest={exportRequest}
            onExportRequestConsumed={() => setExportRequest(null)}
          />
        ))}
        {renderTabPanel('history', () => (
          <div
            className="tab-content active"
            style={{ fontFamily: 'var(--font-primary)', padding: 0 }}
          >
            <PageHeader title="Audit Log" subtitle="View history of actions performed" />
            <div className="max-w-7xl mx-auto px-6 py-6">
              <AuditLogViewer />
            </div>
          </div>
        ))}

        <ActivityBar />
      </div>

      {/* Rendered outside the scroll root: it is a viewport-fixed overlay, not
          part of any tab's scrollable content. Selecting a result goes through
          the same `handleTabChange` the icon rail calls. */}
      <TabJumpPalette
        isOpen={jumpPalette.isOpen}
        onClose={jumpPalette.close}
        activeTab={activeTab}
        onSelect={handleTabChange}
      />
    </SchedulerProvider>
  );
};

export default App;
