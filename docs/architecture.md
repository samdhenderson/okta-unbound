# Architecture

Chrome MV3 side-panel extension. React 19 + TS 5.9 + Tailwind v4, bundled by Vite +
`@crxjs/vite-plugin` from `manifest.json`.

## The four contexts

| Context                     | Entry                     | Responsibility                                                                                 |
| --------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| Side panel (UI)             | `src/sidepanel/`          | React app: tabs, components, hooks, contexts                                                   |
| Background (service worker) | `src/background/index.ts` | Context menus, alarms, notifications, downloads, and the global `ApiScheduler`                 |
| Content script              | `src/content/index.ts`    | Injected on Okta pages; the only place with the authenticated session; does the actual `fetch` (decomposed — see below) |
| Shared                      | `src/shared/`             | Cross-context logic: types, cache, rule engine, scheduler, storage, utils                      |

## Message-passing pipeline

```
Side panel (useOktaApi)  →  Background (ApiScheduler: rate limit, retry, backoff)  →  Content script (fetch, credentials:'include', X-Okta-Xsrftoken)  →  Okta API
```

- **API calls only happen in the content script**, which holds the live Okta
  session cookies + XSRF token (scraped from the DOM at fetch time by `getXsrfToken`
  in `apiRequest.ts`, never persisted). No tokens are stored anywhere. Keep it that
  way.
- The content script is decomposed: `src/content/index.ts` is a ~255-line router
  that dispatches messages to handler modules (`apiRequest.ts`, `groupHandlers.ts`,
  `userHandlers.ts`, `ruleHandlers.ts`, `pageContext.ts`, `exportHelpers.ts`,
  `indicator.ts`). The only raw Okta `fetch(` lives in `apiRequest.ts`.
- **All raw Okta API traffic must go through the scheduler path.** `makeApiRequest`
  (`useOktaApi/core.ts`) routes every Okta call through the background scheduler — do
  not add side-panel→content calls that fetch Okta directly and bypass rate limiting.
  Direct `sendMessage` to the content script is the legitimate transport for
  non-API content-script messages (e.g. streaming a CSV export to a download); it
  carries no raw Okta API traffic.
- `ApiScheduler` (`shared/scheduler/apiScheduler.ts`): priority queue, concurrency
  cap (5), cooldowns, exponential backoff, rate-limit detection.
- **Cancellation** is one signal end to end (ADR-0008):
  `OperationCancelledError` + `createCancellation()` (`shared/scheduler/cancellation.ts`).
  `ProgressContext` owns the current operation's token; `useOktaApi.checkCancelled`
  polls it (loops must call it between iterations and let the error propagate);
  `ApiScheduler.clearQueue()` rejects dropped/coalesced requests with it. The
  `ActivityBar`'s Cancel trips the token **and** drains the queue.
- **Batch operations** (ADR-0009): `runBatch` (`shared/scheduler/runBatch.ts`) is the
  pure concurrency-bounded runner, and `coreApi.runOperation(name, items, task)` is the
  standard way to run any multi-call read or write. It bounds concurrency (default 5),
  reports `total/completed/active/failed` to the activity bar, and is cancellable.
  Prefer it over hand-rolled `for await` / `Promise.all` loops.

## The API client: `useOktaApi/`

`src/sidepanel/hooks/useOktaApi/` is a factory decomposed into 14 focused modules
(`core`, `groupMembers`, `groupBulkOps`, `groupCleanup`, `groupDiscovery`,
`groupAnalysis`, `ruleImpact`, `ruleWrites`, `userOperations`, `exportOperations`,
`pushGroupOps`, `utilities`, `types`, `index`). `core.ts` exposes `makeApiRequest`
(via background) and
`sendMessage` (direct to content). **This module layout is the reference pattern**
for decomposing other large areas — extend it, don't reinvent it.

## State

Pure React — hooks + two contexts (`SchedulerContext`, `ProgressContext`). No
Redux/Zustand/React Query. See [state-management.md](./state-management.md) for the
hook-vs-context-vs-local decision and how the god components were decomposed.

## Persistence

- `chrome.storage.local` / `sync` — tab state, preferences.
- IndexedDB via `idb` — audit log (`shared/storage/auditStore.ts`).

## Type safety

`tsconfig` is `strict`. Okta responses must be validated at the content-script
boundary with **zod** (ADR-0006) — do not cast JSON to `any`. Shared types live in
`src/shared/types.ts` plus per-domain `types.ts` files.
