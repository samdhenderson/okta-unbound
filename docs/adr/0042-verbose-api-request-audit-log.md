# ADR-0042: A verbose API request audit log, grouped by reason, capped at 50

- Status: Accepted
- Date: 2026-08-24
- Relates to: ADR-0041 (deferred "audit logging" to a future ADR), ADR-0040
  (the background-owned org inventory sync, whose traffic this log must also
  see), ADR-0018 (tabs stay mounted; gate live listeners on `isActive`)

## Context

The History tab (`AuditLogViewer.tsx`) already shows a recorded history — but
of **undo-able write operations** (`shared/undoManager.ts`/`undoTypes.ts`),
capped at 50 entries in `chrome.storage.local`. It has no concept of an
individual Okta API request, and most of the app's traffic — every read —
never touches it at all. A separate, dormant IndexedDB `auditStore.ts` exists
but only logs write-operation _outcomes_ (one row per bulk mutation, with a
rolled-up `apiRequestCount` integer), and nothing reads it. ADR-0041's read-only
API Explorer holds only its _last_ manually issued request in component state.
No mechanism in this codebase records "which endpoint did we hit, and why" at
request granularity, and ADR-0041 explicitly deferred that as a future ADR.

The ask: an opt-in **verbose mode** in the History tab that shows every Okta
API request the extension made and why — but summarized, not flooded. A page
load or an org sync can fan out into dozens or thousands of individual GETs;
showing each as its own row would make the tab unusable. Large batches need to
collapse into one line ("42 requests — Populate Groups page") with the detail
one click away, and the log needs to stay bounded — roughly the last 50
entries, the same cap the existing undo-action log already uses, with a batch
occupying one slot regardless of how many requests it folds in.

The scheduler-level architecture already answers where this must be captured.
Every Okta call funnels through one place: `apiScheduler.scheduleRequest()` in
the background service worker. That includes calls the **background makes
directly**, bypassing the side panel entirely — the ADR-0040 org inventory
sync calls `scheduler.scheduleRequest()` straight from
`background/snapshotBridge.ts` and `background/index.ts`. That background sync
is almost certainly where the biggest batches an admin would think of as
"populating this page" actually happen (the side panel usually just reads the
already-synced snapshot), so a log that only watched the side panel's
`makeApiRequest` calls would miss most of the real traffic.

## Decision

**Thread an optional, then increasingly-required `reason` end to end; capture
and group at the scheduler, the one place that sees every request; flush a
batch when the scheduler itself goes idle — not on an independent timer — so
nothing is lost to MV3 service-worker suspension; and render it as an opt-in
layer inside the existing History tab, not a new tab.**

### 1. `reason` is threaded end-to-end, and required at the call-site API

