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
- The content script is decomposed: `src/content/index.ts` is a small router that
  dispatches to handler modules (`apiRequest.ts`, `groupHandlers.ts`,
  `userHandlers.ts`, `pageContext.ts`, `indicator.ts`), and the only raw Okta
  `fetch(` lives in `apiRequest.ts`.
- **All raw Okta API traffic must go through the scheduler path.** `makeApiRequest`
  (`useOktaApi/core.ts`) routes every Okta call through the background scheduler — do
  not add side-panel→content calls that fetch Okta directly and bypass rate limiting.
  Direct `sendMessage` to the content script is the legitimate transport for
  non-API messages (reading page context: the current group/user/app, or the Okta
  origin); it carries no raw Okta API traffic.
- `ApiScheduler` (`shared/scheduler/apiScheduler.ts`) is the one queue every Okta
  call passes through: priority ordering, per-bucket gates and seats, cooldowns,
  retry with backoff, rate-limit detection.

The request pipeline's own rules — concurrency, rate-limit buckets, the plan
ledger, session suspension — live in [scheduler.md](./scheduler.md).

## The org snapshot: background-owned inventory

The pipeline above is a **request** path — the panel asks, the answer arrives, the
panel forgets. **Org-wide collections (groups, apps, rules, app-group
assignments) are owned by the background and persisted per origin in
IndexedDB**, and the panel is a reader:

```
Okta tab settles ─► snapshotScheduler ─► snapshotSync ─► ApiScheduler ('low') ─► content script ─► Okta
                                              │
                                              ▼
                                     orgSnapshotStore (IndexedDB, keyed by origin)
                                              │  snapshotUpdated broadcast (counts only)
      Side panel (useOrgSnapshot) ◄────────────┘  reads rows back from IndexedDB
```

- **The background cannot fetch Okta.** Every request still exits through a
  content script in a live Okta tab, so sync is _opportunistic_ — never truly
  scheduled. `chrome.alarms` only re-arms an _attempt_, which no-ops with no tab.
