import React from 'react';

type TabType = 'dashboard' | 'operations' | 'rules' | 'users' | 'undo';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="tab-nav">
      <button
        className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onTabChange('dashboard')}
      >
        Dashboard
      </button>
      <button
        className={`tab-button ${activeTab === 'operations' ? 'active' : ''}`}
        onClick={() => onTabChange('operations')}
      >
        Operations
      </button>
      <button
        className={`tab-button ${activeTab === 'rules' ? 'active' : ''}`}
        onClick={() => onTabChange('rules')}
      >
        Rules
      </button>
      <button
        className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
        onClick={() => onTabChange('users')}
      >
        Users
      </button>
      <button
        className={`tab-button ${activeTab === 'undo' ? 'active' : ''}`}
        onClick={() => onTabChange('undo')}
      >
        Undo
      </button>
    </nav>
  );
};

export default TabNavigation;
