/**
 * @module sidepanel/components/shared/Skeleton
 * @description Shimmering placeholder for known-shape content — member lists, rule
 * cards, stat grids.
 *
 * Skeletons stand in for content whose shape is already known (a list row, a stat
 * tile). For unknown-shape or unknown-duration work — the `Suspense` fallbacks in
 * `TabPanel.tsx`, every error path — keep using {@link LoadingSpinner}; this
 * component does not replace that rule, it adds an option for the cases where the
 * eventual layout is predictable.
 */
import React from 'react';

/** Placeholder shape: `text` a single line, `row` a list-row block, `card` a stat/summary card block. */
export type SkeletonVariant = 'text' | 'row' | 'card';
/** Size scale — controls line thickness (`text`) or block padding (`row`/`card`). */
export type SkeletonSize = 'sm' | 'md' | 'lg';

interface SkeletonProps {
  /** Placeholder shape. Defaults to `text`. */
  variant?: SkeletonVariant;
  /** Size scale. Defaults to `md`. */
  size?: SkeletonSize;
  /**
   * Number of repeated blocks to render, so a caller doesn't loop at the call
   * site. Repeats share one `.rise-in-stagger` wrapper (capped at the 8th child)
   * rather than each entering independently. Defaults to `1`.
   */
  count?: number;
  /** Tailwind width class for the `text` variant's line (e.g. `w-1/2`). Ignored for `row`/`card`. Defaults to `w-full`. */
  width?: string;
  /** Accessible name for the single `role="status"` node announced to assistive tech. Defaults to `"Loading"`. */
  label?: string;
  /** Extra classes merged onto the outer wrapper. */
  className?: string;
}

const paddingClasses: Record<SkeletonSize, string> = {
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
};

const lineHeightClasses: Record<SkeletonSize, string> = {
  sm: 'h-3',
  md: 'h-4',
  lg: 'h-5',
};

const containerClasses: Record<SkeletonVariant, string> = {
  text: '',
  row: 'rounded-md border border-neutral-200 bg-white',
  card: 'rounded-md border border-neutral-200 bg-white',
};

/** Renders one placeholder block for the given variant; always `aria-hidden`. */
function SkeletonBone({
  variant,
  size,
  width,
}: {
  variant: SkeletonVariant;
  size: SkeletonSize;
  width: string;
}) {
  if (variant === 'row') {
    return (
      <div aria-hidden="true" className={`${containerClasses.row} ${paddingClasses[size]}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-2/5 rounded" />
            <div className="skeleton h-3 w-3/5 rounded" />
          </div>
          <div className="skeleton h-5 w-12 shrink-0 rounded" />
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div aria-hidden="true" className={`${containerClasses.card} ${paddingClasses[size]}`}>
        <div className="space-y-2">
          <div className="skeleton h-3 w-1/2 rounded" />
          <div className="skeleton h-8 w-1/3 rounded" />
          <div className="skeleton h-3 w-2/5 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={`skeleton rounded ${lineHeightClasses[size]} ${width}`} />
  );
}

/**
 * A shimmering placeholder for content whose shape is already known.
 *
 * Renders `count` repeated blocks (staggered entrance via `.rise-in-stagger`,
 * capped at the 8th) plus one hidden `role="status"` node carrying the
 * accessible name — the visual bones are `aria-hidden` so they never announce
 * as content to assistive tech.
 *
 * @example
 * ```tsx
 * // Three member-row placeholders while the list loads
 * <Skeleton variant="row" count={3} label="Loading members" />
 * ```
 */
const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  size = 'md',
  count = 1,
  width = 'w-full',
  label = 'Loading',
  className = '',
}) => {
  const n = Math.max(1, count);
  const bones = Array.from({ length: n }, (_, i) => (
    <SkeletonBone key={i} variant={variant} size={size} width={width} />
  ));

  return (
    <div className={className}>
      <div role="status" aria-label={label} className="sr-only" />
      <div className={n > 1 ? 'space-y-2 rise-in-stagger' : ''}>{bones}</div>
    </div>
  );
};

export default Skeleton;
