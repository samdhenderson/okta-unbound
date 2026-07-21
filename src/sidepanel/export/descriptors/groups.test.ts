/**
 * @module sidepanel/export/descriptors/groups.test
 * @description Unit coverage for the Groups (with stats) export descriptor:
 * identity/endpoint/`expand=stats` contract, local stats-aware schema acceptance
 * of an `_embedded.stats` row (and the `memberCount` accessor reading it), and
 * lenient parsing of a row missing `_embedded` (stats accessor → undefined).
 */

import { describe, it, expect } from 'vitest';
import groupsDescriptor, { groupWithStatsSchema } from './groups';

describe('groups descriptor', () => {
  it('declares stable identity, endpoint, and expand=stats default query', () => {
    expect(groupsDescriptor.id).toBe('groups');
    expect(groupsDescriptor.endpoint).toBe('/api/v1/groups');
    expect(groupsDescriptor.defaultQuery.expand).toBe('stats');
  });

  it('parses a row with _embedded.stats and memberCount reads usersCount', () => {
    const row = {
      id: '00gFAKE1',
      type: 'OKTA_GROUP',
      profile: { name: 'Sales', description: 'Sales team' },
      _embedded: { stats: { usersCount: 42, appsCount: 3, groupPushMappingsCount: 1 } },
    };
    const parsed = groupWithStatsSchema.parse(row);
    const col = groupsDescriptor.columnCatalog.find((c) => c.id === 'memberCount');
    expect(col).toBeDefined();
    expect(col!.accessor(parsed)).toBe(42);
  });

  it('parses a lenient row missing _embedded (stats accessor → undefined)', () => {
    const row = { id: '00gFAKE2', profile: { name: 'Engineering' } };
    const parsed = groupWithStatsSchema.parse(row);
    const col = groupsDescriptor.columnCatalog.find((c) => c.id === 'memberCount');
    expect(col!.accessor(parsed)).toBeUndefined();
  });
});
