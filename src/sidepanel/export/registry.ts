/**
 * @module sidepanel/export/registry
 * @description Auto-assembles the available {@link EntityExport} descriptors.
 *
 * Every module under `./descriptors/` that default-exports an
 * {@link EntityExport} (whole-org), an array of them, or a `(deps) => …` factory
 * (search-to-select) is registered automatically via `import.meta.glob`.
 * **Adding an export is adding one descriptor file — nothing here changes**, which
 * keeps the fan-out conflict-free (no shared registry edit).
 *
 * The array form exists for sibling descriptors that share a row shape and a
 * join — the three snapshot-sourced reports (ADR-0065) — so they can live in one
 * file instead of three that only re-export each other. It changes nothing for
 * the eleven endpoint descriptors, which still default-export one object each.
 */

import type { EntityExport } from './types';
import type { ExportApiDeps } from './types.deps';

/** What one descriptor module may default-export. */
type DescriptorExport = EntityExport | EntityExport[];

/** A descriptor module: default-exports descriptor(s) or a factory producing them. */
interface DescriptorModule {
  default: DescriptorExport | ((deps: ExportApiDeps) => DescriptorExport);
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
  const descriptors = Object.values(descriptorModules).flatMap((mod) => {
    const exported = mod.default;
    const produced = typeof exported === 'function' ? exported(deps) : exported;
    return Array.isArray(produced) ? produced : [produced];
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
