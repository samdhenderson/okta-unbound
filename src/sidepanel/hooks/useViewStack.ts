/**
 * @module sidepanel/hooks/useViewStack
 * @description Generic push/pop sub-navigation stack for a tab shell — the primitive behind
 * "list → detail → deeper detail" drill-downs, with a breadcrumb trail and focus management.
 *
 * A tab has no router. Before this hook, drilling into a detail view meant either
 * an overlay ({@link Modal}) or swapping the whole tab body and losing everything
 * the list had accumulated. `useViewStack` gives a tab a small, typed navigation
 * stack instead: the tab shell instantiates it **once**, renders its list at the
 * root and a detail view for the current entry, and gets `push`/`pop`/`popTo`/
 * `reset` plus a breadcrumb `trail` for free.
 *
 * Per [docs/state-management.md](../../../docs/state-management.md) a custom hook is
 * the default home for this kind of state — a third React context is reserved for
 * distant, unrelated consumers, which sub-navigation inside one tab is not. Each
 * tab owns its own independent stack.
 *
 * ## How a consumer wires it up
 *
 * ```tsx
 * const viewRef = useRef<HTMLDivElement>(null);
 * const nav = useViewStack<GroupDetailEntry>({
 *   rootLabel: 'Groups',
 *   getLabel: (entry) => entry.name,
 *   getKey: (entry) => entry.id,
 *   viewRef,
 * });
 *
 * return (
 *   <div className="flex flex-col h-full">
 *     <PageHeader
 *       title={nav.currentEntry?.name ?? 'Groups'}
 *       onBack={nav.isRoot ? undefined : nav.pop}
 *       breadcrumbs={nav.isRoot ? undefined : <Breadcrumbs items={nav.trail} />}
 *     />
 *     <div hidden={!nav.isRoot} className={nav.transition === 'pop' ? 'animate-pop-in' : ''}>
 *       <GroupsListPanel onOpenDetail={nav.push} />
 *     </div>
 *     {nav.currentEntry && (
 *       <div ref={viewRef} tabIndex={-1} className="animate-push-in">
 *         <GroupDetailView group={nav.currentEntry} />
 *       </div>
 *     )}
 *   </div>
 * );
 * ```
 *
 * The container ref is **the consumer's own** and is handed to the hook as an
 * option rather than returned by it. React Compiler's `react-hooks/refs` lint rule
 * treats any object carrying a ref as a ref, and would then reject every
 * `nav.<field>` read during render.
 *
 * One `PageHeader` stays mounted and its contents swap in place, following
 * ADR-0008's precedent for the activity bar; the list is hidden rather than
 * unmounted so its accumulated state survives.
 *
 * ## What a consumer must lift for `pop` to preserve list state
 *
 * The hook preserves **navigation** state, not the list's state. Anything the list
 * holds in component-local `useState` dies the moment the list unmounts and comes
 * back reset when it remounts on `pop`. Two ways out, in order of preference:
 *
 * 1. **Keep the list mounted** and hide it (`hidden` / `className="hidden"`) while a
 *    detail view is on the stack, rendering the detail as a **sibling** rather than
 *    a replacement. Every `useState` inside the list — however deep — survives, and
 *    so does the trigger element focus is restored to.
 * 2. **Lift the state** into a hook owned by the tab shell, above the list. Needed
 *    per piece of state, and cannot reach state owned by a row.
 *
 * Concretely, for the Groups tab:
 *
 * - `useGroupsLoader` / `useGroupFilters` / `useGroupSelection` / `useGroupMembersCache`
 *   already live in `GroupsTab`, so loaded groups, filters and selection survive
 *   automatically **provided the detail view is a sibling of the tab shell's list,
 *   not a replacement for the tab shell**.
 * - `GroupsListPanel`'s `visibleCount` (its progressive-reveal window) is
 *   component-local — keep the panel mounted, or lift it into a hook alongside the
 *   other group hooks.
 * - Per-row `expanded` state in `GroupListItem` is component-local and is only
 *   realistically preserved by keeping the panel mounted (option 1) — lifting it
 *   would mean hoisting a map of per-row state into the tab shell.
 * - **Scroll position** is DOM state on the scroll container and needs its own
 *   handling either way: `hidden`/`className="hidden"` is `display: none`, which
 *   destroys the scroll box, so `scrollTop` comes back as `0`. Capture `scrollTop`
 *   before pushing and restore it after popping (or hide the list with a technique
 *   that keeps it laid out, e.g. an `inert`, visually-hidden overlay).
 *
 * ## Focus
 *
 * Mirrors {@link Modal}'s approach: the element that had focus is recorded at
 * `push` time, focus moves into the pushed view once it mounts, and `pop` restores
 * focus to the element that triggered the push. There is deliberately **no focus
 * trap** — a pushed view replaces the list in place rather than overlaying it, so
 * the surrounding chrome (tab bar, activity bar) must stay reachable by keyboard.
 *
 * Restoring focus needs the trigger to still be in the document, which is another
 * reason to keep the list mounted: if the list unmounted on push, the row that was
 * clicked no longer exists on pop and focus is left where it is rather than being
 * moved somewhere arbitrary.
 *
 * ## Motion
 *
 * {@link ViewStack.transition} reports the direction of the most recent navigation
 * so a consumer can animate the arriving surface: `animate-push-in` (from the
 * right) for a push, `animate-pop-in` (from the left) for a pop, both over
 * `--dur-travel`. It is `null` until the first navigation, so nothing animates on
 * the tab's initial render.
 *
 * The animation is **purely decorative CSS on the incoming element and gates
 * nothing**. The focus effect below runs on the same commit that mounts the pushed
 * view, before a single frame of the animation has played, so a keyboard or screen
 * reader user is never made to wait out a transition — exactly as ADR-0016
 * requires. And because the outgoing surface is hidden with `display: none` (the
 * sibling-rendering contract above), it is out of the tab order and out of the
 * accessibility tree for the whole flight: it cannot take focus back or be read
 * while the incoming view animates in.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Selector for the tabbable elements a pushed view may receive focus on. Kept
 * identical to the one in `components/shared/Modal.tsx` so focus behaves the same
 * whether a view is pushed or opened as a dialog.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** One rung of the breadcrumb trail returned by {@link useViewStack}. */
