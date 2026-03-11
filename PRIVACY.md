# Privacy Policy for Okta Unbound

**Effective Date:** March 11, 2026
**Last Updated:** March 11, 2026

## Overview

Okta Unbound is a Chrome extension that provides group, user, and rules management tools for Okta administrators. It operates entirely within the user's browser and does not collect, transmit, or share any data with external servers or third parties.

## Data Accessed

The extension accesses the following data from the user's own Okta tenant:

- **Personally identifiable information**: User profile data such as names, email addresses, login identifiers, department, and title as returned by the Okta API.
- **Group data**: Group names, descriptions, types, membership lists, and group rules.
- **Website content**: The extension's content script reads elements of the Okta admin console page to extract the XSRF session token (required for API authentication) and to detect page context (e.g., which group or user the administrator is currently viewing).

## How Data Is Used

All data accessed by the extension is used solely to provide its core functionality: displaying group and user information, analyzing group rules, and performing administrative operations within the user's Okta tenant.

## Data Storage

Data is stored locally in the user's browser only:

- **chrome.storage.local**: User preferences (display settings, filter selections) and cached group/rule data with a 24-hour expiration.
- **IndexedDB**: Audit log entries that record operations performed by the extension. Audit logs store Okta user IDs rather than email addresses to minimize personally identifiable information retained.

No data is stored on external servers.

## Data Transmission

The extension communicates only with the user's own Okta tenant domain (e.g., `yourcompany.okta.com`, `yourcompany.oktapreview.com`, or `yourcompany.okta-emea.com`) using the user's existing authenticated browser session. No data is sent to any other domain, server, or third party.

## Data Export

Users may explicitly export group member lists, search results, and audit logs as CSV or JSON files to their local machine. Exports are initiated only by direct user action.

## Data Sharing

This extension does not sell, transfer, or share any user data with third parties for any purpose.

## Data Retention

- Cached data in chrome.storage.local expires automatically after 24 hours.
- Audit log retention is configurable by the user and cleaned up automatically via a daily scheduled task.
- Users can clear all stored data at any time by removing the extension.

## Permissions

The extension requests only the permissions necessary for its functionality. A full list of permissions and their justifications is available on the Chrome Web Store listing.

## Changes to This Policy

Any changes to this privacy policy will be reflected in this document with an updated "Last Updated" date.

## Contact

For questions or concerns about this privacy policy, please open an issue at: https://github.com/samdhenderson/okta-unbound/issues
