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
    ['apps', 'overview'],
    ['undo', 'history'],
  ])('migrates retired id %s to %s', (legacy, expected) => {
    expect(migrateLegacyTabId(legacy)).toBe(expected);
  });

  it('passes every current tab id through unchanged', () => {
    for (const { id } of TAB_DEFS) {
      expect(migrateLegacyTabId(id)).toBe(id);
    }
  });

  it('falls back to overview for unknown ids', () => {
    expect(migrateLegacyTabId('not-a-tab')).toBe('overview');
    expect(migrateLegacyTabId('')).toBe('overview');
  });
});

describe('TAB_DEFS', () => {
  it('has unique ids', () => {
    const ids = TAB_DEFS.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
