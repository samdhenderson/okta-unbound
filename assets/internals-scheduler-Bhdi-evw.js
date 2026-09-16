import{j as n}from"./iframe-tAvKsVeF.js";import{u as r,M as a,c as d}from"./blocks-CxSch1eI.js";import"./preload-helper-PPVm8Dsz.js";const i=`# Scheduler & messaging



---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/apiScheduler / ApiScheduler

# Class: ApiScheduler

Defined in: [src/shared/scheduler/apiScheduler.ts:100](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L100)

Priority queue and executor for Okta API requests. One instance is created in
the background worker; the processing loop starts in the constructor.

## Constructors

### Constructor

> **new ApiScheduler**(\`config?\`): \`ApiScheduler\`

Defined in: [src/shared/scheduler/apiScheduler.ts:189](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L189)

#### Parameters

##### config?

\`Partial\`\\<\`SchedulerConfig\`\\> = \`{}\`

Partial overrides merged over \`DEFAULT_CONFIG\`.

#### Returns

\`ApiScheduler\`

#### Throws

When \`maxConcurrentPerBucket\` is supplied and is not strictly
between zero and the effective \`maxConcurrent\` — a cap at or above the
global ceiling governs nothing.

## Properties

### queue

> \`private\` **queue**: \`QueuedRequest\`[] = \`[]\`

Defined in: [src/shared/scheduler/apiScheduler.ts:101](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L101)

***

### activeRequests

> \`private\` **activeRequests**: \`Map\`\\<\`string\`, \`QueuedRequest\`\\>

Defined in: [src/shared/scheduler/apiScheduler.ts:102](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L102)

***

### coalescableGets

> \`private\` **coalescableGets**: \`Map\`\\<\`string\`, \\{ \`request\`: \`QueuedRequest\`; \`waiters\`: \`object\`[]; \\}\\>

Defined in: [src/shared/scheduler/apiScheduler.ts:105](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L105)

***

### rateLimitDetector

> \`private\` **rateLimitDetector**: \`RateLimitDetector\`

Defined in: [src/shared/scheduler/apiScheduler.ts:112](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L112)

***

### plans

> \`private\` **plans**: \`PlanRegistry\`

Defined in: [src/shared/scheduler/apiScheduler.ts:118](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L118)

Declared-but-unspent work (\`shared/scheduler/plan\`). Advisory by
construction: nothing here gates a dispatch. It feeds the Activity Bar's
view of what an operation intends to spend.

***

### config

> \`private\` **config**: \`SchedulerConfig\`

Defined in: [src/shared/scheduler/apiScheduler.ts:119](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L119)

***

### status

> \`private\` **status**: \`SchedulerStatus\` = \`'idle'\`

Defined in: [src/shared/scheduler/apiScheduler.ts:120](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L120)

***

### cooldowns

> \`private\` **cooldowns**: \`Map\`\\<\`string\`, \`number\`\\>

Defined in: [src/shared/scheduler/apiScheduler.ts:126](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L126)

When each armed gate lifts, keyed by rate-limit bucket, plus
GLOBAL\\_GATE — the most-restrictive-anywhere backstop that governs a
request whose own bucket Okta has not reported on (see gateKeyFor).

***

### rememberedBuckets

> \`private\` **rememberedBuckets**: \`Map\`\\<\`string\`, \\{ \`lastActiveAt\`: \`number\`; \\}\\>

Defined in: [src/shared/scheduler/apiScheduler.ts:136](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L136)

Buckets that have gone quiet but are still worth listing, holding only when
a request last settled there.

It retains the row's existence and nothing else — no budget number is kept
here, so a lapsed header reading can never be resurrected as a current one;
buildBucketStates reads every count and limit from the live
sources. Not persisted across a service-worker suspension.

***

### isPaused

> \`private\` **isPaused**: \`boolean\` = \`false\`

Defined in: [src/shared/scheduler/apiScheduler.ts:137](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L137)

***

### processingInterval

> \`private\` **processingInterval**: \`Timeout\` \\| \`null\` = \`null\`

Defined in: [src/shared/scheduler/apiScheduler.ts:138](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L138)

***

### isProcessing

> \`private\` **isProcessing**: \`boolean\` = \`false\`

Defined in: [src/shared/scheduler/apiScheduler.ts:143](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L143)

***

### reprocessRequested

> \`private\` **reprocessRequested**: \`boolean\` = \`false\`

Defined in: [src/shared/scheduler/apiScheduler.ts:144](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L144)

***

### cancelGeneration

> \`private\` **cancelGeneration**: \`number\` = \`0\`

Defined in: [src/shared/scheduler/apiScheduler.ts:148](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L148)

***

### cancelledPlans

> \`private\` **cancelledPlans**: \`string\`[] = \`[]\`

Defined in: [src/shared/scheduler/apiScheduler.ts:155](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L155)

***

### expiredSessions

> \`private\` **expiredSessions**: \`Map\`\\<\`number\`, \`RequestFailure\`\\>

Defined in: [src/shared/scheduler/apiScheduler.ts:164](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L164)

Tabs whose Okta session the scheduler has watched expire, each holding the
401 failure that proved it (\`D-007b\`).

Keyed by tab because a tab holds one origin's session: an admin with two
orgs open has not lost both because one expired.

***

### metrics

> \`private\` **metrics**: \`SchedulerMetrics\`

Defined in: [src/shared/scheduler/apiScheduler.ts:167](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L167)

***

### lastError

> \`private\` **lastError**: \`string\` \\| \`null\` = \`null\`

Defined in: [src/shared/scheduler/apiScheduler.ts:180](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L180)

***

### stateListeners

> \`private\` **stateListeners**: \`Set\`\\<(\`state\`) => \`void\`\\>

Defined in: [src/shared/scheduler/apiScheduler.ts:181](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L181)

## Methods

### scheduleRequest()

> **scheduleRequest**(\`endpoint\`, \`method\`, \`body\`, \`tabId\`, \`priority?\`, \`reason?\`, \`planId?\`): \`Promise\`\\<\`RequestResult\`\\>

Defined in: [src/shared/scheduler/apiScheduler.ts:237](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L237)

Enqueue an API request and resolve when it completes (or rejects after
retries are exhausted).

#### Parameters

##### endpoint

\`string\`

Okta path (may include query string).

##### method

\`string\`

HTTP method.

##### body

\`unknown\`

Optional request body (ignored for GET).

##### tabId

\`number\`

Tab whose content script executes the fetch.

##### priority?

\`RequestPriority\` = \`'normal'\`

Queue priority; higher runs first.

##### reason?

\`string\`

Human-readable "why", recorded to the verbose request
audit log (recordRequest) when the request settles. Omit only when
there is genuinely no caller-facing label; it falls back to a generic one.

##### planId?

\`string\`

#### Returns

\`Promise\`\\<\`RequestResult\`\\>

The RequestResult once the request settles.

***

### getGetDedupKey()

> \`private\` **getGetDedupKey**(\`method\`, \`endpoint\`, \`tabId\`): \`string\` \\| \`null\`

Defined in: [src/shared/scheduler/apiScheduler.ts:338](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L338)

Coalescing key for an idempotent GET, or \`null\` for mutations. Includes the
full endpoint so query strings stay distinct, and the tabId so identical
paths against different orgs never share one response.

#### Parameters

##### method

\`string\`

##### endpoint

\`string\`

##### tabId

\`number\`

#### Returns

\`string\` \\| \`null\`

***

### addToQueue()

> \`private\` **addToQueue**(\`request\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:343](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L343)

Insert into the queue in priority order (interactive > high > normal > low).

#### Parameters

##### request

\`QueuedRequest\`

#### Returns

\`void\`

***

### startProcessing()

> \`private\` **startProcessing**(): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:359](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L359)

Start the fallback processing loop, if it is not already running.

#### Returns

\`void\`

***

### stopProcessing()

> \`private\` **stopProcessing**(): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:376](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L376)

Stop the fallback interval. Called when the scheduler goes fully idle so an
MV3 service worker is not kept alive by an empty 50ms loop;
scheduleRequest restarts it.

#### Returns

\`void\`

***

### stop()

> **stop**(): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:385](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L385)

Stop the processing loop.

#### Returns

\`void\`

***

### processQueue()

> \`private\` **processQueue**(): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:395](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L395)

Drain the queue, filling every free \`maxConcurrent\` slot in one pass.
Invoked on schedule and on settle, with the 50ms interval as a fallback;
the re-entrancy guard makes a concurrent invocation loop the running drain
once more instead of double-dispatching.

#### Returns

\`void\`

***

### isGated()

> \`private\` **isGated**(\`key\`): \`boolean\`

Defined in: [src/shared/scheduler/apiScheduler.ts:417](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L417)

Is a gate armed right now? Expired entries are dropped as they are found,
so this doubles as the cooldown reaper.

#### Parameters

##### key

\`string\`

A bucket key, or GLOBAL\\_GATE.

#### Returns

\`boolean\`

***

### anyGateArmed()

> \`private\` **anyGateArmed**(): \`boolean\`

Defined in: [src/shared/scheduler/apiScheduler.ts:429](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L429)

Whether any gate at all is armed (drops expired entries on the way).

#### Returns

\`boolean\`

***

### gateKeyFor()

> \`private\` **gateKeyFor**(\`request\`): \`object\`

Defined in: [src/shared/scheduler/apiScheduler.ts:445](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L445)

Which gate governs this request, and whether Okta has actually reported on
the bucket it belongs to.

An observed bucket answers for itself. An unobserved one falls back to the
most-restrictive observation anywhere, since it has no budget of its own to
plead.

#### Parameters

##### request

\`QueuedRequest\`

#### Returns

\`object\`

##### key

> **key**: \`string\`

##### observed

> **observed**: \`boolean\`

***

### activeInBucket()

> \`private\` **activeInBucket**(\`bucket\`, \`excludeId?\`): \`number\`

Defined in: [src/shared/scheduler/apiScheduler.ts:459](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L459)

How many in-flight requests belong to a bucket right now.

#### Parameters

##### bucket

\`string\`

A bucket key from \`bucketOf\`.

##### excludeId?

\`string\`

A request to leave out of the count. Used by
shouldEnterCooldown, where the settling request is still listed as
active but its spend is already in the header being judged.

#### Returns

\`number\`

***

### gateFor()

> \`private\` **gateFor**(\`request\`): \`"cooldown"\` \\| \`"go"\` \\| \`"gated"\`

Defined in: [src/shared/scheduler/apiScheduler.ts:480](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L480)

May this request dispatch right now?

An \`interactive\` request may jump the soft gate, but only while the budget
governing it has hard headroom left, so it can never force a 429 (see
RequestPriority). It does not jump the per-bucket concurrency cap.

#### Parameters

##### request

\`QueuedRequest\`

A queued candidate.

#### Returns

\`"cooldown"\` \\| \`"go"\` \\| \`"gated"\`

\`'go'\` to dispatch, \`'gated'\` to skip it and try the next queued
request, or \`'cooldown'\` when the soft threshold has just been crossed and
the caller must arm this request's gate.

***

### drainQueue()

> \`private\` **drainQueue**(): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:531](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L531)

One drain pass: dispatch queued requests until the concurrency cap, an
empty queue, or every remaining request being gated stops it. Every gate is
re-evaluated per dispatch, so a multi-dispatch drain can never overshoot
what a single-dispatch tick would allow.

A gated request at the head does not end the pass: the queue is scanned in
priority order and the first dispatchable request wins. A request is only
skipped when its own bucket says no — either an armed gate or the bucket
sitting at \`maxConcurrentPerBucket\`.

#### Returns

\`void\`

***

### executeRequest()

> \`private\` **executeRequest**(\`request\`): \`Promise\`\\<\`void\`\\>

Defined in: [src/shared/scheduler/apiScheduler.ts:588](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L588)

Execute a single request, handling rate-limit headers, retries and settle.

#### Parameters

##### request

\`QueuedRequest\`

#### Returns

\`Promise\`\\<\`void\`\\>

***

### observeSessionHealth()

> \`private\` **observeSessionHealth**(\`request\`, \`result\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:685](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L685)

Read one settled result for what it says about the tab's Okta session, and
suspend or resume accordingly (\`D-007b\`).

Only two results are evidence: a 401 (the one status \`isSessionExpired\`
recognises) means the session is gone, and any success means it is back. A
403 or 404 says nothing about credentials and lifts nothing.

#### Parameters

##### request

\`QueuedRequest\`

##### result

\`RequestResult\`

#### Returns

\`void\`

***

### suspendSession()

> \`private\` **suspendSession**(\`tabId\`, \`failure\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:704](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L704)

Stop spending the queue on a session that cannot serve it.

Everything already queued for the tab settles immediately with the same
failure, without being sent. In-flight requests are left to land, since one
may already have reached Okta. Nothing is remembered for replay: re-issuing
writes after a re-authentication would re-run an abandoned operation.

#### Parameters

##### tabId

\`number\`

The tab whose session ended.

##### failure

\`RequestFailure\`

The 401 that proved it.

#### Returns

\`void\`

***

### resumeSession()

> \`private\` **resumeSession**(\`tabId\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:735](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L735)

Lift a suspension because a request for that tab succeeded.

The whole recovery path, and it clears on evidence, never on a timer —
nothing polls a dead session. The evidence arrives via the one probe per
round that canProbe still lets through.

#### Parameters

##### tabId

\`number\`

#### Returns

\`void\`

***

### sessionExpiredFailure()

> \`private\` **sessionExpiredFailure**(\`observed\`): \`RequestFailure\`

Defined in: [src/shared/scheduler/apiScheduler.ts:753](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L753)

A fresh failure meaning "this never went out, because the session is gone".

Not the observed 401 itself: that object carries one particular response's
\`data\` and \`headers\`, and handing an unvalidated Okta payload to a caller
that made a different request would describe someone else's request. Only
the status carries over, so \`isSessionExpired\` stays the single definition.

#### Parameters

##### observed

\`RequestFailure\`

The 401 that proved the session had ended.

#### Returns

\`RequestFailure\`

***

### canProbe()

> \`private\` **canProbe**(\`tabId\`): \`boolean\`

Defined in: [src/shared/scheduler/apiScheduler.ts:766](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L766)

May a request for a suspended tab go out as the probe that would end the
suspension?

At most one at a time: with nothing queued and nothing in flight for the
tab, the next request becomes the probe; while it is outstanding, every
other request for that tab settles against the known 401. That bounds a
suspended session to one request per round while leaving a way back.

#### Parameters

##### tabId

\`number\`

#### Returns

\`boolean\`

***

### recordSettledRequest()

> \`private\` **recordSettledRequest**(\`request\`, \`success\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:779](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L779)

Fold a finally-settled request (success, or final failure after retries)
into the verbose request audit log. Not called for a coalesced GET's
joined waiters (only the leader that actually hit the network), and not
called for a mid-flight retry — only the terminal outcome.

#### Parameters

##### request

\`QueuedRequest\`

##### success

\`boolean\`

#### Returns

\`void\`

***

### makeApiCall()

> \`private\` **makeApiCall**(\`request\`): \`Promise\`\\<\`RequestResult\`\\>

Defined in: [src/shared/scheduler/apiScheduler.ts:800](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L800)

Dispatch the request to the tab's content script, with a timeout.

#### Parameters

##### request

\`QueuedRequest\`

#### Returns

\`Promise\`\\<\`RequestResult\`\\>

***

### retryRequest()

> \`private\` **retryRequest**(\`request\`, \`_error\`): \`Promise\`\\<\`void\`\\>

Defined in: [src/shared/scheduler/apiScheduler.ts:828](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L828)

Re-queue a failed request at \`high\` priority after exponential backoff.

#### Parameters

##### request

\`QueuedRequest\`

##### \\_error

\`unknown\`

#### Returns

\`Promise\`\\<\`void\`\\>

***

### shouldEnterCooldown()

> \`private\` **shouldEnterCooldown**(\`info\`, \`settlingId\`): \`boolean\`

Defined in: [src/shared/scheduler/apiScheduler.ts:878](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L878)

Should this response's bucket cool down?

#### Parameters

##### info

\`RateLimitInfo\`

The observation just parsed off a response.

##### settlingId

\`string\`

The request that produced \`info\`.

#### Returns

\`boolean\`

#### Remarks

The verdict arms **\`info.bucket\`'s** gate, so the charge against
its budget is its own in-flight count and nothing else — the same rule
gateFor applies on the dispatch path. Charging the whole
\`activeRequests\` map would cool a quiet family for a busy one's fan-out.
\`settlingId\` is excluded because it is still listed as active here
(\`activeRequests\` is cleared further down \`executeRequest\`) while Okta had
already counted it when it wrote these headers.

The fallback charge is deliberately the opposite. A quota that is not a
positive number has no usable ratio, so \`percentRemaining\`
(\`shared/scheduler/rateLimitDetector\`) returns \`null\` and the question falls
through to the most-restrictive observation *anywhere* — never calm
(\`D-094\`). That is a different bucket, which has counted none of this
scheduler's in-flight work, so it takes the pessimistic whole-map charge,
exactly as \`gateFor\`'s global backstop does.

***

### enterCooldown()

> \`private\` **enterCooldown**(\`gate?\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:900](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L900)

Arm one gate.

#### Parameters

##### gate?

\`string\` = \`GLOBAL_GATE\`

The rate-limit bucket to hold back, or GLOBAL\\_GATE to
hold everything back. A bucket with a live observation is timed by **its**
reset; anything else falls back to the most restrictive observation
anywhere, and to the configured duration when there is none.

#### Returns

\`void\`

#### Remarks

The wait is \`min(configured, msUntilReset)\`, so a bad clock or a
far-future reset cannot stall the queue indefinitely. Re-arming an armed
gate extends it only if the new end is later.

***

### setMinRemainingThreshold()

> **setMinRemainingThreshold**(\`percent\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:942](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L942)

Set the percentage-remaining at or below which a bucket cools down.

Lets the background supply the org's own answer — \`GET
/api/v1/rate-limit-settings/warning-threshold\` less a margin, see
\`shared/scheduler/rateLimitSettings\`. Called at most once per org per
browser session; when the org does not answer,
\`DEFAULT_CONFIG.minRemainingThreshold\` stands. Takes effect on the next
gate evaluation; already-armed gates are left alone.

#### Parameters

##### percent

\`number\`

Percentage remaining, \`0\`–\`100\`. Out-of-range values are
ignored rather than clamped.

#### Returns

\`void\`

***

### pause()

> **pause**(): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:956](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L956)

Pause dispatch; queued requests stay queued.

#### Returns

\`void\`

***

### resume()

> **resume**(): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:963](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L963)

Resume dispatch and drain immediately.

#### Returns

\`void\`

***

### updateStatus()

> \`private\` **updateStatus**(\`status\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:973](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L973)

Set the status and, on a real transition, push it to subscribers.

#### Parameters

##### status

\`SchedulerStatus\`

#### Returns

\`void\`

***

### latestCooldownEnd()

> \`private\` **latestCooldownEnd**(): \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/apiScheduler.ts:990](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L990)

When the last armed gate lifts, or \`null\` when none is.

The latest end across every gate, not the earliest: \`cooldownEndsAt\` drives
the activity bar's countdown, which tells the reader when the scheduler is
unencumbered.

#### Returns

\`number\` \\| \`null\`

***

### getState()

> **getState**(): \`SchedulerState\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1001](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1001)

Snapshot of everything the panel renders about the scheduler.

#### Returns

\`SchedulerState\`

***

### isBucketQuiet()

> \`private\` **isBucketQuiet**(\`bucket\`): \`boolean\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1027](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1027)

Whether a bucket has nothing happening in it: no queued request, nothing in
flight, no plan expecting to spend there, and no armed gate.

The eviction guard for rememberedBuckets: a bucket with live work
or an armed gate is kept whatever its age or the map's size.

#### Parameters

##### bucket

\`string\`

A bucket key from \`bucketOf\`.

#### Returns

\`boolean\`

***

### rememberBucket()

> \`private\` **rememberBucket**(\`bucket\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1041](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1041)

Note that a request just settled in this bucket, and bring the memory back
inside both of its bounds.

#### Parameters

##### bucket

\`string\`

A bucket key from \`bucketOf\`.

#### Returns

\`void\`

***

### pruneRememberedBuckets()

> \`private\` **pruneRememberedBuckets**(): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1058](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1058)

Drop remembered buckets that are past BUCKET\\_MEMORY\\_MS, then — if
more than MAX\\_REMEMBERED\\_BUCKETS remain — the least recently active
ones until the count fits.

Neither bound can evict a bucket that is not isBucketQuiet. Run on
every write *and* every read, since age must expire a row even when nothing
is settling.

#### Returns

\`void\`

***

### buildBucketStates()

> \`private\` **buildBucketStates**(): \`BucketState\`[]

Defined in: [src/shared/scheduler/apiScheduler.ts:1091](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1091)

Every bucket currently worth showing, most-pressured first.

The union of five sources, each of which can know about a bucket the others
do not: Okta's observations, queued requests, in-flight requests, the legs
active plans have declared, and buckets remembered from a recent settle.

The remembered source contributes **only a bucket key** — every number is
read from the live sources, so a remembered-but-idle bucket reports true
zeros and a \`null\` budget. A memory must never pass for a reading.

Sorted by pressure: least headroom first, unranked buckets last.

#### Returns

\`BucketState\`[]

***

### declarePlan()

> **declarePlan**(\`declaration\`): \`boolean\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1142](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1142)

Declare an operation's request budget. Advisory: nothing is reserved and no
request is gated on it.

#### Parameters

##### declaration

\`PlanDeclaration\`

The plan and its legs.

#### Returns

\`boolean\`

Whether the plan is now tracked.

***

### refinePlan()

> **refinePlan**(\`planId\`, \`endpoint\`, \`estimate\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1153](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1153)

Update one leg's estimate mid-flight — how a paginating walk raises its
floor as \`Link\` headers promise more pages, and settles to an exact count
when the walk ends.

#### Parameters

##### planId

\`string\`

##### endpoint

\`string\`

##### estimate

\`PlanEstimate\`

#### Returns

\`void\`

***

### completePlan()

> **completePlan**(\`planId\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1160](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1160)

Close a plan normally.

#### Parameters

##### planId

\`string\`

#### Returns

\`void\`

***

### cancelPlan()

> **cancelPlan**(\`planId\`): \`number\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1174](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1174)

Cancel one operation: close its plan and drop **only** the queued requests
that declared themselves part of it. Narrower than clearQueue,
which drains everything. In-flight requests are left to settle — they have
already spent their budget.

#### Parameters

##### planId

\`string\`

#### Returns

\`number\`

How many queued requests were dropped.

***

### tombstone()

> \`private\` **tombstone**(\`planId\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1198](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1198)

Remember a cancelled plan id so requests still coming down its loop are
refused rather than queued. Bounded FIFO; ids are random per operation, so
an aged-out slot cannot refuse someone else's work.

#### Parameters

##### planId

\`string\`

#### Returns

\`void\`

***

### getMetrics()

> **getMetrics**(): \`SchedulerMetrics\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1207](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1207)

A copy of the current metrics.

#### Returns

\`SchedulerMetrics\`

***

### onStateChange()

> **onStateChange**(\`listener\`): () => \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1216](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1216)

Subscribe to scheduler state changes.

#### Parameters

##### listener

(\`state\`) => \`void\`

#### Returns

An unsubscribe function that removes the listener.

() => \`void\`

***

### notifyStateChange()

> \`private\` **notifyStateChange**(): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1222](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1222)

Push the current state to every listener; a throwing listener is logged.

#### Returns

\`void\`

***

### generateRequestId()

> \`private\` **generateRequestId**(): \`string\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1234](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1234)

Generate a unique request id.

#### Returns

\`string\`

***

### updateAverageExecutionTime()

> \`private\` **updateAverageExecutionTime**(\`executionTime\`): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1239](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1239)

Fold one execution time into the running average.

#### Parameters

##### executionTime

\`number\`

#### Returns

\`void\`

***

### getQueueDepth()

> **getQueueDepth**(): \`number\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1246](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1246)

Queued plus in-flight requests.

#### Returns

\`number\`

***

### clearQueue()

> **clearQueue**(): \`number\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1262](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1262)

Drop every queued request and reject its callers.

#### Returns

\`number\`

The number of requests dropped.

#### Remarks

The queue half of a user "Cancel". Each dropped request is
rejected with OperationCancelledError, not silently discarded, so
the operation loop awaiting it unwinds; a coalesced GET's leader fans the
error out to its waiters. In-flight requests are left to settle, and a
request sleeping in retry backoff rejects on wake via the
cancelGeneration bump. Cancelled requests are not retried and are
not counted as failures.

***

### resetMetrics()

> **resetMetrics**(): \`void\`

Defined in: [src/shared/scheduler/apiScheduler.ts:1285](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/apiScheduler.ts#L1285)

Zero every metric.

#### Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/cancellation / OperationCancelledError

# Class: OperationCancelledError

Defined in: [src/shared/scheduler/cancellation.ts:17](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/cancellation.ts#L17)

Error thrown when an operation (or a queued API request) is cancelled by the
user. Detect with \`err instanceof OperationCancelledError\` rather than matching
on the message.

## Extends

- \`Error\`

## Constructors

### Constructor

> **new OperationCancelledError**(\`message?\`): \`OperationCancelledError\`

Defined in: [src/shared/scheduler/cancellation.ts:19](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/cancellation.ts#L19)

#### Parameters

##### message?

\`string\` = \`'Operation cancelled'\`

Human-readable reason.

#### Returns

\`OperationCancelledError\`

#### Overrides

\`Error.constructor\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/cancellation / createCancellation

# Function: createCancellation()

> **createCancellation**(): \`CancellationToken\`

Defined in: [src/shared/scheduler/cancellation.ts:50](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/cancellation.ts#L50)

Create a fresh CancellationToken.

## Returns

\`CancellationToken\`

A token that starts un-cancelled.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/cancellation / CancellationToken

# Interface: CancellationToken

Defined in: [src/shared/scheduler/cancellation.ts:38](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/cancellation.ts#L38)

A mutable, pollable cancellation token.

## Properties

### isCancelled

> \`readonly\` **isCancelled**: \`boolean\`

Defined in: [src/shared/scheduler/cancellation.ts:39](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/cancellation.ts#L39)

Whether CancellationToken.cancel has been called
since the last CancellationToken.reset.

***

### cancel

> **cancel**: () => \`void\`

Defined in: [src/shared/scheduler/cancellation.ts:40](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/cancellation.ts#L40)

Trip the token; subsequent \`throwIfCancelled()\` calls throw.

#### Returns

\`void\`

***

### reset

> **reset**: () => \`void\`

Defined in: [src/shared/scheduler/cancellation.ts:41](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/cancellation.ts#L41)

Clear the flag so the token can drive the next operation.

#### Returns

\`void\`

***

### throwIfCancelled

> **throwIfCancelled**: () => \`void\`

Defined in: [src/shared/scheduler/cancellation.ts:42](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/cancellation.ts#L42)

Throw OperationCancelledError if cancelled;
call this between iterations of a long loop.

#### Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / PlanRegistry

# Class: PlanRegistry

Defined in: [src/shared/scheduler/plan.ts:155](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L155)

The scheduler's plan ledger.

Owned by a single \`ApiScheduler\`; not safe for concurrent mutation across
instances. Every mutator is total — an unknown plan id or leg id is a no-op
rather than a throw, because the declaring side is a separate process that
can always be one message behind (a \`refine\` arriving after a \`cancel\`, say).

## Constructors

### Constructor

> **new PlanRegistry**(\`bucketFor\`): \`PlanRegistry\`

Defined in: [src/shared/scheduler/plan.ts:165](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L165)

#### Parameters

##### bucketFor

(\`endpoint\`) => \`string\`

Maps an endpoint to its rate-limit bucket. Injected so
the registry holds no opinion about Okta's bucketing.

#### Returns

\`PlanRegistry\`

## Properties

### plans

> \`private\` **plans**: \`Map\`\\<\`string\`, \`OperationPlan\`\\>

Defined in: [src/shared/scheduler/plan.ts:156](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L156)

***

### touchedAt

> \`private\` **touchedAt**: \`Map\`\\<\`string\`, \`number\`\\>

Defined in: [src/shared/scheduler/plan.ts:158](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L158)

Last time each plan saw any activity, for reap.

***

### legSeq

> \`private\` **legSeq**: \`number\` = \`0\`

Defined in: [src/shared/scheduler/plan.ts:159](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L159)

***

### bucketFor

> \`private\` \`readonly\` **bucketFor**: (\`endpoint\`) => \`string\`

Defined in: [src/shared/scheduler/plan.ts:165](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L165)

Maps an endpoint to its rate-limit bucket. Injected so
the registry holds no opinion about Okta's bucketing.

#### Parameters

##### endpoint

\`string\`

#### Returns

\`string\`

## Methods

### declare()

> **declare**(\`declaration\`): \`OperationPlan\` \\| \`null\`

Defined in: [src/shared/scheduler/plan.ts:174](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L174)

Open a plan. Re-declaring an existing id is a no-op, so a retried message
cannot reset a plan's \`spent\` counters.

#### Parameters

##### declaration

\`PlanDeclaration\`

#### Returns

\`OperationPlan\` \\| \`null\`

The stored plan, or \`null\` when the declaration was rejected
(no legs, or the registry is at MAX\\_TRACKED\\_PLANS).

***

### refine()

> **refine**(\`planId\`, \`endpoint\`, \`estimate\`): \`void\`

Defined in: [src/shared/scheduler/plan.ts:222](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L222)

Update a leg's estimate mid-flight — how an \`atLeast\` grows as pages land
and settles to \`exact\` when the walk ends.

Only legs of an \`active\` plan can be refined. The leg is addressed by
bucket rather than id, because the pagination loop knows the URL it is
walking, not the id the registry minted in another process.

#### Parameters

##### planId

\`string\`

Plan to refine.

##### endpoint

\`string\`

Endpoint (or bucket key) identifying the leg.

##### estimate

\`PlanEstimate\`

The new estimate.

#### Returns

\`void\`

***

### attribute()

> **attribute**(\`planId\`, \`endpoint\`): \`void\`

Defined in: [src/shared/scheduler/plan.ts:249](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L249)

Charge one settled request against a plan.

Called from the scheduler's single settle path, so \`spent\` counts real
traffic and nothing else. A coalesced GET is charged once — to the leader —
because that is how many requests Okta actually saw.

The leg is chosen by bucket. A request whose bucket no leg declared is
still charged — an extra leg is appended with an \`unknown\` estimate, so an
under-declared operation shows up rather than losing requests. Bounded by
MAX\\_LEGS\\_PER\\_PLAN.

#### Parameters

##### planId

\`string\`

Plan the request declared itself part of.

##### endpoint

\`string\`

The endpoint that settled.

#### Returns

\`void\`

***

### complete()

> **complete**(\`planId\`): \`void\`

Defined in: [src/shared/scheduler/plan.ts:273](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L273)

Close a plan normally. Unknown ids are ignored.

#### Parameters

##### planId

\`string\`

#### Returns

\`void\`

***

### cancel()

> **cancel**(\`planId\`): \`void\`

Defined in: [src/shared/scheduler/plan.ts:278](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L278)

Close a plan because the user cancelled it. Unknown ids are ignored.

#### Parameters

##### planId

\`string\`

#### Returns

\`void\`

***

### settle()

> \`private\` **settle**(\`planId\`, \`status\`): \`void\`

Defined in: [src/shared/scheduler/plan.ts:282](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L282)

#### Parameters

##### planId

\`string\`

##### status

\`PlanStatus\`

#### Returns

\`void\`

***

### has()

> **has**(\`planId\`): \`boolean\`

Defined in: [src/shared/scheduler/plan.ts:292](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L292)

Whether a plan is currently tracked and active.

#### Parameters

##### planId

\`string\`

#### Returns

\`boolean\`

***

### plannedForBucket()

> **plannedForBucket**(\`bucket\`): \`number\`

Defined in: [src/shared/scheduler/plan.ts:301](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L301)

Requests still expected against one bucket, summed across every active
plan — the "planned" segment the Activity Bar draws beyond the queued one.
Legs with an \`unknown\` estimate contribute nothing.

#### Parameters

##### bucket

\`string\`

#### Returns

\`number\`

***

### plannedBuckets()

> **plannedBuckets**(): \`Set\`\\<\`string\`\\>

Defined in: [src/shared/scheduler/plan.ts:314](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L314)

Every bucket any active plan intends to spend against.

#### Returns

\`Set\`\\<\`string\`\\>

***

### summarize()

> **summarize**(): \`PlanSummary\`[]

Defined in: [src/shared/scheduler/plan.ts:327](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L327)

Active plans, flattened for the UI. Oldest first, so the bar's row order is
stable as plans come and go rather than reshuffling on every push.

#### Returns

\`PlanSummary\`[]

***

### reap()

> **reap**(\`now?\`): \`void\`

Defined in: [src/shared/scheduler/plan.ts:356](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L356)

Drop plans that have gone quiet for PLAN\\_STALE\\_MS — the ordinary
case being a side panel closed mid-operation, which never sends \`complete\`.

#### Parameters

##### now?

\`number\` = \`...\`

#### Returns

\`void\`

***

### reset()

> **reset**(): \`void\`

Defined in: [src/shared/scheduler/plan.ts:367](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L367)

Forget everything. Used by the scheduler's own reset paths and by tests.

#### Returns

\`void\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / OperationPlan

# Interface: OperationPlan

Defined in: [src/shared/scheduler/plan.ts:62](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L62)

A named unit of work and the request budget it declared.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:64](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L64)

Opaque id minted by the declaring side and echoed on every request.

***

### name

> **name**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:69](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L69)

Human-readable name, the same vocabulary as a request's \`reason\` (e.g.
\`'Export all users'\`). Never an endpoint, never an identifier.

***

### tabId

> **tabId**: \`number\`

Defined in: [src/shared/scheduler/plan.ts:71](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L71)

Tab whose content script executes this plan's requests.

***

### legs

> **legs**: \`PlanLeg\`[]

Defined in: [src/shared/scheduler/plan.ts:72](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L72)

***

### startedAt

> **startedAt**: \`number\`

Defined in: [src/shared/scheduler/plan.ts:73](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L73)

***

### status

> **status**: \`PlanStatus\`

Defined in: [src/shared/scheduler/plan.ts:74](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L74)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / PlanDeclaration

# Interface: PlanDeclaration

Defined in: [src/shared/scheduler/plan.ts:131](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L131)

Everything needed to open a plan.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:132](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L132)

***

### name

> **name**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:133](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L133)

***

### tabId

> **tabId**: \`number\`

Defined in: [src/shared/scheduler/plan.ts:134](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L134)

***

### legs

> **legs**: \`PlanLegInput\`[]

Defined in: [src/shared/scheduler/plan.ts:135](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L135)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / PlanLeg

# Interface: PlanLeg

Defined in: [src/shared/scheduler/plan.ts:42](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L42)

One bucket's worth of a plan: the requests an operation will spend there.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:44](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L44)

Unique within the owning plan.

***

### bucket

> **bucket**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:49](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L49)

The Okta rate-limit bucket this leg spends against (\`bucketOf\`). Callers
pass an endpoint and let PlanRegistry bucket it.

***

### method

> **method**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:51](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L51)

HTTP method, for display only — a leg of DELETEs reads differently.

***

### estimate

> **estimate**: \`PlanEstimate\`

Defined in: [src/shared/scheduler/plan.ts:53](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L53)

Expected size.

***

### spent

> **spent**: \`number\`

Defined in: [src/shared/scheduler/plan.ts:55](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L55)

Settled requests attributed to this leg so far.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / PlanLegInput

# Interface: PlanLegInput

Defined in: [src/shared/scheduler/plan.ts:120](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L120)

A leg as declared by a caller, before the registry assigns it an id.

## Properties

### endpoint

> **endpoint**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:125](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L125)

An Okta endpoint (or a bare bucket key). Bucketed with \`bucketOf\` by the
registry, so callers never have to know the bucketing rule.

***

### method?

> \`optional\` **method?**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:126](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L126)

***

### estimate

> **estimate**: \`PlanEstimate\`

Defined in: [src/shared/scheduler/plan.ts:127](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L127)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / PlanLegSummary

# Interface: PlanLegSummary

Defined in: [src/shared/scheduler/plan.ts:78](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L78)

A leg flattened for display: what is left is what was planned minus what was spent.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:79](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L79)

***

### bucket

> **bucket**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:80](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L80)

***

### method

> **method**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:81](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L81)

***

### estimated

> **estimated**: \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/plan.ts:83](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L83)

\`null\` when the estimate is \`unknown\` — the bar shows "?" rather than a zero.

***

### spent

> **spent**: \`number\`

Defined in: [src/shared/scheduler/plan.ts:84](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L84)

***

### remaining

> **remaining**: \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/plan.ts:86](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L86)

\`max(0, estimated - spent)\`, or \`null\` for an unknown estimate.

***

### approximate

> **approximate**: \`boolean\`

Defined in: [src/shared/scheduler/plan.ts:88](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L88)

Whether estimated is a floor rather than a final number.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / PlanSummary

# Interface: PlanSummary

Defined in: [src/shared/scheduler/plan.ts:92](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L92)

An active plan, flattened for the Activity Bar.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:93](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L93)

***

### name

> **name**: \`string\`

Defined in: [src/shared/scheduler/plan.ts:94](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L94)

***

### startedAt

> **startedAt**: \`number\`

Defined in: [src/shared/scheduler/plan.ts:95](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L95)

***

### legs

> **legs**: \`PlanLegSummary\`[]

Defined in: [src/shared/scheduler/plan.ts:96](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L96)

***

### spent

> **spent**: \`number\`

Defined in: [src/shared/scheduler/plan.ts:98](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L98)

Σ of leg \`spent\`.

***

### estimated

> **estimated**: \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/plan.ts:100](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L100)

Σ of leg \`estimated\`, ignoring unknown legs; \`null\` when every leg is unknown.

***

### remaining

> **remaining**: \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/plan.ts:102](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L102)

\`max(0, estimated - spent)\`, or \`null\` when estimated is null.

***

### approximate

> **approximate**: \`boolean\`

Defined in: [src/shared/scheduler/plan.ts:104](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L104)

True when any leg is \`atLeast\` or \`unknown\`, i.e. the total is a floor.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / PlanEstimate

# Type Alias: PlanEstimate

> **PlanEstimate** = \\{ \`kind\`: \`"exact"\`; \`requests\`: \`number\`; \\} \\| \\{ \`kind\`: \`"atLeast"\`; \`requests\`: \`number\`; \\} \\| \\{ \`kind\`: \`"unknown"\`; \\}

Defined in: [src/shared/scheduler/plan.ts:38](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L38)

How many requests a leg expects to make, and how much that number can be
trusted.

A caller that knows \`items.length\` says \`exact\`; one walking pages says
\`atLeast\` and refines; one that cannot size the work says \`unknown\`. The bar
treats \`unknown\` as "some, unquantified" and never folds it into a total.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / PlanStatus

# Type Alias: PlanStatus

> **PlanStatus** = \`"active"\` \\| \`"done"\` \\| \`"cancelled"\`

Defined in: [src/shared/scheduler/plan.ts:59](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L59)

Lifecycle of a plan. Only \`active\` plans are published to the UI.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / MAX\\_LEGS\\_PER\\_PLAN

# Variable: MAX\\_LEGS\\_PER\\_PLAN

> \`const\` **MAX\\_LEGS\\_PER\\_PLAN**: \`16\` = \`16\`

Defined in: [src/shared/scheduler/plan.ts:117](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L117)

Upper bound on legs in one plan.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / MAX\\_TRACKED\\_PLANS

# Variable: MAX\\_TRACKED\\_PLANS

> \`const\` **MAX\\_TRACKED\\_PLANS**: \`32\` = \`32\`

Defined in: [src/shared/scheduler/plan.ts:114](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L114)

Upper bound on concurrently tracked plans; a runaway declarer cannot grow the map without limit.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/plan / PLAN\\_STALE\\_MS

# Variable: PLAN\\_STALE\\_MS

> \`const\` **PLAN\\_STALE\\_MS**: \`number\`

Defined in: [src/shared/scheduler/plan.ts:111](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/plan.ts#L111)

How long a plan may sit \`active\` with no attribution before the registry
reaps it. A side panel that closes mid-operation never sends \`complete\`.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/planEstimate / atLeastFanOutEstimate

# Function: atLeastFanOutEstimate()

> **atLeastFanOutEstimate**(\`itemCount\`, \`requestsPerItem?\`): \`PlanEstimate\`

Defined in: [src/shared/scheduler/planEstimate.ts:92](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/planEstimate.ts#L92)

A floor for a fan-out whose items cost *at least* \`requestsPerItem\` each —
one whose per-item worker paginates, say. Unlike fanOutEstimate, it
knows its minimum exactly and its total not at all.

## Parameters

### itemCount

\`number\`

### requestsPerItem?

\`number\` = \`1\`

## Returns

\`PlanEstimate\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/planEstimate / fanOutEstimate

# Function: fanOutEstimate()

> **fanOutEstimate**(\`itemCount\`, \`requestsPerItem?\`): \`PlanEstimate\`

Defined in: [src/shared/scheduler/planEstimate.ts:82](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/planEstimate.ts#L82)

An exact estimate for a fan-out that makes a fixed number of requests per
item, which is exact by construction — the item list is in hand.

## Parameters

### itemCount

\`number\`

Items in the fan-out.

### requestsPerItem?

\`number\` = \`1\`

Requests each item costs. Defaults to 1.

## Returns

\`PlanEstimate\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/planEstimate / openingWalkEstimate

# Function: openingWalkEstimate()

> **openingWalkEstimate**(): \`PlanEstimate\`

Defined in: [src/shared/scheduler/planEstimate.ts:56](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/planEstimate.ts#L56)

The opening estimate for a walk of unknown length: one page, and at least one
more if this one filled up.

The floor rises as pages land (see refinedWalkEstimate) rather than a
total being invented up front.

## Returns

\`PlanEstimate\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/planEstimate / pagesFor

# Function: pagesFor()

> **pagesFor**(\`itemCount\`): \`number\`

Defined in: [src/shared/scheduler/planEstimate.ts:28](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/planEstimate.ts#L28)

Requests a full pagination walk of \`itemCount\` items will cost.

Okta pages at OKTA\\_PAGE\\_SIZE, so the cost is \`ceil(n / 200)\`, except
that **zero items still costs one request** — the walk has to ask before it
can learn the collection is empty.

## Parameters

### itemCount

\`number\`

How many items the collection holds.

## Returns

\`number\`

Page count, minimum 1.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/planEstimate / refinedWalkEstimate

# Function: refinedWalkEstimate()

> **refinedWalkEstimate**(\`pagesFetched\`, \`hasMore\`): \`PlanEstimate\`

Defined in: [src/shared/scheduler/planEstimate.ts:68](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/planEstimate.ts#L68)

The estimate for a walk after \`pagesFetched\` pages.

## Parameters

### pagesFetched

\`number\`

Pages already requested, including the one just settled.

### hasMore

\`boolean\`

Whether the \`Link\` header promised another page.

## Returns

\`PlanEstimate\`

\`atLeast pagesFetched + 1\` while more pages are promised; \`exact
pagesFetched\` once the walk is done — the moment a floor becomes a fact.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/planEstimate / walkEstimate

# Function: walkEstimate()

> **walkEstimate**(\`itemCount\`): \`PlanEstimate\`

Defined in: [src/shared/scheduler/planEstimate.ts:42](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/planEstimate.ts#L42)

An exact estimate for a walk whose total is already known.

Use when the count came free with data the caller already has. Pass \`null\`
for a total that could not be determined and get \`unknown\` back rather than a
fabricated page count.

## Parameters

### itemCount

\`number\` \\| \`null\` \\| \`undefined\`

Known item total, or \`null\` when Okta did not say.

## Returns

\`PlanEstimate\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/rateLimitDetector / RateLimitDetector

# Class: RateLimitDetector

Defined in: [src/shared/scheduler/rateLimitDetector.ts:96](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L96)

Stateful tracker of Okta rate-limit headers. Owned by an \`ApiScheduler\`;
not safe for concurrent mutation across instances.

## Constructors

### Constructor

> **new RateLimitDetector**(): \`RateLimitDetector\`

#### Returns

\`RateLimitDetector\`

## Properties

### limits

> \`private\` **limits**: \`Map\`\\<\`string\`, \`RateLimitInfo\`\\>

Defined in: [src/shared/scheduler/rateLimitDetector.ts:98](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L98)

Latest observation per bucket (see bucketOf), not per URL.

***

### globalLimit

> \`private\` **globalLimit**: \`RateLimitInfo\` \\| \`null\` = \`null\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:99](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L99)

## Methods

### parseHeaders()

> **parseHeaders**(\`headers\`, \`endpoint\`): \`RateLimitInfo\` \\| \`null\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:118](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L118)

Parse rate limit headers from an Okta API response.

**A header set that is absent, or that does not parse to finite numbers, is
"unknown", and unknown is recorded as nothing at all.** The absence of an
entry is the only way this module says "no reading": \`getForBucket\` answers
\`null\`, the judgement methods decline, and \`ApiScheduler\` gates the bucket
on the most-restrictive observation anywhere. Storing the \`NaN\`s instead
would give an entry that never expires and wins every most-restrictive
comparison (\`D-086\`); declining leaves the last readable answer standing.

#### Parameters

##### headers

\`Record\`\\<\`string\`, \`string\`\\>

Lower-cased response headers from the content script.

##### endpoint

\`string\`

The Okta path the response came from; bucketed with
bucketOf before storage.

#### Returns

\`RateLimitInfo\` \\| \`null\`

The recorded observation, or \`null\` when the headers are missing or
unreadable.

***

### getMostRestrictive()

> **getMostRestrictive**(): \`RateLimitInfo\` \\| \`null\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:176](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L176)

The live observation with the lowest \`remaining\` anywhere.

#### Returns

\`RateLimitInfo\` \\| \`null\`

***

### getForBucket()

> **getForBucket**(\`bucket\`): \`RateLimitInfo\` \\| \`null\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:187](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L187)

Get the live observation for one bucket, or \`null\` when there is none — or
when the one there has expired.

#### Parameters

##### bucket

\`string\`

A key from bucketOf, not a raw endpoint.

#### Returns

\`RateLimitInfo\` \\| \`null\`

***

### getForEndpoint()

> **getForEndpoint**(\`endpoint\`): \`RateLimitInfo\` \\| \`null\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:204](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L204)

Get rate limit info covering a specific endpoint — that is, its bucket's.

#### Parameters

##### endpoint

\`string\`

An Okta path; bucketed with bucketOf before lookup.

#### Returns

\`RateLimitInfo\` \\| \`null\`

***

### isApproachingLimit()

> **isApproachingLimit**(\`thresholdPercent?\`, \`inFlightCount?\`, \`bucket?\`): \`boolean\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:224](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L224)

Is the budget at or below \`thresholdPercent\` remaining, charging in-flight
requests whose headers have not come back yet?

#### Parameters

##### thresholdPercent?

\`number\` = \`10\`

Approaching means at or below this percentage
remaining.

##### inFlightCount?

\`number\` = \`0\`

Requests already dispatched whose headers have not
come back. Subtracted from \`remaining\`, because they have spent budget the
header has not counted yet.

##### bucket?

\`string\`

Ask about one bucket's budget. Omit to ask about the
most-restrictive bucket seen anywhere, which is the global backstop.

#### Returns

\`boolean\`

#### Remarks

A bucket whose quota is not a positive number has an **unknown**
budget, not a spare one (percentRemaining), so the question falls
through to the most-restrictive *usable* observation anywhere. With nothing
readable anywhere, this declines to judge.

***

### mostRestrictiveUsable()

> \`private\` **mostRestrictiveUsable**(\`exceptBucket\`): \`RateLimitInfo\` \\| \`null\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:269](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L269)

The live observation with the least headroom whose budget can actually be
judged, ignoring one bucket.

The fallback for isApproachingLimit when the bucket asked about
quotes an unusable budget. Expired entries are skipped via
getForBucket, which also reaps them.

#### Parameters

##### exceptBucket

\`string\`

The bucket being asked about, whose own answer is the
unusable one.

#### Returns

\`RateLimitInfo\` \\| \`null\`

***

### isLimitExceeded()

> **isLimitExceeded**(\`bucket?\`): \`boolean\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:286](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L286)

Whether a budget is fully spent (\`remaining <= 0\`).

#### Parameters

##### bucket?

\`string\`

Ask about one bucket. Omit for the most-restrictive bucket
seen anywhere.

#### Returns

\`boolean\`

***

### getSecondsUntilReset()

> **getSecondsUntilReset**(\`info?\`): \`number\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:293](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L293)

Seconds until the window resets; \`0\` when there is no observation.

#### Parameters

##### info?

\`RateLimitInfo\`

#### Returns

\`number\`

***

### getMillisecondsUntilReset()

> **getMillisecondsUntilReset**(\`info?\`): \`number\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:303](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L303)

Milliseconds until the window resets; \`0\` when there is no observation.

#### Parameters

##### info?

\`RateLimitInfo\`

#### Returns

\`number\`

***

### getRecommendedWaitTime()

> **getRecommendedWaitTime**(\`thresholdPercent?\`, \`inFlightCount?\`): \`number\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:312](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L312)

Suggested delay before the next request: the full reset wait once the budget
is spent, otherwise the remaining requests spread evenly across the window
(floor 1s). \`0\` when the threshold has not been crossed.

#### Parameters

##### thresholdPercent?

\`number\` = \`10\`

##### inFlightCount?

\`number\` = \`0\`

#### Returns

\`number\`

***

### isExpired()

> \`private\` **isExpired**(\`info\`): \`boolean\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:334](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L334)

Whether an observation's reset time has passed.

#### Parameters

##### info

\`RateLimitInfo\`

#### Returns

\`boolean\`

***

### cleanExpiredLimits()

> \`private\` **cleanExpiredLimits**(): \`void\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:340](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L340)

Drop expired observations and recompute the global most-restrictive one.

#### Returns

\`void\`

***

### reset()

> **reset**(): \`void\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:363](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L363)

Forget every tracked limit.

#### Returns

\`void\`

***

### getState()

> **getState**(): \`object\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:370](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L370)

The global observation plus every live per-bucket one.

#### Returns

\`object\`

##### globalLimit

> **globalLimit**: \`RateLimitInfo\` \\| \`null\`

##### bucketLimits

> **bucketLimits**: \`object\`[]


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/rateLimitDetector / bucketOf

# Function: bucketOf()

> **bucketOf**(\`endpoint\`): \`string\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:86](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L86)

The Okta rate-limit bucket an endpoint's quota belongs to.

Okta meters per endpoint family, so \`/api/v1/apps\` can be exhausted while
\`/api/v1/groups\` still has its full budget.

The rule is the first resource segment: \`/api/v1/apps/{id}/groups?limit=200\`
and \`/api/v1/apps?limit=200\` both bucket to \`/api/v1/apps\`. The key must be
**at least as coarse as Okta's real buckets** — merging two observations that
share a bucket costs precision, while splitting two that do not would let one
family's budget be spent twice. A path that is not \`/api/v1/{resource}\` keys
under itself, isolating an unrecognised surface rather than pooling it.

## Parameters

### endpoint

\`string\`

Okta path, with or without a query string.

## Returns

\`string\`

The bucket key.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/rateLimitDetector / percentRemaining

# Function: percentRemaining()

> **percentRemaining**(\`info\`, \`inFlightCount?\`): \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/rateLimitDetector.ts:64](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitDetector.ts#L64)

What fraction of a bucket's budget is left, as a percentage — or \`null\` when
the budget is not something a percentage can be computed from.

**The guard sits at the division, not only at the parse.** A finite
\`X-Rate-Limit-Limit: 0\` is recorded, and \`(n / 0) * 100\` is \`Infinity\` while
\`(0 / 0) * 100\` is \`NaN\` — both compare \`false\` against every threshold, so a
zero budget would read as calm (\`D-094\`).

\`null\` means **unknown**, never "plenty": callers fall back to the
most-restrictive usable observation anywhere. Shared by both readers of the
ratio — RateLimitDetector.isApproachingLimit and
\`ApiScheduler.shouldEnterCooldown\` — so the guard cannot go missing in one.

## Parameters

### info

\`RateLimitInfo\`

A recorded observation.

### inFlightCount?

\`number\` = \`0\`

Requests already dispatched whose headers have not come
back; subtracted from \`remaining\` because they have spent budget nothing has
counted yet.

## Returns

\`number\` \\| \`null\`

Percentage of budget remaining, or \`null\` when the budget is unusable.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/rateLimitSettings / minRemainingFromWarningThreshold

# Function: minRemainingFromWarningThreshold()

> **minRemainingFromWarningThreshold**(\`warningThreshold\`): \`number\`

Defined in: [src/shared/scheduler/rateLimitSettings.ts:60](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitSettings.ts#L60)

The cooldown trigger implied by an org's warning threshold.

The org's number counts **consumed** budget; the scheduler's counts what is
**left**. A Workforce default of 90 becomes 15% remaining; a CIAM org's 60
becomes 45% remaining.

## Parameters

### warningThreshold

\`number\`

The org's threshold, as a consumed percentage.

## Returns

\`number\`

The percentage remaining at or below which the scheduler cools down.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/rateLimitSettings / parseWarningThreshold

# Function: parseWarningThreshold()

> **parseWarningThreshold**(\`data\`): \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/rateLimitSettings.ts:72](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitSettings.ts#L72)

Read a usable \`warningThreshold\` out of an untrusted response body.

## Parameters

### data

\`unknown\`

Whatever the endpoint returned.

## Returns

\`number\` \\| \`null\`

The threshold, or \`null\` when the body did not validate or the value
is outside the band this module will act on. \`null\` is always "keep the
configured default", never "assume something".


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/rateLimitSettings / WARNING\\_THRESHOLD\\_ENDPOINT

# Variable: WARNING\\_THRESHOLD\\_ENDPOINT

> \`const\` **WARNING\\_THRESHOLD\\_ENDPOINT**: \`"/api/v1/rate-limit-settings/warning-threshold"\` = \`'/api/v1/rate-limit-settings/warning-threshold'\`

Defined in: [src/shared/scheduler/rateLimitSettings.ts:24](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitSettings.ts#L24)

The org setting this module reads. Same-origin path, GET only.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/rateLimitSettings / WARNING\\_THRESHOLD\\_MARGIN

# Variable: WARNING\\_THRESHOLD\\_MARGIN

> \`const\` **WARNING\\_THRESHOLD\\_MARGIN**: \`5\` = \`5\`

Defined in: [src/shared/scheduler/rateLimitSettings.ts:31](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitSettings.ts#L31)

Percentage points subtracted from the org's threshold to get ours. The org's
number is where it wants to be *told*; ours is where we *stop*, so the
extension is never the traffic that trips the org's own alarm.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/rateLimitSettings / warningThresholdSchema

# Variable: warningThresholdSchema

> \`const\` **warningThresholdSchema**: \`ZodObject\`\\<\\{ \`warningThreshold\`: \`ZodNumber\`; \\}, \`"passthrough"\`, \`ZodTypeAny\`, \`objectOutputType\`\\<\\{ \`warningThreshold\`: \`ZodNumber\`; \\}, \`ZodTypeAny\`, \`"passthrough"\`\\>, \`objectInputType\`\\<\\{ \`warningThreshold\`: \`ZodNumber\`; \\}, \`ZodTypeAny\`, \`"passthrough"\`\\>\\>

Defined in: [src/shared/scheduler/rateLimitSettings.ts:48](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/rateLimitSettings.ts#L48)

Boundary schema for the endpoint's body. \`passthrough\`, because Okta may add
keys; the field is a plain number here, with the plausibility judgement left
to parseWarningThreshold so a malformed body stays distinguishable
from an out-of-band value.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/requestResult / isSessionExpired

# Function: isSessionExpired()

> **isSessionExpired**(\`result\`): \`boolean\`

Defined in: [src/shared/scheduler/requestResult.ts:42](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/requestResult.ts#L42)

Does this result mean the Okta session has expired?

401 only: it is the one status meaning the session cookie is gone or stale
and the admin must re-authenticate. A **403** is a permission the admin's role
lacks, and signing in again returns the same 403. A **429** wants backoff. A
NO\\_HTTP\\_STATUS transport failure says nothing about the session.

## Parameters

### result

\`RequestResult\`

Any settled RequestResult.

## Returns

\`boolean\`

\`true\` only for a failure carrying HTTP 401.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/requestResult / normalizeRequestResult

# Function: normalizeRequestResult()

> **normalizeRequestResult**(\`raw\`): \`RequestResult\`

Defined in: [src/shared/scheduler/requestResult.ts:60](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/requestResult.ts#L60)

Normalize an untyped transport payload into a RequestResult.

Results arrive over \`chrome.tabs.sendMessage\`, typed as \`any\`, and may carry
no \`status\` at all. This is the one place that keeps the union's promise
honest: every failure leaves here with a status, the one it arrived with or
NO\\_HTTP\\_STATUS.

Nothing else is inspected or reshaped — the Okta JSON is validated at the
content-script zod boundary.

## Parameters

### raw

\`unknown\`

The message payload returned by the content script.

## Returns

\`RequestResult\`

The same result, with a guaranteed \`status\` on the failure arm.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/requestResult / NO\\_HTTP\\_STATUS

# Variable: NO\\_HTTP\\_STATUS

> \`const\` **NO\\_HTTP\\_STATUS**: \`0\` = \`0\`

Defined in: [src/shared/scheduler/requestResult.ts:26](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/requestResult.ts#L26)

Status used by a failure that never produced an HTTP response at all: the
\`fetch\` threw (offline, DNS, connection reset, CORS refusal), or a
content-script boundary guard rejected the request before sending it.

\`0\` matches the platform's own convention and cannot collide with a real
status, since HTTP defines none below 100. **It is falsy** — compare it
explicitly (\`status === NO_HTTP_STATUS\`), never for truthiness.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/runBatch / runBatch

# Function: runBatch()

> **runBatch**\\<\`T\`, \`R\`\\>(\`items\`, \`task\`, \`options?\`): \`Promise\`\\<\`BatchOutcome\`\\<\`T\`, \`R\`\\>\\>

Defined in: [src/shared/scheduler/runBatch.ts:74](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L74)

Run \`task\` over \`items\` with bounded concurrency, live progress, and cancellation.

## Type Parameters

### T

\`T\`

Item type.

### R

\`R\`

Task result type.

## Parameters

### items

\`T\`[]

Work items.

### task

(\`item\`, \`index\`) => \`Promise\`\\<\`R\`\\>

Per-item async worker; typically issues one scheduler request.

### options?

\`RunBatchOptions\`\\<\`T\`\\> = \`{}\`

See RunBatchOptions.

## Returns

\`Promise\`\\<\`BatchOutcome\`\\<\`T\`, \`R\`\\>\\>

A BatchOutcome. Never throws for control flow — cancellation and
error halts are reported via \`cancelled\` / \`stoppedByError\` and \`skipped\` items,
so callers keep the partial results (e.g. to log what did succeed).


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/runBatch / BatchItemResult

# Interface: BatchItemResult\\<T, R\\>

Defined in: [src/shared/scheduler/runBatch.ts:27](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L27)

Per-item outcome. \`skipped\` means never started (cancelled or halted).

## Type Parameters

### T

\`T\`

### R

\`R\`

## Properties

### item

> **item**: \`T\`

Defined in: [src/shared/scheduler/runBatch.ts:28](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L28)

***

### index

> **index**: \`number\`

Defined in: [src/shared/scheduler/runBatch.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L29)

***

### status

> **status**: \`"fulfilled"\` \\| \`"rejected"\` \\| \`"skipped"\`

Defined in: [src/shared/scheduler/runBatch.ts:30](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L30)

***

### value?

> \`optional\` **value?**: \`R\`

Defined in: [src/shared/scheduler/runBatch.ts:31](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L31)

***

### error?

> \`optional\` **error?**: \`unknown\`

Defined in: [src/shared/scheduler/runBatch.ts:32](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L32)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/runBatch / BatchOutcome

# Interface: BatchOutcome\\<T, R\\>

Defined in: [src/shared/scheduler/runBatch.ts:48](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L48)

Aggregate result of a runBatch run.

## Type Parameters

### T

\`T\`

### R

\`R\`

## Properties

### results

> **results**: \`BatchItemResult\`\\<\`T\`, \`R\`\\>[]

Defined in: [src/shared/scheduler/runBatch.ts:50](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L50)

One entry per input item, in original order.

***

### total

> **total**: \`number\`

Defined in: [src/shared/scheduler/runBatch.ts:51](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L51)

***

### completed

> **completed**: \`number\`

Defined in: [src/shared/scheduler/runBatch.ts:52](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L52)

***

### failed

> **failed**: \`number\`

Defined in: [src/shared/scheduler/runBatch.ts:53](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L53)

***

### skipped

> **skipped**: \`number\`

Defined in: [src/shared/scheduler/runBatch.ts:55](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L55)

Items never started because of cancellation or an error halt.

***

### stoppedByError

> **stoppedByError**: \`boolean\`

Defined in: [src/shared/scheduler/runBatch.ts:57](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L57)

True if \`stopOnError\` requested a halt.

***

### cancelled

> **cancelled**: \`boolean\`

Defined in: [src/shared/scheduler/runBatch.ts:59](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L59)

True if \`throwIfCancelled\` threw during the run.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/runBatch / BatchProgress

# Interface: BatchProgress

Defined in: [src/shared/scheduler/runBatch.ts:15](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L15)

Live counts for an in-flight batch. \`pending = total - completed - failed - active\`.

## Properties

### total

> **total**: \`number\`

Defined in: [src/shared/scheduler/runBatch.ts:17](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L17)

Total items in the batch.

***

### completed

> **completed**: \`number\`

Defined in: [src/shared/scheduler/runBatch.ts:19](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L19)

Items that settled successfully.

***

### active

> **active**: \`number\`

Defined in: [src/shared/scheduler/runBatch.ts:21](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L21)

Items currently running.

***

### failed

> **failed**: \`number\`

Defined in: [src/shared/scheduler/runBatch.ts:23](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L23)

Items that settled with an error.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/runBatch / RunBatchOptions

# Interface: RunBatchOptions\\<T\\>

Defined in: [src/shared/scheduler/runBatch.ts:36](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L36)

Options for runBatch.

## Type Parameters

### T

\`T\`

## Properties

### concurrency?

> \`optional\` **concurrency?**: \`number\`

Defined in: [src/shared/scheduler/runBatch.ts:38](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L38)

Max tasks in flight at once. Defaults to 5 (the scheduler's cap).

***

### throwIfCancelled?

> \`optional\` **throwIfCancelled?**: () => \`void\`

Defined in: [src/shared/scheduler/runBatch.ts:40](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L40)

Throws (e.g. \`OperationCancelledError\`) to signal cancellation; polled before each start.

#### Returns

\`void\`

***

### onProgress?

> \`optional\` **onProgress?**: (\`progress\`) => \`void\`

Defined in: [src/shared/scheduler/runBatch.ts:42](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L42)

Called after every start/settle with the current counts.

#### Parameters

##### progress

\`BatchProgress\`

#### Returns

\`void\`

***

### stopOnError?

> \`optional\` **stopOnError?**: (\`error\`, \`item\`, \`index\`) => \`boolean\`

Defined in: [src/shared/scheduler/runBatch.ts:44](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/runBatch.ts#L44)

Return \`true\` from a settled error to stop launching further work.

#### Parameters

##### error

\`unknown\`

##### item

\`T\`

##### index

\`number\`

#### Returns

\`boolean\`


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / BucketState

# Interface: BucketState

Defined in: [src/shared/scheduler/types.ts:107](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L107)

One Okta rate-limit bucket, as the Activity Bar sees it: how much budget is
left, and how much of what remains is already spoken for.

A bucket appears here once anything has touched it — a header observation, a
queued or in-flight request, an active plan's declared leg, or a request that
settled here recently enough to still be remembered. The plan source is why a
bucket can be listed with BucketState.planned work and no traffic yet.

The remembered source retains the row's existence, **never a number**: a
remembered-but-idle bucket reports zero counts and a \`null\` budget, so a
memory can never pass for a reading.

## Properties

### bucket

> **bucket**: \`string\`

Defined in: [src/shared/scheduler/types.ts:109](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L109)

Bucket key from \`bucketOf\`, e.g. \`/api/v1/users\`.

***

### limit

> **limit**: \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/types.ts:115](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L115)

Quota size from \`X-Rate-Limit-Limit\`, or \`null\` when Okta has not reported
on this bucket yet. \`null\` is not zero: an unobserved bucket has an unknown
budget, and the bar says so rather than drawing an empty gauge.

***

### remaining

> **remaining**: \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/types.ts:117](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L117)

Remaining budget, or \`null\` when unobserved.

***

### resetAt

> **resetAt**: \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/types.ts:122](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L122)

When this bucket's window resets, in **milliseconds** since the epoch, or
\`null\` when unobserved. Converted from Okta's seconds-based header.

***

### queued

> **queued**: \`number\`

Defined in: [src/shared/scheduler/types.ts:124](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L124)

Queued requests whose endpoint buckets here.

***

### active

> **active**: \`number\`

Defined in: [src/shared/scheduler/types.ts:126](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L126)

In-flight requests whose endpoint buckets here.

***

### planned

> **planned**: \`number\`

Defined in: [src/shared/scheduler/types.ts:128](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L128)

Requests active plans still expect to spend here (\`shared/scheduler/plan\`).

***

### gatedUntil

> **gatedUntil**: \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/types.ts:134](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L134)

When this bucket's gate lifts, or \`null\` when it is not gated. Reflects the
gate that actually governs it — for an unobserved bucket, the global
backstop, the same rule \`gateKeyFor\` applies at dispatch.

***

### lastActiveAt

> **lastActiveAt**: \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/types.ts:144](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L144)

When a request last **settled** in this bucket during this worker's
lifetime, in milliseconds since the epoch, or \`null\` when none has — which
is what distinguishes *at rest* from *never used*.

Not a budget reading, and must never be presented as one: a remembered
bucket whose window has reset reports \`limit\`/\`remaining\`/\`resetAt\` as
\`null\`. \`null\` after a service-worker restart is correct, not lossy.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / QueuedRequest

# Interface: QueuedRequest

Defined in: [src/shared/scheduler/types.ts:26](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L26)

One request as the scheduler holds it, from enqueue to settle.

## Properties

### id

> **id**: \`string\`

Defined in: [src/shared/scheduler/types.ts:27](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L27)

***

### endpoint

> **endpoint**: \`string\`

Defined in: [src/shared/scheduler/types.ts:28](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L28)

***

### method

> **method**: \`string\`

Defined in: [src/shared/scheduler/types.ts:29](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L29)

***

### body?

> \`optional\` **body?**: \`unknown\`

Defined in: [src/shared/scheduler/types.ts:30](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L30)

***

### priority

> **priority**: \`RequestPriority\`

Defined in: [src/shared/scheduler/types.ts:31](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L31)

***

### tabId

> **tabId**: \`number\`

Defined in: [src/shared/scheduler/types.ts:32](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L32)

***

### timestamp

> **timestamp**: \`number\`

Defined in: [src/shared/scheduler/types.ts:33](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L33)

***

### reason?

> \`optional\` **reason?**: \`string\`

Defined in: [src/shared/scheduler/types.ts:38](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L38)

Human-readable "why" for the verbose request audit log
(\`shared/requestLog\`). Absent falls back to a generic label there.

***

### planId?

> \`optional\` **planId?**: \`string\`

Defined in: [src/shared/scheduler/types.ts:44](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L44)

The operation plan (\`shared/scheduler/plan\`) this request was declared part
of. Absent is ordinary: the ledger is advisory, so an undeclared request
still runs and still counts against its bucket, just with no operation row.

***

### resolve

> **resolve**: (\`response\`) => \`void\`

Defined in: [src/shared/scheduler/types.ts:45](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L45)

#### Parameters

##### response

\`RequestResult\`

#### Returns

\`void\`

***

### reject

> **reject**: (\`error\`) => \`void\`

Defined in: [src/shared/scheduler/types.ts:46](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L46)

#### Parameters

##### error

\`Error\`

#### Returns

\`void\`

***

### retryCount

> **retryCount**: \`number\`

Defined in: [src/shared/scheduler/types.ts:47](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L47)

***

### maxRetries

> **maxRetries**: \`number\`

Defined in: [src/shared/scheduler/types.ts:48](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L48)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / RateLimitInfo

# Interface: RateLimitInfo

Defined in: [src/shared/scheduler/types.ts:52](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L52)

Rate-limit information parsed from one Okta response's headers.

## Properties

### limit

> **limit**: \`number\`

Defined in: [src/shared/scheduler/types.ts:53](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L53)

***

### remaining

> **remaining**: \`number\`

Defined in: [src/shared/scheduler/types.ts:54](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L54)

***

### reset

> **reset**: \`number\`

Defined in: [src/shared/scheduler/types.ts:55](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L55)

***

### endpoint

> **endpoint**: \`string\`

Defined in: [src/shared/scheduler/types.ts:57](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L57)

The exact endpoint whose response carried these headers. Reporting only.

***

### bucket

> **bucket**: \`string\`

Defined in: [src/shared/scheduler/types.ts:62](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L62)

The Okta rate-limit bucket endpoint belongs to (\`bucketOf\`). The
observation is keyed by this, since Okta meters per endpoint family.

***

### timestamp

> **timestamp**: \`number\`

Defined in: [src/shared/scheduler/types.ts:63](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L63)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / RequestFailure

# Interface: RequestFailure

Defined in: [src/shared/scheduler/types.ts:218](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L218)

A request that did not succeed — and that can say *how* it failed.

\`status\` is **not optional here**: every failure carries either the real HTTP
status Okta returned or \`NO_HTTP_STATUS\`
(\`shared/scheduler/requestResult\`) when there was no HTTP response at all. A
caller narrowed to this arm always has a status to branch on.

## See

RequestResult

## Properties

### success

> **success**: \`false\`

Defined in: [src/shared/scheduler/types.ts:220](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L220)

Discriminant.

***

### status

> **status**: \`number\`

Defined in: [src/shared/scheduler/types.ts:225](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L225)

HTTP status, or \`NO_HTTP_STATUS\` (\`shared/scheduler/requestResult\`) when there was no HTTP response.
Always present — that is the point of this arm.

***

### error?

> \`optional\` **error?**: \`string\`

Defined in: [src/shared/scheduler/types.ts:227](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L227)

Human-readable failure summary. Never a response body or PII.

***

### data?

> \`optional\` **data?**: \`any\`

Defined in: [src/shared/scheduler/types.ts:231](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L231)

***

### headers?

> \`optional\` **headers?**: \`Record\`\\<\`string\`, \`string\`\\>

Defined in: [src/shared/scheduler/types.ts:233](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L233)

Response headers, when the failure came with a response.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / RequestSuccess

# Interface: RequestSuccess

Defined in: [src/shared/scheduler/types.ts:195](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L195)

A request that reached Okta and came back with a response the transport
considered successful (\`response.ok\`).

## See

RequestResult

## Properties

### success

> **success**: \`true\`

Defined in: [src/shared/scheduler/types.ts:197](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L197)

Discriminant.

***

### data?

> \`optional\` **data?**: \`any\`

Defined in: [src/shared/scheduler/types.ts:201](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L201)

***

### headers?

> \`optional\` **headers?**: \`Record\`\\<\`string\`, \`string\`\\>

Defined in: [src/shared/scheduler/types.ts:203](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L203)

Response headers (the rate-limit and \`link\` headers are read off these).

***

### status?

> \`optional\` **status?**: \`number\`

Defined in: [src/shared/scheduler/types.ts:205](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L205)

HTTP status of the successful response, when the producer supplied one.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / SchedulerConfig

# Interface: SchedulerConfig

Defined in: [src/shared/scheduler/types.ts:67](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L67)

Tuning knobs for RequestPriority dispatch, gating, and retries.

## Properties

### maxConcurrent

> **maxConcurrent**: \`number\`

Defined in: [src/shared/scheduler/types.ts:68](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L68)

***

### maxConcurrentPerBucket

> **maxConcurrentPerBucket**: \`number\`

Defined in: [src/shared/scheduler/types.ts:86](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L86)

Max parallel requests **within a single Okta rate-limit bucket**
(\`bucketOf\`), on top of — never instead of —
SchedulerConfig.maxConcurrent.

A bucket is the only thing Okta meters; without a per-bucket cap, one
family's fan-out occupies every seat the extension has. A bucket at its cap
yields its turn — \`drainQueue\` skips it and dispatches another family
instead of ending the pass.

Unlike the rate-limit *gate*, this keys on the endpoint's real bucket even
when Okta has said nothing about it: how many seats a family may hold does
not depend on observation. \`interactive\` grants no exemption.

Must satisfy \`0 < maxConcurrentPerBucket < maxConcurrent\` when supplied
explicitly — a cap at or above the global ceiling governs nothing.

***

### minRemainingThreshold

> **minRemainingThreshold**: \`number\`

Defined in: [src/shared/scheduler/types.ts:87](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L87)

***

### cooldownDuration

> **cooldownDuration**: \`number\`

Defined in: [src/shared/scheduler/types.ts:88](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L88)

***

### retryDelay

> **retryDelay**: \`number\`

Defined in: [src/shared/scheduler/types.ts:89](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L89)

***

### maxRetries

> **maxRetries**: \`number\`

Defined in: [src/shared/scheduler/types.ts:90](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L90)

***

### requestTimeout

> **requestTimeout**: \`number\`

Defined in: [src/shared/scheduler/types.ts:91](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L91)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / SchedulerMetrics

# Interface: SchedulerMetrics

Defined in: [src/shared/scheduler/types.ts:248](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L248)

Counters the scheduler keeps for debugging and the Activity Bar.

## Properties

### totalRequests

> **totalRequests**: \`number\`

Defined in: [src/shared/scheduler/types.ts:249](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L249)

***

### successfulRequests

> **successfulRequests**: \`number\`

Defined in: [src/shared/scheduler/types.ts:250](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L250)

***

### failedRequests

> **failedRequests**: \`number\`

Defined in: [src/shared/scheduler/types.ts:251](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L251)

***

### retriedRequests

> **retriedRequests**: \`number\`

Defined in: [src/shared/scheduler/types.ts:252](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L252)

***

### cacheHits

> **cacheHits**: \`number\`

Defined in: [src/shared/scheduler/types.ts:253](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L253)

***

### coalescedRequests

> **coalescedRequests**: \`number\`

Defined in: [src/shared/scheduler/types.ts:255](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L255)

GET requests served by joining an identical in-flight request (de-duplicated).

***

### averageWaitTime

> **averageWaitTime**: \`number\`

Defined in: [src/shared/scheduler/types.ts:256](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L256)

***

### averageExecutionTime

> **averageExecutionTime**: \`number\`

Defined in: [src/shared/scheduler/types.ts:257](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L257)

***

### cooldownEvents

> **cooldownEvents**: \`number\`

Defined in: [src/shared/scheduler/types.ts:258](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L258)

***

### throttleEvents

> **throttleEvents**: \`number\`

Defined in: [src/shared/scheduler/types.ts:259](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L259)


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / SchedulerState

# Interface: SchedulerState

Defined in: [src/shared/scheduler/types.ts:148](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L148)

The scheduler snapshot broadcast to the side panel.

## Properties

### status

> **status**: \`SchedulerStatus\`

Defined in: [src/shared/scheduler/types.ts:149](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L149)

***

### queueLength

> **queueLength**: \`number\`

Defined in: [src/shared/scheduler/types.ts:150](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L150)

***

### activeRequests

> **activeRequests**: \`number\`

Defined in: [src/shared/scheduler/types.ts:151](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L151)

***

### totalProcessed

> **totalProcessed**: \`number\`

Defined in: [src/shared/scheduler/types.ts:152](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L152)

***

### rateLimitInfo

> **rateLimitInfo**: \`RateLimitInfo\` \\| \`null\`

Defined in: [src/shared/scheduler/types.ts:158](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L158)

The most-restrictive observation seen anywhere. Kept as the one-number
summary the collapsed bar shows; SchedulerState.buckets is the
per-bucket truth behind it.

***

### cooldownEndsAt

> **cooldownEndsAt**: \`number\` \\| \`null\`

Defined in: [src/shared/scheduler/types.ts:159](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L159)

***

### errorCount

> **errorCount**: \`number\`

Defined in: [src/shared/scheduler/types.ts:160](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L160)

***

### lastError

> **lastError**: \`string\` \\| \`null\`

Defined in: [src/shared/scheduler/types.ts:161](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L161)

***

### buckets

> **buckets**: \`BucketState\`[]

Defined in: [src/shared/scheduler/types.ts:167](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L167)

Every bucket currently worth showing, most-pressured first. Okta enforces
quotas per endpoint family, so \`/api/v1/apps\` can be exhausted while
\`/api/v1/groups\` sits untouched.

***

### plans

> **plans**: \`PlanSummary\`[]

Defined in: [src/shared/scheduler/types.ts:169](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L169)

Active operation plans (\`shared/scheduler/plan\`), oldest first.

***

### minRemainingThresholdPercent

> **minRemainingThresholdPercent**: \`number\`

Defined in: [src/shared/scheduler/types.ts:175](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L175)

The remaining-percentage at or below which the scheduler starts backing
off, learned from the org's own warning-threshold setting. Published so the
bar colours "low" at the line the scheduler actually acts on.

***

### expiredSessionTabIds?

> \`optional\` **expiredSessionTabIds?**: \`number\`[]

Defined in: [src/shared/scheduler/types.ts:186](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L186)

Tabs whose Okta session the scheduler has watched expire (a 401), and for
which it is holding requests rather than spending them (\`D-007b\`). Riding
the \`schedulerStateChanged\` broadcast is what makes one 401 a single
masthead statement rather than an error on every mounted surface. Per tab,
because a tab holds one org's session.

Absent reads the same as empty — *nothing is known to have expired* — and
never as "expired".


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / RequestPriority

# Type Alias: RequestPriority

> **RequestPriority** = \`"interactive"\` \\| \`"high"\` \\| \`"normal"\` \\| \`"low"\`

Defined in: [src/shared/scheduler/types.ts:21](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L21)

Queue priority for a scheduled request. Ordered
\`interactive\` &gt; \`high\` &gt; \`normal\` &gt; \`low\`.

\`interactive\` is reserved for latency-sensitive, user-initiated work such as
a type-ahead search. It is the only tier that bypasses the **soft** gates — a
soft cooldown and the approaching-limit threshold — so a typed search never
stalls. It still respects \`maxConcurrent\`, \`maxConcurrentPerBucket\` and hard
exhaustion (\`remaining <= 0\`), so it can never force a 429.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / RequestResult

# Type Alias: RequestResult

> **RequestResult** = \`RequestSuccess\` \\| \`RequestFailure\`

Defined in: [src/shared/scheduler/types.ts:245](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L245)

Request execution result: a discriminated union on \`success\`.

Narrowing on \`success\` is the supported way to read one. \`!result.success\`
gives you a RequestFailure with a guaranteed \`status\`; \`result.success\`
gives you a RequestSuccess. Use
\`isSessionExpired\` (\`shared/scheduler/requestResult\`) rather than comparing
\`status\` to 401 by hand.


---

**Okta Unbound Internals v0.7.0-beta.4**

***

Okta Unbound Internals / shared/scheduler/types / SchedulerStatus

# Type Alias: SchedulerStatus

> **SchedulerStatus** = \`"idle"\` \\| \`"processing"\` \\| \`"throttled"\` \\| \`"cooldown"\` \\| \`"paused"\`

Defined in: [src/shared/scheduler/types.ts:23](https://github.com/samdhenderson/Okta-Unbound-Dev/blob/main/src/shared/scheduler/types.ts#L23)

Coarse lifecycle status of the scheduler, surfaced to the UI.`;function s(e){return n.jsxs(n.Fragment,{children:[`
`,n.jsx(a,{title:"Internals/Scheduler & messaging"}),`
`,n.jsx(d,{children:i})]})}function c(e={}){const{wrapper:t}={...r(),...e.components};return t?n.jsx(t,{...e,children:n.jsx(s,{...e})}):s()}export{c as default};
