/**
 * @module sidepanel/hooks/useTabRail
 * @description Overflow affordances for the icon-rail tab strip: edge state,
 * scroll-active-into-view, and the sliding active indicator's geometry.
 *
 * The side panel's eight top-level tabs cannot all fit as text at 360px, so the
 * `rail` variant of the shared `Tabs` strip shows inactive tabs as icons and
 * unfurls only the active label. Even that can overflow, so the strip stays
 * horizontally scrollable — and a scrollable strip with no visible scrollbar
 * needs three things this hook supplies, all of them measurement, none of them
 * markup:
 *
 * 1. **A discrete edge state** (`'none' | 'start' | 'end' | 'both'`) naming which
 *    sides have content scrolled out of view. It is rendered as a `data-overflow`
 *    attribute and styled with a mask class, so a scroll event costs a state
 *    comparison and (only on a boundary crossing) one re-render — never a
 *    per-frame style write.
 * 2. **Scroll-active-into-view**, using `block: 'nearest'` so the panel's single
 *    shared root scroller (`App.tsx`) is never yanked vertically; `TabPanel`
 *    would bank that offset as the active tab's own (ADR-0018). The `behavior`
 *    honours `prefers-reduced-motion` via a JS flag, because the CSS
 *    `scroll-behavior: auto !important` override cannot suppress a JS option.
 * 3. **The active indicator's `left`/`width`**, measured rather than transitioned.
 *    The active label is simultaneously growing from `0fr` to `1fr` over
 *    `--dur-move`; an indicator with its own CSS transition would chase a moving
 *    target and land out of sync. Measuring it every frame of the buttons' own
 *    reflow makes the slide fall out of the layout for free.
 *
 * Measurement is driven by one `ResizeObserver` (over the strip and the active
 * button) whose callback is **rAF-throttled**. That throttle is load-bearing, not
 * stylistic: an observer that writes layout-affecting values synchronously from
 * its own callback produces `ResizeObserver loop completed with undelivered
 * notifications`, which the Storybook browser runner reports as an unhandled
 * error and fails the story on.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';

/**
 * Which sides of the tab strip currently have content scrolled out of view, and
 * therefore want an edge fade: `'start'` (content hidden to the left), `'end'`
 * (hidden to the right), `'both'`, or `'none'` when everything fits.
 */
export type TabRailEdge = 'none' | 'start' | 'end' | 'both';

/** Geometry of the sliding active-tab indicator, in pixels. */
export interface TabRailIndicator {
  /** Offset of the active tab's left edge from the strip's padding box. */
  left: number;
  /** Width of the active tab. `0` before the first measurement. */
  width: number;
}

/** Options for {@link useTabRail}. */
export interface UseTabRailOptions {
  /**
   * Ref on the scrolling tab strip. A `null` ref disables every effect, which is
   * how the non-rail `Tabs` variants opt out without a conditional hook call.
   */
  listRef: React.RefObject<HTMLElement | null>;
  /** Key of the active tab. Changing it re-measures and scrolls it into view. */
  activeKey: string;
  /** Number of tabs; re-measures when the tab set itself changes shape. */
  tabCount: number;
  /**
   * When `true`, scroll-into-view jumps instead of animating. Pass the value of
   * {@link sidepanel/hooks/useReducedMotion.useReducedMotion}.
   */
  reducedMotion: boolean;
}

/** What {@link useTabRail} hands back for rendering. */
export interface TabRailState {
  /** Discrete overflow state; render it as `data-overflow` on the strip. */
  edge: TabRailEdge;
  /** Geometry for the absolutely-positioned indicator inside the strip. */
  indicator: TabRailIndicator;
}

/**
 * Sub-pixel slack. Browsers report fractional `scrollWidth`/`scrollLeft`, so an
 * exact comparison can leave a strip that visually fits permanently claiming a
 * one-tenth-pixel overflow.
 */
const EPSILON = 1;

/** Classify the strip's scroll position into a discrete {@link TabRailEdge}. */
function readEdge(list: HTMLElement): TabRailEdge {
  const max = list.scrollWidth - list.clientWidth;
  if (max <= EPSILON) return 'none';
  const atStart = list.scrollLeft <= EPSILON;
  const atEnd = list.scrollLeft >= max - EPSILON;
  if (atStart) return 'end';
  if (atEnd) return 'start';
  return 'both';
}

/** Find the currently selected tab button inside the strip. */
function findActive(list: HTMLElement): HTMLElement | null {
  return list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
}

/**
 * Measure the overflow affordances for an icon-rail tab strip.
 *
 * All returned values are derived from the DOM the caller already rendered, so
 * the caller stays declarative: render `edge` as an attribute and `indicator` as
 * the indicator's `left`/`width`.
 *
 * @param options - See {@link UseTabRailOptions}.
 * @returns The current {@link TabRailState}. Both members are referentially
 * stable while their measured values are unchanged, so a scroll that does not
 * cross an edge boundary triggers no re-render.
 *
 * @example
 * ```tsx
 * const listRef = useRef<HTMLDivElement>(null);
 * const { edge, indicator } = useTabRail({
 *   listRef,
 *   activeKey,
 *   tabCount: tabs.length,
 *   reducedMotion: useReducedMotion(),
 * });
 * ```
 */
export function useTabRail({
  listRef,
  activeKey,
  tabCount,
  reducedMotion,
}: UseTabRailOptions): TabRailState {
  const [edge, setEdge] = useState<TabRailEdge>('none');
  const [indicator, setIndicator] = useState<TabRailIndicator>({ left: 0, width: 0 });
  const frameRef = useRef(0);

  // Seed synchronously before paint, then keep both values current from one
  // rAF-throttled observer plus a passive scroll listener.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      // Batched reads first, then at most two bail-out setStates — never a write
      // back into layout from inside the observer callback.
      const nextEdge = readEdge(list);
      const active = findActive(list);
      const left = active ? active.offsetLeft : 0;
      const width = active ? active.offsetWidth : 0;
      setEdge((prev) => (prev === nextEdge ? prev : nextEdge));
      setIndicator((prev) => (prev.left === left && prev.width === width ? prev : { left, width }));
    };

    measure();

    // Scroll only ever changes the edge state, and only on a boundary crossing.
    const onScroll = () => {
      const next = readEdge(list);
      setEdge((prev) => (prev === next ? prev : next));
    };
    list.addEventListener('scroll', onScroll, { passive: true });

    // rAF throttle: coalesces a burst of resize notifications into one measure
    // per frame, which is what keeps the observer out of a feedback loop while
    // the active label unfurls.
    const schedule = () => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0;
        measure();
      });
    };

    // Accessed off `window` so jsdom (which implements no `ResizeObserver` at all)
    // gets a defined-check rather than a ReferenceError.
    const observer =
      typeof window.ResizeObserver === 'undefined'
        ? null
        : new window.ResizeObserver(() => schedule());
    if (observer) {
      observer.observe(list);
      const active = findActive(list);
      if (active) observer.observe(active);
    }

    return () => {
      list.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, [listRef, activeKey, tabCount]);

  // Bring a newly selected tab into view. `block: 'nearest'` is load-bearing: the
  // strip is sticky inside the app's shared vertical scroller, and any other value
  // scrolls that ancestor, which `TabPanel` then banks as the tab's own offset
  // (ADR-0018). Optional-call guards match the repo's other call sites and cover
  // jsdom, which does not implement `scrollIntoView`.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    findActive(list)?.scrollIntoView?.({
      inline: 'nearest',
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [listRef, activeKey, reducedMotion]);

  return { edge, indicator };
}
