/**
 * @module sidepanel/export/registry.test
 * @description Unit tests for the descriptor registry assembly.
 *
 * Pins that `buildRegistry` keys descriptors by their `id`, includes the
 * reference `users` descriptor, and that `listDescriptors` returns them sorted by
 * `displayName`. Descriptors auto-register via `import.meta.glob`, so this guards
 * the shape the entity hub and engine rely on.
 *
 * It also carries the invariant ADR-0065 asks for: **a descriptor resolves its
 * rows exactly one way.** With two acquisition modes on one type, a descriptor
 * that named both an endpoint and a snapshot source — or neither — would be
 * ambiguous at the one place the tab branches, so the ambiguity is refused here
 * rather than discovered at download time.
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

describe('row-acquisition invariant', () => {
  it('resolves every descriptor exactly one way', () => {
    for (const descriptor of Object.values(buildRegistry(deps))) {
      const isSnapshot = descriptor.source?.kind === 'snapshot';
      // A snapshot descriptor has no endpoint to walk; an endpoint descriptor
      // reaches its rows through `endpoint` or through a search-to-select
      // context that builds one.
      const namesAnEndpoint =
        descriptor.endpoint !== undefined || descriptor.context.kind === 'search-to-select';
      expect(isSnapshot).not.toBe(namesAnEndpoint);
    }
  });

  it('leaves every endpoint descriptor with no source at all', () => {
    // The safeguard that made this widening free: absent means endpoint, so no
    // existing descriptor had to be edited. If one grows an explicit
    // `{ kind: 'endpoint' }` this stays true; if one silently gains a snapshot
    // source, the invariant above catches it.
    const endpointDescriptors = Object.values(buildRegistry(deps)).filter(
      (descriptor) => descriptor.source?.kind !== 'snapshot',
    );

    expect(endpointDescriptors.length).toBeGreaterThan(0);
    expect(endpointDescriptors.every((descriptor) => descriptor.source === undefined)).toBe(true);
  });

  it('registers the three report descriptors from one module', () => {
    const registry = buildRegistry(deps);

    expect(registry['report-group-cleanup']?.source?.kind).toBe('snapshot');
    expect(registry['report-unmaintained-app-access']?.source?.kind).toBe('snapshot');
    expect(registry['report-dormant-app-access']?.source?.kind).toBe('snapshot');
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
