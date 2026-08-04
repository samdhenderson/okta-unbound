import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { useStaggerReveal } from './useStaggerReveal';

/** Builds a stagger container with `n` children, attached to the document. */
function makeContainer(n: number) {
  const el = document.createElement('div');
  el.className = 'rise-in-stagger';
  for (let i = 0; i < n; i++) el.appendChild(document.createElement('div'));
  document.body.appendChild(el);
  const ref = createRef<HTMLElement>();
  (ref as { current: HTMLElement | null }).current = el;
  return { el, ref };
}

/** Installs a controllable IntersectionObserver stub; returns the captured callback. */
function stubObserver() {
  const observed = new Set<Element>();
  let fire: (entries: { target: Element; isIntersecting: boolean }[]) => void = () => {};
  class IO {
    constructor(cb: (entries: unknown[]) => void) {
      fire = (entries) => cb(entries as unknown[]);
    }
    observe(el: Element) {
      observed.add(el);
    }
    unobserve(el: Element) {
      observed.delete(el);
    }
    disconnect() {
      observed.clear();
    }
  }
  vi.stubGlobal('IntersectionObserver', IO);
  return {
    observed,
    fire: (entries: { target: Element; isIntersecting: boolean }[]) => fire(entries),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('useStaggerReveal', () => {
  it('does nothing when IntersectionObserver is unavailable, so rows are never held invisible', () => {
    // jsdom has no IntersectionObserver — this is the real default in the unit suite.
    vi.stubGlobal('IntersectionObserver', undefined);
    const { el, ref } = makeContainer(3);

    renderHook(() => useStaggerReveal(ref));

    expect(el.hasAttribute('data-stagger-reveal')).toBe(false);
  });

  it('marks the container only once the observer exists', () => {
    stubObserver();
    const { el, ref } = makeContainer(3);

    renderHook(() => useStaggerReveal(ref));

    expect(el.getAttribute('data-stagger-reveal')).toBe('on');
  });

  it('observes every child that has not yet been revealed', () => {
    const { observed } = stubObserver();
    const { el, ref } = makeContainer(4);

    renderHook(() => useStaggerReveal(ref));

    expect(observed.size).toBe(4);
    expect(Array.from(observed)).toEqual(Array.from(el.children));
  });

  it('reveals intersecting rows and cascades their delay in DOM order', () => {
    const { fire } = stubObserver();
    const { el, ref } = makeContainer(3);

    renderHook(() => useStaggerReveal(ref));

    const children = Array.from(el.children) as HTMLElement[];
    // Deliberately out of DOM order — the hook must sort before assigning delays.
    fire([
      { target: children[2], isIntersecting: true },
      { target: children[0], isIntersecting: true },
      { target: children[1], isIntersecting: true },
    ]);

    expect(children.map((c) => c.hasAttribute('data-revealed'))).toEqual([true, true, true]);
    expect(children[0].style.getPropertyValue('--reveal-delay')).toBe('0ms');
    expect(children[1].style.getPropertyValue('--reveal-delay')).toBe('24ms');
    expect(children[2].style.getPropertyValue('--reveal-delay')).toBe('48ms');
  });

  it('keeps the full step when a small batch can afford it', () => {
    const { fire } = stubObserver();
    const { el, ref } = makeContainer(9);

    renderHook(() => useStaggerReveal(ref));

    const children = Array.from(el.children) as HTMLElement[];
    fire(children.map((target) => ({ target, isIntersecting: true })));

    // 8 gaps * 24ms = 192ms, comfortably inside the 320ms budget.
    expect(children[1].style.getPropertyValue('--reveal-delay')).toBe('24ms');
    expect(children[8].style.getPropertyValue('--reveal-delay')).toBe('192ms');
  });

  it('compresses the step on a tall viewport so the cascade still fits its budget', () => {
    const { fire } = stubObserver();
    // A large monitor can show far more rows at once than the ~9 a default panel
    // does. Every one must still arrive in sequence, not share one delay.
    const { el, ref } = makeContainer(40);

    renderHook(() => useStaggerReveal(ref));

    const children = Array.from(el.children) as HTMLElement[];
    fire(children.map((target) => ({ target, isIntersecting: true })));

    const delays = children.map((c) => parseFloat(c.style.getPropertyValue('--reveal-delay')));

    // Strictly increasing — no plateau where rows pop together.
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
    // And the whole cascade still lands within the budget.
    expect(delays[delays.length - 1]).toBeLessThanOrEqual(320);
  });

  it('leaves rows that have not intersected alone', () => {
    const { fire } = stubObserver();
    const { el, ref } = makeContainer(3);

    renderHook(() => useStaggerReveal(ref));

    const children = Array.from(el.children) as HTMLElement[];
    fire([
      { target: children[0], isIntersecting: true },
      { target: children[1], isIntersecting: false },
    ]);

    expect(children[0].hasAttribute('data-revealed')).toBe(true);
    expect(children[1].hasAttribute('data-revealed')).toBe(false);
  });

  it('stops observing a row once revealed, so scrolling back does not replay it', () => {
    const { observed, fire } = stubObserver();
    const { el, ref } = makeContainer(2);

    renderHook(() => useStaggerReveal(ref));
    const children = Array.from(el.children) as HTMLElement[];
    fire([{ target: children[0], isIntersecting: true }]);

    expect(observed.has(children[0])).toBe(false);
    expect(observed.has(children[1])).toBe(true);
  });

  it('does nothing when disabled', () => {
    stubObserver();
    const { el, ref } = makeContainer(3);

    renderHook(() => useStaggerReveal(ref, false));

    expect(el.hasAttribute('data-stagger-reveal')).toBe(false);
  });

  it('releases the hold on unmount', () => {
    stubObserver();
    const { el, ref } = makeContainer(3);

    const { unmount } = renderHook(() => useStaggerReveal(ref));
    expect(el.getAttribute('data-stagger-reveal')).toBe('on');

    unmount();
    expect(el.hasAttribute('data-stagger-reveal')).toBe(false);
  });
});
