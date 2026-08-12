/**
 * @module sidepanel/components/users/comparison/ComparisonDiffTab
 * @description Three tone-coded buckets (only-compared / shared / only-context) for a groups or apps diff.
 *
 * Reused for both the Groups and Apps tabs; `noun` and the empty-state strings
 * are supplied by the parent. `renderAction` (used only on the Groups tab)
 * injects the per-row "Add" affordance, and `renderMeta` (used only on the Apps
 * tab) injects a per-row detail whose meaning depends on which bucket the row is
 * in.
 */
import React from 'react';
import Icon from '../../overview/shared/Icon';
import type { DiffItem } from './comparisonAnalytics';

/**
 * Which of the three buckets a row is being rendered in, named after the
 * corresponding props.
 *
 * Handed to {@link ComparisonDiffTabProps.renderMeta} because a bucket's rows do
 * not all describe the same thing: an only-compared or only-context row is about
 * exactly one user, while a `shared` row is about both — and a facet the caller
 * only holds for one side must therefore be renderable differently there.
 */
export type DiffBucketKind = 'onlyCompared' | 'shared' | 'onlyContext';

/** Props for {@link ComparisonDiffTab}. */
interface ComparisonDiffTabProps {
  /** Display name of the context user (baseline). */
  contextName: string;
  /** Display name of the compared user. */
  comparedName: string;
  /** Items unique to the compared user (the "add" bucket). */
  comparedItems: DiffItem[];
  /** Items both users share. */
  sharedItems: DiffItem[];
  /** Items unique to the context user. */
  contextItems: DiffItem[];
  /** Empty-state text for the only-compared bucket. */
  emptyComparedText: string;
  /** Empty-state text for the shared bucket. */
  emptySharedText: string;
  /** Empty-state text for the only-context bucket. */
  emptyContextText: string;
  /** Singular noun for the items ("group" or "app"), used in subtitles. */
  noun: string;
  /** Optional per-row action for the only-compared bucket (Add to context user); groups only. */
  renderAction?: (item: DiffItem) => React.ReactNode;
  /** Optional per-row action for the only-context bucket (Add to compared user); groups only. */
  renderContextAction?: (item: DiffItem) => React.ReactNode;
  /**
   * **Apps tab only** — optional per-row detail rendered immediately after the
   * row's label (today: how Okta reports the app assignment).
   *
   * A render prop rather than a field on {@link DiffItem} on purpose. The honest
   * answer depends on the bucket, not just the row — the compared/context buckets
   * hold one user's data, `shared` holds a row about both users backed by one
   * user's data — and only the caller knows what its facet means per bucket. Left
   * `undefined` by the Groups tab, which renders exactly as it did before this
   * prop existed.
   */
  renderMeta?: (item: DiffItem, bucket: DiffBucketKind) => React.ReactNode;
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
  renderContextAction,
  renderMeta,
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
      renderMeta={renderMeta && ((item) => renderMeta(item, 'onlyCompared'))}
    />
    <BucketCard
      tone="shared"
      title="Shared"
      subtitle={`Common ${noun}s between both users`}
      count={sharedItems.length}
      items={sharedItems}
      emptyText={emptySharedText}
      renderMeta={renderMeta && ((item) => renderMeta(item, 'shared'))}
    />
    <BucketCard
      tone="neutral"
      title={`Only ${contextName}`}
      subtitle={
        renderContextAction
          ? `Add ${noun}s to ${comparedName}`
          : `${noun.charAt(0).toUpperCase() + noun.slice(1)}s ${comparedName} doesn't have`
      }
      count={contextItems.length}
      items={contextItems}
      emptyText={emptyContextText}
      renderAction={renderContextAction}
      renderMeta={renderMeta && ((item) => renderMeta(item, 'onlyContext'))}
    />
  </div>
);

/** Visual tone of a bucket: add (compared-only), shared (in common), or neutral (context-only). */
type Tone = 'add' | 'shared' | 'neutral';

/** Props for the internal {@link BucketCard}. */
interface BucketCardProps {
  /** Tone controlling the accent color, icon, and badge styling. */
  tone: Tone;
  /** Card title (e.g. "Shared" or "Only Jane"). */
  title: string;
  /** Secondary line under the title. */
  subtitle: string;
  /** Item count shown in the badge. */
  count: number;
  /** Rows to render. */
  items: DiffItem[];
  /** Text shown when `items` is empty. */
  emptyText: string;
  /** Optional per-row action renderer. */
  renderAction?: (item: DiffItem) => React.ReactNode;
  /** Optional per-row detail renderer, already bound to this card's bucket by the parent. */
  renderMeta?: (item: DiffItem) => React.ReactNode;
}

/** Per-tone accent styles (border, bar, icon, badge) keyed by {@link Tone}. */
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

/** One tone-coded bucket: header (icon, title, subtitle, count) plus a scrollable item list. */
const BucketCard: React.FC<BucketCardProps> = ({
  tone,
  title,
  subtitle,
  count,
  items,
  emptyText,
  renderAction,
  renderMeta,
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
              {items.map((item) => {
                const meta = renderMeta?.(item);
                const label = (
                  <span className="truncate text-sm text-neutral-800" title={item.label}>
                    {item.label}
                  </span>
                );
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-neutral-50/70"
                  >
                    {/* No `renderMeta` (the Groups tab) renders the bare label
                        exactly as before — the wrapper only appears when there is
                        something to sit beside it. */}
                    {meta ? (
                      <span className="flex min-w-0 items-center gap-2">
                        {label}
                        {meta}
                      </span>
                    ) : (
                      label
                    )}
                    {renderAction?.(item)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparisonDiffTab;
