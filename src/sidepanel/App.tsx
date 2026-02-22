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

  return (
    <SchedulerProvider>
      <div className="flex flex-col h-screen overflow-y-auto pb-14">
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
        {activeTab === 'groups' && (
          <GroupsTab
            targetTabId={targetTabId ?? null}
            oktaOrigin={oktaOrigin ?? undefined}
          />
        )}
        {activeTab === 'history' && (
          <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
            <PageHeader
              title="Audit Log"
              subtitle="View history of actions performed"
            />
            <div className="max-w-7xl mx-auto px-6 py-6">
              <AuditLogViewer />
            </div>
          </div>
        )}

        <LoadingBar />
        <SchedulerStatusBar />
      </div>
    </SchedulerProvider>
  );
};

export default App;
