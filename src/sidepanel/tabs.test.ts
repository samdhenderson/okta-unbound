/**
 * @module sidepanel/tabs.test
 * @description Unit tests for the central tab registry's legacy-id migration.
 */
import { describe, expect, it } from 'vitest';
import { TAB_DEFS, migrateLegacyTabId, type TabType } from './tabs';

describe('migrateLegacyTabId', () => {
  it.each<[string, TabType]>([
    // `'overview'` joined this list when the Overview tab was removed. It was
    // the panel's landing tab for most of this extension's life, so it is the
    // id most likely to be sitting in an existing install's storage.
    ['overview', 'home'],
    ['dashboard', 'home'],
    ['operations', 'home'],
    ['security', 'home'],
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

  // The fallback is `'home'` because Home is the tab the rail opens on: an
  // unreadable saved value should land where a first-time user lands.
  it('falls back to home for unknown ids', () => {
    expect(migrateLegacyTabId('not-a-tab')).toBe('home');
    expect(migrateLegacyTabId('')).toBe('home');
  });

  it('passes the new home id through', () => {
    expect(migrateLegacyTabId('home')).toBe('home');
  });
});