export interface ViewStackCrumb {
  /** Stable React key for the crumb. */
  key: string;
  /** Human-readable label — `rootLabel` for the root, `getLabel(entry)` otherwise. */
  label: string;
  /** Stack depth this crumb represents; `0` is the root (list) view. */
  depth: number;
  /** True for the last crumb, i.e. the view currently on screen. */
  isCurrent: boolean;
  /**
   * Navigates back to this crumb. `undefined` on the current crumb, which is not
   * actionable — render it as plain text with `aria-current="page"`.
   */
  onSelect?: () => void;
}

/** Configuration for {@link useViewStack}. */
export interface UseViewStackOptions<TEntry> {
  /** Label for the root (list) view — the first crumb of the trail. */
  rootLabel: string;
  /** Projects a pushed entry to its breadcrumb label. */
  getLabel: (entry: TEntry) => string;
  /**
   * Projects a pushed entry to a stable React key. Defaults to the entry's depth,
   * which is fine unless the same trail can be re-rendered with reordered entries.
   */
  getKey?: (entry: TEntry, depth: number) => string;
  /**
   * Ref on the pushed view's container element, owned by the consumer — the hook
   * only reads it inside its focus effect. Give that element `tabIndex={-1}` so it
   * can receive focus when it holds no focusable child. Omit it to skip the
   * focus-into-the-pushed-view half of focus management (focus restoration on
   * `pop` still works).
   *
   * The ref is passed **in** rather than returned so that consumers can read
   * `nav.currentEntry` in render: React Compiler's `react-hooks/refs` lint rule
   * rejects any property access on an object that carries a ref.
   */
  viewRef?: React.RefObject<HTMLElement | null>;
  /**
   * Set `false` to opt out of the focus move/restore behaviour (e.g. when the
   * consumer manages focus itself). Defaults to `true`.
   */
  manageFocus?: boolean;
}

/**
 * Direction of the most recent navigation, for picking an entrance animation.
 * `null` before the first push — the tab's initial render is not a navigation and
 * must not animate.
 */
export type ViewStackTransition = 'push' | 'pop' | null;

/** Navigation state and mutators returned by {@link useViewStack}. */
export interface ViewStack<TEntry> {
  /** The pushed entries, root-first. Empty at the root. */
  entries: readonly TEntry[];
  /** The entry currently on screen, or `undefined` at the root (list) view. */
  currentEntry: TEntry | undefined;
  /** Number of pushed entries; `0` at the root. */
  depth: number;
  /** Convenience for `depth === 0` — render the list when true. */
  isRoot: boolean;
  /** Root crumb plus one crumb per pushed entry, in order. */
  trail: ViewStackCrumb[];
  /**
   * Direction of the most recent navigation — `'push'`, `'pop'`, or `null` before
   * the first one. Apply `animate-push-in` / `animate-pop-in` to whichever surface
   * is arriving; it is a hint for CSS only and never gates focus.
   */
  transition: ViewStackTransition;
  /** Pushes a new entry on top of the stack and moves focus into the pushed view. */
  push: (entry: TEntry) => void;
  /** Pops one level, restoring focus to whatever triggered that push. No-op at the root. */
  pop: () => void;
  /**
   * Pops back to a given depth (`0` = root), restoring focus to the element that
   * triggered the first popped push. No-op when `depth` is already at or below it.
   */
  popTo: (depth: number) => void;
  /** Clears the whole stack back to the root view. Equivalent to `popTo(0)`. */
  reset: () => void;
}

