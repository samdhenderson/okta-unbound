/**
 * @module content/groupHandlers
 * @description Group-oriented message handlers for the content script.
 *
 * Covers resolving the current group's info (URL/DOM/API fallback chain). Every
 * network call routes through the same-origin fetch primitive; Okta responses are
 * zod-validated at the boundary.
 *
 * @see `content/apiRequest` for the transport primitive.
 * @see `content/index` for message routing.
 */

import type { MessageResponse, GroupInfo } from '../shared/types';
import { createLogger } from '../shared/utils/logger';
import { oktaGroupSchema, parseOkta } from '../shared/schemas/okta';
import { extractGroupIdFromUrl, extractGroupNameFromPage } from './pageContext';
import { handleMakeApiRequest } from './apiRequest';

const log = createLogger('Content');

/**
 * Resolve the current page's group ID and name.
 *
 * The name is taken from the DOM when present, otherwise fetched from the API
 * (zod-validated), otherwise reported as `Unknown`.
 *
 * @returns A response carrying {@link GroupInfo}, or an error when not on a group page.
 */
export async function handleGetGroupInfo(): Promise<MessageResponse<GroupInfo>> {
  log.debug('Processing getGroupInfo request');

  try {
    const url = window.location.href;
    log.debug('Current page location', { path: window.location.pathname });

    const groupId = extractGroupIdFromUrl(url);
    log.debug('Extracted groupId', { groupId });

    if (!groupId) {
      return {
        success: false,
        error: 'Not on a group page. Please navigate to a specific group page.',
      };
    }

    let groupName = extractGroupNameFromPage();
    log.debug('Extracted groupName from page', { found: Boolean(groupName) });

    // Fallback: fetch from API if not found in DOM
    if (!groupName) {
      log.debug('Fetching group name from API');
      try {
        const response = await handleMakeApiRequest(`/api/v1/groups/${groupId}`, 'GET');
        if (response.success) {
          const group = parseOkta(oktaGroupSchema, response.data, 'GET /api/v1/groups/{id}');
          groupName = group.profile.name;
          log.debug('Fetched groupName from API', { found: Boolean(groupName) });
        }
      } catch (e) {
        log.warn('Failed to fetch group name from API', e);
      }
    }

    const result: GroupInfo = {
      groupId,
      groupName: groupName || 'Unknown',
    };

    log.debug('getGroupInfo result', {
      groupId: result.groupId,
      hasName: result.groupName !== 'Unknown',
    });
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    log.error('getGroupInfo error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
