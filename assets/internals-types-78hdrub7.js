import{j as n}from"./iframe-tAvKsVeF.js";import{u as r,M as a,c as o}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const d=`# Types



---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / ApiResponse

# Interface: ApiResponse\\<T\\>

Defined in: [src/shared/types.ts:226](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L226)

Generic outcome of an Okta API call made in the content script.

## Extended by

- \`MessageResponse\`

## Type Parameters

### T

\`T\` = \`any\`

## Properties

### success

> **success**: \`boolean\`

Defined in: [src/shared/types.ts:227](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L227)

***

### data?

> \`optional\` **data?**: \`T\`

Defined in: [src/shared/types.ts:228](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L228)

***

### error?

> \`optional\` **error?**: \`string\`

Defined in: [src/shared/types.ts:229](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L229)

***

### status?

> \`optional\` **status?**: \`number\`

Defined in: [src/shared/types.ts:230](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L230)

***

### headers?

> \`optional\` **headers?**: \`Record\`\\<\`string\`, \`string\`\\>

Defined in: [src/shared/types.ts:231](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L231)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / AppInfo

# Interface: AppInfo

Defined in: [src/shared/types.ts:249](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L249)

Minimal app identity extracted from the current Okta page.

## Properties

### appId

> **appId**: \`string\`

Defined in: [src/shared/types.ts:250](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L250)

***

### appName

> **appName**: \`string\`

Defined in: [src/shared/types.ts:251](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L251)

***

### appLabel?

> \`optional\` **appLabel?**: \`string\`

Defined in: [src/shared/types.ts:252](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L252)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / AuditFilters

# Interface: AuditFilters

Defined in: [src/shared/types.ts:558](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L558)

Optional filters for querying the audit trail.

## Properties

### groupId?

> \`optional\` **groupId?**: \`string\`

Defined in: [src/shared/types.ts:559](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L559)

***

### action?

> \`optional\` **action?**: \`"remove_users"\` \\| \`"add_users"\` \\| \`"export"\` \\| \`"activate_rule"\` \\| \`"deactivate_rule"\`

Defined in: [src/shared/types.ts:560](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L560)

***

### startDate?

> \`optional\` **startDate?**: \`Date\`

Defined in: [src/shared/types.ts:561](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L561)

***

### endDate?

> \`optional\` **endDate?**: \`Date\`

Defined in: [src/shared/types.ts:562](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L562)

***

### result?

> \`optional\` **result?**: \`"success"\` \\| \`"failed"\` \\| \`"partial"\`

Defined in: [src/shared/types.ts:563](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L563)

***

### performedBy?

> \`optional\` **performedBy?**: \`string\`

Defined in: [src/shared/types.ts:564](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L564)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / AuditLogEntry

# Interface: AuditLogEntry

Defined in: [src/shared/types.ts:508](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L508)

The audit-trail record a writer hands to \`auditStore.logOperation\` — the write
shape, every field required. Read paths return PersistedAuditLogEntry,
whose attribution fields are optional.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:509](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L509)

***

### timestamp

> **timestamp**: \`Date\`

Defined in: [src/shared/types.ts:510](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L510)

***

### action

> **action**: \`"remove_users"\` \\| \`"add_users"\` \\| \`"export"\` \\| \`"activate_rule"\` \\| \`"deactivate_rule"\`

Defined in: [src/shared/types.ts:511](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L511)

***

### groupId

> **groupId**: \`string\`

Defined in: [src/shared/types.ts:512](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L512)

***

### groupName

> **groupName**: \`string\`

Defined in: [src/shared/types.ts:513](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L513)

***

### performedBy

> **performedBy**: \`string\` \\| \`null\`

Defined in: [src/shared/types.ts:518](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L518)

Email of the admin who performed the operation, or \`null\` when the actor
could not be resolved. Never a placeholder — see ActorResolution.

***

### actorResolution

> **actorResolution**: \`ActorResolution\`

Defined in: [src/shared/types.ts:525](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L525)

How performedBy was arrived at. Required on the write side, so a new
entry can never be silent about attribution. On the read side it is optional:
older rows have no value and \`getHistory\` returns them as stored rather than
back-filling a claim nobody made, so a reader handles three cases, not two.

***

### affectedUsers

> **affectedUsers**: \`string\`[]

Defined in: [src/shared/types.ts:526](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L526)

***

### result

> **result**: \`"success"\` \\| \`"failed"\` \\| \`"partial"\`

Defined in: [src/shared/types.ts:527](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L527)

***

### details

> **details**: \`object\`

Defined in: [src/shared/types.ts:528](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L528)

#### usersSucceeded

> **usersSucceeded**: \`number\`

#### usersFailed

> **usersFailed**: \`number\`

#### apiRequestCount

> **apiRequestCount**: \`number\`

#### durationMs

> **durationMs**: \`number\`

#### errorMessages?

> \`optional\` **errorMessages?**: \`string\`[]


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / AuditSettings

# Interface: AuditSettings

Defined in: [src/shared/types.ts:578](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L578)

User-configurable audit logging settings.

## Properties

### enabled

> **enabled**: \`boolean\`

Defined in: [src/shared/types.ts:579](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L579)

***

### retentionDays

> **retentionDays**: \`number\`

Defined in: [src/shared/types.ts:580](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L580)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / AuditStats

# Interface: AuditStats

Defined in: [src/shared/types.ts:568](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L568)

Aggregate statistics computed over the audit trail.

## Properties

### totalOperations

> **totalOperations**: \`number\`

Defined in: [src/shared/types.ts:569](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L569)

***

### operationsByType

> **operationsByType**: \`Record\`\\<\`string\`, \`number\`\\>

Defined in: [src/shared/types.ts:570](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L570)

***

### successRate

> **successRate**: \`number\`

Defined in: [src/shared/types.ts:571](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L571)

***

### totalUsersAffected

> **totalUsersAffected**: \`number\`

Defined in: [src/shared/types.ts:572](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L572)

***

### totalApiRequests

> **totalApiRequests**: \`number\`

Defined in: [src/shared/types.ts:573](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L573)

***

### lastWeekOperations

> **lastWeekOperations**: \`number\`

Defined in: [src/shared/types.ts:574](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L574)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / BulkOperation

# Interface: BulkOperation

Defined in: [src/shared/types.ts:651](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L651)

A queued/running multi-group bulk operation and its per-group results.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:652](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L652)

***

### type

> **type**: \`"remove_user"\` \\| \`"add_user"\` \\| \`"cleanup_inactive"\` \\| \`"export_all"\`

Defined in: [src/shared/types.ts:653](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L653)

***

### targetGroups

> **targetGroups**: \`string\`[]

Defined in: [src/shared/types.ts:654](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L654)

***

### status

> **status**: \`"failed"\` \\| \`"running"\` \\| \`"pending"\` \\| \`"completed"\`

Defined in: [src/shared/types.ts:655](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L655)

***

### progress

> **progress**: \`number\`

Defined in: [src/shared/types.ts:656](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L656)

***

### results

> **results**: \`BulkOperationResult\`[]

Defined in: [src/shared/types.ts:657](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L657)

***

### config?

> \`optional\` **config?**: \`object\`

Defined in: [src/shared/types.ts:658](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L658)

#### userId?

> \`optional\` **userId?**: \`string\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / BulkOperationResult

# Interface: BulkOperationResult

Defined in: [src/shared/types.ts:662](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L662)

Outcome of a bulk operation against a single group.

## Properties

### groupId

> **groupId**: \`string\`

Defined in: [src/shared/types.ts:663](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L663)

***

### groupName

> **groupName**: \`string\`

Defined in: [src/shared/types.ts:664](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L664)

***

### status

> **status**: \`"success"\` \\| \`"failed"\`

Defined in: [src/shared/types.ts:665](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L665)

***

### itemsProcessed

> **itemsProcessed**: \`number\`

Defined in: [src/shared/types.ts:666](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L666)

***

### errors?

> \`optional\` **errors?**: \`string\`[]

Defined in: [src/shared/types.ts:667](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L667)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / FormattedRule

# Interface: FormattedRule

Defined in: [src/shared/types.ts:183](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L183)

A rule shaped for UI display (simplified condition, extracted attrs, conflicts).

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:184](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L184)

***

### name

> **name**: \`string\`

Defined in: [src/shared/types.ts:185](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L185)

***

### status

> **status**: \`GroupRuleStatus\`

Defined in: [src/shared/types.ts:186](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L186)

***

### condition

> **condition**: \`string\`

Defined in: [src/shared/types.ts:187](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L187)

***

### conditionExpression?

> \`optional\` **conditionExpression?**: \`string\`

Defined in: [src/shared/types.ts:188](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L188)

***

### groupIds

> **groupIds**: \`string\`[]

Defined in: [src/shared/types.ts:189](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L189)

***

### groupNames?

> \`optional\` **groupNames?**: \`string\`[]

Defined in: [src/shared/types.ts:190](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L190)

***

### allGroupNamesMap?

> \`optional\` **allGroupNamesMap?**: \`Record\`\\<\`string\`, \`string\`\\>

Defined in: [src/shared/types.ts:191](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L191)

***

### userAttributes

> **userAttributes**: \`string\`[]

Defined in: [src/shared/types.ts:192](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L192)

***

### excludedUserIds?

> \`optional\` **excludedUserIds?**: \`string\`[]

Defined in: [src/shared/types.ts:199](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L199)

User ids the rule explicitly excludes (\`conditions.people.users.exclude\` on
the raw rule). Carried through the formatter because the membership
classifier only ever sees this shape, and without it a rule gets credited for
a user it excludes.

***

### excludedGroupIds?

> \`optional\` **excludedGroupIds?**: \`string\`[]

Defined in: [src/shared/types.ts:206](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L206)

Group ids the rule excludes (\`conditions.people.groups.exclude\`) — the twin
of FormattedRule.excludedUserIds, carried for the same reason.
Answering with it needs the user's complete group list; see
\`membershipAnalysis\`'s exclusion helpers.

***

### missingGroupIds?

> \`optional\` **missingGroupIds?**: \`string\`[]

Defined in: [src/shared/types.ts:215](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L215)

Target group ids with no group behind them — a rule assigning users into a
group the org no longer has.

\`undefined\` is *not asked*; \`[]\` is *asked and clean*. The two must not be
collapsed, and only a producer that verified the group inventory is complete
may set it (\`groups/ruleOrphans.findRulesWithMissingTargets\`).

***

### created

> **created**: \`string\`

Defined in: [src/shared/types.ts:216](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L216)

***

### lastUpdated

> **lastUpdated**: \`string\`

Defined in: [src/shared/types.ts:217](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L217)

***

### affectsCurrentGroup?

> \`optional\` **affectsCurrentGroup?**: \`boolean\`

Defined in: [src/shared/types.ts:218](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L218)

***

### conflicts?

> \`optional\` **conflicts?**: \`RuleConflict\`[]

Defined in: [src/shared/types.ts:219](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L219)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / GroupComparisonResult

# Interface: GroupComparisonResult

Defined in: [src/shared/types.ts:604](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L604)

Result of comparing membership across multiple groups.

## Properties

### groups

> **groups**: \`object\`[]

Defined in: [src/shared/types.ts:605](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L605)

#### id

> **id**: \`string\`

#### name

> **name**: \`string\`

#### memberCount

> **memberCount**: \`number\`

***

### intersection

> **intersection**: \`string\`[]

Defined in: [src/shared/types.ts:606](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L606)

***

### uniqueMembers

> **uniqueMembers**: \`Record\`\\<\`string\`, \`string\`[]\\>

Defined in: [src/shared/types.ts:607](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L607)

***

### totalUniqueUsers

> **totalUniqueUsers**: \`number\`

Defined in: [src/shared/types.ts:608](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L608)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / GroupInfo

# Interface: GroupInfo

Defined in: [src/shared/types.ts:235](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L235)

Minimal group identity extracted from the current Okta page.

## Properties

### groupId

> **groupId**: \`string\`

Defined in: [src/shared/types.ts:236](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L236)

***

### groupName

> **groupName**: \`string\`

Defined in: [src/shared/types.ts:237](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L237)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / GroupMembership

# Interface: GroupMembership

Defined in: [src/shared/types.ts:369](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L369)

A single group membership, annotated with how it was granted.

## Properties

### group

> **group**: \`OktaGroup\`

Defined in: [src/shared/types.ts:370](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L370)

***

### membershipType

> **membershipType**: \`"UNKNOWN"\` \\| \`"DIRECT"\` \\| \`"RULE_BASED"\`

Defined in: [src/shared/types.ts:371](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L371)

***

### rules

> **rules**: \`MembershipRule\`[]

Defined in: [src/shared/types.ts:378](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L378)

The rules this membership is attributed to — plural, because several rules
can match the same user and an unevidenced guess has a candidate set. How to
read the list is determined entirely by \`attribution\`. Empty whenever no rule
is attributable (a manual add, or an app-fed \`APP_GROUP\`).

***

### attribution

> **attribution**: \`MembershipAttribution\`

Defined in: [src/shared/types.ts:384](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L384)

What kind of evidence produced \`membershipType\`/\`rules\`. Required: a producer
that cannot classify says \`'ambiguous'\` rather than omitting the field and
letting consumers default it to confidence.

***

### provenance?

> \`optional\` **provenance?**: \`MembershipProvenance\`

Defined in: [src/shared/types.ts:392](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L392)

Okta's own answer about this membership, when someone explicitly asked for
it. Absent by default, and absent is not "no rule": it means nobody asked, or
Okta did not answer. Purely additive — it never rewrites \`membershipType\`,
\`rules\` or \`attribution\`, which keep describing what the classifier
concluded. See \`shared/membership/sourceLine\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / GroupSummary

# Interface: GroupSummary

Defined in: [src/shared/types.ts:612](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L612)

Enriched group row for the group-browse UI (counts, rules, source app).

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:613](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L613)

***

### name

> **name**: \`string\`

Defined in: [src/shared/types.ts:614](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L614)

***

### description?

> \`optional\` **description?**: \`string\`

Defined in: [src/shared/types.ts:615](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L615)

***

### type

> **type**: \`GroupType\`

Defined in: [src/shared/types.ts:616](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L616)

***

### memberCount

> **memberCount**: \`number\`

Defined in: [src/shared/types.ts:617](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L617)

***

### lastUpdated?

> \`optional\` **lastUpdated?**: \`Date\`

Defined in: [src/shared/types.ts:618](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L618)

***

### lastMembershipUpdated?

> \`optional\` **lastMembershipUpdated?**: \`Date\`

Defined in: [src/shared/types.ts:632](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L632)

When this group's *membership* last changed, per Okta's
\`lastMembershipUpdated\`.

Distinct from GroupSummary.lastUpdated, which moves only when the
group's profile is edited. It is the only signal that sees maintainers
nothing else does — Workflows, SCIM, HR provisioning, direct API writes and
IdP sync all bump it and leave no group rule behind.

It carries no actor, no direction and no magnitude; attribution needs the
System Log. Optional because a never-modified group may omit it, and because
a snapshot synced before the field was parsed has no value for it.

***

### hasRules

> **hasRules**: \`boolean\`

Defined in: [src/shared/types.ts:634](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L634)

Whether at least one rule assigns users to this group (a feeding/target rule).

***

### ruleCount

> **ruleCount**: \`number\`

Defined in: [src/shared/types.ts:636](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L636)

Number of rules that assign users to this group (its feeding/target set).

***

### usedInRuleCount?

> \`optional\` **usedInRuleCount?**: \`number\`

Defined in: [src/shared/types.ts:642](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L642)

Number of rules that reference this group in their condition expression
(e.g. \`isMemberOfAnyGroup("<id>")\`) — the group is used to *decide* the rule,
not assigned by it. Undefined until the rules payload is known.

***

### selected?

> \`optional\` **selected?**: \`boolean\`

Defined in: [src/shared/types.ts:643](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L643)

***

### sourceAppId?

> \`optional\` **sourceAppId?**: \`string\`

Defined in: [src/shared/types.ts:644](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L644)

***

### sourceAppName?

> \`optional\` **sourceAppName?**: \`string\`

Defined in: [src/shared/types.ts:645](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L645)

***

### created?

> \`optional\` **created?**: \`Date\`

Defined in: [src/shared/types.ts:646](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L646)

***

### pushMappings?

> \`optional\` **pushMappings?**: \`PushGroupMapping\`[]

Defined in: [src/shared/types.ts:647](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L647)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / GroupsCache

# Interface: GroupsCache

Defined in: [src/shared/types.ts:677](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L677)

Cached group-browse list with its capture timestamp.

## Properties

### groups

> **groups**: \`GroupSummary\`[]

Defined in: [src/shared/types.ts:678](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L678)

***

### timestamp

> **timestamp**: \`number\`

Defined in: [src/shared/types.ts:679](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L679)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / MemberMfaResult

# Interface: MemberMfaResult

Defined in: [src/shared/types.ts:102](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L102)

Per-member summary of enrolled MFA factors. Purely factual — no risk scoring.

## Properties

### userId

> **userId**: \`string\`

Defined in: [src/shared/types.ts:103](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L103)

***

### factors

> **factors**: \`OktaFactor\`[]

Defined in: [src/shared/types.ts:104](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L104)

***

### enrolled

> **enrolled**: \`boolean\`

Defined in: [src/shared/types.ts:105](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L105)

***

### factorCount

> **factorCount**: \`number\`

Defined in: [src/shared/types.ts:106](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L106)

***

### factorLabels

> **factorLabels**: \`string\`[]

Defined in: [src/shared/types.ts:107](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L107)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / MembershipProvenance

# Interface: MembershipProvenance

Defined in: [src/shared/types.ts:354](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L354)

Who produced a membership's answer, carried beside the attribution rather than
folded into it: attribution says how strong the evidence is, provenance says
who produced it. Additive on GroupMembership, so every exhaustive table
keyed by MembershipAttribution is untouched.

## Properties

### source

> **source**: \`"okta"\`

Defined in: [src/shared/types.ts:359](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L359)

Who asserted it. Only \`okta\` exists today — a client-evaluated answer is
described by \`attribution\` alone and never fabricates a provenance.

***

### rules

> **rules**: \`OktaAttributedRule\`[]

Defined in: [src/shared/types.ts:365](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L365)

The rules Okta names as managing this membership. Empty is an answer — Okta
asserting no rule feeds it, i.e. an authoritative manual add. "Okta said
nothing" is the absence of the whole provenance object, never an empty array.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / MembershipRule

# Interface: MembershipRule

Defined in: [src/shared/types.ts:285](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L285)

A group rule as consumed by membership analysis and display. Either a raw
Okta rule (conditions/actions) or a formatted rule (groupIds/
conditionExpression/userAttributes) may be supplied, so the shape-specific
fields are optional.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:286](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L286)

***

### name

> **name**: \`string\`

Defined in: [src/shared/types.ts:287](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L287)

***

### status

> **status**: \`GroupRuleStatus\`

Defined in: [src/shared/types.ts:293](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L293)

The full GroupRuleStatus, so an \`INVALID\` rule reaches the membership
analysis rather than being rejected at the type boundary. Consumers decide
membership on \`status === 'ACTIVE'\`, so \`INVALID\` places nobody.

***

### conditions?

> \`optional\` **conditions?**: \`RuleConditions\`

Defined in: [src/shared/types.ts:294](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L294)

***

### actions?

> \`optional\` **actions?**: \`RuleActions\`

Defined in: [src/shared/types.ts:295](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L295)

***

### groupIds?

> \`optional\` **groupIds?**: \`string\`[]

Defined in: [src/shared/types.ts:296](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L296)

***

### conditionExpression?

> \`optional\` **conditionExpression?**: \`string\`

Defined in: [src/shared/types.ts:297](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L297)

***

### userAttributes?

> \`optional\` **userAttributes?**: \`string\`[]

Defined in: [src/shared/types.ts:298](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L298)

***

### excludedUserIds?

> \`optional\` **excludedUserIds?**: \`string\`[]

Defined in: [src/shared/types.ts:304](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L304)

The formatted shape's carrier for \`conditions.people.users.exclude\` — see
FormattedRule.excludedUserIds. A rule that arrived raw carries its
exclusions under \`conditions\` instead; consumers read whichever is present.

***

### excludedGroupIds?

> \`optional\` **excludedGroupIds?**: \`string\`[]

Defined in: [src/shared/types.ts:310](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L310)

The formatted shape's carrier for \`conditions.people.groups.exclude\` — see
FormattedRule.excludedGroupIds. Same raw/formatted split as
MembershipRule.excludedUserIds.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / MessageRequest

# Interface: MessageRequest

Defined in: [src/shared/types.ts:400](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L400)

Request envelope sent to the content script (and, for a subset, the
background scheduler). \`action\` selects the handler; the remaining fields are
per-action optional arguments.

## Properties

### action

> **action**: \`"makeApiRequest"\` \\| \`"getGroupInfo"\` \\| \`"getUserInfo"\` \\| \`"getAppInfo"\` \\| \`"getPolicyInfo"\` \\| \`"getOktaOrigin"\`

Defined in: [src/shared/types.ts:401](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L401)

***

### endpoint?

> \`optional\` **endpoint?**: \`string\`

Defined in: [src/shared/types.ts:408](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L408)

***

### method?

> \`optional\` **method?**: \`string\`

Defined in: [src/shared/types.ts:409](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L409)

***

### body?

> \`optional\` **body?**: \`unknown\`

Defined in: [src/shared/types.ts:410](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L410)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / MessageResponse

# Interface: MessageResponse\\<T\\>

Defined in: [src/shared/types.ts:417](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L417)

Response envelope extending ApiResponse with rule/list extras.

## Extends

- \`ApiResponse\`\\<\`T\`\\>

## Type Parameters

### T

\`T\` = \`any\`

## Properties

### success

> **success**: \`boolean\`

Defined in: [src/shared/types.ts:227](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L227)

#### Inherited from

\`ApiResponse\`.\`success\`

***

### data?

> \`optional\` **data?**: \`T\`

Defined in: [src/shared/types.ts:228](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L228)

#### Inherited from

\`ApiResponse\`.\`data\`

***

### error?

> \`optional\` **error?**: \`string\`

Defined in: [src/shared/types.ts:229](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L229)

#### Inherited from

\`ApiResponse\`.\`error\`

***

### status?

> \`optional\` **status?**: \`number\`

Defined in: [src/shared/types.ts:230](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L230)

#### Inherited from

\`ApiResponse\`.\`status\`

***

### headers?

> \`optional\` **headers?**: \`Record\`\\<\`string\`, \`string\`\\>

Defined in: [src/shared/types.ts:231](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L231)

#### Inherited from

\`ApiResponse\`.\`headers\`

***

### count?

> \`optional\` **count?**: \`number\`

Defined in: [src/shared/types.ts:418](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L418)

***

### rules?

> \`optional\` **rules?**: \`OktaGroupRule\`[]

Defined in: [src/shared/types.ts:419](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L419)

***

### formattedRules?

> \`optional\` **formattedRules?**: \`FormattedRule\`[]

Defined in: [src/shared/types.ts:420](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L420)

***

### stats?

> \`optional\` **stats?**: \`RuleStats\`

Defined in: [src/shared/types.ts:421](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L421)

***

### conflicts?

> \`optional\` **conflicts?**: \`RuleConflict\`[]

Defined in: [src/shared/types.ts:422](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L422)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / OktaApp

# Interface: OktaApp

Defined in: [src/shared/types.ts:683](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L683)

Minimal Okta application, kept for resolving APP_GROUP sources.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:684](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L684)

***

### name

> **name**: \`string\`

Defined in: [src/shared/types.ts:685](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L685)

***

### label

> **label**: \`string\`

Defined in: [src/shared/types.ts:686](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L686)

***

### status

> **status**: \`"ACTIVE"\` \\| \`"INACTIVE"\`

Defined in: [src/shared/types.ts:687](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L687)

***

### created

> **created**: \`string\`

Defined in: [src/shared/types.ts:688](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L688)

***

### lastUpdated

> **lastUpdated**: \`string\`

Defined in: [src/shared/types.ts:689](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L689)

***

### signOnMode?

> \`optional\` **signOnMode?**: \`string\`

Defined in: [src/shared/types.ts:690](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L690)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / OktaAttributedRule

# Interface: OktaAttributedRule

Defined in: [src/shared/types.ts:341](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L341)

One rule exactly as Okta named it when asked which rules manage a membership.

Structurally the \`EmbeddedGroupRule\` of
\`shared/membership/memberRuleAttribution\`, redeclared here to avoid an import
cycle. Just the reference: Okta names rules, it does not describe them, so
nothing may pass one off as a classified MembershipRule.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:343](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L343)

Rule id (\`0pr…\`).

***

### name

> **name**: \`string\`

Defined in: [src/shared/types.ts:345](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L345)

Rule name, exactly as Okta returned it (end-user-controllable text).


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / OktaFactor

# Interface: OktaFactor

Defined in: [src/shared/types.ts:91](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L91)

A single enrolled MFA factor (from \`GET /api/v1/users/{id}/factors\`).

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:92](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L92)

***

### factorType

> **factorType**: \`string\`

Defined in: [src/shared/types.ts:93](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L93)

***

### provider

> **provider**: \`string\`

Defined in: [src/shared/types.ts:94](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L94)

***

### status

> **status**: \`string\`

Defined in: [src/shared/types.ts:95](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L95)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / OktaGroup

# Interface: OktaGroup

Defined in: [src/shared/types.ts:111](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L111)

An Okta group (id, type, and name/description profile).

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:112](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L112)

***

### type

> **type**: \`GroupType\`

Defined in: [src/shared/types.ts:113](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L113)

***

### profile

> **profile**: \`object\`

Defined in: [src/shared/types.ts:114](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L114)

#### name

> **name**: \`string\`

#### description?

> \`optional\` **description?**: \`string\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / OktaGroupRule

# Interface: OktaGroupRule

Defined in: [src/shared/types.ts:134](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L134)

A group rule as returned by the Okta Group Rules API.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:135](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L135)

***

### name

> **name**: \`string\`

Defined in: [src/shared/types.ts:136](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L136)

***

### status

> **status**: \`GroupRuleStatus\`

Defined in: [src/shared/types.ts:137](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L137)

***

### type

> **type**: \`string\`

Defined in: [src/shared/types.ts:138](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L138)

***

### created

> **created**: \`string\`

Defined in: [src/shared/types.ts:139](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L139)

***

### lastUpdated

> **lastUpdated**: \`string\`

Defined in: [src/shared/types.ts:140](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L140)

***

### conditions?

> \`optional\` **conditions?**: \`RuleConditions\`

Defined in: [src/shared/types.ts:141](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L141)

***

### actions?

> \`optional\` **actions?**: \`RuleActions\`

Defined in: [src/shared/types.ts:142](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L142)

***

### allGroupsValid?

> \`optional\` **allGroupsValid?**: \`boolean\`

Defined in: [src/shared/types.ts:143](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L143)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / OktaUser

# Interface: OktaUser

Defined in: [src/shared/types.ts:20](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L20)

An Okta user as returned by the Users API, with a partly-typed profile.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:21](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L21)

***

### status

> **status**: \`UserStatus\`

Defined in: [src/shared/types.ts:22](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L22)

***

### created?

> \`optional\` **created?**: \`string\`

Defined in: [src/shared/types.ts:23](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L23)

***

### activated?

> \`optional\` **activated?**: \`string\`

Defined in: [src/shared/types.ts:24](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L24)

***

### statusChanged?

> \`optional\` **statusChanged?**: \`string\`

Defined in: [src/shared/types.ts:25](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L25)

***

### lastLogin?

> \`optional\` **lastLogin?**: \`string\` \\| \`null\`

Defined in: [src/shared/types.ts:26](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L26)

***

### lastUpdated?

> \`optional\` **lastUpdated?**: \`string\`

Defined in: [src/shared/types.ts:27](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L27)

***

### passwordChanged?

> \`optional\` **passwordChanged?**: \`string\` \\| \`null\`

Defined in: [src/shared/types.ts:28](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L28)

***

### managedBy?

> \`optional\` **managedBy?**: \`object\`

Defined in: [src/shared/types.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L29)

#### rules?

> \`optional\` **rules?**: \`object\`[]

***

### credentials?

> \`optional\` **credentials?**: \`object\`

Defined in: [src/shared/types.ts:42](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L42)

How the *account* is mastered, as opposed to how one attribute is.
\`provider.type\` is \`'OKTA'\` when Okta owns the credential, or
\`'ACTIVE_DIRECTORY'\`/\`'IMPORT'\`/\`'FEDERATION'\` otherwise — the signal that
decides whether \`login\` may be edited. Narrow on purpose: the zod schema
strips \`credentials.password\`/\`recovery_question\` at the boundary.

#### provider?

> \`optional\` **provider?**: \`object\`

##### provider.type?

> \`optional\` **type?**: \`string\`

##### provider.name?

> \`optional\` **name?**: \`string\`

***

### profile

> **profile**: \`object\`

Defined in: [src/shared/types.ts:48](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L48)

#### Index Signature

\\[\`key\`: \`string\`\\]: \`any\`

#### login

> **login**: \`string\`

#### email

> **email**: \`string\`

#### firstName

> **firstName**: \`string\`

#### lastName

> **lastName**: \`string\`

#### secondEmail?

> \`optional\` **secondEmail?**: \`string\`

#### mobilePhone?

> \`optional\` **mobilePhone?**: \`string\`

#### primaryPhone?

> \`optional\` **primaryPhone?**: \`string\`

#### streetAddress?

> \`optional\` **streetAddress?**: \`string\`

#### city?

> \`optional\` **city?**: \`string\`

#### state?

> \`optional\` **state?**: \`string\`

#### zipCode?

> \`optional\` **zipCode?**: \`string\`

#### countryCode?

> \`optional\` **countryCode?**: \`string\`

#### department?

> \`optional\` **department?**: \`string\`

#### title?

> \`optional\` **title?**: \`string\`

#### manager?

> \`optional\` **manager?**: \`string\`

#### managerId?

> \`optional\` **managerId?**: \`string\`

#### division?

> \`optional\` **division?**: \`string\`

#### organization?

> \`optional\` **organization?**: \`string\`

#### costCenter?

> \`optional\` **costCenter?**: \`string\`

#### employeeNumber?

> \`optional\` **employeeNumber?**: \`string\`

#### userType?

> \`optional\` **userType?**: \`string\`

#### locale?

> \`optional\` **locale?**: \`string\`

#### timezone?

> \`optional\` **timezone?**: \`string\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / PersistedAuditLogEntry

# Interface: PersistedAuditLogEntry

Defined in: [src/shared/types.ts:544](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L544)

An audit-trail record as it comes *back out of* IndexedDB — the **row** shape.

Identical to AuditLogEntry except that \`actorResolution\` is optional:
rows predating the field have no value and no migration could honestly supply
one. The split makes that gap visible to the compiler.

## Extends

- \`Omit\`\\<\`AuditLogEntry\`, \`"actorResolution"\`\\>

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/types.ts:509](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L509)

#### Inherited from

\`AuditLogEntry\`.\`id\`

***

### timestamp

> **timestamp**: \`Date\`

Defined in: [src/shared/types.ts:510](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L510)

#### Inherited from

\`AuditLogEntry\`.\`timestamp\`

***

### action

> **action**: \`"remove_users"\` \\| \`"add_users"\` \\| \`"export"\` \\| \`"activate_rule"\` \\| \`"deactivate_rule"\`

Defined in: [src/shared/types.ts:511](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L511)

#### Inherited from

\`AuditLogEntry\`.\`action\`

***

### groupId

> **groupId**: \`string\`

Defined in: [src/shared/types.ts:512](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L512)

#### Inherited from

\`AuditLogEntry\`.\`groupId\`

***

### groupName

> **groupName**: \`string\`

Defined in: [src/shared/types.ts:513](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L513)

#### Inherited from

\`AuditLogEntry\`.\`groupName\`

***

### performedBy

> **performedBy**: \`string\` \\| \`null\`

Defined in: [src/shared/types.ts:518](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L518)

Email of the admin who performed the operation, or \`null\` when the actor
could not be resolved. Never a placeholder — see ActorResolution.

#### Inherited from

\`AuditLogEntry\`.\`performedBy\`

***

### affectedUsers

> **affectedUsers**: \`string\`[]

Defined in: [src/shared/types.ts:526](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L526)

#### Inherited from

\`AuditLogEntry\`.\`affectedUsers\`

***

### result

> **result**: \`"success"\` \\| \`"failed"\` \\| \`"partial"\`

Defined in: [src/shared/types.ts:527](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L527)

#### Inherited from

\`AuditLogEntry\`.\`result\`

***

### details

> **details**: \`object\`

Defined in: [src/shared/types.ts:528](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L528)

#### usersSucceeded

> **usersSucceeded**: \`number\`

#### usersFailed

> **usersFailed**: \`number\`

#### apiRequestCount

> **apiRequestCount**: \`number\`

#### durationMs

> **durationMs**: \`number\`

#### errorMessages?

> \`optional\` **errorMessages?**: \`string\`[]

#### Inherited from

\`AuditLogEntry\`.\`details\`

***

### actorResolution?

> \`optional\` **actorResolution?**: \`ActorResolution\`

Defined in: [src/shared/types.ts:554](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L554)

How PersistedAuditLogEntry.performedBy was arrived at, or
\`undefined\` when the row predates the field.

\`undefined\` is not a synonym for \`'unavailable'\`: the latter positively
records that a lookup ran and named nobody, the former that attribution was
never recorded either way. A UI that distinguishes actors treats the absent
case as its own third branch.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / PolicyInfo

# Interface: PolicyInfo

Defined in: [src/shared/types.ts:263](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L263)

Minimal authentication/access-policy identity extracted from the current Okta page.

Detection is read-only and identity-only: the id comes from the URL and the name
from the page heading (optionally corrected by a single validated
\`GET /api/v1/policies/{id}\` read). Policy *settings* are never scraped out of the
page markup.

## Properties

### policyId

> **policyId**: \`string\`

Defined in: [src/shared/types.ts:264](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L264)

***

### policyName

> **policyName**: \`string\` \\| \`null\`

Defined in: [src/shared/types.ts:266](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L266)

Display name; \`null\` when neither the DOM nor the API supplied one.

***

### policyStatus?

> \`optional\` **policyStatus?**: \`string\`

Defined in: [src/shared/types.ts:268](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L268)

Lifecycle status (e.g. \`ACTIVE\`), present only when API enrichment succeeded.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / ProgressCallback

# Interface: ProgressCallback()

Defined in: [src/shared/types.ts:482](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L482)

Callback invoked during long-running bulk operations to report progress.

> **ProgressCallback**(\`current\`, \`total\`, \`message?\`): \`void\`

Defined in: [src/shared/types.ts:483](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L483)

Callback invoked during long-running bulk operations to report progress.

## Parameters

### current

\`number\`

### total

\`number\`

### message?

\`string\`

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / PushGroupMapping

# Interface: PushGroupMapping

Defined in: [src/shared/types.ts:590](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L590)

A push-group mapping linking a source Okta group to an app's target group.

Carries no status: \`GET /api/v1/apps/{appId}/groups\` returns none for an
app-group assignment, so any ACTIVE/INACTIVE label would be an inference
dressed as an Okta fact.

## Properties

### mappingId

> **mappingId**: \`string\`

Defined in: [src/shared/types.ts:591](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L591)

***

### sourceUserGroupId

> **sourceUserGroupId**: \`string\`

Defined in: [src/shared/types.ts:592](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L592)

***

### targetGroupName

> **targetGroupName**: \`string\`

Defined in: [src/shared/types.ts:593](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L593)

***

### priority?

> \`optional\` **priority?**: \`number\`

Defined in: [src/shared/types.ts:598](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L598)

The assignment's priority as returned by Okta, when present. This is a real
API field — it is NOT an activation state and must not be rendered as one.

***

### appId

> **appId**: \`string\`

Defined in: [src/shared/types.ts:599](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L599)

***

### appName?

> \`optional\` **appName?**: \`string\`

Defined in: [src/shared/types.ts:600](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L600)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / RuleActions

# Interface: RuleActions

Defined in: [src/shared/types.ts:164](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L164)

A rule's actions — currently only assigning matched users to target groups.

## Properties

### assignUserToGroups?

> \`optional\` **assignUserToGroups?**: \`object\`

Defined in: [src/shared/types.ts:165](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L165)

#### groupIds

> **groupIds**: \`string\`[]


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / RuleConditions

# Interface: RuleConditions

Defined in: [src/shared/types.ts:147](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L147)

A rule's matching conditions: people include/exclude lists and/or an EL expression.

## Properties

### people?

> \`optional\` **people?**: \`object\`

Defined in: [src/shared/types.ts:148](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L148)

#### users?

> \`optional\` **users?**: \`object\`

##### users.exclude?

> \`optional\` **exclude?**: \`string\`[]

#### groups?

> \`optional\` **groups?**: \`object\`

##### groups.exclude?

> \`optional\` **exclude?**: \`string\`[]

##### groups.include?

> \`optional\` **include?**: \`string\`[]

***

### expression?

> \`optional\` **expression?**: \`object\`

Defined in: [src/shared/types.ts:157](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L157)

#### value

> **value**: \`string\`

#### type

> **type**: \`string\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / RuleConflict

# Interface: RuleConflict

Defined in: [src/shared/types.ts:171](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L171)

A detected conflict between two active rules that overlap on groups + attributes.

## Properties

### rule1

> **rule1**: \`object\`

Defined in: [src/shared/types.ts:172](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L172)

#### id

> **id**: \`string\`

#### name

> **name**: \`string\`

***

### rule2

> **rule2**: \`object\`

Defined in: [src/shared/types.ts:173](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L173)

#### id

> **id**: \`string\`

#### name

> **name**: \`string\`

***

### reason

> **reason**: \`string\`

Defined in: [src/shared/types.ts:175](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L175)

Human-readable explanation of the overlap.

***

### severity

> **severity**: \`"high"\` \\| \`"low"\` \\| \`"medium"\`

Defined in: [src/shared/types.ts:177](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L177)

Severity scaled by the number of shared target groups.

***

### affectedGroups

> **affectedGroups**: \`string\`[]

Defined in: [src/shared/types.ts:179](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L179)

IDs of the groups both rules assign to.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / RuleStats

# Interface: RuleStats

Defined in: [src/shared/types.ts:466](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L466)

Aggregate counts across a set of rules.

## Properties

### total

> **total**: \`number\`

Defined in: [src/shared/types.ts:468](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L468)

Every rule counted, whatever its GroupRuleStatus.

***

### active

> **active**: \`number\`

Defined in: [src/shared/types.ts:470](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L470)

Rules whose status is exactly \`ACTIVE\`.

***

### inactive

> **inactive**: \`number\`

Defined in: [src/shared/types.ts:477](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L477)

Rules whose status is exactly \`INACTIVE\` — a deliberate pause. \`INVALID\`
rules count in RuleStats.total but in neither \`active\` nor
\`inactive\`, so the two need not sum to the total; they are surfaced per-row
as a \`danger\` mark instead of as a count.

***

### conflicts

> **conflicts**: \`number\`

Defined in: [src/shared/types.ts:478](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L478)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / SchedulerStateChangedMessage

# Interface: SchedulerStateChangedMessage

Defined in: [src/shared/types.ts:431](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L431)

Push message broadcast by the background service worker to all extension
pages on every scheduler state transition. Carries the metrics snapshot
alongside the state so side-panel listeners (e.g. the ActivityBar) stay live
without polling \`getSchedulerMetrics\`.

## Properties

### action

> **action**: \`"schedulerStateChanged"\`

Defined in: [src/shared/types.ts:432](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L432)

***

### state

> **state**: \`SchedulerState\`

Defined in: [src/shared/types.ts:434](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L434)

The scheduler state after the transition.

***

### metrics

> **metrics**: \`SchedulerMetrics\`

Defined in: [src/shared/types.ts:436](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L436)

Throughput/rate-limit metrics snapshot taken at broadcast time.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / UserGroupMemberships

# Interface: UserGroupMemberships

Defined in: [src/shared/types.ts:671](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L671)

A user paired with their annotated group memberships.

## Properties

### user

> **user**: \`OktaUser\`

Defined in: [src/shared/types.ts:672](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L672)

***

### groups

> **groups**: \`GroupMembership\`[]

Defined in: [src/shared/types.ts:673](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L673)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / UserInfo

# Interface: UserInfo

Defined in: [src/shared/types.ts:241](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L241)

Minimal user identity extracted from the current Okta page.

## Properties

### userId

> **userId**: \`string\`

Defined in: [src/shared/types.ts:242](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L242)

***

### userName

> **userName**: \`string\`

Defined in: [src/shared/types.ts:243](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L243)

***

### userEmail?

> \`optional\` **userEmail?**: \`string\`

Defined in: [src/shared/types.ts:244](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L244)

***

### userStatus?

> \`optional\` **userStatus?**: \`UserStatus\`

Defined in: [src/shared/types.ts:245](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L245)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / UserMembershipTrace

# Interface: UserMembershipTrace

Defined in: [src/shared/types.ts:272](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L272)

A user plus every group they belong to, for membership tracing.

## Properties

### userId

> **userId**: \`string\`

Defined in: [src/shared/types.ts:273](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L273)

***

### user

> **user**: \`OktaUser\`

Defined in: [src/shared/types.ts:274](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L274)

***

### groups

> **groups**: \`GroupMembership\`[]

Defined in: [src/shared/types.ts:275](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L275)

***

### totalGroups

> **totalGroups**: \`number\`

Defined in: [src/shared/types.ts:276](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L276)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / ActorResolution

# Type Alias: ActorResolution

> **ActorResolution** = \`"resolved"\` \\| \`"unavailable"\`

Defined in: [src/shared/types.ts:501](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L501)

Whether the acting admin could be named when an entry was written.

Pairs with AuditLogEntry.performedBy: \`'resolved'\` means the string is
a real identity, \`'unavailable'\` means the \`/users/me\` lookup could not name
anyone and \`performedBy\` is \`null\`. A row that predates the field made neither
claim; that third state is the field's *absence* on
PersistedAuditLogEntry, never a member of this union.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / GroupRuleStatus

# Type Alias: GroupRuleStatus

> **GroupRuleStatus** = \`"ACTIVE"\` \\| \`"INACTIVE"\` \\| \`"INVALID"\`

Defined in: [src/shared/types.ts:131](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L131)

Okta's \`GroupRuleStatus\` lifecycle, in full.

\`INVALID\` is the state a rule falls into when it stops being evaluable, most
commonly because a group it names was deleted. It places nobody, like
\`INACTIVE\`, but it is not a state an admin chose — branch on it explicitly,
never fold it into the \`INACTIVE\` arm.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / GroupType

# Type Alias: GroupType

> **GroupType** = \`"OKTA_GROUP"\` \\| \`"APP_GROUP"\` \\| \`"BUILT_IN"\`

Defined in: [src/shared/types.ts:121](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L121)

How a group is sourced: native Okta, app-mastered, or built-in.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / MembershipAttribution

# Type Alias: MembershipAttribution

> **MembershipAttribution** = \`"exact"\` \\| \`"inferred"\` \\| \`"ambiguous"\`

Defined in: [src/shared/types.ts:331](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L331)

What kind of evidence produced a membership classification — so a guess can be
rendered as a guess rather than as one of Okta's own facts.

Every consumer maps an attribution onto behaviour through an exhaustive
\`Record\` keyed by this type (\`membershipAnalysis.ATTRIBUTION_SEMANTICS\`,
\`memberSourceBuckets.ATTRIBUTION_BUCKET\`), so a new member is a compile error
at every decision point rather than a silent fall-through.

- \`exact\` — proven from facts; every rule in GroupMembership.rules
  provably matches (the list may still be incomplete).
- \`inferred\` — a deduction resting on evidence: one candidate survived
  elimination, or the user's attribute values appear in a candidate's
  condition text. Plausible, not proven.
- \`ambiguous\` — a guess with no evidence: GroupMembership.rules is a
  candidate set, any or none of which may be responsible. Also the value for
  an unclassified membership. Never render it with the weight of an answer.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / MfaScanStatus

# Type Alias: MfaScanStatus

> **MfaScanStatus** = \`"idle"\` \\| \`"confirming"\` \\| \`"scanning"\` \\| \`"complete"\` \\| \`"error"\`

Defined in: [src/shared/types.ts:99](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L99)

State machine for a group-wide MFA enrollment scan.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / OperationPlanUpdate

# Type Alias: OperationPlanUpdate

> **OperationPlanUpdate** = \`object\` & \\{ \`op\`: \`"declare"\`; \`name\`: \`string\`; \`tabId\`: \`number\`; \`legs\`: \`PlanLegInput\`[]; \\} \\| \\{ \`op\`: \`"refine"\`; \`endpoint\`: \`string\`; \`estimate\`: \`PlanEstimate\`; \\} \\| \\{ \`op\`: \`"complete"\`; \\} \\| \\{ \`op\`: \`"cancel"\`; \\}

Defined in: [src/shared/types.ts:446](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L446)

Side-panel → background message that opens, refines, or closes an
OperationPlan (\`shared/scheduler/plan\`).

One action with a discriminated \`op\`, since the four share a validator, a
sender check, and a plan id.

## Type Declaration

### planId

> **planId**: \`string\`

Opaque id minted by the caller and echoed on every request the plan covers.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / ResultType

# Type Alias: ResultType

> **ResultType** = \`"info"\` \\| \`"success"\` \\| \`"warning"\` \\| \`"error"\`

Defined in: [src/shared/types.ts:487](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L487)

Severity/kind of a user-facing result message.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / UpdateOperationPlanMessage

# Type Alias: UpdateOperationPlanMessage

> **UpdateOperationPlanMessage** = \`object\` & \`OperationPlanUpdate\`

Defined in: [src/shared/types.ts:463](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L463)

The OperationPlanUpdate payload as it travels over \`chrome.runtime\`.

## Type Declaration

### action

> **action**: \`"updateOperationPlan"\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/types / UserStatus

# Type Alias: UserStatus

> **UserStatus** = \`"ACTIVE"\` \\| \`"DEPROVISIONED"\` \\| \`"SUSPENDED"\` \\| \`"STAGED"\` \\| \`"PROVISIONED"\` \\| \`"RECOVERY"\` \\| \`"LOCKED_OUT"\` \\| \`"PASSWORD_EXPIRED"\`

Defined in: [src/shared/types.ts:80](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/types.ts#L80)

Okta account lifecycle status.`;function t(e){return n.jsxs(n.Fragment,{children:[`
`,n.jsx(a,{title:"Internals/Types"}),`
`,n.jsx(o,{children:d})]})}function u(e={}){const{wrapper:s}={...r(),...e.components};return s?n.jsx(s,{...e,children:n.jsx(t,{...e})}):t()}export{u as default};
