/**
 * @module sidepanel/components/shared/LoadingSpinner
 * @description Spinning loading indicator with `role="status"`; optional message and centering.
 *
 * With neither `message` nor `centered`, renders a bare inline spinner; otherwise
 * it is wrapped in a centered column with the message beneath.
 */
import React from 'react';

/** Spinner diameter — `sm` (16px), `md` (32px), `lg` (48px). */
export type SpinnerSize = 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps {
  /** Spinner size. Defaults to `md`. */
  size?: SpinnerSize;
  /** Optional caption rendered below the spinner. */
  message?: string;
  /** Center the spinner (and message) within a padded flex block. */
  centered?: boolean;
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-3',
  lg: 'h-12 w-12 border-4',
};

/**
 * A standardized loading spinner component.
 *
 * @example
 * ```tsx
 * // Inline spinner
 * <LoadingSpinner size="sm" />
 *
 * // Centered with message
 * <LoadingSpinner size="lg" message="Loading data..." centered />
 * ```
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message,
  centered = false,
  className = '',
}) => {
  const spinner = (
    <div
      className={`inline-block animate-spin rounded-full border-neutral-200 border-t-primary ${sizeClasses[size]} ${className}`}
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
