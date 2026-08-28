/**
 * @module sidepanel/hooks/useTabRail.test
 * @description Unit tests for the icon rail's overflow-affordance hook.
 *
 * Pins the five things the rail's usability depends on: the discrete edge state
 * (so a scroll costs a comparison, not a style write), the measured indicator
 * geometry, the `block: 'nearest'` scroll-into-view contract that keeps the app's
 * shared root scroller still (ADR-0018), the rAF throttle that keeps the
 * `ResizeObserver` out of a feedback loop, and the `sliding` window that separates
 * the underline's slide from the label unfurl so neither chases the other.
 *
 * jsdom implements neither layout nor `ResizeObserver`, so the element metrics are
 * defined explicitly and the observer is a controllable fake — which is also the
 * only way to drive the throttle deterministically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTabRail, type TabRailEdge } from './useTabRail';

/** A fake `ResizeObserver` whose callbacks the tests fire by hand. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  targets: HTMLElement[] = [];
  disconnected = false;

  constructor(private readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: HTMLElement) {
    this.targets.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  /** Simulate the browser delivering a resize notification. */
  fire() {
    this.callback();
  }
}

/** Metrics for a fabricated tab strip; jsdom reports `0` for all of them. */
interface StripMetrics {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
  activeLeft: number;
  activeWidth: number;
}

/** Number of times the strip's `scrollWidth` has been read (a measure counter). */
let scrollWidthReads = 0;

/**
 * Build a detached tab strip: two `role="tab"` buttons, the second selected, with
 * layout metrics the hook can actually read.
 */
function makeStrip(metrics: Partial<StripMetrics> = {}) {
  const {
    scrollWidth = 0,
    clientWidth = 0,
    scrollLeft = 0,
    activeLeft = 0,
    activeWidth = 0,
  } = metrics;

  const list = document.createElement('div');
  list.setAttribute('role', 'tablist');

  const inactive = document.createElement('button');
  inactive.setAttribute('role', 'tab');
  inactive.setAttribute('aria-selected', 'false');

  const active = document.createElement('button');
  active.setAttribute('role', 'tab');
  active.setAttribute('aria-selected', 'true');
  active.scrollIntoView = vi.fn();

  list.append(inactive, active);
  document.body.append(list);

  Object.defineProperty(list, 'scrollWidth', {
    configurable: true,
    get: () => {
      scrollWidthReads += 1;
      return scrollWidth;
    },
  });
  Object.defineProperty(list, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(list, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: scrollLeft,
  });
  Object.defineProperty(active, 'offsetLeft', { configurable: true, value: activeLeft });
  Object.defineProperty(active, 'offsetWidth', { configurable: true, value: activeWidth });

  return { list, active, inactive };
}

