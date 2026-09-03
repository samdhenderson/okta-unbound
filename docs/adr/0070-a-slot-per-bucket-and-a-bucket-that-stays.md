# ADR-0070: A slot per bucket, and a bucket that stays after its work is done

- Status: Accepted (2026-09-03, exactly as proposed — both numbers and the no-exemption
  position unchanged)
- Date: 2026-09-03
- Extends: [ADR-0059](./0059-one-bucket-is-not-the-org.md), which made the _gates_
  per bucket but left the _slots_ global
- Relates to: [ADR-0060](./0060-declared-work-is-inventory.md) (the plan ledger and
  the per-bucket state the Activity Bar reads), [ADR-0012](./0012-no-test-tampering.md)
  and [ADR-0022](./0022-test-lifecycle.md) (why `maxConcurrent`
  keeps its name), [ADR-0040](./0040-the-background-owns-the-org.md) (the snapshot
  fan-out that fills the scheduler)

## Context

ADR-0059 split the rate-limit **gate** by Okta bucket. It did not split the
**concurrency ceiling**, and the difference between those two things is the whole
of this record.

### Cross-bucket progress exists at the gate, and stops at the slot

`drainQueue` (`src/shared/scheduler/apiScheduler.ts`) scans the priority-ordered
queue and dispatches the first request whose own gate says `'go'`, so a
cooling-down `/api/v1/apps` fan-out already fails to hold up a `/api/v1/groups`
lookup. That part works.

What binds instead is the single loop condition:

```ts
while (this.activeRequests.size < this.config.maxConcurrent && this.queue.length > 0) {
```

`maxConcurrent` is `5`, set in `src/background/index.ts` and in
`DEFAULT_CONFIG`. There is **no per-bucket concurrency cap at all**. So five
in-flight requests to one family occupy every slot the extension has, and a
request to a family with a full, freshly-observed budget waits behind them —
not because Okta would refuse it, but because the scheduler has run out of
seats.

This is not a hypothetical shape. `SHARD_CONCURRENCY` in
`src/shared/snapshot/snapshotSync.ts` is `5`, and its comment says why:
"Matched to the scheduler's own `maxConcurrent` so the fan-out keeps its slots
busy." A snapshot walk is _designed_ to fill the scheduler. Every collection
walk is therefore a period in which one bucket owns all five slots.

The `interactive` priority does not rescue this. `SchedulerConfig`'s own
documentation in `src/shared/scheduler/types.ts` states the limit plainly: an
interactive request "still respects `maxConcurrent`". It jumps the _soft_ gate,
never the ceiling. So the one class of request a user is actually watching is
the one class that a background fan-out can fully block.

### A bucket disappears from the Activity Bar when its work finishes

`buildBucketStates` rebuilds `BucketState[]` from scratch on every `getState()`
call, as the union of four **live** sources: header observations, the queue,
in-flight requests, and active plans' declared legs.

Nothing removes a bucket. It simply stops being reconstructed, once all four
sources have gone quiet — and they go quiet on three unrelated clocks:

- the queue and in-flight set, immediately on the last settle;
- the plan, when `PlanRegistry` reaps it at `PLAN_STALE_MS` (5 minutes,
  `src/shared/scheduler/plan.ts`);
- the header observation, when `RateLimitDetector.cleanExpiredLimits` drops it
  at `now >= reset` — roughly 60 seconds after the last response.

So the row for a bucket the user just watched work vanishes on a schedule nobody
designed, and the list reflows underneath them. The activity-bar redesign wants
buckets that persist. **That is not a UI change.** A view cannot remember a row
that the state it renders has stopped emitting, and a view that kept its own
copy would be inventing a second source of truth about the rate-limit surface —
the exact defect ADR-0059 removed from the detector. Persistence has to be
retained state in the scheduler, and it therefore has to be decided here rather
than discovered halfway through a component.

## Decision

**The scheduler gains a per-bucket concurrency cap and a higher global ceiling,
and it remembers a bucket for a bounded time after that bucket's work is done.**

This ADR was **Proposed** and is now **Accepted**, as written: the numbers in §2
and the no-exemption position in §9 are the accepted ones. The implementing PR
was gated on that acceptance because this moves the rate-limit surface, which
`CLAUDE.md` treats as a security invariant.

