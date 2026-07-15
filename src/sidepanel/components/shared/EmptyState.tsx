/**
 * @module sidepanel/components/shared/EmptyState
 * @description Centered "no content" placeholder — icon, title, description, and optional action buttons.
 *
 * Use for empty lists, no-search-results, and first-run states. Each action
 * renders as a shared {@link Button}.
 */
import React from 'react';
import Icon, { type IconType } from '../overview/shared/Icon';
import Button from './Button';

/** A button rendered beneath the empty-state copy (e.g. "Clear filters"). */
export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  /** Button variant. Defaults to `primary`. */
  variant?: 'primary' | 'secondary';
}

interface EmptyStateProps {
  /** Icon glyph shown in the circular badge. */
  icon: IconType;
  /** Bold headline. */
  title: string;
  /** Supporting explanatory copy. */
  description: string;
  /** Optional action buttons (rendered only when non-empty). */
  actions?: EmptyStateAction[];
  className?: string;
}

/**
 * A standardized empty-state placeholder for when a view has no content to show.
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
      <h3
        className="text-xl font-semibold text-neutral-900 mb-2"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {title}
      </h3>

      {/* Description */}
      <p className="text-neutral-600 max-w-md mx-auto mb-6">{description}</p>

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex gap-3 justify-center">
          {actions.map((action, index) => (
            <Button key={index} variant={action.variant || 'primary'} onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
