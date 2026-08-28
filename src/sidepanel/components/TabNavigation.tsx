/**
 * @module sidepanel/components/TabNavigation
 * @description Sticky top icon rail for switching between the side panel's main views.
 *
 * Renders the tabs from the central {@link module:sidepanel/tabs} registry via the
 * shared accessible {@link Tabs} strip (`rail` variant) and highlights the active
 * one. Nine text tabs need well past 590px of strip; the panel opens at 480 and the
 * user can drag it to 360, so inactive tabs render as icons only and the active
 * tab's label unfurls beside its glyph. Every tab keeps its label as its accessible
 * name whether or not that label is currently visible, and carries a `Tooltip`
 * naming it on hover and on focus.
 *
 * This `<nav>` is also the **bottom of the top-chrome slab**. `ContextBar`, the rail
 * and a detail rung's `PageHeader` used to carry a hairline each, stacking four
 * horizontal rules into the first ~150px of a ~520px panel and leaving the rail
 * bordered above *and* below — a strip detached from both its neighbours. They are
 * now one white surface separated by spacing and type weight, and the single rule
 * that closes the chrome against what follows lives here: on the element that stays
 * put when the page scrolls, so the slab keeps its edge in the pinned state too.
 */
import React, { useRef } from 'react';
import { Tabs, type TabItem } from './shared';
import { TAB_DEFS, type TabType } from '../tabs';
import { usePublishedHeight } from '../hooks/usePublishedHeight';

export type { TabType } from '../tabs';

/** Props for {@link TabNavigation}. */
interface TabNavigationProps {
  /** Currently selected tab, rendered with its label unfurled and the indicator beneath. */
  activeTab: TabType;
  /** Called with the chosen tab id when a tab is clicked. */
  onTabChange: (tab: TabType) => void;
}

const TAB_ITEMS: TabItem[] = TAB_DEFS.map(({ id, label, icon }) => ({ key: id, label, icon }));

/** Renders the horizontal tab navigation and reports selection via `onTabChange`. */
const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  const railRef = useRef<HTMLElement>(null);

  // First band of the sticky stack (ADR-0032). The rail is a singleton, so it publishes on
  // the document root: a pinned page header parks at `top: var(--rail-h)` and a detail
  // view's action strip adds this to the header's own height. Measured rather than
  // hard-coded because the rail rewraps at narrow widths.
  usePublishedHeight(railRef, '--rail-h');

  return (
    <nav ref={railRef} className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <Tabs
        tabs={TAB_ITEMS}
        activeKey={activeTab}
        onChange={(key) => onTabChange(key as TabType)}
        variant="rail"
        ariaLabel="Main sections"
      />
    </nav>
  );
};

export default TabNavigation;
