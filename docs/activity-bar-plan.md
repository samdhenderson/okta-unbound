# Plan: Unified Activity Bar + working cancellation

Status: **implemented** (see ADR-0008) · Owner: side-panel · Replaced the
`LoadingBar` + `SchedulerStatusBar` pair with a single `ActivityBar`.

## Problem

The side panel renders **two** independent fixed bottom bars:

| Bar                  | File                     | Source             | z-index | Content                                                                                             |
| -------------------- | ------------------------ | ------------------ | ------- | --------------------------------------------------------------------------------------------------- |
| `LoadingBar`         | `LoadingBar.tsx`         | `ProgressContext`  | `z-50`  | operation name, spinner, elapsed / ETA, API-call count, `current/total`, % progress bar             |
| `SchedulerStatusBar` | `SchedulerStatusBar.tsx` | `SchedulerContext` | `z-999` | status dot, queue length, active, rate-limit headroom, cooldown countdown, processed/failed, Cancel |

Both are `fixed bottom-0 left-0 right-0` and are rendered unconditionally in
`App.tsx`. Confirmed issues:

1. **Overlap.** Two `fixed bottom-0` elements with different z-indexes; the
   scheduler bar (`z-999`) paints over the loading bar (`z-50`). The shell only
   reserves `pb-14` — one bar's worth of space.
2. **Layout jank.** Every chip is conditionally _mounted/unmounted_
   (`{state.queueLength > 0 && …}`, the Cancel button, rate-limit, cooldown,
   processed). As requests flow, chips pop in/out and the row reflows; the Cancel
   button appears/disappears on the right edge. Nothing reserves space.
3. **Cancel is broken — three disconnected mechanisms:**
   - **Scheduler bar → `clearQueue`** (`apiScheduler.ts`): sets `this.queue = []`
     but never **rejects** dropped requests' promises, never clears the
     `coalescableGets` waiters, and never touches `activeRequests`. Awaiting
     callers hang; nothing tells the driver loop to stop.
   - **`useOktaApi.cancelOperation`**: sets a _local_ `isCancelled` state and
     calls `abortController.abort()`, but the signal is never passed into any
     operation and `checkCancelled` closes over a **stale** `isCancelled`, so the
     running loop never observes `true`. Not surfaced in either bar.
   - **`ProgressContext.canCancel`**: decorative — no cancel function exists and
     `LoadingBar` renders no cancel control.

   Net effect: Cancel empties the background queue, but the operation driver
   (e.g. `groupBulkOps.executeBulkOperation`'s loop) keeps iterating and
   re-enqueues the next request → "it cancels a request but the next action starts
   up next."

## Decisions (locked)

- **Cancel scope:** stop the **whole operation + queue**. The driving loop stops
  enqueuing AND the queue is drained/rejected. In-flight requests already sent to
  the content script are allowed to settle (no mid-fetch abort).
- **Idle bar:** **slim persistent** bar — always shows a compact `Ready` status +
  rate-limit headroom in stable slots; expands with progress / queue / ETA when
  work starts. Layout never jumps.

## Design goals

- One bar, one z-layer, one reserved height. No overlap.
- Stable layout: regions never mount/unmount; content swaps in place.
- One cancellation path that genuinely stops everything.
- Odyssey tokens only, shared `Button`, a11y per `docs/ux-guidelines.md`.

## Phase 1 — One combined Activity Bar (overlap + jank)

New `ActivityBar` component replacing both bars, driven by a small view-model hook
`useActivityBar` that merges `useProgress()` + `useScheduler()`. Keep both
providers; merge only presentation + derived state. Render once in `App.tsx`;
remove the two old bars.

Fixed-height bar with a **reserved 3-region grid** whose cells never
mount/unmount — content swaps via text/opacity, not DOM add/remove:

- **Left — Status:** always-present status dot + label. Active operation → show
  operation name; idle → scheduler status (`Ready`/`Processing`/`Throttled`/
  `Cooldown`/`Paused`).
- **Center — Metrics strip:** fixed-width slots for `Queue`, `Active`,
  `Rate limit`, `ETA/cooldown`. Empty slots render a muted `–` placeholder (or
  `visibility:hidden`) rather than unmounting. Rate-limit shifts to
  `warning`/`danger` tokens as headroom drops.
- **Right — Actions:** permanently reserved (fixed min-width) area for
  Pause/Resume + Cancel. Buttons **disable** rather than disappear, so the right
  edge never shifts.
- **Progress track:** full-width, stays mounted at 0% when idle.

Cleanup while here: drop raw `bg-white`/`bg-blue-50`, use tokens; shared `Button`;
`aria-hidden` on decorative dots/SVG; keep component < ~300 lines with logic in the
hook.

## Phase 2 — Real cancellation (one path)

1. **`clearQueue` rejects, not just clears** (`apiScheduler.ts`): reject every
   dropped queued request and every `coalescableGets` waiter with a typed
   `OperationCancelledError`, then clear the coalescing map. Awaiting loops unwind
   instead of hanging.
2. **Ref-backed cancel signal for drivers:** replace the stale-closure
   `isCancelled` in `useOktaApi` with `isCancelledRef`; check it between iterations
   in the operation loops (`groupBulkOps`, `groupCleanup`, exports, merges) so
   `checkCancelled()` actually throws mid-loop.
3. **Bar Cancel → single `cancelActivity()`:** (1) flip the shared cancel signal so
   drivers stop enqueuing, (2) call `clearQueue()` to reject in-flight/queued work.
   Operations catch `OperationCancelledError` and report "cancelled" (status
   `warning`) via existing `onResult`.
4. **Cancel affordance:** show whenever an operation is active _or_ the queue is
   non-empty; name the consequence ("Cancel operation — N requests pending").

## Phase 3 — Tests + docs

- Vitest: `clearQueue` rejects queued + coalesced promises; a bulk loop stops
  enqueuing after cancel; `ActivityBar` renders idle→active→cooldown without
  unmounting slots.
- Docs: `docs/state-management.md` (bar/context consolidation),
  `docs/architecture.md` (cancel path), `docs/ux-guidelines.md` note, and an ADR
  recording the merge + single cancellation model.

## Files touched (anticipated)

- Add: `src/sidepanel/components/ActivityBar.tsx`,
  `src/sidepanel/hooks/useActivityBar.ts`, `docs/adr/NNNN-activity-bar.md`.
- Edit: `App.tsx`, `apiScheduler.ts` (+ `types.ts` for `OperationCancelledError`),
  `useOktaApi.ts`, operation drivers (`groupBulkOps`, `groupCleanup`, exports,
  `useGroupMerge`), `ProgressContext`/`SchedulerContext` as needed.
- Remove: `LoadingBar.tsx`, `SchedulerStatusBar.tsx` (after `ActivityBar` lands).
