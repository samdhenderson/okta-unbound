/**
 * @module sidepanel/components/TabNavigation
 * @description The top icon rail for switching between the side panel's main views.
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
 * that closes the chrome against what follows lives here: on the last band of the
 * slab, so the slab keeps its edge against whatever scrolls beneath it.
 *
 * It is not `sticky`, and it publishes no height. The rail sits **outside** the
 * panel's scroller entirely (`App`), so there is nothing for it to stick to and
 * nothing below it that needs to park clear of it: a `PageHeader` inside the
 * scroller pins at that scroller's own top edge, which already begins under this
 * rail. `--rail-h` was that offset and is gone with it — every consumer read it
 * through a `var(--rail-h, 0px)` fallback, so the arithmetic collapses cleanly to
 * the header's own height (ADR-0032, amended).
 */
import React from 'react';
import { Tabs, type TabItem } from './shared';
import { TAB_DEFS, type TabType } from '../tabs';

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
const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => (
  <nav className="shrink-0 bg-white border-b border-neutral-200">
    <Tabs
      tabs={TAB_ITEMS}
      activeKey={activeTab}
      onChange={(key) => onTabChange(key as TabType)}
      variant="rail"
      ariaLabel="Main sections"
    />
  </nav>
);

export default TabNavigation;
