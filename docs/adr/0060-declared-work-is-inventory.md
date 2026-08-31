# ADR-0060: Declared work is inventory, not a promise

- Status: Proposed
- Date: 2026-08-31
- Relates to: ADR-0008 (one activity bar, one cancel), ADR-0009 (one batch
  runner), ADR-0018 (tabs stay mounted), ADR-0031 (a linear fan-out is a
  deliberate act), ADR-0040 (the background owns the org), ADR-0059 (one bucket
  is not the org)

## Context

ADR-0059 taught the scheduler that Okta's quotas are per endpoint family, and
gave it a cooldown per bucket. What it did not change is _when_ the scheduler
learns anything: only as requests settle.

That leaves the scheduler honest about the past and blind to the future.
`SchedulerState` reports `queueLength` and `activeRequests` — work that has
already been enqueued — so an export that will walk fifty pages is
indistinguishable from a lookup that will make one until the fiftieth page
lands. The Activity Bar inherits that blindness. It can say "6 queued"; it
cannot say "and 800 more are coming, all against the bucket that has 380 left".

Three specific gaps follow from it.

**Cost is discovered, never anticipated.** `CoreApi.runOperation`'s `total`
counts _items_, not requests. A 400-user MFA scan reports "0 / 400" while
spending 400 requests against `/api/v1/users`, and nothing anywhere converts one
into the other. `ProgressContext.incrementApiCalls` exists and has no caller in
`useOktaApi/`; `exportEngine` writes `apiRequestCount: 1` into its audit entry
regardless of how many pages it actually walked.

**The bar knows less than the machinery under it.** `RateLimitDetector` has
tracked headroom per bucket since ADR-0059, and `getState()` returns exactly
that — with **zero production callers**. The only thing crossing to the panel is
`rateLimitInfo`, a single most-restrictive observation. A user watching the bar
cannot tell which quota is under strain, which is the one question the
per-bucket gating made answerable.

**The bar disagreed with the scheduler about "low".** `useActivityBar`
hardcoded 20% remaining as its warning line while the background learned the
org's own warning threshold and applied it via `setMinRemainingThreshold`. An
org configured at 35% would see comfortable headroom in the bar while the
scheduler was already gating.

The theme is the same each time: the extension knows more than it says.

## Decision

### 1. An operation may declare its request budget before spending it

`shared/scheduler/plan` adds an `OperationPlan`: a named unit of work with one
`PlanLeg` per rate-limit bucket it intends to spend against. A leg carries an
estimate typed by confidence:

```ts
type PlanEstimate =
  { kind: 'exact'; requests: number } | { kind: 'atLeast'; requests: number } | { kind: 'unknown' };
```

The three arms are not interchangeable, and that is the point. `exact` is a
number the caller can actually derive — `items.length` for a fan-out,
`ceil(total / 200)` for a walk whose total came free from `expand=stats`,
`x-total-count`, or `SyncMeta.itemCount`. `atLeast` is a walk mid-flight.
`unknown` is a declared leg that genuinely cannot be sized. **No estimator may
invent a number**: a caller with nothing to go on says `unknown` and the bar
renders it as unquantified rather than folding a guess into a total. This is
ADR-0020's rule about attribution applied to cost — a display that cannot tell
a measurement from a guess is worse than one that admits it does not know.

Estimates are refined, not fixed. `PlanRegistry.refine` lets a pagination loop
raise an `atLeast` as `Link` headers promise more pages and settle it to `exact`
when the walk ends, so the number on screen is never stale.

### 2. The ledger is advisory

Nothing in the plan gates, reserves, or reorders a request. An undeclared
request runs exactly as it does today and still appears in its bucket's
`queued`/`active` counts — it simply has no operation row of its own.

This is deliberate and it is the load-bearing constraint. An estimate is a
prediction made by a caller about work it has not done yet, and predictions are
wrong. If a plan could gate, a wrong estimate would become a broken feature: an
export that under-declared would stall partway through with no recourse. As
advisory inventory, a wrong estimate degrades the _display_ and nothing else,
which is a cost worth paying for numbers that are useful the other 95% of the
time.

The two visible consequences of "advisory" are both intentional:

- A request whose bucket no leg declared is still charged, to an appended leg
  with an `unknown` estimate. An operation that under-declared shows up
  honestly rather than silently losing requests out of its own total.
- An operation may overrun its estimate. `remaining` floors at zero rather than
  going negative, so the bar shows "spent more than planned", not a lie.

### 3. Requests are attributed from the one settle path

`QueuedRequest` gains an optional `planId`, threaded from the side panel through
`scheduleApiRequest` the same way `reason` already is. The scheduler charges the
plan in `recordSettledRequest` — the same method that already feeds the verbose
audit log — so there is one place a request is known to be finally settled and
no second bookkeeping path to drift out of sync with it.

A coalesced GET is charged **once, to the leader**. Its joined waiters never
reach `recordSettledRequest`, which is exactly right: `spent` counts requests
Okta actually saw, not callers that asked. Any other reading could not be
compared against headroom, which is measured in the same units.

