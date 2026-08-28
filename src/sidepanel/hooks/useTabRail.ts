/**
 * @module sidepanel/hooks/useTabRail
 * @description Overflow affordances for the icon-rail tab strip: edge state,
 * scroll-active-into-view, and the sliding active indicator's geometry.
 *
 * The side panel's nine top-level tabs cannot all fit as text at 360px, so the
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
 * 3. **The active indicator's `left`/`width`**, measured every frame — plus a
 *    `sliding` flag naming the one window in which the indicator is allowed a CSS
 *    transition of its own.
 *
 * ## The sequence (amends ADR-0028's "never transition the indicator")
 *
 * ADR-0028 left the indicator deliberately un-transitioned, and its reasoning holds
 * as far as it goes: the active label grows from `0fr` to `1fr` over `--dur-move` at
 * the same moment, so an indicator with its own transition chases a moving target
 * and lands out of sync. The resolution is not to transition it anyway — it is to
 * stop the two from ever overlapping:
 *
 * - **Phase 1, `0 → --dur-move`.** Layout is frozen: both labels hold their current
 *   state, because the unfurl/collapse transition in `Tabs` carries a `--dur-move`
 *   delay. The indicator transitions `left`/`width` on `--ease-glide` toward a
 *   target that cannot move.
 * - **Phase 2, `--dur-move → 2×--dur-move`.** The outgoing label collapses and the
 *   incoming one unfurls. The indicator has no transition at all here and is
 *   measured per frame, so it stays glued to the reflow exactly as ADR-0028
 *   intended.
 *
 * `sliding` is what draws that line — `true` for phase 1 only. Nothing chases
 * anything: the underline travels across a still strip, then the strip rearranges
 * underneath a stationary underline.
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
  /**
   * `true` for the `--dur-move` window that follows a selection change — phase 1 of
   * the sequence in this module's header. Apply the indicator's `left`/`width`
   * transition **only** while this is set: outside it the geometry is tracking a
   * live reflow, and a transition would lag behind it. Always `false` under reduced
   * motion, where there is nothing to sequence.
   */
  sliding: boolean;
}

/**
 * Length of the indicator's slide, mirroring `--dur-move` in `tailwind.css`
 * (220ms). Hardcoded for the same reason `useCountUp`'s `COUNT_UP_MS` mirrors
 * `--dur-tell`: this is a `setTimeout`, not a transition, and jsdom parses no
 * stylesheet to read the token back from. Keep the two in step by hand — if they
 * drift, phase 2 starts before or after the slide has landed.
 */
const SLIDE_MS = 220;

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
 * the caller stays declarative: render `edge` as an attribute, `indicator` as the
 * indicator's `left`/`width`, and `sliding` as whether the indicator carries its
 * transition classes this render.
 *
 * @param options - See {@link UseTabRailOptions}.
 * @returns The current {@link TabRailState}. `edge` and `indicator` are
 * referentially stable while their measured values are unchanged, so a scroll that
 * does not cross an edge boundary triggers no re-render.
 *
 * @example
 * ```tsx
 * const listRef = useRef<HTMLDivElement>(null);
 * const { edge, indicator, sliding } = useTabRail({
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
  const [sliding, setSliding] = useState(false);
  const frameRef = useRef(0);
  const lastKeyRef = useRef(activeKey);
  const scrolledKeyRef = useRef<string | null>(null);

  // Phase 1 of the sequence. Declared *before* the measuring effect below and as a
  // layout effect so the flag and the freshly measured geometry land in the same
  // pre-paint flush: a transition starts when the after-change style already carries
  // `transition-property`, so applying the class and the new `left` together is what
  // makes the slide run at all. Doing this in a passive effect would paint the
  // indicator at its new position first and animate nothing.
  //
  // Skipped on mount (`lastKeyRef` seeds to the initial key), or the indicator would
  // slide in from `left: 0, width: 0` the first time the rail renders.
  useLayoutEffect(() => {
    if (lastKeyRef.current === activeKey) return;
    lastKeyRef.current = activeKey;
    if (reducedMotion) return;
    setSliding(true);
    const timer = window.setTimeout(() => setSliding(false), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [activeKey, reducedMotion]);

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
  //
  // Guarded on the key it last scrolled for, not just on the dep list. `listRef` is
  // a prop, so its identity is the caller's to control — and an incidental re-render
  // that hands over a fresh ref object would otherwise re-scroll a tab that had not
  // moved. That is now more than a theoretical waste: `sliding` above deliberately
  // schedules an extra render on every selection change, so an unguarded effect
  // fires twice for one click.
  useEffect(() => {
    const list = listRef.current;
    if (!list || scrolledKeyRef.current === activeKey) return;
    scrolledKeyRef.current = activeKey;
    findActive(list)?.scrollIntoView?.({
      inline: 'nearest',
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [listRef, activeKey, reducedMotion]);

  return { edge, indicator, sliding };
}
