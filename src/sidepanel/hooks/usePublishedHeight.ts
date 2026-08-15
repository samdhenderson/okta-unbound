/**
 * @module sidepanel/hooks/usePublishedHeight
 * @description Publish an element's measured height as a CSS custom property on an ancestor.
 *
 * The mechanism behind the side panel's sticky stack (ADR-0032). Three bands compete for
 * the top of the one shared scroller — the tab rail, the page header, and a detail view's
 * action strip — and each has to sit exactly below the one before it. Rather than hard-code
 * an offset (the "magic number" ADR-0030 declined to introduce), each band measures itself
 * and publishes its height; the band below consumes that variable in its own `top`.
 *
 * One owner per variable, and the value is always measured, so it cannot drift when a
 * band's padding, font size or wrapping changes.
 *
 * ## Why the scope matters
 *
 * Every tab stays mounted (ADR-0018), so all seven page headers exist at once. A header
 * publishing to a shared root would be overwritten by whichever *hidden* tab measured
 * last. `scopeSelector` therefore lets a per-tab band publish to its own `TabPanel`, where
 * only its own tab's action strip can read it. Singletons like the rail pass no selector
 * and publish to the document root.
 */
import { useEffect, type RefObject } from 'react';

/** Options for {@link usePublishedHeight}. */
export interface UsePublishedHeightOptions {
  /**
   * CSS selector for the ancestor to publish onto, e.g. `'[data-header-scope]'`. Omit to
   * publish on the document root, which is correct only for a band there is exactly one of.
   */
  scopeSelector?: string;
  /**
   * Whether to measure at all. Defaults to `true`. Pass the tab's `isActive` (or a feature
   * flag) to keep a hidden panel from attaching an observer it cannot usefully feed.
   */
  enabled?: boolean;
}

/**
 * Measure `ref`'s height and keep `variable` in sync with it on an ancestor element.
 *
 * The property is removed on cleanup, so a band that unmounts does not leave a stale
 * offset behind for the band below.
 *
 * @param ref - The element to measure.
 * @param variable - Custom property name to write, including the leading `--`.
 * @param options - See {@link UsePublishedHeightOptions}.
 *
 * @example
 * ```tsx
 * const railRef = useRef<HTMLElement>(null);
 * usePublishedHeight(railRef, '--rail-h');            // singleton: document root
 * usePublishedHeight(headerRef, '--header-h', { scopeSelector: '[data-header-scope]' });
 * ```
 */
export function usePublishedHeight(
  ref: RefObject<HTMLElement | null>,
  variable: string,
  options: UsePublishedHeightOptions = {},
): void {
  const { scopeSelector, enabled = true } = options;

  useEffect(() => {
    const node = ref.current;
    // jsdom has no ResizeObserver, and a disabled band should cost nothing. In both cases
    // the variable simply stays unset and every consumer falls back to its own default.
    if (!node || !enabled || typeof ResizeObserver !== 'function') return;

    const scope = scopeSelector
      ? (node.closest(scopeSelector) as HTMLElement | null)
      : document.documentElement;
    if (!scope) return;

    const publish = () => {
      scope.style.setProperty(variable, `${Math.round(node.getBoundingClientRect().height)}px`);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);

    return () => {
      observer.disconnect();
      scope.style.removeProperty(variable);
    };
  }, [ref, variable, scopeSelector, enabled]);
}
