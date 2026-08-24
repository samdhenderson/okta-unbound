# ADR-0040: The background owns the org, and a drift check keeps it honest

- Status: Accepted
- Date: 2026-08-24
- Relates to: ADR-0006 (zod at the boundary), ADR-0009 (one batch runner),
  ADR-0018 (tabs stay mounted), ADR-0024 (risk-based plan gate), ADR-0026
  (visibility gating), ADR-0033 (per-org config in IndexedDB)

## Context

Loading the Groups tab in a ~1000-group org takes tens of seconds and paints
nothing until it has completely finished. `useGroupsLoader.loadAllGroups` is three
serial stages, and the third dominates:

| Stage                    | Requests (1000 groups, ~40 source apps) | Why                                                                                                                      |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `getAllGroups`           | 5 serial pages                          | Okta returns 200 and a `rel="next"` cursor; the cursor cannot be guessed, so the walk is serial by construction.         |
| `ensureGroupRulesLoaded` | 1–2 serial pages                        | An unrelated endpoint, `await`ed **after** the walk above. It is standing in a queue it has no reason to be in.          |
| `applyPushGroupMappings` | **~85**, two phases with a barrier      | Okta returns a source app _id_ and no label, so this loops: one `/api/v1/apps/{id}` per unique app, then a walk per app. |

Behind the scheduler's `maxConcurrent: 5`, that third stage is roughly seventeen
sequential waves — longer than the first two combined. And the loader passes
`() => {}` where the page callback goes, so the first 200 groups, which arrived in
the first second, stay invisible until the twentieth.

Three of those four problems have local fixes. `expand=app` is a documented
parameter that embeds the source app while listing groups, deleting the label
phase outright — the same trick `expand=stats` already plays for member counts.
The rules walk can run concurrently. `fetchAllPages` already carries an `onPage`
hook nobody uses.

**None of them addresses what actually makes this slow, which is that every load
is a cold load.** Close the panel and reopen it; switch orgs and switch back; the
answer is gone and is bought again at full price. It is gone because the _panel_
owns the asking, and the panel is the shortest-lived context in the extension.

That ownership is also what forecloses the Overview work. "How many groups are
empty", "which groups no rule feeds", "which app-sourced groups point at an app
that no longer exists" are each a full org walk today. Five of them on one screen
is five full walks, so the screen cannot be built. The constraint is not that the
questions are expensive to answer — it is that nothing is allowed to remember.

## Decision

**The background service worker owns the org inventory, in IndexedDB, keyed by
origin. The panel reads it. Freshness is maintained by a cheap delta plus a
cheaper drift check, and a full walk is the fallback rather than the default.**

### 1. Ownership moves to the only context that outlives the panel

The background worker already owns the `ApiScheduler` and the tab routing, and it
is the only context that observes tab lifecycle. It gains
`shared/snapshot/orgSnapshotStore` — an IndexedDB store built on the `auditStore`
pattern (lazy `openDB`, module singleton, failures logged and never thrown) —
holding `groups`, `apps`, `rules` and `appGroups`, each keyed `['origin', 'id']`.

The panel becomes a reader. It seeds from the store on mount and subscribes to a
`snapshotUpdated` broadcast, so a warm org paints before a single request is
issued and a cold one paints per page as the walk streams.

**Scope is the org origin, never the tab id.** This is the rule
`sidepanel/cache/keys.ts` already states and explains: two Chrome tabs on one org
should share an answer, two orgs must never, and a tab-id scope gets both wrong —
including the case where one tab navigates between orgs and silently serves the
previous org's data.

### 2. Sync is opportunistic, because it cannot be anything else

**The background cannot fetch Okta.** Only the content script holds the live
session, and it exists only while an Okta tab is open (`docs/architecture.md`).
Every request in the extension exits through it, and this one is no exception —
the scheduler path is not bypassed here any more than anywhere else.

So there is no such thing as a scheduled background sync. `chrome.alarms` (already
granted; **no manifest change**) can only re-arm an _attempt_, and the attempt
no-ops when no Okta tab is available. The real trigger is `chrome.tabs.onUpdated`
reaching `complete` on an Okta host: that is the moment a session becomes
reachable. Naming this constraint here is the point of the section — a future
reader will otherwise try to make the sync periodic and discover the reason the
hard way.

All snapshot traffic runs at `low` priority. The scheduler's `interactive` tier
and its soft-gate bypass (`shared/scheduler/apiScheduler.ts`) already guarantee a
user-typed search jumps ahead of a bulk scan; this decision adds bulk scans and
adds nothing to defend against them, because the defence already exists.

### 3. Three modes, and one pair that is the whole correctness argument

| Mode            | Cost                      | Catches                                                            |
| --------------- | ------------------------- | ------------------------------------------------------------------ |
| **Full walk**   | `ceil(n/200)` per section | everything; used when cold, on drift, and on a manual Refresh      |
| **Delta**       | 0–1 requests              | creates and edits, via `search=lastUpdated gt "<watermark>"`       |
| **Drift check** | **1 request**             | **deletes**, via `limit=1` and the `x-total-count` response header |

