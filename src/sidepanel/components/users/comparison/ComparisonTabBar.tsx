/**
 * @module sidepanel/components/users/comparison/ComparisonTabBar
 * @description Tab bar (Overview / Groups / Apps / Attributes) for the comparison surface.
 *
 * ## A description of four tabs, not a second tab bar
 *
 * This was a hand-rolled `role="tablist"` whose container, active and inactive
 * class strings were near-verbatim copies of shared {@link Tabs}. The copy left
 * behind the one part of a tab bar that is not styling: `Tabs` implements roving
 * `tabindex` and Arrow/Home/End, and the fork implemented **no keyboard
 * navigation at all**, so a keyboard user could reach this strip and then not
 * move inside it. What is left here is the description of these four tabs: four
 * labels, and nothing else.
 *
 * ## The same strip the rest of the app uses
 *
 * These four are section navigation over one entity — the same job
 * `UserDetailPanel` and `GroupDetailView` do — so they take `Tabs`' default
 * `underline` variant and, like every other section strip in the panel, carry no
 * glyphs.
 *
 * ## Four labels, no glyphs and no badges — measured against the 360px floor
 *
 * A 360px side panel gives this strip 328px of track. Four labels carrying both
 * a glyph and a reserved two-digit diff badge measured **489px**; dropping the
 * glyphs took it to 401px, still overflowing. Labels alone measure 292px and
 * fit, so all four sections stay reachable without scrolling at the width the
 * panel can actually be dragged to.
 *
 * The diff counts are what paid for it. They are not lost: each tab states its
 * own difference count in its body on arrival, which is where the number is
 * legible next to the items it counts rather than compressed into a pill. That
 * also retires the badge-reservation problem the pills created — three counts
 * landing together when the comparison resolves, shoving three labels sideways
 * in one frame (`D-053e`).
 */
import React from 'react';
import { Tabs } from '../../shared';
import type { TabItem } from '../../shared';
import type { TabKey } from './comparisonAnalytics';

/** Props for {@link ComparisonTabBar}. */
interface ComparisonTabBarProps {
  /** Currently selected tab. */
  activeTab: TabKey;
  /** Invoked with the newly selected tab key. */
  onChange: (t: TabKey) => void;
}

/** One tab's static description, keyed to this surface's four sections. */
type ComparisonTab = TabItem & { key: TabKey };

/**
 * Narrows a key coming back out of `Tabs` — which speaks `string`, since it does
 * not know this surface's four sections — without a cast.
 */
const isTabKey = (tabs: ComparisonTab[], key: string): key is TabKey =>
  tabs.some((tab) => tab.key === key);

/**
 * The comparison surface's tab bar: shared `Tabs` in its default `underline`
 * variant, four labels wide.
 */
const ComparisonTabBar: React.FC<ComparisonTabBarProps> = ({ activeTab, onChange }) => {
  const tabs: ComparisonTab[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'groups', label: 'Groups' },
    { key: 'apps', label: 'Apps' },
    { key: 'attributes', label: 'Attributes' },
  ];

  return (
    <Tabs
      tabs={tabs}
      activeKey={activeTab}
      onChange={(key) => {
        if (isTabKey(tabs, key)) onChange(key);
      }}
      ariaLabel="Comparison sections"
    />
  );
};

export default ComparisonTabBar;
