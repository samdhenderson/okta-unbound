/**
 * @module content/groupHandlers
 * @description Group-oriented message handlers for the content script.
 *
 * Covers resolving the current group's info (URL/DOM/API fallback chain), fetching
 * all members with unbounded pagination, exporting members to CSV/JSON, and the
 * autocomplete-style group search. Every network call routes through the
 * same-origin fetch primitive; Okta responses are zod-validated at the boundary.
 *
 * @see `content/apiRequest` for the transport primitive.
 * @see `content/index` for message routing.
 */

import type { MessageRequest, MessageResponse, OktaUser, GroupInfo } from '../shared/types';
import { createLogger } from '../shared/utils/logger';
import { oktaGroupSchema, parseOkta } from '../shared/schemas/okta';
import { extractGroupIdFromUrl, extractGroupNameFromPage } from './pageContext';
import { handleMakeApiRequest } from './apiRequest';
import { convertToCSV, downloadFile } from './exportHelpers';

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

/**
 * Export a group's members (optionally filtered by status) as a CSV or JSON
 * download.
 *
 * @param request - The message; requires `groupId` and `format`, with optional
 *   `groupName` and `statusFilter`.
 * @returns A response with the exported `count`, or an error.
 */
export async function handleExportGroupMembers(request: MessageRequest): Promise<MessageResponse> {
  log.debug('Processing exportGroupMembers request');

  try {
    const { groupId, groupName, format, statusFilter } = request;

    // Fetch all group members
    const members = await fetchAllGroupMembers(groupId!);

    // Filter by status if specified
    let filteredMembers = members;
    if (statusFilter) {
      filteredMembers = members.filter((u: OktaUser) => u.status === statusFilter);
    }

    // Format and download
    const filename = `${groupName}_members_${new Date().toISOString().split('T')[0]}.${format}`;
    let content: string;

    if (format === 'csv') {
      content = convertToCSV(filteredMembers);
    } else {
      content = JSON.stringify(filteredMembers, null, 2);
    }

    downloadFile(filename, content, format === 'csv' ? 'text/csv' : 'application/json');

    return {
      success: true,
      count: filteredMembers.length,
    };
  } catch (error) {
    log.error('exportGroupMembers error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

/**
 * Fetch every member of a group across all pages.
 *
 * Follows Okta's `rel="next"` pagination links until exhausted; a failed page
 * throws (unlike the other content-script loops), aborting the whole fetch.
 *
 * @param groupId - The group whose members to fetch.
 * @returns The accumulated list of members.
 */
export async function fetchAllGroupMembers(groupId: string): Promise<OktaUser[]> {
  let allMembers: OktaUser[] = [];
  let nextUrl: string | null = `/api/v1/groups/${groupId}/users?limit=200`;

  while (nextUrl) {
    const response = await handleMakeApiRequest(nextUrl, 'GET');

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch group members');
    }

    allMembers = allMembers.concat(response.data || []);

    // Parse next link from headers
    nextUrl = null;
    if (response.headers?.link) {
      const links = response.headers.link.split(',');
      for (const link of links) {
        if (link.includes('rel="next"')) {
          const match = link.match(/<([^>]+)>/);
          if (match) {
            const fullUrl = new URL(match[1]);
            nextUrl = fullUrl.pathname + fullUrl.search;
            break;
          }
        }
      }
    }
  }

  return allMembers;
}

/**
 * Search groups by name using Okta's flexible `q` parameter (autocomplete style).
 *
 * @param query - The (untrimmed) search text.
 * @returns A response with the matched groups and their `count`.
 */
export async function handleSearchGroups(query: string): Promise<MessageResponse> {
  log.debug('Processing searchGroups request', { queryLength: query.length });

  try {
    const trimmedQuery = query.trim();

    // Use 'q' parameter for flexible name-based search (autocomplete scenario)
    // This matches the pattern used by searchUsers and is simple/fast
    const qParam = encodeURIComponent(trimmedQuery);
    const searchUrl = `/api/v1/groups?q=${qParam}&limit=20&expand=stats`;

    log.debug('Searching groups with q parameter');
    const response = await handleMakeApiRequest(searchUrl, 'GET');

    if (response.success && response.data) {
      const groups = response.data;
      log.debug('Found groups', { count: groups.length });

      return {
        success: true,
        data: groups,
        count: groups.length,
      };
    }

    return {
      success: true,
      data: [],
      count: 0,
    };
  } catch (error) {
    log.error('searchGroups error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search groups',
    };
  }
}
