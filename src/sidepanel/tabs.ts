/**
 * @module sidepanel/tabs
 * @description Central registry of the side panel's top-level tabs.
 *
 * Single source of truth for the tab id union, the display order/labels the
 * {@link module:sidepanel/components/TabNavigation} bar renders, and the
 * migration of retired tab ids persisted by older versions. Adding a new
 * top-level section (e.g. Applications, Authentication Policies) means adding
 * one entry here — the navigation bar and persistence-restore pick it up.
 *
 * ## A section is not the same thing as a rail seat
 *
 * {@link TAB_DEFS} is every section the panel has. {@link RAIL_TAB_DEFS} is the
 * subset the icon rail gives a permanent glyph to. They differ by
 * {@link TabDef.railHidden}, which Explorer and History carry: both are reached
 * through the ⌘K palette instead (ADR-0063). Enumerating sections — the palette,
 * the id migration, a destination label — reads `TAB_DEFS`; only the rail itself
 * reads the shorter list.
 */
import type { IconType } from './components/shared/Icon';

/** Identifier for each top-level side-panel tab. */
export type TabType =
  'home' | 'rules' | 'users' | 'groups' | 'apps' | 'policies' | 'export' | 'explorer' | 'history';

/** One top-level tab: its stable id, its visible label, and its rail glyph. */
export interface TabDef {
  /** Stable id, persisted in `chrome.storage.local` and matched on restore. */
  id: TabType;
  /**
   * Visible label. Also the tab's accessible name in the icon rail, where it is
   * the only text an inactive (icon-only) tab exposes — keep it short enough to
   * unfurl inside a 360px panel.
   */
  label: string;
  /**
   * Glyph shown by the `rail` variant of the shared `Tabs` strip. Every name
   * must already exist in the {@link IconType} registry; the rail is icon-first,
   * so a tab without a distinct glyph is not addable here.
   */
  icon: IconType;
  /**
   * Set when this section has **no seat in the icon rail** and is reached only
   * through the ⌘K palette (ADR-0063).
   *
   * The tab still exists in every other sense — it is a real `TabType`, it is
   * persisted and restored, `EntityLink` can send you to it, and the palette
   * lists it beside the rest. What it does not have is a permanent glyph in a
   * strip that has to survive a 360px panel.
   *
   * Deliberately optional rather than a boolean on all nine: the rail is the
   * default, and a tab opting out of it is the thing worth reading in this file.
   */
  railHidden?: true;
}

/**
 * The top-level tabs in display order, with their visible labels and rail glyphs.
 *
 * @remarks The `policies` label is `'Policies'`, not `'Auth Policies'` — the rail
 * unfurls exactly one label at a time and the shorter word survives a 360px panel.
 * The export descriptor's `displayName: 'Auth Policies'` is a different concept
 * and deliberately unchanged.
 */
export const TAB_DEFS: ReadonlyArray<TabDef> = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'users', label: 'Users', icon: 'user' },
  { id: 'groups', label: 'Groups', icon: 'users' },
  { id: 'apps', label: 'Apps', icon: 'app' },
  { id: 'rules', label: 'Rules', icon: 'bolt' },
  { id: 'policies', label: 'Policies', icon: 'shield' },
  { id: 'export', label: 'Export', icon: 'download' },
  // The two power-user sections. Both are destinations you go to on purpose,
  // having decided to — not things you browse into — so neither earns a
  // permanent seat in a strip that has to fit nine glyphs into 360px. ⌘K is
  // their route. See ADR-0063 for the trade, including what it costs.
  { id: 'explorer', label: 'Explorer', icon: 'terminal', railHidden: true },
  { id: 'history', label: 'History', icon: 'clipboard', railHidden: true },
];

/**
 * The tabs the icon rail actually renders, in display order.
 *
 * A strict subset of {@link TAB_DEFS} — never a second registry. Everything that
 * enumerates *sections* (the ⌘K palette, `migrateLegacyTabId`,
 * `destinationLabel`) reads `TAB_DEFS`; only the rail reads this. Getting that
 * backwards would make a rail-hidden section unreachable rather than
 * keyboard-only.
 */
export const RAIL_TAB_DEFS: ReadonlyArray<TabDef> = TAB_DEFS.filter((def) => !def.railHidden);

/**
 * Retired tab ids from earlier versions mapped to their current equivalents.
 *
 * `'overview'` is listed like any other retired id. It was the panel's landing
 * tab for most of this extension's life, so it is the id most likely to be
 * sitting in an existing install's `chrome.storage.local` — and Home is what
 * replaced it, both in position and in job.
 *
 * NOTE: `'apps'` is no longer listed here. It used to be a retired id migrated to
 * `'overview'`; now that the Applications tab exists it is a real {@link TabType},
 * so a saved `'apps'` selection passes through {@link migrateLegacyTabId}
 * unchanged and restores the Applications tab.
 */
const LEGACY_TAB_MAP: Readonly<Record<string, TabType>> = {
  overview: 'home',
  dashboard: 'home',
  operations: 'home',
  security: 'home',
  undo: 'history',
};

/**
 * Resolve a persisted tab id (which may predate the current tab set) to a valid
 * {@link TabType}.
 *
 * Current ids pass through unchanged; retired ids map to their successors; any
 * unrecognized value falls back to the first tab rather than being trusted.
 *
 * The fallback is `'home'`: it is the tab the rail opens on, so an unreadable
 * saved value lands where a first-time user lands.
 *
 * @param saved - The raw tab id read from `chrome.storage.local`.
 * @returns A valid current tab id.
 */
export function migrateLegacyTabId(saved: string): TabType {
  if (TAB_DEFS.some((tab) => tab.id === saved)) {
    return saved as TabType;
  }
  return LEGACY_TAB_MAP[saved] ?? 'home';
}
