/**
 * Tests for useIsNarrow — the side-panel width breakpoint hook.
 *
 * Pins the three things the activity bar relies on: an initial read of the panel
 * width, a live update when the panel is dragged across the breakpoint, and
 * listener cleanup on unmount.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsNarrow } from './useIsNarrow';

/** Set the jsdom panel width (innerWidth is redefinable with configurable: true). */
function setWidth(px: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px });
}

describe('useIsNarrow', () => {
  it('returns true when the panel is narrower than the breakpoint', () => {
    setWidth(400);
    const { result } = renderHook(() => useIsNarrow(640));
    expect(result.current).toBe(true);
  });

  it('returns false when the panel is at or above the breakpoint', () => {
    setWidth(900);
    const { result } = renderHook(() => useIsNarrow(640));
    expect(result.current).toBe(false);
  });

  it('updates when the panel is resized across the breakpoint', () => {
    setWidth(900);
    const { result } = renderHook(() => useIsNarrow(640));
    expect(result.current).toBe(false);

    act(() => {
      setWidth(400);
      window.dispatchEvent(new window.Event('resize'));
    });
    expect(result.current).toBe(true);

    act(() => {
      setWidth(1000);
      window.dispatchEvent(new window.Event('resize'));
    });
    expect(result.current).toBe(false);
  });

  it('removes its resize listener on unmount', () => {
    setWidth(900);
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useIsNarrow(640));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});
