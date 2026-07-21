/**
 * @module hooks/useOktaApi/appOperations
 * @description App-scoped read operations (currently type-ahead app search).
 *
 * Powers the Export tab's search-to-select for app-scoped exports (App Users /
 * App Groups). Like every read here, requests go through the scheduler path and
 * responses are zod-validated at the boundary.
 */

import type { CoreApi } from './core';
import { oktaAppListItemSchema } from '@/shared/schemas/okta';
import { parseOktaList } from '@/shared/schemas/okta';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('useOktaApi');

/** A lightweight app summary for pickers. */
export interface AppSummary {
  /** Okta app instance id. */
  id: string;
  /** Display label (falls back to the app name/key, then the id). */
  label: string;
  /** Lifecycle status (e.g. `ACTIVE`), when present. */
  status?: string;
}

/**
 * Build app-scoped operations bound to a {@link CoreApi} transport.
 *
 * @param coreApi - Shared transport surface.
 * @returns `{ searchApps }`.
 */
export function createAppOperations(coreApi: CoreApi) {
  /**
   * Type-ahead search over apps by name/label (`q=` prefix match).
   *
   * @param query - The search text; queries shorter than 2 chars return `[]`.
   * @returns Up to 20 matching app summaries; `[]` on error (never throws).
   */
  const searchApps = async (query: string): Promise<AppSummary[]> => {
    if (!query || query.length < 2) return [];
    try {
      const response = await coreApi.makeApiRequest(
        `/api/v1/apps?q=${encodeURIComponent(query)}&limit=20`,
      );
      if (!response.success) return [];
      const apps = parseOktaList(oktaAppListItemSchema, response.data, 'GET /api/v1/apps?q');
      return apps.map((app) => ({
        id: app.id,
        label: app.label || app.name || app.id,
        status: app.status,
      }));
    } catch {
      // Redacted: the query text may carry identifying data — log the outcome only.
      log.error('searchApps failed', { code: 'search_failed' });
      return [];
    }
  };

  return { searchApps };
}
