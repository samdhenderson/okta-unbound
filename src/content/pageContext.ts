/**
 * @module content/pageContext
 * @description Pure page-context extraction helpers for the Okta content script.
 *
 * These functions read the current page's URL and DOM to recover the Okta entity
 * (group / user / app) the user is looking at. They perform no network I/O and hold
 * no state — they are the "where am I?" layer that the message handlers build on.
 *
 * @see `content/index` for the message routing that consumes these helpers.
 */

import { createLogger } from '../shared/utils/logger';

const log = createLogger('Content');

/**
 * Extract an Okta group ID from a page URL.
 *
 * Matches both the classic `/admin/group/{id}` admin route and the generic
 * `/groups/{id}` route, in that order of preference.
 *
 * @param url - The page URL to parse.
 * @returns The group ID, or `null` if none matched.
 */
export function extractGroupIdFromUrl(url: string): string | null {
  const match1 = url.match(/\/admin\/group\/([a-zA-Z0-9]+)/);
  if (match1) return match1[1];

  const match2 = url.match(/\/groups\/([a-zA-Z0-9]+)/);
  if (match2) return match2[1];

  return null;
}

/**
 * Scrape the group name from the current page DOM, trying a prioritized list of
 * selectors used across Okta's admin surfaces.
 *
 * @returns The trimmed group name, or `null` if no known selector matched.
 */
export function extractGroupNameFromPage(): string | null {
  const selectors = [
    'h1[data-se="group-name"]',
    '.group-profile-header h1',
    '[data-se="group-detail-name"]',
    'h1.okta-form-title',
    '.content-container h1',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent?.trim() || null;
    }
  }

  return null;
}

/**
 * Extract an Okta user ID from a page URL.
 *
 * Tries a prioritized list of route patterns (OIE, classic admin, directory,
 * end-user, API, report, and query-parameter forms) and rejects obvious non-ID
 * path segments such as `settings` or `profile`.
 *
 * @param url - The page URL to parse.
 * @returns The user ID, or `null` if none matched.
 */
export function extractUserIdFromUrl(url: string): string | null {
  log.debug('extractUserIdFromUrl: parsing URL', { path: url.split('?')[0] });

  // Okta user IDs are typically 20 characters, alphanumeric (e.g., 00u1234567890abcdefg)
  // Some can be shorter or use different formats

  // Pattern list in order of specificity (most specific first)
  const patterns: Array<{ regex: RegExp; name: string }> = [
    // New Okta Identity Engine (OIE) patterns
    {
      regex: /\/admin\/user\/profile\/view\/([a-zA-Z0-9]+)/,
      name: '/admin/user/profile/view/{id}',
    },
    { regex: /\/admin\/user\/profile\/([a-zA-Z0-9]+)/, name: '/admin/user/profile/{id}' },

    // Classic admin patterns
    { regex: /\/admin\/user\/([a-zA-Z0-9]+)(?:\/|$|\?)/, name: '/admin/user/{id}' },
    { regex: /\/admin\/users\/([a-zA-Z0-9]+)(?:\/|$|\?)/, name: '/admin/users/{id}' },

    // Directory patterns (used in some Okta instances)
    { regex: /\/admin\/directory\/people\/([a-zA-Z0-9]+)/, name: '/admin/directory/people/{id}' },

    // End-user dashboard patterns
    {
      regex: /\/enduser\/settings\/profile\/([a-zA-Z0-9]+)/,
      name: '/enduser/settings/profile/{id}',
    },
    { regex: /\/app\/UserHome\/([a-zA-Z0-9]+)/, name: '/app/UserHome/{id}' },

    // API/direct user patterns
    { regex: /\/users\/([a-zA-Z0-9]+)(?:\/|$|\?)/, name: '/users/{id}' },

    // Report/audit patterns that show user details
    { regex: /\/reports\/user\/([a-zA-Z0-9]+)/, name: '/reports/user/{id}' },

    // Query parameter patterns (some Okta UIs use userId in query params)
    { regex: /[?&]userId=([a-zA-Z0-9]+)/, name: '?userId={id}' },
    { regex: /[?&]user=([a-zA-Z0-9]+)/, name: '?user={id}' },
  ];

  for (const { regex, name } of patterns) {
    const match = url.match(regex);
    if (match && match[1]) {
      // Validate it looks like an Okta ID (starts with 00u or is alphanumeric)
      const potentialId = match[1];
      // Skip obvious non-IDs like 'settings', 'profile', 'edit', etc.
      const nonIdKeywords = [
        'settings',
        'profile',
        'edit',
        'view',
        'new',
        'create',
        'delete',
        'list',
        'search',
      ];
      if (nonIdKeywords.includes(potentialId.toLowerCase())) {
        continue;
      }
      log.debug('extractUserIdFromUrl: matched pattern', { pattern: name, id: potentialId });
      return potentialId;
    }
  }

  log.warn('extractUserIdFromUrl: no pattern matched', { path: url.split('?')[0] });
  return null;
}

/**
 * Scrape the user's display name from the current page DOM, trying a prioritized
 * list of selectors and skipping generic labels like "User Profile" or "Settings".
 *
 * @returns The trimmed user name, or `null` if no usable selector matched.
 */
