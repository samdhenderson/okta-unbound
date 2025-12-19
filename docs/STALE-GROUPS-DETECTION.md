# Stale Groups Detection Feature

## Overview

This document outlines a future feature to identify and manage stale/unused groups in Okta. The goal is to help administrators identify groups that may be candidates for archival or cleanup, improving security posture and reducing administrative overhead.

## Problem Statement

Organizations accumulate groups over time, and many become "stale" - no longer actively used but never deleted. This creates several issues:
- **Security risk**: Unused groups with permissions may become attack vectors
- **Administrative overhead**: More groups to manage and review
- **Compliance concerns**: Difficulty demonstrating proper access control
- **Performance**: Larger group lists slow down admin operations

## Staleness Indicators

### Primary Indicators (Available via Okta Groups API)

1. **`lastMembershipUpdated`** (ISO 8601 timestamp)
   - When group membership was last changed
   - Available via Groups API response
   - **Key Metric**: Groups unchanged for 6+ months are candidates

2. **`lastUpdated`** (ISO 8601 timestamp)
   - When group metadata was last updated (name, description, etc.)
   - Available via Groups API response
   - Useful secondary indicator

3. **`created`** (ISO 8601 timestamp)
   - When group was created
   - Helps identify age vs activity patterns

### Secondary Indicators (Requires Additional API Calls)

4. **Member Activity Analysis**
   - Calculate percentage of active vs inactive members
   - Check `lastLogin` dates for all members
   - Groups with >50% inactive members are candidates

5. **Empty or Near-Empty Groups**
   - Groups with 0 members
   - Groups with 1-2 members (may be forgotten test groups)
   - Already available via `expand=stats` (`usersCount`)

6. **Rule-Based Activity**
   - Groups with 0 active rules assigning users
   - Indicates manual-only membership (higher maintenance)
   - Already tracked in current implementation

### Advanced Indicators (Requires System Logs/Workflows)

7. **Okta System Log Analysis**
   - Track group usage in authentication events
   - Monitor group assignments in app access
   - Identify groups never referenced in last X days

8. **Okta Workflows Integration**
   - Detect if group is referenced in any active workflows
   - Check workflow execution logs for group usage
   - Identify groups used for automation vs access control

## Implementation Plan

### Phase 1: Basic Staleness Detection (Quick Win)

**Effort**: 4-6 hours
**API Impact**: Low (uses existing data from `expand=stats`)

#### Changes Required:

1. **Update GroupSummary Type** ([src/shared/types.ts](src/shared/types.ts))
```typescript
export interface GroupSummary {
  // ... existing fields
  created?: Date;
  lastMembershipUpdated?: Date;
  lastMemberActivity?: Date; // Calculated: most recent member lastLogin
  stalenessScore?: number; // 0-100 (higher = more stale)
  stalenessReasons?: string[]; // Why group is considered stale
  isStale?: boolean; // True if staleness score > threshold
}
```

