/**
 * @module sidepanel/components/TabNavigation
 * @description Sticky top tab bar for switching between the side panel's main views.
 *
 * Renders the Overview/Users/Groups/Rules/History tabs and highlights the active one.
 */
import React from 'react';

/** Identifier for each top-level side-panel tab. */
export type TabType = 'overview' | 'rules' | 'users' | 'groups' | 'export' | 'history';

interface TabNavigationProps {
  /** Currently selected tab, rendered with the active styling and underline. */
  activeTab: TabType;
  /** Called with the chosen tab id when a tab is clicked. */
  onTabChange: (tab: TabType) => void;
}

/** Renders the horizontal tab navigation and reports selection via `onTabChange`. */
const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  const tabConfig = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'groups', label: 'Groups' },
    { id: 'rules', label: 'Rules' },
    { id: 'export', label: 'Export' },
    { id: 'history', label: 'History' },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <div className="flex items-center overflow-x-auto" style={{ gap: '4px' }}>
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            className={`
              relative px-4 py-2.5 text-sm font-medium transition-colors duration-100
              ${
                activeTab === tab.id
                  ? 'text-primary-text'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }
            `}
            style={{ fontFamily: 'var(--font-heading)', minHeight: '40px' }}
            onClick={() => onTabChange(tab.id as TabType)}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-text" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default TabNavigation;
