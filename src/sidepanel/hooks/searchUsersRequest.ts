/**
 * @module sidepanel/hooks/searchUsersRequest
 * @description Scheduler-routed Okta user search with the multi-strategy fallback.
 *
 * §8: reproduces the content script's former `searchUsers` handler in the side
 * panel, issuing each fetch through the rate-limited scheduler (`makeApiRequest`)
 * at the `interactive` priority so a type-ahead search stays snappy. The
 * 1–3 request fallback chain and the `{ success, data, count }` result shape are
 * preserved from `content/userHandlers.ts` so consumers are unchanged, with one
 * correction: the second strategy now sends a real SCIM expression. The ported
 * handler passed the bare query as `search=<term>`, which Okta rejects as a
 * malformed filter — so the only name-aware strategy was `q=`, whose per-field
 * prefix match cannot see a middle-of-name substring or a "First Last" query.
 * When it missed, the remaining fallback could only match an exact email.
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

/** Profile fields the `search=` strategy prefix-matches against the whole query. */
const SEARCHED_FIELDS = [
  'profile.firstName',
  'profile.lastName',
  'profile.login',
  'profile.email',
] as const;

/**
 * Quote a value as a SCIM string literal, escaping the two characters that would
 * otherwise terminate or corrupt it. Okta search expressions are end-user input
 * here (whatever was typed in the search box), so this is what keeps a stray `"`
 * from turning into a malformed — or attacker-shaped — filter.
 *
 * @param value - The raw value to embed.
 * @returns The value wrapped in double quotes with `\` and `"` escaped.
 */
function scimString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Build the SCIM expression for strategy 2: the whole query as a prefix of any one
 * of {@link SEARCHED_FIELDS}, plus — when the query is more than one word — a
 * first-token/last-token pair so a typed "Ada Lovelace" matches a user whose first
 * and last names each hold one half of it (no single field contains both).
 *
 * @param query - The trimmed search text.
 * @returns An unencoded SCIM expression suitable for the `search` query parameter.
 */
function nameSearchExpression(query: string): string {
  const clauses = SEARCHED_FIELDS.map((field) => `${field} sw ${scimString(query)}`);

  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const first = scimString(tokens[0]);
    const last = scimString(tokens[tokens.length - 1]);
    clauses.push(`(profile.firstName sw ${first} and profile.lastName sw ${last})`);
  }

  return clauses.join(' or ');
}

/**
 * Search Okta users through the scheduler, trying up to three strategies in order:
 * a flexible `q=` match, then a `search=` SCIM expression that prefix-matches the
 * name, login and email fields (see {@link nameSearchExpression}), then — only when
 * the query looks like an email and nothing matched yet — an exact `profile.email`
 * filter. The first strategy that returns results wins; each request runs at
 * `interactive` priority.
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
    let response = await makeApiRequest(`/api/v1/users?q=${qParam}&limit=20`, {
      method: 'GET',
      priority: 'interactive',
      reason: 'Search users',
    });

    if (response.success && response.data && response.data.length > 0) {
      users = response.data;
    } else {
      // Strategy 2: `search=` SCIM expression across the name, login and email fields.
      const searchParam = encodeURIComponent(nameSearchExpression(trimmedQuery));
      response = await makeApiRequest(`/api/v1/users?search=${searchParam}&limit=20`, {
        method: 'GET',
        priority: 'interactive',
        reason: 'Search users',
      });
      if (response.success && response.data) {
        users = response.data;
      }
    }

    // Strategy 3: exact email filter, only if nothing matched and it looks like one.
    if (users.length === 0 && trimmedQuery.includes('@')) {
      response = await makeApiRequest(
        `/api/v1/users?filter=profile.email eq "${trimmedQuery}"&limit=20`,
        {
          method: 'GET',
          priority: 'interactive',
          reason: 'Search users',
        },
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
