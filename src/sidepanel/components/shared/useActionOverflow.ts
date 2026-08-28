/**
 * @module sidepanel/components/shared/useActionOverflow
 * @description The DOM half of `ActionBar`'s measured overflow (ADR-0038).
 *
 * {@link sidepanel/components/shared/actionBarFit.fitActions} decides *what* the
 * split should be from a table of numbers. This hook is what produces those
 * numbers and what does something with the answer: it observes the band, reads
 * the hidden probe, caches every width by identity, and publishes the four
 * custom properties the merge animation is driven by.
 *
 * The split is deliberately not derived from the real row. `Button` is
 * `flex: 0 1 auto`, so a button measured inside a width-constrained wrapping row
 * reports its *shrunk* width — measure there and the bar converges on whatever
 * it already looks like. So the component renders an off-layout probe at
 * `max-content` holding every bar-eligible action twice, with its icon and
 * without, plus the trailing **More** cluster; this hook reads that and never
 * measures a live button.
 *
 * ## Why the probe is transient
 *
 * Widths are cached by {@link MeasurableAction.id} and only re-read when an
 * action's rendered signature changes, so the probe is mounted for the frame it
 * is needed and unmounted again — hence {@link ActionOverflowState.measuring}
 * being an output. A permanently mounted duplicate of every action is a second
 * copy of the bar in the accessibility tree and in every `getByRole` query, and
 * `aria-hidden` + `inert` is a mitigation rather than a fix. Mounting it only to
 * answer a question keeps the resize path free of it entirely.
 *
 * ## Surviving a hidden rung
 *
 * `TabPanel` keeps every tab mounted (ADR-0018) and `UsersTab` renders the
 * detail rung `hidden` while the search rung is showing, so **every measurement
 * this hook takes will be `0` at some point**, and not rarely. Four rules follow,
 * and they are the reason the hook is more than a `ResizeObserver` around
 * `fitActions`:
 *
 * 1. **Never cache a zero.** A zero band width or a zero measured width aborts
 *    the whole pass — nothing is written to the cache and the split is left
 *    alone. A cached zero is permanent damage: it looks like a legitimate
 *    measurement forever after, and the bar would seat every action in no space
 *    at all.
 * 2. **Never split from a zero budget.** A non-positive `available` keeps the
 *    previous split rather than collapsing to the pinned floor, so a rung does
 *    not come back from hidden with its actions already overflowed.
 * 3. **The initial guess is everything in the bar.** That is exactly today's
 *    pre-measurement behaviour — the row wraps — so the first paint is never
 *    worse than what shipped, and it is what jsdom sees for the whole of a test.
 * 4. **Recovery rides the `ResizeObserver` itself.** Chrome fires the observer
 *    when an ancestor's `display` toggles, so the aborted pass just leaves a
 *    `pendingMeasure` flag and the next non-zero report re-arms. This is why
 *    there is **no `isActive` / `visible` parameter**: a shared primitive whose
 *    layout silently stops updating unless the caller remembers to thread a
 *    visibility flag through it is a footgun, and every future adopter of
 *    ActionBar would have to know about it. The browser already knows when the
 *    band became visible; asking it is strictly more reliable than asking React.
 *
 * ## The two published variables
 *
 * Written imperatively through the refs, the way
 * {@link sidepanel/hooks/usePublishedHeight.usePublishedHeight} writes `--header-h`.
 * **The component must never pass a `style` prop to the band**, or React will
 * clear these writes on its next render.
 *
 * | Variable | Host | Meaning |
 * | --- | --- | --- |
 * | `--bar-bleed` | band | How far the band's box sits from the panel edge |
 * | `--dock-offset` | band's **parent** | The rung margin between the sentinel and the band |
 *
 * `--dock-offset` is the odd one out and it has to be. The element that *reads*
 * it is the dock sentinel — it subtracts the offset in its `view-timeline-inset`
 * so that the merge finishes on the frame the strip parks, rather than a
 * `space-y` step early — and the sentinel is the band's **sibling**, not its
 * descendant. A custom property set on the band is invisible to it. The parent
 * is the nearest element both of them inherit from, so that is where it goes.
 * Publishing it on the band instead does not error, it just silently mistimes
 * the merge, which is why this is written down rather than left to be inferred.
 *
 * There were two more. `--bar-content-measured` and `--dock-more-travel` drove a
 * resting strip that hugged its buttons and a More control that slid out to the
 * docked edge; both were measured working and both went when the strip became a
 * full-width card, because a card's chrome is the column and its disclosure is
 * already at the trailing edge. The geometry this hook still measures is the
 * geometry the merge cannot get from CSS alone.
 */
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { fitActions } from './actionBarFit';

