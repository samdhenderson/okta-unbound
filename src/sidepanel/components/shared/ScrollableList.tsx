/**
 * @module sidepanel/components/shared/ScrollableList
 * @description Independently scrollable list container with built-in loading and empty states.
 *
 * Renders a {@link LoadingSpinner} while `loading`, the `emptyState` node when it
 * has no children, otherwise a scroll region (its own scrollbar) that by default
 * flex-grows to fill available space so surrounding chrome stays visible. A caller
 * whose loading state has a known shape (a list of rows, a stat grid) can pass a
 * `Skeleton` (`shared/Skeleton`) via the optional `skeleton` prop instead of the
 * default spinner.
 *
 * **All three states occupy the same box.** The caller's `className`, `maxHeight`
 * and flex behaviour apply to the loading and empty branches exactly as they do to
 * the populated one, so a placeholder stands where the rows will and nothing shifts
 * when content resolves. Only the overflow rule differs — see `boxClasses` below.
 */
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
  /**
   * Optional known-shape placeholder (typically a `Skeleton`) rendered instead of
   * the default {@link LoadingSpinner} while `loading` is true. Additive and
   * opt-in: when omitted, the spinner path is unchanged.
   */
  skeleton?: React.ReactNode;
  /** Optional explicit max-height (e.g., "400px", "50vh") */
  maxHeight?: string;
  /** If true (default), uses flex-grow to fill remaining space */
  fillAvailable?: boolean;
  /**
   * If true (default), the populated branch is its own scroll box. Pass `false`
   * where the list is meant to scroll the **page** instead — a rung that has
   * given up its nested scroller so its sticky bands can actually dock
   * (`GroupsListPanel`, ADR-0051). The loading and empty branches are unaffected;
   * they never scrolled.
   *
   * A nested scroller is not free: nothing outside it can be `sticky` against the
   * page, an inner scrollbar sits beside the outer one, and the box needs a height
   * from somewhere — which is where `h-[calc(100vh-280px)]` magic numbers come
   * from. Reach for one only when the list must stay put while something beside it
   * scrolls.
   */
  scrolls?: boolean;
  /**
   * Optional ref on the scrolling element itself. Only attached in the populated
   * state (the loading/empty branches render no scroll box), so a consumer that
   * reads `scrollTop` must tolerate `null`. Exists so a view can preserve scroll
   * offset across a hide/show cycle — see
   * {@link sidepanel/hooks/useScrollPreservation.useScrollPreservation}.
   */
  scrollRef?: React.Ref<HTMLDivElement>;
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
  scrolls = true,
  skeleton,
  scrollRef,
  testId,
}) => {
  // Check if children are empty
  const childArray = React.Children.toArray(children);
  const isEmpty = childArray.length === 0;

  /**
   * The box every state shares — the caller's `className`, its flex behaviour, and
   * its `maxHeight`. Only the leading overflow rule and the contents differ.
   *
   * This is built once and used by all three rendered branches on purpose. Each
   * branch used to compose its own container and dropped a different subset: the
   * loading and empty branches took neither `className` nor `maxHeight`, so a
   * caller passing `className="mt-4"` (`AppsListPanel`, `GroupsListPanel`) got a
   * skeleton sitting 16px higher than the rows it stood in for — flush against the
   * toolbar above it — and a caller passing `maxHeight` (`MemberList`) got a
   * placeholder that could overflow the box it was standing in for. Height parity
   * is not achievable (six placeholders are not N rows) and is not the goal; *box*
   * parity is, so nothing shifts sideways or vertically when content resolves.
   */
  const boxClasses = (leading: string) =>
    [leading, fillAvailable ? 'flex-1 min-h-0' : '', className].filter(Boolean).join(' ');

  // Container style for explicit max-height
  const containerStyle: React.CSSProperties | undefined = maxHeight ? { maxHeight } : undefined;

  // Loading state. `overflow-hidden` rather than `overflow-y-auto`: a placeholder
  // must not offer a scrollbar that leads nowhere, and without it a `maxHeight`
  // would not actually clip a tall skeleton — it would spill out of its own box
  // and over whatever sits below.
  if (loading) {
    return (
      <div className={boxClasses('overflow-hidden')} style={containerStyle} data-testid={testId}>
        {skeleton ?? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="2xl" message={loadingMessage} centered />
          </div>
        )}
      </div>
    );
  }

  // Empty state
  if (isEmpty && emptyState) {
    return (
      <div className={boxClasses('overflow-hidden')} style={containerStyle} data-testid={testId}>
        {emptyState}
      </div>
    );
  }

  // Empty with no empty state provided
  if (isEmpty) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      // `scrollable-list` styles the custom scrollbar, so it belongs only on the
      // branch that actually has one — and only when this list is a scroller at
      // all. With `scrolls={false}` the box keeps its class names and its ref and
      // simply lets the page scroll it.
      className={boxClasses(scrolls ? 'overflow-y-auto scrollable-list' : '')}
      style={containerStyle}
      data-testid={testId}
    >
      <div className="space-y-3">{children}</div>
    </div>
  );
};

export default ScrollableList;
