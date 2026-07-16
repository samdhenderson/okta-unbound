# ADR-0009: One batch runner for all multi-call Okta operations

- Status: Accepted
- Date: 2026-07-16
- Builds on: ADR-0008 (activity bar + cancellation)

## Context

Multi-call flows reinvented their own loop. Writes (`removeDeprovisioned`,
`executeBulkOperation`) ran **sequentially** — awaiting each request — so they never
used the scheduler's 5-slot budget and showed only `current/total`. Reads
(`batchGetUserDetails`, `scanGroupMfa`) used an ad-hoc **`Promise.all` chunk of 3**
with a weaker progress callback and **no cancellation** between chunks. None exposed
the "removing X · Y done · Z active" view, and the scheduler queue was a poor proxy
for operation size (a sequential loop only ever queues ~1).

Rate-limit safety was never the problem — every call already routes through the
background `ApiScheduler` (concurrency cap, cooldown near quota, backoff). What was
missing was a _single_ way to run N calls with bounded concurrency, a real operation
view, and cancellation.

## Decision

**`runBatch` (`shared/scheduler/runBatch.ts`)** — a pure, framework-free worker-pool
runner. Given `items` and a `task`, it runs at most `concurrency` (default 5, the
scheduler cap) at once, reports `{ total, completed, active, failed }` after every
state change, polls a cancellation guard so Cancel stops launching new work
(in-flight settles), and can halt early via `stopOnError` (e.g. a 403 wall). It never
throws for control flow — cancellation/halt are reported on the outcome, so callers
keep partial results.

**`coreApi.runOperation(name, items, task, opts)`** wraps `runBatch` with the global
progress lifecycle (start → `updateBatch` → complete) and the shared cancellation
token. It is the standard way to perform any multi-call read or write; the operation
then appears in the activity bar with a name, live done/active/failed counts, and one
Cancel — for free.

`ProgressContext` gained `completed / active / failed` + `updateBatch`, and the
`ActivityBar` renders the breakdown while an operation runs.

Migrated onto it: `removeDeprovisioned` (write) and `scanGroupMfa` (read). Rate safety
is unchanged — each task still issues a scheduler request (`scanGroupMfa` stays `low`
priority).

## Consequences

- One primitive gives every current and future multi-call flow the same
  concurrency + operation view + cancel. New flows should use `runOperation`.
- `runBatch` owns the operation model, so the counts are exact and operation-scoped
  (not the scheduler's lifetime tally). The scheduler queue/active chips become
  secondary cross-operation "API pressure."
- **Trade-off:** with concurrency > 1, `stopOnError` (e.g. 403) stops _launching_
  new work but cannot recall the ≤ `concurrency-1` requests already in flight. For
  the destructive `removeDeprovisioned` this is acceptable because a 403 on group
  membership removal is a blanket permissions wall — the in-flight siblings fail the
  same way and remove nothing.
- Remaining sequential/paginated reads (`getAllGroupMembers`) can't parallelize a
  cursor chain; they keep their loop but already honor the cancellation token.
  `executeBulkOperation` (per-group orchestration with its own panel UI) and the
  unused `batchGetUserDetails` are follow-up candidates.
