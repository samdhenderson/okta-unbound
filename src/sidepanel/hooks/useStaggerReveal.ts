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

/** Preferred step between rows, mirroring the CSS stagger, when the batch affords it. */
const STEP_MS = 24;

/**
 * Longest a whole cascade may run, hand-kept in sync with `--dur-travel` (320ms)
 * in `tailwind.css` — the same mirrored-constant arrangement `Modal`'s `EXIT_MS`
 * and `useCountUp`'s duration use, since jsdom never parses the stylesheet and a
 * custom property cannot be read back at runtime.
 *
 * The budget is on the *total*, not on a row count. A fixed step cap (say, eight
 * rows) is really a guess about how many rows fit on screen, and that guess is
 * wrong on any display it wasn't tuned for: a 900px-tall panel shows about nine
 * rows, a large high-resolution monitor shows several times that, and every row
 * past the cap would share one delay and pop together — the exact thing the
 * cascade exists to avoid. Budgeting the total instead lets the step shrink as
 * the batch grows, so every row still arrives in sequence and the last one lands
 * at a predictable moment regardless of viewport size.
 */
const CASCADE_BUDGET_MS = 320;

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

        // Spend the preferred step when the batch is small enough to afford it,
        // and compress it when the viewport is tall enough to reveal many rows at
        // once, so the cascade always finishes inside the budget.
        const gaps = Math.max(arrived.length - 1, 1);
        const step = Math.min(STEP_MS, CASCADE_BUDGET_MS / gaps);

        arrived.forEach((el, index) => {
          el.style.setProperty('--reveal-delay', `${Math.round(index * step)}ms`);
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
