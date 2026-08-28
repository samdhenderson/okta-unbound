/**
 * @module sidepanel/components/users/comparison/ComparisonTabBar
 * @description Tab bar (Overview / Groups / Apps / Attributes) with per-tab diff-count badges.
 *
 * ## Two rows below 640px, one above
 *
 * The bar was a single flex row of three tabs. A fourth — and the longest label
 * of the four — does not fit beside them in a 360px side panel: icon + label +
 * `px-3` comes to roughly 110px per tab, so four tabs need ~440px against the
 * ~330px the compact panel actually has. The three ways out were truncating a
 * label (which hides the word the tab is named for), dropping the glyphs (which
 * is the exact loss that kept this component off `Tabs` `segmented` — see
 * `docs/components.md`), or giving the bar a second row when it is narrow. Only
 * the last costs nothing.
 *
 * So the bar is a `grid`: two columns below the panel's 640px breakpoint — the
 * same threshold `useIsNarrow` condenses the ActivityBar at — and four above it.
 * The tabs keep their icons and their whole labels at every width.
 */
import React from 'react';
import Icon from '../../shared/Icon';
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
type ComparisonTab = {
  key: TabKey;
  label: string;
  icon: Extract<IconType, 'chart' | 'users' | 'app' | 'list'>;
  badge?: number;
};

/** role=tablist tab bar with per-tab diff badges. Documented tab-bar raw exception. */
const ComparisonTabBar: React.FC<ComparisonTabBarProps> = ({
  activeTab,
  onChange,
  groupDiff,
  appDiff,
  attributeDiff,
}) => {
  const tabs: ComparisonTab[] = [
    { key: 'overview', label: 'Overview', icon: 'chart' },
    { key: 'groups', label: 'Groups', icon: 'users', badge: groupDiff },
    { key: 'apps', label: 'Apps', icon: 'app', badge: appDiff },
    { key: 'attributes', label: 'Attributes', icon: 'list', badge: attributeDiff },
  ];

  return (
    <div
      role="tablist"
      className="grid grid-cols-2 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-1 sm:grid-cols-4"
    >
      {tabs.map((t) => {
        const active = activeTab === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`relative flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-(--dur-instant) ${
              active
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <Icon type={t.icon} size="sm" />
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span
                className={`ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-xs font-medium leading-none ${
                  active ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ComparisonTabBar;
