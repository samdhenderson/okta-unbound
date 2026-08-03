/**
 * @module sidepanel/components/TabPanel
 * @description One top-level tab's panel: its visibility, its Suspense boundary, and
 * its scroll offset.
 *
 * A tab mounts on its first activation and is hidden — never unmounted — thereafter
 * (ADR-0018), so every panel but one is `display: none` at any moment. That keeps all
 * React state alive but **not** DOM state: hiding a scroll box destroys its
 * `scrollTop`, and here the box is not even the panel's own. Every root-scrolling tab
 * shares one scroller, the `overflow-y-auto` root in {@link sidepanel/App} — so
 * without this component, leaving a tab and coming back lands wherever the tab you
 * visited in between happened to leave that shared element.
 *
 * Each panel therefore runs its own {@link sidepanel/hooks/useScrollPreservation}
 * against the shared scroller: while it is the visible one the hook mirrors
 * `scrollTop` on a passive listener, and on the way back it writes that offset — the
 * panel's own, not its neighbour's — before paint.
 *
 * The Suspense boundary is **per panel** on purpose: a shared one would swap the
 * fallback in for every mounted tab while a newly activated lazy chunk loads, which
 * is exactly the unmount-and-lose-state problem ADR-0018 removes.
 */
import React, { Suspense, useLayoutEffect, useRef } from 'react';
import { LoadingSpinner } from './shared';
import { useScrollPreservation } from '../hooks/useScrollPreservation';

/** Props for {@link TabPanel}. */
export interface TabPanelProps {
  /** Whether this is the selected top-level tab. Drives visibility and scroll. */
  isActive: boolean;
  /**
   * Ref on the scrolling element the panel lives inside — the app root scroller,
   * shared with every other panel. Tolerates `null` (stories, tests), in which case
   * scroll preservation is simply inert.
   */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** The tab's content. Mounted once, then kept mounted. */
  children: React.ReactNode;
}

/**
 * Render one tab panel: visibility, a private Suspense boundary, and per-tab
 * preservation of the shared root scroller's offset.
 *
 * @param props - See {@link TabPanelProps}.
 * @remarks The restored offset is clamped by the browser if the tab's content is
 * shorter than it was when the offset was banked (a list that reloads, or one that
 * reveals progressively). That is the same limitation the Groups tab's own scroll
 * box has, and it degrades to "near where you were" rather than to the top.
 */
const TabPanel: React.FC<TabPanelProps> = ({ isActive, scrollRef, children }) => {
  useScrollPreservation(scrollRef, isActive);

  // A panel only ever mounts on its first activation, so it mounts already visible —
  // and `useScrollPreservation` seeds `wasVisible` from `visible`, so there is no
  // `false → true` transition to restore on. Its own saved offset is 0 at that point
  // anyway; the problem is the *shared* scroller, which still holds whatever the
  // previously active tab left there. Zero it once, on mount, so a tab's first visit
  // opens at the top instead of part-way down someone else's list.
  const didResetOnMount = useRef(false);
  useLayoutEffect(() => {
    if (didResetOnMount.current || !isActive) return;
    didResetOnMount.current = true;
    const node = scrollRef.current;
    if (node) node.scrollTop = 0;
  }, [isActive, scrollRef]);

  return (
    <div className={isActive ? 'tab-content active' : 'tab-content'} hidden={!isActive}>
      <Suspense fallback={<LoadingSpinner size="lg" message="Loading tab..." centered />}>
        {children}
      </Suspense>
    </div>
  );
};

export default TabPanel;
