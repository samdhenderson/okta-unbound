# Architecture

Chrome MV3 side-panel extension. React 19 + TS 5.9 + Tailwind v4, bundled by Vite +
`@crxjs/vite-plugin` from `manifest.json`.

## The four contexts

| Context                     | Entry                     | Responsibility                                                                                                          |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Side panel (UI)             | `src/sidepanel/`          | React app: tabs, components, hooks, contexts                                                                            |
| Background (service worker) | `src/background/index.ts` | Context menus, alarms, notifications, downloads, and the global `ApiScheduler`                                          |
| Content script              | `src/content/index.ts`    | Injected on Okta pages; the only place with the authenticated session; does the actual `fetch` (decomposed — see below) |
| Shared                      | `src/shared/`             | Cross-context logic: types, cache, rule engine, scheduler, storage, utils                                               |

## Message-passing pipeline

```
Side panel (useOktaApi)  →  Background (ApiScheduler: rate limit, retry, backoff)  →  Content script (fetch, credentials:'include', X-Okta-Xsrftoken)  →  Okta API
```

- **API calls only happen in the content script**, which holds the live Okta
  session cookies + XSRF token (scraped from the DOM at fetch time by `getXsrfToken`
  in `apiRequest.ts`, never persisted). No tokens are stored anywhere. Keep it that
  way.
- The content script is decomposed: `src/content/index.ts` is a small router
  that dispatches messages to handler modules (`apiRequest.ts`, `groupHandlers.ts`,
  `userHandlers.ts`, `pageContext.ts`, `indicator.ts`). The only raw Okta
  `fetch(` lives in `apiRequest.ts`.
- **All raw Okta API traffic must go through the scheduler path.** `makeApiRequest`
  (`useOktaApi/core.ts`) routes every Okta call through the background scheduler — do
  not add side-panel→content calls that fetch Okta directly and bypass rate limiting.
  Direct `sendMessage` to the content script is the legitimate transport for
  non-API content-script messages (e.g. reading page context: the current
  group/user/app or the Okta origin); it carries no raw Okta API traffic.
- `ApiScheduler` (`shared/scheduler/apiScheduler.ts`): priority queue, concurrency
  cap (5), cooldowns, exponential backoff, rate-limit detection.
- **Rate limiting is per Okta bucket** (ADR-0059). Okta quotas are bucketed by
  endpoint family, so `RateLimitDetector` keys observations by
  `bucketOf(endpoint)` (`/api/v1/{resource}`) and the scheduler holds one gate
  per bucket rather than one cooldown for everything — an exhausted
  `/api/v1/apps` does not stall a `/api/v1/groups` lookup with its own budget.
  A request whose bucket Okta has not reported on yet falls back to the
  most-restrictive observation anywhere. The cooldown _threshold_ is the org's
  own `warning-threshold` less 5 points (`shared/scheduler/rateLimitSettings.ts`,
  probed once per org per browser session by `background/rateLimitThreshold.ts`),
  falling back to the configured 10% whenever the org does not give a usable
  answer.
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

## The org snapshot: background-owned inventory (ADR-0040)

The pipeline above is a **request** path — the panel asks, the answer arrives, the
panel forgets. Org-wide collections (groups, rules) run on a second path, where
the background owns the data and the panel reads it:

```
Okta tab settles ─► snapshotScheduler ─► snapshotSync ─► ApiScheduler ('low') ─► content script ─► Okta
                                              │
                                              ▼
                                     orgSnapshotStore (IndexedDB, keyed by origin)
                                              │  snapshotUpdated broadcast (counts only)
      Side panel (useOrgSnapshot) ◄────────────┘  reads rows back from IndexedDB
```

- **The background cannot fetch Okta.** Every request still exits through a
  content script in a live Okta tab, so sync is _opportunistic_ — triggered by a
  tab being available — never truly scheduled. `chrome.alarms` can only re-arm an
  attempt; the attempt no-ops with no Okta tab open.
