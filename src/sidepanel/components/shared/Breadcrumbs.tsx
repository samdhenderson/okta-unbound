/**
 * @module sidepanel/components/shared/Breadcrumbs
 * @description Breadcrumb trail for in-tab sub-navigation — the display half of `useViewStack`.
 *
 * Renders an ordered `nav > ol` of crumbs separated by a chevron. Every crumb
 * except the last is an actionable link back up the trail; the last is the current
 * view and is rendered as plain text carrying `aria-current="page"`.
 *
 * Shapes exactly to the `trail` returned by
 * {@link sidepanel/hooks/useViewStack.useViewStack}, so a tab shell can pass it
 * straight through — but it takes a plain item list, so any caller can use it.
 */
import React from 'react';
import Icon from '../overview/shared/Icon';

/** Density of the trail. `sm` is the compact side-panel default; `md` matches body text. */
export type BreadcrumbsSize = 'sm' | 'md';

/** One rung of a {@link Breadcrumbs} trail. */
export interface BreadcrumbItem {
  /** Stable React key. */
  key: string;
  /** Visible label. */
  label: string;
  /**
   * Navigates to this crumb. Omit on the current (last) crumb — a crumb without
   * `onSelect` renders as non-interactive text with `aria-current="page"`.
   */
  onSelect?: () => void;
}

interface BreadcrumbsProps {
  /** The trail, root-first. The last item is treated as the current view. */
  items: BreadcrumbItem[];
  /** Density preset. Defaults to `sm`. */
  size?: BreadcrumbsSize;
  /** Accessible name for the landmark. Defaults to `Breadcrumb`. */
  ariaLabel?: string;
  /** Extra classes on the `<nav>` wrapper. */
  className?: string;
}

const sizeClasses: Record<BreadcrumbsSize, string> = {
  sm: 'text-xs gap-1',
  md: 'text-sm gap-2',
};

const separatorSize: Record<BreadcrumbsSize, 'sm' | 'md'> = {
  sm: 'sm',
  md: 'md',
};

/**
 * Breadcrumb trail for sub-navigation within a tab. Pass `useViewStack`'s `trail`
 * (or any equivalent list) — the last item renders as the current page and the
 * rest as buttons back up the stack.
 *
 * @example
 * ```tsx
 * <Breadcrumbs items={nav.trail} />
 * ```
 */
const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  size = 'sm',
  ariaLabel = 'Breadcrumb',
  className = '',
}) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className={`flex items-center flex-wrap ${sizeClasses[size]}`}>
        {items.map((item, index) => (
          <li key={item.key} className="flex items-center min-w-0">
            {index > 0 && (
              <span aria-hidden="true" className="flex shrink-0 text-neutral-400">
                <Icon type="chevron-right" size={separatorSize[size]} />
              </span>
            )}
            {item.onSelect ? (
              <button
                type="button"
                onClick={item.onSelect}
                className="max-w-48 truncate rounded-md px-1 font-medium text-neutral-600 transition-colors duration-(--dur-instant) hover:text-neutral-900 hover:underline focus:outline-2 focus:outline-offset-2 focus:outline-primary"
              >
                {item.label}
              </button>
            ) : (
              <span
                aria-current="page"
                className="max-w-48 truncate px-1 font-semibold text-neutral-900"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
