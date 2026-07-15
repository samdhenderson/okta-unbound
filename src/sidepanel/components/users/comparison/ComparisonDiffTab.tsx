import React from 'react';
import Icon from '../../overview/shared/Icon';
import type { DiffItem } from './comparisonAnalytics';

interface ComparisonDiffTabProps {
  contextName: string;
  comparedName: string;
  comparedItems: DiffItem[];
  sharedItems: DiffItem[];
  contextItems: DiffItem[];
  emptyComparedText: string;
  emptySharedText: string;
  emptyContextText: string;
  noun: string;
  renderAction?: (item: DiffItem) => React.ReactNode;
}

/** Groups/Apps diff view: three tone-coded buckets (add / shared / neutral). */
const ComparisonDiffTab: React.FC<ComparisonDiffTabProps> = ({
  contextName,
  comparedName,
  comparedItems,
  sharedItems,
  contextItems,
  emptyComparedText,
  emptySharedText,
  emptyContextText,
  noun,
  renderAction,
}) => (
  <div className="space-y-3">
    <BucketCard
      tone="add"
      title={`Only ${comparedName}`}
      subtitle={renderAction ? `Add ${noun}s to ${contextName}` : `Unique to ${comparedName}`}
      count={comparedItems.length}
      items={comparedItems}
      emptyText={emptyComparedText}
      renderAction={renderAction}
    />
    <BucketCard
      tone="shared"
      title="Shared"
      subtitle={`Common ${noun}s between both users`}
      count={sharedItems.length}
      items={sharedItems}
      emptyText={emptySharedText}
    />
    <BucketCard
      tone="neutral"
      title={`Only ${contextName}`}
      subtitle={`${noun.charAt(0).toUpperCase() + noun.slice(1)}s ${comparedName} doesn't have`}
      count={contextItems.length}
      items={contextItems}
      emptyText={emptyContextText}
    />
  </div>
);

type Tone = 'add' | 'shared' | 'neutral';

interface BucketCardProps {
  tone: Tone;
  title: string;
  subtitle: string;
  count: number;
  items: DiffItem[];
  emptyText: string;
  renderAction?: (item: DiffItem) => React.ReactNode;
}

const toneStyles: Record<
  Tone,
  {
    border: string;
    bar: string;
    iconBg: string;
    iconColor: string;
    badge: string;
    icon: 'plus' | 'check' | 'minus';
  }
> = {
  add: {
    border: 'border-primary-highlight',
    bar: 'bg-primary',
    iconBg: 'bg-primary-light',
    iconColor: 'text-primary-text',
    badge: 'bg-primary text-white',
    icon: 'plus',
  },
  shared: {
    border: 'border-success-light',
    bar: 'bg-success',
    iconBg: 'bg-success-light',
    iconColor: 'text-success-text',
    badge: 'bg-success text-white',
    icon: 'check',
  },
  neutral: {
    border: 'border-neutral-200',
    bar: 'bg-neutral-400',
    iconBg: 'bg-neutral-100',
    iconColor: 'text-neutral-600',
    badge: 'bg-neutral-200 text-neutral-700',
    icon: 'minus',
  },
};

const BucketCard: React.FC<BucketCardProps> = ({
  tone,
  title,
  subtitle,
  count,
  items,
  emptyText,
  renderAction,
}) => {
  const s = toneStyles[tone];
  return (
    <div className={`overflow-hidden rounded-lg border ${s.border} bg-white`}>
      <div className="flex items-stretch">
        <div className={`w-1 ${s.bar}`} aria-hidden />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${s.iconBg} ${s.iconColor}`}
              >
                <Icon type={s.icon} size="sm" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-neutral-900" title={title}>
                  {title}
                </div>
                <div className="truncate text-[11px] text-neutral-500" title={subtitle}>
                  {subtitle}
                </div>
              </div>
            </div>
            <span
              className={`inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${s.badge}`}
            >
              {count}
            </span>
          </div>
          {items.length === 0 ? (
            <div className="border-t border-neutral-100 px-4 py-3 text-xs italic text-neutral-400">
              {emptyText}
            </div>
          ) : (
            <ul className="scrollable-list max-h-44 divide-y divide-neutral-100 overflow-y-auto border-t border-neutral-100">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-neutral-50/70"
                >
                  <span className="truncate text-sm text-neutral-800" title={item.label}>
                    {item.label}
                  </span>
                  {renderAction?.(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonDiffTab;
