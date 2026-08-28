/**
 * @module sidepanel/tabs.test
 * @description Unit tests for the central tab registry's legacy-id migration.
 */
import { describe, expect, it } from 'vitest';
import { TAB_DEFS, migrateLegacyTabId, type TabType } from './tabs';

describe('migrateLegacyTabId', () => {
  it.each<[string, TabType]>([
    ['dashboard', 'overview'],
    ['operations', 'overview'],
    ['security', 'overview'],
    ['undo', 'history'],
  ])('migrates retired id %s to %s', (legacy, expected) => {
    expect(migrateLegacyTabId(legacy)).toBe(expected);
  });

  // `'apps'` used to be a retired id migrated to `'overview'`. The Applications
  // tab now exists, so it is a real tab id and must pass through untouched — a
  // saved `'apps'` selection restores the Applications tab.
  it('passes the no-longer-retired apps id through', () => {
    expect(migrateLegacyTabId('apps')).toBe('apps');
  });

  it('passes every current tab id through unchanged', () => {
    for (const { id } of TAB_DEFS) {
      expect(migrateLegacyTabId(id)).toBe(id);
    }
  });

  // The fallback moved from `'overview'` to `'home'` when Home became the tab
  // the rail opens on: an unreadable saved value should land where a first-time
  // user lands. The retired ids above still point at `'overview'` while it
  // exists, and move with it when it is removed.
  it('falls back to home for unknown ids', () => {
    expect(migrateLegacyTabId('not-a-tab')).toBe('home');
    expect(migrateLegacyTabId('')).toBe('home');
  });

  it('passes the new home id through', () => {
    expect(migrateLegacyTabId('home')).toBe('home');
  });
});
