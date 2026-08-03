/**
 * @module sidepanel/components/TabNavigation
 * @description Sticky top tab bar for switching between the side panel's main views.
 *
 * Renders the tabs from the central {@link module:sidepanel/tabs} registry via the
 * shared accessible {@link Tabs} strip (underline variant) and highlights the
 * active one.
 */
import React from 'react';
import { Tabs } from './shared';
import { TAB_DEFS, type TabType } from '../tabs';

export type { TabType } from '../tabs';

/** Props for {@link TabNavigation}. */
interface TabNavigationProps {
  /** Currently selected tab, rendered with the active styling and underline. */
  activeTab: TabType;
  /** Called with the chosen tab id when a tab is clicked. */
  onTabChange: (tab: TabType) => void;
}

const TAB_ITEMS = TAB_DEFS.map(({ id, label }) => ({ key: id, label }));

/** Renders the horizontal tab navigation and reports selection via `onTabChange`. */
const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => (
  <nav className="sticky top-0 z-40 bg-white">
    <Tabs
      tabs={TAB_ITEMS}
      activeKey={activeTab}
      onChange={(key) => onTabChange(key as TabType)}
      variant="underline"
      ariaLabel="Main sections"
    />
  </nav>
);

export default TabNavigation;
