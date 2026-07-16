# ADR-0008: Unified activity bar and one cancellation path

- Status: Accepted
- Date: 2026-07-16

## Context

The side panel rendered two independent fixed bottom bars: `SchedulerStatusBar`
(API scheduler queue/rate-limit state, from `SchedulerContext`) and `LoadingBar`
(operation progress + time estimate, from `ProgressContext`). They were both
`fixed bottom-0` with different z-indexes, so the scheduler bar painted over the
progress bar, and only one bar's height was reserved. Each bar mounted/unmounted
its chips conditionally, so the row reflowed as requests came and went.

"Cancel" was also broken. Three disconnected mechanisms existed:

- `SchedulerStatusBar` → `ApiScheduler.clearQueue()`, which emptied the queue but
  never rejected the dropped requests' promises, so awaiting operation loops hung
  and the driver kept enqueuing the next request.
- `useOktaApi.cancelOperation`, which set a local `isCancelled` state and aborted a
  controller that nothing listened to; `checkCancelled` closed over a stale
  `isCancelled`, so a running loop never observed the cancel. It was wired to no UI.
- `ProgressContext.canCancel`, a decorative flag with no cancel function.

## Decision

**One bar.** A single `ActivityBar` replaces both, split into a pure
`ActivityBarView` (props only, stable reserved-slot layout so values swap in place
instead of reflowing) and a `useActivityBar` hook that merges `SchedulerContext` +
`ProgressContext` into one `ActivityView` and owns the timers. The idle state is a
slim persistent bar (status + rate-limit always shown).

**One cancellation signal.** `OperationCancelledError` +
`createCancellation()` (`shared/scheduler/cancellation.ts`) are the single typed
error and pollable token used end to end. `ProgressContext` owns the token for the
current operation (reset on `startProgress`/`completeProgress`); `useOktaApi`
consumes it (with a local fallback outside a provider) so `checkCancelled` is
stable and ref-backed — fixing the stale closure. `ApiScheduler.clearQueue()` now
**rejects** every dropped request (and coalesced waiter) with
`OperationCancelledError`. The Activity Bar's single Cancel calls
`useActivityBar().cancel`, which trips the operation token **and** drains the queue,
so the whole operation stops and no queued action starts behind it.

## Consequences

- No overlap, no reflow; scheduler and operation state are shown together.
- Cancel actually stops the operation and clears the queue.
- Operation loops must poll `coreApi.checkCancelled()` between iterations and let
  `OperationCancelledError` propagate (bulk ops now do); `resetCancellation()` is
  called at the start of cancellable ops that don't drive the global progress bar.
- `SchedulerStatusBar` and `LoadingBar` are removed.
