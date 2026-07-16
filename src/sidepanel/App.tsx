/**
 * @module sidepanel/App
 * @description Root side-panel component: wires page context to the tabbed UI shell.
 *
 * Owns the active-tab selection (persisted to `chrome.storage.local` with legacy-tab
 * migration) and the highlighted rule id. Reads live Okta page context via
 * `useGroupContext`/`useOktaPageContext` and renders the {@link Header},
 * {@link ContextBanner}, {@link TabNavigation}, the per-tab content, and the fixed
 * {@link ActivityBar} (the unified scheduler + progress bar), all inside the
 * SchedulerProvider.
 */
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ContextBanner from './components/ContextBanner';
import PageHeader from './components/shared/PageHeader';
import TabNavigation, { type TabType } from './components/TabNavigation';
import OverviewTab from './components/OverviewTab';
import RulesTab from './components/RulesTab';
import UsersTab from './components/UsersTab';
import GroupsTab from './components/GroupsTab';
import AuditLogViewer from './components/AuditLogViewer';
import ActivityBar from './components/ActivityBar';
import { useGroupContext } from './hooks/useGroupContext';
import { useOktaPageContext } from './hooks/useOktaPageContext';
import { SchedulerProvider } from './contexts/SchedulerContext';

/** Storage key under which the last-active tab is persisted in `chrome.storage.local`. */
const SELECTED_TAB_KEY = 'okta_unbound_selected_tab';

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
  const { groupInfo, connectionStatus, targetTabId, error, isLoading, oktaOrigin } =
    useGroupContext();
  // Live page detection (which feeds the Overview tab + context banner) re-probes
  // only while Overview is the active tab; on other tabs it holds the last-known
  // context and resyncs on return, so admin navigation doesn't drive it. Tab
  // targeting (targetTabId/origin) stays available everywhere via useGroupContext.
  const { pageType, userInfo, appInfo } = useOktaPageContext(activeTab === 'overview');

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

  return (
    <SchedulerProvider>
      <div className="flex flex-col h-screen overflow-y-auto pb-14 bg-canvas">
        <Header status={connectionStatus} />

        <ContextBanner
          pageType={pageType}
          entityName={
            pageType === 'group'
              ? groupInfo?.groupName
              : pageType === 'user'
                ? userInfo?.userName
                : pageType === 'app'
                  ? appInfo?.appName
                  : undefined
          }
          entityId={
            pageType === 'group'
              ? groupInfo?.groupId
              : pageType === 'user'
                ? userInfo?.userId
                : pageType === 'app'
                  ? appInfo?.appId
                  : undefined
          }
          isLoading={isLoading}
          error={error}
        />

        <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

        {activeTab === 'overview' && <OverviewTab onTabChange={handleTabChange} />}
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
