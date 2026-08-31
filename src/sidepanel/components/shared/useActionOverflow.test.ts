/**
 * Tests for useActionOverflow.
 *
 * jsdom implements neither `ResizeObserver` nor layout, so both are faked: the
 * observer so the hook can arm at all and so a "resize" can be driven one report
 * at a time, and every rect/`clientWidth` the hook reads so there is a geometry
 * to measure. The DOM here mirrors `ActionBar`'s — sentinel, band, row, cluster,
 * probe — because the hook navigates it structurally (the row is the band's
 * first non-probe child, the cluster's parent is the row) and a flatter fixture
 * would not exercise that.
 *
 * What is pinned is the part that cannot be pinned by `actionBarFit.test.ts`:
 * the rules that keep a *hidden* rung from committing garbage, the loop guard,
 * which element each published variable lands on, and that the previous split is
 * threaded back in so the deadband spans successive resizes.
 *
 * Two cases were removed under ADR-0022 when the resting strip became a
 * full-width card: `--bar-content-measured` and `--dock-more-travel` no longer
 * exist to be published, so "measures the pill from the widest right edge" had no
 * subject left. Nothing they covered went uncovered — the surviving case still
 * pins that `--dock-offset` lands on the parent and `--bar-bleed` on the band,
 * which is the only part of the publishing that a reviewer cannot see is wrong.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useActionOverflow,
  type ActionOverflowRefs,
  type MeasurableAction,
} from './useActionOverflow';

type ObserverCallback = () => void;

let callbacks: ObserverCallback[] = [];
const originalResizeObserver = globalThis.ResizeObserver;

/** Install a `ResizeObserver` whose reports this file delivers by hand. */
function installObserver(): void {
  globalThis.ResizeObserver = class {
    constructor(callback: ObserverCallback) {
      callbacks.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

/** Deliver one resize report to every armed observer, inside React's batch. */
const resize = (): void => {
  act(() => {
    callbacks.forEach((callback) => callback());
  });
};

interface Rect {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

/** Give a node a layout jsdom will never compute for it. */
function setRect(node: HTMLElement, { left = 0, top = 0, width = 0, height = 24 }: Rect): void {
  node.getBoundingClientRect = () =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
    }) as DOMRect;
}

/** `clientWidth` is read-only in jsdom and is what the hook budgets from. */
function setClientWidth(node: HTMLElement, value: number): void {
  Object.defineProperty(node, 'clientWidth', { value, configurable: true });
}

const ACTIONS: readonly MeasurableAction[] = [
  { id: 'a', label: 'Add group', icon: 'plus', variant: 'primary' },
  { id: 'b', label: 'Compare', icon: 'users' },
  { id: 'c', label: 'Export', icon: 'download' },
];

/**
 * The measured world, as `ActionBar` builds it.
 *
 * Natural widths 100, compact 80, an 8px gap, 8px of row padding either side and
 * a 50px More cluster — the same numbers `actionBarFit.test.ts` uses, so the
 * expected splits can be read straight off its ladder:
 *
 * ```
 * natural  k=3 → 316   k=2 → 266   k=1 → 158
 * compact  k=3 → 256   k=2 → 226   k=1 → 138
 * ```
 */
interface Fixture {
  parent: HTMLElement;
  sentinel: HTMLDivElement;
  band: HTMLDivElement;
  row: HTMLDivElement;
  cluster: HTMLElement;
  more: HTMLButtonElement;
  probe: HTMLDivElement;
  refs: ActionOverflowRefs;
  /** Set the band's and row's widths together, as a real resize would. */
  setWidth: (width: number) => void;
  /** Re-stub every probe node's width; `0` is the hidden-rung case. */
  setProbeWidths: (full: number, compact: number, cluster?: number) => void;
}

function makeFixture(options: { width?: number; withProbe?: boolean } = {}): Fixture {
  const { width = 332, withProbe = true } = options;

  const parent = document.createElement('div');
  const sentinel = document.createElement('div');
  const band = document.createElement('div');
  const row = document.createElement('div');
  const cluster = document.createElement('span');
  const more = document.createElement('button');
  const probe = document.createElement('div');

  row.style.setProperty('column-gap', '8px');
  row.style.setProperty('padding-left', '8px');
  row.style.setProperty('padding-right', '8px');

  ACTIONS.forEach((action, index) => {
    // A span wrapper carrying the id around a real button, exactly as `ActionBar`
    // does — `Button` does not spread unknown props, so the id lives outside it.
    const wrapper = document.createElement('span');
    wrapper.dataset.actionId = action.id;
    const button = document.createElement('button');
    button.textContent = action.label;
    wrapper.appendChild(button);
    setRect(wrapper, { left: 32 + index * 108, top: 100, width: 100 });
    row.appendChild(wrapper);
  });

  cluster.appendChild(more);
  setRect(cluster, { left: 356, top: 100, width: 50 });
  row.appendChild(cluster);

  probe.append(
    ...ACTIONS.map((action) => {
      const node = document.createElement('span');
      node.dataset.actionId = action.id;
      node.dataset.measure = 'full';
      setRect(node, { width: 100 });
      return node;
    }),
    ...ACTIONS.map((action) => {
      const node = document.createElement('span');
      node.dataset.actionId = action.id;
      node.dataset.measure = 'compact';
      setRect(node, { width: 80 });
      return node;
    }),
  );
  const probeCluster = document.createElement('span');
  probeCluster.dataset.measure = 'cluster';
  setRect(probeCluster, { width: 50 });
  probe.appendChild(probeCluster);

  band.appendChild(row);
  if (withProbe) band.appendChild(probe);
  parent.append(sentinel, band);
  document.body.appendChild(parent);

  setRect(sentinel, { left: 24, top: 76, height: 0 });
  setRect(band, { left: 24, top: 100, width, height: 48 });
  // The rung step the sentinel floats above, as a *layout* fact. The hook reads
  // the gap from here rather than from the pair of rects above, because those
  // two stop being 24px apart the moment the band sticks — see the stuck-band
  // case below. The rects still say 76/100 so the fixture describes one page.
  band.style.marginTop = '24px';

  const fixture: Fixture = {
    parent,
    sentinel,
    band,
    row,
    cluster,
    more,
    probe,
    refs: {
      band: { current: band },
      probe: { current: withProbe ? probe : null },
      sentinel: { current: sentinel },
      cluster: { current: cluster },
      more: { current: more },
    },
    setWidth: (next) => {
      setClientWidth(band, next);
      setClientWidth(row, next);
      setRect(band, { left: 24, top: 100, width: next, height: 48 });
    },
    setProbeWidths: (full, compact, clusterWidth = 50) => {
      probe.querySelectorAll<HTMLElement>('[data-measure="full"]').forEach((node) => {
        setRect(node, { width: full });
      });
      probe.querySelectorAll<HTMLElement>('[data-measure="compact"]').forEach((node) => {
        setRect(node, { width: compact });
      });
      setRect(probeCluster, { width: clusterWidth });
    },
  };

  fixture.setWidth(width);
  return fixture;
}

/** Mount the hook against a fixture. */
function mount(fixture: Fixture, options: { pinned?: number; tierOpen?: boolean } = {}) {
  return renderHook(() =>
    useActionOverflow(ACTIONS, {
      pinned: options.pinned ?? 0,
      tierAlwaysPresent: false,
      tierOpen: options.tierOpen ?? false,
      refs: fixture.refs,
    }),
  );
}

beforeEach(() => {
  callbacks = [];
  installObserver();
});

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  document.body.innerHTML = '';
});

