# Group Membership Classification Debugging Guide

## Problem
The bar chart showing "Manual vs Rule-Based" membership is not displaying accurate counts because we cannot reliably determine which users were added via group rules vs manually.

## Root Cause
The `managedBy.rules` field from Okta's internal `/admin/users/search` API endpoint is not returning the expected data format or may be returning empty/null values even for rule-based members.

## Diagnosis Steps

### Step 1: Check Browser Console Logs

After loading a group in the Overview tab, check the browser console for these logs:

```
[useGroupHealth] Sample member from aaData: {...}
[useGroupHealth] User 0-9 : { managedBy: ..., classification: ... }
[useGroupHealth] Final membership counts: { sanityCheck: ... }
```

### Step 2: Inspect the Data Structure

Look for these patterns in the logs:

**Pattern A: Empty `managedBy.rules`**
```javascript
managedBy.rules raw value: ""
managedBy.rules type: "string"
// This user would be classified as MANUAL
```

**Pattern B: Rule ID in `managedBy.rules`**
```javascript
managedBy.rules raw value: "00g1abc2def3ghi4jkl"
managedBy.rules type: "string"
// This user would be classified as RULE-BASED
```

**Pattern C: Array of Rule IDs**
```javascript
managedBy.rules raw value: ["00g1abc2def3ghi4jkl", "00g5mno6pqr7stu8vwx"]
managedBy.rules type: "object"
managedBy.rules is array?: true
// This user would be classified as RULE-BASED
```

**Pattern D: Null/Undefined**
```javascript
managedBy.rules raw value: null
managedBy.rules type: "object"
// This user would be classified as MANUAL
```

### Step 3: Verify Classification Logic

The current logic (after the fix) should:

1. Check if `managedBy.rules` exists
2. Normalize it to an array of strings
3. If the array has items → RULE-BASED
4. If the array is empty or undefined → MANUAL

### Step 4: Cross-Check with Okta UI

To verify the counts are correct:

1. Go to your group in Okta Admin Console
2. Click on the "Members" tab
3. Look at the "Managed By" column
   - If it says "Manually" → should count as MANUAL
   - If it says "By rule [Rule Name]" → should count as RULE-BASED

## Known Limitations

### The `managedBy.rules` Field May Be Unreliable

According to Okta's behavior:

- The internal API endpoint `/admin/users/search` includes a `managedBy.rules` column
- **However**, this field's format and reliability is not documented
- It may return:
  - Empty string for ALL users (even rule-based ones)
  - Only populated for users managed by MULTIPLE rules
  - Different formats depending on Okta org configuration

### Alternative Approach: Cross-Reference with Group Rules

If the `managedBy.rules` field is not working, we need to use a different approach:

1. **Fetch all active group rules** targeting this group
2. **For each rule**, extract the condition expression
3. **For each user**, evaluate if they match any rule condition
4. **Classify** users based on whether they match any active rule

This is more complex and slower but would be more reliable.

## Proposed Alternative Implementation

If the current approach isn't working, we can implement this:

### Algorithm

```typescript
async function classifyMembershipSources(
  members: OktaUser[],
  groupId: string,
  rules: GroupRule[]
): Promise<{ direct: number; ruleBased: number }> {
  const activeRulesForGroup = rules.filter(
    rule => rule.status === 'ACTIVE' &&
    rule.actions.assignUserToGroups.groupIds.includes(groupId)
  );

  if (activeRulesForGroup.length === 0) {
    // No active rules, all members must be manual
    return { direct: members.length, ruleBased: 0 };
  }

  let ruleBased = 0;
  let direct = 0;

  for (const user of members) {
    // Check if user matches ANY active rule condition
    const matchesAnyRule = activeRulesForGroup.some(rule =>
      evaluateRuleExpression(rule.conditions.expression.value, user)
    );

    if (matchesAnyRule) {
      ruleBased++;
    } else {
      direct++;
    }
  }

  return { direct, ruleBased };
}
```

### Pros
- More reliable - doesn't depend on undocumented `managedBy.rules` field
- Works even if Okta's internal API changes

### Cons
- Requires parsing and evaluating Okta Expression Language (complex)
- Slower - requires fetching group rules separately
- May have false positives if a user was manually added but also matches a rule

## Recommended Next Steps

1. **Run the extension** with the current fix and check console logs
2. **Share the console output** showing what values `managedBy.rules` contains
3. **Compare** with Okta UI to see if classifications are correct
4. If the field is empty/unreliable, we'll implement the alternative approach

## Quick Test Script

Run this in the browser console while on a group page to see raw data:

```javascript
// This will show you the raw response from Okta's internal API
fetch('/admin/users/search?iDisplayLength=10&iColumns=6&sColumns=user.id%2Cstatus.statusLabel%2Cuser.fullName%2Cuser.login%2CmanagedBy.rules&enableSQLQueryGenerator=true&enableESUserLookup=true&skipCountTotal=true&groupId=YOUR_GROUP_ID&sortDirection=desc&iDisplayStart=0&sSearch=', {
  credentials: 'include',
  headers: { 'X-Requested-With': 'XMLHttpRequest' }
})
.then(r => r.json())
.then(data => {
  console.log('First 10 members:', data.aaData);
  console.log('managedBy.rules values:', data.aaData.map(m => m[4]));
});
```

Replace `YOUR_GROUP_ID` with the actual group ID from the URL.