The delta alone is not sufficient and must never be shipped alone. **A deletion
updates nothing**, so no `lastUpdated` query can observe one; an org that only
ever deltas converges on a snapshot that is confidently wrong in exactly the
direction that matters — it reports groups that are gone. The count comparison is
the backstop: one request, no walk, and any disagreement with the stored count
escalates to a full walk rather than being reconciled by guesswork.

Stated as the invariant: **a snapshot is only ever as trustworthy as its last
drift check.** A delta may run without one; a _read_ may not be served from a
snapshot whose drift check is older than its TTL without a check being scheduled.

### 4. Two things are probed at runtime, never assumed

Both failures here are silent, which is why they are decided by observation.

**`search=lastUpdated gt` may be ignored rather than rejected.** Okta does not
support `search` uniformly across endpoints, and an unsupported parameter can come
back as a 200 with the parameter simply not applied — a "delta" that is a full
walk wearing a delta's cost estimate, and worse, one whose watermark then advances
as though it had been honoured.

The probe asks the one question whose answer is unambiguous: count the rows
updated after a watermark **no row can be newer than**
(`search=lastUpdated gt "9999-01-01T00:00:00.000Z"`, `limit=1`). An org that
honours the filter answers `x-total-count: 0`. An org that ignores it answers
with the collection's full size. Comparing a _real_ watermark's filtered count
against the unfiltered one cannot separate those cases — a genuine bulk edit
produces the same equality — so the far-future watermark is used instead.

Every uncertain answer is read as unsupported: a failed request, an absent
`x-total-count`, and any non-zero count all set `deltaSupported: false` in
`syncMeta` for that origin and collection, and it full-walks from then on. A
degraded org is slower. An unprobed org is wrong.

**`expand=app` may not survive the `rel="next"` link.** Okta preserves
`expand=stats` across pagination and drops `expand=group-rules`; the two behave
differently on the same walk, so `app` is decided rather than assumed. If it is
dropped, it is re-appended per page through the `preserveParams` option that
`shared/utils/oktaPagination.ts` already provides for exactly this — the mechanism
exists and is not rebuilt. The parameter form (`expand=stats&expand=app` versus a
comma list) is settled by the same probe.

### 5. What the snapshot may hold

`chrome.storage` and IndexedDB are plaintext (`docs/security.md`). The snapshot is
therefore scoped by what it is _for_, not by what happens to be in the response:

- Group, app and rule **metadata** — ids, names, descriptions, types, counts,
  timestamps, source-app references. This is org configuration.
- **Never** credentials or session material, and never the XSRF token, which
  remains per-request and content-script-only.
- **No user records.** Group _membership_ is deliberately out of scope: it is the
  largest and most personal collection in the org, and the questions that motivate
  this ADR are answered from counts (`expand=stats`) rather than from member
  lists. Adding members later is a separate decision with a separate retention
  argument, not an extension of this one.

One edge is worth naming rather than leaving to be discovered. A group rule's
`conditions.people` can carry `users.exclude` — a list of **user ids**. Those are
opaque identifiers attached to a piece of org configuration, not user records,
and they are read as within the rule above; a rule that excludes three people is
a fact about the rule. But it is the closest this store comes to holding a user
reference, so it is stated here rather than left implicit, and it is the line to
re-examine if the rules schema is ever widened.

Every row is validated with zod at the boundary before it is stored (ADR-0006);
the store persists parsed rows, never raw response bodies. An origin's rows are
dropped when the org changes, and the store is subject to a TTL and an explicit
clear, on the model ADR-0033 set for per-org config.

### 6. What this replaces

`shared/rulesCache` (one `chrome.storage.local` slot, 5-minute TTL) and
`sidepanel/components/groups/groupsCache` (one slot, 1-day TTL) are two
hand-rolled caches with two different freshness stories and no invalidation
relationship to each other. Both are retired into the snapshot, so there is one
store, one watermark, and one answer to "how old is this".

The app inventory joins them. It was not a hand-rolled cache — it sat on the
session-scoped `sidepanel/cache/entityCache` — but it was thrown away every time
the panel closed, and it aged on its own clock. The Overview's questions are
joins _across_ apps, groups and rules, and a join is only trustworthy when both
sides were walked by the same sync.

**Status.** `groupsCache` and the `entityCache`-backed app inventory are retired;
`getAllApps` went with the latter. `pushGroupOps` is gone too — app-group
assignments became the `appGroups` collection, so the panel reads push mappings
rather than deriving them, and `useGroupsLoader` no longer takes an API surface
at all. `shared/rulesCache` is still standing — it has around two dozen consumers
across the Rules, Users and comparison surfaces, and unpicking it is its own
change rather than a footnote to this one. Until it goes, rules exist in two
places: authoritative in the snapshot, and cached separately for the rule-impact
and membership-analysis readers.

