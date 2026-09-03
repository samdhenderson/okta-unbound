/**
 * @module sidepanel/components/users/comparison/ComparisonTabBar
 * @description Tab bar (Overview / Groups / Apps / Attributes) with per-tab diff-count badges.
 *
 * ## A description of four tabs, not a second tab bar
 *
 * This was a hand-rolled `role="tablist"` whose container, active and inactive
 * class strings were near-verbatim copies of shared {@link Tabs}' `segmented`
 * variant. It was forked for two things that variant did not offer — per-tab
 * icons, and a second row below `sm` — and the copy left behind the one part of
 * a tab bar that is not styling: `Tabs` implements roving `tabindex` and
 * Arrow/Home/End, and the fork implemented **no keyboard navigation at all**, so
 * a keyboard user could reach this strip and then not move inside it.
 *
 * Both reasons for the fork are now capabilities of the primitive (`TabItem.icon`
 * renders in every variant; `wrap` gives a `segmented` strip two columns below
 * `sm`), so what is left here is the description of these four tabs: their
 * labels, their glyphs, and which of them carry a diff badge.
 *
 * ## Two rows below 640px, one above
 *
 * Four tabs of icon + label come to roughly 440px against the ~330px a 360px
 * side panel has. The three ways out were truncating a label (which hides the
 * word the tab is named for), dropping the glyphs, or giving the bar a second
 * row when it is narrow. Only the last costs nothing, and it is what `wrap`
 * asks for.
 */
import React from 'react';
import { Tabs } from '../../shared';
import type { TabItem } from '../../shared';
import type { IconType } from '../../shared/Icon';
import type { TabKey } from './comparisonAnalytics';

/** Props for {@link ComparisonTabBar}. */
interface ComparisonTabBarProps {
  /** Currently selected tab. */
  activeTab: TabKey;
  /** Invoked with the newly selected tab key. */
  onChange: (t: TabKey) => void;
  /** Number of differing groups, shown as a badge on the Groups tab (hidden when 0). */
  groupDiff: number;
  /** Number of differing apps, shown as a badge on the Apps tab (hidden when 0). */
  appDiff: number;
  /**
   * Number of differing attributes the admin's display config makes **visible**,
   * shown as a badge on the Attributes tab (hidden when 0).
   *
   * Deliberately the visible count rather than the total: the badge has to agree
   * with what the tab lists on arrival, and the differences a config hides are
   * disclosed by the tab itself, which can also offer to reveal them.
   */
  attributeDiff: number;
}

/** One tab's static description. The icon union is hard-coded, so a typo cannot compile. */
type ComparisonTab = TabItem & {
  key: TabKey;
  icon: Extract<IconType, 'chart' | 'users' | 'app' | 'list'>;
};

/**
 * Narrows a key coming back out of `Tabs` — which speaks `string`, since it does
 * not know this surface's four sections — without a cast.
 */
const isTabKey = (tabs: ComparisonTab[], key: string): key is TabKey =>
  tabs.some((tab) => tab.key === key);

/**
 * The comparison surface's tab bar: shared `Tabs` in its `segmented` variant,
 * wrapped to two columns on a narrow panel, with a diff-count badge on each tab
 * that can report one.
 */
const ComparisonTabBar: React.FC<ComparisonTabBarProps> = ({
  activeTab,
  onChange,
  groupDiff,
  appDiff,
  attributeDiff,
}) => {
  // `countDisplay: 'nonzero'` is what makes these *difference* counts rather than
  // sizes: nothing differing is nothing to report, so the tab shows no pill — and
  // the slot is still reserved, because all three land together when the
  // comparison resolves.
  const tabs: ComparisonTab[] = [
    { key: 'overview', label: 'Overview', icon: 'chart' },
    { key: 'groups', label: 'Groups', icon: 'users', count: groupDiff, countDisplay: 'nonzero' },
    { key: 'apps', label: 'Apps', icon: 'app', count: appDiff, countDisplay: 'nonzero' },
    {
      key: 'attributes',
      label: 'Attributes',
      icon: 'list',
      count: attributeDiff,
      countDisplay: 'nonzero',
    },
  ];

  return (
    <Tabs
      tabs={tabs}
      activeKey={activeTab}
      onChange={(key) => {
        if (isTabKey(tabs, key)) onChange(key);
      }}
      variant="segmented"
      wrap
      ariaLabel="Comparison sections"
    />
  );
};

export default ComparisonTabBar;
