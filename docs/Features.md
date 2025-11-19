# Features

Okta Unbound provides a comprehensive suite of tools for Okta administrators to manage groups and users efficiently.

## Table of Contents

- [Security Posture Analysis](#security-posture-analysis)
- [Dashboard Tab](#dashboard-tab)
- [Audit Trail & Compliance](#audit-trail--compliance)
- [Multi-Group Operations](#multi-group-operations)
- [User Operations](#user-operations)
- [Export Functionality](#export-functionality)
- [Rule Inspector](#rule-inspector)
- [Smart Automation](#smart-automation)

## Security Posture Analysis

Enterprise-grade security insights based on Okta ISPM best practices.

### Capabilities

- **Orphaned Accounts Detection** - Find deprovisioned users still in groups
- **Never Logged In Detection** - Identify users who never logged in (30+ days old)
- **Inactive User Detection** - Flag inactive users (90+ and 180+ days)
- **Stale Membership Analysis** - 90+ day review recommendations
- **Security Score Calculation** - 0-100 score with severity-based findings
- **Risk Level Classification** - Critical, High, Medium, Low

### Features

- Bulk remediation with confirmation and progress tracking
- Export security findings to CSV for reporting
- Dashboard widget showing security status at-a-glance
- Automatic scan caching for 24 hours
- Performance-optimized batch API calls for large groups

### Usage

1. Navigate to Security tab
2. Click "Run Security Scan"
3. Review findings and security score
4. Take action on high-risk findings
5. Export report for compliance

[Learn more about Security Analysis →](guides/Security-Analysis.md)

## Dashboard Tab

Comprehensive at-a-glance insights with visual analytics.

### Key Metrics

- Real-time group health metrics and risk scoring
- Security posture widget with quick access to scan results
- Interactive pie chart showing user status distribution
- Membership source breakdown (direct vs rule-based)
- Recent activity audit log view

### Performance

- Automatic caching for fast performance (5-minute refresh)
- Loads in under 5 seconds for groups with 1000+ users

### Quick Actions

- Remove deprovisioned users
- Run security scan
- Export members
- View group rules

## Audit Trail & Compliance

Complete operation history for SOC2 compliance and accountability.

### What's Logged

- **Who** - Admin email who performed the action
- **What** - Specific operation type
- **When** - Timestamp with millisecond precision
- **Where** - Group ID and name
- **Result** - Success, partial success, or failure
- **Details** - User counts, API requests, duration, errors

### Features

- Persistent logging of all administrative actions
- Detailed metrics including duration and API request counts
- Automatic retention policy (30, 60, 90, 180, or 365 days)
- Export audit logs to CSV for compliance reporting
- Dashboard statistics showing operation trends
- Privacy-conscious: stores user IDs instead of emails for PII protection
- Fire-and-forget logging that never blocks operations

[Learn more about Audit Trail →](guides/Audit-Trail.md)

## Multi-Group Operations

Enterprise-scale bulk operations across multiple groups.

### Group Browser

- Load and browse all groups in your organization
- Search by name, description, or ID
- Filter by type (Okta Groups, App Groups, Built-in)
- Filter by size (<50, 50-200, 200-1000, 1000+ members)
- Sort by name, member count, or last updated
- Multi-select groups with checkboxes
- 30-minute intelligent caching for fast performance

### Group Collections

- Save frequently-used group sets for quick access
- Create named collections (e.g., "Sales Teams", "Engineering Groups")
- One-click loading of saved collections
- Update collections with current selection

### Cross-Group User Search

- Find users across all groups instantly
- Search by email, name, or user ID
- View all group memberships for any user
- Remove user from multiple groups at once
- Direct links to open user/group in Okta

### Bulk Operations

- Remove inactive users from all selected groups
- Export combined member list from multiple groups
- Remove specific user from multiple groups
- Run security scans across multiple groups
- Real-time progress tracking with per-group status
- Detailed results showing success/failure for each group
- Rate-limited to prevent API throttling

### Group Comparison

- Compare 2-5 groups side-by-side
- Interactive Venn diagram visualization (for 2 groups)
- View shared users and unique users per group
- Export comparison report to CSV
- Overlap analysis table showing intersection counts

### Performance

- Virtual scrolling for 200+ group lists
- Lazy loading of member counts
- Aggressive caching (groups: 30min, counts: 10min)
- Batch processing to respect rate limits

[Learn more about Multi-Group Operations →](guides/Multi-Group-Operations.md)

## User Operations

Manage users within groups with powerful filtering and actions.

### Smart Cleanup

Automatically remove all inactive users in one operation:
- DEPROVISIONED (deactivated)
- SUSPENDED
- LOCKED_OUT

### Custom Status Filtering

Filter and manage users by any Okta status:
- STAGED - Accounts first created, before activation
- PROVISIONED - User hasn't provided verification
- ACTIVE - User account is active
- RECOVERY - Password reset in progress
- PASSWORD_EXPIRED - Password needs update
- LOCKED_OUT - Exceeded login attempts
- SUSPENDED - Admin suspended account
- DEPROVISIONED - Deactivated account

### Actions

- **List Only** - View users matching filter
- **Remove from Group** - Bulk remove users

### Features

- Real-time progress tracking
- Detailed logging of all actions
- Confirmation before destructive operations
- API cost estimates before execution

## Export Functionality

Export group member data in multiple formats.

### Formats

- **CSV** - Excel-compatible spreadsheet
- **JSON** - Structured data format

### Data Included

- Login (username)
- First Name
- Last Name
- Email
- Status
- Created Date
- Last Login
- Group Memberships (for multi-group exports)

### Export Options

- Export all members
- Export filtered by status
- Export from multiple groups (deduplicated)
- Export security scan results
- Export comparison reports

### Features

- Automatic filename generation with timestamps
- Downloads to default browser downloads folder
- Large group support (10,000+ members)
- Progress indication during export

## Rule Inspector

Analyze all group rules in your organization.

### Capabilities

- View all group rules and their conditions
- Detect rule conflicts and overlaps
- Understand rule logic and expressions
- See which groups are affected by each rule
- Navigate directly from user to rule
- View rule assignments and conditions

### Features

- Automatic group name resolution
- Conflict detection between rules
- Rule caching for performance (5-minute TTL)
- Cross-tab navigation from users to rules
- Visual highlighting of selected rules

## Smart Automation

Automated tools to save time on common administrative tasks.

### One-Click Operations

- **Remove Deprovisioned Users** - Clean up deactivated accounts
- **Smart Cleanup** - Remove all inactive users at once
- **Security Scan** - Detect security risks automatically

### Scheduling

- Background cache refresh
- Automatic audit log retention cleanup
- Periodic security scan reminders (coming soon)

### Safety Features

- Confirmation modals with API cost estimates
- Detailed progress tracking
- Comprehensive error handling
- Audit trail of all operations
- Cancel operation support for long-running tasks

## API Cost Transparency

All operations show estimated API request counts.

### Features

- Hover tooltips on action buttons
- Confirmation dialogs with cost estimates
- Real-time API request counting during operations
- Audit logs include API request metrics

### Understanding Costs

- Each user removal: 1 API request
- Member list fetch: 1 request per 200 members
- Rule fetch: 1 request per 300 rules
- Security scan: Varies by group size and findings

## Supported User Statuses

Based on official Okta API documentation:

| Status | Description |
|--------|-------------|
| STAGED | Accounts first created, before activation flow |
| PROVISIONED | User hasn't provided verification or password |
| ACTIVE | User account is active and can access applications |
| RECOVERY | User has requested or admin initiated password reset |
| PASSWORD_EXPIRED | Password has expired and requires update |
| LOCKED_OUT | User exceeded login attempts defined in login policy |
| SUSPENDED | Admin explicitly suspended the account |
| DEPROVISIONED | Admin deactivated/deprovisioned the account |

[View full Okta Status Reference →](references/OKTA_STATUS_REFERENCE.md)

## Coming Soon

Features on the roadmap:

- Historical trend tracking and membership change analytics
- Trace user memberships to understand why users are in groups
- Attribute-based deep dive across groups
- Mirror app users and permissions across groups
- Scheduled operations
- Enhanced reporting and analytics

## Feature Requests

Have an idea for a new feature? [Open a feature request](https://github.com/samdhenderson/okta-unbound/issues/new?template=feature_request.md) on GitHub!
