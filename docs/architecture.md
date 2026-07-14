# Architecture

Chrome MV3 side-panel extension. React 19 + TS 5.9 + Tailwind v4, bundled by Vite +
`@crxjs/vite-plugin` from `manifest.json`.

## The four contexts

| Context                     | Entry                     | Responsibility                                                                                 |
| --------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| Side panel (UI)             | `src/sidepanel/`          | React app: tabs, components, hooks, contexts                                                   |
| Background (service worker) | `src/background/index.ts` | Context menus, alarms, notifications, downloads, and the global `ApiScheduler`                 |
| Content script              | `src/content/index.ts`    | Injected on Okta pages; the only place with the authenticated session; does the actual `fetch` |
| Shared                      | `src/shared/`             | Cross-context logic: types, cache, rule engine, scheduler, storage, utils                      |

## Message-passing pipeline

```
Side panel (useOktaApi)  →  Background (ApiScheduler: rate limit, retry, backoff)  →  Content script (fetch, credentials:'include', X-Okta-Xsrftoken)  →  Okta API
```

- **API calls only happen in the content script**, which holds the live Okta
  session cookies + XSRF token (scraped from the DOM, never persisted). No tokens
  are stored anywhere. Keep it that way.
- **All API traffic must go through the scheduler path.** There is a second, direct
  side-panel→content path (`useOktaApi/core.ts:31`) that **bypasses rate limiting** —
  do not add new direct calls; migrate existing ones onto the scheduler.
- `ApiScheduler` (`shared/scheduler/apiScheduler.ts`): priority queue, concurrency
  cap (5), cooldowns, exponential backoff, rate-limit detection.

## The API client: `useOktaApi/`

`src/sidepanel/hooks/useOktaApi/` is a factory decomposed into ~13 focused modules
(`core`, `groupMembers`, `groupBulkOps`, `groupCleanup`, `groupDiscovery`,
`groupAnalysis`, `userOperations`, `exportOperations`, `pushGroupOps`, `utilities`,
`types`, `index`). `core.ts` exposes `makeApiRequest` (via background) and
`sendMessage` (direct to content). **This module layout is the reference pattern**
for decomposing other large areas — extend it, don't reinvent it.

## State

Pure React — hooks + two contexts (`SchedulerContext`, `ProgressContext`). No
Redux/Zustand/React Query. See [state-management.md](./state-management.md) for the
hook-vs-context-vs-local decision and the god-component decomposition target.

## Persistence

- `chrome.storage.local` / `sync` — tab state, preferences.
- IndexedDB via `idb` — audit log (`shared/storage/auditStore.ts`).

## Type safety

`tsconfig` is `strict`. Okta responses must be validated at the content-script
boundary with **zod** (ADR-0006) — do not cast JSON to `any`. Shared types live in
`src/shared/types.ts` plus per-domain `types.ts` files.
