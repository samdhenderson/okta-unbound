/**
 * @module content/userHandlers
 * @description User-oriented message handlers for the content script.
 *
 * Covers resolving the current user's info (API-first with page-scrape fallback).
 * Every network call routes through the same-origin fetch primitive; user records
 * are zod-validated at the boundary.
 *
 * @see `content/apiRequest` for the transport primitive.
 * @see `content/index` for message routing.
 */

import type { MessageResponse, UserInfo, UserStatus } from '../shared/types';
import { createLogger } from '../shared/utils/logger';
import { oktaUserSchema, parseOkta } from '../shared/schemas/okta';
import { extractUserIdFromUrl, extractUserNameFromPage } from './pageContext';
import { handleMakeApiRequest } from './apiRequest';

const log = createLogger('Content');

/**
 * Resolve the current page's user ID, display name, email, and status.
 *
 * Prefers zod-validated API data, falling back to page scraping for the name.
 *
 * @returns A response carrying {@link UserInfo}, or an error when not on a user page.
 */
export async function handleGetUserInfo(): Promise<MessageResponse<UserInfo>> {
  log.debug('Processing getUserInfo request');

  try {
    const url = window.location.href;
    log.debug('Current page location', { path: window.location.pathname });

    const userId = extractUserIdFromUrl(url);
    log.debug('Extracted userId', { userId });

    if (!userId) {
      return {
        success: false,
        error: 'Not on a user page. Please navigate to a specific user page.',
      };
    }

    let userName: string | undefined;
    let userEmail: string | undefined;
    let userStatus: UserStatus | undefined;

    // Fetch user details from API (prioritize API over page scraping)
    log.debug('Fetching user details from API');
    try {
      const response = await handleMakeApiRequest(`/api/v1/users/${userId}`, 'GET');
      if (response.success) {
        const user = parseOkta(oktaUserSchema, response.data, 'GET /api/v1/users/{id}');
        const profile = user.profile;
        // Use API data for the full name (firstName + lastName)
        userName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
        userEmail = profile.email;
        userStatus = user.status;
        log.debug('Fetched user details from API', {
          hasName: Boolean(userName),
          hasEmail: Boolean(userEmail),
          userStatus,
        });
      }
    } catch (e) {
      log.warn('Failed to fetch user details from API', e);
    }

    // Fallback to page scraping if API didn't provide a name
    if (!userName) {
      userName = extractUserNameFromPage() || undefined;
      log.debug('Extracted userName from page (fallback)', { found: Boolean(userName) });
    }

    const result: UserInfo = {
      userId,
      userName: userName || 'Unknown',
      userEmail,
      userStatus,
    };

    log.debug('getUserInfo result', {
      userId: result.userId,
      hasName: result.userName !== 'Unknown',
      hasEmail: Boolean(result.userEmail),
      userStatus: result.userStatus,
    });
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    log.error('getUserInfo error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
