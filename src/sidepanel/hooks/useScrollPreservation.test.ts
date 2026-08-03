import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { useScrollPreservation } from './useScrollPreservation';

/** A stand-in scroll box whose `scrollTop` is readable/writable without layout. */
function scrollBox(scrollTop = 0): HTMLElement {
  const node = document.createElement('div');
  Object.defineProperty(node, 'scrollTop', { value: scrollTop, writable: true });
  return node;
}

describe('useScrollPreservation', () => {
  it('restores the captured offset when the container becomes visible again', () => {
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = scrollBox(420);

    const { result, rerender } = renderHook(({ visible }) => useScrollPreservation(ref, visible), {
      initialProps: { visible: true },
    });

    // Capture happens in the push handler, BEFORE the hide commits.
    act(() => result.current());
    ref.current!.scrollTop = 0; // what `display: none` does to the scroll box

    rerender({ visible: false });
    rerender({ visible: true });

    expect(ref.current!.scrollTop).toBe(420);
  });

  it('does not touch scrollTop while the container stays visible', () => {
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = scrollBox(0);

    const { result, rerender } = renderHook(({ visible }) => useScrollPreservation(ref, visible), {
      initialProps: { visible: true },
    });

    act(() => result.current());
    ref.current!.scrollTop = 900;
    rerender({ visible: true });

    expect(ref.current!.scrollTop).toBe(900);
  });

  it('keeps the previously captured offset when capture runs with no node', () => {
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = scrollBox(120);

    const { result, rerender } = renderHook(({ visible }) => useScrollPreservation(ref, visible), {
      initialProps: { visible: true },
    });

    act(() => result.current());
    const node = ref.current!;
    (ref as { current: HTMLElement | null }).current = null;
    act(() => result.current()); // no node — must not zero the banked value

    rerender({ visible: false });
    (ref as { current: HTMLElement | null }).current = node;
    node.scrollTop = 0;
    rerender({ visible: true });

    expect(node.scrollTop).toBe(120);
  });

  it('restores a scrolled offset that capture() was never called for', () => {
    // The tab-level hide: App hides the whole tab, so the consumer has no push
    // handler to call capture() from. The passive scroll mirror covers it.
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = scrollBox(0);

    const { rerender } = renderHook(({ visible }) => useScrollPreservation(ref, visible), {
      initialProps: { visible: true },
    });

    ref.current!.scrollTop = 640;
    act(() => {
      ref.current!.dispatchEvent(new Event('scroll'));
    });

    ref.current!.scrollTop = 0; // what `display: none` does to the scroll box
    rerender({ visible: false });
    rerender({ visible: true });

    expect(ref.current!.scrollTop).toBe(640);
  });

  it('stops mirroring scroll once hidden, so a reset to zero is not banked', () => {
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = scrollBox(0);

    const { rerender } = renderHook(({ visible }) => useScrollPreservation(ref, visible), {
      initialProps: { visible: true },
    });

    ref.current!.scrollTop = 200;
    act(() => {
      ref.current!.dispatchEvent(new Event('scroll'));
    });

    rerender({ visible: false });
    // A late scroll event for the destroyed box must not overwrite the offset.
    ref.current!.scrollTop = 0;
    act(() => {
      ref.current!.dispatchEvent(new Event('scroll'));
    });
    rerender({ visible: true });

    expect(ref.current!.scrollTop).toBe(200);
  });

  it('restores again on a second hide/show cycle with a fresh capture', () => {
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = scrollBox(50);

    const { result, rerender } = renderHook(({ visible }) => useScrollPreservation(ref, visible), {
      initialProps: { visible: true },
    });

    act(() => result.current());
    rerender({ visible: false });
    rerender({ visible: true });
    expect(ref.current!.scrollTop).toBe(50);

    ref.current!.scrollTop = 310;
    act(() => result.current());
    ref.current!.scrollTop = 0;
    rerender({ visible: false });
    rerender({ visible: true });

    expect(ref.current!.scrollTop).toBe(310);
  });
});
