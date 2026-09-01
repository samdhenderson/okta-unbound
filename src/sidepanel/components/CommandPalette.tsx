/**
 * @module sidepanel/components/CommandPalette
 * @description The ⌘K palette's data half: everything
 * {@link module:sidepanel/components/TabJumpPalette} renders but does not own.
 *
 * The split exists so the palette itself stays a props-in component. Its stories
 * and unit tests render it with no API client, no IndexedDB, and no navigation
 * context, which is what keeps them about the palette rather than about the
 * plumbing behind it — and it keeps the rendering component under the size rule.
 *
 * ## Two gates, both load-bearing
 *
 * This component is mounted at the shell for the whole session, next to the
 * modal layer, because the ⌘K listener has to be. That makes it the one place in
 * the panel where "mounted" says nothing at all about whether the user is
 * looking at it, so both costs are gated on `isOpen` explicitly:
 *
 * - **`enabled: isOpen`** on the resolver. Without it, a query left in the field
 *   keeps fanning out over the org from a closed dialog (ADR-0018's rule,
 *   applied to a surface that is never "the active tab").
 * - **`oktaOrigin: hasOpened ? … : null`** on the index. `useOrgEntityIndex`
 *   opens four IndexedDB reads and registers four `snapshotUpdated` listeners,
 *   and Home already pays for one set. A palette that is never summoned should
 *   not pay for a second, so nothing is read until the first ⌘K — after which
 *   the latch stays down, because re-reading on every open would be worse.
 *
 * The duplicate index is a known cost, not an oversight: two mounts of the same
 * four collections for one org. Lifting it into a provider both Home and this
 * share is real work with its own blast radius, tracked as `I-033` rather than
 * smuggled into this change.
 */
import React, { useCallback, useMemo, useState } from 'react';
import TabJumpPalette, { type SectionMeta } from './TabJumpPalette';
import { useOktaApi } from '../hooks/useOktaApi';
import { useOrgEntityIndex } from '../hooks/useOrgEntityIndex';
import { useEntitySearchSources } from '../hooks/useEntitySearchSources';
import { useJumpResolver, JUMP_SEARCH_MIN_CHARS, type JumpKind } from '../hooks/useJumpResolver';
import { useEntityNavigation } from '../contexts/NavigationContext';
import { navigationTarget } from './home/jumpDestinations';
import type { JumpResult } from '../hooks/useJumpResolver';
import type { TabType } from '../tabs';

/**
 * The kinds ⌘K searches — every kind the panel can open.
 *
 * Module-level and frozen by `as const` because
 * {@link module:sidepanel/hooks/useEntitySearchSources} memoizes on this
 * reference; an inline literal would re-issue the whole fan-out on every render
 * of this component.
 */
const PALETTE_JUMP_KINDS = ['group', 'app', 'rule', 'policy', 'user'] as const;

/** Props for {@link CommandPalette}. */
export interface CommandPaletteProps {
  /** Whether the palette is open. Gates every cost this component can incur. */
  isOpen: boolean;
  /** Close the palette. Typically `useCommandPalette().close`. */
  onClose: () => void;
  /** The section currently on screen. */
  activeTab: TabType;
  /** Jump to a section — the same handler the icon rail uses. */
  onSelect: (tab: TabType) => void;
  /** Live Okta tab the background routes through. */
  targetTabId: number | null;
  /** Connected org origin. Scopes the snapshot read and the Okta fallback links. */
  oktaOrigin?: string | null;
}

/**
 * Wire the ⌘K palette to the org.
 *
 * @param props - See {@link CommandPaletteProps}.
 *
 * @example
 * ```tsx
 * const palette = useCommandPalette();
 * <CommandPalette
 *   isOpen={palette.isOpen}
 *   onClose={palette.close}
 *   activeTab={activeTab}
 *   onSelect={handleTabChange}
 *   targetTabId={tabContext.targetTabId ?? null}
 *   oktaOrigin={tabContext.oktaOrigin}
 * />
 * ```
 */
const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelect,
  targetTabId,
  oktaOrigin,
}) => {
  // Latched, never released: the snapshot is read from the first ⌘K onward, and
  // not at all before it. Releasing it on close would re-open four IndexedDB
  // reads on every summon, which is the opposite of the saving.
  const [hasOpened, setHasOpened] = useState(false);
  if (isOpen && !hasOpened) setHasOpened(true);

  const nav = useEntityNavigation();

  // No `onResult`/`onProgress`: the facade memoizes its operations on those
  // callbacks' identities, and this surface has nowhere to render either.
  const api = useOktaApi({ targetTabId, oktaOrigin: oktaOrigin ?? undefined });

  const index = useOrgEntityIndex({
    oktaOrigin: hasOpened ? oktaOrigin : null,
    targetTabId,
    enabled: isOpen,
  });

  const { searchers, fetchers } = useEntitySearchSources({
    api,
    index,
    kinds: PALETTE_JUMP_KINDS,
  });

  const jump = useJumpResolver({ index, searchers, fetchers, enabled: isOpen });

  const { setQuery, clear } = jump;

  const handleClose = useCallback(() => {
    // Re-opening starts clean, matching what the sections half already does by
    // resetting its query during render.
    clear();
    onClose();
  }, [clear, onClose]);

  const handleEntitySelect = useCallback(
    (result: JumpResult) => {
      nav.navigateTo({ type: navigationTarget(result.kind), id: result.id });
    },
    [nav],
  );

  const canReach = useCallback(
    (kind: JumpKind) => nav.canNavigateTo(navigationTarget(kind)),
    [nav],
  );

  // Which sections can say "from snapshot", and which of those are still
  // provisional. Users and policies are always live — users because they are not
  // stored at all (ADR-0040 §5), policies because they are not a snapshot
  // collection — and saying so is more honest than a silent asymmetry.
  const sectionMeta = useMemo<Partial<Record<JumpKind, SectionMeta>>>(
    () => ({
      group: { fromSnapshot: false, complete: true },
      rule: { fromSnapshot: true, complete: index.isAuthoritative('rule') },
      app: { fromSnapshot: true, complete: index.isAuthoritative('app') },
      policy: { fromSnapshot: false, complete: true },
      user: { fromSnapshot: false, complete: true },
    }),
    [index],
  );

  return (
    <TabJumpPalette
      isOpen={isOpen}
      onClose={handleClose}
      activeTab={activeTab}
      onSelect={onSelect}
      onEntityQueryChange={setQuery}
      entityMode={jump.mode}
      entityResults={jump.results}
      entityError={jump.error}
      onEntitySelect={handleEntitySelect}
      canReach={canReach}
      sectionMeta={sectionMeta}
      oktaOrigin={oktaOrigin}
      entityMinChars={JUMP_SEARCH_MIN_CHARS}
    />
  );
};

export default CommandPalette;
