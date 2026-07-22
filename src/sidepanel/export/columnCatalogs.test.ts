/**
 * @module sidepanel/export/columnCatalogs.test
 * @description Contract tests for every export descriptor's column catalog.
 *
 * Each descriptor declares a `columnCatalog` of `{ accessor, format? }` columns.
 * These are pure, per-column functions that the per-descriptor tests only spot
 * check. This suite walks the whole registry and exercises EVERY column's
 * accessor and formatter, pinning two invariants across all exports at once:
 *   - every accessor is callable and null-safe (never throws on a sparse row), and
 *   - every formatter returns a string for both a populated and an empty value.
 *
 * It builds the registry with stub search deps so the search-to-select factory
 * descriptors (group memberships, app users/groups) are included too.
 */

import { describe, expect, it } from 'vitest';
import { buildRegistry, listDescriptors } from './registry';
import type { ExportApiDeps } from './types.deps';

/** Stub deps so factory descriptors register without any live API. */
const stubDeps: ExportApiDeps = {
  searchGroups: async () => [],
  searchApps: async () => [],
};

/**
 * A generously populated row that satisfies the paths any descriptor's accessors
 * read. Extra fields are ignored per descriptor; missing ones resolve to
 * `undefined` through the accessors' optional chaining. Cast to `never` so it can
 * stand in for each descriptor's distinct row type.
 */
const populatedRow = {
  id: '00uFAKE',
  status: 'ACTIVE',
  created: '2024-01-01T00:00:00.000Z',
  activated: '2024-01-01T00:00:00.000Z',
  lastLogin: '2024-01-02T00:00:00.000Z',
  lastUpdated: '2024-01-03T00:00:00.000Z',
  lastMembershipUpdated: '2024-01-03T00:00:00.000Z',
  name: 'Fake Entity',
  label: 'Fake Entity',
  type: 'OKTA_GROUP',
  scope: 'ACTIVE',
  registered: true,
  profile: {
    login: 'user@example.com',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Engineer',
    manager: 'Grace Hopper',
    displayName: 'Fake Device',
    platform: 'MACOS',
    manufacturer: 'Apple',
    model: 'MacBook Pro',
    osVersion: '14.0',
    serialNumber: 'SN-FAKE',
    name: 'Fake Group',
    description: 'A fake group for tests',
  },
} as never;

/** An empty row to exercise each function's null-safe / falsy path too. */
const emptyRow = {} as never;

describe('export column catalogs', () => {
  const registry = buildRegistry(stubDeps);
  const descriptors = listDescriptors(registry);

  it('registers at least the core descriptors', () => {
    expect(descriptors.length).toBeGreaterThan(0);
  });

  for (const descriptor of descriptors) {
    describe(`${descriptor.id} columns`, () => {
      it('has a non-empty, well-formed column catalog', () => {
        expect(descriptor.columnCatalog.length).toBeGreaterThan(0);
        for (const column of descriptor.columnCatalog) {
          expect(typeof column.id).toBe('string');
          expect(typeof column.accessor).toBe('function');
        }
      });

      it('exercises every accessor and formatter without throwing', () => {
        for (const column of descriptor.columnCatalog) {
          for (const row of [populatedRow, emptyRow]) {
            const value = column.accessor(row);
            // Accessors are read-only property access; they must never throw.
            expect(() => column.accessor(row)).not.toThrow();
            if (column.format) {
              const formatted = column.format(value, row);
              expect(typeof formatted).toBe('string');
            }
          }
        }
      });
    });
  }
});
