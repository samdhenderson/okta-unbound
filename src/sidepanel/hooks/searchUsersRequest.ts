/**
 * @module sidepanel/hooks/searchUsersRequest
 * @description Scheduler-routed Okta user search with the multi-strategy fallback.
 *
 * §8: reproduces the content script's former `searchUsers` handler in the side
 * panel, issuing each fetch through the rate-limited scheduler (`makeApiRequest`)
 * at the `interactive` priority so a type-ahead search stays snappy. The
 * 1–3 request fallback chain and the `{ success, data, count }` result shape are
 * preserved verbatim from `content/userHandlers.ts` so consumers are unchanged.
 */

import type { OktaUser } from '../../shared/types';
import type { CoreApi } from './useOktaApi/core';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('searchUsersRequest');

/** The scheduler-routed request function (`useOktaApi().makeApiRequest`). */
type MakeApiRequest = CoreApi['makeApiRequest'];

/** Result of {@link searchUsersRequest}, mirroring the old content-script response. */
export interface SearchUsersResult {
  success: boolean;
  data?: OktaUser[];
  count?: number;
  error?: string;
}

/**
 * Search Okta users through the scheduler, trying up to three strategies in order
 * (as the content-script handler used to): a flexible `q=` match, then a `search=`
 * prefix match, then — only when the query looks like an email and nothing matched
 * yet — an exact `profile.email` filter. The first strategy that returns results
 * wins; each request runs at `interactive` priority.
 *
 * @param makeApiRequest - `useOktaApi().makeApiRequest`, routing via the background scheduler.
 * @param rawQuery - The (untrimmed) search text.
 * @returns `{ success: true, data, count }` on success, or `{ success: false, error }`
 *   if a request throws (matching the former handler's swallow-and-report behavior).
 */
export async function searchUsersRequest(
  makeApiRequest: MakeApiRequest,
  rawQuery: string,
): Promise<SearchUsersResult> {
  try {
    const trimmedQuery = rawQuery.trim();
    let users: OktaUser[] = [];

    // Strategy 1: flexible `q=` search (multi-field, good for partial matches).
    const qParam = encodeURIComponent(trimmedQuery);
    let response = await makeApiRequest(
      `/api/v1/users?q=${qParam}&limit=20`,
      'GET',
      undefined,
      'interactive',
    );

    if (response.success && response.data && response.data.length > 0) {
      users = response.data;
    } else {
      // Strategy 2: `search=` prefix search.
      const searchParam = encodeURIComponent(trimmedQuery);
      response = await makeApiRequest(
        `/api/v1/users?search=${searchParam}&limit=20`,
        'GET',
        undefined,
        'interactive',
      );
      if (response.success && response.data) {
        users = response.data;
      }
    }

    // Strategy 3: exact email filter, only if nothing matched and it looks like one.
    if (users.length === 0 && trimmedQuery.includes('@')) {
      response = await makeApiRequest(
        `/api/v1/users?filter=profile.email eq "${trimmedQuery}"&limit=20`,
        'GET',
        undefined,
        'interactive',
      );
      if (response.success && response.data) {
        users = response.data;
      }
    }

    log.debug('User search complete', { count: users.length });
    return { success: true, data: users, count: users.length };
  } catch (error) {
    log.error('searchUsers error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search users',
    };
  }
}