- **Two message surfaces**, both validated exactly like `scheduleApiRequest`:
  `syncSnapshot` (panel → background; rejected from tabs, and the claimed origin
  checked against the tab's live URL) and the `snapshotUpdated` broadcast, which
  carries **counts only** — rows are always re-read from IndexedDB.
- **Scope is the org origin, never the tab id.** Two Chrome tabs on one org share
  an answer; two orgs never do, including the tab that navigates between them.
- **Three sync modes** (`shared/snapshot/syncMeta.ts`): a full walk, a delta via
  `search=lastUpdated gt`, and a one-request drift check comparing
  `x-total-count` against the stored count. **A delta is always paired with the
  drift check** — a delta can never observe a _deletion_, since nothing updates
  when a row disappears, so only the count comparison catches one. An absent
  `x-total-count` is _unknown_, not agreement, and escalates to a full walk
  exactly as a mismatch does. A user-pressed Refresh always forces a full walk.
- **Each `CollectionSpec` carries a `parseVersion`** (`shared/snapshot/parseVersion.ts`),
  stored per `(origin, collection)` in `SyncMeta`. A mismatch makes the next sync
  attempt for **that one collection** a full walk, once; the version is written
  only when the walk completes, so an interrupted walk never marks itself
  upgraded. It versions **the request and the walk** — a new `expand=`, a changed
  shard provider or `identify`, a new endpoint, a schema that starts narrowing. It
  never versions the DB layout (`DB_VERSION` must not move for this) and never a
  read-side mapper: the schemas pass unknown fields through, so teaching a mapper
  to read a field already in the stored row is retroactive and free. A lock test
  fingerprints each spec's wire shape and fails when one changes without a bump.
  Old rows keep serving during the upgrade walk, and an absent field renders as
  unknown — never as zero, never as never.
- **Every rule write clears the org-wide `RulesCache`.** `createRuleWriteOperations`
  (`useOktaApi/ruleWrites.ts`) drops the entry itself on create, delete, activate
  and deactivate, so no caller can forget; a read (`getRawGroupRule`) never
  invalidates. Invalidation follows the **write**, not the returned result — a
  `POST` Okta accepted whose response then fails zod still invalidates, because
  the rule exists — and a storage failure is logged and swallowed rather than
  deciding the write's outcome.
- `useOrgSnapshot` is **not** built on `sidepanel/cache/entityCache`: that cache
  is in-memory, session-scoped and panel-owned, which is the ownership this
  replaces. The two coexist — `entityCache` still serves per-entity reads.

## The API client: `useOktaApi/`

`src/sidepanel/hooks/useOktaApi/` is a factory decomposed into one module per
concern (`core`, `groupMembers`, `ruleWrites`, `exportEngine`, … — list the
directory rather than trusting a count here). `core.ts` exposes `makeApiRequest`
(via background) and `sendMessage` (direct to content). **This module layout is
the reference pattern** for decomposing other large areas — extend it, don't
reinvent it.

## State

Pure React — hooks + four contexts (`SchedulerContext`, `ProgressContext`,
`NavigationContext`, `OrgEntityIndexContext`). No Redux/Zustand/React Query. See
[state-management.md](./state-management.md) for the hook-vs-context-vs-local
decision and how the god components were decomposed.

## The side-panel shell: tab lifetime and sub-navigation

There is no router. `App.tsx` owns the active tab, and navigation happens at two
levels:

- **Between tabs — a tab mounts on first activation and is then hidden, never
  unmounted.** `renderTabPanel` toggles `.tab-content` /
  `.tab-content.active` (`display: none` / `block`) plus the `hidden` attribute, and
  each panel has its own `Suspense` boundary so a newly activated `React.lazy` chunk
  cannot blank the tabs beside it. **Consequence, and it is a hard one:** every tab
  is passed `isActive` and must gate on it anything that reaches Okta, polls,
  re-probes page context, or listens on `window`/`document` — see
  [state-management.md](./state-management.md).
- **Within a tab — `useViewStack`** gives a tab shell a typed push/pop stack with
  a breadcrumb `trail`, rendered through one always-mounted `PageHeader` that also
  **describes** the pushed entity (`identity` / `identityKey`), so a detail view
  opens on its first real section rather than on a card repeating the title. The
  pushed view is a **sibling** of the hidden-but-mounted list, so list state
  survives the round trip, and the gate applies one level down: the Users tab's
  `searchEnabled` is "pushed **and** the tab is shown". Consumers, and what a
  consumer owes `pop`, are in [state-management.md](./state-management.md).

## Persistence

- `chrome.storage.local` — per-tab UI state (`shared/tabState/`). `chrome.storage.sync`
  has exactly one write and no reader; do not build on it without deciding sync
  semantics first.
- IndexedDB via `idb` — audit log (`shared/storage/auditStore.ts`), export presets
  (`presetStore.ts`), the per-org profile display config
  (`profileDisplayStore.ts`), and the org snapshot
  (`shared/snapshot/orgSnapshotStore.ts`). All follow one shape: a lazily-opened
  reused connection, a typed `DBSchema`, and a singleton export whose methods
  never throw at the caller. The snapshot holds group/app/rule **metadata**
  only — no member lists, so the largest and most personal collection in the org
  is deliberately absent.
- Both are **plaintext**. No credentials or session material, minimal PII, TTL'd — see
  [security.md](./security.md).

### The per-org profile display config

How the Profile pane groups, orders and labels attributes is **authored by the
admin, per org**:

- **It lives in IndexedDB, keyed on `oktaOrigin` alone**, never in
  `chrome.storage.sync`. It is not a preference: it is an order array plus an
  assignment map over the org's whole attribute inventory, it grows with the
  tenant's schema, and it means nothing on a device signed in elsewhere. A failed
  read returns `null` — "no saved config".
- **An unknown stored key degrades to Uncategorized and is never dropped.** Two
  configs are kept: the **stored** one, written back verbatim including placements
  for attributes absent this session, and the **reconciled** one, projected onto
  the attributes that exist right now, which is the only one the UI sees. The
  reconciled config must never be written back — the schema read fails routinely,
  and an answer we failed to obtain is not an answer that the attribute is gone.
  At render, an attribute filed under a deleted category resolves to
  Uncategorized, a block never dropped: deleting a category moves attributes.
- **The org's own schema is the inventory.** `GET /api/v1/meta/schemas/user/default`,
  read once per org at `TTL_LONG` and gated on the Profile pane being asked for,
  is the only source that knows an attribute exists when the person on screen has
  no value for it. `BASE_PROFILE_ATTRIBUTES` is the fallback when that read fails,
  never the definition. Validation is lenient: one malformed property is dropped
  with a counts-only warning, never emptying the inventory.

## Reports are export descriptors over the snapshot

An `EntityExport` descriptor may declare `source: { kind: 'snapshot' }`; absent
means `endpoint`, so every endpoint-backed descriptor is unaffected. A snapshot
source reads the mounted collections read-only — no request, no listener, no top-up.

- **Snapshot rows are still validated with zod.** A round trip through plaintext
  IndexedDB makes no Okta response trustworthy, so the join parses its rows
  through the same path the wire uses.
- **`unavailable` renders no Download control at all** — not an empty CSV, not a
  partial one, just the sentence naming the collection that was not read.
  `reading` waits.
- **A `partial` caveat ships as a CSV column, never a `#` preamble.** The engine
  force-includes the descriptor's completeness column when the resolution is
  `partial`, even if the reader deselected it, and marks the filename `-partial`.
  A preamble is not RFC 4180 and is lost the moment someone sorts or pastes a
  subset; the caveat must survive being sliced, so it rides the row — through
  `escapeCSV` like any other cell.

## Type safety

`tsconfig` is `strict`. Okta responses must be validated at the content-script
boundary with **zod** — do not cast JSON to `any`. Shared types live in
`src/shared/types.ts` plus per-domain `types.ts` files.