`apiScheduler.scheduleRequest()`, `QueuedRequest`
(`shared/scheduler/types.ts`), and the `scheduleApiRequest` message payload
all gained an optional `reason?: string` (validated in
`background/index.ts`'s `isValidScheduleRequest`: a plain string, capped at 80
characters, so a malformed value can't bloat storage). It stays _optional_ at
that transport layer — a message that omits it is not malformed, it just logs
under a generic fallback — but at the call-site API it is made **required**:
`useOktaApi/core.ts`'s `makeApiRequest(endpoint, options)` takes a
`MakeApiRequestOptions` object whose `reason` field has no `?`. That single
required field, at the one function every Okta call in the side panel funnels
through, is what makes coverage enforceable rather than aspirational —
TypeScript flags every call site that doesn't supply one. Every exported
operation across the `useOktaApi/*` modules (and the handful of top-level
sidepanel hooks that call `makeApiRequest` directly) now carries a specific,
human-readable reason (e.g. `'Load group members'`,
`'Remove user from group'`, `'Bulk remove user from group'`); a call already
inside a `coreApi.runOperation(name, ...)` task reuses that `name` rather than
inventing a second label. The two background-internal `scheduleRequest` calls
(the org sync's page-fetch closure and its probe/drift-check calls) reuse
`CollectionSpec.context` — already the sync's own per-collection label — as
`Org inventory sync: <context>`.

The switch from positional args (`endpoint, method, body, priority`) to an
options object at the `makeApiRequest` call-site API is a deliberate ergonomic
choice made once required-ness was decided: most existing calls only ever set
`method`, and a required `reason` slotted in positionally would have forced
`makeApiRequest(url, undefined, undefined, undefined, 'reason')` at dozens of
call sites that just want a plain GET with a reason.

### 2. Capture and batch-grouping live in `shared/requestLog.ts`, owned by the background

A new module, `recordRequest()`, is called once per request settling (final
success, or final failure after retries — never a mid-flight retry) from
`ApiScheduler.executeRequest`. Requests sharing a `reason` fold into one
open, in-memory batch (`Map<reason, PendingBatch>`) instead of becoming one
row per request — this is what turns a page load's fan-out of GETs into a
single "42 requests — Populate Groups page" line, with no caller needing to
manage an explicit batch id.

A coalesced GET (`ApiScheduler`'s own dedup, joining an in-flight identical
request) is recorded once, for the leader that actually hit the network — a
joined waiter's own `reason` does not get a separate entry. Documented as a
known, minor limitation rather than solved: giving joiners their own entries
would require threading reason/timing through the waiter fan-out path
`executeRequest` doesn't touch.

### 3. A batch flushes when the scheduler goes idle, not on its own timer

The obvious design — a per-batch `setTimeout` that flushes after some idle
window — has a real failure mode in this codebase: the MV3 service worker is
_deliberately_ allowed to suspend once `ApiScheduler.drainQueue()` detects it
is fully idle (`stopProcessing()`), so a pending timer would not survive
suspension, silently losing whatever batch was still open. Instead,
`flushAllPending()` is called from that exact same idle-detection branch in
`drainQueue()` — the same moment the scheduler already decides it is safe to
let the worker suspend. This ties flushing to a real lifecycle event the
scheduler already computes, rather than a second, independent notion of
"idle enough to write," and it means an open batch is _never_ silently lost to
suspension: the worker cannot suspend before that same code path runs.

One consequence: a long-running, continuously busy stretch (a large org sync
with no gaps) keeps its batch open the whole time and only appears once the
scheduler fully idles — the verbose log is a retrospective audit trail, not a
live progress view (the scheduler already has one of those, surfaced
elsewhere).

### 4. Storage: `chrome.storage.local['apiRequestLog']`, capped at 50, redacted before write

A flushed batch becomes one `RequestLogEntry` — `id`, `timestamp`, `reason`,
`requestCount`, a deduped and capped (`MAX_LOGGED_ENDPOINTS = 20`) sample of
`{method, endpoint}` pairs with an `endpointsTruncated` flag when the batch
had more distinct endpoints than the sample, `durationMs` (first request
scheduled to last settling), and `outcome` (`'all' | 'partial' | 'none'`).
Entries persist newest-first, capped at 50 (`shared/requestLogTypes.ts`,
mirroring `shared/undoTypes.ts`'s `UndoHistory` shape) — a batch of any size
still occupies exactly one slot, the same convention `shared/undoManager.ts`
already uses for the 50-entry undo-action cap.

Every `endpoint` string is redacted through the existing pattern-based
`redactJson`/`redactString` (`shared/utils/redact.ts`, ADR-0041) before it is
ever written to storage — an admin-typed `q=`/`search=`/`filter=` query value
can carry a name or email, and the no-PII-at-rest rule applies here exactly as
it does everywhere else. This reuses ADR-0041's redaction utility rather than
inventing a second one; `oktaOrigin`-based hostname stripping is not
applicable here since `endpoint` is always a validated same-origin _path_
(`isValidScheduleRequest` requires a leading `/`), never a full URL.

### 5. UI: an opt-in layer inside the existing History tab, not a new tab

`AuditLogViewer.tsx` gains a `Verbose` `Checkbox` (reusing the shared
primitive, not a bespoke toggle). Off (the default), the tab is byte-for-byte
what it was before this ADR. On, `apiRequestLog` entries merge by timestamp
into the same chronological list the undo-action entries already render in,
via a new `RequestLogRow` component that mirrors `AuditLogRow`'s `ListRow` +
`IconButton`/`aria-expanded` disclosure shape exactly — a single-request entry
renders inline with no chevron; a batch collapses to `N requests — reason`
with the per-endpoint detail one click away. Both storage keys
(`undoHistory`, `apiRequestLog`) are watched by the same `chrome.storage`
listener, gated on `isActive` per ADR-0018, so toggling Verbose on shows
current data immediately with no extra fetch. Clear History clears both keys
together, since they are presented as one section.

## Consequences

- **A new, small, closed set of transport/message surface changes**: `reason`
  on `QueuedRequest`, `scheduleRequest()`, and the validated
  `scheduleApiRequest` message. All are additive and optional at that layer
  (an old cached bundle omitting `reason` still schedules normally; the entry
  just logs under the generic `'Unlabeled request'` fallback) — no existing
  contract is narrowed, and no new message _action_ was added.
- **`makeApiRequest`'s call-site signature changed** from positional args to
  an options object, and every one of its ~107 call sites (plus the ones
  outside `useOktaApi/` that call it directly) was touched to supply a real
  `reason`. This was a large, mechanical sweep, not a small patch — full
  coverage was a deliberate choice over a partial "high-value paths only, rest
  falls back to a generic label" MVP, so the log has real labels from day one
  rather than a punch-list of `'Unlabeled request'` rows to fill in later.
- **Ongoing tax, not a growing backlog**: because `reason` is a required field
  on the call-site API, every _new_ `makeApiRequest` call site a future
  feature adds must supply one — TypeScript enforces it at that point, the
  same way it enforced full coverage during this sweep.
- **The log is advisory/debugging-grade, not a compliance audit trail.** A
  coalesced GET's joined waiters aren't separately recorded (§2); a batch that
  never sees a scheduler idle gap won't appear until it finally does (§3); and
  `endpoints` is a capped, truncatable sample for a very large batch, with
  `requestCount` and `endpointsTruncated` stating so rather than silently
  under-reporting. None of these change what Okta itself did — they're
  accepted shape limits of a browser-side, storage-bounded log, consistent
  with `redact.ts`'s own "safe enough, not DLP-grade" posture (ADR-0041).
