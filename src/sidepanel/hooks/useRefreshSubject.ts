/**
 * @module sidepanel/hooks/useRefreshSubject
 * @description Who the app's one refresh control is currently pointed at.
 *
 * ADR-0069 puts a single refresh in the top bar, beside the Pin, and gives it
 * one rule: **its subject is whatever the panel is showing**. On a list rung
 * that is the list; on a detail rung it is that entity's cache keys plus a
 * re-run of the loads the rung performs on open. Nothing about that varies by
 * tab, which is why the control is declared once in the chrome rather than nine
 * times in nine headers.
 *
 * The rung is the only thing that knows what "again" means for itself, so the
 * rung supplies it — through {@link useRefreshSubject} — and the chrome reads
 * whichever registration is current through {@link useCurrentRefreshSubject}.
 *
 * ## Why a module store rather than a context
 *
 * The control lives in `ContextBar`, which `App` renders as a **sibling** of
 * every tab: a provider mounted inside `App`'s tree could not be read by `App`'s
 * own body, and hoisting one above `App` would make the shell's single most
 * visible control invisible to any test or story that renders `App` bare. A
 * module store has neither problem, and it is the shape `sidepanel/cache/entityCache`
 * already uses for panel-wide, session-scoped state. There is exactly one side
 * panel per browser profile, so a singleton is not a shortcut here.
 *
 * ## The stack, and why the *last* registration wins
 *
 * Tabs stay mounted (ADR-0018), so several rungs exist at once and a hidden one
 * must never claim the control. Every caller gates its registration on the same
 * `isActive` its fetches are gated on, so in practice at most one is registered.
 * The registry keeps a stack regardless and reports the most recent entry,
 * because the one case that legitimately nests is a list rung and the detail
 * rung pushed over it: the deeper registration is the one on screen, and popping
 * it must restore the list's rather than leave the control unsubjected.
 *
 * Nothing here logs, and a subject carries a display name only — never an id.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/** What the app-level refresh control acts on right now. */
export interface RefreshSubject {
  /**
   * What the control is pointed at, in the reader's words — `Payments Team`,
   * `the apps list`.
   *
   * Used **only** to build the control's tooltip and accessible name
   * (`Refresh Payments Team`). It is never rendered as visible label text, a
   * badge or a count in the chrome band: naming the browsed entity in the band
   * that describes the *live Okta tab* is the ADR-0032 §1 convergence, and the
   * deictic alternative (`Refresh this group`) is ambiguous in exactly the state
   * — live tab and browsed entity differ — that the band exists to serve.
   */
  name: string;
  /** Re-read whatever the rung is showing. Fired on press; never called on its own. */
  run: () => void;
}

/** A live registration. The object identity is the stack token. */
interface Entry {
  name: string;
  /** Read at press time, so a rung may pass an inline closure without re-registering. */
  runRef: { current: () => void };
}

/** Registration stack, innermost last. */
let stack: Entry[] = [];
const listeners = new Set<() => void>();

/** The entry the chrome should act on, or `null` when no rung has claimed it. */
function currentEntry(): Entry | null {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

/** The published snapshot. Kept as a stable object so `useSyncExternalStore` settles. */
let snapshot: RefreshSubject | null = null;

/** Recompute the snapshot, preserving identity when nothing observable changed. */
function republish(): void {
  const entry = currentEntry();
  if (entry === null) {
    if (snapshot === null) return;
    snapshot = null;
  } else if (snapshot === null || snapshot.name !== entry.name) {
    snapshot = { name: entry.name, run: () => entry.runRef.current() };
  } else {
    // Same rung, same name: keep the identity so consumers memoized on the
    // subject do not re-render. `runRef` already carries the fresh closure.
    return;
  }
  for (const listener of listeners) listener();
}

/** Subscribe to subject changes. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read the current subject. */
function getSnapshot(): RefreshSubject | null {
  return snapshot;
}

/**
 * Declare what the app-level refresh control means on this rung.
 *
 * Registration is a stack entry for as long as `enabled` holds; the chrome acts
 * on the most recent one. `run` is read through a ref at press time, so an
 * inline closure is fine and does not churn the registration — only `name` and
 * `enabled` do.
 *
 * @param name - The subject, in the reader's words. See {@link RefreshSubject.name}.
 *   Pass `null` to register nothing (a rung with no answer yet).
 * @param run - Re-read whatever this rung is showing.
 * @param enabled - Whether this rung is the one on screen. Gate it on the same
 *   `isActive` the rung's fetches are gated on (ADR-0018) — a hidden tab that
 *   owns the refresh control would re-read data nobody is looking at. Defaults
 *   to `true`.
 *
 * @example
 * ```ts
 * useRefreshSubject('the apps list', () => void loadApps(true), isActive);
 * ```
 */
export function useRefreshSubject(name: string | null, run: () => void, enabled = true): void {
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    if (!enabled || name === null) return;
    const entry: Entry = { name, runRef };
    stack = [...stack, entry];
    republish();
    return () => {
      stack = stack.filter((candidate) => candidate !== entry);
      republish();
    };
  }, [name, enabled]);
}

/**
 * The subject the app-level refresh control is currently pointed at.
 *
 * @returns The current subject, or `null` when no rung has claimed the control —
 *   in which case a press is the context re-probe alone, which is what the
 *   control did on every rung before ADR-0069.
 */
export function useCurrentRefreshSubject(): RefreshSubject | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Compose the app-level refresh press: the context half and the data half.
 *
 * They are deliberately independent. The pin governs whether the panel follows
 * the live Okta tab, so re-probing page context is meaningless — and is skipped
 * — while pinned; it says nothing about whether the roster on screen is current,
 * so the data half always runs (ADR-0069 §2).
 *
 * @param refetchPageContext - The page-context engine's `refetch`.
 * @param isPinned - Whether the panel is pinned to a frozen snapshot.
 * @returns `subjectName` for the control's accessible name (`null` when no rung
 *   has claimed it) and `refresh`, the press handler.
 */
export function useAppRefresh(
  refetchPageContext: () => Promise<unknown> | void,
  isPinned: boolean,
): { subjectName: string | null; refresh: () => void } {
  const subject = useCurrentRefreshSubject();
  const refresh = useCallback(() => {
    if (!isPinned) void refetchPageContext();
    subject?.run();
  }, [isPinned, refetchPageContext, subject]);

  return { subjectName: subject?.name ?? null, refresh };
}