export function extractUserNameFromPage(): string | null {
  const selectors = [
    // Okta user profile full name (priority)
    '.subheader-fullname',

    // Modern Okta Identity Engine selectors
    '[data-se="user-profile-name"]',
    '[data-se="user-name"]',
    '[data-se="user-detail-name"]',
    '[data-testid="user-name"]',
    '[data-testid="profile-name"]',

    // Profile page headers
    '.user-profile-header h1',
    '.user-header h1',
    '.user-detail-header h1',
    '.profile-header h1',
    '.person-header h1',

    // Directory/people page
    '.directory-person-header h1',
    '.person-profile h1',
    '[class*="ProfileHeader"] h1',
    '[class*="UserHeader"] h1',

    // Generic content headers
    'h1.okta-form-title',
    '.content-container h1',
    'main h1',

    // Breadcrumb or title area (fallback)
    '.page-title',
    '[class*="PageTitle"]',
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        // Skip if it's just generic text like "User Profile" or "Settings"
        if (text && !['User Profile', 'Profile', 'Settings', 'User'].includes(text)) {
          return text;
        }
      }
    } catch {
      // Some selectors might throw on certain pages
      continue;
    }
  }

  return null;
}

/**
 * Extract an Okta app ID from a page URL.
 *
 * Tries a prioritized list of admin/app route patterns and query-parameter forms,
 * rejecting obvious non-ID segments and requiring the candidate to look like an
 * Okta app ID (starts with `0oa` or is at least 18 characters).
 *
 * @param url - The page URL to parse.
 * @returns The app ID, or `null` if none matched.
 */
export function extractAppIdFromUrl(url: string): string | null {
  log.debug('extractAppIdFromUrl: parsing URL', { path: url.split('?')[0] });

  // Okta app IDs are typically 20 characters, alphanumeric (e.g., 0oa1234567890abcdefg)

  const patterns: Array<{ regex: RegExp; name: string }> = [
    // Admin app configuration pages
    {
      regex: /\/admin\/app\/([a-zA-Z0-9]+)\/instance\/([a-zA-Z0-9]+)/,
      name: '/admin/app/{appId}/instance/{instanceId}',
    },
    { regex: /\/admin\/app\/([a-zA-Z0-9]+)\/settings/, name: '/admin/app/{appId}/settings' },
    { regex: /\/admin\/app\/([a-zA-Z0-9]+)\/assignment/, name: '/admin/app/{appId}/assignment' },
    { regex: /\/admin\/app\/([a-zA-Z0-9]+)/, name: '/admin/app/{appId}' },

    // Applications list and detail pages
    { regex: /\/admin\/apps\/active\/([a-zA-Z0-9]+)/, name: '/admin/apps/active/{appId}' },
    { regex: /\/admin\/apps\/([a-zA-Z0-9]+)/, name: '/admin/apps/{appId}' },

    // API patterns
    { regex: /\/api\/v1\/apps\/([a-zA-Z0-9]+)/, name: '/api/v1/apps/{appId}' },

    // Query parameter patterns
    { regex: /[?&]appId=([a-zA-Z0-9]+)/, name: '?appId={appId}' },
    { regex: /[?&]app=([a-zA-Z0-9]+)/, name: '?app={appId}' },
  ];

  for (const { regex, name } of patterns) {
    const match = url.match(regex);
    if (match && match[1]) {
      const potentialId = match[1];
      // Skip obvious non-IDs
      const nonIdKeywords = ['settings', 'new', 'create', 'list', 'active', 'inactive', 'catalog'];
      if (nonIdKeywords.includes(potentialId.toLowerCase())) {
        continue;
      }
      // Okta app IDs typically start with '0oa'
      if (potentialId.startsWith('0oa') || potentialId.length >= 18) {
        log.debug('extractAppIdFromUrl: matched pattern', { pattern: name, id: potentialId });
        return potentialId;
      }
    }
  }

  log.warn('extractAppIdFromUrl: no pattern matched', { path: url.split('?')[0] });
  return null;
}

/**
 * Scrape the app's display name from the current page DOM, trying a prioritized
 * list of selectors and skipping generic labels like "Application" or "Settings".
 *
 * @returns The trimmed app name, or `null` if no usable selector matched.
 */
export function extractAppNameFromPage(): string | null {
  const selectors = [
    // App configuration page headers
    '[data-se="app-name"]',
    '[data-se="app-label"]',
    '[data-testid="app-name"]',
    '[data-testid="app-label"]',

    // App detail headers
    '.app-header h1',
    '.app-detail-header h1',
    '[class*="AppHeader"] h1',
    '[class*="ApplicationHeader"] h1',

    // Settings page
    '.app-settings-header h1',
    '.application-settings h1',

    // Generic headers in app context
    'h1.okta-form-title',
    '.content-container h1',
    'main h1',

    // Page title
    '.page-title',
    '[class*="PageTitle"]',
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        // Skip generic text
        if (text && !['Application', 'App', 'Settings', 'Configuration'].includes(text)) {
          return text;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}
