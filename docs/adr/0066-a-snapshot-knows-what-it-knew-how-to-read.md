# ADR-0066: A snapshot records what it asked Okta for, and a bump re-walks one collection

- Status: Proposed
- Date: 2026-09-02
- Relates to: ADR-0006 (zod at the boundary), ADR-0040 (the background owns the
  org), ADR-0056 (how deep the snapshot goes), ADR-0064 (a rule write
  invalidates its own snapshot)
- Backlog: `I-027`; adjacent `D-076`

## Context

`orgSnapshotStore` is deliberately content-agnostic. It holds whole parsed rows
under `[origin, id]`, and `syncMeta` reasons about the collection in aggregate —
counts, watermarks, completeness, a resume cursor. Nothing anywhere records
**what a row was stored with**. So when a release changes what the walk asks Okta
for, every already-synced org keeps serving rows written under the old question
until some unrelated cause — a drift mismatch, a manual Refresh, an interrupted
walk — happens to trigger a full walk. Nothing can tell an incomplete row from an
unpopulated one, and the panel has no vocabulary for the difference.

`I-027` files this against the `lastMembershipUpdated` case (`0247c9f`), and
**that diagnosis is wrong in a way worth correcting here, because the correction
is the decision**. `oktaGroupListItemSchema` — the schema the groups walk
validates with — has always been `.passthrough()`, and the store persists the
parsed row. `lastMembershipUpdated` rides the `/api/v1/groups` LIST response by
default, so every snapshot written since ADR-0040 landed **already contained it**,
including snapshots synced years of releases before the mapper learned to read
it. The field was dropped on the _read_ side, by `toGroupSummary` and by a
stripping `oktaGroupSchema`. Fixing the mapper lit up existing rows immediately;
no re-walk was ever owed. The commit message contradicts itself on this point —
it says both "already writing it to IndexedDB; only the mapper dropped it" and "a
snapshot synced before this commit carries no value until the next walk". The
first is true.

That is not a refutation of `I-027`; it is a sharpening of it. Passthrough means
**read-side changes are retroactive and free**, and a version that fired on them
would re-walk the org to buy nothing. The changes that genuinely strand a
snapshot are the ones that alter the _request_ or the _write_:

- a new `expand=` on the walk URL (`expand=app` was exactly this);
- a change to the shard provider's selection, or to the shard-key grammar;
- a change to `identify`, which decides a row's storage key and which timestamp
  advances the watermark;
- a collection moving to a different or additional endpoint;
- a schema that starts _narrowing_ rather than passing through.

None of those can be repaired by a mapper, because the bytes are not in the
store. All of them are visible in one place: the `CollectionSpec`.

## Decision

**Each `CollectionSpec` carries a `parseVersion`, persisted per `(origin,
collection)` in `SyncMeta`. A mismatch between the spec's version and the stored
one makes the next sync attempt for that collection a full walk, once. The
version describes what the walk asked for and what it did with the answer —
never the database layout, and never what a reader does with a row it already
has.**

### 1. Per-collection, on the spec

`CollectionSpec` is already the unit of walking, of freshness, and of
`refreshIntervalMs`; `SyncMeta` is already keyed `[origin, collection]`. Putting
the version there costs no new storage shape and no new lookup.

A **global** version is the eager answer and it is the expensive one. A new group
field would re-walk `appGroups` — a fan-out of one listing per push-enabled app,
roughly forty walks, the single most expensive operation in the system — to
collect a field that lives on `/api/v1/groups`. Multiply that by every org and
every release and you have re-created the cost ADR-0040 exists to delete: a
returning load becoming a cold load, on a schedule set by our release cadence
rather than by the org's rate of change.

A **per-field or per-row** version is over-fine in the other direction. It asks a
deliberately content-agnostic store to record which keys each row carried, which
is a per-row cost on the largest collections, and it does not change the remedy:
you cannot fetch one field from Okta. A walk returns whole rows either way, so
the useful granularity stops at the thing that walks.

### 2. Why this is not `DB_VERSION`

`DB_VERSION` stays at `1` and must not move for this. They are different numbers
because they are different kinds of fact:

|                | `DB_VERSION`                                     | `parseVersion`                                     |
| -------------- | ------------------------------------------------ | -------------------------------------------------- |
| Describes      | object stores, key paths, indexes                | the request issued and the write-time transform    |
| Scope          | the whole database, all origins, all collections | one `(origin, collection)` pair                    |
| Mechanism      | an IndexedDB `upgrade` transaction               | an ordinary field on an ordinary record            |
| Reversible     | no — a version can never be un-bumped            | yes — renumber or decrement freely                 |
| Cost of a bump | blocks other contexts' connections               | one full walk of one collection, opportunistically |

Bumping `DB_VERSION` to signal a content change would run an upgrade callback
with no schema work to do, take the global blast radius §1 rejects, and burn a
one-way number on a reversible decision.

### 3. What a bump does to stored rows: re-walk, and keep serving

