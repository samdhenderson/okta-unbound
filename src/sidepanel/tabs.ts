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

/** Identifier for each top-level side-panel tab. */
export type TabType = 'overview' | 'rules' | 'users' | 'groups' | 'export' | 'history';

/** The top-level tabs in display order, with their visible labels. */
export const TAB_DEFS: ReadonlyArray<{ id: TabType; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'groups', label: 'Groups' },
  { id: 'rules', label: 'Rules' },
  { id: 'export', label: 'Export' },
  { id: 'history', label: 'History' },
];

/**
 * Retired tab ids from earlier versions mapped to their current equivalents.
 *
 * NOTE: the retired `'apps'` id currently falls back to `'overview'`; when the
 * Applications tab lands, remove that entry so saved `'apps'` selections resolve
 * to the real tab instead of being migrated away.
 */
const LEGACY_TAB_MAP: Readonly<Record<string, TabType>> = {
  dashboard: 'overview',
  operations: 'overview',
  security: 'overview',
  apps: 'overview',
  undo: 'history',
};

/**
 * Resolve a persisted tab id (which may predate the current tab set) to a valid
 * {@link TabType}.
 *
 * Current ids pass through unchanged; retired ids map to their successors; any
 * unrecognized value falls back to `'overview'` rather than being trusted.
 *
 * @param saved - The raw tab id read from `chrome.storage.local`.
 * @returns A valid current tab id.
 */
export function migrateLegacyTabId(saved: string): TabType {
  if (TAB_DEFS.some((tab) => tab.id === saved)) {
    return saved as TabType;
  }
  return LEGACY_TAB_MAP[saved] ?? 'overview';
}
