/**
 * @module sidepanel/hooks/useOwedLoad
 * @description Run work once per distinct input, deferring it while the surface
 * that needs it is not ready.
 *
 * Tabs stay mounted (ADR-0018), so "only fetch while visible" is not enough on its
 * own: a naive `if (!isActive) return` drops a load whose input changed while the
 * tab was hidden, and a naive `[isActive]` dependency re-runs it on every return to
 * the tab. Both are wrong, and the second is the quieter of the two — it turns
 * every tab revisit into a refetch.
 *
 * The shape that is correct is a **latch**: remember which input was last acted on,
 * and act again only when the input actually differs. Five places had grown their
 * own copy of it, in two idioms — a boolean `owedRef` raised by one effect and paid
 * by another, and a single effect comparing against the last-processed value.
 * ADR-0026 identified this as the one visibility pattern worth extracting, and
 * deliberately not as an option on `useEntityQuery`: the identity worth latching on
 * is not always the cache key. `useAppsData` is the proof — it latches on
 * `(tab, origin)` while caching on `origin` alone, so two Chrome tabs on one org
 * share an inventory.
 *
 * This implementation uses the comparison idiom, which is strictly stronger than
 * the boolean one: if the input changes A → B → A while hidden, a boolean says a
 * load is owed and re-fetches A, while a comparison sees A is already paid for and
 * does nothing.
 */
import { useEffect, useRef } from 'react';

/**
 * A value identifying "which input this work was done for".
 *
 * Compared with `===`, so it must be a primitive. Compose a multi-part identity
 * into a string at the call site (`` `${targetTabId}:${groupId}` ``) rather than
 * passing an object, whose identity would change every render and defeat the latch.
 */
export type OwedIdentity = string | number | null | undefined;

/**
 * Run `run` once for each distinct `identity`, but only while `ready`.
 *
 * While `ready` is `false` the work is **deferred, not dropped**: a change of
 * `identity` in the meantime is remembered, and the work runs on the next render
 * where `ready` becomes `true`. Once run for a given `identity`, it does not run
 * again for that same value — so a surface being hidden and shown, with nothing
 * else changed, issues nothing.
 *
 * `identity` of `null` or `undefined` means "no meaningful input yet" and never
 * runs. That is the common case for an unresolved `targetTabId`, and it keeps the
 * "is the target known" test out of every caller's `ready` expression.
 *
 * `run` is read through a ref, so an inline closure is fine and does **not**
 * re-trigger. That is deliberate rather than a convenience: re-running when the
 * callback's captured values change is precisely the behaviour this hook exists to
 * prevent. `identity` is the only thing that should cause a second run — if some
 * other value ought to as well, it belongs *in* the identity.
 *
 * @param identity - Which input the work would be done for. See {@link OwedIdentity}.
 * @param ready - Whether the work may run now — typically a tab's `isActive`, but
 *   any precondition works (one caller uses "the group has finished opening").
 * @param run - The work. Called at most once per distinct `identity`.
 *
 * @example
 * ```ts
 * // Load a group's rule references once per (tab, group), deferred while hidden.
 * useOwedLoad(targetTabId == null ? null : `${targetTabId}:${groupId}`, isActive, () => {
 *   void loadReferences();
 * });
 * ```
 */
export function useOwedLoad(identity: OwedIdentity, ready: boolean, run: () => void): void {
  // Kept current in an effect rather than assigned during render: a render that
  // React discards must not mutate a ref. Effects run in declaration order, so this
  // lands before the latch below on every commit — including the commit where the
  // identity changed and the callback changed together.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  // `undefined` is the "nothing paid for yet" sentinel. It can never collide with a
  // real identity, because an `undefined` identity is skipped outright below.
  const paidFor = useRef<OwedIdentity>(undefined);

  useEffect(() => {
    if (!ready || identity === null || identity === undefined) return;
    if (paidFor.current === identity) return;
    paidFor.current = identity;
    runRef.current();
  }, [identity, ready]);
}
