import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface ScrollableListProps {
  /** The list items to render */
  children: React.ReactNode;
  /** Additional CSS classes for the container */
  className?: string;
  /** Content to show when there are no children */
  emptyState?: React.ReactNode;
  /** Shows loading spinner when true */
  loading?: boolean;
  /** Custom message for loading state */
  loadingMessage?: string;
  /** Optional explicit max-height (e.g., "400px", "50vh") */
  maxHeight?: string;
  /** If true (default), uses flex-grow to fill remaining space */
  fillAvailable?: boolean;
  /** Test ID for testing */
  testId?: string;
}

/**
 * A scrollable list container that provides its own scrollbar.
 *
 * Use this component to create independently scrollable list areas
 * that don't affect page-level scroll, keeping other elements
 * (like action buttons or panels) visible.
 *
 * @example
 * // Fill available space in a flex container
 * <div className="flex flex-col h-full">
 *   <div className="flex-shrink-0">Header content</div>
 *   <ScrollableList>
 *     {items.map(item => <ItemCard key={item.id} />)}
 *   </ScrollableList>
 *   <div className="flex-shrink-0">Footer content</div>
 * </div>
 *
 * @example
 * // With explicit max height
 * <ScrollableList maxHeight="400px" fillAvailable={false}>
 *   {items.map(item => <ItemCard key={item.id} />)}
 * </ScrollableList>
 */
const ScrollableList: React.FC<ScrollableListProps> = ({
  children,
  className = '',
  emptyState,
  loading = false,
  loadingMessage = 'Loading...',
  maxHeight,
  fillAvailable = true,
  testId,
}) => {
  // Check if children are empty
  const childArray = React.Children.toArray(children);
  const isEmpty = childArray.length === 0;

  // Loading state
  if (loading) {
    return (
      <div
        className={`flex items-center justify-center py-12 ${fillAvailable ? 'flex-1' : ''}`}
        data-testid={testId}
      >
        <LoadingSpinner size="lg" message={loadingMessage} centered />
      </div>
    );
  }

  // Empty state
  if (isEmpty && emptyState) {
    return (
      <div
        className={fillAvailable ? 'flex-1' : ''}
        data-testid={testId}
      >
        {emptyState}
      </div>
    );
  }

  // Empty with no empty state provided
  if (isEmpty) {
    return null;
  }

  // Container classes
  const containerClasses = [
    // Scrolling behavior
    'overflow-y-auto',
    // Flex behavior for fill available
    fillAvailable ? 'flex-1 min-h-0' : '',
    // Custom scrollbar styling (defined in styles.css)
    'scrollable-list',
    // User-provided classes
    className,
  ].filter(Boolean).join(' ');

  // Container style for explicit max-height
  const containerStyle: React.CSSProperties | undefined = maxHeight
    ? { maxHeight }
    : undefined;

  return (
    <div
      className={containerClasses}
      style={containerStyle}
      data-testid={testId}
    >
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
};

export default ScrollableList;
