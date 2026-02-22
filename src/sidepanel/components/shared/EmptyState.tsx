import React from 'react';
import Icon, { type IconType } from '../overview/shared/Icon';
import Button from './Button';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateProps {
  icon: IconType;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  className?: string;
}

/**
 * A standardized empty state component for displaying when there's no content.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon="search"
 *   title="No results found"
 *   description="Try adjusting your search or filter criteria"
 *   actions={[
 *     { label: 'Clear Filters', onClick: handleClear, variant: 'secondary' }
 *   ]}
 * />
 * ```
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actions,
  className = '',
}) => {
  return (
    <div className={`text-center py-12 px-6 ${className}`}>
      {/* Icon in circle */}
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-light mb-4">
        <Icon type={icon} size="xl" className="text-primary-text" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-neutral-900 mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
        {title}
      </h3>

      {/* Description */}
      <p className="text-neutral-600 max-w-md mx-auto mb-6">
        {description}
      </p>

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex gap-3 justify-center">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'primary'}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
