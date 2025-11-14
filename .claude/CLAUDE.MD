# Claude Code Development Guide
# Okta Unbound Extension

This document defines coding standards, best practices, and guidelines for developing the Okta Unbound Chrome Extension. Follow these standards to ensure code quality, security, and maintainability.

**CRITICAL RULE**: NEVER EVER USE EMOJIS IN CODE, COMMENTS, OR DOCUMENTATION FILES (*.md in repo). Emojis are ONLY acceptable in user-facing UI text shown in the extension popup.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Current Architecture](#current-architecture)
3. [Code Quality Standards](#code-quality-standards)
4. [Performance Guidelines](#performance-guidelines)
5. [Security Requirements](#security-requirements)
6. [API Best Practices](#api-best-practices)
7. [Error Handling](#error-handling)
8. [Testing Approach](#testing-approach)
9. [Git Workflow](#git-workflow)
10. [Chrome Extension Specific](#chrome-extension-specific)
11. [Future Roadmap Features](#future-roadmap-features)

---

## Project Overview

**Name**: Okta Unbound
**Purpose**: Advanced group and user management for Okta administrators
**Architecture**: Chrome Extension Manifest V3 with session-based authentication
**Tech Stack**: Vanilla JavaScript (ES6+), Chrome Extension APIs, Okta REST API
**Target Users**: Okta administrators managing large groups (200+ users, up to 10,000+)

### Key Principles
- **Security First**: Protect user data and sessions, never store credentials
- **Performance**: Optimize for large groups (1000+ members) with smart pagination
- **User Experience**: Clear feedback, real-time progress tracking, actionable error messages
- **Maintainability**: Clean, well-documented, easily extendable code
- **Open Source**: All code public on GitHub, community-driven development

### Current Project Structure

```
okta-unbound/
├── manifest.json              # Extension configuration (v0.0.1)
├── src/
│   ├── popup.html            # Main UI
│   ├── popup.css             # Styling
│   ├── popup.js              # UI logic & orchestration
│   ├── content.js            # Content script (DOM access, API calls)
│   └── background.js         # Service worker (minimal)
├── assets/
│   ├── icons/                # Extension icons
│   └── images/               # Promo images
├── docs/
│   └── references/           # Technical references
├── tests/                    # Future: unit, integration, e2e
├── .github/                  # Issue/PR templates, CI
├── README.md                 # Public documentation
├── CONTRIBUTING.md           # Contribution guidelines
├── LICENSE                   # MIT License
└── .claude/                  # THIS FILE (not committed)
    └── CLAUDE.MD
```

---

## Current Architecture

### MVP (v0.0.1) - Vanilla JavaScript

**Why Vanilla JS**:
- No build step required for MVP
- Fast iteration and debugging
- Minimal dependencies
- Works directly in Chrome without bundling

**File Responsibilities**:

**popup.js** (Main Controller)
- DOM manipulation
- Event handling
- API orchestration via message passing
- Progress tracking
- Results display

**content.js** (API Client)
- Runs on Okta pages (access to DOM)
- Extracts XSRF token from page
- Makes authenticated API requests
- Communicates with popup via chrome.runtime.sendMessage

**background.js** (Service Worker)
- Minimal implementation
- Handles extension install/update
- Creates context menus
- No heavy lifting (Manifest V3 limitation)

### Communication Flow

```
User Click in Popup
  ↓
popup.js handles event
  ↓
chrome.tabs.sendMessage() to content.js
  ↓
content.js makes fetch() to Okta API
  ↓
Response sent back to popup.js
  ↓
popup.js updates UI
```

---

## Code Quality Standards

### JavaScript Style

**Language Version**: ES6+ (async/await, arrow functions, template literals, const/let)

**NO EMOJIS IN CODE**: This includes:
- ❌ Code comments
- ❌ Function names
- ❌ Variable names
- ❌ Console.log messages
- ❌ Markdown documentation files in repo
- ✅ ONLY acceptable in user-facing popup UI text (e.g., "Operation complete" badge)

**Naming Conventions**:
```javascript
// Variables and functions: camelCase
const groupId = '00g123456789';
async function fetchGroupMembers() { }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_PAGE_LIMIT = 200;
const DEPROVISIONED_STATUS = 'DEPROVISIONED';

// Classes: PascalCase (future modular structure)
class GroupManager { }
class OktaApiClient { }

// Private/internal functions: prefix with underscore
function _parseGroupIdFromUrl(url) { }

// Event handlers: descriptive action names
removeDeactivatedBtn.addEventListener('click', handleRemoveDeactivated);
customFilterBtn.addEventListener('click', handleCustomFilter);
```

**Code Organization in popup.js**:
```javascript
// 1. DOM element references (top of file)
const groupInfo = document.getElementById('groupInfo');
const resultsBox = document.getElementById('results');

// 2. Global state variables
let currentGroupId = null;
let oktaDomain = null;

// 3. Initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Init code
});

// 4. UI update functions
function updateProgress(current, total, message) { }
function addResult(message, type) { }
function displayGroupInfo(info) { }

// 5. API communication functions
async function makeOktaRequest(endpoint, method, body) { }
async function getGroupDetails(groupId) { }
async function getAllGroupMembers(groupId) { }

// 6. Business logic functions
async function removeUserFromGroup(groupId, userId) { }

// 7. Event handlers (bottom of file)
removeDeactivatedBtn.addEventListener('click', async () => {
  // Handler implementation
});
```

### Code Formatting

**Indentation**: 2 spaces (consistent with current codebase)
**Line Length**: Aim for 100 characters, hard limit 120
**Semicolons**: Always use semicolons
**Quotes**: Single quotes for strings, template literals for interpolation
**Spacing**: Space after keywords, around operators

```javascript
// Good
if (condition) {
  const result = await fetchData();
  return result;
}

const message = `Found ${count} users`;

// Bad
if(condition){
const result=await fetchData()
return result
}
```

### Comments

**When to Comment**:
- Complex logic or algorithms
- Okta API quirks or workarounds
- Business logic decisions
- TODO items (with issue/ticket reference if applicable)

**Comment Style**:
```javascript
// Single line for brief explanations
const xsrfToken = document.getElementById('_xsrfToken').textContent;

/**
 * Multi-line JSDoc for functions
 * Parse Okta's Link header which may contain multiple rel values
 * Format: <url1>; rel="self", <url2>; rel="next"
 *
 * @param {string} linkHeader - The Link header value from response
 * @returns {string|null} - Next page URL or null if no more pages
 */
function parseNextPageUrl(linkHeader) {
  // Implementation
}

// TODO: Add retry logic for transient errors (Issue #42)
```

**Avoid**:
- Obvious comments that just restate code
- Commented-out code (use git history instead)
- Outdated comments that don't match current code
- Emojis in any code comments

```javascript
// Bad - obvious
const users = []; // Create an array

// Bad - commented code
// const oldWay = doSomething();

// Good - explains WHY
// Okta returns status as DEPROVISIONED, not DEACTIVATED (Admin Console label differs)
const deprovisionedUsers = users.filter(u => u.status === 'DEPROVISIONED');
```

### Function Design

**Single Responsibility**: Each function should do one thing well

```javascript
// Good - separate concerns
async function fetchAllGroupMembers(groupId) {
  // Only handles fetching
  const members = await getAllMembersWithPagination(groupId);
  return members;
}

function filterByStatus(members, status) {
  // Only handles filtering
  return members.filter(m => m.status === status);
}

// Bad - doing too much
async function fetchAndFilterMembers(groupId, status) {
  // Mixing fetching with filtering
}
```

**Parameter Limits**: Maximum 4 parameters, use object for more

```javascript
// Good - using options object
async function removeUsers({ groupId, userIds, onProgress, dryRun = false }) {
  // Implementation
}

// Bad - too many parameters
async function removeUsers(groupId, userIds, onProgress, dryRun, logResults, sendEmail) {
  // Too many parameters
}
```

**Return Consistency**: Always return the same type structure

```javascript
// Good - consistent return shape
async function makeApiRequest(endpoint, method, body) {
  try {
    // Success case
    return {
      success: true,
      data: responseData,
      headers: headers,
      status: response.status
    };
  } catch (error) {
    // Error case - same shape
    return {
      success: false,
      error: error.message,
      status: null,
      data: null
    };
  }
}

// Bad - inconsistent returns
async function fetchData() {
  if (success) return data;        // Returns data
  return false;                    // Returns boolean - different type!
}
```

---

## Performance Guidelines

### Okta API Rate Limits

**Official Limits** (varies by org tier):
- Approximately 600 requests/minute for most endpoints
- Groups API: 600/minute
- Users API: 600/minute

**Our Strategy**:
```javascript
// Default delay between operations: 100ms
// This gives us max 600 requests/minute (10/second)
const DEFAULT_OPERATION_DELAY = 100;

// For pagination, can be faster as it's read-only
const PAGINATION_DELAY = 50;

// Always include delays in loops
for (let i = 0; i < users.length; i++) {
  await removeUserFromGroup(groupId, users[i].id);
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

**Future: Implement Retry Logic**:
```javascript
// Not yet implemented but planned
async function makeApiRequestWithRetry(endpoint, method, body, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await makeApiRequest(endpoint, method, body);

    if (response.success) return response;

    // Retry on 429 (rate limit) or 5xx (server error)
    if (response.status === 429 || response.status >= 500) {
      const delay = response.headers['retry-after']
        ? parseInt(response.headers['retry-after']) * 1000
        : Math.pow(2, i) * 1000; // Exponential backoff

      await sleep(delay);
      continue;
    }

    // Don't retry on client errors (4xx except 429)
    return response;
  }
}
```

### Memory Management

**Large Groups**: Handle 10,000+ member groups efficiently

```javascript
// Current approach - accumulate all, then process
// Works for groups up to 10,000 users
async function getAllGroupMembers(groupId) {
  let allMembers = [];
  let nextUrl = `/api/v1/groups/${groupId}/users?limit=200`;

  while (nextUrl) {
    const response = await makeOktaRequest(nextUrl);
    allMembers = allMembers.concat(response.data);
    nextUrl = parseNextLink(response.headers.link);
  }

  return allMembers;
}

// Future: Stream processing for very large groups (50,000+)
async function processLargeGroup(groupId, processor) {
  let nextUrl = `/api/v1/groups/${groupId}/users?limit=200`;

  while (nextUrl) {
    const page = await fetchPage(nextUrl);

    // Process page immediately, don't accumulate
    await processor(page.data);

    nextUrl = page.nextUrl;

    // Allow garbage collection between pages
    page = null;
  }
}
```

### Async Performance

**Parallel vs Sequential**: Choose appropriately

```javascript
// Good - parallel when independent
const [groupDetails, groupRules, appAssignments] = await Promise.all([
  fetchGroupDetails(groupId),
  fetchGroupRules(groupId),
  fetchAppAssignments(groupId)
]);

// Good - sequential when dependent or rate-limited
const groupDetails = await fetchGroupDetails(groupId);
if (groupDetails.type === 'APP_GROUP') {
  const sourceApp = await fetchSourceApplication(groupDetails.appId);
}

// User removals must be sequential to respect rate limits
for (const user of users) {
  await removeUserFromGroup(groupId, user.id);
  await sleep(100); // Rate limit protection
}

// Bad - sequential when could be parallel
const groupDetails = await fetchGroupDetails(groupId);
const groupRules = await fetchGroupRules(groupId); // Could run in parallel
```

---

## Security Requirements

### Authentication & Authorization

**Never**:
- ❌ Store API tokens in code or localStorage
- ❌ Transmit credentials in URLs
- ❌ Log sensitive data (tokens, passwords, session IDs, full user profiles)
- ❌ Bypass Okta's session validation
- ❌ Make requests to non-Okta domains

**Always**:
- ✅ Use existing browser session (JSESSIONID cookie)
- ✅ Extract XSRF token from DOM per request
- ✅ Include proper headers (X-Okta-Xsrftoken, X-Requested-With)
- ✅ Respect CORS and same-origin policies
- ✅ Validate all user inputs

**Current Implementation**:
```javascript
// content.js - Good security practices
async function makeApiRequest(endpoint, method = 'GET', body = null) {
  // Extract XSRF token from page (not stored)
  const xsrfElement = document.getElementById('_xsrfToken');
  const xsrfToken = xsrfElement ? xsrfElement.textContent : '';

  const options = {
    method: method,
    headers: {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store',
      'X-Requested-With': 'XMLHttpRequest'
    },
    credentials: 'include', // Include cookies (JSESSIONID)
    cache: 'no-store',
    mode: 'cors',
    redirect: 'follow'
  };

  // Add XSRF token if available
  if (xsrfToken) {
    options.headers['X-Okta-Xsrftoken'] = xsrfToken;
  }

  // Never log the token value
  console.log('Making request with XSRF token:', xsrfToken ? 'present' : 'missing');

  const response = await fetch(window.location.origin + endpoint, options);
  return response;
}
```

### Data Handling

**Minimize Data Exposure**:
```javascript
// Good - only keep what's needed for display
function formatUserForDisplay(user) {
  return {
    login: user.profile.login,
    name: `${user.profile.firstName} ${user.profile.lastName}`,
    status: user.status
  };
}

// Bad - expose everything
function displayUser(user) {
  console.log(user); // May contain sensitive profile data
  addResult(JSON.stringify(user)); // Exposes all fields
}
```

**Input Validation**:
```javascript
// Good - validate inputs
function validateGroupId(groupId) {
  if (!groupId || typeof groupId !== 'string') {
    throw new Error('Invalid group ID');
  }

  // Okta group IDs are 20 character alphanumeric starting with 00g
  if (!/^00g[a-zA-Z0-9]{17}$/.test(groupId)) {
    throw new Error('Malformed group ID format');
  }

  return groupId;
}

// Bad - assume input is valid
function fetchGroup(groupId) {
  return fetch(`/api/v1/groups/${groupId}`); // Potential injection
}
```

### Permission Checks

**Verify Before Destructive Operations**:
```javascript
// Current implementation - check group type first
async function removeDeactivatedUsers(groupId) {
  // 1. Verify group type
  const groupDetails = await getGroupDetails(groupId);

  if (groupDetails.data.type === 'APP_GROUP') {
    throw new Error('Cannot modify APP_GROUP memberships');
  }

  // 2. Get members and proceed
  const members = await getAllGroupMembers(groupId);
  // ...
}
```

---

## API Best Practices

### Okta API Interaction

**Endpoint Patterns**:
```javascript
// Always use relative paths (origin extracted from current tab)
const OKTA_API_BASE = '/api/v1';

// Group endpoints
const GET_GROUP = (id) => `/api/v1/groups/${id}`;
const GET_GROUP_MEMBERS = (id, limit = 200) => `/api/v1/groups/${id}/users?limit=${limit}`;
const REMOVE_FROM_GROUP = (groupId, userId) => `/api/v1/groups/${groupId}/users/${userId}`;
const ADD_TO_GROUP = (groupId, userId) => `/api/v1/groups/${groupId}/users/${userId}`;

// User endpoints
const GET_USER = (id) => `/api/v1/users/${id}`;
const GET_USER_GROUPS = (id) => `/api/v1/users/${id}/groups`;
```

### Pagination Handling

**Current Implementation**:
```javascript
/**
 * Fetch all pages from a paginated Okta endpoint
 * Okta uses Link headers with rel="next" for cursor-based pagination
 */
async function getAllGroupMembers(groupId) {
  let allMembers = [];
  let nextUrl = `/api/v1/groups/${groupId}/users?limit=200`;
  let pageCount = 0;

  while (nextUrl) {
    pageCount++;
    const response = await makeOktaRequest(nextUrl);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch group members');
    }

    const pageSize = response.data.length;
    allMembers = allMembers.concat(response.data);

    addResult(`Page ${pageCount}: Loaded ${pageSize} members (Total: ${allMembers.length})`, 'info');

    // Parse Link header for next URL
    nextUrl = null;

    if (response.headers?.link) {
      const linkHeader = response.headers.link;
      const links = linkHeader.split(',').map(link => link.trim());

      for (const link of links) {
        if (link.includes('rel="next"')) {
          const match = link.match(/<([^>]+)>/);
          if (match) {
            const fullUrl = match[1];
            const url = new URL(fullUrl);
            nextUrl = url.pathname + url.search;
            break;
          }
        }
      }
    }

    updateProgress(allMembers.length, allMembers.length, `Loaded ${allMembers.length} members...`);

    // Delay between pages to avoid rate limiting
    if (nextUrl) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  addResult(`Pagination complete: ${pageCount} pages, ${allMembers.length} total members`, 'success');
  return allMembers;
}
```

### Error Response Handling

**Okta Error Format**:
```javascript
/**
 * Okta error responses follow consistent structure:
 * {
 *   errorCode: "E0000001",
 *   errorSummary: "Api validation failed: ...",
 *   errorLink: "E0000001",
 *   errorId: "oaexxx"
 * }
 */
function parseOktaError(response) {
  if (response.data?.errorCode) {
    return {
      code: response.data.errorCode,
      message: response.data.errorSummary,
      link: `https://developer.okta.com/docs/reference/error-codes/#${response.data.errorLink}`,
      id: response.data.errorId
    };
  }

  return {
    code: 'UNKNOWN',
    message: response.error || 'Unknown error occurred',
    link: null,
    id: null
  };
}
```

**HTTP Status Code Handling**:
```javascript
// 403 Forbidden - Special handling
if (response.status === 403) {
  // Could be APP_GROUP, insufficient permissions, or group rules
  // Stop immediately to avoid log spam
  return {
    success: false,
    status: 403,
    error: '403 Forbidden - Possible causes: Group is APP_GROUP type, insufficient permissions, or group membership controlled by rules'
  };
}

// 429 Rate Limit - Future retry logic
if (response.status === 429) {
  const retryAfter = response.headers['retry-after'];
  // Implement backoff
}

// 401 Unauthorized - Session expired
if (response.status === 401) {
  return {
    success: false,
    error: 'Session expired. Please refresh the Okta page and try again.'
  };
}
```

---

## Error Handling

### User-Facing Errors

**Always Provide**:
- What went wrong
- Why it might have happened
- What the user can do about it

**Current Implementation**:
```javascript
// Good - actionable error messages
if (result.status === 403) {
  addResult('403 Forbidden: ' + user.profile.login, 'error');
  addResult('Stopping after first 403 to avoid spamming logs.', 'warning');
  addResult(`Remaining ${users.length - i - 1} users were not attempted.`, 'warning');
  addResult('This group likely has restrictions: APP_GROUP type, group rules, or insufficient permissions.', 'error');
  break;
}

// Bad - cryptic errors
if (error) {
  alert('Error: ' + error.status);
}
```

### Logging Strategy

**Development Logging**:
```javascript
// Use descriptive console logs
console.log('[OktaExt] Making API request:', {
  endpoint,
  method,
  timestamp: new Date().toISOString()
});

// Group related logs
console.group('[OktaExt] Remove operation');
console.log('Group ID:', groupId);
console.log('User count:', users.length);
console.groupEnd();

// Log operation results
console.log(`Removal attempt for ${user.profile.login}:`, result);
```

**What NOT to Log**:
- ❌ XSRF tokens (just log "present" or "missing")
- ❌ Full user profiles
- ❌ Session cookies
- ❌ Sensitive user attributes

---

## Testing Approach

### Current Testing (Manual)

**Before Each Release**:

**Functionality**:
- [ ] Group detection works on all supported Okta URL patterns
- [ ] Remove deprovisioned users operation completes successfully
- [ ] Custom filter with all status types works
- [ ] Pagination handles groups with 200+, 1000+, 5000+ users
- [ ] Progress bar updates correctly
- [ ] Results display all operations with correct status

**Error Handling**:
- [ ] 403 errors display helpful message and stop operation
- [ ] 429 rate limit errors handled gracefully (future)
- [ ] Network errors don't crash extension
- [ ] Invalid group pages show appropriate error

**Edge Cases**:
- [ ] Empty groups (0 members)
- [ ] Groups with no deprovisioned users
- [ ] APP_GROUP type detected and blocked
- [ ] BUILT_IN groups show warning
- [ ] Very large groups (10,000+ members)

### Future: Automated Testing

**Planned Test Structure** (tests/ directory ready):
```javascript
// tests/unit/parsers.test.js
describe('extractGroupIdFromUrl', () => {
  test('extracts ID from /admin/group/ pattern', () => {
    const url = 'https://company.okta.com/admin/group/00g123456789abcdef';
    expect(extractGroupIdFromUrl(url)).toBe('00g123456789abcdef');
  });
});

// tests/integration/api.test.js
describe('Pagination', () => {
  test('fetches all pages for large groups', async () => {
    // Mock API responses
    // Test pagination logic
  });
});
```

---

## Git Workflow

### Branch Strategy

**Main Branches**:
- `main` - Production-ready code (v2.0.0+)
- `develop` - Integration branch (optional for larger teams)

**Feature Branches**:
- `feature/export-csv` - New features
- `fix/pagination-bug` - Bug fixes
- `docs/api-reference` - Documentation updates

### Commit Messages

**Format**: `type(scope): brief description`

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Formatting, no code change
- `refactor` - Code restructuring
- `perf` - Performance improvement
- `test` - Adding tests
- `chore` - Build process, dependencies

**Examples**:
```
feat(export): add CSV export for group members
fix(pagination): handle groups with 5000+ users correctly
docs(readme): update installation instructions
refactor(api): extract common request logic into separate function
perf(dom): batch result display updates
```

**Message Body** (for complex changes):
```
feat(bulk-add): implement bulk user addition from CSV

- Parse CSV with email validation
- Add users in batches of 50
- Show progress for large imports
- Handle duplicate emails gracefully

Closes #42
```

### Pull Request Process

See `.github/PULL_REQUEST_TEMPLATE.md` for required checklist:
- Code follows style guide (this document)
- Comments added for complex logic
- Documentation updated
- CHANGELOG.md updated
- Manually tested on Okta group pages

---

## Chrome Extension Specific

### Manifest V3 Best Practices

**Service Worker Lifecycle**:
```javascript
// background.js - Keep service worker lightweight

// Good - minimal background work
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      version: '0.0.1',
      operationDelay: 100
    });
  }
});

// Bad - long-running background tasks
setInterval(() => {
  // Service worker may be terminated, this won't work reliably
}, 60000);
```

**Message Passing Pattern**:
```javascript
// popup.js - Send message
const response = await chrome.tabs.sendMessage(tabId, {
  action: 'makeApiRequest',
  endpoint: '/api/v1/groups/123',
  method: 'GET'
});

// content.js - Receive message
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'makeApiRequest') {
    makeApiRequest(request.endpoint, request.method)
      .then(sendResponse);
    return true; // Keep channel open for async
  }
});
```

**Storage Best Practices**:
```javascript
// Use chrome.storage.sync for user preferences (100KB limit)
await chrome.storage.sync.set({
  operationDelay: 100,
  defaultAction: 'list'
});

// Use chrome.storage.local for larger data (10MB limit)
await chrome.storage.local.set({
  operationHistory: historyArray
});

// Always handle errors
try {
  const { operationDelay } = await chrome.storage.sync.get('operationDelay');
} catch (error) {
  console.error('Storage error:', error);
  // Use defaults
}
```

### Permissions Justification

**Current Permissions** (manifest.json):
```json
{
  "permissions": [
    "activeTab",      // Required: Access current Okta tab to extract group info
    "scripting",      // Required: Inject content script for API calls
    "storage",        // Required: Save user preferences (future)
    "contextMenus"    // Optional: Right-click menu for quick access
  ],
  "host_permissions": [
    "https://*.okta.com/*",        // Required: Make API requests
    "https://*.oktapreview.com/*", // Required: Preview environments
    "https://*.okta-emea.com/*"    // Required: EMEA regions
  ]
}
```

### Content Script Isolation

```javascript
// Content script runs in isolated world
// Cannot access page's JavaScript variables directly
// Can access DOM but should minimize manipulation

// Good - minimal DOM interaction
const xsrfToken = document.getElementById('_xsrfToken')?.textContent;
const groupName = document.querySelector('h1[data-se="group-name"]')?.textContent;

// Bad - trying to access page JS
const pageVariable = window.pageVariable; // Won't work due to isolation
```

---

## Future Roadmap Features

### Planned Architecture Evolution

When implementing roadmap features from the promo poster, follow this structure:

```
src/
├── core/                    # Shared utilities (future)
│   ├── api/
│   │   ├── client.js       # OktaClient class
│   │   ├── endpoints.js    # Endpoint definitions
│   │   └── pagination.js   # Pagination utilities
│   ├── auth/
│   │   └── session.js      # XSRF token extraction
│   └── utils/
│       ├── validators.js   # Input validation
│       └── parsers.js      # URL/data parsing
├── features/                # Feature modules
│   ├── group-cleanup/      # Current: Remove deactivated
│   ├── rules-discovery/    # Coming: Conflict detection
│   ├── trace-memberships/  # Coming: User trace
│   ├── export/             # Coming: CSV export
│   └── app-mirror/         # Coming: Permission sync
└── ui/                      # UI components
    ├── popup/
    ├── components/          # Reusable components
    └── settings/            # Settings page
```

### Feature Implementation Guidelines

**For Each New Feature**:

1. **Create Feature Folder**:
   ```
   src/features/export/
   ├── export.js           # Core logic
   ├── formats.js          # CSV, JSON formatters
   └── ui.js               # UI integration
   ```

2. **Follow Existing Patterns**:
   - Use consistent error handling
   - Add progress tracking
   - Update UI with results
   - Handle large datasets

3. **Update Documentation**:
   - Add to README.md features list
   - Update CHANGELOG.md
   - Add inline code comments

4. **Test Thoroughly**:
   - Small groups (< 50 users)
   - Medium groups (200-1000 users)
   - Large groups (1000+ users)
   - Error cases

### Specific Feature Notes

**Export to CSV**:
- Use same pagination as current code
- Format: login, firstName, lastName, email, status, lastLogin
- Stream to download (don't accumulate in memory)

**Rules Discovery**:
- Fetch all group rules: `/api/v1/groups/rules`
- Analyze condition logic for overlaps
- Display conflicts in new UI panel

**Trace Memberships**:
- For a user ID, fetch: `/api/v1/users/{id}/groups`
- For each group, check if rule-based or direct
- Build dependency tree visualization

---

## Version Management

### Semantic Versioning

Format: `MAJOR.MINOR.PATCH`

**MAJOR** - Breaking changes
- v3.0.0: Major UI overhaul
- v4.0.0: New architecture with build system

**MINOR** - New features (backward compatible)
- v2.1.0: Add CSV export feature
- v2.2.0: Add rules discovery

**PATCH** - Bug fixes (backward compatible)
- v2.0.1: Fix pagination bug
- v2.0.2: Improve error messages

**Current**: v0.0.1 (Initial release)

### Release Checklist

Before tagging a release:
- [ ] Version bumped in manifest.json
- [ ] CHANGELOG.md updated with all changes
- [ ] README.md reflects current features
- [ ] Manual testing completed
- [ ] No console errors or warnings
- [ ] Extension loads and unloads cleanly
- [ ] Create git tag: `git tag -a v2.1.0 -m "Version 2.1.0"`
- [ ] Push tag: `git push origin v2.1.0`

---

## Additional Resources

### Okta API Documentation
- [Groups API](https://developer.okta.com/docs/reference/api/groups/)
- [Users API](https://developer.okta.com/docs/reference/api/users/)
- [Rate Limits](https://developer.okta.com/docs/reference/rate-limits/)
- [Error Codes](https://developer.okta.com/docs/reference/error-codes/)

### Chrome Extension Docs
- [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Chrome APIs](https://developer.chrome.com/docs/extensions/reference/)

### JavaScript Best Practices
- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)

---

**Document Version**: 0.0.1 (Initial release)
**Last Updated**: 2024-11-14
**Maintainer**: Okta Unbound Contributors
