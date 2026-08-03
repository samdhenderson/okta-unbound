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
export type TabType =
  'overview' | 'rules' | 'users' | 'groups' | 'apps' | 'policies' | 'export' | 'history';

/** The top-level tabs in display order, with their visible labels. */
export const TAB_DEFS: ReadonlyArray<{ id: TabType; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'groups', label: 'Groups' },
  { id: 'apps', label: 'Apps' },
  { id: 'rules', label: 'Rules' },
  { id: 'policies', label: 'Auth Policies' },
  { id: 'export', label: 'Export' },
  { id: 'history', label: 'History' },
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