describe('useActionOverflow', () => {
  describe('without a ResizeObserver', () => {
    it('keeps every action in the bar and never asks for a probe', () => {
      // The jsdom and no-layout path: the strip must degrade to exactly what it
      // was before any measuring existed, so no test has to know this hook is here.
      globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;
      const fixture = makeFixture({ width: 200 });

      const { result } = mount(fixture);

      expect(result.current).toEqual({ inBar: ACTIONS.length, compact: false, measuring: false });
      expect(fixture.band.style.getPropertyValue('--bar-bleed')).toBe('');
    });
  });

  describe('the measured split', () => {
    it('seats every action when the row is wide enough', () => {
      const fixture = makeFixture({ width: 332 }); // available 316 = natural k=3
      const { result } = mount(fixture);

      expect(result.current).toEqual({ inBar: 3, compact: false, measuring: false });
    });

    it('drops the icons before it overflows anything', () => {
      const fixture = makeFixture({ width: 316 }); // available 300: natural k=3 needs 316
      const { result } = mount(fixture);

      expect(result.current).toEqual({ inBar: 3, compact: true, measuring: false });
    });

    it('overflows the tail once a compact row still will not fit', () => {
      const fixture = makeFixture({ width: 266 }); // available 250: compact k=2 needs 226
      const { result } = mount(fixture);

      expect(result.current).toEqual({ inBar: 2, compact: true, measuring: false });
    });

    it('asks the component for a probe when there is nothing to measure from', () => {
      const fixture = makeFixture({ width: 266, withProbe: false });
      const { result } = mount(fixture);

      expect(result.current.measuring).toBe(true);
      expect(result.current.inBar).toBe(ACTIONS.length);
    });
  });

  describe('a hidden rung', () => {
    it('abandons a pass taken at zero width without touching the split', () => {
      // `TabPanel` keeps inactive tabs mounted and `UsersTab` hides the detail
      // rung behind `hidden`, so this is the state the hook mounts in routinely.
      const fixture = makeFixture({ width: 0 });

      const { result } = mount(fixture);

      expect(result.current).toEqual({ inBar: 3, compact: false, measuring: false });
      expect(fixture.band.style.getPropertyValue('--bar-bleed')).toBe('');
    });

    it('reads nothing at all while hidden, so the cache stays empty', () => {
      // The abort happens *before* the probe is consulted. That matters because
      // the probe is the one thing in the band that might still report a stale
      // non-zero width, and a width cached from a hidden rung is indistinguishable
      // from a real one forever after. Observable here as: the strip still has to
      // ask for a probe when it comes back, because it never learned anything.
      const fixture = makeFixture({ width: 0 });
      const { result } = mount(fixture);

      fixture.refs.probe.current = null;
      fixture.setWidth(266);
      resize();

      expect(result.current).toEqual({ inBar: 3, compact: false, measuring: true });
    });

    it('commits a real split on the first non-zero report, un-poisoned', () => {
      // The recovery branch: Chrome fires the observer when an ancestor's
      // `display` flips, and the pending flag is what makes that report do the
      // work the hidden pass could not. A cache poisoned with the zeros would
      // report that all three actions fit in no space at all — so the narrower
      // split here is also the proof that nothing was cached.
      const fixture = makeFixture({ width: 0 });
      const { result } = mount(fixture);
      expect(result.current.inBar).toBe(3);

      fixture.setWidth(266);
      resize();

      expect(result.current).toEqual({ inBar: 2, compact: true, measuring: false });
      expect(fixture.band.style.getPropertyValue('--bar-bleed')).toBe('24px');
    });

    it('keeps the split when the row reports no room to lay out in', () => {
      // A visible band whose row has not been laid out yet — the collapsing half
      // of the same problem. A non-positive budget is not evidence that nothing
      // fits, and acting on it would empty the bar to the pinned floor and then
      // have to refill it a frame later.
      const fixture = makeFixture({ width: 332 });
      const { result } = mount(fixture);
      expect(result.current.inBar).toBe(3);

      setClientWidth(fixture.row, 0);
      setClientWidth(fixture.band, 300);
      resize();

      expect(result.current).toEqual({ inBar: 3, compact: false, measuring: false });
    });

    it('abandons a pass whose probe measured zero, and recovers from it', () => {
      // Band up, probe down: the probe lives inside the band, so it can be laid
      // out at zero for a frame of its own. Caching those zeros would be
      // permanent — they are indistinguishable from a real measurement later.
      const fixture = makeFixture({ width: 266 });
      fixture.setProbeWidths(0, 0, 0);

      const { result } = mount(fixture);
      expect(result.current).toEqual({ inBar: 3, compact: false, measuring: false });

      fixture.setProbeWidths(100, 80, 50);
      fixture.setWidth(267);
      resize();

      expect(result.current).toEqual({ inBar: 2, compact: true, measuring: false });
    });
  });

  describe('the loop guard', () => {
    it('ignores a repeated width, and only a repeated width', () => {
      // A split change can re-wrap the row and change the band's *height*, which
      // re-fires the observer at an unchanged width. Without the guard the two
      // states feed each other and Chrome drops notifications.
      const fixture = makeFixture({ width: 332 });
      const { result } = mount(fixture);
      expect(result.current.inBar).toBe(3);

      // Same band width, but a budget that would overflow two actions if read.
      setClientWidth(fixture.row, 174);
      resize();
      expect(result.current).toEqual({ inBar: 3, compact: false, measuring: false });

      // One pixel of real movement and the same budget is acted on.
      setClientWidth(fixture.band, 331);
      resize();
      expect(result.current).toEqual({ inBar: 1, compact: true, measuring: false });
    });
  });

  describe('the published variables', () => {
    it('puts --dock-offset on the parent and --bar-bleed on the band', () => {
      // The sentinel reads `--dock-offset` and it is the band's *sibling*, so a
      // value set on the band is invisible to it and the merge finishes early —
      // silently. This assertion is the only thing standing between that bug and
      // a reviewer's eye.
      // Row children sit at 32/140/248 (100 wide) with the cluster at 356 (50
      // wide), inside a band at x=24 that is 500 wide.
      const fixture = makeFixture({ width: 500 });

      mount(fixture);

      const band = fixture.band.style;
      const parent = fixture.parent.style;

      expect(band.getPropertyValue('--bar-bleed')).toBe('24px');
      expect(band.getPropertyValue('--dock-offset')).toBe('');

      // The band's own leading margin — the rung step the sentinel floats above.
      expect(parent.getPropertyValue('--dock-offset')).toBe('24px');
      expect(parent.getPropertyValue('--bar-bleed')).toBe('');
    });

    it('keeps --dock-offset a layout gap once the band has stuck', () => {
      // The regression. `bandRect.top - sentinelRect.top` is the rung step while
      // the strip is in flow and is *how far you have scrolled* once it sticks:
      // the sentinel keeps travelling and the band does not. Any re-publish
      // while docked — ticking a row, opening the tier, dragging the panel,
      // returning to a scrolled rung — used to write that scroll offset into the
      // sentinel's `view-timeline-inset`, which puts the merge's finish line
      // that far below the parking line. The strip then pins as an unmerged
      // floating card, and stays that way: nothing re-publishes at the top.
      const fixture = makeFixture({ width: 500 });
      mount(fixture);
      expect(fixture.parent.style.getPropertyValue('--dock-offset')).toBe('24px');

      // Scrolled 380px with the band parked: the sentinel has left the viewport,
      // the band has not moved, and the layout gap between them is unchanged.
      setRect(fixture.sentinel, { left: 24, top: -304, height: 0 });
      fixture.setWidth(480);
      resize();

      expect(fixture.parent.style.getPropertyValue('--dock-offset')).toBe('24px');
    });

    it('publishes nothing while the band is hidden', () => {
      const fixture = makeFixture({ width: 0 });
      mount(fixture);

      expect(fixture.band.style.getPropertyValue('--bar-bleed')).toBe('');
      expect(fixture.parent.style.getPropertyValue('--dock-offset')).toBe('');
    });

    it('removes what it published on unmount', () => {
      const fixture = makeFixture({ width: 332 });
      const { unmount } = mount(fixture);
      expect(fixture.parent.style.getPropertyValue('--dock-offset')).toBe('24px');

      unmount();

      expect(fixture.band.style.getPropertyValue('--bar-bleed')).toBe('');
      expect(fixture.parent.style.getPropertyValue('--dock-offset')).toBe('');
    });
  });

  describe('the deadband across successive resizes', () => {
    it('threads the previous split back in, so promotion needs real slack', () => {
      // compact k=3 needs 256. Re-seeding `previous` from the action count on
      // every pass would make k=3 a hold rather than a promotion, the hysteresis
      // term would drop out, and the icons would come back at exactly 256 — the
      // flicker the deadband exists to stop.
      const fixture = makeFixture({ width: 266 }); // available 250
      const { result } = mount(fixture);
      expect(result.current).toEqual({ inBar: 2, compact: true, measuring: false });

      fixture.setWidth(272); // available 256: enough, but not enough to promote
      resize();
      expect(result.current).toEqual({ inBar: 2, compact: true, measuring: false });

      fixture.setWidth(280); // available 264: 256 + one gap of slack
      resize();
      expect(result.current).toEqual({ inBar: 3, compact: true, measuring: false });
    });
  });

  describe('focus recovery', () => {
    it('hands focus to More when the focused action goes behind a closed tier', () => {
      // The tier is held closed with `inert`, so an overflowing action does not
      // merely move — it stops being focusable and the browser drops focus to
      // <body> without a word. On a drag that is a keyboard user losing their
      // place mid-gesture.
      const fixture = makeFixture({ width: 332 });
      const { result } = mount(fixture);
      expect(result.current.inBar).toBe(3);

      const third = fixture.row.children[2].querySelector('button');
      (third as HTMLButtonElement).focus();

      fixture.setWidth(266);
      (document.activeElement as HTMLElement).blur();
      resize();

      expect(result.current.inBar).toBe(2);
      expect(document.activeElement).toBe(fixture.more);
    });

    it('leaves focus alone when it survived the split', () => {
      const fixture = makeFixture({ width: 332 });
      const { result } = mount(fixture);

      const first = fixture.row.children[0].querySelector('button') as HTMLButtonElement;
      first.focus();

      fixture.setWidth(266);
      resize();

      expect(result.current.inBar).toBe(2);
      expect(document.activeElement).toBe(first);
    });

    it('never moves focus for an action that did not change side', () => {
      const fixture = makeFixture({ width: 332 });
      const { result } = mount(fixture);

      const first = fixture.row.children[0].querySelector('button') as HTMLButtonElement;
      first.focus();
      first.blur();

      fixture.setWidth(266);
      resize();

      expect(result.current.inBar).toBe(2);
      expect(document.activeElement).toBe(document.body);
    });
  });
});
