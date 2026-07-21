/**
 * @module sidepanel/export/registry
 * @description Auto-assembles the available {@link EntityExport} descriptors.
 *
 * Every module under `./descriptors/` that default-exports either an
 * {@link EntityExport} (whole-org) or a `(deps) => EntityExport` factory
 * (search-to-select) is registered automatically via `import.meta.glob`.
 * **Adding an export is adding one descriptor file — nothing here changes**, which
 * keeps the fan-out conflict-free (no shared registry edit).
 */

import type { EntityExport } from './types';
import type { ExportApiDeps } from './types.deps';

/** A descriptor module: default-exports a static descriptor or a factory. */
interface DescriptorModule {
  default: EntityExport | ((deps: ExportApiDeps) => EntityExport);
}

// Eagerly import every descriptor module (excluding co-located tests). Vite/Vitest/
// Storybook all resolve this at build time.
const descriptorModules = import.meta.glob<DescriptorModule>(
  ['./descriptors/*.ts', '!./descriptors/*.test.ts'],
  { eager: true },
);

/**
 * Build the descriptor registry keyed by {@link EntityExport.id}.
 *
 * @param deps - Live search functions the Export tab assembles from `useOktaApi`
 *   (consumed by search-to-select factory descriptors).
 * @returns A map of descriptor id → descriptor, for the entity hub and engine.
 */
export function buildRegistry(deps: ExportApiDeps): Record<string, EntityExport> {
  const descriptors = Object.values(descriptorModules).map((mod) => {
    const exported = mod.default;
    return typeof exported === 'function' ? exported(deps) : exported;
  });

  return Object.fromEntries(descriptors.map((descriptor) => [descriptor.id, descriptor]));
}

/**
 * Descriptors for rendering the entity hub, sorted by display name for a stable
 * order independent of filesystem glob ordering.
 *
 * @param registry - The map returned by {@link buildRegistry}.
 * @returns Descriptors sorted by `displayName`.
 */
export function listDescriptors(registry: Record<string, EntityExport>): EntityExport[] {
  return Object.values(registry).sort((a, b) => a.displayName.localeCompare(b.displayName));
}
