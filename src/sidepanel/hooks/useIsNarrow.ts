/**
 * @module sidepanel/hooks/useIsNarrow
 * @description Tracks whether the side-panel viewport is narrower than a breakpoint.
 *
 * The extension lives in a Chrome side panel whose width the user drags freely —
 * roomy on a large monitor, cramped on a laptop. Components that need to adapt
 * their layout (e.g. condensing the {@link useActivityBar} activity bar) read this
 * to know when the panel is too narrow for their full presentation. Backed by a
 * `resize` listener on the panel window, so it re-renders as the panel is dragged.
 */
import { useState, useEffect } from 'react';

/** True when the current panel width is below `maxWidthPx`. */
function isBelow(maxWidthPx: number): boolean {
  return typeof window !== 'undefined' && window.innerWidth < maxWidthPx;
}

/**
 * Subscribe to whether the side-panel viewport is narrower than `maxWidthPx`.
 *
 * @param maxWidthPx - The width breakpoint, in CSS pixels. Returns `true` while
 * the panel is strictly narrower than this.
 * @returns `true` when the panel is narrow, `false` otherwise. Updates live as
 * the panel is resized.
 */
export function useIsNarrow(maxWidthPx: number): boolean {
  const [narrow, setNarrow] = useState(() => isBelow(maxWidthPx));

  useEffect(() => {
    const update = () => setNarrow(isBelow(maxWidthPx));
    // Sync once in case the width changed between the initial render and mount.
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [maxWidthPx]);

  return narrow;
}
