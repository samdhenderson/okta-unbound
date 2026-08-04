/**
 * @module sidepanel/hooks/useStaggerReveal
 * @description Reveals `.rise-in-stagger` rows as they scroll into view.
 *
 * The plain CSS stagger animates every child on mount: the first eight step in at
 * 24ms intervals and the rest fire together at zero delay. In a side panel showing
 * roughly nine rows that reads as "only the top of the list animates" — everything
 * below the fold finishes its entrance off-screen and is already static by the time
 * you scroll to it. Lists here also page in batches of 50 behind an
 * `IntersectionObserver`, so most rows are never on screen when they mount.
 *
 * This hook takes over: rows hold until they first intersect the viewport, then
 * cascade in the order they appear. It only engages once the observer is actually
 * constructed — see {@link useStaggerReveal} for why that ordering matters.
 */
import { useEffect } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** Step between rows within one reveal batch, mirroring the CSS stagger. */
const STEP_MS = 24;

/** Cap on the cascade — past this a stagger reads as lag rather than life. */
const MAX_STEPS = 8;

/**
 * Hold `.rise-in-stagger` children until they scroll into view, then cascade them.
 *
 * Attach the returned ref's element as the stagger container. Children are revealed
 * once and never re-animated, so scrolling back up doesn't replay the list.
 *
 * **Failure is safe by construction.** The container is only marked
 * `data-stagger-reveal="on"` — the attribute the CSS keys its hold on — *after* the
 * `IntersectionObserver` exists. If the API is missing, the effect never runs, or
 * the user prefers reduced motion, the attribute is absent and rows fall back to
 * the plain on-mount CSS stagger. There is no path where a row is left invisible.
 *
 * @param containerRef - Ref to the element carrying `.rise-in-stagger`.
 * @param enabled - Set false to leave the CSS stagger in charge. Defaults to true.
 *
 * @example
 * ```tsx
 * const listRef = useRef<HTMLDivElement>(null);
 * useStaggerReveal(listRef);
 * return <div ref={listRef} className="space-y-3 rise-in-stagger">{rows}</div>;
 * ```
 */
export function useStaggerReveal(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled = true,
): void {
  const reduced = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled || reduced) return;
    if (typeof IntersectionObserver !== 'function') return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Everything that crossed in this callback is one batch; cascade it in DOM
        // order rather than observer-callback order, which is not guaranteed.
        const arrived = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement)
          .sort((a, b) =>
            a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
          );

        arrived.forEach((el, index) => {
          el.style.setProperty('--reveal-delay', `${Math.min(index, MAX_STEPS) * STEP_MS}ms`);
          el.setAttribute('data-revealed', '');
          observer.unobserve(el);
        });
      },
      // Fire a little before the row's top edge clears the fold, so the entrance
      // is finishing as the row settles rather than starting after it has landed.
      { rootMargin: '0px 0px 12% 0px' },
    );

    const observeChildren = () => {
      for (const child of Array.from(container.children)) {
        if (!child.hasAttribute('data-revealed')) observer.observe(child);
      }
    };

    // Only now is the hold safe to apply — the observer that releases it exists.
    container.setAttribute('data-stagger-reveal', 'on');
    observeChildren();

    // Lists page in (50 rows at a time) and re-filter in place, so the child set
    // changes without this effect re-running.
    const mutations =
      typeof MutationObserver === 'function' ? new MutationObserver(observeChildren) : null;
    mutations?.observe(container, { childList: true });

    return () => {
      observer.disconnect();
      mutations?.disconnect();
      container.removeAttribute('data-stagger-reveal');
    };
  }, [containerRef, enabled, reduced]);
}
