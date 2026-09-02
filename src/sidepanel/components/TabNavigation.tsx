/**
 * @module sidepanel/components/TabNavigation
 * @description The top icon rail for switching between the side panel's main views.
 *
 * Renders `RAIL_TAB_DEFS` from the central {@link module:sidepanel/tabs} registry
 * via the shared accessible {@link Tabs} strip (`rail` variant) and highlights the
 * active one. That is a **subset** of the sections the panel has: Explorer and
 * History carry `railHidden` and are reached through the ⌘K palette instead
 * (ADR-0063), so on either of them this rail shows no active tab and no
 * indicator — which is the honest rendering, not a bug. Even seven text tabs need well past 450px of strip; the panel opens at 480 and
 * the user can drag it to 360, so inactive tabs render as icons only and the active
 * tab's label unfurls beside its glyph. Every tab keeps its label as its accessible
 * name whether or not that label is currently visible, and carries a `Tooltip`
 * naming it on hover and on focus.
 *
 * This `<nav>` is also the **bottom of the top-chrome slab**. `ContextBar`, the rail
 * and a detail rung's `PageHeader` used to carry a hairline each, stacking four
 * horizontal rules into the first ~150px of a ~520px panel and leaving the rail
 * bordered above *and* below — a strip detached from both its neighbours. They are
 * now one white surface separated by spacing and type weight, and the single rule
 * that closes the chrome against what follows lives here: on the last band of the
 * slab, so the slab keeps its edge against whatever scrolls beneath it.
 *
 * ## The ⌘K affordance lives here, not on `ContextBar`
 *
 * ADR-0063 left Explorer and History with no rail seat and the palette as their
 * only route, and nothing on screen said so — the chord was undiscoverable, and
 * `useCommandPalette().open()` had no caller at all. The affordance that fixes
 * that belongs at the trailing end of *this* strip, because this strip is where a
 * user goes looking for a section and finds it missing. `ContextBar`'s two
 * controls (Refresh, Pin) are verbs about the **live Okta tab**; jumping between
 * the panel's own sections is not one of them, and ADR-0032 keeps those two
 * subjects apart.
 *
 * It is not `sticky`, and it publishes no height. The rail sits **outside** the
 * panel's scroller entirely (`App`), so there is nothing for it to stick to and
 * nothing below it that needs to park clear of it: a `PageHeader` inside the
 * scroller pins at that scroller's own top edge, which already begins under this
 * rail. `--rail-h` was that offset and is gone with it — every consumer read it
 * through a `var(--rail-h, 0px)` fallback, so the arithmetic collapses cleanly to
 * the header's own height (ADR-0032, amended).
 */
import React from 'react';
import { Button, Tabs, type TabItem } from './shared';
import { RAIL_TAB_DEFS, type TabType } from '../tabs';

export type { TabType } from '../tabs';

/**
 * Which modifier the ⌘K chord is printed with. `apple` prints `⌘K`; everything
 * else prints `Ctrl K`, which is the chord `useCommandPalette` actually listens
 * for off a Mac.
 */
export type ShortcutPlatform = 'apple' | 'other';

/** Props for {@link TabNavigation}. */
interface TabNavigationProps {
  /** Currently selected tab, rendered with its label unfurled and the indicator beneath. */
  activeTab: TabType;
  /** Called with the chosen tab id when a tab is clicked. */
  onTabChange: (tab: TabType) => void;
  /**
   * Opens the ⌘K palette. Wire this to `useCommandPalette().open` — the shell
   * owns that state, because the chord's listener has to be registered exactly
   * once (ADR-0018 keeps every tab mounted).
   */
  onOpenCommandPalette: () => void;
  /**
   * Which chord glyph to print. Defaults to the running platform, detected from
   * the user agent; pass it explicitly to render the other one (the stories show
   * both, and a Mac user should never be told to press Ctrl).
   */
  shortcutPlatform?: ShortcutPlatform;
}

/** The chord as it is drawn — a symbol on Apple platforms, a word elsewhere. */
const CHORD_GLYPH: Record<ShortcutPlatform, string> = {
  apple: '⌘K',
  other: 'Ctrl K',
};

/**
 * The chord as it is *spoken*. `⌘` has no reliable pronunciation across screen
 * readers, so the button's accessible name spells the modifier out instead of
 * leaving a reader to guess at a glyph.
 */
const CHORD_SPOKEN: Record<ShortcutPlatform, string> = {
  apple: 'Command K',
  other: 'Ctrl K',
};

/**
 * Whether this panel is running on an Apple platform.
 *
 * Read from the user-agent string rather than the deprecated
 * `navigator.platform`, and `globalThis.`-qualified for the same reason
 * `useCommandPalette` qualifies `KeyboardEvent`: eslint's `no-undef` runs off the
 * explicit DOM globals allow-list in `eslint.config.js`.
 */
function isApplePlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(globalThis.navigator.userAgent);
}

// `RAIL_TAB_DEFS`, not `TAB_DEFS`: Explorer and History are sections without a
// rail seat, reached through the ⌘K palette (ADR-0063). The rail is the only
// consumer that reads the shorter list — everything enumerating *sections* reads
// the full registry, or a rail-hidden tab becomes unreachable rather than
// keyboard-only.
const TAB_ITEMS: TabItem[] = RAIL_TAB_DEFS.map(({ id, label, icon }) => ({
  key: id,
  label,
  icon,
}));

/**
 * Renders the horizontal tab navigation, the ⌘K palette affordance beside it, and
 * reports selection via `onTabChange`.
 */
const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  onOpenCommandPalette,
  shortcutPlatform,
}) => {
  const platform: ShortcutPlatform = shortcutPlatform ?? (isApplePlatform() ? 'apple' : 'other');

  return (
    <nav className="shrink-0 flex items-center bg-white border-b border-neutral-200">
      {/* `min-w-0` so the strip, not the button, is what gives way as the panel
          narrows: the rail already scrolls with edge fades, and a ⌘K control that
          shrinks out of existence at 360px is exactly the control this fixes. */}
      <Tabs
        tabs={TAB_ITEMS}
        activeKey={activeTab}
        onChange={(key) => onTabChange(key as TabType)}
        variant="rail"
        ariaLabel="Main sections"
        className="min-w-0 flex-1"
      />
      {/* Outside the tablist on purpose — it is not a ninth section, and a
          `role="tab"` sibling that opens a dialog would lie to a reader. The
          `mb-1.5` cancels the rail's own `pb-1.5` (its indicator track) so the
          button's box lines up with the tab rows rather than the strip's padding.

          No native `title=`: `docs/components.md` bans it in new code, and here it
          would also be pure redundancy — content already supplies the accessible
          name, so a `title` falls through to the *description* and a reader would
          announce near-identical text twice. The visible glyph covers the sighted
          case, the `sr-only` span covers the spoken one. */}
      <Button
        variant="ghost"
        size="sm"
        icon="search"
        onClick={onOpenCommandPalette}
        className="shrink-0 mb-1.5 me-(--sp-gutter)"
      >
        <span className="sr-only">Search and jump to a section, {CHORD_SPOKEN[platform]}</span>
        {/* Hidden from the reader because the name above already says it, in
            words: a glyph read aloud as "place of interest sign" is noise. */}
        <span aria-hidden="true">{CHORD_GLYPH[platform]}</span>
      </Button>
    </nav>
  );
};

export default TabNavigation;
