import React from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  message?: string;
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
      className={`inline-block animate-spin rounded-full border-gray-200 border-t-blue-600 ${sizeClasses[size]} ${className}`}
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
        {message && (
          <p className="mt-4 text-gray-600 text-sm">{message}</p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;
