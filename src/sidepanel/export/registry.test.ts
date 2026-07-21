/**
 * @module sidepanel/export/registry.test
 * @description Unit tests for the descriptor registry assembly.
 *
 * Pins that `buildRegistry` keys descriptors by their `id`, includes the
 * reference `users` descriptor, and that `listDescriptors` returns them sorted by
 * `displayName`. Descriptors auto-register via `import.meta.glob`, so this guards
 * the shape the entity hub and engine rely on.
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
  it('returns the descriptors sorted by display name', () => {
    const registry = buildRegistry(deps);
    const list = listDescriptors(registry);

    expect(list.length).toBeGreaterThan(0);
    const names = list.map((d) => d.displayName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
