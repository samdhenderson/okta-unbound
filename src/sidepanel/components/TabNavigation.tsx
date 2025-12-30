import React from 'react';

// Removed 'operations' tab - functionality merged into Overview
// Renamed 'dashboard' to 'overview' (legacy support via App.tsx)
// Renamed 'undo' to 'history' for clarity
export type TabType = 'overview' | 'rules' | 'users' | 'security' | 'groups' | 'apps' | 'history';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  const tabConfig = [
    { id: 'overview', label: 'Overview', description: 'Context-aware overview and quick actions' },
    { id: 'users', label: 'Users', description: 'Search users and trace memberships' },
    { id: 'groups', label: 'Groups', description: 'Browse and manage all groups' },
    { id: 'rules', label: 'Rules', description: 'View and manage group rules' },
    { id: 'apps', label: 'Apps', description: 'Application assignment management' },
    { id: 'history', label: 'History', description: 'Audit trail and undo operations' },
    // { id: 'security', label: 'Security', description: 'Security analysis and findings' },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-white/98 backdrop-blur-xl border-b border-gray-200/60 shadow-sm">
      <div className="flex items-center overflow-x-auto scrollbar-hide px-1" style={{ fontFamily: 'var(--font-primary)' }}>
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            className={`
              relative px-5 py-4 text-sm font-semibold tracking-wide transition-all duration-300 group
              ${activeTab === tab.id
                ? 'text-[#007dc1]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
              }
            `}
            onClick={() => onTabChange(tab.id as TabType)}
            title={tab.description}
          >
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <>
                {/* Active indicator with gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#007dc1] via-[#3d9dd9] to-[#007dc1] rounded-full shadow-sm"
                     style={{
                       animation: 'slideIn 0.3s ease-out',
                       boxShadow: '0 0 8px rgba(0, 125, 193, 0.3)'
                     }} />
                {/* Subtle background glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#007dc1]/5 to-transparent rounded-t-lg -z-10" />
              </>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default TabNavigation;
