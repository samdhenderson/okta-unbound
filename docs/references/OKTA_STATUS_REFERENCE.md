# Okta User Status Reference

## Official Okta API Status Values

This document provides the correct status values as defined in the official Okta API documentation.

### Status Values (API Property)

| API Status | Admin Console Label | Description |
|-----------|---------------------|-------------|
| `STAGED` | Staged | Accounts first created, before activation flow is initiated, or pending admin action |
| `PROVISIONED` | Pending User Action | User hasn't provided verification by clicking activation email or provided a password |
| `ACTIVE` | Active | User account is active and can access applications |
| `RECOVERY` | Password Reset | User requested password reset or admin initiated one on their behalf |
| `PASSWORD_EXPIRED` | Password Expired | Password has expired and requires update before accessing applications |
| `LOCKED_OUT` | Locked Out | User exceeded login attempts defined in the login policy |
| `SUSPENDED` | Suspended | Admin explicitly suspended the account (application assignments retained, profile can be updated) |
| `DEPROVISIONED` | Deactivated | Admin deactivated/deprovisioned the account (all assignments removed, password deleted) |

## Common Misconception

❌ **DEACTIVATED** - This is NOT a valid Okta API status value  
✅ **DEPROVISIONED** - This is the correct API status for deactivated users

The Admin Console shows "Deactivated" as the label, but the API property value is `DEPROVISIONED`.

## Usage in API Requests

When filtering or checking user status via the Okta API:

```javascript
// ✅ CORRECT
const deprovisionedUsers = users.filter(user => user.status === 'DEPROVISIONED');

// ❌ INCORRECT
const deactivatedUsers = users.filter(user => user.status === 'DEACTIVATED');
```

### API Query Examples

**Get all deprovisioned users:**
```
GET /api/v1/users?search=status+eq+"DEPROVISIONED"
```

**Get all active users:**
```
GET /api/v1/users?search=status+eq+"ACTIVE"
```

**Get suspended users:**
```
GET /api/v1/users?search=status+eq+"SUSPENDED"
```

## Extension Implementation

The Okta Group Manager extension has been updated to use the correct status values:

- The dropdown shows user-friendly labels like "DEPROVISIONED (Deactivated)"
- The API calls use the correct status values like `DEPROVISIONED`
- All filtering and operations work with the official Okta API status values

## Source

All status information is based on the official Okta documentation:
- https://developer.okta.com/docs/reference/api/users/
- https://help.okta.com/en-us/Content/Topics/users-groups-profiles/usgp-end-user-states.htm

Last verified: November 2024
