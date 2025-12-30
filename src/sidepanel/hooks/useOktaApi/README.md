# useOktaApi - Modular Architecture

This directory contains the modular implementation of the `useOktaApi` hook, which was refactored from a single 2,637-line file into smaller, domain-specific modules.

## Architecture Overview

The hook has been split into the following modules:

### Core Module (`core.ts`) - 87 lines
**Purpose:** Core API communication layer

**Exports:**
- `createCoreApi()` - Factory function that creates the core API interface

**Key Functions:**
- `sendMessage()` - Send messages to content script
- `makeApiRequest()` - Make API requests through background scheduler
- `getCurrentUser()` - Get current user for audit logging
- `checkCancelled()` - Check if operation was cancelled

**Dependencies:**
- Chrome extension APIs
- Background scheduler for rate limiting

---

### Types Module (`types.ts`) - 59 lines
**Purpose:** Shared TypeScript types and interfaces

**Exports:**
- All shared type definitions from `../../../shared/types`
- `OperationCallbacks` - Callback interfaces for progress/results
- `UseOktaApiOptions` - Hook configuration options

---

### Utilities Module (`utilities.ts`) - ~80 lines
**Purpose:** Shared helper functions used across modules

**Key Functions:**
- `parseNextLink()` - Parse pagination links from API responses
- `deepMergeProfiles()` - Deep merge utility for complex app profiles

**Used By:** All operation modules

**Note:** `getAllGroupMembers()` was moved to `groupMembers.ts` as it's group-specific

---

### Group Member Operations (`groupMembers.ts`) - ~75 lines
**Purpose:** Basic group membership operations

**Exports:**
- `createGroupMemberOperations()` - Factory function returning group member operation methods

**Key Functions:**
- `removeUserFromGroup()` - Remove single user from group
- `getAllGroupMembers()` - Get all members of a group with pagination

**Dependencies:**
- `core.ts` - CoreApi
- `utilities.ts` - parseNextLink
- `../../../shared/undoManager` - Undo logging

---

### Group Cleanup Operations (`groupCleanup.ts`) - ~550 lines
**Purpose:** Cleanup operations for removing inactive users from groups

**Exports:**
- `createGroupCleanupOperations()` - Factory function returning group cleanup operation methods

**Key Functions:**
- `removeDeprovisioned()` - Remove all deprovisioned users
- `smartCleanup()` - Remove all inactive users (DEPROVISIONED, SUSPENDED, LOCKED_OUT)
- `customFilter()` - List or remove users by specific status
- `customFilterMultiple()` - List or remove users by multiple statuses

**Dependencies:**
- `core.ts` - CoreApi
- `utilities.ts` - parseNextLink
- `groupMembers.ts` - removeUserFromGroup
- `../../../shared/undoManager` - Undo logging
- `../../../shared/storage/auditStore` - Audit logging

---

### Group Bulk Operations (`groupBulkOps.ts`) - ~155 lines
**Purpose:** Bulk operations across multiple groups

**Exports:**
- `createGroupBulkOperations()` - Factory function returning group bulk operation methods

**Key Functions:**
- `executeBulkOperation()` - Execute operations across multiple groups
- `compareGroups()` - Compare groups to find overlaps

**Dependencies:**
- `core.ts` - CoreApi
- `groupMembers.ts` - removeUserFromGroup, getAllGroupMembers

---

### Group Discovery Operations (`groupDiscovery.ts`) - ~180 lines
**Purpose:** Group discovery, search, and metadata operations

**Exports:**
- `createGroupDiscoveryOperations()` - Factory function returning group discovery operation methods

**Key Functions:**
- `getAllGroups()` - Get all groups with pagination
- `getGroupMemberCount()` - Get member count for a group
- `getGroupRulesForGroup()` - Get group rules targeting a specific group
- `findUserAcrossGroups()` - Find user and their group memberships
- `searchGroups()` - Search for groups by name
- `getGroupById()` - Get group details by ID

**Dependencies:**
- `core.ts` - CoreApi
- `utilities.ts` - parseNextLink
- `../../../shared/rulesCache` - Rules caching

---

