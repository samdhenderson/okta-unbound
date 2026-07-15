import React from 'react';
import Icon from '../../overview/shared/Icon';
import type { TabKey } from './comparisonAnalytics';

interface ComparisonTabBarProps {
  activeTab: TabKey;
  onChange: (t: TabKey) => void;
  groupDiff: number;
  appDiff: number;
}

/** role=tablist tab bar with per-tab diff badges. Documented tab-bar raw exception. */
const ComparisonTabBar: React.FC<ComparisonTabBarProps> = ({
  activeTab,
  onChange,
  groupDiff,
  appDiff,
}) => {
  const tabs: { key: TabKey; label: string; icon: 'chart' | 'users' | 'app'; badge?: number }[] = [
    { key: 'overview', label: 'Overview', icon: 'chart' },
    { key: 'groups', label: 'Groups', icon: 'users', badge: groupDiff },
    { key: 'apps', label: 'Apps', icon: 'app', badge: appDiff },
  ];

  return (
    <div
      role="tablist"
      className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-1"
    >
      {tabs.map((t) => {
        const active = activeTab === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-100 ${
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
                className={`ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none ${
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