### 1. `maxConcurrent` keeps its name and its meaning; the per-bucket cap is a new field

`SchedulerConfig` gains `maxConcurrentPerBucket: number`. `maxConcurrent` stays
exactly what it is today: the ceiling on `activeRequests.size` across every
bucket.

This is a constraint on the implementation, not a stylistic preference. Nine
suites under `src/shared/scheduler/` construct schedulers with an explicit
`maxConcurrent` — `apiScheduler.buckets`, `apiScheduler.drain`,
`apiScheduler.interactive`, `apiScheduler.plan`, `apiScheduler.session` and
`apiScheduler.zeroBudget` among them — and one of those tests is named for the
behaviour (`dispatches maxConcurrent queued requests in one drain, not one per
50ms tick`). Repurposing the field to mean "per bucket", or renaming it, would
require editing assertions that pass today and describe behaviour that is not
changing. ADR-0012 forbids that, and no amount of "it was only a rename" makes
the diff readable to the next reviewer. **Add the field; do not touch the old
one.**

### 2. Four per bucket, ten in total

- `maxConcurrentPerBucket: 4`
- `maxConcurrent: 10`

The per-bucket number is chosen **below today's global number**, and that is the
safety argument in one line: for any single Okta bucket — which is the only thing
Okta actually meters — this change is strictly _less_ aggressive than what ships
today. A `/api/v1/groups` shard walk that currently runs five wide will run four
wide. There is no bucket, anywhere, that can be hit harder after this change
than before it.

The global number is chosen so the ceiling still binds, and binds at a place
worth binding. At 10, two saturated families leave two seats for a third; a
third saturated family cannot exist. That is deliberate. The global ceiling is
not a rate-limit control — the gates are — it is a bound on how much the
extension asks a service worker and one content script to have in flight at
once, and on how much unattributed budget a cold start can spend before any
family's first response has taught the detector anything (ADR-0059 §2's window).
Ten keeps that window small enough to reason about and large enough that a
background walk and a user's click are not competing for the same five seats.

`SHARD_CONCURRENCY` in `snapshotSync.ts` should follow to `4` in the same
change, with its comment retargeted to `maxConcurrentPerBucket` — its whole
purpose is to match the seats a single-family walk can actually get, and leaving
it at 5 would queue a shard that can never be dispatched out of turn.

**The invariant to encode, and to test:** `0 < maxConcurrentPerBucket <
maxConcurrent`. A per-bucket cap at or above the global one is a per-bucket cap
that does nothing, and the config would be lying about what governs.

### 3. The per-bucket cap keys on the endpoint's bucket, always — unlike the gate

`gateKeyFor` deliberately keys an **unobserved** bucket to `GLOBAL_GATE` (`'*'`),
because a family Okta has said nothing about has no budget of its own to plead
(ADR-0059 §2). The concurrency cap must **not** copy that. It keys on
`bucketOf(request.endpoint)` unconditionally, observed or not.

The two are answering different questions. The gate asks _"is there budget?"_,
which an unobserved family genuinely cannot answer for itself. The cap asks
_"how many seats may this family hold?"_, which has nothing to do with
observation — and pooling every unobserved family under one `'*'` cap would be
worst at exactly the wrong moment: cold start, before any headers exist, when
several families are fanning out at once.

Mechanically this is a third verdict in `gateFor`, returning `'gated'` when the
bucket is at its cap. The count is derived from `activeRequests`, which already
holds each request's `endpoint` — `buildBucketStates` performs the same filter
today. No new bookkeeping, and the scan is over at most `maxConcurrent` entries.

`drainQueue`'s scan already does the right thing with a `'gated'` verdict: skip
this request, try the next. A saturated bucket therefore yields its turn to
another family instead of ending the pass, and priority order within a family is
untouched.

### 4. In-flight requests are charged to the budget that will actually pay them

Raising the ceiling forces a correction that today's code documents as a known
approximation:

> They are charged in full to whichever budget governs this request: we do not
> track which bucket each in-flight request belongs to, and over-charging errs
> toward backing off early, which is the safe direction.