**A collection is not always one listing.** `appGroups` has no collection
endpoint — Okta exposes app-group assignments only per app — so `CollectionSpec`
grew a shard provider, and a sharded walk assembles the collection from one
listing per app. Three consequences are worth stating because a plausible
implementation gets each of them wrong: every shard shares one mark, so a single
sweep still reconciles the whole collection (including an app that has left the
org); the sweep runs only when _every_ shard finished, because a fan-out that
lost a leg is missing rows rather than observing deletions; and resume is
per-shard rather than per-cursor, since "23 of 40 apps done" is not a next-page
URL. Which apps to walk is itself read from the snapshot — apps whose `features`
include `GROUP_PUSH` — so discovering the work costs no request, and the set is
wider than the pre-ADR-0040 pass's, which only ever saw apps that _import_
groups.

**Depth is not yet a decision.** The four collections here are the ones that
happened to be needed, not a considered answer to how much of an org the
snapshot should hold. Naming that — tiered levels an admin can opt into, and the
reporting each level unlocks — is filed as `I-012` and stays research-only until
reviewed, because it commits the storage schema and the sync budget to a shape
later levels have to live inside.

**None of this has run against real Okta.** Every claim above is supported by
unit tests over canned pages and a faked IndexedDB, several checked by mutation.
The probe results this ADR set out to resolve by runtime observation — whether
the delta filter is honoured, whether `x-total-count` is returned, whether
`expand=app` survives the next link, whether `features` rides the app list — are
still arguments rather than observations. `D-028` is the independent audit that
turns them into one or the other; until it is done, read the cost tables here as
intent.

### 7. What it refuses to do

- **A partial walk is never served as a complete one.** The store records whether a
  collection's last walk finished. A truncated inventory rendered as the org is the
  defect `getAllApps` and `getAllGroups` already throw to avoid, and moving the
  walk into the background must not quietly reintroduce it.
- **A delta never advances the watermark on an unhonoured filter.** See §4; this is
  the specific way a "cheap" sync becomes a wrong one.
- **The snapshot is not authority for a write.** Every mutation still reads its
  target through the live path. A cached inventory is for browsing and reporting;
  it is not evidence about the state of a thing you are about to change.
- **`x-total-count` absent is unknown, not zero.** A missing header is not
  agreement, so the run escalates to a full walk exactly as a mismatch does. The
  cheaper reading — skip the check and try again next tick — costs one request a
  tick forever and leaves the snapshot permanently without its only deletion
  backstop, which is the failure this section's first bullet rules out.
- **A caller's claimed origin is verified, not trusted.** A sync request names
  both the origin the rows will be filed under and the tab that will fetch them,
  and nothing intrinsically ties the two together — the content script fetches
  relative to its own page, not to the string it was handed. The background
  re-reads the tab's live URL and refuses when the two disagree, because the
  alternative is filing one org's inventory under another org's key during
  exactly the tab-navigates-between-orgs race §1 exists to handle.

## Consequences

- The critical path for a cold Groups load falls from ~92 requests in three serial
  stages to ~7 in two concurrent ones, streamed — first rows at roughly one second
  rather than twenty. The ~45 requests behind `pushMappings` move to a deferred
  collection that patches rows after paint, because nothing about searching,
  sorting or scrolling the list needs them.
- A **returning** load costs one drift check and zero-to-one delta page, and paints
  from IndexedDB before either is issued. This is the change that actually matters:
  it is the first time in this codebase that visiting a tab twice is cheaper than
  visiting it once.
- The Overview overhaul becomes buildable. Empty groups, rule-less groups, rule
  conflicts, stale groups and orphaned push mappings are all loops over local
  arrays at zero request cost. That is the point of the ADR; the speed-up is a
  consequence of it, not the other way round.
- One new IndexedDB database, one new background module, and one new broadcast
  message action. **No new permission, no manifest change**, and no new transport —
  everything rides the existing scheduler path.
- The hand-rolled caches are deleted as their readers move over, which removes a
  live inconsistency: rules could be five minutes old beside groups that were a
  day old, with nothing relating the two. `shared/rulesCache` is the last one
  standing — see §6.
- Names, labels and descriptions in the snapshot are end-user-controllable Okta
  content. Nothing on this path logs any of it — sync logs collection names,
  counts, and outcome codes.
- **Residual.** Between a delete in Okta and the next drift check, the snapshot
  reports a group that no longer exists. That window is bounded by the check's
  cadence and closed by any manual Refresh, and it is the price of not walking the
  org to answer every question. It is stated in the UI as a fetch time beside the
  data, not hidden.
- **Residual.** An org that does not honour `search=lastUpdated` gets no delta and
  full-walks on every drift. It is no slower than today, and it is correct.
