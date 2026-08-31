# ADR-0059: One bucket is not the org, and the org sets its own line

- Status: Proposed
- Date: 2026-08-31
- Relates to: ADR-0006 (zod at the boundary), ADR-0009 (one batch runner),
  ADR-0020 (what attribution refuses to guess), ADR-0022 (removing a test),
  ADR-0040 (the background owns the org), `D-064` (a non-ok response drops its
  headers)

## Context

A user reported hitting Okta's rate limit **for applications**. Their org was
nowhere near an aggregate limit; `/api/v1/apps*` alone was exhausted. Two
separate things made that both likely to happen and bad when it did.

### The extension spent app requests it did not need to

`getAppAssignmentCounts` fully paginated `/api/v1/apps/{id}/users` **and**
`/api/v1/apps/{id}/groups` in order to render two integers in a disclosure
panel. On a 10,000-user app that is ~50 requests for one row expansion; five
expansions is 250. Okta returns the same figure in an `x-total-count` header on
a `limit=1` request.

`useUserApps`' granting-group fallback walks `/api/v1/apps/{id}/groups` once per
unresolved app, cached only in the panel-owned in-memory `entityCache` — so
closing the side panel threw the answers away and the next visit re-spent the
whole fan-out. ADR-0040 had already moved the _inventory_ to disk for exactly
this reason; these rows had not followed.

### The scheduler could not see the bucket it was exhausting

Okta buckets rate limits by endpoint family. `RateLimitDetector` keyed
observations by the **full URL including query string and pagination cursor**,
then collapsed everything to a single global minimum. Three consequences:

- The scheduler could not distinguish "the apps bucket is nearly gone" from
  "some bucket somewhere is nearly gone", so it could not act on the first.
- One cooldown covered everything. An apps fan-out running low stalled an
  unrelated interactive group lookup — which had its own untouched budget — for
  the full 30 seconds. `drainQueue` only ever examined `queue[0]`, so a gated
  head stopped the pass outright.
- The map grew an entry per cursor, without bound.

Compounding all of it, `D-064`: the content script built the response header bag
and returned it on the success arm only. A 429 is a non-ok response, so the one
answer that says _"you are throttled, come back at T"_ reached the scheduler
stripped of `X-Rate-Limit-Reset`. Rate limiting was steered entirely by the
headers of requests that had succeeded.

And the cooldown trigger — 10% remaining — was a hardcoded guess about a number
the org had already answered. Okta orgs publish the percentage of a limit at
which they want to be warned (`GET /api/v1/rate-limit-settings/warning-threshold`,
`{"warningThreshold": <int>}`; 90 by default for Workforce, 60 for CIAM). An org
that set 60 was asking for breathing room the extension was not leaving it.

## Decision

### 1. Rate-limit observations are keyed by bucket, and gates are per bucket

`bucketOf(endpoint)` is `/api/v1/{first resource segment}`.
`/api/v1/apps/{id}/groups?limit=200` and `/api/v1/apps?limit=200` both key to
`/api/v1/apps`.

This is deliberately **at least as coarse as Okta's real buckets**, and the
asymmetry is the whole argument: merging two observations that share a bucket
costs a little precision, while splitting two that do not would let one family's
budget be spent twice over. A path that is not `/api/v1/{resource}` keys under
itself, so an unrecognised surface is isolated rather than pooled with something
it has nothing to do with.

The single `cooldownEndsAt` becomes a map of gates, and `drainQueue` scans the
priority-ordered queue for the first request whose gate is clear rather than
stopping at the head. **Priority order is unchanged** — a request is skipped only
when its own gate says no.

### 2. A request is governed by its own bucket, or by the global backstop

This is the load-bearing rule, and the one the first implementation got wrong:

- A bucket Okta **has reported on** answers for itself. `/api/v1/groups` at 95%
  remaining runs while `/api/v1/apps` at 2% waits. This is the payoff.
- A bucket Okta has said **nothing** about falls back to the most-restrictive
  observation anywhere. Not because that is the real constraint — it is not —
  but because an unobserved family has no budget of its own to plead, and the
  conservative reading is the only honest one available.

The second clause is also what makes this change safe: before a family's first
response, behaviour is identical to the single cooldown it replaced. Keeping the
global minimum as an _additional_ gate on every request, which is what the plan
originally said, would have been indistinguishable from doing nothing — the
global minimum is by definition the worst bucket, so every request would have
been gated on it.

### 3. The cooldown trigger comes from the org

The background reads `warning-threshold` once per org per browser session and
sets `minRemainingThreshold = 100 - (warningThreshold - 5)`. Five **percentage
points**, not five percent: a Workforce default of 90 becomes a 15%-remaining
trigger, CIAM's 60 becomes 45%.

The margin exists so the extension is not the traffic that pushes an org over
its own alarm line. A warning the admin does receive should be about something
else; that is the only way the alarm stays useful.

