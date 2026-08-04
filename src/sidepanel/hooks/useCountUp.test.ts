/**
 * Tests for useCountUp — the stat-card "count to" interpolator.
 *
 * Two shapes are exercised. First the **instant** path, which is what jsdom gets for
 * free (no stylesheet, so the `--dur-tell` capability probe finds nothing) and what
 * every other unit test in the repo therefore relies on: the hook must yield the
 * final number in the same render the target changes, not one commit later. Then the
 * **animated** path, enabled by declaring the token on `document.documentElement`
 * and driven by a hand-pumped `requestAnimationFrame`, to pin that the count starts
 * at zero, moves monotonically, lands exactly on the target, and — the rule that
 * keeps the Overview from looking like a slot machine — does not restart when the
 * component re-renders with an unchanged target.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCountUp } from './useCountUp';

/** rAF callbacks queued by the hook, drained manually by {@link advance}. */
let frames: FrameRequestCallback[] = [];
let now = 0;

/** Replace rAF/`performance.now` with a hand-pumped clock. */
function installFrameClock() {
  frames = [];
  now = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockImplementation(() => now);
}

/** Run every queued frame at `now + ms`. */
function advance(ms: number) {
  now += ms;
  const queued = frames;
  frames = [];
  act(() => {
    queued.forEach((cb) => cb(now));
  });
}

/**
 * Declare `--dur-tell`, which is the hook's probe for "the motion scale is loaded".
 * jsdom parses no stylesheet, so without this the hook stays on its instant path.
 */
function enableMotionScale() {
  document.documentElement.style.setProperty('--dur-tell', '500ms');
}

describe('useCountUp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty('--dur-tell');
    document.body.innerHTML = '';
  });

  describe('instant path', () => {
    it('returns the target on the first render when the motion scale is absent', () => {
      const { result } = renderHook(() => useCountUp(1250));
      expect(result.current).toBe(1250);
    });

    it('tracks a changed target in the same render, not a commit later', () => {
      const { result, rerender } = renderHook(({ n }) => useCountUp(n), {
        initialProps: { n: 3 },
      });
      expect(result.current).toBe(3);

      rerender({ n: 9 });
      expect(result.current).toBe(9);
    });

    it('stays instant when disabled even though the motion scale is loaded', () => {
      installFrameClock();
      enableMotionScale();

      const { result } = renderHook(() => useCountUp(42, { enabled: false }));

      expect(result.current).toBe(42);
      expect(frames).toHaveLength(0);
    });

    it('stays instant when an ancestor has opted out with data-motion="off"', () => {
      installFrameClock();
      enableMotionScale();
      document.body.innerHTML = '<div data-motion="off"></div>';

      const { result } = renderHook(() => useCountUp(42));

      expect(result.current).toBe(42);
      expect(frames).toHaveLength(0);
    });
  });

  describe('animated path', () => {
    beforeEach(() => {
      installFrameClock();
      enableMotionScale();
    });

    it('starts at zero and lands exactly on the target', () => {
      const { result } = renderHook(() => useCountUp(100));
      expect(result.current).toBe(0);

      advance(250);
      expect(result.current).toBeGreaterThan(0);
      expect(result.current).toBeLessThan(100);

      advance(250);
      expect(result.current).toBe(100);
    });

    it('counts monotonically upwards', () => {
      const { result } = renderHook(() => useCountUp(1000));
      const seen: number[] = [result.current];

      for (let i = 0; i < 5; i += 1) {
        advance(100);
        seen.push(result.current);
      }

      expect(seen[0]).toBe(0);
      expect(seen[seen.length - 1]).toBe(1000);
      seen.forEach((value, i) => {
        if (i > 0) expect(value).toBeGreaterThanOrEqual(seen[i - 1]);
      });
    });

    it('does not restart when re-rendered with an unchanged target', () => {
      const { result, rerender } = renderHook(({ n }) => useCountUp(n), {
        initialProps: { n: 100 },
      });

      advance(500);
      expect(result.current).toBe(100);

      rerender({ n: 100 });
      expect(result.current).toBe(100);
      expect(frames).toHaveLength(0);
    });

    it('animates from the value on screen when the target changes mid-flight', () => {
      const { result, rerender } = renderHook(({ n }) => useCountUp(n), {
        initialProps: { n: 100 },
      });

      advance(500);
      expect(result.current).toBe(100);

      act(() => {
        rerender({ n: 200 });
      });
      // Still showing the old number until the next frame — never a jump back to 0.
      expect(result.current).toBe(100);

      advance(500);
      expect(result.current).toBe(200);
    });

    it('stops animating and cancels its frame on unmount', () => {
      const cancel = vi.fn();
      vi.stubGlobal('cancelAnimationFrame', cancel);

      const { unmount } = renderHook(() => useCountUp(100));
      unmount();

      expect(cancel).toHaveBeenCalled();
    });
  });
});
