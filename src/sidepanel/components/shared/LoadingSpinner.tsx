/**
 * @module sidepanel/components/shared/LoadingSpinner
 * @description Spinning loading indicator with `role="status"`; optional message and centering.
 *
 * With neither `message` nor `centered`, renders a bare inline spinner; otherwise
 * it is wrapped in a centered column with the message beneath.
 *
 * Sizes run `sm` 16 / `md` 20 / `lg` 24 / `xl` 32 / `2xl` 48 — the four smallest
 * names mean the same pixels they do in the `Icon` registry, so a spinner that
 * replaces or accompanies a glyph can be asked for by the glyph's own size name.
 */
import React from 'react';

/**
 * Spinner diameter. The scale is name-for-name identical to the `Icon` registry
 * over the sizes they share, so a spinner can sit beside a glyph and match it:
 *
 * - `sm` — 16px (inline, beside `text-sm` body copy or an `Icon size="sm"`)
 * - `md` — 20px (inline in a form control or list row — matches `Icon size="md"`)
 * - `lg` — 24px (matches `Icon size="lg"`)
 * - `xl` — 32px (section-level busy state; the default)
 * - `2xl` — 48px (full-view / tab-level busy state)
 */
export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface LoadingSpinnerProps {
  /** Spinner size (see {@link SpinnerSize}). Defaults to `xl` (32px). */
  size?: SpinnerSize;
  /** Optional caption rendered below the spinner. */
  message?: string;
  /** Center the spinner (and message) within a padded flex block. */
  centered?: boolean;
  /** Extra classes merged onto the spinner element (e.g. `shrink-0`). */
  className?: string;
}

/**
 * Maps a {@link SpinnerSize} to its Tailwind diameter and ring-thickness classes.
 * The border thickness grows with the diameter so the ring reads at the same
 * visual weight at every size.
 */
const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-6 w-6 border-3',
  xl: 'h-8 w-8 border-3',
  '2xl': 'h-12 w-12 border-4',
};

/**
 * A standardized loading spinner component.
 *
 * @example
 * ```tsx
 * // Inline beside 16px body copy or an `Icon size="sm"`
 * <LoadingSpinner size="sm" />
 *
 * // Inline in a search field, matching an `Icon size="md"` (20px)
 * <LoadingSpinner size="md" />
 *
 * // Section-level busy state (32px — the default)
 * <LoadingSpinner centered message="Loading rule…" />
 *
 * // Full-view busy state (48px)
 * <LoadingSpinner size="2xl" message="Loading data..." centered />
 * ```
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'xl',
  message,
  centered = false,
  className = '',
}) => {
  const spinner = (
    <div
      // motion-exempt: the spin encodes live loading state, not a decorative
      // entrance/exit — it must keep animating under prefers-reduced-motion.
      className={`motion-exempt inline-block animate-spin rounded-full border-neutral-200 border-t-primary ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );

  if (!centered && !message) {
    return spinner;
  }

  return (
    <div className={`${centered ? 'flex items-center justify-center py-12' : ''}`}>
      <div className="text-center">
        {spinner}
        {message && <p className="mt-4 text-neutral-600 text-sm">{message}</p>}
      </div>
    </div>
  );
};

export default LoadingSpinner;