2. **Extract Timestamp Fields** ([src/sidepanel/components/GroupsTab.tsx](src/sidepanel/components/GroupsTab.tsx#L71-L110))
```typescript
// In loadAllGroups() function
const groupSummaries: GroupSummary[] = allGroups.map((group: any) => {
  return {
    // ... existing fields
    created: group.created ? new Date(group.created) : undefined,
    lastMembershipUpdated: group.lastMembershipUpdated ? new Date(group.lastMembershipUpdated) : undefined,
  };
});
```

3. **Add Staleness Calculation Utility**
```typescript
// New file: src/shared/utils/stalenessCalculator.ts
export interface StalenessConfig {
  membershipThresholdDays: number; // Default: 180 (6 months)
  inactiveMemberThreshold: number; // Default: 0.5 (50%)
  emptyGroupWeight: number; // Default: 40 points
  noActivityWeight: number; // Default: 30 points
  highInactiveWeight: number; // Default: 30 points
}

export function calculateStaleness(
  group: GroupSummary,
  config: StalenessConfig = DEFAULT_CONFIG
): { score: number; reasons: string[]; isStale: boolean } {
  let score = 0;
  const reasons: string[] = [];
  const now = new Date();

  // Check membership updates
  if (group.lastMembershipUpdated) {
    const daysSinceUpdate = daysBetween(group.lastMembershipUpdated, now);
    if (daysSinceUpdate > config.membershipThresholdDays) {
      score += config.noActivityWeight;
      reasons.push(`No membership changes in ${Math.floor(daysSinceUpdate)} days`);
    }
  }

  // Check member count
  if (group.memberCount === 0) {
    score += config.emptyGroupWeight;
    reasons.push('Group is empty');
  } else if (group.memberCount <= 2) {
    score += config.emptyGroupWeight / 2;
    reasons.push('Very few members');
  }

  // Check inactive member ratio (requires member data)
  // This would be calculated separately when member data is available

  return {
    score,
    reasons,
    isStale: score >= 50, // Threshold for "stale" flag
  };
}
```

4. **Add Filter/Sort Options** ([src/sidepanel/components/GroupsTab.tsx](src/sidepanel/components/GroupsTab.tsx))
```typescript
// Add to existing filters
const [stalenessFilter, setStalenessFilter] = useState<'all' | 'stale' | 'active'>('all');

// Add sort option
const sortOptions = [
  'name',
  'memberCount',
  'lastUpdated',
  'lastMembershipUpdated', // NEW
  'stalenessScore', // NEW
];
```

5. **Add Visual Indicators** ([src/sidepanel/components/groups/GroupListItem.tsx](src/sidepanel/components/groups/GroupListItem.tsx))
```tsx
{group.isStale && (
  <span
    className="badge badge-warning"
    title={`Stale: ${group.stalenessReasons?.join(', ')}`}
  >
    🕰️ STALE
  </span>
)}
{group.lastMembershipUpdated && (
  <span className="last-activity" title="Last membership change">
    Last active: {formatRelativeTime(group.lastMembershipUpdated)}
  </span>
)}
```

### Phase 2: Member Activity Analysis (Medium Complexity)

**Effort**: 8-12 hours
**API Impact**: Medium (requires fetching member data for analysis)

1. **Add Member Activity Analysis**
   - Fetch member details for groups identified as potentially stale
   - Calculate percentage of inactive members
   - Determine most recent member login date
   - Update staleness score based on member activity

2. **Lazy Loading Pattern**
   - Only analyze member activity when user expands a group
   - Cache results to avoid repeated API calls
   - Show loading state during analysis

### Phase 3: System Log Analysis (Advanced)

**Effort**: 16-24 hours
**API Impact**: High (requires System Log API queries)

#### Okta System Log Integration

The Okta System Log API can track group usage across the system:

**Relevant Event Types:**
- `group.user_membership.add` - User added to group
- `group.user_membership.remove` - User removed from group
- `user.authentication.sso` - SSO authentication (can show group-based access)
- `application.user_membership.add` - App assignment (may use group)
- `policy.evaluate_sign_on` - Sign-on policy evaluation (may reference group)

**Implementation Approach:**
```typescript
// New function in useOktaApi.ts
const analyzeGroupUsageInLogs = useCallback(
  async (groupId: string, daysBack: number = 90): Promise<GroupUsageAnalysis> => {
    // Query System Log API for events referencing this group
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const endpoint = `/api/v1/logs?since=${since.toISOString()}&filter=target.id eq "${groupId}" or group.id eq "${groupId}"&limit=1000`;

    const response = await makeApiRequest(endpoint);

    if (!response.success) {
      return { hasActivity: false, events: [] };
    }

    // Analyze events
    const events = response.data || [];
    const hasRecentActivity = events.length > 0;
    const lastActivityDate = events[0]?.published ? new Date(events[0].published) : null;

    return {
      hasActivity: hasRecentActivity,
      lastActivityDate,
      eventCount: events.length,
      events: events.slice(0, 10), // First 10 events
    };
  },
  [makeApiRequest]
);
```

**Considerations:**
- System Log API has retention limits (varies by Okta plan)
- High API cost for large-scale analysis
- Should be optional/on-demand feature
- Consider caching results

### Phase 4: Okta Workflows Detection (Advanced)

**Effort**: 12-16 hours
**API Impact**: Medium (Workflows API)

#### Detecting Workflow Usage

Okta Workflows can reference groups in:
- Flow conditions (e.g., "If user is in group X")
- Flow actions (e.g., "Add user to group Y")
- Flow triggers (e.g., "When user added to group Z")

**Critical Limitation: No Workflows Management API**

⚠️ **As of 2025**, Okta does **not provide a public REST API** for programmatically managing or querying Workflows. This means:
- ❌ Cannot list all flows/workflows via API
- ❌ Cannot search workflows for group references
- ❌ Cannot access workflow configuration/metadata programmatically
- ❌ Cannot determine which groups are used in which workflows via API

This has been [requested by the community since 2021](https://devforum.okta.com/t/workflows-console-api-access/16743) without resolution.

**Available API Capabilities (Limited):**
- ✅ Can **invoke** individual flows via API endpoint (but not query their config)
- ✅ Can manually **export** workflows to JSON (but requires manual process)

**Challenges:**
1. **No Programmatic Access**: Cannot automatically scan workflows for group usage
2. **Flow Execution Context**: Hard to determine if group is actively used vs just referenced
3. **Workflow Complexity**: Groups can be referenced indirectly through variables
4. **Manual Process Required**: Admin must export workflows manually for analysis

**Realistic Approaches:**

#### 1. **Manual Override (Recommended - Immediate Solution)**

Since there's no API, provide a UI for admins to manually mark groups used in workflows:

```typescript
// Add to GroupSummary type
interface GroupSummary {
  // ... existing fields
  isUsedInWorkflows?: boolean;
  workflowNotes?: string; // Admin can document which workflows
  workflowLastVerified?: Date; // When admin last checked
}

// UI Component
const WorkflowUsageIndicator: React.FC<{ group: GroupSummary }> = ({ group }) => (
  <div className="workflow-usage-section">
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={group.isUsedInWorkflows || false}
        onChange={(e) => updateGroupWorkflowStatus(group.id, e.target.checked)}
      />
      Used in Okta Workflows
    </label>
    {group.isUsedInWorkflows && (
      <div className="workflow-notes">
        <input
          type="text"
          placeholder="Which workflows? (e.g., 'User Onboarding Flow')"
          value={group.workflowNotes || ''}
          onChange={(e) => updateGroupWorkflowNotes(group.id, e.target.value)}
        />
        {group.workflowLastVerified && (
          <small>Last verified: {formatDate(group.workflowLastVerified)}</small>
        )}
      </div>
    )}
  </div>
);
```

**Benefits:**
- ✅ Immediate implementation (no API dependency)
- ✅ Admins have direct knowledge of workflow usage
- ✅ Can document specific workflow names
- ✅ Prevents accidental archival of workflow-managed groups

#### 2. **Export & Scan Workflow JSON (Semi-Automated)**

Admin exports workflows, extension parses JSON for group references:

```typescript
// Feature: Upload exported workflow JSON files
const scanWorkflowExportForGroups = (workflowJSON: any): GroupWorkflowReference[] => {
  const references: GroupWorkflowReference[] = [];

  // Parse flow cards in the exported JSON
  const flows = extractFlowsFromExport(workflowJSON);

  for (const flow of flows) {
    const cards = flow.cards || [];

    for (const card of cards) {
      // Look for Okta connector cards that reference groups
      if (card.connector === 'okta') {
        // Search Groups, List Group Members, Add User to Group, etc.
        if (card.action?.includes('Group') || card.action?.includes('group')) {
          const groupId = extractGroupIdFromCard(card);
          if (groupId) {
            references.push({
              groupId,
              flowId: flow.id,
              flowName: flow.name,
              cardType: card.action,
              lastExported: new Date(),
            });
          }
        }
      }
    }
  }

  return references;
};

// UI: Workflow Import Feature
<div className="workflow-scanner">
  <h3>Scan Workflows for Group Usage</h3>
  <p>Export your workflows as JSON from Okta Workflows Console, then upload here:</p>
  <input
    type="file"
    accept=".json,.flopack"
    multiple
    onChange={(e) => handleWorkflowUpload(e.target.files)}
  />
  <button onClick={scanUploadedWorkflows}>Scan for Group References</button>
</div>
```

**Export Instructions for Admin:**
1. Go to Okta Workflows Console
2. Select folder → Export Folder ([docs](https://help.okta.com/wf/en-us/content/topics/workflows/build/export-import-flows.htm))
3. Upload exported `.flopack` or `.json` file to Okta Unbound
4. Extension scans for group IDs in flow cards
5. Auto-marks groups as "Used in Workflows"

**Benefits:**
- ✅ More automated than pure manual
- ✅ Can find all group references in exported workflows
- ✅ One-time setup per major workflow change
- ⚠️ Requires admin to export and re-upload after workflow changes

#### 3. **System Log Analysis (Workflow Activity Detection)**

**Key Insight:** While you can't query workflow definitions via API, Okta Workflows operations are logged in the System Log API. When a workflow reads from or writes to Okta groups, it generates audit events.

**Detectable Workflow Activities:**
```typescript
const detectWorkflowUsageViaLogs = async (groupId: string, daysBack: number = 90) => {
  // Workflow-initiated events have specific characteristics in System Log
  const workflowFilters = [
    // Group membership changes initiated by workflows
    `target.id eq "${groupId}" and eventType eq "group.user_membership.add"`,
    `target.id eq "${groupId}" and eventType eq "group.user_membership.remove"`,

    // User-group operations with workflow context
    `group.id eq "${groupId}" and actor.type eq "SystemPrincipal"`,

    // System operations (workflows run as system)
    `target.id eq "${groupId}" and eventType eq "system.operation"`,
  ];

  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  let hasWorkflowActivity = false;
  const workflowEvents: any[] = [];

  for (const filter of workflowFilters) {
    const endpoint = `/api/v1/logs?since=${since.toISOString()}&filter=${filter}&limit=100`;
    const response = await makeApiRequest(endpoint);

    if (response.success && response.data) {
      const events = response.data.filter((event: any) => {
        // Workflow events often have specific actor types or debug context
        return (
          event.actor?.type === 'SystemPrincipal' ||
          event.actor?.displayName?.includes('Workflow') ||
          event.debugContext?.debugData?.fluentdTag?.includes('workflows') ||
          event.client?.userAgent?.includes('OktaWorkflows')
        );
      });

      if (events.length > 0) {
        hasWorkflowActivity = true;
        workflowEvents.push(...events);
      }
    }
  }

  return {
    hasWorkflowActivity,
    eventCount: workflowEvents.length,
    lastWorkflowActivity: workflowEvents[0]?.published
      ? new Date(workflowEvents[0].published)
      : null,
    recentEvents: workflowEvents.slice(0, 5), // Most recent 5
  };
};
```

**Workflow Event Signatures:**
- **Actor Type**: `SystemPrincipal` (workflows run as system)
- **Client**: May include `OktaWorkflows` in user agent
- **Debug Context**: May have workflow-related tags in `debugContext.debugData.fluentdTag`
- **Display Name**: Actor display name may include "Workflow"

**Benefits:**
- ✅ Detects **actual workflow usage**, not just configuration
- ✅ Shows when group was last modified by a workflow
- ✅ Works without workflow export/import
- ✅ Can run automatically in background

**Limitations:**
- ⚠️ Only detects workflows that **modify** groups (add/remove members)
- ⚠️ May miss workflows that only **read** group membership
- ⚠️ Limited by System Log retention (90 days standard, varies by plan)
- ⚠️ May have false negatives if workflow hasn't run recently

**UI Indicator:**
```tsx
{group.lastWorkflowActivity && (
  <span
    className="badge badge-info"
    title={`Last workflow activity: ${formatRelativeTime(group.lastWorkflowActivity)}`}
  >
    ⚡ WORKFLOW ACTIVE
  </span>
)}
```

**Implementation Reality:**
Given API limitations, **Option 1 (Manual Override)** is the most practical immediate solution, with **Option 2 (Export & Scan)** as an advanced feature for larger organizations that can maintain workflow exports.

#### Workflow Usage Indicator (Updated)
```tsx
{group.isUsedInWorkflows && (
  <span
    className="badge badge-info"
    title={group.workflowNotes || 'Used in Okta Workflows'}
  >
    ⚡ WORKFLOW
  </span>
)}
```

**Workflow Status Persistence:**
Store workflow usage flags in Chrome extension storage:
```typescript
interface WorkflowUsageData {
  [groupId: string]: {
    isUsedInWorkflows: boolean;
    workflowNotes?: string;
    lastVerified: string; // ISO timestamp
    verifiedBy?: string; // Admin email who marked it
  };
}
```

## UI/UX Design

### Filter Options
```
[ All Groups ▼ ]  [ Sort: Staleness ▼ ]  [ 🔍 Search ]

Filters:
☐ Show stale only (6+ months inactive)
☐ Empty groups
☐ High inactive member ratio (>50%)
☐ No active rules
☐ Not used in workflows
```

### Group List Display
```
┌─────────────────────────────────────────────────────┐
│ ☐ Engineering Team                                  │
│    OKTA  🕰️ STALE                                   │
│    45 members • Last activity: 8 months ago         │
│    ⚠️ 32 members inactive                           │
│    💡 Consider archiving or cleanup                 │
└─────────────────────────────────────────────────────┘
```

### Stale Groups Dashboard Widget

Add to Dashboard tab:
```tsx
<div className="dashboard-card">
  <h3>Stale Groups</h3>
  <div className="stat-row">
    <span className="stat-value">{staleGroupCount}</span>
    <span className="stat-label">groups inactive 6+ months</span>
  </div>
  <button onClick={() => navigateToGroups({ filter: 'stale' })}>
    View Stale Groups →
  </button>
</div>
```

## API Considerations

### Required Okta API Endpoints

1. **Groups API** (already in use)
   - `GET /api/v1/groups?expand=stats`
   - Returns: `created`, `lastUpdated`, `lastMembershipUpdated`, `_embedded.stats.usersCount`

2. **System Log API** (Phase 3)
   - `GET /api/v1/logs?filter=...&since=...`
   - Rate limit: Varies by plan (typically 60 requests/min)
   - Data retention: 90 days (Standard), longer for higher plans

3. **Workflows Detection** (Phase 4) - Multiple Approaches
   - **No public REST API** for querying workflow configuration ([community request](https://devforum.okta.com/t/workflows-console-api-access/16743))
   - **Solution 1**: Manual UI checkbox for admins to mark workflow-used groups
   - **Solution 2**: Upload/scan exported workflow JSON files
   - **Solution 3**: Detect workflow activity via System Log (actor=SystemPrincipal)
   - See "Phase 4: Okta Workflows Detection" section above for full implementation details

### Rate Limiting Strategy

- **Phase 1**: Minimal impact (data from existing calls)
- **Phase 2**: Batch member analysis, respect rate limits
- **Phase 3**: Optional on-demand analysis with caching
- **Phase 4**: Cache workflow detection results (rarely changes)

## Benefits

### Security
- Identify unused groups that may have excessive permissions
- Reduce attack surface by archiving stale groups
- Better compliance with least-privilege principle

### Operations
- Reduce administrative overhead
- Cleaner group list improves admin efficiency
- Easier to find and manage active groups

### Compliance
- Demonstrate regular access reviews
- Document group lifecycle management
- Easier audit trail for unused access

## Limitations & Considerations

### Technical Limitations
1. **System Log Retention**: Historical data limited by Okta plan
2. **API Rate Limits**: Bulk analysis may be slow for large orgs
3. **Workflow API Access**: May not be available on all plans
4. **False Positives**: Some groups may be intentionally static

### Organizational Considerations
1. **Valid Stale Groups**: Some groups are meant to be infrequently used (e.g., disaster recovery, emergency access)
2. **Seasonal Usage**: Groups may appear stale but are used periodically (e.g., seasonal contractors)
3. **Manual Groups**: Groups without rules may be intentionally managed manually

### Recommended Approach
- Provide configurable thresholds
- Allow manual override (mark as "not stale")
- Show staleness as a score/indicator, not binary decision
- Require admin confirmation before any archive/delete actions

## Future Enhancements

1. **Machine Learning**: Predict group usage patterns based on historical data
2. **Automatic Archival**: Schedule automatic moves to "Archived Groups" folder
3. **Cleanup Workflows**: Integrate with Okta Workflows to automate cleanup
4. **Smart Recommendations**: Suggest merging similar groups
5. **Group Lifecycle Management**: Track group purpose and expected lifespan

## Implementation Priority

**Recommended Order:**
1. **Phase 1** (Basic Detection) - High value, low effort
2. **Phase 2** (Member Analysis) - Medium value, medium effort
3. **Phase 3** (System Logs) - Medium value, high effort
4. **Phase 4** (Workflows) - Low value initially, may increase with API improvements

## Workflow Detection Summary

### Three Complementary Approaches

Given the lack of Okta Workflows API, use a multi-pronged strategy:

| Approach | Effort | Accuracy | Automation | Best For |
|----------|--------|----------|------------|----------|
| **Manual Override** | Low (2-3 hours) | ⭐⭐⭐⭐⭐ (Admin knows) | ❌ Manual | Small orgs, quick start |
| **Export & Scan** | Medium (8-10 hours) | ⭐⭐⭐⭐ (Finds references) | ⚠️ Semi-automated | Large orgs, periodic scans |
| **System Log Analysis** | Medium (6-8 hours) | ⭐⭐⭐ (Activity-based) | ✅ Automated | Detect active workflows |

### Recommended Implementation Order

1. **Start with Manual Override** (Phase 4a)
   - Quick to implement
   - Works immediately
   - Admin has context
   - Stores in extension storage

2. **Add System Log Detection** (Phase 4b)
   - Runs automatically on group load
   - Shows workflow activity in last 90 days
   - Complements manual markings
   - Catches workflow-managed groups

3. **Optional: Export Scanner** (Phase 4c)
   - For large orgs with many workflows
   - One-time or periodic scan
   - Most comprehensive coverage
   - Higher maintenance

### Combined Strategy Example

```typescript
interface GroupWorkflowStatus {
  // Manual marking
  manuallyMarked: boolean;
  workflowNotes?: string;
  markedBy?: string;
  markedAt?: Date;

  // System log detection
  hasRecentActivity: boolean;
  lastActivity?: Date;
  activityCount: number;

  // Export scan results
  referencedInFlows?: string[]; // Flow names
  lastScanned?: Date;

  // Final determination
  isUsedInWorkflows: boolean; // True if ANY indicator is true
}
```

Display priority:
1. If manually marked → Show "⚡ WORKFLOW" badge with notes
2. If recent activity detected → Show "⚡ WORKFLOW ACTIVE" with last activity date
3. If found in export scan → Show "⚡ WORKFLOW" with flow names

## References

- [Okta Groups API Documentation](https://developer.okta.com/docs/reference/api/groups/)
- [Okta System Log API](https://developer.okta.com/docs/reference/api/system-log/)
- [Okta Workflows Documentation](https://help.okta.com/wf/en-us/Content/Topics/Workflows/workflows-main.htm)
- [Okta Workflows Export/Import](https://help.okta.com/wf/en-us/content/topics/workflows/build/export-import-flows.htm)
- [Workflows Console API Access Request](https://devforum.okta.com/t/workflows-console-api-access/16743) (Community Forum)
- [Search Groups in Workflows](https://help.okta.com/wf/en-us/content/topics/workflows/connector-reference/okta/actions/searchgroups.htm)

## Related Issues

- Consider integration with existing Health Score metrics
- May want to add export functionality for stale groups report
- Could tie into audit trail for compliance reporting
- Workflow status should be exportable in group reports

---

**Status**: 📋 Planned
**Priority**: Medium
**Estimated Total Effort**: 45-65 hours (all phases including workflow detection)
**Phase 1 Effort**: 4-6 hours (Quick Win - Basic staleness)
**Phase 4a Effort**: 2-3 hours (Manual workflow marking)
**Phase 4b Effort**: 6-8 hours (System log workflow detection)
**Phase 4c Effort**: 8-10 hours (Export scanner - optional)
