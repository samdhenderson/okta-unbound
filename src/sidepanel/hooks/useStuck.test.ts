/**
 * Tests for useStuck.
 *
 * jsdom has no `IntersectionObserver` and no layout, so the observer is stubbed and its
 * callback driven by hand. The behaviours worth pinning are the ones a reader cannot see
 * from the CSS: that the sentinel is observed against the sticky element's *own* resolved
 * offset, and that a hidden tab reports "not pinned" rather than inheriting a stale `true`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStuck } from './useStuck';

type Entry = { isIntersecting: boolean };
type Callback = (entries: Entry[]) => void;

interface Armed {
  callback: Callback;
  rootMargin?: string;
}

let armed: Armed[] = [];
const originalIntersectionObserver = globalThis.IntersectionObserver;

/** A sticky element whose resolved `top` offset is `offset` px. */
const makeSticky = (offset: number): HTMLElement => {
  const node = document.createElement('div');
  node.style.position = 'sticky';
  node.style.top = `${offset}px`;
  return node;
};

beforeEach(() => {
  armed = [];
  globalThis.IntersectionObserver = class {
    constructor(callback: Callback, options?: { rootMargin?: string }) {
      armed.push({ callback, rootMargin: options?.rootMargin });
    }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  globalThis.IntersectionObserver = originalIntersectionObserver;
  document.body.innerHTML = '';
});

describe('useStuck', () => {
  const setup = (offset = 44, enabled = true) => {
    const sentinel = document.createElement('div');
    const sticky = makeSticky(offset);
    document.body.append(sentinel, sticky);
    return {
      sentinel,
      sticky,
      ...renderHook(() => useStuck({ current: sentinel }, { current: sticky }, enabled)),
    };
  };

  it('starts unpinned', () => {
    const { result } = setup();

    expect(result.current).toBe(false);
  });

  it('reports pinned once the sentinel stops intersecting', () => {
    const { result } = setup();

    act(() => armed[0].callback([{ isIntersecting: false }]));

    expect(result.current).toBe(true);
  });

  it('reports unpinned again when the sentinel comes back', () => {
    const { result } = setup();

    act(() => armed[0].callback([{ isIntersecting: false }]));
    act(() => armed[0].callback([{ isIntersecting: true }]));

    expect(result.current).toBe(false);
  });

  it("shifts the observer's top edge onto the sticky element's own offset", () => {
    // Read from the element rather than passed in, so a header that parks below the tab
    // header via `top: var(--header-h)` works without this hook knowing the header exists.
    setup(44);

    expect(armed[0].rootMargin).toBe('-44px 0px 0px 0px');
  });

  it('falls back to no offset when the element is not sticky', () => {
    const sentinel = document.createElement('div');
    const sticky = document.createElement('div');
    document.body.append(sentinel, sticky);

    renderHook(() => useStuck({ current: sentinel }, { current: sticky }));

    expect(armed[0].rootMargin).toBe('-0px 0px 0px 0px');
  });

  it('observes nothing while disabled', () => {
    // A hidden panel is `display: none`, so its sentinel never intersects — left observing,
    // it would report a permanently pinned header (ADR-0018).
    const { result } = setup(44, false);

    expect(armed).toHaveLength(0);
    expect(result.current).toBe(false);
  });

  it('no-ops where IntersectionObserver is unavailable rather than throwing', () => {
    // @ts-expect-error — deliberately removing the API the hook guards on.
    delete globalThis.IntersectionObserver;

    const { result } = setup();

    expect(result.current).toBe(false);
  });
});
