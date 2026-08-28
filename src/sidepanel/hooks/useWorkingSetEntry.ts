/**
 * @module sidepanel/hooks/useWorkingSetEntry
 * @description Write side of the working set: the declarative recorder a detail
 * rung mounts to say "this is what is open".
 *
 * ## Why the rung, and not navigation
 *
 * The obvious homes for this are `NavigationContext` and `useViewStack`, and
 * both are wrong:
 *
 * - `NavigationContext` fires only on **cross-tab** jumps. Clicking a group row
 *   inside the Groups list — the common case by a distance — never touches it,
 *   so the working set would record only the entities you arrived at from
 *   somewhere else.
 * - `useViewStack` is generic over an opaque `TEntry`, so it cannot project
 *   `{ kind, id, name }` without a per-consumer projector anyway; its tests
 *   assert it has no side effects; and only two tabs have a stack at all.
 *
 * The rung is the one surface that knows all four facts at once — which kind,
 * which id, what it is called, and which pane you are reading. So it says so,
 * in two lines, and nothing in the navigation machinery changes.
 */
import { useEffect } from 'react';
import { workingSetStore, type WorkingSetKind } from '../../shared/storage/workingSetStore';

/** Options for {@link useWorkingSetEntry}. */
export interface UseWorkingSetEntryOptions {
  /** Okta org origin. `null` records nothing. */
  origin: string | null | undefined;
  /** Which detail rung this is. */
  kind: WorkingSetKind;
  /** Okta id of the open entity, or `null`/`undefined` on a rung with none. */
  id: string | null | undefined;
  /** Display name, as the header shows it. */
  name: string | null | undefined;
  /**
   * Which pane is open, when the rung has panes. Changing it rewrites the
   * entry, so a returning reader lands where they left off. Omit on a rung
   * without panes rather than inventing a location.
   */
  pane?: string;
  /**
   * Whether to record. Pass the tab's `isActive`: tabs stay mounted (ADR-0018),
   * so a hidden rung would otherwise keep re-asserting itself as "most recent"
   * over whatever the reader is actually looking at.
   */
  enabled?: boolean;
}

/**
 * Record the entity this rung has open, and keep its pane up to date.
 *
 * @param options - See {@link UseWorkingSetEntryOptions}.
 *
 * @example
 * ```ts
 * useWorkingSetEntry({
 *   origin: oktaOrigin,
 *   kind: 'group',
 *   id: group?.id,
 *   name: group?.name,
 *   pane: activePane,
 *   enabled: isActive,
 * });
 * ```
 */
export function useWorkingSetEntry({
  origin,
  kind,
  id,
  name,
  pane,
  enabled = true,
}: UseWorkingSetEntryOptions): void {
  useEffect(() => {
    if (!enabled || !origin || !id) return;
    // A nameless entity is one whose detail has not loaded yet. Recording it now
    // would put a row on Home reading the raw id, and the write that follows a
    // second later would be the one that fixed it — so wait for the name.
    if (!name) return;
    void workingSetStore.touch(origin, { kind, id, name, lastPane: pane });
  }, [origin, kind, id, name, pane, enabled]);
}