/** Render the hook against a strip, with sensible defaults for the other options. */
function renderRail(list: HTMLElement | null, options: { reducedMotion?: boolean } = {}) {
  return renderHook(
    ({ activeKey }: { activeKey: string }) =>
      useTabRail({
        listRef: { current: list },
        activeKey,
        tabCount: 2,
        reducedMotion: options.reducedMotion ?? false,
      }),
    { initialProps: { activeKey: 'groups' } },
  );
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  scrollWidthReads = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('useTabRail', () => {
  it('stays inert when the strip ref is unset (the non-rail variants)', () => {
    const { result } = renderRail(null);
    expect(result.current.edge).toBe('none');
    expect(result.current.indicator).toEqual({ left: 0, width: 0 });
    expect(FakeResizeObserver.instances).toHaveLength(0);
  });

  it('reports no edge fade when every tab fits', () => {
    const { list } = makeStrip({ scrollWidth: 300, clientWidth: 300 });
    const { result } = renderRail(list);
    expect(result.current.edge).toBe('none');
  });

  it.each<[string, number, TabRailEdge]>([
    ['fades the end when parked at the start', 0, 'end'],
    ['fades both sides mid-scroll', 60, 'both'],
    ['fades the start when parked at the end', 140, 'start'],
  ])('%s', (_name, scrollLeft, expected) => {
    const { list } = makeStrip({ scrollWidth: 500, clientWidth: 360, scrollLeft });
    const { result } = renderRail(list);
    expect(result.current.edge).toBe(expected);
  });

  it('re-reads the edge on scroll and only re-renders on a boundary crossing', () => {
    const { list } = makeStrip({ scrollWidth: 500, clientWidth: 360, scrollLeft: 0 });
    const { result } = renderRail(list);
    expect(result.current.edge).toBe('end');

    act(() => {
      Object.defineProperty(list, 'scrollLeft', { configurable: true, value: 70 });
      list.dispatchEvent(new window.Event('scroll'));
    });
    expect(result.current.edge).toBe('both');

    const before = result.current.edge;
    act(() => {
      Object.defineProperty(list, 'scrollLeft', { configurable: true, value: 80 });
      list.dispatchEvent(new window.Event('scroll'));
    });
    // Same discrete state, same object identity — no state churn.
    expect(result.current.edge).toBe(before);
  });

  it('measures the active tab into the indicator geometry', () => {
    const { list } = makeStrip({ activeLeft: 128, activeWidth: 96 });
    const { result } = renderRail(list);
    expect(result.current.indicator).toEqual({ left: 128, width: 96 });
  });

  it('scrolls the active tab into view without disturbing the vertical scroller', () => {
    const { list, active } = makeStrip();
    renderRail(list);
    expect(active.scrollIntoView).toHaveBeenCalledWith({
      inline: 'nearest',
      block: 'nearest',
      behavior: 'smooth',
    });
  });

  it('jumps instead of animating when reduced motion is requested', () => {
    const { list, active } = makeStrip();
    renderRail(list, { reducedMotion: true });
    expect(active.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' }),
    );
  });

  it('re-scrolls when the active tab changes', () => {
    const { list, active } = makeStrip();
    const { rerender } = renderRail(list);
    expect(active.scrollIntoView).toHaveBeenCalledTimes(1);
    act(() => rerender({ activeKey: 'export' }));
    expect(active.scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('observes both the strip and the active tab', () => {
    const { list, active } = makeStrip();
    renderRail(list);
    const observer = FakeResizeObserver.instances[0];
    expect(observer?.targets).toEqual([list, active]);
  });

  it('coalesces a burst of resize notifications into one measurement per frame', async () => {
    const { list } = makeStrip({ scrollWidth: 500, clientWidth: 360 });
    renderRail(list);
    const observer = FakeResizeObserver.instances[0];
    const afterMount = scrollWidthReads;

    // Three synchronous notifications — the shape that, unthrottled, produces
    // "ResizeObserver loop completed with undelivered notifications".
    act(() => {
      observer?.fire();
      observer?.fire();
      observer?.fire();
    });
    expect(scrollWidthReads).toBe(afterMount);

    await waitFor(() => expect(scrollWidthReads).toBe(afterMount + 1));
  });

  describe('the slide/unfurl sequence', () => {
    it('never claims to be sliding on the first render', () => {
      const { list } = makeStrip();
      const { result } = renderRail(list);
      expect(result.current.sliding).toBe(false);
    });

    it('slides for one --dur-move window after a selection change, then stops', () => {
      vi.useFakeTimers();
      try {
        const { list } = makeStrip();
        const { result, rerender } = renderRail(list);

        act(() => rerender({ activeKey: 'export' }));
        // Phase 1: the labels are held still by their delay, the underline travels.
        expect(result.current.sliding).toBe(true);

        act(() => {
          vi.advanceTimersByTime(220);
        });
        // Phase 2: the labels move and the indicator goes back to being measured.
        expect(result.current.sliding).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('never slides under reduced motion — there is nothing to sequence', () => {
      const { list } = makeStrip();
      const { result, rerender } = renderRail(list, { reducedMotion: true });
      act(() => rerender({ activeKey: 'export' }));
      expect(result.current.sliding).toBe(false);
    });
  });

  it('detaches the scroll listener and the observer on unmount', () => {
    const { list } = makeStrip();
    const removeSpy = vi.spyOn(list, 'removeEventListener');
    const { unmount } = renderRail(list);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
  });
});