**Best-effort by construction.** Rate Limit Settings is a Super Admin surface, so
403 is an _ordinary_ answer, not an error. 403, 404, 401, a body that fails the
zod boundary, a percentage outside 10–100, or a transport failure all leave
`DEFAULT_CONFIG.minRemainingThreshold` exactly where it was. An out-of-band value
is **refused rather than clamped**: clamping would act on a number the org never
set and hide the disagreement.

The probe costs at most one request per org per browser session, at `low`
priority, through the scheduler path like every other Okta call — so it lands in
the `/api/v1/rate-limit-settings` bucket rather than competing with the app
traffic it exists to protect. It is memoised in `chrome.storage.session`,
deliberately the same lifetime as the scheduler config it feeds: it survives an
MV3 worker suspension (a woken worker re-applies rather than re-asks) and dies
with the browser. Failures are memoised too, so a non-super-admin does not spend
a request per request to learn the same thing.

### 4. Counting asks Okta for the total instead of walking to it

`getAppAssignmentCounts` issues a `limit=1` probe per collection and reads
`x-total-count` via the existing shared `readTotalCount`.

**Probed, never assumed.** This repo has only ever verified that header on
`/api/v1/users/{id}/groups`; its availability is not universal. An absent or
unusable value (`''` and `'   '` both `Number()` to 0) means _count unknown_ and
falls back to the full validated walk — per collection, so one may probe while
the other walks. An org that withholds the header behaves exactly as before.

One real difference, recorded rather than glossed: a walked count reflects
zod-validated rows, a probed count is Okta's own total, so the two can disagree
by however many rows an org sends that fail validation. For a headline number the
probe is the better answer — it is what Okta itself would report.

### 5. The snapshot answers app-group lookups it already knows

`useUserApps`' fallback reads the `appGroups` collection first and drops every
app it has rows for. Those cost zero requests and survive the panel closing.

The scope is bounded and must stay stated: `APP_GROUPS_SPEC` walks that endpoint
for `GROUP_PUSH` apps only, so **an app with no rows means nobody asked**, not
"no groups". Every such app still walks. `readAppGroupsFromSnapshot` therefore
omits an unknown app rather than yielding an empty array — collapsing the two
would manufacture a confident "no group grants this" out of a question never put,
the defect ADR-0020 removed from the attribution paths.

Snapshot-served apps are also left out of the `runOperation` the ActivityBar
reports on: counting work that costs no request would put a number on screen that
nothing corresponds to.

## Consequences

**Good.** Expanding an app row costs 2 requests instead of a number linear in
assignment count. A returning panel session pays nothing for app-group rows the
snapshot holds. An exhausted apps bucket no longer stalls unrelated work. A 429
finally teaches the detector when to come back. The cooldown line is the org's,
not ours. The detector's map stops growing per cursor.

**The cost.** More moving parts in the gate decision, and a second source of
truth for the threshold — the config default and the org setting — which is why
the fallback path is exercised by tests rather than assumed. Per-bucket gating
means a genuinely org-wide constraint (a per-client quota nested inside the org
quota, which Okta also enforces) is only caught once it shows up in a specific
family's headers; the global backstop covers the unobserved case but not that
one. That is a real gap and is accepted, because the headers are the only signal
available and they are per-response.

**`SchedulerState.cooldownEndsAt`** now reports the **latest** armed gate's end
rather than the only one's. The activity bar's countdown therefore never promises
a clear queue while another bucket is still held back; for the one-bucket case it
is the same number as before.

**Not verified against a live org, and deliberately not claimed to be:** whether
`x-total-count` is returned by `/api/v1/apps/{id}/users` and
`/api/v1/apps/{id}/groups`, and whether a given admin's session can read
`warning-threshold`. Both are probe-and-fall-back by construction, so both
answers are safe — but confirming them is what turns "no worse" into the measured
win. The History tab's verbose request log is the instrument.

## Alternatives considered

**Hardcode Okta's published per-endpoint limits.** Okta does not publish a single
per-tier table, and quotas vary by subscription, endpoint, method, and add-ons
such as DynamicScale. The headers are authoritative for the org you are actually
talking to; a table is a guess that goes stale silently.

**Drop the global backstop entirely and gate purely per bucket.** Cleaner, and a
more faithful model of what Okta enforces. Rejected because an unobserved family
would then run unthrottled until its first response, which is precisely the
window in which a cold fan-out does its damage.

**Write the fallback's walked app-group results back into the `appGroups`
snapshot collection** so they persist like the walked ones. Rejected for now:
rows not re-marked by the next sharded walk get swept, so opportunistically
written rows would be deleted by a walk that never asked about them. It needs its
own design and is filed separately.

**Scale the margin proportionally (5% of the threshold) rather than by
percentage points.** Rejected as the explicit call: a fixed offset gives the same
absolute breathing room to a cautious org and a permissive one, which is what the
margin is for.
