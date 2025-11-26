# useOktaApi Hook

This directory contains the modular implementation of the `useOktaApi` hook, which provides all Okta API operations for the sidepanel.

## Directory Structure

```
useOktaApi/
├── README.md           # This file
├── types.ts            # Shared type definitions
├── core.ts             # Core API functions (makeApiRequest, sendMessage)
├── groupOperations.ts  # Group-related operations (coming soon)
├── userOperations.ts   # User-related operations (coming soon)
├── appOperations.ts    # App-related operations (coming soon)
└── index.ts            # Main hook that combines all modules
```

## Architecture

The hook is split into domain-specific modules to:
1. Reduce file size and improve maintainability
2. Enable tree-shaking of unused code
3. Make testing easier by isolating concerns
4. Provide clear organization for future developers

### Module Responsibilities

#### `core.ts`
- `sendMessage`: Send messages to content script
- `makeApiRequest`: Schedule API requests through background worker
- `cancelOperation`: Cancel ongoing operations
- `checkCancelled`: Verify operation wasn't cancelled
- `getCurrentUser`: Get logged-in admin user

#### `groupOperations.ts` (TODO)
- Group CRUD operations
- Member management
- Group rules
- Multi-group operations

#### `userOperations.ts` (TODO)
- User search and lookup
- User app assignments
- User group memberships
- Batch user operations

#### `appOperations.ts` (TODO)
- App assignment operations
- User-to-group conversion
- Bulk app assignment
- Security analysis

## Usage

```typescript
import { useOktaApi } from './hooks/useOktaApi';

const MyComponent = () => {
  const api = useOktaApi({
    targetTabId,
    onResult: (message, type) => console.log(message),
    onProgress: (current, total, message) => setProgress(current/total),
  });

  // Use API methods
  const groups = await api.getAllGroups();
  const users = await api.searchUsers('john');
};
```

## Adding New Operations

1. Identify the domain (group, user, app)
2. Add types to `types.ts` if needed
3. Implement in the appropriate module
4. Export from `index.ts`
5. Add tests

## Migration Status

The original monolithic `useOktaApi.ts` (2200+ lines) is being incrementally
migrated to this modular structure. During migration, the original file
remains functional while new code is added here.
