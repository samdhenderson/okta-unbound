/**
 * @module sidepanel/export/descriptors/appGroups.test
 * @description Unit tests for the App Groups export descriptor — a pure
 * declarative object, so these assertions cover its shape: the search-to-select
 * endpoint builder, the group deep-link config, and lenient schema acceptance.
 */

import { describe, it, expect } from 'vitest';
import appGroupsDescriptor, { appGroupSchema } from './appGroups';

describe('appGroupsDescriptor', () => {
  it('builds the app-scoped groups endpoint from the chosen app id', () => {
    expect(appGroupsDescriptor.context.kind).toBe('search-to-select');
    if (appGroupsDescriptor.context.kind !== 'search-to-select') return;
    expect(appGroupsDescriptor.context.endpoint('0oaFAKE1')).toBe('/api/v1/apps/0oaFAKE1/groups');
  });

  it('deep-links each row as a group', () => {
    expect(appGroupsDescriptor.linkify?.entityType).toBe('group');
    expect(appGroupsDescriptor.linkify?.idColumnId).toBe('id');
  });

  it('accepts a minimal app-group row', () => {
    expect(appGroupSchema.parse({ id: '00gFAKE1', priority: 1 })).toMatchObject({
      id: '00gFAKE1',
      priority: 1,
    });
  });
});
