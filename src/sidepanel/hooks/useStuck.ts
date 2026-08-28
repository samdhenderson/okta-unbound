/**
 * @module sidepanel/hooks/useStuck
 * @description Report whether a `position: sticky` element has reached its pinned position.
 *
 * CSS can pin an element but cannot tell you that it *is* pinned — there is no `:stuck`
 * selector in stable Chrome — and the page header has to look different once it is
 * (ADR-0032). The standard answer is a zero-height sentinel in normal flow immediately
 * above the sticky element: once the sentinel is scrolled past the line the element sticks
 * to, the element must be stuck.
 *
 * An `IntersectionObserver` rather than a scroll listener, so nothing runs per frame while
 * the user scrolls, and nothing needs a reference to the shared scroller.
 *
 * The sticky line is read from the element's own resolved `top`, not from any knowledge of
 * what is above it. So a strip that parks below a header via `top: var(--header-h)` reports
 * correctly without this hook knowing the header exists — and a header that parks at the
 * top of the panel's scroller reports correctly with `top: 0`, because the scroller clips
 * the sentinel at exactly that line and an `IntersectionObserver` honours the clip rects of
 * every ancestor between the target and the root.
 */
import { useEffect, useState, type RefObject } from 'react';

/**
 * Track whether `stickyRef`'s element is currently pinned.
 *
 * @param sentinelRef - A zero-height element in normal flow, immediately before the sticky
 *   element. It must not itself be sticky or absolutely positioned.
 * @param stickyRef - The sticky element, read for its resolved `top` offset.
 * @param enabled - Whether to observe at all. Pass the tab's `isActive`: a hidden panel is
 *   `display: none`, so its sentinel never intersects and would otherwise report a
 *   permanently pinned header (ADR-0018).
 * @returns `true` once the element has reached its pinned position.
 *
 * @example
 * ```tsx
 * const sentinelRef = useRef<HTMLDivElement>(null);
 * const headerRef = useRef<HTMLDivElement>(null);
 * const pinned = useStuck(sentinelRef, headerRef, isActive);
 * ```
 */
export function useStuck(
  sentinelRef: RefObject<HTMLElement | null>,
  stickyRef: RefObject<HTMLElement | null>,
  enabled = true,
): boolean {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setStuck(false);
      return;
    }
    const sentinel = sentinelRef.current;
    const sticky = stickyRef.current;
    if (!sentinel || !sticky || typeof IntersectionObserver !== 'function') return;

    let observer: IntersectionObserver | null = null;

    const observe = () => {
      observer?.disconnect();
      // Where the element parks. `getComputedStyle().top` on a sticky element resolves the
      // offset it will stick at, whether or not it is stuck right now — so the margin below
      // shifts the observer's top edge onto exactly that line.
      const offset = Number.parseFloat(window.getComputedStyle(sticky).top) || 0;
      observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
        rootMargin: `-${offset}px 0px 0px 0px`,
        threshold: 0,
      });
      observer.observe(sentinel);
    };

    observe();
    // The offset is a measured height that changes when the rail rewraps, which only
    // happens on a resize — cheap to re-arm there rather than poll the variable.
    window.addEventListener('resize', observe);

    return () => {
      window.removeEventListener('resize', observe);
      observer?.disconnect();
    };
  }, [sentinelRef, stickyRef, enabled]);

  return stuck;
}
