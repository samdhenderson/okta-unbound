/**
 * @module sidepanel/components/home/jumpDestinations
 * @description Where each resolvable entity kind sends the reader, and what the
 * row says it will do.
 *
 * The Home tab's jump bar mixes result kinds in one list — a group, the rules
 * that feed it, the user you searched for. A row that does not say where it
 * goes is a guess, so **every result row names its destination on the right
 * edge** (`Groups ›`, `Rules ›`). This module is the mapping behind that label.
 *
 * It is the side-panel half of a deliberate split. {@link module:shared/utils/oktaId}
 * classifies an id and knows nothing about tabs, so `src/shared/` stays free of
 * `src/sidepanel/` imports and the ⌘K palette can reuse the classifier. Naming a
 * *destination* is UI knowledge, so it lives here.
 *
 * ## The label is not written down here
 *
 * It is read from {@link module:sidepanel/tabs}' `TAB_DEFS`, the same array the
 * icon rail renders. Writing `'Groups'` in this file would create a second
 * source of truth for a tab's name, and the two would drift the first time a tab
 * was renamed — the rail would say one thing and the jump row another.
 *
 * ## Reachability is decided at render time, not here
 *
 * This table says which tab *owns* a kind. Whether the app can currently open
 * that tab at a specific entity is
 * {@link module:sidepanel/contexts/NavigationContext}'s `canNavigateTo`, which
 * is per-build. Every kind has a handler as of ADR-0062, so it answers `true`
 * for all five today — but a caller still asks both: this module for the
 * destination, the context for whether it is reachable, and degrades the row to
 * an "Open in Okta" link when it is not. Keeping the two apart is what stopped
 * this file from encoding a claim that went stale the moment `app` and `policy`
 * were wired.
 */
import type { JumpKind } from '../../hooks/useJumpResolver';
import type { EntityType } from '../../contexts/NavigationContext';
import { TAB_DEFS, type TabType } from '../../tabs';
import type { IconType } from '../shared/Icon';

/**
 * Compile-time proof that every {@link JumpKind} is a navigable
 * {@link EntityType}.
 *
 * The two unions are declared independently — one describes what the panel can
 * search for, the other what it can navigate to — and they happen to share
 * spellings. This assignment fails to compile if that stops being true, which is
 * cheaper than discovering it as a silently unreachable row. It is also what
 * made widening `JumpKind` with `policy` safe rather than a guess: `EntityType`
 * already carried `'policy'`, so the proof held on the first compile.
 */
const KIND_TO_ENTITY_TYPE: Record<JumpKind, EntityType> = {
  group: 'group',
  user: 'user',
  app: 'app',
  rule: 'rule',
  policy: 'policy',
};

/** The tab that owns each searchable entity kind. */
export const DESTINATION_TAB: Readonly<Record<JumpKind, TabType>> = {
  group: 'groups',
  user: 'users',
  app: 'apps',
  rule: 'rules',
  policy: 'policies',
};

/**
 * Glyph shown at the head of a jump result row, from the fixed
 * {@link module:sidepanel/components/shared/Icon} registry.
 *
 * These match the rail's own glyphs for the destination tabs, so a row and the
 * tab it opens look like the same place.
 */
export const KIND_ICON: Readonly<Record<JumpKind, IconType>> = {
  group: 'users',
  user: 'user',
  app: 'app',
  rule: 'bolt',
  policy: 'shield',
};

/**
 * The destination tab's visible name, for a result row's right edge.
 *
 * @param kind - The resolved entity kind.
 * @returns The owning tab's label exactly as the icon rail spells it (`Groups`,
 * `Rules`, `Users`, `Apps`). The caller supplies the trailing chevron.
 *
 * @example
 * ```tsx
 * <span>{destinationLabel('rule')} ›</span>   // "Rules ›"
 * ```
 */
export function destinationLabel(kind: JumpKind): string {
  const tab = DESTINATION_TAB[kind];
  // TAB_DEFS is the rail's source of truth and always contains every TabType;
  // the fallback exists only so a future tab removal degrades to something
  // readable instead of `undefined`.
  return TAB_DEFS.find((def) => def.id === tab)?.label ?? tab;
}

/**
 * The navigation target for a resolved kind.
 *
 * A pass-through today, because {@link JumpKind} and {@link EntityType} share
 * spellings — but it gives callers one named place to go through, so a future
 * divergence is a change here rather than at every call site.
 *
 * @param kind - The resolved entity kind.
 * @returns The {@link EntityType} to hand to `navigateTo`.
 */
export function navigationTarget(kind: JumpKind): EntityType {
  return KIND_TO_ENTITY_TYPE[kind];
}