`gateFor` passes `this.activeRequests.size` as the in-flight count to
`isApproachingLimit`. The stated reason — that we cannot tell which bucket an
in-flight request belongs to — is no longer true, and §3 makes the per-bucket
count something the drain computes anyway.

So: **an observed bucket is charged its own in-flight count. The `GLOBAL_GATE`
backstop keeps the full `activeRequests.size` charge.** The signature already
accommodates this; `isApproachingLimit(threshold, inFlightCount, bucket)` takes
the count as a parameter, so this is a caller-side change in `apiScheduler.ts`
only.

Without it, doubling the ceiling doubles a phantom charge: ten in-flight
requests spread across three families would each be subtracted from _every_
family's remaining budget, and buckets would cool down for traffic they never
carried — which would cancel most of the benefit §2 is buying. The global
backstop keeps the pessimistic charge because there the pessimism is honest: an
unobserved family really might be the one paying.

This is a **behaviour change**, and the only one in this ADR that could flip an
existing assertion. Most affected suites construct with `maxConcurrent: 1`,
where the two charges differ by at most one, but the implementation must check
rather than assume. If an assertion pins the over-charge, it is retargeted
assertion-by-assertion under ADR-0022 with a PR note naming what still covers
the soft gate — not deleted, and not quietly relaxed.

### 5. A bucket is remembered for ten minutes, or until it is the thirteenth

The scheduler keeps `rememberedBuckets: Map<string, { lastActiveAt: number }>`,
written from the **single settle path** every request already passes through
(the same path ADR-0060 attributes plan spend from), keyed by
`bucketOf(endpoint)`. `buildBucketStates` unions it in as a fifth source
alongside the four live ones.

Retention is bounded **both** ways:

- **By age.** `BUCKET_MEMORY_MS = 10 * 60 * 1000`. Ten minutes is chosen to
  outlive every clock that currently makes a row vanish — the ~60s header
  expiry and the 5-minute `PLAN_STALE_MS` reap — with margin, so the row's
  disappearance is governed by one decision instead of three accidents. It also
  spans roughly ten Okta rate-limit windows, which means a reader can watch a
  bucket they exhausted actually recover. It is short enough that a panel left
  open over lunch is not still listing this morning's work.
- **By count.** `MAX_REMEMBERED_BUCKETS = 12`, evicting least-recently-active
  first. The source contains ten distinct `/api/v1/{resource}` families today
  (`apps`, `devices`, `factors`, `groups`, `idps`, `meta`, `policies`,
  `rate-limit-settings`, `users`, `zones`), so 12 holds every family the
  extension can reach with room to spare, and the cap is a bound on the list
  the UI must render rather than a rationing decision.

Not bounded by "the org's known bucket set", because there is no such set to
bound by: `bucketOf` derives a key from whatever path was requested, and an
unrecognised path keys under itself (ADR-0059 §1). Growth is bounded in practice
because the paths come from this repo's own call sites and not from Okta
response data — but the count cap stays regardless, so that premise never has to
hold for the map to be safe.

**A bucket with live work or an armed gate is never evicted**, whatever its age
or the map's size. Eviction only ever removes a row that already reports nothing
happening.

### 6. What a remembered bucket reports, so a memory cannot pass for a reading

`BucketState` gains one field: `lastActiveAt: number | null` — when a request
last settled in this bucket during this worker's lifetime, or `null` when none
has. Everything else keeps today's meaning, computed from live sources exactly
as now:

- `queued`, `active`, `planned` are **`0`** for a remembered-but-idle bucket, and
  that is not a fiction — it is the true count from the live sources.
- `limit`, `remaining`, `resetAt` are **`null`** once the detector has expired
  the observation. **The memory never resurrects a lapsed header reading.**
  `RateLimitDetector`'s expiry rule is untouched; a remembered bucket whose
  window has reset reads exactly like an unobserved one, which `BucketState`
  already documents as "unknown budget, and the bar says so rather than drawing
  an empty gauge that reads as exhaustion". This is the load-bearing half of the
  decision: the retained thing is **the row's existence**, never a number.
- `gatedUntil` follows today's rule unchanged, including the `GLOBAL_GATE`
  fallback for an unobserved bucket.

