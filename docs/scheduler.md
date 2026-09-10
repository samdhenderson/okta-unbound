# The request pipeline

Every Okta call passes through one background `ApiScheduler`
(`src/shared/scheduler/apiScheduler.ts`). This doc owns its rules; the transport
is in [architecture.md](./architecture.md).

## One bar, one cancel

The panel renders exactly **one** activity surface: `ActivityBar` →
`ActivityBarView` (pure, with reserved slots so values swap in place), fed by
`useActivityBar`, which merges `SchedulerContext` and `ProgressContext` into one
`ActivityView`. Never add a second progress surface standing in for scheduler
state. Cancellation likewise is one signal end to end: `OperationCancelledError`
and `createCancellation()` (`shared/scheduler/cancellation.ts`) are the only
typed error and pollable token, `ProgressContext` owns the current operation's,
`useOktaApi.checkCancelled` reads it ref-backed rather than from a closure, and
`clearQueue()` **rejects** every dropped request and coalesced waiter with it.
The bar's single Cancel trips the token **and** drains the queue.

A loop polls `coreApi.checkCancelled()` between iterations and lets
`OperationCancelledError` propagate; an operation outside the global progress
bar calls `resetCancellation()` first; a per-operation stop (`cancelPlan`) never
trips the shared token, which is global.

## Multi-call work goes through `runOperation`

`runBatch` (`shared/scheduler/runBatch.ts`) is the pure worker-pool runner:
bounded concurrency (default 5), `{ total, completed, active, failed }`
progress, a polled cancellation guard, and `stopOnError`; it never throws for
control flow, so callers keep partial results. `coreApi.runOperation(name,
items, task, opts)` wraps it with the global progress lifecycle and the shared
token, and **is the only sanctioned way to run a multi-call read or write.** A
hand-rolled `Promise.all` or `for await` fan-out is a bug: no operation row, no
live counts, no cancel. A cursor chain that cannot parallelise
(`getAllGroupMembers`) keeps its loop but still polls the token, and walk-shaped
work uses `coreApi.withPlan(name, legs, run)`. `runBatch`'s 5 is a runner
default, not a scheduler ceiling.

## Every request carries a `reason`

`makeApiRequest(endpoint, options)` takes `MakeApiRequestOptions` whose `reason`
is **not** optional — one required field on the one function every panel Okta
call funnels through, which makes labelling compiler-enforced; a call inside a
`runOperation(name, …)` task reuses that `name`. `reason` stays optional on the
transport (`QueuedRequest`, the `scheduleApiRequest` message, capped at 80
chars): an unlabelled message logs under a generic fallback.

Capture is at the scheduler, which alone also sees background traffic:
`recordRequest` (`shared/requestLog.ts`) is called once per request **settling**
— final success, or final failure after retries, never a mid-flight retry.
Requests sharing a `reason` fold into one open in-memory batch — a page load's
fan-out becomes one `42 requests — …` row — and a coalesced GET is recorded
once, for the leader.

A batch flushes when **the scheduler goes idle**, from the same branch of
`drainQueue` that decides it is safe to let the MV3 worker suspend, never on an
independent timer that suspension would kill. It lands in
`chrome.storage.local['apiRequestLog']`, newest-first, capped at **50** entries,
a batch of any size occupying one slot; endpoints are deduped, capped at
`MAX_LOGGED_ENDPOINTS` (20) with an `endpointsTruncated` flag, and every one
goes through `redactJson` (`shared/utils/redact.ts`) **before** it is written.

## Rate limits, gates and seats

`bucketOf(endpoint)` is `/api/v1/{first resource segment}`; a path of another
shape keys under itself, so an unrecognised surface is isolated.

- **An observed bucket answers for itself**, so an exhausted `/api/v1/apps`
  never stalls a `/api/v1/groups` lookup.
- **An unobserved bucket falls back to the global backstop** — the
  most-restrictive observation anywhere (`GLOBAL_GATE`, `'*'`).

`drainQueue` scans the priority-ordered queue for the first request whose gate
is clear rather than stopping at the head; a request is skipped only by its own
gate.

