import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GroupBanner from './components/GroupBanner';
import TabNavigation from './components/TabNavigation';
import DashboardTab from './components/DashboardTab';
import OperationsTab from './components/OperationsTab';
import RulesTab from './components/RulesTab';
import UsersTab from './components/UsersTab';
import UndoPanel from './components/UndoPanel';
import LoadingBar from './components/LoadingBar';
import { useGroupContext } from './hooks/useGroupContext';

type TabType = 'dashboard' | 'operations' | 'rules' | 'users' | 'undo';

const SELECTED_TAB_KEY = 'okta_unbound_selected_tab';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
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

  useEffect(() => {
    console.log('[App] Component mounted');
  }, []);

  useEffect(() => {
    console.log('[App] Group context updated:', { groupInfo, connectionStatus, error });
  }, [groupInfo, connectionStatus, error]);

  return (
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
        />
      )}
      {activeTab === 'users' && (
        <UsersTab
          targetTabId={targetTabId}
          currentGroupId={groupInfo?.groupId}
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
    </div>
  );
};

export default App;
