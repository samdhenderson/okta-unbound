import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GroupBanner from './components/GroupBanner';
import TabNavigation from './components/TabNavigation';
import OperationsTab from './components/OperationsTab';
import RulesTab from './components/RulesTab';
import { useGroupContext } from './hooks/useGroupContext';

type TabType = 'operations' | 'rules';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('operations');
  const { groupInfo, connectionStatus, targetTabId, error, isLoading } = useGroupContext();

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

      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'operations' && (
        <OperationsTab
          groupId={groupInfo?.groupId}
          groupName={groupInfo?.groupName}
          targetTabId={targetTabId}
        />
      )}
      {activeTab === 'rules' && <RulesTab />}
    </div>
  );
};

export default App;
