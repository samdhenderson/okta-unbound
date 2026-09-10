/**
 * @module sidepanel/components/users/comparison/ComparisonTabBar
 * @description Tab bar (Overview / Groups / Apps / Attributes) with per-tab diff-count badges.
 *
 * ## A description of four tabs, not a second tab bar
 *
 * This was a hand-rolled `role="tablist"` whose container, active and inactive
 * class strings were near-verbatim copies of shared {@link Tabs}. The copy left
 * behind the one part of a tab bar that is not styling: `Tabs` implements roving
 * `tabindex` and Arrow/Home/End, and the fork implemented **no keyboard
 * navigation at all**, so a keyboard user could reach this strip and then not
 * move inside it. What is left here is the description of these four tabs: their
 * labels, and which of them carry a diff badge.
 *
 * ## The same strip the rest of the app uses
 *
 * These four are section navigation over one entity — the same job
 * `UserDetailPanel` and `GroupDetailView` do — so they take `Tabs`' default
 * `underline` variant and, like every other section strip in the panel, carry no
 * glyphs.
 *
 * Measured at the 360px panel floor: the four labels plus the three reserved
 * two-digit badge slots come to 401px against 328px of track, so the strip
 * scrolls there — `underline`'s standard answer to overflow, and what the
 * retired `segmented` variant's second row used to avoid. The glyphs would have
 * added a further 88px. Without the badges the same four labels measure ~310px
 * and would fit; the reservation is kept because all three counts land together
 * when the comparison resolves, and un-reserved they shove three labels sideways
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
 * variant, with a diff-count badge on each tab that can report one.
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
    { key: 'overview', label: 'Overview' },
    { key: 'groups', label: 'Groups', count: groupDiff, countDisplay: 'nonzero' },
    { key: 'apps', label: 'Apps', count: appDiff, countDisplay: 'nonzero' },
    {
      key: 'attributes',
      label: 'Attributes',
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
      ariaLabel="Comparison sections"
    />
  );
};

export default ComparisonTabBar;