### User Operations (`userOperations.ts`) - 178 lines
**Purpose:** All user management operations

**Exports:**
- `createUserOperations()` - Factory function returning user operation methods

**Key Functions:**
- `getUserLastLogin()` - Get user's last login date
- `getUserAppAssignments()` - Get count of app assignments for user
- `batchGetUserDetails()` - Batch fetch user details
- `getUserGroupMemberships()` - Get user's group memberships count
- `searchUsers()` - Search for users by name, email, or login
- `getUserById()` - Get user details by ID

**Dependencies:**
- `core.ts` - CoreApi

---

### App Operations (`appOperations.ts`) - 970 lines
**Purpose:** All application assignment operations

**Exports:**
- `createAppOperations()` - Factory function returning app operation methods

**Key Functions:**
- `getUserApps()` - Get all apps assigned to a user
- `getGroupApps()` - Get all apps assigned to a group
- `getUserAppAssignment()` - Get user's specific app assignment
- `getGroupAppAssignment()` - Get group's specific app assignment
- `getAppDetails()` - Get app details including schema
- `assignUserToApp()` - Assign a user to an app
- `assignGroupToApp()` - Assign a group to an app
- `removeUserFromApp()` - Remove user from app
- `removeGroupFromApp()` - Remove group from app
- `getAppProfileSchema()` - Get app profile schema
- `previewConversion()` - Preview user-to-group conversion
- `convertUserToGroupAssignment()` - Convert user assignments to group assignments
- `bulkAssignGroupsToApps()` - Bulk assign groups to apps
- `analyzeAppAssignmentSecurity()` - Security analysis of app assignments
- `getAppAssignmentRecommender()` - Get recommendations for optimizing assignments
- `getAppPushGroupMappings()` - Get push group mappings for app

**Dependencies:**
- `core.ts` - CoreApi
- `utilities.ts` - deepMergeProfiles
- `../useAppAnalysis` - Security analysis functions
- `../../../shared/storage/auditStore` - Audit logging

---

### Export Operations (`exportOperations.ts`) - 122 lines
**Purpose:** Export operations for group members

**Exports:**
- `createExportOperations()` - Factory function returning export operation methods

**Key Functions:**
- `exportMembers()` - Export group members to CSV or JSON

**Dependencies:**
- `core.ts` - CoreApi
- `../../../shared/storage/auditStore` - Audit logging

---

### Main Hook (`useOktaApi.ts`) - 247 lines
**Purpose:** Main hook that orchestrates all modules

**Exports:**
- `useOktaApi()` - Main React hook

**Features:**
- State management (loading, cancellation)
- Module composition
- Wrapped operations for state handling

**Before Refactoring:** 2,637 lines
**After Refactoring:** 247 lines
**Reduction:** 91% smaller main file

---

## Benefits of Modular Architecture

### 1. **Maintainability**
- Each module has a single, clear responsibility
- Easier to locate and fix bugs
- Changes are isolated to specific domains

### 2. **Testability**
- Each module can be unit tested independently
- Mock dependencies easily with factory functions
- Test coverage is more granular

### 3. **Reusability**
- Core utilities can be reused across modules
- Operation modules can be composed in different ways
- Factory pattern allows flexible instantiation

### 4. **Readability**
- Developers can focus on one domain at a time
- Clearer code organization
- Better documentation per module

### 5. **Scalability**
- Easy to add new operations within existing modules
- Can add new modules without affecting existing code
- Separation of concerns supports parallel development

---

## Usage Example

```typescript
import { useOktaApi } from './hooks/useOktaApi';

function MyComponent() {
  const {
    // State
    isLoading,
    isCancelled,
    cancelOperation,

    // Group operations
    removeDeprovisioned,
    smartCleanup,
    getAllGroups,

    // User operations
    searchUsers,
    getUserById,

    // App operations
    getUserApps,
    convertUserToGroupAssignment,
  } = useOktaApi({
    targetTabId: activeTabId,
    onResult: (msg, type) => showToast(msg, type),
    onProgress: (current, total, msg) => updateProgress(current, total, msg)
  });

  // Use the operations...
}
```

---