`lastActiveAt` exists so the UI can distinguish _at rest_ from _never used_
without inferring it, and can say "last active 2m ago" in words rather than in a
dimmed colour nobody can read out (the correction ADR-0061 made one level up).
It is a **required** field, so every construction site is forced to answer;
updating the handful of fixtures in `BucketList.test.tsx`, `ResetTimeline.*` and
`BucketRow.stories.tsx` is fixture maintenance, which ADR-0012 permits, not
assertion editing, which it does not.

Sorting stays `byPressure`, with remembered-idle buckets falling where
unobserved buckets already fall — last.

### 7. What this does not change

- **Priority order.** A request is still skipped only when its own gate — now
  including its own bucket's cap — says no.
- **The cooldown machinery.** `enterCooldown`, the `min(configured, msUntilReset)`
  cap, the never-ratchet-down rule, and `minRemainingThreshold` (including
  ADR-0059 §3's org-supplied value) are all untouched.
- **Zero-budget and exceeded-limit handling.** `D-094`'s `percentRemaining`
  guards and `isLimitExceeded` are untouched; a hard-exhausted bucket still
  blocks even an `interactive` request.
- **The plan ledger stays advisory.** Nothing gates on `planned` (ADR-0060).
- **The scheduler path itself.** No new message action, no manifest change, no
  new permission. All API traffic still goes side panel → background → content
  script.

### 8. The tests this needs before it lands

- **One bucket saturates its own cap while another keeps draining.** Queue 8
  `/api/v1/groups` requests and 2 `/api/v1/users`; assert at most 4 groups
  requests are in flight at once and that both users requests dispatch without
  waiting for the groups queue to drain.
- **The global ceiling still binds above the sum of per-bucket caps.** Queue
  across four families; assert `activeRequests.size` never exceeds
  `maxConcurrent`, i.e. the third and fourth families are seat-limited even
  though neither is at its own cap.
- **A bucket at its cap does not end the drain pass** — the ADR-0059 §1 property,
  re-asserted against the new verdict rather than only against the gate.
- **Cooldown behaviour is unchanged**, and **zero-budget behaviour is unchanged**
  — the existing `apiScheduler.buckets` and `apiScheduler.zeroBudget` suites
  should pass untouched, and it is a signal worth stating that they must.
- **Per-bucket in-flight charging** (§4): two families in flight, assert the
  quiet family's gate is judged on its own in-flight count and the `GLOBAL_GATE`
  path still uses the total.
- **`maxConcurrentPerBucket >= maxConcurrent` is rejected** at construction.
- **An `interactive` request waits at a saturated bucket** (§9). It overtakes the
  queue and the soft gate; it does not overtake the cap. This is the assertion
  that pins the accepted position, so a later change granting a reserved seat has
  to delete a test on purpose rather than by accident.
- **A settled bucket is still listed after its queue, plan and observation have
  all gone**, reporting `queued/active/planned = 0` and
  `limit/remaining/resetAt = null`; **it is dropped after `BUCKET_MEMORY_MS`**;
  and **the thirteenth bucket evicts the least-recently-active**, never one with
  live work or an armed gate.

### 9. `interactive` does not exceed `maxConcurrentPerBucket`

This was carried as an open question for the owner in the Proposed draft. It is
answered, and the answer is the one the draft took: **no exemption.** An
`interactive` request jumps the soft gate and the queue's priority order, and it
respects the per-bucket cap exactly as every other request does — which is what
`SchedulerConfig`'s documentation in `src/shared/scheduler/types.ts` already says
about `maxConcurrent` today, now true of both ceilings.

Both sides were real, and recording them is the point of keeping this section
rather than deleting it.

**For an exemption.** A user's click landing in a family that a background walk
has saturated will still wait. That is a milder version of exactly the problem §2
exists to fix, and a single reserved seat would close it.

**Against.** The per-bucket cap is the one guarantee this ADR offers that no
single Okta family is hit harder than it is today. An exemption puts a hole in
that guarantee, and the hole is in the load-bearing sentence — "four is below
today's five" stops being true for the one class of request that arrives when a
user is already impatient and likely to press again.

**Why the conservative side wins on procedure rather than on the merits.** The
two arguments are close enough that the deciding consideration is asymmetry of
regret. Relaxing this later needs only its own evidence, and it does not re-open
the safety claim §2 makes — the claim would simply gain a stated exception,
measured against a real org, with the History tab's request log as the
instrument. Granting the exemption now and withdrawing it later means arguing the
safety claim a second time, from a worse position, because by then something will
depend on the reserved seat. Take the position that can be moved.

So: nothing in the implementation special-cases `interactive` in the cap check of
§3, and a test asserting that an `interactive` request at a saturated bucket
waits is a test of this section, not an oversight to fix.

## Consequences

- **No single Okta bucket is hit harder than it is today.** Four is below the
  five that ships now, so the per-family request rate this change permits is
  lower in every case, and higher only across families that Okta meters
  separately. That is the argument for why raising the global ceiling is safe to
  do at all, and it is the sentence a reviewer should check first.
- **The accepted failure mode is a wider cold start.** Before any family's first
  response, up to ten requests can be in flight against budgets the detector
  knows nothing about, versus five today. If an org is already near a limit when
  the panel opens, this change makes it modestly more likely that the first
  evidence of that is a 429 rather than a soft gate. What contains it is the
  existing ladder, unchanged: `isLimitExceeded` blocks hard-exhausted buckets
  even for `interactive` work, `enterCooldown` arms on the first crossing and
  times itself from Okta's own reset (fixed for 429s by `D-064`), and the
  retry path backs off. This is stated as accepted, not solved.
- **The `interactive` priority finally means something under load.** Its promise
  was always that a user's click overtakes a background walk; with one global
  pool of five that a shard fan-out is designed to fill, it could not keep it.
- **Persistent buckets are a scheduler feature, and the redesign can now be a
  redesign.** The activity bar reads a fifth source it does not maintain, and
  the "when does a row vanish" question has one answer instead of three.
- **`BucketState` grows a field and `SchedulerConfig` grows a field.** Both cross
  to the side panel in the broadcast `SchedulerState`, so both are additive-only
  and neither carries anything sensitive — bucket keys are `/api/v1/{resource}`
  literals from this repo, never org identifiers or user data.
- **A memory is never a number.** The one way this decision could mislead is a
  stale `remaining` presented as current, and §6 forecloses it by retaining only
  the row's existence. If a future change wants "last known budget" on screen, it
  needs its own field, its own label, and its own ADR — not a relaxation of this
  one.
- **Not measured against a live org, and deliberately not claimed to be.**
  Whether 4-wide-per-bucket and 10-wide-total is _better_ in wall-clock for a
  real snapshot walk is an empirical question these numbers do not settle; they
  are chosen to be defensible, not optimal. The History tab's request log is the
  instrument, and re-tuning either constant afterwards is a config change, not a
  design change.

## Alternatives considered

**Raise `maxConcurrent` alone, to 10, with no per-bucket cap.** The smallest
diff, and the one that actually endangers an org: it doubles the parallelism a
single family can take, which is precisely the axis Okta meters. Rejected.

**Add the per-bucket cap and leave `maxConcurrent` at 5.** Safe, and nearly
pointless: with a 4-wide per-bucket cap, five global seats mean a saturated
family already leaves one seat for everything else. The seat scarcity that
starves the interactive lookup is exactly what would remain.

**A queue per bucket instead of one shared FIFO with a per-bucket cap.** A
faithful model of what Okta enforces, and a much larger change: it dissolves the
single priority ordering that `drainQueue`, cancellation, and the plan ledger
all read today, and it needs a scheduling policy _between_ queues that this ADR
would then have to invent. The cap gets the property at a fraction of the
surface. Revisit only if per-bucket fairness turns out to need it.

**Let the Activity Bar remember the rows itself.** Rejected in Context: it makes
the view a second source of truth about the rate-limit surface, and it cannot
work at all across a service-worker suspension, where the panel is handed a
fresh `SchedulerState` and has no basis for deciding which of its remembered
rows survived.

**Persist remembered buckets to `chrome.storage.session` so they outlive an MV3
suspension.** Tempting for symmetry with ADR-0059 §3's memoised threshold, and
rejected: the thing being remembered is _activity_, and activity did not survive
the suspension either. A row that says "active 30 seconds ago" after the worker
was asleep for eight minutes is a lie the ten-minute window would otherwise let
through.
