/**
 * @module sidepanel/export/types.deps
 * @description Runtime API dependencies the Export tab hands to descriptor factories.
 *
 * `search-to-select` descriptors need a live "search for the parent entity"
 * function (search groups, search apps). Rather than couple descriptors to
 * `coreApi`, the Export tab assembles this thin {@link ExportApiDeps} object from
 * `useOktaApi` and passes it to {@link module:sidepanel/export/registry.buildRegistry}.
 * Descriptors receive only what they need — no Chrome-runtime plumbing.
 */

import type { EntityContextOption } from './types';

/**
 * The search functions descriptor factories may draw on. Each returns already
 * mapped {@link EntityContextOption}s so descriptors stay free of Okta domain
 * types. Optional members let the registry build even when an entity's search
 * op has not shipped yet (the descriptor for it simply won't be registered).
 */
export interface ExportApiDeps {
  /** Type-ahead search over groups (for the Group Memberships descriptor). */
  searchGroups: (query: string) => Promise<EntityContextOption[]>;
  /** Type-ahead search over apps (for App-Users / App-Groups descriptors). */
  searchApps?: (query: string) => Promise<EntityContextOption[]>;
}