On mismatch, `nextSyncMode` returns `'full'`. The rows are **not** deleted and
**not** hidden. Deleting them turns every field addition into a cold load — the
panel paints nothing while forty requests run — which is precisely the regression
ADR-0040 was written to prevent. Mark-and-degrade _alone_ is the other failure:
it leaves the gap permanent and makes every future field re-litigate the
`lastMembershipUpdated` question from scratch, which is `I-027`'s actual
complaint.

So it is both, in order: serve the old rows, walk in the background, replace
them. During that window the standing rule from `0247c9f` applies and is hereby
general — **an absent field renders as unknown ("Not reported by Okta"), never as
zero, never as never**. A missing value is not a fact about the org.

The new version is written to `SyncMeta` **only when the walk completes**,
alongside `complete` and `lastFullWalkAt`. An interrupted walk must not mark
itself upgraded; half a collection at the new version is exactly the state this
ADR exists to make impossible.

### 4. Interaction with the delta, the drift check, and `refreshIntervalMs`

A version mismatch outranks every cheap mode, and it has to. A delta only
rewrites rows Okta reports as changed, so it can never repair a row that is
merely _old-shaped_; a collection topping itself up by delta after a bump would
keep the gap forever while every subsequent check reported agreement. The drift
check is worse than useless here — counts agree perfectly across a field
addition, so it would return `in-sync` and license the delta.

`refreshIntervalMs` does **not** gate the upgrade walk. The interval exists to
stop a _fresh_ snapshot being re-derived; a version-mismatched snapshot is not
fresh, it is known-incomplete. But the walk is still opportunistic in ADR-0040's
sense — it runs at the next sync _attempt_, which only happens on an Okta tab
reaching `complete` or on an alarm tick, at `low` priority behind the
interactive tier. A bump schedules nothing; it upgrades the next thing that was
going to happen anyway.

The watermark is left alone. A full walk advances it correctly, and resetting it
would only manufacture work.

### 5. Making the bump hard to forget

A convention that relies on memory is a convention that fails, and this one fails
silently and per-org. So the bump is enforced by a lock test rather than by a
review habit: a fixture records, per collection, the version together with
everything the spec contributes to the wire — `firstUrl`, sorted
`preserveParams`, the shard provider's name, and a hash of `identify`'s source.
Change any of them without changing `parseVersion` and the test fails, naming the
collection and telling you to bump. (If a change makes the delta query per-spec —
`D-076` will — that field joins the fingerprint.)

The fixture is a little brittle: reformatting `identify` moves its hash. That is
accepted deliberately. A false positive costs one line and one deliberate look at
whether stored rows are affected; the alternative costs a silent field gap across
every org that has ever synced, discovered months later by someone who assumes
Okta does not expose the field. Read-side code — mappers, components, export
descriptors — is **not** in the fingerprint, because §_Context_ established that
those changes are retroactive.

Never-synced orgs get `parseVersion: null` from `emptySyncMeta`, which is treated
as a mismatch and resolved by the cold walk they were going to do anyway. Orgs
holding rows from before this ADR also read `null`, and get exactly one upgrade
walk per collection on the release that adopts it. That is the honest reading:
version 0 is not knowable retroactively, and one walk once is not the eager
failure mode — the eager failure mode is one walk per release, forever.

## Consequences

- A future collection author now owes three things: a `parseVersion` on the spec,
  a fixture entry beside it, and a bump whenever the walk's request or the
  write-time transform changes. Nothing is owed for a mapper, a component, or a
  column.
- The reflex for "the app now parses a field it used to ignore" becomes a
  question with a mechanical answer: _is the value already in the stored row?_ If
  the walk fetched it and the schema passed it through, ship the mapper and stop.
  If it needs a new parameter or a new endpoint, bump. `lastMembershipUpdated`
  was the first case and needed no bump; the fingerprint would not have fired,
  correctly.
- `D-076` is **helped**. Its fix — OR-ing `lastMembershipUpdated` into the groups
  delta so a roster change is visible — repairs the clock going forward but
  leaves every already-rotted `usersCount` rotted, because the rows it would need
  to refetch are exactly the ones no delta will return. A `parseVersion` bump is
  the flush-once lever that gives it a clean baseline, and its change to
  `deltaUrl` is a wire change, so the fingerprint demands the bump rather than
  relying on whoever writes it to think of it. `D-076` is expected to be this
  mechanism's first real consumer.
- The demo org seeds `syncMeta` directly (`sidepanel/demo/control.ts`) and must
  stamp the current versions, or a demo will try to walk a fake origin.
- One new `SyncMeta` field, one new branch in `nextSyncMode`, one new fixture. No
  migration, no `DB_VERSION` change, no new message action, no manifest change.
- **Residual.** A bump is all-or-nothing per collection: a field added to groups
  re-walks every group in the org, including rows that would not have changed.
  Groups is ~5 pages; that is the price, and it is bounded by the release cadence
  rather than by the org's size.
- **Residual.** The fingerprint catches changes _in the spec_. A change to shared
  walk machinery outside any spec — `fetchAllPages`, `parseOktaList`'s leniency —
  can still alter what gets stored without tripping it. That is a smaller surface
  and a much rarer edit, and it is named here so the next person who widens it
  knows the fingerprint is not watching them.
