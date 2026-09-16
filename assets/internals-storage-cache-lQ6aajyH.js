import{j as n}from"./iframe-tAvKsVeF.js";import{u as r,M as a,c as o}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const i=`# Storage & cache



---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/auditSchema / parsePersistedAuditRows

# Function: parsePersistedAuditRows()

> **parsePersistedAuditRows**(\`rows\`, \`context\`): \`PersistedAuditLogEntry\`[]

Defined in: [src/shared/storage/auditSchema.ts:89](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/auditSchema.ts#L89)

Validate an array of raw rows read out of the audit \`operations\` store,
dropping (never throwing on) a row that fails validation.

## Parameters

### rows

\`unknown\`[]

The raw array \`idb\` returned (\`db.getAll\` / \`db.getAllFromIndex\`).

### context

\`string\`

Human-readable label for the log line (e.g. \`'getHistory'\`).

## Returns

\`PersistedAuditLogEntry\`[]

The rows that validated, in their original order. Never throws.

## Remarks

On a drop, logs one counts-only warning (\`{ context, dropped, total }\`)
— never the offending row or any field value, since audit rows carry actor
emails and entity names (PII).


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/auditSchema / persistedAuditLogEntrySchema

# Variable: persistedAuditLogEntrySchema

> \`const\` **persistedAuditLogEntrySchema**: \`ZodObject\`\\<\\{ \`id\`: \`ZodString\`; \`timestamp\`: \`ZodEffects\`\\<\`ZodDate\`, \`Date\`, \`Date\`\\>; \`action\`: \`ZodEnum\`\\<\\[\`"remove_users"\`, \`"add_users"\`, \`"export"\`, \`"activate_rule"\`, \`"deactivate_rule"\`\\]\\>; \`groupId\`: \`ZodString\`; \`groupName\`: \`ZodString\`; \`performedBy\`: \`ZodNullable\`\\<\`ZodString\`\\>; \`actorResolution\`: \`ZodCatch\`\\<\`ZodOptional\`\\<\`ZodEnum\`\\<\\[\`"resolved"\`, \`"unavailable"\`\\]\\>\\>\\>; \`affectedUsers\`: \`ZodArray\`\\<\`ZodString\`, \`"many"\`\\>; \`result\`: \`ZodEnum\`\\<\\[\`"success"\`, \`"partial"\`, \`"failed"\`\\]\\>; \`details\`: \`ZodObject\`\\<\\{ \`usersSucceeded\`: \`ZodNumber\`; \`usersFailed\`: \`ZodNumber\`; \`apiRequestCount\`: \`ZodNumber\`; \`durationMs\`: \`ZodNumber\`; \`errorMessages\`: \`ZodOptional\`\\<\`ZodArray\`\\<\`ZodString\`, \`"many"\`\\>\\>; \\}, \`"strip"\`, \`ZodTypeAny\`, \\{ \`usersSucceeded\`: \`number\`; \`usersFailed\`: \`number\`; \`apiRequestCount\`: \`number\`; \`durationMs\`: \`number\`; \`errorMessages?\`: \`string\`[]; \\}, \\{ \`usersSucceeded\`: \`number\`; \`usersFailed\`: \`number\`; \`apiRequestCount\`: \`number\`; \`durationMs\`: \`number\`; \`errorMessages?\`: \`string\`[]; \\}\\>; \\}, \`"strip"\`, \`ZodTypeAny\`, \\{ \`id\`: \`string\`; \`timestamp\`: \`Date\`; \`action\`: \`"remove_users"\` \\| \`"add_users"\` \\| \`"export"\` \\| \`"activate_rule"\` \\| \`"deactivate_rule"\`; \`groupId\`: \`string\`; \`groupName\`: \`string\`; \`performedBy\`: \`string\` \\| \`null\`; \`actorResolution?\`: \`"unavailable"\` \\| \`"resolved"\`; \`affectedUsers\`: \`string\`[]; \`result\`: \`"success"\` \\| \`"failed"\` \\| \`"partial"\`; \`details\`: \\{ \`usersSucceeded\`: \`number\`; \`usersFailed\`: \`number\`; \`apiRequestCount\`: \`number\`; \`durationMs\`: \`number\`; \`errorMessages?\`: \`string\`[]; \\}; \\}, \\{ \`id\`: \`string\`; \`timestamp\`: \`Date\`; \`action\`: \`"remove_users"\` \\| \`"add_users"\` \\| \`"export"\` \\| \`"activate_rule"\` \\| \`"deactivate_rule"\`; \`groupId\`: \`string\`; \`groupName\`: \`string\`; \`performedBy\`: \`string\` \\| \`null\`; \`actorResolution?\`: \`unknown\`; \`affectedUsers\`: \`string\`[]; \`result\`: \`"success"\` \\| \`"failed"\` \\| \`"partial"\`; \`details\`: \\{ \`usersSucceeded\`: \`number\`; \`usersFailed\`: \`number\`; \`apiRequestCount\`: \`number\`; \`durationMs\`: \`number\`; \`errorMessages?\`: \`string\`[]; \\}; \\}\\>

Defined in: [src/shared/storage/auditSchema.ts:65](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/auditSchema.ts#L65)

The row shape auditStore.getHistory and auditStore.getStats
trust back out of the \`operations\` store. See the module doc for the
drop-vs-degrade split between \`actorResolution\` and everything else.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/auditStore / ACTOR\\_UNAVAILABLE\\_LABEL

# Variable: ACTOR\\_UNAVAILABLE\\_LABEL

> \`const\` **ACTOR\\_UNAVAILABLE\\_LABEL**: \`"(actor unavailable)"\` = \`'(actor unavailable)'\`

Defined in: [src/shared/storage/auditStore.ts:71](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/auditStore.ts#L71)

What the CSV export shows in "Performed By" when an entry has no resolved
actor — an explicit statement, not a blank cell and not a fabricated address.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/auditStore / auditStore

# Variable: auditStore

> \`const\` **auditStore**: \`AuditStore\`

Defined in: [src/shared/storage/auditStore.ts:414](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/auditStore.ts#L414)

Shared audit-trail store singleton — use this rather than \`new AuditStore()\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/presetStore / ExportPreset

# Interface: ExportPreset

Defined in: [src/shared/storage/presetStore.ts:18](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L18)

A named, saved column selection for one entity's export.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/storage/presetStore.ts:20](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L20)

Stable record id (\`crypto.randomUUID()\`); the object-store key.

***

### entityId

> **entityId**: \`string\`

Defined in: [src/shared/storage/presetStore.ts:22](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L22)

The EntityExport.id this preset belongs to (indexed).

***

### name

> **name**: \`string\`

Defined in: [src/shared/storage/presetStore.ts:24](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L24)

Admin-chosen preset name (e.g. "Offboarding audit").

***

### enabledColumnIds

> **enabledColumnIds**: \`string\`[]

Defined in: [src/shared/storage/presetStore.ts:26](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L26)

Enabled column ids, resolved against the descriptor catalog on load.

***

### filterText?

> \`optional\` **filterText?**: \`string\`

Defined in: [src/shared/storage/presetStore.ts:28](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L28)

Optional saved raw filter expression.

***

### createdAt

> **createdAt**: \`Date\`

Defined in: [src/shared/storage/presetStore.ts:30](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L30)

When the preset was created.

***

### version

> **version**: \`1\`

Defined in: [src/shared/storage/presetStore.ts:32](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L32)

Per-record schema version, for forward migration without a DB bump.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/presetStore / LastUsed

# Interface: LastUsed

Defined in: [src/shared/storage/presetStore.ts:41](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L41)

The most-recent column selection for one entity, restored on next visit.

Holds no filter text: a raw filter expression may carry PII, so it is
persisted only in explicit, individually-deletable ExportPresets.

## Properties

### entityId

> **entityId**: \`string\`

Defined in: [src/shared/storage/presetStore.ts:43](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L43)

The EntityExport.id; the object-store key (one row per entity).

***

### enabledColumnIds

> **enabledColumnIds**: \`string\`[]

Defined in: [src/shared/storage/presetStore.ts:45](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L45)

Enabled column ids from the last export.

***

### updatedAt

> **updatedAt**: \`Date\`

Defined in: [src/shared/storage/presetStore.ts:47](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L47)

When it was last updated.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/presetStore / presetStore

# Variable: presetStore

> \`const\` **presetStore**: \`PresetStore\`

Defined in: [src/shared/storage/presetStore.ts:184](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/presetStore.ts#L184)

Shared export-preset store singleton — use this rather than \`new PresetStore()\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/profileDisplayStore / ProfileDisplayCategory

# Interface: ProfileDisplayCategory

Defined in: [src/shared/storage/profileDisplayStore.ts:27](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L27)

One admin-defined category that profile attributes can be assigned to.

## Properties

### key

> **key**: \`string\`

Defined in: [src/shared/storage/profileDisplayStore.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L29)

Stable identifier referenced by ProfileDisplayConfig.assign.

***

### name

> **name**: \`string\`

Defined in: [src/shared/storage/profileDisplayStore.ts:31](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L31)

Admin-facing label (e.g. "Account state").


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/profileDisplayStore / ProfileDisplayConfig

# Interface: ProfileDisplayConfig

Defined in: [src/shared/storage/profileDisplayStore.ts:35](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L35)

How one admin wants profiles rendered in this org.

## Properties

### layout

> **layout**: \`"rows"\` \\| \`"compact"\` \\| \`"grid"\`

Defined in: [src/shared/storage/profileDisplayStore.ts:37](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L37)

Presentation of the attribute list.

***

### showApiNames

> **showApiNames**: \`boolean\`

Defined in: [src/shared/storage/profileDisplayStore.ts:39](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L39)

Show the raw Okta profile key alongside each attribute's label.

***

### showRuleChips

> **showRuleChips**: \`boolean\`

Defined in: [src/shared/storage/profileDisplayStore.ts:41](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L41)

Show the "set by a group rule" chips.

***

### showEmpty

> **showEmpty**: \`boolean\`

Defined in: [src/shared/storage/profileDisplayStore.ts:43](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L43)

Render attributes whose value is empty.

***

### categories

> **categories**: \`ProfileDisplayCategory\`[]

Defined in: [src/shared/storage/profileDisplayStore.ts:45](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L45)

Categories, in display order. Order is the array order.

***

### assign

> **assign**: \`Record\`\\<\`string\`, \`string\`\\>

Defined in: [src/shared/storage/profileDisplayStore.ts:47](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L47)

attribute name -> category key. '' means uncategorized.

***

### attrOrder

> **attrOrder**: \`string\`[]

Defined in: [src/shared/storage/profileDisplayStore.ts:49](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L49)

Attribute names in the admin's global order.

***

### hidden

> **hidden**: \`Record\`\\<\`string\`, \`boolean\`\\>

Defined in: [src/shared/storage/profileDisplayStore.ts:51](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L51)

attribute name -> hidden. Absent or \`false\` means visible.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/profileDisplayStore / StoredProfileDisplay

# Interface: StoredProfileDisplay

Defined in: [src/shared/storage/profileDisplayStore.ts:58](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L58)

The per-org record actually written to IndexedDB: the config plus the
bookkeeping needed to migrate it later without a DB version bump.

## Properties

### oktaOrigin

> **oktaOrigin**: \`string\`

Defined in: [src/shared/storage/profileDisplayStore.ts:60](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L60)

Okta org origin (e.g. \`https://example.okta.com\`); the object-store key.

***

### config

> **config**: \`ProfileDisplayConfig\`

Defined in: [src/shared/storage/profileDisplayStore.ts:62](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L62)

The admin's configuration for this org.

***

### updatedAt

> **updatedAt**: \`Date\`

Defined in: [src/shared/storage/profileDisplayStore.ts:64](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L64)

When the config was last written.

***

### version

> **version**: \`1\`

Defined in: [src/shared/storage/profileDisplayStore.ts:66](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L66)

Per-record schema version, for forward migration without a DB bump.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/profileDisplayStore / DEFAULT\\_PROFILE\\_DISPLAY\\_CONFIG

# Variable: DEFAULT\\_PROFILE\\_DISPLAY\\_CONFIG

> \`const\` **DEFAULT\\_PROFILE\\_DISPLAY\\_CONFIG**: \`ProfileDisplayConfig\`

Defined in: [src/shared/storage/profileDisplayStore.ts:75](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L75)

The starting configuration for an org that has never been configured.
Attribute placement starts empty, so every attribute the org has shows up as
uncategorized until the admin files it. Category keys are stable kebab-case
ids: an admin may rename the labels, never the keys.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/profileDisplayStore / profileDisplayStore

# Variable: profileDisplayStore

> \`const\` **profileDisplayStore**: \`ProfileDisplayStore\`

Defined in: [src/shared/storage/profileDisplayStore.ts:183](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/profileDisplayStore.ts#L183)

Shared profile-display store singleton — use this rather than
\`new ProfileDisplayStore()\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / applyPin

# Function: applyPin()

> **applyPin**(\`set\`, \`ref\`): \`WorkingSet\`

Defined in: [src/shared/storage/workingSetStore.ts:161](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L161)

Pin an entity, moving it out of \`recent\` if it was there.

## Parameters

### set

\`WorkingSet\`

The current set.

### ref

\`WorkingSetRef\`

The entity to keep.

## Returns

\`WorkingSet\`

A new set with the pin applied; unchanged when already pinned or at
PINNED\\_LIMIT.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / applyTouch

# Function: applyTouch()

> **applyTouch**(\`set\`, \`ref\`): \`WorkingSet\`

Defined in: [src/shared/storage/workingSetStore.ts:142](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L142)

Record a visit.

A pinned entity is refreshed **in place** rather than also entering \`recent\`:
it is already on Home, and listing it twice says one thing twice.

## Parameters

### set

\`WorkingSet\`

The current set.

### ref

\`WorkingSetRef\`

The entity just seen.

## Returns

\`WorkingSet\`

A new set with the visit applied.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / applyUnpin

# Function: applyUnpin()

> **applyUnpin**(\`set\`, \`ref\`): \`WorkingSet\`

Defined in: [src/shared/storage/workingSetStore.ts:181](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L181)

Unpin an entity. It does **not** fall back into \`recent\` — the reader just
said they were done with it.

## Parameters

### set

\`WorkingSet\`

The current set.

### ref

Which entity to release.

#### kind

\`WorkingSetKind\`

#### id

\`string\`

## Returns

\`WorkingSet\`

A new set with the pin removed.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / normalizeFile

# Function: normalizeFile()

> **normalizeFile**(\`raw\`): \`WorkingSetFile\`

Defined in: [src/shared/storage/workingSetStore.ts:98](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L98)

Coerce whatever is on disk into a usable file.

The stored shape is untrusted: a half-written blob, a hand-edited one, or one
from a future schema degrades to "nothing remembered" rather than crashing the
tab that reads it.

## Parameters

### raw

\`unknown\`

The value read from \`chrome.storage.local\`.

## Returns

\`WorkingSetFile\`

A well-formed file; empty when \`raw\` cannot be trusted.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / prune

# Function: prune()

> **prune**(\`set\`, \`now\`): \`WorkingSet\`

Defined in: [src/shared/storage/workingSetStore.ts:127](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L127)

Drop recents that have aged out.

## Parameters

### set

\`WorkingSet\`

The set to prune.

### now

\`number\`

Current epoch millis.

## Returns

\`WorkingSet\`

The set with expired recents removed. Pins are untouched.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / WorkingSet

# Interface: WorkingSet

Defined in: [src/shared/storage/workingSetStore.ts:58](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L58)

One org's working set.

## Properties

### pinned

> **pinned**: \`WorkingSetRef\`[]

Defined in: [src/shared/storage/workingSetStore.ts:60](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L60)

Entities the reader chose to keep, newest pin last. Never expires.

***

### recent

> **recent**: \`WorkingSetRef\`[]

Defined in: [src/shared/storage/workingSetStore.ts:62](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L62)

Entities recently opened, most recent first. Capped and expiring.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / WorkingSetRef

# Interface: WorkingSetRef

Defined in: [src/shared/storage/workingSetStore.ts:41](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L41)

One remembered entity.

## Properties

### kind

> **kind**: \`WorkingSetKind\`

Defined in: [src/shared/storage/workingSetStore.ts:43](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L43)

Which detail rung opens it.

***

### id

> **id**: \`string\`

Defined in: [src/shared/storage/workingSetStore.ts:45](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L45)

Okta id — the identity of the row.

***

### name

> **name**: \`string\`

Defined in: [src/shared/storage/workingSetStore.ts:47](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L47)

Display name, as it read when last seen.

***

### lastPane?

> \`optional\` **lastPane?**: \`string\`

Defined in: [src/shared/storage/workingSetStore.ts:52](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L52)

Which pane the reader was on, when the rung has panes and reported one. A
row with no pane shows its kind alone rather than inventing a location.

***

### lastSeenAt

> **lastSeenAt**: \`number\`

Defined in: [src/shared/storage/workingSetStore.ts:54](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L54)

Epoch millis of the last visit.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / WorkingSetKind

# Type Alias: WorkingSetKind

> **WorkingSetKind** = \`"group"\` \\| \`"user"\`

Defined in: [src/shared/storage/workingSetStore.ts:38](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L38)

The entity kinds the working set can hold — the two with a detail rung.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / EMPTY\\_WORKING\\_SET

# Variable: EMPTY\\_WORKING\\_SET

> \`const\` **EMPTY\\_WORKING\\_SET**: \`WorkingSet\`

Defined in: [src/shared/storage/workingSetStore.ts:72](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L72)

An empty set, returned whenever an org has nothing or a read fails.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / PINNED\\_LIMIT

# Variable: PINNED\\_LIMIT

> \`const\` **PINNED\\_LIMIT**: \`20\` = \`20\`

Defined in: [src/shared/storage/workingSetStore.ts:32](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L32)

How many pins are kept per org. A backstop against unbounded file growth.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / RECENT\\_LIMIT

# Variable: RECENT\\_LIMIT

> \`const\` **RECENT\\_LIMIT**: \`5\` = \`5\`

Defined in: [src/shared/storage/workingSetStore.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L29)

How many recently-viewed entities are kept per org.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / RECENT\\_TTL\\_MS

# Variable: RECENT\\_TTL\\_MS

> \`const\` **RECENT\\_TTL\\_MS**: \`number\`

Defined in: [src/shared/storage/workingSetStore.ts:35](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L35)

How long a recently-viewed entry survives without being seen again (14 days).


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / WORKING\\_SET\\_STORAGE\\_KEY

# Variable: WORKING\\_SET\\_STORAGE\\_KEY

> \`const\` **WORKING\\_SET\\_STORAGE\\_KEY**: \`"okta_unbound_working_set"\` = \`'okta_unbound_working_set'\`

Defined in: [src/shared/storage/workingSetStore.ts:26](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L26)

\`chrome.storage.local\` key under which the whole working set is persisted.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/storage/workingSetStore / workingSetStore

# Variable: workingSetStore

> \`const\` **workingSetStore**: \`WorkingSetStore\`

Defined in: [src/shared/storage/workingSetStore.ts:348](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/storage/workingSetStore.ts#L348)

Shared singleton.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/appGroupSnapshot / readAppGroupsFromSnapshot

# Function: readAppGroupsFromSnapshot()

> **readAppGroupsFromSnapshot**(\`origin\`): \`Promise\`\\<\`Map\`\\<\`string\`, \`string\`[]\\>\\>

Defined in: [src/sidepanel/cache/appGroupSnapshot.ts:30](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/appGroupSnapshot.ts#L30)

The app→group assignments the snapshot currently holds for one org.

## Parameters

### origin

\`string\` \\| \`null\` \\| \`undefined\`

Org origin. A null/empty origin returns an empty map rather
than reading across orgs — snapshot rows are origin-scoped, and an unscoped
read would file one org's assignments under another's question.

## Returns

\`Promise\`\\<\`Map\`\\<\`string\`, \`string\`[]\\>\\>

App id → assigned group ids, for apps with stored rows only. Never
throws; a failed read is an empty map, which degrades to asking Okta.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / getOrFetch

# Function: getOrFetch()

> **getOrFetch**\\<\`T\`\\>(\`key\`, \`fetcher\`, \`options?\`): \`Promise\`\\<\`T\`\\>

Defined in: [src/sidepanel/cache/entityCache.ts:289](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L289)

Return the cached value if fresh; otherwise fetch it, coalescing concurrent
requests for the same key onto one in-flight promise. Rejections are not cached,
so a failed fetch can be retried immediately.

## Type Parameters

### T

\`T\`

## Parameters

### key

\`EntityKey\`

### fetcher

() => \`Promise\`\\<\`T\`\\>

### options?

\`EntityCacheOptions\` & \`object\` = \`{}\`

Optional TTL, plus \`force\` to bypass both the cache and the
  de-dup and start a fresh fetch (manual refresh).

## Returns

\`Promise\`\\<\`T\`\\>


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / invalidate

# Function: invalidate()

> **invalidate**(\`key\`): \`void\`

Defined in: [src/sidepanel/cache/entityCache.ts:200](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L200)

Remove an entry and every entry nested beneath it, then notify affected
subscribers. Passing an exact key (\`['groupMembers', id]\`) drops just that
entry; passing a prefix (\`['groupMembers']\`) drops all group-member entries.

## Parameters

### key

\`EntityKey\`

The exact key or prefix to invalidate.

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / peek

# Function: peek()

> **peek**\\<\`T\`\\>(\`key\`): \`T\` \\| \`null\`

Defined in: [src/sidepanel/cache/entityCache.ts:134](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L134)

Read a cached value only if it is still fresh.

## Type Parameters

### T

\`T\`

## Parameters

### key

\`EntityKey\`

## Returns

\`T\` \\| \`null\`

The fresh value, or \`null\` on miss or expiry.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / peekEntry

# Function: peekEntry()

> **peekEntry**\\<\`T\`\\>(\`key\`): \`PeekedEntry\`\\<\`T\`\\> \\| \`null\`

Defined in: [src/sidepanel/cache/entityCache.ts:108](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L108)

Read an entry along with its freshness, without fetching or evicting.

## Type Parameters

### T

\`T\`

## Parameters

### key

\`EntityKey\`

## Returns

\`PeekedEntry\`\\<\`T\`\\> \\| \`null\`

The value plus an \`isFresh\` flag, or \`null\` when nothing is cached.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / peekFetchedAt

# Function: peekFetchedAt()

> **peekFetchedAt**(\`key\`): \`number\` \\| \`null\`

Defined in: [src/sidepanel/cache/entityCache.ts:125](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L125)

When a key's value was last written. Does not stamp \`lastRead\`: a metadata read
must not defend an entry against eviction, or a status line would keep dead
data alive.

## Parameters

### key

\`EntityKey\`

## Returns

\`number\` \\| \`null\`

Epoch millis of the write, or \`null\` on a miss.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / registerDerived

# Function: registerDerived()

> **registerDerived**(\`derivedPrefix\`, \`sourcePrefix\`): \`void\`

Defined in: [src/sidepanel/cache/entityCache.ts:216](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L216)

Declare that one key family is computed from another, so invalidating the source
also drops the derived value — a derived value outliving its source is a wrong
answer on screen, not merely a stale one.

Requires the scope tail to match: the cascade rewrites only the leading segment,
so \`['memberSource', X]\` is dropped for \`['groupMembers', X]\`. Call at import
time, once; registrations survive resetEntityCache.

## Parameters

### derivedPrefix

\`string\`

Leading segment of the computed family, e.g. \`memberSource\`.

### sourcePrefix

\`string\`

Leading segment it is computed from, e.g. \`groupMembers\`.

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / resetEntityCache

# Function: resetEntityCache()

> **resetEntityCache**(): \`void\`

Defined in: [src/sidepanel/cache/entityCache.ts:334](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L334)

Clear the store, in-flight promises, and subscriber registry. Test isolation
only. registerDerived registrations are not cleared — they are
import-time wiring, and resetting them would silently stop exercising the cascade.

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / serializeKey

# Function: serializeKey()

> **serializeKey**(\`key\`): \`string\`

Defined in: [src/sidepanel/cache/entityCache.ts:92](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L92)

Serialize an EntityKey to its canonical string form. Composite keys are
joined with a control-character separator so that \`['a', 'b']\` and \`['ab']\`
never collide.

## Parameters

### key

\`EntityKey\`

The key to serialize.

## Returns

\`string\`

The stable string form used internally as the map key.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / setEntry

# Function: setEntry()

> **setEntry**\\<\`T\`\\>(\`key\`, \`data\`, \`options?\`): \`void\`

Defined in: [src/sidepanel/cache/entityCache.ts:140](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L140)

Write a value into the cache and notify subscribers.

## Type Parameters

### T

\`T\`

## Parameters

### key

\`EntityKey\`

### data

\`T\`

### options?

\`EntityCacheOptions\` = \`{}\`

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / subscribe

# Function: subscribe()

> **subscribe**(\`key\`, \`callback\`): () => \`void\`

Defined in: [src/sidepanel/cache/entityCache.ts:313](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L313)

Subscribe to writes and invalidations for a key.

## Parameters

### key

\`EntityKey\`

### callback

() => \`void\`

## Returns

An unsubscribe function.

() => \`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / EntityCacheOptions

# Interface: EntityCacheOptions

Defined in: [src/sidepanel/cache/entityCache.ts:41](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L41)

Options accepted when writing or fetching an entry.

## Properties

### ttl?

> \`optional\` **ttl?**: \`number\`

Defined in: [src/sidepanel/cache/entityCache.ts:43](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L43)

Lifetime in milliseconds before the entry is stale (default: 5 minutes).


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / PeekedEntry

# Interface: PeekedEntry\\<T\\>

Defined in: [src/sidepanel/cache/entityCache.ts:47](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L47)

A cached value read back with its freshness verdict.

## Type Parameters

### T

\`T\`

## Properties

### data

> **data**: \`T\`

Defined in: [src/sidepanel/cache/entityCache.ts:49](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L49)

The cached value.

***

### isFresh

> **isFresh**: \`boolean\`

Defined in: [src/sidepanel/cache/entityCache.ts:51](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L51)

\`true\` while the entry is within its TTL.

***

### fetchedAt

> **fetchedAt**: \`number\`

Defined in: [src/sidepanel/cache/entityCache.ts:57](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L57)

Epoch millis when this value was fetched from Okta, by whichever consumer
fetched it. Use this rather than a per-consumer "when did I last fetch" flag,
which stays unset on a cache hit and reports live data as never fetched.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / EntityKey

# Type Alias: EntityKey

> **EntityKey** = \`string\` \\| \`ReadonlyArray\`\\<\`string\` \\| \`number\`\\>

Defined in: [src/sidepanel/cache/entityCache.ts:38](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L38)

A cache key: either a plain string or a composite tuple (e.g.
\`['groupMembers', groupId]\`). Composite keys enable prefix invalidation.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/entityCache / MAX\\_ENTRIES

# Variable: MAX\\_ENTRIES

> \`const\` **MAX\\_ENTRIES**: \`500\` = \`500\`

Defined in: [src/sidepanel/cache/entityCache.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/entityCache.ts#L29)

Upper bound on retained entries. TTL does not bound the store — expiry is a
freshness verdict read at \`peek\` time, not a deletion — so browsing a few
hundred groups would otherwise hold tens of thousands of user objects.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/keys / RULE\\_INVENTORY\\_KEY

# Variable: RULE\\_INVENTORY\\_KEY

> \`const\` **RULE\\_INVENTORY\\_KEY**: \`"groupRuleInventory"\` = \`'groupRuleInventory'\`

Defined in: [src/sidepanel/cache/keys.ts:126](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/keys.ts#L126)

Entity-cache key for the org-wide rule inventory, plus the derived conflict join
(\`detectConflicts\` is quadratic in the org's rule count, so it is paid once per
key rather than once per consumer).

A singleton: nothing scopes it, so it is a bare string rather than a function.
Read by \`useUserMemberships\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/keys / TTL\\_LONG

# Variable: TTL\\_LONG

> \`const\` **TTL\\_LONG**: \`number\`

Defined in: [src/sidepanel/cache/keys.ts:28](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/keys.ts#L28)

Extended lifetime, for results that cost many requests to rebuild and change
only when their inputs do.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/keys / TTL\\_SHORT

# Variable: TTL\\_SHORT

> \`const\` **TTL\\_SHORT**: \`number\`

Defined in: [src/sidepanel/cache/keys.ts:22](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/keys.ts#L22)

Default lifetime, matching \`entityCache\`'s own default. For data a user expects
to reflect recent changes: memberships, assignments, inventories.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/keys / cacheKeys

# Variable: cacheKeys

> \`const\` **cacheKeys**: \`object\`

Defined in: [src/sidepanel/cache/keys.ts:31](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/keys.ts#L31)

Every \`entityCache\` key in the panel. Add new keys here rather than inline.

## Type Declaration

### apps

> \`readonly\` **apps**: (\`oktaOrigin?\`) => \`EntityKey\`

One org's application inventory, scoped by origin. \`null\`/\`undefined\`
collapses to a single \`'unknown'\` bucket, reachable only before the origin
has resolved.

#### Parameters

##### oktaOrigin?

\`string\` \\| \`null\`

#### Returns

\`EntityKey\`

### groupMembers

> \`readonly\` **groupMembers**: (\`groupId\`) => \`EntityKey\`

A group's full member list, shared by \`GroupOverview\`,
\`useGroupMembersCache\` and \`useGroupSource\`.

#### Parameters

##### groupId

\`string\`

#### Returns

\`EntityKey\`

### memberSource

> \`readonly\` **memberSource**: (\`groupId\`) => \`EntityKey\`

A group's direct-vs-rule member breakdown — derived from
cacheKeys.groupMembers and far more expensive to rebuild.

#### Parameters

##### groupId

\`string\`

#### Returns

\`EntityKey\`

### userMemberships

> \`readonly\` **userMemberships**: (\`userId\`) => \`EntityKey\`

A user's resolved group memberships. Written by \`useUserMemberships\` and
invalidated by \`useUsersTabState\` after a membership write.

#### Parameters

##### userId

\`string\`

#### Returns

\`EntityKey\`

### appDetail

> \`readonly\` **appDetail**: (\`appId\`) => \`EntityKey\`

One application's detail record (status, sign-on mode, metadata).

#### Parameters

##### appId

\`string\`

#### Returns

\`EntityKey\`

### appAssignmentCounts

> \`readonly\` **appAssignmentCounts**: (\`appId\`) => \`EntityKey\`

One application's user/group assignment totals. Separate from
cacheKeys.appDetail because a different, many-request walk fills it.

#### Parameters

##### appId

\`string\`

#### Returns

\`EntityKey\`

### policies

> \`readonly\` **policies**: (\`policyType\`) => \`EntityKey\`

The policy list for one policy type, e.g. \`ACCESS_POLICY\`.

#### Parameters

##### policyType

\`string\`

#### Returns

\`EntityKey\`

### userSchema

> \`readonly\` **userSchema**: (\`oktaOrigin?\`) => \`EntityKey\`

The org's user-profile schema — every base and custom attribute definition
from \`GET /api/v1/meta/schemas/user/default\`. Org-wide, so scoped by origin.
Held at TTL\\_LONG: schema changes are rare and every user detail view
reads it.

#### Parameters

##### oktaOrigin?

\`string\` \\| \`null\`

#### Returns

\`EntityKey\`

### appGroups

> \`readonly\` **appGroups**: (\`appId\`) => \`EntityKey\`

The ids of every group assigned to one application. Separate from
cacheKeys.appAssignmentCounts because the payloads differ, though both
come from a walk of \`/api/v1/apps/{id}/groups\`. Held at TTL\\_LONG: it
costs a full pagination walk per app and app-group assignments change rarely.

#### Parameters

##### appId

\`string\`

#### Returns

\`EntityKey\`

### groupName

> \`readonly\` **groupName**: (\`groupId\`) => \`EntityKey\`

One group's display name, resolved by id — the backstop behind
\`useGroupNameResolver\` for the groups the org snapshot has not walked. Held at
TTL\\_LONG: a group name changes rarely, and the entry exists to make
the fallback fetch happen once rather than once per surface.

#### Parameters

##### groupId

\`string\`

#### Returns

\`EntityKey\`

### userApps

> \`readonly\` **userApps**: (\`userId\`) => \`EntityKey\`

One user's application assignments, as \`userOperations.getUserApps\` reports
them. The cached value is the whole UserAppsResult, not just its rows:
a partial walk is a different fact from a short list, and caching only the
array would drop the incompleteness on the first cache hit.

#### Parameters

##### userId

\`string\`

#### Returns

\`EntityKey\`

### userDetails

> \`readonly\` **userDetails**: (\`userId\`) => \`EntityKey\`

One user's full \`OktaUser\` object, as the Overview rung loads it. A profile
save publishes the user Okta returned straight into this entry, so the rung
re-renders with the new values and spends no request. Not used by the Users
tab, which holds its selected user in React state.

#### Parameters

##### userId

\`string\`

#### Returns

\`EntityKey\`

### mfaScan

> \`readonly\` **mfaScan**: (\`groupId\`) => \`EntityKey\`

One group's cached MFA-enrollment scan (\`Map<userId, MemberMfaResult>\`), so
navigating away and back does not rescan (one API call per member). Written by
\`useMemberMfaScan\`; invalidated by "Remove Deprovisioned", since a membership
change can make a cached scan describe users no longer in the group.

#### Parameters

##### groupId

\`string\`

#### Returns

\`EntityKey\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/memberSourceCache / memberSourceKey

# Function: memberSourceKey()

> **memberSourceKey**(\`groupId\`): \`EntityKey\`

Defined in: [src/sidepanel/cache/memberSourceCache.ts:36](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/memberSourceCache.ts#L36)

The entity-cache key a group's breakdown is stored under.

## Parameters

### groupId

\`string\`

## Returns

\`EntityKey\`

A composite key, so \`invalidate(['memberSource'])\` drops them all.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/memberSourceCache / readMemberSource

# Function: readMemberSource()

> **readMemberSource**(\`groupId\`): \`MemberSourceBreakdown\` \\| \`null\`

Defined in: [src/sidepanel/cache/memberSourceCache.ts:45](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/memberSourceCache.ts#L45)

Read a group's already-computed member-source breakdown. Never fetches.

## Parameters

### groupId

\`string\`

## Returns

\`MemberSourceBreakdown\` \\| \`null\`

The breakdown, or \`null\` on a miss or past MEMBER\\_SOURCE\\_TTL.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/memberSourceCache / subscribeMemberSource

# Function: subscribeMemberSource()

> **subscribeMemberSource**(\`groupId\`, \`callback\`): () => \`void\`

Defined in: [src/sidepanel/cache/memberSourceCache.ts:59](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/memberSourceCache.ts#L59)

Subscribe to writes and invalidations of one group's breakdown.

## Parameters

### groupId

\`string\`

### callback

() => \`void\`

## Returns

An unsubscribe function.

() => \`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/memberSourceCache / writeMemberSource

# Function: writeMemberSource()

> **writeMemberSource**(\`groupId\`, \`breakdown\`): \`void\`

Defined in: [src/sidepanel/cache/memberSourceCache.ts:50](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/memberSourceCache.ts#L50)

Bank a freshly computed breakdown for a group and notify every reader.

## Parameters

### groupId

\`string\`

### breakdown

\`MemberSourceBreakdown\`

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/memberSourceCache / MEMBER\\_SOURCE\\_TTL

# Variable: MEMBER\\_SOURCE\\_TTL

> \`const\` **MEMBER\\_SOURCE\\_TTL**: \`number\` = \`TTL_LONG\`

Defined in: [src/sidepanel/cache/memberSourceCache.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/memberSourceCache.ts#L29)

How long a computed breakdown stays presentable. Longer than the cache default
because the analysis is expensive and a split does not churn minute to minute.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/rungInvalidation / invalidateGroupDetail

# Function: invalidateGroupDetail()

> **invalidateGroupDetail**(\`groupId\`): \`void\`

Defined in: [src/sidepanel/cache/rungInvalidation.ts:25](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/rungInvalidation.ts#L25)

Drop every cache entry the group detail rung reads, and nothing else.

- \`groupMembers/{id}\` — the roster; \`registerDerived\` cascades this to
  \`memberSource/{id}\`, so the breakdown cannot outlive the list it summarises.
- \`mfaScan/{id}\` — the enrollment scan, which left standing would describe
  members who may no longer be in the group.

Not dropped: the org-wide rule inventory and the app inventory. Both are
org-scoped and cost a full walk, and neither is a fact about this group.

## Parameters

### groupId

\`string\`

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/useEntityQuery / useEntityQuery

# Function: useEntityQuery()

> **useEntityQuery**\\<\`T\`\\>(\`key\`, \`fetcher\`, \`options?\`): \`UseEntityQueryResult\`\\<\`T\`\\>

Defined in: [src/sidepanel/cache/useEntityQuery.ts:56](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useEntityQuery.ts#L56)

Cache-backed data fetching keyed by an EntityKey.

On mount or key change: a fresh cache hit is served with no fetch; a stale hit
is shown immediately while a background revalidation runs; a miss triggers a
fetch. The \`fetcher\` may be an inline closure — it is read through a ref, so
only the key (and \`enabled\`/\`ttl\`) drive refetching.

## Type Parameters

### T

\`T\`

## Parameters

### key

\`EntityKey\`

### fetcher

() => \`Promise\`\\<\`T\`\\>

### options?

\`UseEntityQueryOptions\` = \`{}\`

## Returns

\`UseEntityQueryResult\`\\<\`T\`\\>


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/useEntityQuery / UseEntityQueryOptions

# Interface: UseEntityQueryOptions

Defined in: [src/sidepanel/cache/useEntityQuery.ts:22](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useEntityQuery.ts#L22)

Options for useEntityQuery.

## Properties

### ttl?

> \`optional\` **ttl?**: \`number\`

Defined in: [src/sidepanel/cache/useEntityQuery.ts:24](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useEntityQuery.ts#L24)

Entry lifetime in milliseconds (default: cache default of 5 minutes).

***

### enabled?

> \`optional\` **enabled?**: \`boolean\`

Defined in: [src/sidepanel/cache/useEntityQuery.ts:31](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useEntityQuery.ts#L31)

When \`false\`, no fetch is issued. Cached data for the **current** key is
still served, and \`data\` still tracks the key — a key change while disabled
re-reads the cache rather than leaving the previous key's value in place.
Defaults to \`true\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/useEntityQuery / UseEntityQueryResult

# Interface: UseEntityQueryResult\\<T\\>

Defined in: [src/sidepanel/cache/useEntityQuery.ts:35](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useEntityQuery.ts#L35)

Result of useEntityQuery.

## Type Parameters

### T

\`T\`

## Properties

### data

> **data**: \`T\` \\| \`null\`

Defined in: [src/sidepanel/cache/useEntityQuery.ts:37](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useEntityQuery.ts#L37)

The cached/fetched value, or \`null\` before the first successful load.

***

### isLoading

> **isLoading**: \`boolean\`

Defined in: [src/sidepanel/cache/useEntityQuery.ts:39](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useEntityQuery.ts#L39)

\`true\` while a fetch is in flight with no data yet to show.

***

### error

> **error**: \`string\` \\| \`null\`

Defined in: [src/sidepanel/cache/useEntityQuery.ts:41](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useEntityQuery.ts#L41)

Error message from the last failed fetch, or \`null\`.

***

### isStale

> **isStale**: \`boolean\`

Defined in: [src/sidepanel/cache/useEntityQuery.ts:43](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useEntityQuery.ts#L43)

\`true\` when showing cached data that has passed its TTL and is revalidating.

***

### refetch

> **refetch**: () => \`Promise\`\\<\`void\`\\>

Defined in: [src/sidepanel/cache/useEntityQuery.ts:45](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useEntityQuery.ts#L45)

Force a fresh fetch, bypassing the cache and any in-flight de-dup.

#### Returns

\`Promise\`\\<\`void\`\\>


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/useOrgSnapshot / useOrgSnapshot

# Function: useOrgSnapshot()

> **useOrgSnapshot**\\<\`T\`\\>(\`collection\`, \`origin\`, \`tabId\`, \`options?\`): \`UseOrgSnapshotResult\`\\<\`T\`\\>

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:87](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L87)

Read one collection of one org's snapshot, staying live as the background fills it.

## Type Parameters

### T

\`T\`

## Parameters

### collection

\`SnapshotCollection\`

### origin

\`string\` \\| \`null\` \\| \`undefined\`

Connected org origin; \`null\` before it resolves, which reads
nothing rather than reading some other org's rows.

### tabId

\`number\` \\| \`null\`

Live Okta tab the background routes requests through; \`null\`
disables syncing, since the background cannot fetch Okta without one.

### options?

\`UseOrgSnapshotOptions\` = \`{}\`

## Returns

\`UseOrgSnapshotResult\`\\<\`T\`\\>


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/useOrgSnapshot / UseOrgSnapshotOptions

# Interface: UseOrgSnapshotOptions

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:63](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L63)

Options for useOrgSnapshot.

## Properties

### enabled?

> \`optional\` **enabled?**: \`boolean\`

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:69](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L69)

When \`false\`, the hook still reads the store and tracks broadcasts, but
UseOrgSnapshotResult.sync is a no-op — a hidden tab must not drive
org-wide traffic nobody is looking at.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / sidepanel/cache/useOrgSnapshot / UseOrgSnapshotResult

# Interface: UseOrgSnapshotResult\\<T\\>

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:23](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L23)

What useOrgSnapshot exposes for one collection.

## Type Parameters

### T

\`T\`

## Properties

### rows

> **rows**: \`T\`[]

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:25](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L25)

The stored rows for this org and collection; \`[]\` before the first read.

***

### records

> **records**: \`SnapshotRecord\`\\<\`T\`\\>[]

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:32](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L32)

The same rows with their storage envelope, for \`appGroups\` — keyed
\`\${appId}::\${groupId}\`, because Okta returns only the group's id on an
assignment, so the owning app exists in the key alone. Every other caller
wants rows.

***

### isReading

> **isReading**: \`boolean\`

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:34](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L34)

\`true\` until the first IndexedDB read for the current org resolves.

***

### complete

> **complete**: \`boolean\`

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:36](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L36)

Whether the last walk for this collection finished.

***

### lastFullWalkAt

> **lastFullWalkAt**: \`number\` \\| \`null\`

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:38](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L38)

Epoch millis of the last completed full walk, or \`null\` when never.

***

### isSyncing

> **isSyncing**: \`boolean\`

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:40](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L40)

\`true\` while a sync requested from here is in flight.

***

### error

> **error**: \`string\` \\| \`null\`

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:42](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L42)

Message from the last failed sync, or \`null\`.

***

### status

> **status**: \`number\` \\| \`null\`

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:49](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L49)

HTTP status of this collection's most recent sync attempt; \`null\` when it
succeeded or reported no status. Read back from the store rather than held as
request-local state, so a collection whose own \`sync\` was never called still
picks up its status from the background's write (D-068).

***

### sync

> **sync**: (\`force?\`) => \`Promise\`\\<\`string\` \\| \`null\`\\>

Defined in: [src/sidepanel/cache/useOrgSnapshot.ts:59](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/sidepanel/cache/useOrgSnapshot.ts#L59)

Ask the background to sync this org.

#### Parameters

##### force?

\`boolean\`

Skip the cheap delta/drift modes and walk the org in full;
what a user-pressed Refresh means.

#### Returns

\`Promise\`\\<\`string\` \\| \`null\`\\>

The failure message, or \`null\` on success. Returned as well as held
in UseOrgSnapshotResult.error because a caller awaiting the sync
cannot read the post-settle state value.`;function s(e){return n.jsxs(n.Fragment,{children:[`
`,n.jsx(a,{title:"Internals/Storage & cache"}),`
`,n.jsx(o,{children:i})]})}function l(e={}){const{wrapper:t}={...r(),...e.components};return t?n.jsx(t,{...e,children:n.jsx(s,{...e})}):s()}export{l as default};
