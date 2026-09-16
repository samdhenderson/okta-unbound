import{j as n}from"./iframe-tAvKsVeF.js";import{u as a,M as r,c as o}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const d=`# Background service worker



---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/rateLimitThreshold / ensureRateLimitThreshold

# Function: ensureRateLimitThreshold()

> **ensureRateLimitThreshold**(\`scheduler\`, \`tabId\`): \`void\`

Defined in: [src/background/rateLimitThreshold.ts:129](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/rateLimitThreshold.ts#L129)

Make sure the scheduler is using this org's threshold, probing for it once.

Safe to call on every inbound request: a memoised org re-applies its stored
value, and an in-flight probe is joined rather than duplicated. Never awaited
and never allowed to reject — a request must not be failed by an optional
refinement of the backoff policy.

## Parameters

### scheduler

\`ApiScheduler\`

### tabId

\`number\`

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/rateLimitThreshold / resetRateLimitThresholdMemo

# Function: resetRateLimitThresholdMemo()

> **resetRateLimitThresholdMemo**(): \`void\`

Defined in: [src/background/rateLimitThreshold.ts:156](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/rateLimitThreshold.ts#L156)

Forget every memoised threshold. Test seam only — \`chrome.storage.session\` is
per browser session, so production never needs this.

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/reinjectContentScripts / reinjectContentScripts

# Function: reinjectContentScripts()

> **reinjectContentScripts**(): \`Promise\`\\<\`void\`\\>

Defined in: [src/background/reinjectContentScripts.ts:26](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/reinjectContentScripts.ts#L26)

Re-inject every manifest-declared content script into the open tabs it matches.

Per-tab failures are non-fatal: a discarded or mid-navigation tab is skipped
without affecting the others, and no matching tabs is a clean no-op. Only tab
ids and outcomes are logged, never URLs or page content.

## Returns

\`Promise\`\\<\`void\`\\>

Resolves once every matched tab has been attempted.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotBridge / createSchedulerPageRequest

# Function: createSchedulerPageRequest()

> **createSchedulerPageRequest**(\`scheduler\`, \`tabId\`): \`PageRequest\`

Defined in: [src/background/snapshotBridge.ts:78](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotBridge.ts#L78)

Build a scheduler-routed page transport bound to one Okta tab.

## Parameters

### scheduler

\`ApiScheduler\`

### tabId

\`number\`

## Returns

\`PageRequest\`

A PageRequest issuing \`GET\`s at \`low\` priority.

## Remarks

A rejected schedule becomes a \`success: false\` result rather than
throwing, so the walk records an incomplete page and keeps its resume cursor.
Both arms relay the response headers and \`RequestResult.status\` (D-068), so a
caller can tell a 401/403 from a 429 or a dropped connection; a rejected
schedule has no HTTP status and reports \`status\` absent.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotBridge / syncSnapshot

# Function: syncSnapshot()

> **syncSnapshot**(\`scheduler\`, \`origin\`, \`tabId\`, \`now?\`, \`force?\`): \`Promise\`\\<\`WalkOutcome\`[]\\>

Defined in: [src/background/snapshotBridge.ts:111](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotBridge.ts#L111)

Fill one org's snapshot, joining an existing run rather than duplicating it.

## Parameters

### scheduler

\`ApiScheduler\`

### origin

\`string\`

### tabId

\`number\`

### now?

\`number\` = \`...\`

Epoch millis; injected so the walk's mark stays testable.

### force?

\`boolean\` = \`false\`

Skip the cheap modes; what the Refresh button means.

## Returns

\`Promise\`\\<\`WalkOutcome\`[]\\>

One WalkOutcome per collection.

## Throws

Error when \`tabId\` is not on \`origin\` — see tabIsOnOrigin. A
rejection rather than a no-op, so the caller is never told a walk succeeded.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotBridge / SnapshotUpdatedMessage

# Interface: SnapshotUpdatedMessage

Defined in: [src/background/snapshotBridge.ts:26](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotBridge.ts#L26)

Broadcast telling the side panel a collection grew. Carries counts only —
never rows, which are read back from IndexedDB by the panel itself.

## Properties

### action

> **action**: \`"snapshotUpdated"\`

Defined in: [src/background/snapshotBridge.ts:27](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotBridge.ts#L27)

***

### origin

> **origin**: \`string\`

Defined in: [src/background/snapshotBridge.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotBridge.ts#L29)

Org the rows belong to; the panel ignores broadcasts for another org.

***

### collection

> **collection**: \`SnapshotCollection\`

Defined in: [src/background/snapshotBridge.ts:31](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotBridge.ts#L31)

Which collection changed.

***

### loaded

> **loaded**: \`number\`

Defined in: [src/background/snapshotBridge.ts:33](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotBridge.ts#L33)

Rows written so far in this walk.

***

### complete

> **complete**: \`boolean\`

Defined in: [src/background/snapshotBridge.ts:35](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotBridge.ts#L35)

Whether the walk has finished.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotScheduler / createSnapshotScheduler

# Function: createSnapshotScheduler()

> **createSnapshotScheduler**(\`deps\`): \`SnapshotSchedulerHandlers\`

Defined in: [src/background/snapshotScheduler.ts:71](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L71)

Build the trigger policy.

## Parameters

### deps

\`SnapshotSchedulerDeps\`

## Returns

\`SnapshotSchedulerHandlers\`

Handlers to register, kept separate from registration so a test can
drive them directly.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotScheduler / startSnapshotScheduler

# Function: startSnapshotScheduler()

> **startSnapshotScheduler**(\`scheduler\`): \`void\`

Defined in: [src/background/snapshotScheduler.ts:152](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L152)

Register the trigger policy against the real Chrome surfaces.

## Parameters

### scheduler

\`ApiScheduler\`

## Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotScheduler / SnapshotSchedulerDeps

# Interface: SnapshotSchedulerDeps

Defined in: [src/background/snapshotScheduler.ts:42](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L42)

Injected seams, so the policy is testable without Chrome timers.

## Properties

### scheduler

> **scheduler**: \`ApiScheduler\`

Defined in: [src/background/snapshotScheduler.ts:44](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L44)

The background scheduler every request is routed through.

***

### sync?

> \`optional\` **sync?**: (\`scheduler\`, \`origin\`, \`tabId\`, \`now\`, \`force\`) => \`Promise\`\\<\`WalkOutcome\`[]\\>

Defined in: [src/background/snapshotScheduler.ts:46](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L46)

Overridden in tests; defaults to the real bridge.

Fill one org's snapshot, joining an existing run rather than duplicating it.

#### Parameters

##### scheduler

\`ApiScheduler\`

##### origin

\`string\`

##### tabId

\`number\`

##### now?

\`number\` = \`...\`

Epoch millis; injected so the walk's mark stays testable.

##### force?

\`boolean\` = \`false\`

Skip the cheap modes; what the Refresh button means.

#### Returns

\`Promise\`\\<\`WalkOutcome\`[]\\>

One WalkOutcome per collection.

#### Throws

Error when \`tabId\` is not on \`origin\` — see tabIsOnOrigin. A
rejection rather than a no-op, so the caller is never told a walk succeeded.

***

### now?

> \`optional\` **now?**: () => \`number\`

Defined in: [src/background/snapshotScheduler.ts:48](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L48)

Overridden in tests; defaults to \`Date.now\`.

#### Returns

\`number\`

***

### debounceMs?

> \`optional\` **debounceMs?**: \`number\`

Defined in: [src/background/snapshotScheduler.ts:50](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L50)

Debounce window; overridden in tests to keep them fast.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotScheduler / SnapshotSchedulerHandlers

# Interface: SnapshotSchedulerHandlers

Defined in: [src/background/snapshotScheduler.ts:54](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L54)

What createSnapshotScheduler exposes.

## Properties

### onTabUpdated

> **onTabUpdated**: (\`tabId\`, \`changeInfo\`, \`tab\`) => \`void\`

Defined in: [src/background/snapshotScheduler.ts:56](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L56)

\`chrome.tabs.onUpdated\` handler.

#### Parameters

##### tabId

\`number\`

##### changeInfo

\`OnUpdatedInfo\`

##### tab

\`Tab\`

#### Returns

\`void\`

***

### onAlarm

> **onAlarm**: (\`alarm\`) => \`Promise\`\\<\`void\`\\>

Defined in: [src/background/snapshotScheduler.ts:62](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L62)

\`chrome.alarms.onAlarm\` handler.

#### Parameters

##### alarm

\`Alarm\`

#### Returns

\`Promise\`\\<\`void\`\\>


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotScheduler / MIN\\_ATTEMPT\\_INTERVAL\\_MS

# Variable: MIN\\_ATTEMPT\\_INTERVAL\\_MS

> \`const\` **MIN\\_ATTEMPT\\_INTERVAL\\_MS**: \`60000\` = \`60_000\`

Defined in: [src/background/snapshotScheduler.ts:36](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L36)

The floor between two attempts for the same org; without it every admin-console
page view would resolve to a delta and cost a request.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotScheduler / SNAPSHOT\\_ALARM\\_PERIOD\\_MINUTES

# Variable: SNAPSHOT\\_ALARM\\_PERIOD\\_MINUTES

> \`const\` **SNAPSHOT\\_ALARM\\_PERIOD\\_MINUTES**: \`15\` = \`15\`

Defined in: [src/background/snapshotScheduler.ts:39](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L39)

How often the alarm re-arms; matches the drift-check cadence.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotScheduler / SNAPSHOT\\_SYNC\\_ALARM

# Variable: SNAPSHOT\\_SYNC\\_ALARM

> \`const\` **SNAPSHOT\\_SYNC\\_ALARM**: \`"snapshotSync"\` = \`'snapshotSync'\`

Defined in: [src/background/snapshotScheduler.ts:24](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L24)

Periodic alarm that re-arms an attempt for any open Okta tab.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/snapshotScheduler / TAB\\_SETTLE\\_DEBOUNCE\\_MS

# Variable: TAB\\_SETTLE\\_DEBOUNCE\\_MS

> \`const\` **TAB\\_SETTLE\\_DEBOUNCE\\_MS**: \`3000\` = \`3_000\`

Defined in: [src/background/snapshotScheduler.ts:30](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/snapshotScheduler.ts#L30)

How long an Okta tab must sit still before an attempt is made; one navigation
fires several \`onUpdated\` events, and waiting collapses them into one attempt.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/throttledRelay / createThrottledRelay

# Function: createThrottledRelay()

> **createThrottledRelay**\\<\`T\`\\>(\`send\`, \`options?\`): (\`value\`) => \`void\`

Defined in: [src/background/throttledRelay.ts:28](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/throttledRelay.ts#L28)

Build a throttled relay around \`send\`.

## Type Parameters

### T

\`T\`

## Parameters

### send

(\`value\`) => \`void\`

### options?

\`ThrottledRelayOptions\`\\<\`T\`\\> = \`{}\`

## Returns

A function accepting values to relay; safe to call at any frequency.

(\`value\`) => \`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / background/throttledRelay / ThrottledRelayOptions

# Interface: ThrottledRelayOptions\\<T\\>

Defined in: [src/background/throttledRelay.ts:11](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/throttledRelay.ts#L11)

Options for createThrottledRelay.

## Type Parameters

### T

\`T\`

## Properties

### intervalMs?

> \`optional\` **intervalMs?**: \`number\`

Defined in: [src/background/throttledRelay.ts:13](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/throttledRelay.ts#L13)

Throttle window in milliseconds. Defaults to 150.

***

### isUrgent?

> \`optional\` **isUrgent?**: (\`previous\`, \`next\`) => \`boolean\`

Defined in: [src/background/throttledRelay.ts:18](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/background/throttledRelay.ts#L18)

Marks \`next\` as urgent relative to \`previous\` (the last value actually sent);
urgent values flush immediately even mid-window.

#### Parameters

##### previous

\`T\`

##### next

\`T\`

#### Returns

\`boolean\``;function s(e){return n.jsxs(n.Fragment,{children:[`
`,n.jsx(r,{title:"Internals/Background service worker"}),`
`,n.jsx(o,{children:d})]})}function u(e={}){const{wrapper:t}={...a(),...e.components};return t?n.jsx(t,{...e,children:n.jsx(s,{...e})}):s()}export{u as default};