/**
 * Owns a tab's push/pop sub-navigation stack: the pushed entries, the breadcrumb
 * trail, and focus move/restore across a push and pop.
 *
 * Instantiate it **once per tab shell** and render the detail view as a sibling of
 * the list rather than in place of it — see the module docs for exactly which list
 * state a consumer has to lift (or keep mounted) for `pop` to look like a real
 * "back".
 *
 * @typeParam TEntry - Whatever a tab needs to identify a pushed view. Usually a
 * small descriptor (`{ id, name }`) rather than a whole loaded entity, so the
 * detail view stays responsible for its own fetching.
 * @param options - Breadcrumb labelling and focus configuration.
 * @returns The current entry, depth, breadcrumb `trail`, and the
 * `push`/`pop`/`popTo`/`reset` mutators.
 *
 * @example
 * ```tsx
 * const nav = useViewStack<{ id: string; name: string }>({
 *   rootLabel: 'Groups',
 *   getLabel: (g) => g.name,
 *   getKey: (g) => g.id,
 * });
 *
 * nav.push({ id: '00gFAKE0000000000001', name: 'Engineering' });
 * nav.trail; // [{ label: 'Groups', onSelect }, { label: 'Engineering', isCurrent: true }]
 * ```
 */
export function useViewStack<TEntry>({
  rootLabel,
  getLabel,
  getKey,
  viewRef,
  manageFocus = true,
}: UseViewStackOptions<TEntry>): ViewStack<TEntry> {
  // Entries and the navigation direction move together in one state object so a
  // push commits the arriving view and its entrance animation in the *same* render.
  // Deriving the direction in an effect instead would paint one un-animated frame
  // before the class landed, which reads as a flicker.
  const [{ entries, transition }, setState] = useState<{
    entries: readonly TEntry[];
    transition: ViewStackTransition;
  }>({ entries: [], transition: null });
  const depth = entries.length;

  /** `focusOrigins[d]` is the element focused just before the push that created depth `d + 1`. */
  const focusOrigins = useRef<(HTMLElement | null)[]>([]);
  /** Captured in `push` (before the re-render) and filed into `focusOrigins` by the effect. */
  const pendingOrigin = useRef<HTMLElement | null>(null);
  /** Depth at the previous commit, so the effect can tell a push from a pop. */
  const previousDepth = useRef(0);

  const push = useCallback((entry: TEntry) => {
    pendingOrigin.current = document.activeElement as HTMLElement | null;
    setState((prev) => ({ entries: [...prev.entries, entry], transition: 'push' }));
  }, []);

  const popTo = useCallback((targetDepth: number) => {
    const next = Math.max(0, targetDepth);
    setState((prev) =>
      next >= prev.entries.length
        ? prev
        : { entries: prev.entries.slice(0, next), transition: 'pop' },
    );
  }, []);

  const pop = useCallback(() => {
    setState((prev) =>
      prev.entries.length === 0
        ? prev
        : { entries: prev.entries.slice(0, prev.entries.length - 1), transition: 'pop' },
    );
  }, []);

  const reset = useCallback(() => {
    setState((prev) => (prev.entries.length === 0 ? prev : { entries: [], transition: 'pop' }));
  }, []);

  // Move focus into a pushed view, and restore it to the trigger on the way back.
  // No trap: the view sits in the page flow, so surrounding chrome stays tabbable.
  useEffect(() => {
    const previous = previousDepth.current;
    previousDepth.current = depth;
    if (depth === previous) return;

    if (depth > previous) {
      focusOrigins.current[previous] = pendingOrigin.current;
      pendingOrigin.current = null;
      if (!manageFocus) return;
      const node = viewRef?.current;
      if (!node) return;
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? node).focus?.();
      return;
    }

    const origin = focusOrigins.current[depth] ?? null;
    focusOrigins.current.length = depth;
    if (!manageFocus) return;
    // The trigger may have unmounted while the detail view was open; skip if so.
    if (origin?.isConnected) origin.focus?.();
  }, [depth, manageFocus, viewRef]);

  const trail = useMemo<ViewStackCrumb[]>(() => {
    const crumbs: ViewStackCrumb[] = [
      {
        key: 'view-stack-root',
        label: rootLabel,
        depth: 0,
        isCurrent: entries.length === 0,
        onSelect: entries.length === 0 ? undefined : () => popTo(0),
      },
    ];

    entries.forEach((entry, index) => {
      const crumbDepth = index + 1;
      const isCurrent = crumbDepth === entries.length;
      crumbs.push({
        key: getKey ? getKey(entry, crumbDepth) : `view-stack-${crumbDepth}`,
        label: getLabel(entry),
        depth: crumbDepth,
        isCurrent,
        onSelect: isCurrent ? undefined : () => popTo(crumbDepth),
      });
    });

    return crumbs;
  }, [entries, rootLabel, getLabel, getKey, popTo]);

  return {
    entries,
    currentEntry: entries.length === 0 ? undefined : entries[entries.length - 1],
    depth,
    isRoot: depth === 0,
    trail,
    transition,
    push,
    pop,
    popTo,
    reset,
  };
}
