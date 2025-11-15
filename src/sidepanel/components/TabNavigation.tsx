import React from 'react';

type TabType = 'operations' | 'rules';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="tab-nav">
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
    </nav>
  );
};

export default TabNavigation;
