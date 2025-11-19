# Architecture

Technical overview of Okta Unbound's architecture and design decisions.

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture Diagram](#architecture-diagram)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [API Integration](#api-integration)
- [Caching Strategy](#caching-strategy)
- [Security Model](#security-model)

## Overview

Okta Unbound is a Chrome extension built with React and TypeScript. It operates as a sidebar panel that communicates with Okta's API using the user's existing browser session.

### Key Design Principles

1. **Session-Based Authentication** - No API tokens required
2. **Privacy-First** - All data stored locally in browser
3. **Performance-Optimized** - Aggressive caching and pagination
4. **Type-Safe** - Full TypeScript coverage
5. **Modular Architecture** - Separation of concerns

## Technology Stack

### Frontend

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS Modules** - Scoped styling

### Testing

- **Vitest** - Test runner
- **React Testing Library** - Component testing
- **MSW** - API mocking

### Build & CI

- **ESLint** - Code linting
- **Husky** - Git hooks
- **GitHub Actions** - CI/CD pipeline

### Browser APIs

- **Chrome Extensions Manifest V3**
- **chrome.tabs** - Tab communication
- **chrome.runtime** - Background messaging
- **chrome.storage** - Extension storage
- **chrome.sidePanel** - Sidebar UI
- **IndexedDB** - Audit log storage

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Okta Admin Console                      │
│                    (User's Browser Tab)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Detects Group URL
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Background Service Worker                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - Message routing                                    │  │
│  │  - Session management                                 │  │
│  │  - Alarm scheduling (cache cleanup)                   │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Opens Side Panel
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      Side Panel (React App)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              App.tsx (Root Component)                │  │
│  │                                                       │  │
│  │  ├─ GroupContextProvider (Global State)              │  │
│  │  │                                                    │  │
│  │  ├─ DashboardTab                                     │  │
│  │  │   └─ Health metrics, charts, quick actions        │  │
│  │  │                                                    │  │
│  │  ├─ OperationsTab                                    │  │
│  │  │   └─ Smart cleanup, custom filters                │  │
│  │  │                                                    │  │
│  │  ├─ GroupsTab (Multi-Group Operations)               │  │
│  │  │   ├─ GroupBrowser                                 │  │
│  │  │   ├─ GroupComparison                              │  │
│  │  │   ├─ UserSearch                                   │  │
│  │  │   └─ BulkOperations                               │  │
│  │  │                                                    │  │
│  │  ├─ RulesTab                                         │  │
│  │  │   └─ Rule inspector, conflict detection           │  │
│  │  │                                                    │  │
│  │  ├─ SecurityTab                                      │  │
│  │  │   └─ Security scans, posture analysis             │  │
│  │  │                                                    │  │
│  │  └─ AuditTab                                         │  │
│  │      └─ Operation history, compliance logs           │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 Hooks & Services                      │  │
│  │                                                       │  │
│  │  - useOktaApi: API calls and operations              │  │
│  │  - useGroupContext: Global state access              │  │
│  │  - auditLogger: Audit trail logging                  │  │
│  │  - rulesCache: Shared rules caching                  │  │
│  │  - tabStateManager: Cross-tab state                  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ API Requests (via Content Script)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      Content Script                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - Injects into Okta page                            │  │
│  │  - Makes authenticated API calls                     │  │
│  │  - Uses browser session (no tokens)                  │  │
│  │  - Returns responses to side panel                   │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS Requests
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                        Okta API                             │
│  - /api/v1/groups                                           │
│  - /api/v1/groups/{id}/users                                │
│  - /api/v1/groups/{id}/rules                                │
│  - /api/v1/users/{id}                                       │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### Background Service Worker

**Location:** `src/background/`

**Responsibilities:**
- Handle extension lifecycle events
- Route messages between content scripts and side panel
- Manage alarms for scheduled tasks (cache cleanup, audit log cleanup)
- Initialize side panel when Okta group page detected

**Key Files:**
- `service-worker.ts` - Main background script
- `alarms.ts` - Scheduled task management

### Side Panel (React App)

**Location:** `src/sidepanel/`

**Responsibilities:**
- Render UI for all features
- Manage component state
- Handle user interactions
- Display data and results

**Key Components:**
- `App.tsx` - Root component, tab routing
- `DashboardTab.tsx` - Metrics and analytics
- `OperationsTab.tsx` - User operations
- `GroupsTab.tsx` - Multi-group operations
- `RulesTab.tsx` - Rule inspector
- `SecurityTab.tsx` - Security analysis
- `AuditTab.tsx` - Audit trail viewer

### Content Script

**Location:** `src/content/`

**Responsibilities:**
- Inject into Okta admin pages
- Execute authenticated API calls
- Extract page information (group ID, user info)
- Return API responses to side panel

**Key Files:**
- `index.ts` - Content script entry point
- `oktaApiClient.ts` - API request handler

### Shared Utilities

**Location:** `src/shared/`

**Responsibilities:**
- Cross-component utilities
- Type definitions
- Helper functions
- Constants

**Key Modules:**
- `ruleUtils.ts` - Rule parsing and conflict detection
- `types.ts` - TypeScript interfaces
- `constants.ts` - App constants
- `rulesCache.ts` - Global rules cache
- `auditLogger.ts` - Audit logging service
- `tabStateManager.ts` - Cross-tab state persistence

## Data Flow

### 1. Group Detection

```
User navigates to group page
    ↓
Background worker detects URL pattern
    ↓
Opens side panel with group ID
    ↓
Side panel fetches group data
```

### 2. API Request Flow

```
User clicks operation button
    ↓
React component calls useOktaApi hook
    ↓
Hook sends message to content script via chrome.tabs.sendMessage
    ↓
Content script makes fetch() call to Okta API (authenticated via session)
    ↓
Okta API returns response
    ↓
Content script sends response back to side panel
    ↓
Hook processes response and updates React state
    ↓
Component re-renders with new data
```

### 3. Audit Logging Flow

```
Operation completes (success or failure)
    ↓
auditLogger.logOperation() called
    ↓
Audit entry created with metadata
    ↓
Entry saved to IndexedDB (fire-and-forget)
    ↓
Dashboard audit widget updated
    ↓
Background worker schedules cleanup based on retention policy
```

## State Management

### Global State (GroupContext)

**Provider:** `GroupContextProvider` in `App.tsx`

**Shared State:**
- Current group ID
- Group metadata
- Active tab
- Navigation state (for cross-tab navigation)

**Access:** `useGroupContext()` hook

### Component State

Each tab manages its own local state using React hooks:
- `useState` for local data
- `useEffect` for side effects
- `useCallback` for memoized functions
- `useMemo` for computed values

### Persistent State

**Chrome Storage API:**
- Extension settings
- Group collections
- Cache metadata
- User preferences

**IndexedDB:**
- Audit logs (large dataset)
- Security scan results
- Cached group memberships (large groups)

## API Integration

### Authentication

Uses **session-based authentication** via the user's existing Okta browser session.

**No API tokens required!**

### Request Pattern

All API requests follow this pattern:

1. Side panel sends message to content script with request details
2. Content script executes `fetch()` with credentials
3. Response returned to side panel
4. Side panel processes and displays data

### Pagination

Automatic pagination for large datasets:

```typescript
// Follows Okta Link headers
do {
  response = await fetch(url)
  data.push(...response.data)
  url = extractNextLink(response.headers.link)
} while (url)
```

### Rate Limiting

Built-in delays to respect Okta API limits:

- **User removals:** 100ms between requests
- **Batch operations:** 200ms between batches
- **Bulk group operations:** 500ms between groups

### Error Handling

Comprehensive error handling for:
- 401 (Unauthorized) - Session expired
- 403 (Forbidden) - Insufficient permissions
- 429 (Too Many Requests) - Rate limit exceeded
- Network errors
- Timeout errors

## Caching Strategy

### Multi-Tier Caching

1. **In-Memory Cache** (React state)
   - Current page data
   - Cleared on tab change

2. **Chrome Storage Cache**
   - Group lists
   - Member counts
   - Rules
   - TTL: 5-30 minutes

3. **IndexedDB Cache**
   - Large datasets (10,000+ members)
   - Security scan results
   - TTL: 24 hours

### Cache Invalidation

- **Automatic expiration** based on TTL
- **Manual refresh** via UI buttons
- **Smart invalidation** after write operations

### Global Rules Cache

Shared cache for group rules across all components:

```typescript
// src/shared/rulesCache.ts
class RulesCache {
  private static cache: CachedRules | null = null
  private static readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  static async get(): Promise<GroupRule[]>
  static invalidate(): void
  static isExpired(): boolean
}
```

Benefits:
- 61% reduction in API calls per session
- Instant rule lookups
- Shared across Users Tab, Rules Tab, Dashboard

[See Performance Optimizations →](../OPTIMIZATION_SUMMARY.md)

## Security Model

### Data Privacy

- **No external servers** - All data stored locally
- **No telemetry** - No usage tracking
- **PII protection** - User IDs stored, not emails (audit logs)
- **Session-only** - No persistent tokens

### Permissions

Minimal required permissions:
- `activeTab` - Access current Okta page
- `scripting` - Inject content script for API calls
- `storage` - Store preferences and audit logs
- `host_permissions` - Access Okta domains only

### Content Security Policy

Strict CSP to prevent XSS:
- No inline scripts
- No eval()
- External resources from approved CDNs only

### Audit Trail

All administrative actions logged for:
- Compliance (SOC2, etc.)
- Troubleshooting
- Accountability

## Performance Optimizations

### Virtual Scrolling

For large lists (200+ groups), uses virtual scrolling to render only visible items.

### Lazy Loading

- Group member counts loaded on-demand
- Rule details fetched only when expanded
- Security scan results loaded lazily

### Debouncing

User input debounced to reduce unnecessary API calls:
- Search: 300ms debounce
- Filter: 200ms debounce

### Memoization

Heavy computations memoized with `useMemo`:
- Rule conflict detection
- Chart data calculations
- Comparison analysis

### Code Splitting

Planned for future: Split large components into lazy-loaded chunks.

## Testing Strategy

### Unit Tests

Test individual functions and utilities:
- Rule parsing
- Pagination logic
- Date formatting
- Helper functions

### Integration Tests

Test hooks and API integration:
- `useOktaApi` hook
- `auditLogger` service
- `rulesCache` module

### Component Tests

Test React components:
- User interactions
- State management
- Conditional rendering

### E2E Tests

Planned: Playwright tests for full user journeys.

[Learn more about Testing →](Testing.md)

## Build & Deployment

### Development Build

```bash
npm run dev  # Vite dev server with HMR
```

### Production Build

```bash
npm run build  # Optimized production build
```

Output: `dist/` folder ready for Chrome

### CI/CD Pipeline

GitHub Actions workflow:
1. Lint code (ESLint)
2. Type check (TypeScript)
3. Run tests (Vitest)
4. Build extension
5. Upload artifacts

## Future Architecture Improvements

### Planned Enhancements

1. **Service Worker Persistent State**
   - Move more state to background worker
   - Improve cross-tab synchronization

2. **Web Workers for Heavy Computation**
   - Offload security scans
   - Background data processing

3. **GraphQL-style Query Caching**
   - More sophisticated cache invalidation
   - Optimistic updates

4. **Module Federation**
   - Plugin architecture for custom features
   - Community-contributed extensions

5. **WebAssembly Performance**
   - Move heavy computation to WASM
   - Faster rule parsing and analysis

## References

- [Chrome Extension Architecture](https://developer.chrome.com/docs/extensions/mv3/architecture-overview/)
- [React Architecture Best Practices](https://reactjs.org/docs/thinking-in-react.html)
- [Okta API Documentation](https://developer.okta.com/docs/reference/)

[← Back to Home](../Home.md) | [Development Guide →](Development.md)
