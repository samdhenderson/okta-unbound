# API Reference

Documentation for Okta API endpoints used by Okta Unbound and internal extension APIs.

## Table of Contents

- [Okta API Endpoints](#okta-api-endpoints)
- [Extension APIs](#extension-apis)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Okta API Endpoints

Okta Unbound uses the following Okta API endpoints.

### Groups API

#### List Groups

```
GET /api/v1/groups
```

**Description:** Fetch all groups in the organization.

**Parameters:**
- `q` (optional) - Search query
- `filter` (optional) - Filter expression
- `limit` (optional) - Page size (max 200, default 10000)
- `after` (optional) - Pagination cursor

**Response:**
```json
[
  {
    "id": "00g1emaKYZTWRYYRRTSK",
    "created": "2023-01-15T10:00:00.000Z",
    "lastUpdated": "2023-06-20T14:30:00.000Z",
    "lastMembershipUpdated": "2023-06-20T14:30:00.000Z",
    "objectClass": ["okta:user_group"],
    "type": "OKTA_GROUP",
    "profile": {
      "name": "Engineering Team",
      "description": "All engineers"
    }
  }
]
```

**Headers:**
- `Link` - Pagination links (next, self)

**Usage in Extension:**
```typescript
const groups = await getAllGroups();
```

---

#### Get Group

```
GET /api/v1/groups/{groupId}
```

**Description:** Fetch a specific group by ID.

**Parameters:**
- `groupId` (required) - The group ID

**Response:**
```json
{
  "id": "00g1emaKYZTWRYYRRTSK",
  "created": "2023-01-15T10:00:00.000Z",
  "lastUpdated": "2023-06-20T14:30:00.000Z",
  "lastMembershipUpdated": "2023-06-20T14:30:00.000Z",
  "objectClass": ["okta:user_group"],
  "type": "OKTA_GROUP",
  "profile": {
    "name": "Engineering Team",
    "description": "All engineers"
  },
  "_links": {
    "logo": [
      { "name": "medium", "href": "...", "type": "image/png" }
    ],
    "users": { "href": "..." },
    "apps": { "href": "..." }
  }
}
```

---

#### List Group Members

```
GET /api/v1/groups/{groupId}/users
```

**Description:** Fetch all members of a specific group.

**Parameters:**
- `groupId` (required) - The group ID
- `limit` (optional) - Page size (max 200, default 200)
- `after` (optional) - Pagination cursor

**Response:**
```json
[
  {
    "id": "00u1emaKYZTWRYYRRTSK",
    "status": "ACTIVE",
    "created": "2023-01-10T10:00:00.000Z",
    "activated": "2023-01-10T10:05:00.000Z",
    "statusChanged": "2023-01-10T10:05:00.000Z",
    "lastLogin": "2025-11-15T09:30:00.000Z",
    "lastUpdated": "2023-06-01T12:00:00.000Z",
    "passwordChanged": "2023-01-10T10:05:00.000Z",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "login": "john.doe@example.com",
      "mobilePhone": null
    },
    "_links": {
      "self": { "href": "..." }
    }
  }
]
```

**Headers:**
- `Link` - Pagination links (next, self)
- `x-total-count` - Total count of members (when `limit=1`)

**Usage in Extension:**
```typescript
const members = await getAllGroupMembers(groupId);
const count = await getGroupMemberCount(groupId); // Uses limit=1 and x-total-count
```

---

#### Remove User from Group

```
DELETE /api/v1/groups/{groupId}/users/{userId}
```

**Description:** Remove a specific user from a group.

**Parameters:**
- `groupId` (required) - The group ID
- `userId` (required) - The user ID

**Response:** `204 No Content` on success

**Errors:**
- `403` - Insufficient permissions or group is app-managed
- `404` - Group or user not found

**Usage in Extension:**
```typescript
await removeUserFromGroup(groupId, userId);
```

---

### Group Rules API

#### List Group Rules

```
GET /api/v1/groups/rules
```

**Description:** Fetch all group assignment rules.

**Parameters:**
- `limit` (optional) - Page size (max 300, default 300)
- `after` (optional) - Pagination cursor
- `search` (optional) - Search query
- `expand` (optional) - Expand related resources

**Response:**
```json
[
  {
    "id": "0pr1emaKYZTWRYYRRTSK",
    "type": "group_rule",
    "name": "Engineering Department Rule",
    "created": "2023-01-15T10:00:00.000Z",
    "lastUpdated": "2023-06-20T14:30:00.000Z",
    "status": "ACTIVE",
    "conditions": {
      "people": {
        "users": { "exclude": [] },
        "groups": { "exclude": [] }
      },
      "expression": {
        "value": "user.department == 'Engineering'",
        "type": "urn:okta:expression:1.0"
      }
    },
    "actions": {
      "assignUserToGroups": {
        "groupIds": ["00g1emaKYZTWRYYRRTSK"]
      }
    }
  }
]
```

**Usage in Extension:**
```typescript
const rules = await getAllGroupRules();
const filteredRules = await getGroupRulesForGroup(groupId);
```

---

### Users API

#### Get User

```
GET /api/v1/users/{userId}
```

**Description:** Fetch a specific user by ID.

**Parameters:**
- `userId` (required) - The user ID

**Response:**
```json
{
  "id": "00u1emaKYZTWRYYRRTSK",
  "status": "ACTIVE",
  "created": "2023-01-10T10:00:00.000Z",
  "activated": "2023-01-10T10:05:00.000Z",
  "statusChanged": "2023-01-10T10:05:00.000Z",
  "lastLogin": "2025-11-15T09:30:00.000Z",
  "lastUpdated": "2023-06-01T12:00:00.000Z",
  "passwordChanged": "2023-01-10T10:05:00.000Z",
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "login": "john.doe@example.com",
    "department": "Engineering",
    "title": "Senior Engineer"
  }
}
```

---

#### List User's Groups

```
GET /api/v1/users/{userId}/groups
```

**Description:** Fetch all groups a user is a member of.

**Response:**
```json
[
  {
    "id": "00g1emaKYZTWRYYRRTSK",
    "profile": {
      "name": "Engineering Team",
      "description": "All engineers"
    },
    "type": "OKTA_GROUP"
  }
]
```

**Usage in Extension:**
```typescript
const userGroups = await getUserGroups(userId);
```

---

## Extension APIs

Internal APIs provided by the extension.

### useOktaApi Hook

Main hook for interacting with Okta API.

```typescript
const {
  getAllGroupMembers,
  getGroupMemberCount,
  removeUserFromGroup,
  getAllGroups,
  getGroupRulesForGroup,
  getUserGroups,
  cancelOperation,
} = useOktaApi({ targetTabId });
```

#### getAllGroupMembers()

```typescript
async function getAllGroupMembers(
  groupId: string,
  onProgress?: (progress: ProgressUpdate) => void
): Promise<GroupMember[]>
```

**Description:** Fetch all members of a group with automatic pagination.

**Parameters:**
- `groupId` - The group ID
- `onProgress` - Optional callback for progress updates

**Returns:** Array of group members

**Example:**
```typescript
const members = await getAllGroupMembers('00g123', (progress) => {
  console.log(`Loaded ${progress.processed}/${progress.total} members`);
});
```

---

#### getGroupMemberCount()

```typescript
async function getGroupMemberCount(groupId: string): Promise<number>
```

**Description:** Get the total count of group members efficiently (single API call).

**Returns:** Number of members

**Example:**
```typescript
const count = await getGroupMemberCount('00g123');
console.log(`Group has ${count} members`);
```

---

#### removeUserFromGroup()

```typescript
async function removeUserFromGroup(
  groupId: string,
  userId: string
): Promise<void>
```

**Description:** Remove a user from a group.

**Throws:** Error if operation fails (permission denied, etc.)

**Example:**
```typescript
try {
  await removeUserFromGroup('00g123', '00u456');
  console.log('User removed successfully');
} catch (error) {
  console.error('Failed to remove user:', error);
}
```

---

#### getAllGroups()

```typescript
async function getAllGroups(): Promise<Group[]>
```

**Description:** Fetch all groups in the organization.

**Returns:** Array of groups

**Caching:** Cached for 30 minutes

---

#### getGroupRulesForGroup()

```typescript
async function getGroupRulesForGroup(groupId: string): Promise<GroupRule[]>
```

**Description:** Fetch all rules that assign users to a specific group.

**Returns:** Array of group rules

**Caching:** Uses global rules cache (5-minute TTL)

---

### Audit Logger

Service for logging operations to the audit trail.

```typescript
import { auditLogger } from '@/shared/auditLogger';

await auditLogger.logOperation({
  action: 'removeUsers',
  groupId: '00g123',
  groupName: 'Engineering Team',
  performedBy: 'admin@example.com',
  userCount: 15,
  successCount: 15,
  failureCount: 0,
  duration: 3200,
  apiRequests: 15,
  details: 'Removed 15 deprovisioned users',
});
```

**Methods:**
- `logOperation(entry)` - Log an operation
- `getRecentLogs(limit)` - Get recent audit logs
- `exportLogs()` - Export all logs to CSV
- `clearLogs()` - Clear all audit logs
- `getStats()` - Get audit statistics

---

### Rules Cache

Global cache for group rules.

```typescript
import { RulesCache } from '@/shared/rulesCache';

// Get all rules (cached)
const rules = await RulesCache.get();

// Get rules for specific group
const groupRules = await RulesCache.getFilteredByGroup(groupId);

// Invalidate cache
RulesCache.invalidate();

// Check if expired
const expired = RulesCache.isExpired();
```

---

## Error Handling

### Error Types

**401 Unauthorized**
- **Cause:** Session expired
- **Action:** Prompt user to log in again

**403 Forbidden**
- **Cause:** Insufficient permissions or app-managed group
- **Action:** Show permission error, skip operation

**429 Too Many Requests**
- **Cause:** Rate limit exceeded
- **Action:** Wait and retry, adjust rate limit settings

**404 Not Found**
- **Cause:** Group or user doesn't exist
- **Action:** Show error, skip operation

**Network Errors**
- **Cause:** Connection issues
- **Action:** Retry with exponential backoff

### Error Response Format

```typescript
interface ApiError {
  errorCode: string;
  errorSummary: string;
  errorLink?: string;
  errorId?: string;
  errorCauses?: Array<{
    errorSummary: string;
  }>;
}
```

### Error Handling Pattern

```typescript
try {
  await removeUserFromGroup(groupId, userId);
} catch (error: any) {
  if (error.status === 403) {
    console.error('Permission denied');
  } else if (error.status === 429) {
    console.error('Rate limit exceeded, wait and retry');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Rate Limits

### Okta API Rate Limits

Okta enforces per-minute and per-second rate limits:

- **Default:** 600 requests/minute, 10 requests/second
- **Varies by:** Organization tier and endpoint

### Extension Rate Limiting

Built-in delays to respect limits:

| Operation | Delay |
|-----------|-------|
| Remove user from group | 100ms |
| Batch API requests | 200ms |
| Bulk group operations | 500ms |

### Rate Limit Headers

Okta returns rate limit info in response headers:

- `X-Rate-Limit-Limit` - Request limit per time window
- `X-Rate-Limit-Remaining` - Requests remaining
- `X-Rate-Limit-Reset` - Timestamp when limit resets

### Handling Rate Limits

1. **Monitor remaining requests** in headers
2. **Back off exponentially** on 429 errors
3. **Adjust delays** in settings if needed
4. **Process in smaller batches** for large operations

---

## Best Practices

### API Usage

1. **Cache aggressively** - Avoid redundant API calls
2. **Use pagination** - Don't fetch everything at once
3. **Batch operations** - Process multiple items with delays
4. **Handle errors gracefully** - Retry transient errors
5. **Monitor rate limits** - Adjust based on usage

### Performance

1. **Fetch only what you need** - Use limit=1 for counts
2. **Parallel requests** - Fetch independent data concurrently
3. **Lazy load** - Load data on-demand
4. **Debounce searches** - Reduce API calls from user input

### Security

1. **Never log sensitive data** - No passwords, tokens, or PII
2. **Validate inputs** - Sanitize user inputs
3. **Handle permissions** - Gracefully handle 403 errors
4. **Secure storage** - Store only necessary data locally

---

## References

- [Okta API Documentation](https://developer.okta.com/docs/reference/)
- [Okta Groups API](https://developer.okta.com/docs/reference/api/groups/)
- [Okta Users API](https://developer.okta.com/docs/reference/api/users/)
- [Okta API Rate Limits](https://developer.okta.com/docs/reference/rate-limits/)

[← Back to Home](../Home.md)