/**
 * The part of an `ActionDescriptor` this hook actually reads.
 *
 * Declared structurally rather than imported from `ActionBar` on purpose: the
 * component imports the hook, so importing the descriptor back would close a
 * module cycle for the sake of five fields. `readonly ActionDescriptor[]` is
 * assignable to `readonly MeasurableAction[]` with no cast at the call site.
 */
export interface MeasurableAction {
  /** Stable identity. Keys the width cache and matches the probe's `data-action-id`. */
  id: string;
  /** Visible label. Part of the cache signature — it is most of the width. */
  label: string;
  /** Icon name, if any. Its presence is the difference between the two measurements. */
  icon?: string;
  /** Button variant. Changes padding and border, so it changes width. */
  variant?: string;
  /** Whether the action is showing a spinner, which replaces the icon and can resize it. */
  loading?: boolean;
}

/** The elements {@link useActionOverflow} measures and writes to. */
export interface ActionOverflowRefs {
  /** The `.dock-band` element. The `ResizeObserver` target and the var host. */
  band: RefObject<HTMLDivElement | null>;
  /** The hidden measurement probe. Rendered by the component only while `measuring`. */
  probe: RefObject<HTMLDivElement | null>;
  /** The zero-size dock sentinel that precedes the band. */
  sentinel: RefObject<HTMLDivElement | null>;
  /** The trailing More cluster in the VISIBLE row (separator + control wrapper). */
  cluster: RefObject<HTMLElement | null>;
  /** The More control itself, for focus recovery. */
  more: RefObject<HTMLButtonElement | null>;
}

/** What the component renders from. */
export interface ActionOverflowState {
  /** How many actions stay in the bar. */
  inBar: number;
  /** True when every bar action must render without its icon. */
  compact: boolean;
  /** True while the component must render the probe so widths can be taken. */
  measuring: boolean;
}

/** Everything {@link useActionOverflow} needs besides the actions themselves. */
export interface ActionOverflowOptions {
  /** How many leading actions may never overflow; the row wraps under them instead. */
  pinned: number;
  /** True when the tier holds caller content, so the More control is always rendered. */
  tierAlwaysPresent: boolean;
  /** Whether the tier is currently open — focus recovery needs it. */
  tierOpen: boolean;
  /** The measured elements; see {@link ActionOverflowRefs}. */
  refs: ActionOverflowRefs;
}

/** A cached pair of widths, valid only while the action still renders the same. */
interface CacheEntry {
  /** The signature the widths were taken at; a mismatch counts as uncached. */
  signature: string;
  /** Natural width, icon shown. */
  full: number;
  /** Width with the icon dropped. */
  compact: number;
}

/**
 * What about an action changes its width.
 *
 * `disabled` is absent deliberately — it only changes colour and cursor, so
 * including it would throw away a good measurement every time a button greys
 * out. `loading` *is* included: it swaps the icon for a spinner.
 */
function signatureOf(action: MeasurableAction): string {
  return `${action.label}|${action.icon ?? ''}|${action.variant ?? 'secondary'}|${
    action.loading ? 1 : 0
  }`;
}

