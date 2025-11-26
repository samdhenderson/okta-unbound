# Okta Unbound Architecture

This document describes the architecture and code organization of Okta Unbound.

## Directory Structure

```
src/
├── background/             # Service worker (background script)
│   └── index.ts           # API scheduler, message routing
├── content/               # Content script (injected into Okta pages)
│   └── index.ts           # Page context detection, API interception
├── shared/                # Shared code between all contexts
│   ├── types.ts           # TypeScript type definitions
│   ├── storage/           # Storage utilities
│   │   └── auditStore.ts  # Audit log persistence
│   ├── scheduler/         # API rate limiting
│   │   ├── apiScheduler.ts
│   │   ├── rateLimitDetector.ts
│   │   └── types.ts
│   ├── tabState/          # Tab state management
│   │   ├── tabStateManager.ts
│   │   └── types.ts
│   └── utils/             # Utility functions
│       ├── validation.ts  # ID validation, input sanitization
│       └── securityExport.ts
├── sidepanel/             # React UI
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # React entry point
│   ├── styles.css         # Global styles
│   ├── contexts/          # React contexts
│   │   ├── ProgressContext.tsx   # Global progress state
│   │   └── SchedulerContext.tsx  # API scheduler state
│   ├── components/        # React components (see below)
│   └── hooks/             # Custom React hooks
│       ├── useOktaApi.ts  # Main API hook
│       ├── useOktaApi/    # Modular API implementation
│       ├── useValidation.ts
│       └── ...
└── test/                  # Test utilities and mocks
```

## Component Organization

### Tab Components (`components/`)

Main navigation tabs:
- `DashboardTab.tsx` - Overview and quick stats
- `GroupsTab.tsx` - Multi-group operations
- `UsersTab.tsx` - User search and management
- `AppsTab.tsx` - App assignments (viewer, converter, bulk ops)
- `RulesTab.tsx` - Group rule management
- `SecurityTab.tsx` - Security analysis
- `OperationsTab.tsx` - Group-specific operations

### Sub-Component Folders

```
components/
├── apps/                  # Apps tab sub-components
│   ├── AppConverter.tsx   # User-to-group conversion wizard
│   ├── AppBulkAssignment.tsx
│   ├── types.ts          # Shared types
│   └── index.ts          # Barrel export
├── dashboard/            # Dashboard widgets
│   ├── QuickStatsCard.tsx
│   ├── SecurityWidget.tsx
│   ├── StatusPieChart.tsx
│   └── ...
├── groups/               # Groups tab sub-components
│   ├── GroupListItem.tsx # Memoized list item
│   ├── GroupCollections.tsx
│   ├── CrossGroupUserSearch.tsx
│   └── ...
└── security/             # Security tab sub-components
    ├── SecurityFindingsCard.tsx
    ├── StaleMembershipsList.tsx
    └── OrphanedAccountsList.tsx
```

## Key Patterns

### 1. Component Memoization

List item components use `React.memo` with custom comparison:

```typescript
const GroupListItem: React.FC<Props> = memo(({ group, selected, onToggleSelect }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  return (
    prevProps.group.id === nextProps.group.id &&
    prevProps.selected === nextProps.selected
  );
});

GroupListItem.displayName = 'GroupListItem';
```

### 2. Input Validation

Use the validation utilities for all user inputs:

```typescript
import { validateUserId, parseIds } from '../../shared/utils/validation';

// Single ID validation
const result = validateUserId(userId);
if (!result.isValid) {
  showError(result.error);
  return;
}

// Bulk ID parsing
const { valid, invalid, errors } = parseIds(bulkInput, 'group');
```

### 3. Progress Tracking

Use the ProgressContext for global progress state:

```typescript
const { updateProgress, completeProgress } = useProgress();

// During operation
updateProgress(current, total, 'Processing...', apiCallCount);

// When done
completeProgress();
```

### 4. API Operations

Use `useOktaApi` hook for all Okta API calls:

```typescript
const api = useOktaApi({
  targetTabId,
  onResult: (message, type) => setResultMessage({ text: message, type }),
  onProgress: (current, total, message) => setProgress({ current, total, message }),
});

// Make requests
const groups = await api.getAllGroups();
const users = await api.searchUsers('john');
```

## State Management

- **Local state**: Component-specific state using `useState`
- **Context**: Shared state (progress, scheduler) using React Context
- **Chrome storage**: Persistent data (audit logs, cache) using Chrome APIs

## Testing Conventions

- Test files: `*.test.ts` or `*.test.tsx`
- Mock handlers in `src/test/mocks/handlers.ts`
- Use Vitest + React Testing Library

## Adding New Features

1. **New sub-tab**: Create component in appropriate folder, add to parent tab
2. **New API operation**: Add to `useOktaApi.ts` or create new module in `useOktaApi/`
3. **New shared type**: Add to `shared/types.ts`
4. **New validation**: Add to `shared/utils/validation.ts`

## Performance Considerations

1. Use `React.memo` for list items
2. Use `useCallback` for event handlers passed to children
3. Use `useMemo` for expensive computations
4. Batch API calls when possible
5. Implement pagination for large lists
