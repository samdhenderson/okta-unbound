/**
 * @module sidepanel/export/registry.test
 * @description Unit tests for the descriptor registry assembly.
 *
 * Pins that `buildRegistry` keys descriptors by their `id`, includes the
 * reference `users` descriptor, and that `listDescriptors` returns them in
 * insertion order. The registry is the one append point new entities plug into,
 * so this guards the shape the entity hub and engine rely on.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildRegistry, listDescriptors } from './registry';
import type { ExportApiDeps } from './types.deps';

/** Stub the live search deps; the users descriptor never invokes them. */
const deps: ExportApiDeps = { searchGroups: vi.fn() };

describe('buildRegistry', () => {
  it('includes the users descriptor keyed by its id', () => {
    const registry = buildRegistry(deps);

    expect(registry['users']).toBeDefined();
    expect(registry['users'].id).toBe('users');
    expect(registry['users'].displayName).toBe('Users');
  });

  it('keys every descriptor by its own id', () => {
    const registry = buildRegistry(deps);
    for (const [key, descriptor] of Object.entries(registry)) {
      expect(descriptor.id).toBe(key);
    }
  });
});

describe('listDescriptors', () => {
  it('returns the descriptors in insertion order', () => {
    const registry = buildRegistry(deps);
    const list = listDescriptors(registry);

    expect(list.length).toBeGreaterThan(0);
    expect(list[0].id).toBe('users');
    expect(list.map((d) => d.id)).toEqual(Object.keys(registry));
  });
});