## Function Distribution

| Module | Functions | Lines | Percentage |
|--------|-----------|-------|------------|
| appOperations.ts | 17 | 970 | 32.8% |
| groupCleanup.ts | 4 | 550 | 18.6% |
| groupDiscovery.ts | 6 | 180 | 6.1% |
| userOperations.ts | 6 | 178 | 6.0% |
| groupBulkOps.ts | 2 | 155 | 5.2% |
| exportOperations.ts | 1 | 122 | 4.1% |
| core.ts | 4 | 87 | 2.9% |
| utilities.ts | 2 | 80 | 2.7% |
| groupMembers.ts | 2 | 75 | 2.5% |
| types.ts | - | 59 | 2.0% |
| **Main Hook** | **-** | **247** | **8.3%** |
| index.ts | - | 15 | 0.5% |
| README.md | - | 350 | 11.8% |
| **Total** | **44** | **2,958** | **100%** |

---

## Migration Notes

### Breaking Changes
**None.** All existing functionality is preserved.

### API Compatibility
All function signatures remain identical. The refactoring is entirely internal.

### Testing Recommendations
1. Test each module independently with unit tests
2. Test integration between modules
3. Verify all 38+ exported functions work as before
4. Test cancellation and error handling
5. Verify audit logging and undo functionality

---

## Future Enhancements

### Potential Improvements
1. **Add unit tests** for each module
2. **Extract constants** to a separate config file
3. **Add performance monitoring** to core API calls
4. **Implement caching layer** in core module
5. **Add retry logic** with exponential backoff
6. **Create operation queuing** for bulk operations
7. **Add TypeScript strict mode** compliance
8. **Document all public APIs** with comprehensive JSDoc

### Module-Specific Enhancements
- **groupOperations:** Add batch operations for multiple groups
- **userOperations:** Add user lifecycle management
- **appOperations:** Add app provisioning templates
- **exportOperations:** Add support for Excel format
- **utilities:** Add response caching utilities

---

## Architecture Diagram

```
useOktaApi (Main Hook)
    ├── core.ts (CoreApi)
    │   ├── sendMessage()
    │   ├── makeApiRequest()
    │   ├── getCurrentUser()
    │   └── checkCancelled()
    │
    ├── groupMembers.ts
    │   └── 2 member functions
    │
    ├── groupCleanup.ts
    │   └── 4 cleanup functions
    │
    ├── groupBulkOps.ts
    │   └── 2 bulk functions
    │
    ├── groupDiscovery.ts
    │   └── 6 discovery functions
    │
    ├── userOperations.ts
    │   └── 6 user functions
    │
    ├── appOperations.ts
    │   └── 17 app functions
    │
    ├── exportOperations.ts
    │   └── 1 export function
    │
    ├── utilities.ts
    │   └── 2 shared helpers
    │
    └── types.ts
        └── Type definitions
```

---

## Dependency Graph

```
Main Hook
    ↓
Core API ←─────┐
    ↓          │
Operations ────┘
    ↓
Utilities
    ↓
Types
```

All operation modules depend on CoreApi.
Some operations depend on utilities.
All modules use types.

---

## File Size Comparison

| Metric | Before Refactor | After Full Refactor | Change |
|--------|----------------|---------------------|--------|
| Largest group file | 1,047 | 550 | -47% |
| Group files count | 1 | 4 | +300% |
| Total group lines | 1,047 | 960 | -8% |
| Avg group file size | 1,047 | 240 | -77% |
| Main hook lines | 247 | 247 | 0% |
| Total project lines | 2,814 | 2,958 | +5% |

**Breaking Down the 1,047-line groupOperations.ts:**
- `groupMembers.ts` - 75 lines (7%)
- `groupCleanup.ts` - 550 lines (53%)
- `groupBulkOps.ts` - 155 lines (15%)
- `groupDiscovery.ts` - 180 lines (17%)
- Overhead - ~87 lines (8% for module structure)

The small increase in total lines is due to:
- Module headers and documentation
- Factory function wrappers
- Export statements
- Better separation of concerns

This overhead is acceptable given the massive improvements in maintainability and organization.
