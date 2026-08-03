/**
 * @module sidepanel/hooks/useScrollPreservation
 * @description Carries a scroll container's `scrollTop` across a hide/show cycle.
 *
 * The companion to {@link sidepanel/hooks/useViewStack.useViewStack}. A tab that
 * pushes a detail view keeps its list **mounted and hidden** so every `useState`
 * inside it survives — but hiding with `display: none` destroys the scroll box, so
 * the container's `scrollTop` reads `0` for as long as it is hidden and comes back
 * at the top when it is shown again. React state is preserved; DOM scroll state is
 * not.
 *
 * So scroll has to be captured **before** the hide commits — a layout effect keyed
 * on the visibility flag is already too late, because by the time it runs the node
 * is `display: none` and reads `0`. This hook therefore hands back a `capture()`
 * the consumer calls in its push handler, and restores in a layout effect when the
 * container becomes visible again (before paint, so there is no visible jump).
 *
 * Not every hide is initiated by the consumer, though: {@link sidepanel/App} hides
 * a whole tab when another one is selected, and the tab has no `capture()` call
 * site for that. So while the container is visible the hook also mirrors its
 * `scrollTop` on every `scroll` event (passive listener), which keeps the saved
 * offset current no matter who hides it. `capture()` remains the exact-moment
 * escape hatch and still wins for offsets no scroll event ever reported.
 *
 * ```tsx
 * const listScrollRef = useRef<HTMLDivElement>(null);
 * const captureListScroll = useScrollPreservation(listScrollRef, nav.isRoot);
 *
 * const openDetail = (group: GroupSummary) => {
 *   captureListScroll(); // BEFORE the state update that hides the list
 *   nav.push(group);
 * };
 * ```
 */

import { useCallback, useLayoutEffect, useRef } from 'react';
import type React from 'react';

/**
 * Preserve a scroll container's offset across a hide/show cycle.
 *
 * @param scrollRef - Ref on the scrolling element, owned by the consumer. Passed
 * **in** rather than returned so consumers can read the hook's result during
 * render without tripping React Compiler's `react-hooks/refs` rule.
 * @param visible - Whether the container is currently shown. Restoration runs on
 * every `false` → `true` transition, and the passive `scroll` mirror is attached
 * only while it is `true`.
 * @returns `capture()` — records the current `scrollTop`. Call it immediately
 * before the state update that hides the container; it is a no-op when the ref is
 * unset, leaving the previously captured offset intact.
 */
export function useScrollPreservation(
  scrollRef: React.RefObject<HTMLElement | null>,
  visible: boolean,
): () => void {
  const savedTop = useRef(0);
  const wasVisible = useRef(visible);

  const capture = useCallback(() => {
    const node = scrollRef.current;
    if (node) savedTop.current = node.scrollTop;
  }, [scrollRef]);

  useLayoutEffect(() => {
    const becameVisible = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!becameVisible) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = savedTop.current;
  }, [visible, scrollRef]);

  // Keep the saved offset current for hides the consumer does not initiate (a
  // top-level tab switch). Detached the moment the container is hidden, which the
  // commit does before any `scroll` event for the destroyed box could be
  // dispatched — so a reset-to-zero can never be mirrored over a real offset.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!visible || !node) return;
    const onScroll = () => {
      savedTop.current = node.scrollTop;
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [visible, scrollRef]);

  return capture;
}
