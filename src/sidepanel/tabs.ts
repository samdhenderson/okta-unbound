/**
 * @module sidepanel/tabs
 * @description Central registry of the side panel's top-level tabs.
 *
 * Single source of truth for the tab id union, the display order/labels the
 * {@link module:sidepanel/components/TabNavigation} bar renders, and the
 * migration of retired tab ids persisted by older versions. Adding a new
 * top-level section (e.g. Applications, Authentication Policies) means adding
 * one entry here — the navigation bar and persistence-restore pick it up.
 */
import type { IconType } from './components/shared/Icon';

/** Identifier for each top-level side-panel tab. */
export type TabType =
  | 'home'
  | 'overview'
  | 'rules'
  | 'users'
  | 'groups'
  | 'apps'
  | 'policies'
  | 'export'
  | 'explorer'
  | 'history';

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
  { id: 'overview', label: 'Overview', icon: 'chart' },
  { id: 'users', label: 'Users', icon: 'user' },
  { id: 'groups', label: 'Groups', icon: 'users' },
  { id: 'apps', label: 'Apps', icon: 'app' },
  { id: 'rules', label: 'Rules', icon: 'bolt' },
  { id: 'policies', label: 'Policies', icon: 'shield' },
  { id: 'export', label: 'Export', icon: 'download' },
  { id: 'explorer', label: 'Explorer', icon: 'terminal' },
  { id: 'history', label: 'History', icon: 'clipboard' },
];

/**
 * Retired tab ids from earlier versions mapped to their current equivalents.
 *
 * NOTE: `'apps'` is no longer listed here. It used to be a retired id migrated to
 * `'overview'`; now that the Applications tab exists it is a real {@link TabType},
 * so a saved `'apps'` selection passes through {@link migrateLegacyTabId}
 * unchanged and restores the Applications tab.
 */
const LEGACY_TAB_MAP: Readonly<Record<string, TabType>> = {
  dashboard: 'overview',
  operations: 'overview',
  security: 'overview',
  undo: 'history',
};

/**
 * Resolve a persisted tab id (which may predate the current tab set) to a valid
 * {@link TabType}.
 *
 * Current ids pass through unchanged; retired ids map to their successors; any
 * unrecognized value falls back to the first tab rather than being trusted.
 *
 * The fallback is `'home'`, not `'overview'`: Home is the tab the rail opens on,
 * so an unreadable saved value lands where a first-time user lands. `'overview'`
 * is still a real {@link TabType} and still passes through unchanged — it is
 * being retired, and the legacy entries pointing at it move when it goes.
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
