import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ContextBanner from './components/ContextBanner';
import PageHeader from './components/shared/PageHeader';
import TabNavigation, { type TabType } from './components/TabNavigation';
import OverviewTab from './components/OverviewTab';
import RulesTab from './components/RulesTab';
import UsersTab from './components/UsersTab';
import SecurityTab from './components/SecurityTab';
import GroupsTab from './components/GroupsTab';
import AppsTab from './components/AppsTab';
import UndoPanel from './components/UndoPanel';
import LoadingBar from './components/LoadingBar';
import SchedulerStatusBar from './components/SchedulerStatusBar';
import { useGroupContext } from './hooks/useGroupContext';
import { useOktaPageContext } from './hooks/useOktaPageContext';
import { SchedulerProvider } from './contexts/SchedulerContext';

const SELECTED_TAB_KEY = 'okta_unbound_selected_tab';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const { groupInfo, connectionStatus, targetTabId, error, isLoading, oktaOrigin } = useGroupContext();
  const { pageType, userInfo, appInfo } = useOktaPageContext();

  // Load saved tab preference on mount with legacy migration
  useEffect(() => {
    chrome.storage.local.get([SELECTED_TAB_KEY], (result) => {
      if (result[SELECTED_TAB_KEY]) {
        // Migrate legacy tab names to new naming scheme
        const savedTab = result[SELECTED_TAB_KEY] as string;
        let migratedTab: TabType;

        switch (savedTab) {
          case 'dashboard':
          case 'operations':
            migratedTab = 'overview'; // Both dashboard and operations → overview
            break;
          case 'undo':
            migratedTab = 'history'; // undo → history
            break;
          default:
            migratedTab = savedTab as TabType;
        }

        setActiveTab(migratedTab);
        // Save migrated tab back to storage
        if (migratedTab !== savedTab) {
          chrome.storage.local.set({ [SELECTED_TAB_KEY]: migratedTab });
        }
      }
    });
  }, []);

  // Save tab preference when it changes
  const handleTabChange = (tab: TabType, selectedRuleId?: string) => {
    setActiveTab(tab);
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: tab });

    // If navigating to rules tab with a specific rule, set the selected rule
    if (tab === 'rules' && selectedRuleId) {
      setSelectedRuleId(selectedRuleId);
    }
  };

  // Navigate to a specific rule in the rules tab
  const handleNavigateToRule = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    setActiveTab('rules');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'rules' });
  };

  useEffect(() => {
    console.log('[App] Component mounted');
  }, []);

  useEffect(() => {
    console.log('[App] Group context updated:', { groupInfo, connectionStatus, error });
  }, [groupInfo, connectionStatus, error]);

  return (
    <SchedulerProvider>
      <div className="sidebar-container pb-14">
        <Header status={connectionStatus} />

      <ContextBanner
        pageType={pageType}
        entityName={
          pageType === 'group' ? groupInfo?.groupName :
          pageType === 'user' ? userInfo?.userName :
          pageType === 'app' ? appInfo?.appName :
          undefined
        }
        entityId={
          pageType === 'group' ? groupInfo?.groupId :
          pageType === 'user' ? userInfo?.userId :
          pageType === 'app' ? appInfo?.appId :
          undefined
        }
        isLoading={isLoading}
        error={error}
      />

      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === 'overview' && (
        <OverviewTab onTabChange={handleTabChange} />
      )}
      {activeTab === 'rules' && (
        <RulesTab
          targetTabId={targetTabId ?? undefined}
          currentGroupId={groupInfo?.groupId}
          oktaOrigin={oktaOrigin ?? undefined}
          selectedRuleId={selectedRuleId}
          onRuleSelected={() => setSelectedRuleId(null)}
        />
      )}
      {activeTab === 'users' && (
        <UsersTab
          targetTabId={targetTabId ?? undefined}
          currentGroupId={groupInfo?.groupId}
          onNavigateToRule={handleNavigateToRule}
        />
      )}
      {activeTab === 'security' && (
        <SecurityTab
          groupId={groupInfo?.groupId}
          groupName={groupInfo?.groupName}
          targetTabId={targetTabId ?? null}
        />
      )}
      {activeTab === 'groups' && (
        <GroupsTab
          targetTabId={targetTabId ?? null}
          oktaOrigin={oktaOrigin ?? undefined}
        />
      )}
      {activeTab === 'apps' && (
        <AppsTab
          groupId={groupInfo?.groupId}
          groupName={groupInfo?.groupName}
          targetTabId={targetTabId ?? null}
          oktaOrigin={oktaOrigin ?? undefined}
        />
      )}
      {activeTab === 'history' && (
        <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
          <PageHeader
            title="Operation History"
            subtitle="View audit trail and reverse recent actions"
            icon="list"
          />
          <div className="max-w-7xl mx-auto px-6 py-6">
            <UndoPanel targetTabId={targetTabId ?? undefined} />
          </div>
        </div>
      )}

      {/* Global Loading Bar - appears at bottom of all pages */}
      <LoadingBar />

        {/* Global Scheduler Status Bar */}
        <SchedulerStatusBar />
      </div>
    </SchedulerProvider>
  );
};

export default App;
