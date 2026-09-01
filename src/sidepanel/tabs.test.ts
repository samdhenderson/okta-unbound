/**
 * @module sidepanel/tabs.test
 * @description Unit tests for the central tab registry: its legacy-id migration,
 * and the rule that a section is not the same thing as a rail seat.
 */
import { describe, expect, it } from 'vitest';
import { RAIL_TAB_DEFS, TAB_DEFS, migrateLegacyTabId, type TabType } from './tabs';

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

describe('RAIL_TAB_DEFS', () => {
  it('is a strict subset of the full registry, in the same order', () => {
    // One filter apart, in one file — never a second registry that can drift.
    const railIds = RAIL_TAB_DEFS.map((def) => def.id);
    const sectionIds = TAB_DEFS.map((def) => def.id);

    expect(railIds.length).toBeLessThan(sectionIds.length);
    expect(sectionIds.filter((id) => railIds.includes(id))).toEqual(railIds);
  });

  it('withholds a seat from exactly the rail-hidden sections', () => {
    const railIds = RAIL_TAB_DEFS.map((def) => def.id);
    const hidden = TAB_DEFS.filter((def) => def.railHidden).map((def) => def.id);

    // Named, not counted: which two sections lose their glyph is the decision
    // (ADR-0063), and a count would let a future tab quietly join them.
    expect(hidden).toEqual(['explorer', 'history']);
    for (const id of hidden) {
      expect(railIds).not.toContain(id);
    }
  });

  it('leaves a rail-hidden section a real, restorable tab', () => {
    // Keyboard-only, not unreachable. The ⌘K palette enumerates TAB_DEFS, and a
    // user last on History still lands on History when the panel reopens — so
    // losing a rail seat must not touch the id, the migration, or persistence.
    for (const id of ['explorer', 'history'] as TabType[]) {
      expect(TAB_DEFS.some((def) => def.id === id)).toBe(true);
      expect(migrateLegacyTabId(id)).toBe(id);
    }
    expect(migrateLegacyTabId('undo')).toBe('history');
  });
});