- **Two message surfaces**, both validated exactly like `scheduleApiRequest`:
  `syncSnapshot` (panel → background; rejected from tabs, and the claimed origin
  is checked against the tab's live URL) and the `snapshotUpdated` broadcast,
  which carries **counts only** — rows are always re-read from IndexedDB.
- **Three sync modes** (`shared/snapshot/syncMeta.ts`): a full walk, a delta via
  `search=lastUpdated gt`, and a one-request drift check comparing
  `x-total-count` against the stored count. The pairing is the correctness
  argument — a delta can never observe a _deletion_, so only the count
  comparison catches one. A user-pressed Refresh always forces a full walk.
- `useOrgSnapshot` is **not** built on `sidepanel/cache/entityCache`: that cache
  is in-memory, session-scoped and panel-owned, which is the ownership this
  replaces. The two coexist — `entityCache` still serves per-entity reads.

## The API client: `useOktaApi/`

`src/sidepanel/hooks/useOktaApi/` is a factory decomposed into one module per concern
(`core`, `groupMembers`, `groupBulkOps`, `groupCleanup`, `groupDiscovery`,
`groupAnalysis`, `ruleImpact`, `ruleWrites`, `userOperations`, `appOperations`,
`policyOperations`, `exportEngine`, `currentUserCache`, `pushGroupOps`, `utilities`,
`types`, `index` — list the directory rather than trusting a count here). `core.ts`
exposes `makeApiRequest`
(via background) and
`sendMessage` (direct to content). **This module layout is the reference pattern**
for decomposing other large areas — extend it, don't reinvent it.

## State

Pure React — hooks + four contexts (`SchedulerContext`, `ProgressContext`,
`NavigationContext`, `OrgEntityIndexContext`). No
Redux/Zustand/React Query. See [state-management.md](./state-management.md) for the
hook-vs-context-vs-local decision and how the god components were decomposed.

## The side-panel shell: tab lifetime and sub-navigation

There is no router. `App.tsx` owns the active tab, and navigation happens at two
levels:

- **Between tabs — a tab mounts on first activation and is then hidden, never
  unmounted** (ADR-0018). `renderTabPanel` toggles `.tab-content` /
  `.tab-content.active` (`display: none` / `block`) plus the `hidden` attribute, and
  each panel has its own `Suspense` boundary so a newly activated `React.lazy` chunk
  cannot blank the tabs beside it. **Consequence, and it is a hard one:** every tab
  is passed `isActive` and must gate on it anything that reaches Okta, polls,
  re-probes page context, or listens on `window`/`document`. A hidden tab that
  fetches is spending the shared scheduler budget invisibly.
- **Within a tab — `useViewStack`** (ADR-0016) gives a tab shell a typed push/pop
  stack with a breadcrumb `trail`, rendered through one always-mounted `PageHeader`
  (`onBack` / `breadcrumbs` slots) and the shared `Breadcrumbs`. That header also
  **describes** the pushed entity (`identity` / `identityKey`, ADR-0032), so a detail
  view opens on its first real section rather than on a card repeating the title. The pushed view is a
  **sibling** of the hidden-but-mounted list, not a replacement, so list state
  survives the round trip; `useScrollPreservation` carries the scroll offset that
  `display: none` destroys. Consumers: `GroupsTab` → `GroupDetailView` (the first),
  and `UsersTab` → `UserComparisonPanel`. The Users tab adds the case where the
  pushed view **stays mounted while popped** (its host is, so its state is cleared
  by a reset effect rather than by an unmount) — which makes the ADR-0018 gate apply
  one level down: `searchEnabled` is "pushed **and** the tab is shown".

## Persistence

- `chrome.storage.local` — per-tab UI state (`shared/tabState/`). `chrome.storage.sync`
  has exactly one write and no reader; do not build on it without deciding sync
  semantics first (ADR-0033).
- IndexedDB via `idb` — audit log (`shared/storage/auditStore.ts`), export presets
  (`presetStore.ts`), the per-org profile display config (`profileDisplayStore.ts`,
  ADR-0033), and the org snapshot (`shared/snapshot/orgSnapshotStore.ts`,
  ADR-0040). All follow one shape: a lazily-opened reused connection, a typed
  `DBSchema`, and a singleton export whose methods never throw at the caller.
  The snapshot holds group/app/rule **metadata** only — no member lists, so the
  largest and most personal collection in the org is deliberately absent.
- Both are **plaintext**. No credentials or session material, minimal PII, TTL'd — see
  [security.md](./security.md).

## Type safety

`tsconfig` is `strict`. Okta responses must be validated at the content-script
boundary with **zod** (ADR-0006) — do not cast JSON to `any`. Shared types live in
`src/shared/types.ts` plus per-domain `types.ts` files.