### 4. `SchedulerState` publishes every bucket

`SchedulerState` gains `buckets: BucketState[]`, `plans: PlanSummary[]`, and
`minRemainingThresholdPercent`. All three are additive; every existing field
keeps its meaning, including `rateLimitInfo`, which stays as the one-number
summary the collapsed bar shows.

A bucket is listed if **anything** knows about it: an observation from Okta's
headers, a queued or in-flight request, or an active plan's declared leg. That
last source is what makes the feature visible — a bucket can appear with real
`planned` work against it before a single request has been sent.

Two details that are easy to get wrong and are therefore fixed here:

- `limit`/`remaining` are `null`, never `0`, for a bucket Okta has not reported
  on. Unknown is not exhausted, and a gauge that renders one as the other is
  actively misleading.
- `gatedUntil` reflects the gate that **actually governs** the bucket, which for
  an unobserved bucket is ADR-0059's global backstop rather than an entry of its
  own. Reporting anything else would show a bucket as free while the scheduler
  was refusing to dispatch it.

Buckets sort by _fraction_ remaining, not absolute — 50 left of 100 is under
more pressure than 200 left of 1000 — with unobserved buckets last and a name
tiebreak so row order does not jitter between pushes. This is what lets the bar
render the top few rows and collapse the rest without deciding for itself which
matter.

### 5. One message action, not four

`updateOperationPlan` carries a discriminated `op` of `declare | refine |
complete | cancel`. They share a validator, a sender check, and a plan id;
splitting them into four actions would have meant repeating all three.

Its security posture is `scheduleApiRequest`'s: `rejectIfFromTab`, so a content
script can never author what the side panel's own bar reports. What the
validator actually guards is volume rather than privilege — the ledger cannot
redirect a request — so it length-caps every string, caps the leg array, and
holds each leg endpoint to the same same-origin single-`/` shape a real request
must satisfy, since a leg endpoint is bucketed by the same rule.

### 6. Cancelling one operation is not cancelling everything

`cancelPlan(planId)` closes a plan and drops **only** the queued requests
carrying that id. In-flight requests are left to settle: they have already spent
their budget, so killing them would cost the quota without saving anything.

`clearQueue()` — the whole-queue drain behind ADR-0008's single Cancel — is
unchanged, and additionally resets the ledger, because no declared plan should
survive a cancel that threw its work away.

### 7. Two integration points, both explicit

There is no `AsyncLocalStorage` in the browser, so a plan id cannot be ambient.
It is threaded the same way `reason` already is:

- **`CoreApi.runOperation({ plan })`** for a per-item fan-out. Its cost is exact
  by construction — the item list is in hand — so the estimate is
  `items × requestsPerItem`, or a floor via `approximate` when the per-item
  worker itself paginates. The worker receives the `planId` as a third argument.
- **`CoreApi.withPlan(name, legs, run)`** for walk-shaped work. The callback gets
  a handle carrying `planId` and a `refine` to raise the estimate as pages land.
  The plan is closed in a `finally`, on success, failure, or cancellation.

`shared/scheduler/planEstimate` holds the estimators, and every one of them
converts a number the extension **already paid for**: an `expand=stats` member
count, an `x-total-count` header, a persisted `SyncMeta.itemCount`, an item list
length, a `Link` header. **No estimator issues a request to learn what it will
declare** — a cost display that spends budget to report on budget would be
self-defeating.

Plan control messages ride the same `chrome.runtime` channel as
`scheduleApiRequest` but are not requests. Test harnesses that script per-call
responses on that channel must route them past the queue, and helpers that count
"scheduler calls" must filter on `action === 'scheduleApiRequest'` — otherwise
control-plane chatter reads as API traffic.

### 8. The bar reads the scheduler's threshold

`useActivityBar` reads `minRemainingThresholdPercent` off the state instead of
hardcoding 20. The bar and the scheduler now draw the same line by construction.

## Consequences

**The bar can finally answer "what is coming".** A declared operation shows
spent against planned, and each bucket shows how much of its remaining headroom
is already spoken for — the inventory the extension always had and never said.

**Estimator drift is a real, ongoing cost.** A refactor that adds a request to a
walk without updating its leg makes the bar quietly wrong. The mitigation is
tests that drive a known page count and assert declared == actual, rather than
tests that only assert the plan exists; and the appended-`unknown`-leg behaviour
above, which makes an under-declaration visible instead of silent.

**Two hard problems are deliberately not solved.** Gating still charges total
in-flight requests against the governing budget rather than per-bucket
(ADR-0059's safe over-charge); `BucketState.active` is per-bucket for display
only, and making the gate use it is a behaviour change that wants its own
change. And `unknown` legs mean a plan total can be a floor rather than a
number — the bar must render that as a floor, not round it away.

**`RateLimitDetector.getState()` has a production caller for the first time.**
It was written for ADR-0059 and used only by tests; the bucket view is what it
was always for.
