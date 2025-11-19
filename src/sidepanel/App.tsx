import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GroupBanner from './components/GroupBanner';
import TabNavigation from './components/TabNavigation';
import DashboardTab from './components/DashboardTab';
import OperationsTab from './components/OperationsTab';
import RulesTab from './components/RulesTab';
import UsersTab from './components/UsersTab';
import SecurityTab from './components/SecurityTab';
import GroupsTab from './components/GroupsTab';
import UndoPanel from './components/UndoPanel';
import LoadingBar from './components/LoadingBar';
import SchedulerStatusBar from './components/SchedulerStatusBar';
import { useGroupContext } from './hooks/useGroupContext';
import { SchedulerProvider } from './contexts/SchedulerContext';

type TabType = 'dashboard' | 'operations' | 'rules' | 'users' | 'security' | 'groups' | 'undo';

const SELECTED_TAB_KEY = 'okta_unbound_selected_tab';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const { groupInfo, connectionStatus, targetTabId, error, isLoading, oktaOrigin } = useGroupContext();

  // Load saved tab preference on mount
  useEffect(() => {
    chrome.storage.local.get([SELECTED_TAB_KEY], (result) => {
      if (result[SELECTED_TAB_KEY]) {
        setActiveTab(result[SELECTED_TAB_KEY] as TabType);
      }
    });
  }, []);

  // Save tab preference when it changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: tab });
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
      <div className="sidebar-container">
        <Header status={connectionStatus} />

      <GroupBanner
        groupName={groupInfo?.groupName || 'Loading...'}
        groupId={groupInfo?.groupId || ''}
        isLoading={isLoading}
        error={error}
      />

      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === 'dashboard' && (
        <DashboardTab
          groupId={groupInfo?.groupId}
          groupName={groupInfo?.groupName}
          targetTabId={targetTabId}
          onTabChange={handleTabChange}
          oktaOrigin={oktaOrigin}
        />
      )}
      {activeTab === 'operations' && (
        <OperationsTab
          groupId={groupInfo?.groupId}
          groupName={groupInfo?.groupName}
          targetTabId={targetTabId}
        />
      )}
      {activeTab === 'rules' && (
        <RulesTab
          targetTabId={targetTabId}
          currentGroupId={groupInfo?.groupId}
          oktaOrigin={oktaOrigin}
          selectedRuleId={selectedRuleId}
          onRuleSelected={() => setSelectedRuleId(null)}
        />
      )}
      {activeTab === 'users' && (
        <UsersTab
          targetTabId={targetTabId}
          currentGroupId={groupInfo?.groupId}
          onNavigateToRule={handleNavigateToRule}
        />
      )}
      {activeTab === 'security' && (
        <SecurityTab
          groupId={groupInfo?.groupId}
          groupName={groupInfo?.groupName}
          targetTabId={targetTabId}
        />
      )}
      {activeTab === 'groups' && (
        <GroupsTab
          targetTabId={targetTabId}
          oktaOrigin={oktaOrigin}
        />
      )}
      {activeTab === 'undo' && (
        <div className="tab-content active">
          <div className="section">
            <div className="section-header">
              <div>
                <h2>Undo History</h2>
                <p className="section-description">
                  Reverse recent actions (up to 10)
                </p>
              </div>
            </div>
            <UndoPanel targetTabId={targetTabId} />
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