The cooldown trigger is the org's own answer: `minRemainingThreshold = 100 -
(warningThreshold - 5)`, five **percentage points** of margin, so the extension
is not what trips the admin's own alarm. It is probed once per org per browser
session at `low` priority through the scheduler path, memoised in
`chrome.storage.session`, failures included. A 403/404/401, a body failing the
zod boundary, a value outside 10–100, or a transport failure all leave
`DEFAULT_CONFIG.minRemainingThreshold` (10) where it was; an out-of-band value
is **refused, never clamped**.

`maxConcurrentPerBucket: 4`, `maxConcurrent: 10`, with `0 <
maxConcurrentPerBucket < maxConcurrent` enforced at construction, and
`SHARD_CONCURRENCY` (`shared/snapshot/snapshotSync.ts`) tracking the per-bucket
number. The cap keys on `bucketOf(endpoint)` **unconditionally**, unlike the
gate: the gate's question is budget, which an unobserved family cannot answer,
and the cap's is seats. A bucket at its cap returns `'gated'`, so `drainQueue`
tries the next request rather than ending the pass. An observed bucket is
charged its own in-flight count at the soft gate, while the backstop keeps the
pessimistic whole-`activeRequests` charge.

**`interactive` gets no exemption.** It jumps the soft gate and the queue's
priority order, but neither ceiling, and never a hard-exhausted bucket
(`isLimitExceeded`).

## A bucket stays; a memory is never a number

`buildBucketStates` unions five sources: header observations, the queue,
in-flight requests, active plans' legs, and `rememberedBuckets`. A bucket is
remembered for `BUCKET_MEMORY_MS` (10 minutes) after its last settle, bounded at
`MAX_REMEMBERED_BUCKETS` (12) with least-recently-active eviction; one with live
work or an armed gate is never evicted. A remembered-idle bucket reports:

- `queued`, `active`, `planned` are `0` — the true count from live sources.
- `limit`, `remaining`, `resetAt` are **`null`** once the detector expires the
  observation: the memory retains **the row's existence, never a reading.**
  Unknown is not exhausted, and `null` is never `0`.
- `lastActiveAt` is when a request last settled here, or `null` if none has, so
  the UI can say "at rest · 40s ago".

## The plan ledger is advisory

An operation may declare a request budget before spending it: an `OperationPlan`
with one `PlanLeg` per bucket, each carrying a `PlanEstimate` typed by
confidence — `exact`, `atLeast`, `unknown`. **No estimator invents a number.**
Those in `shared/scheduler/planEstimate.ts` only convert a figure already paid
for, and none spends a request to learn what to declare; `PlanRegistry.refine`
raises an `atLeast` as pages land and settles it to `exact` when a walk ends.
Spend is attributed from the single `recordSettledRequest` path, and a coalesced
GET is charged once, to the leader.

**Nothing gates on an estimate.** An undeclared request still appears in its
bucket's counts; a request whose bucket no leg declared is charged to an
appended `unknown` leg; an overrun floors `remaining` at zero rather than going
negative.

The ledger is authoritative on one question only, _whether an operation is still
running_, never _how much it may spend_: `cancelPlan(planId)` closes the plan,
drops only that plan's queued requests, and tombstones the id in a bounded FIFO
(`MAX_CANCELLED_PLANS`, 64) so a later request carrying it is rejected with
`OperationCancelledError`, which unwinds the loop still filling the queue.
`clearQueue()` resets the ledger and tombstones the plans it forgets.

Plans are threaded explicitly: `runOperation({ plan })` for a fan-out,
`withPlan(name, legs, run)` for a walk, over one `updateOperationPlan` message
with a discriminated `op` (`declare | refine | complete | cancel`), carrying
`scheduleApiRequest`'s sender posture: `rejectIfFromTab`, length caps, and each
leg endpoint held to the same-origin single-`/` shape a real request must
satisfy.

## A 401 suspends the session, not the request

401 **only**: 403 is a permission re-authenticating will not change, 429 wants
backoff, and a missing status is a transport failure. `isSessionExpired`
(`shared/scheduler/requestResult.ts`) is the one definition. On the first result
for which it holds the scheduler suspends, **keyed by `tabId`** — a request
carries a tab, and one tab is one org's session. Everything already queued for
that tab settles at once with the same session-expired failure, unsent;
in-flight requests are left to land, since cancelling a write that may have
reached Okta is worse. **Nothing is auto-retried**: interrupted work is
reported, not resumed.

The panel renders it **once**, globally: `useSessionExpiry(targetTabId)` reads
`SchedulerState.expiredSessionTabIds` and `App`'s `SessionExpiryNotice` shows
one `danger` `AlertMessage`, and a `null` tab is never expired. Per-surface
error states are wrong here — they multiply one fact into nine. It clears on
evidence, never on a timer, and carries no Retry control: while a tab is
suspended the scheduler lets **one** request per settled round through as a
probe, and a success unpublishes the tab on the broadcast that resumes
scheduling. A 403 or 404 does not clear it.

## What the activity bar may draw

**A bucket lane's denominator is `remaining`** — not `limit`, and not the work's
own composition: scaled to what is left, a lane answers whether the queued work
will fit. The running segment is `active / remaining`, the queued one `(queued +
planned) / remaining`, both clamped so they never exceed the track, and the pale
tail is the rest.

Saturation is the feature: when declared work exceeds `remaining` the segments
take the whole track and the tail disappears — the lane saying _this will not
fit_. `budgetDenominator` returns `null` for anything non-positive or
unreadable, so an exhausted or unread bucket draws **no scale at all** rather
than a plausible one. Four mutually exclusive forms: gated (cooldown hatch),
known budget (fills), unknown budget (faint hatch), at rest (empty). **No lane
prints a `remaining/limit` pair as visible text**: the figures live in the
track's accessible name (`role="img"` + `aria-label`), which says `budget not
reported` when there is no reading — never a resurrected figure, never `0/0`.

The rack renders **every** bucket the scheduler publishes: no strain filter, no
row cap, no summary line, height bounded by scrolling rather than truncation.

`PipelineMeter` is a different instrument: it shows where an operation's
requests are (`spent / active / queued / planned`) as shares of that operation's
own total, not of a budget; its `label` is required. **A displayed denominator
may still grow mid-walk, and the bar no longer says so:** `budgetLabel` renders
`12 / 50`, or the spent count alone when nothing has been estimated, and a floor
and a fact read identically. Two leftovers to clear rather than revive — the
`approximate` flag on `PlanSummary`/`PlanLegSummary`
(`shared/scheduler/plan.ts`) and `atLeastFanOutEstimate`
(`shared/scheduler/planEstimate.ts`), neither of which has a reader outside its
own tests.