/** Read a computed length in px, trying a logical property before its physical fallback. */
function readPx(style: CSSStyleDeclaration, property: string, fallback: string): number {
  const raw = style.getPropertyValue(property) || style.getPropertyValue(fallback);
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Measure the split, publish the merge variables, and keep focus alive across both.
 *
 * `actions` is the **bar-eligible run in bar order** — pinned actions first,
 * then flex — so {@link ActionOverflowState.inBar} is a count from the head of
 * that array. Actions the caller has declared tier-only never appear here;
 * they are not candidates, so measuring them would only cost a probe node.
 *
 * With no `ResizeObserver` (jsdom, and any environment that cannot lay out),
 * this degrades to a constant: every action in the bar, no compaction, no probe.
 * That is the shape `ActionBar` had before any of this existed, so no test and
 * no non-measuring path has to know the hook is here.
 *
 * @param actions - Bar-eligible actions, in bar order.
 * @param options - Floor, tier state and the measured elements; see {@link ActionOverflowOptions}.
 * @returns The split to render; see {@link ActionOverflowState}.
 */
export function useActionOverflow(
  actions: readonly MeasurableAction[],
  options: ActionOverflowOptions,
): ActionOverflowState {
  const { pinned, tierAlwaysPresent, tierOpen, refs } = options;

  const [split, setSplit] = useState<{ inBar: number; compact: boolean }>(() => ({
    inBar: actions.length,
    compact: false,
  }));
  const [measuring, setMeasuring] = useState(false);

  const splitRef = useRef(split);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const clusterWidthRef = useRef(0);
  const clusterMeasuredRef = useRef(false);
  /** NaN so the first pass can never be mistaken for a repeat of itself. */
  const lastWidthRef = useRef(Number.NaN);
  const pendingRef = useRef(true);
  const lastFocusedActionIdRef = useRef<string | null>(null);
  const recoverRef = useRef<{ from: number; to: number } | null>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  /**
   * The visible row inside the band.
   *
   * Derived rather than passed as a sixth ref: the cluster is a direct flex item
   * of the row, so its parent *is* the row, and a bar with no cluster has the
   * row as the band's first element child that is not the probe. One less ref
   * for the component to wire correctly, and no way for the two to disagree
   * about which element the gap and the padding are read from.
   */
  const rowOf = (band: HTMLElement): HTMLElement | null => {
    const viaCluster = refs.cluster.current?.parentElement;
    if (viaCluster instanceof HTMLElement && band.contains(viaCluster)) return viaCluster;
    const probe = refs.probe.current;
    for (const child of band.children) {
      if (!(child instanceof HTMLElement)) continue;
      if (probe && (child === probe || child.contains(probe))) continue;
      return child;
    }
    return null;
  };

  /**
   * Read the probe into the cache. Returns `false` — having written nothing —
   * when anything measured zero, which is the hidden-rung case again: the probe
   * is laid out inside the band, so it disappears with it.
   */
  const readProbe = (
    probe: HTMLElement,
    stale: readonly MeasurableAction[],
    cache: Map<string, CacheEntry>,
  ): boolean => {
    const widthOf = (kind: 'full' | 'compact', id: string): number => {
      const nodes = probe.querySelectorAll<HTMLElement>(`[data-measure="${kind}"]`);
      for (const node of nodes) {
        if (node.dataset.actionId === id) return node.getBoundingClientRect().width;
      }
      return 0;
    };

    const measured: CacheEntry[] = [];
    for (const action of stale) {
      const full = widthOf('full', action.id);
      const compact = widthOf('compact', action.id);
      if (full <= 0 || compact <= 0) return false;
      measured.push({ signature: signatureOf(action), full, compact });
    }

    // The cluster is measured whole — separator, its spacing and the control —
    // because `fitActions` charges the row one indivisible trailing box. Its
    // absence is legitimate (a bar that can never disclose anything renders no
    // cluster at all); a present-but-zero cluster is the hidden rung.
    const clusterNode = probe.querySelector<HTMLElement>('[data-measure="cluster"]');
    let clusterWidth = 0;
    if (clusterNode) {
      clusterWidth = clusterNode.getBoundingClientRect().width;
      if (clusterWidth <= 0) return false;
    }

    stale.forEach((action, index) => cache.set(action.id, measured[index]));
    clusterWidthRef.current = clusterWidth;
    clusterMeasuredRef.current = true;
    return true;
  };

  /**
   * Find an action's live node in the bar or the tier, ignoring the probe's
   * copies of it. Matching on `dataset` rather than building an attribute
   * selector keeps arbitrary caller ids out of a selector string, which is both
   * safer and does not need `CSS.escape` (absent in jsdom).
   */
  const findActionNode = (band: HTMLElement, id: string): HTMLElement | null => {
    const probe = refs.probe.current;
    const nodes = band.querySelectorAll<HTMLElement>('[data-action-id]');
    for (const node of nodes) {
      if (node.dataset.actionId !== id) continue;
      if (probe && probe.contains(node)) continue;
      return node;
    }
    return null;
  };

  /**
   * Put focus somewhere sensible after an action moved between the bar and the
   * tier underneath the user.
   *
   * The tier is held closed with `inert`, so an action that overflows while
   * focused does not merely move — it stops being focusable, and the browser
   * drops focus to `<body>` without a word. On a drag that is a keyboard user
   * losing their place mid-gesture, silently.
   *
   * Only ever a *recovery*: if focus is still somewhere in the band the user (or
   * React) has already dealt with it and this does nothing. And it never opens
   * the tier — a resize is not a request to disclose anything, so an action that
   * went behind a closed **More** hands focus to **More**, which is exactly where
   * the user now needs to be.
   */
  const recoverFocus = (from: number, to: number): void => {
    const band = refs.band.current;
    const id = lastFocusedActionIdRef.current;
    if (!band || id === null) return;

    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && band.contains(active)) return;

    const index = actionsRef.current.findIndex((action) => action.id === id);
    if (index < 0) return;

    const movedOut = index >= to && index < from;
    const movedIn = index < to && index >= from;
    if (!movedOut && !movedIn) return;

    if (movedOut && !tierOpen) {
      refs.more.current?.focus();
      return;
    }

    const node = findActionNode(band, id);
    node?.focus();
    // `inert` swallows `focus()` without throwing, so trust the result, not the call.
    if (document.activeElement !== node) refs.more.current?.focus();
  };

  /** Publish the two merge variables from the band's current geometry. */
  const publish = (): void => {
    const band = refs.band.current;
    if (!band) return;
    if (band.clientWidth <= 0) return;

    const bandRect = band.getBoundingClientRect();

    // The side panel *is* the viewport, so the band's distance from the left of
    // the viewport is exactly the gutter the merge has to bleed across. Measured
    // rather than assumed, which also covers the case where `max-w-7xl` stops the
    // column growing and a fixed bleed no longer reaches the panel edge.
    band.style.setProperty('--bar-bleed', `${Math.round(bandRect.left)}px`);

    const sentinel = refs.sentinel.current;
    const host = band.parentElement;
    if (sentinel && host) {
      const offset = Math.max(0, Math.round(bandRect.top - sentinel.getBoundingClientRect().top));
      host.style.setProperty('--dock-offset', `${offset}px`);
    }
  };

  /**
   * One measure-and-commit pass. Returns without side effects whenever it
   * cannot trust what it read — see the module notes on the hidden rung.
   */
  const runPass = (): void => {
    if (typeof ResizeObserver !== 'function') return;
    const band = refs.band.current;
    if (!band) return;

    const width = band.clientWidth;
    // Rule 1: a hidden rung measures zero. Leave the cache and the split alone
    // and wait for the observer to say the band came back.
    if (width <= 0) {
      pendingRef.current = true;
      return;
    }

    const current = actionsRef.current;
    const cache = cacheRef.current;
    const stale = current.filter((action) => {
      const entry = cache.get(action.id);
      return entry === undefined || entry.signature !== signatureOf(action);
    });
    const needsProbe = stale.length > 0 || !clusterMeasuredRef.current;

    // The loop guard. A split change can re-wrap the row and change the band's
    // *height*, which re-fires the observer at an unchanged width; without this
    // the two states feed each other and Chrome reports "ResizeObserver loop
    // completed with undelivered notifications". A pass that has real work to do
    // — a pending recovery, or a width it has never seen — is never skipped.
    if (!pendingRef.current && !needsProbe && Math.abs(width - lastWidthRef.current) < 1) return;

    if (needsProbe) {
      const probe = refs.probe.current;
      if (!probe) {
        // Ask the component for a probe and come back on the render it appears.
        pendingRef.current = true;
        setMeasuring(true);
        return;
      }
      if (!readProbe(probe, stale, cache)) {
        pendingRef.current = true;
        return;
      }
    }

    // Gap and padding are read, never assumed: they are Tailwind utilities on
    // the row and a class change must not silently desync the arithmetic here.
    const row = rowOf(band);
    let gap = 0;
    let available = Math.floor(width);
    if (row) {
      const rowStyle = getComputedStyle(row);
      gap = readPx(rowStyle, 'column-gap', 'gap');
      available = Math.floor(
        row.clientWidth -
          readPx(rowStyle, 'padding-inline-start', 'padding-left') -
          readPx(rowStyle, 'padding-inline-end', 'padding-right'),
      );
    }

    // Rule 2: a zero budget is not evidence that nothing fits.
    if (available <= 0) {
      pendingRef.current = true;
      return;
    }

    const widths: number[] = [];
    const compactWidths: number[] = [];
    for (const action of current) {
      const entry = cache.get(action.id);
      widths.push(entry?.full ?? 0);
      compactWidths.push(entry?.compact ?? 0);
    }

    const next = fitActions({
      widths,
      compactWidths,
      available,
      gap,
      overflowWidth: clusterWidthRef.current,
      pinned,
      tierAlwaysPresent,
      // Threaded from the last committed split so the one-sided deadband is live
      // across resizes rather than being re-seeded on every frame of a drag.
      previous: splitRef.current.inBar,
    });

    lastWidthRef.current = width;
    pendingRef.current = false;
    setMeasuring(false);

    const previous = splitRef.current;
    if (next.inBar !== previous.inBar || next.compact !== previous.compact) {
      if (next.inBar !== previous.inBar) {
        recoverRef.current = { from: previous.inBar, to: next.inBar };
      }
      splitRef.current = next;
      setSplit(next);
    }

    publish();
  };

  const passRef = useRef(runPass);
  // Declared first so every effect below runs against this render's closure.
  useLayoutEffect(() => {
    passRef.current = runPass;
  });

  // Arm once. The band exists from the first render, and the same effect owns
  // the focus listener because both are tied to that node's lifetime.
  useLayoutEffect(() => {
    const band = refs.band.current;
    if (!band || typeof ResizeObserver !== 'function') return;

    // A `focusin` listener rather than an `onFocusCapture` prop the hook hands
    // back: the return type is a plain state object the component destructures,
    // and a handler it has to remember to spread onto the band is a handler that
    // can be dropped in a refactor with no type error and no visible symptom
    // until someone tabs through a narrowing panel. The node is already owned
    // here; the listener cannot be forgotten.
    const remember = (event: FocusEvent) => {
      const target = event.target;
      const owner = target instanceof Element ? target.closest('[data-action-id]') : null;
      lastFocusedActionIdRef.current =
        owner instanceof HTMLElement ? (owner.dataset.actionId ?? null) : null;
    };
    band.addEventListener('focusin', remember);

    const observer = new ResizeObserver(() => passRef.current());
    observer.observe(band);
    passRef.current();

    return () => {
      band.removeEventListener('focusin', remember);
      observer.disconnect();
      band.style.removeProperty('--bar-bleed');
      band.parentElement?.style.removeProperty('--dock-offset');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What the bar holds changed, so the cached widths may no longer describe it.
  // `\x00` as the separator, written as an escape rather than pasted in: a real
  // NUL byte in the source makes the file `data` to file(1), and grep then skips
  // it without a word — a silent blind spot for every future search of this repo.
  const actionsSignature = `${actions.map(signatureOf).join('\x00')}|${pinned}|${tierAlwaysPresent}`;
  useLayoutEffect(() => {
    pendingRef.current = true;
    passRef.current();
  }, [actionsSignature]);

  // The probe has just been rendered on request; take the widths before paint.
  useLayoutEffect(() => {
    if (measuring) passRef.current();
  }, [measuring]);

  // Re-publish after a split change: the variables above were read from the
  // pre-split layout, and the row has only just re-rendered around the new one.
  useLayoutEffect(() => {
    if (typeof ResizeObserver !== 'function') return;
    publish();
    const pending = recoverRef.current;
    if (!pending) return;
    recoverRef.current = null;
    recoverFocus(pending.from, pending.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split]);

  // Inter is `font-display: swap`, so the first measurements can be taken in the
  // fallback face and be wrong by several pixels per label. One remeasure when
  // the real face lands. Guarded because `document.fonts` does not exist in jsdom.
  useLayoutEffect(() => {
    if (typeof ResizeObserver !== 'function') return;
    const fonts: FontFaceSet | undefined = document.fonts;
    if (!fonts) return;
    let cancelled = false;
    void fonts.ready.then(() => {
      if (cancelled) return;
      cacheRef.current.clear();
      clusterMeasuredRef.current = false;
      pendingRef.current = true;
      setMeasuring(true);
      passRef.current();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasObserver = typeof ResizeObserver === 'function';
  return useMemo(
    () =>
      hasObserver
        ? { inBar: Math.min(split.inBar, actions.length), compact: split.compact, measuring }
        : { inBar: actions.length, compact: false, measuring: false },
    [hasObserver, split.inBar, split.compact, measuring, actions.length],
  );
}
