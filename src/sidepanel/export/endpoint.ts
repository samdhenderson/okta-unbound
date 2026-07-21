/**
 * @module sidepanel/export/endpoint
 * @description Pure helper that assembles the Okta list endpoint for an export.
 *
 * Combines a descriptor's base endpoint (or its context-built endpoint for
 * search-to-select entities), its `defaultQuery`, and the admin's optional raw
 * filter expression into a single origin-relative path. The filter value is
 * encoded via `URLSearchParams`, so it is a safe query parameter on the
 * same-origin authenticated GET the content script issues.
 */

import type { EntityExport } from './types';

/** Inputs that resolve a descriptor to a concrete first-page endpoint. */
export interface EndpointOptions {
  /** Chosen context entity id (required for `search-to-select` descriptors). */
  contextId?: string;
  /** Raw filter expression from the filter box (ignored when the descriptor has no filter). */
  filterText?: string;
}

/**
 * Build the first-page list endpoint for a descriptor.
 *
 * @param descriptor - The entity descriptor.
 * @param options - Context id and/or filter text.
 * @returns An origin-relative path (e.g. `/api/v1/users?limit=200&search=...`).
 * @throws If a `search-to-select` descriptor is missing a `contextId`, or a
 *   `whole-org` descriptor has no `endpoint`.
 */
export function buildExportEndpoint(
  descriptor: EntityExport,
  options: EndpointOptions = {},
): string {
  let base: string;
  if (descriptor.context.kind === 'search-to-select') {
    if (!options.contextId) {
      throw new Error(`Export "${descriptor.id}" requires a selected ${descriptor.context.label}.`);
    }
    base = descriptor.context.endpoint(options.contextId);
  } else {
    if (!descriptor.endpoint) {
      throw new Error(`Export "${descriptor.id}" has no endpoint.`);
    }
    base = descriptor.endpoint;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(descriptor.defaultQuery)) {
    params.set(key, String(value));
  }
  if (descriptor.filter.kind !== 'none' && options.filterText?.trim()) {
    params.set(descriptor.filter.kind, options.filterText.trim());
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
