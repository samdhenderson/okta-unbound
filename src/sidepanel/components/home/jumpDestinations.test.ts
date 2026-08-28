/**
 * @module sidepanel/components/home/jumpDestinations.test
 * @description Unit tests for the entity-kind → destination-tab mapping.
 */
import { describe, it, expect } from 'vitest';
import { DESTINATION_TAB, KIND_ICON, destinationLabel, navigationTarget } from './jumpDestinations';
import type { OktaIdKind } from '../../../shared/utils/oktaId';
import { TAB_DEFS } from '../../tabs';

const ALL_KINDS: OktaIdKind[] = ['group', 'user', 'app', 'rule'];

describe('DESTINATION_TAB', () => {
  it('sends each kind to the tab that owns it', () => {
    expect(DESTINATION_TAB).toEqual({
      group: 'groups',
      user: 'users',
      app: 'apps',
      rule: 'rules',
    });
  });

  it('names only tabs that exist in the rail', () => {
    const railIds = TAB_DEFS.map((def) => def.id);
    for (const kind of ALL_KINDS) {
      expect(railIds).toContain(DESTINATION_TAB[kind]);
    }
  });
});

describe('destinationLabel', () => {
  it('reads the label from the rail rather than restating it', () => {
    // Not asserted against hardcoded strings: the point of the function is that
    // TAB_DEFS is the only place a tab is named, so the test resolves through it
    // too. A rename in tabs.ts must move both, or neither.
    for (const kind of ALL_KINDS) {
      const railLabel = TAB_DEFS.find((def) => def.id === DESTINATION_TAB[kind])?.label;
      expect(destinationLabel(kind)).toBe(railLabel);
    }
  });

  it('produces the labels the design specifies', () => {
    // The one place the expected copy is written down, so a rail rename that
    // breaks the design's contract is visible here.
    expect(destinationLabel('group')).toBe('Groups');
    expect(destinationLabel('rule')).toBe('Rules');
    expect(destinationLabel('user')).toBe('Users');
    expect(destinationLabel('app')).toBe('Apps');
  });
});

describe('navigationTarget', () => {
  it('maps each kind to its navigable entity type', () => {
    for (const kind of ALL_KINDS) {
      expect(navigationTarget(kind)).toBe(kind);
    }
  });
});

describe('KIND_ICON', () => {
  it('gives every kind a glyph', () => {
    for (const kind of ALL_KINDS) {
      expect(KIND_ICON[kind]).toBeTruthy();
    }
  });

  it('reuses the destination tab’s own rail glyph, so a row looks like where it goes', () => {
    for (const kind of ALL_KINDS) {
      const railIcon = TAB_DEFS.find((def) => def.id === DESTINATION_TAB[kind])?.icon;
      expect(KIND_ICON[kind]).toBe(railIcon);
    }
  });
});
