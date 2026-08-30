# ADR-0056: How deep the snapshot goes

- Status: Proposed
- Date: 2026-08-29
- Scoped by: `I-012`
- Extends: [ADR-0040](./0040-the-background-owns-the-org.md). The store, the
  `CollectionSpec` model and the sync engine are unchanged. What this adds is a
  name for *how many* collections an org runs, and a control over it.
- Relates to: [ADR-0006](./0006-zod-boundary-validation.md) (every stored row is
  a parsed row), `docs/security.md` ("store no more than needed")

> **Numbering note.** `I-012` reserved `0043` on 2026-08-24; the reel's staging
> ADR took it. See `D-072`.

## Context

ADR-0040 gave the org one background-owned store, and the collection model has
since grown from "one paginated listing" to "a fan-out derived from another
collection" — `APP_GROUPS_SPEC` walks a shard list built from `GROUP_PUSH` in
`/api/v1/apps`. Four collections are wired: `groups`, `rules`, `apps`,
`appGroups`.

Nothing says **how far** a snapshot should go. Depth is an implicit constant —
the four specs that happen to be passed to the sync entry point — so every
richer question is either free or impossible with nothing in between:

- *Which groups have no rule feeding them?* Free today (`groups` ∩ `rules`).
- *Which app-sourced groups point at a deleted app?* Free today.
- *Which rules can never match, because a target group is gone?* Free today.
- *Which admins hold a role they have not used?* Impossible — `roles` is not a
  collection, and there is no way for an admin to ask for it.

The point of naming depth is what it unlocks. With the right collections local
and fresh, Home stops being a set of buttons that each cost a walk and becomes a
report that is already computed — including recommended org actions, which need
**breadth** (several collections joined) far more than they need any single
expensive call.

Depth is also the axis along which a snapshot stops being org metadata and
starts being a copy of the directory. That line has to be drawn here, not left
to whoever wires the next collection.

## Decision

### Three named levels

A level is a set of `CollectionSpec`s, nothing more. The sync engine is
unchanged; the level chooses its argument.

| Level | Collections | Reach | Rows, 5k-group org | Cold requests |
| --- | --- | --- | --- | --- |
| **Essential** (default) | `groups`, `rules` | Group inventory, rule inventory, orphan and unfed-group joins | ~5.5k | ~30 |
| **Standard** | + `apps`, `appGroups` | Everything above, plus app provenance and push/import sourcing. **Today's wired behaviour.** | ~7k | ~45 |
| **Extended** (opt-in) | + `roles`, `policies` | Admin-role and policy reporting; recommended org actions that span governance | ~7.5k | ~60 |

Two properties are deliberate. **Levels are cumulative and ordered** — a level
is a prefix of the next, so a change is always "add these collections" or
"remove these", never a re-shuffle. And **the default is one step below today's
behaviour**: `Essential` answers the questions ADR-0040 was written for, and an
org that never opens the Apps surface should not be walking `appGroups` every
six hours to serve it.

Row and request figures are order-of-magnitude estimates from the existing
specs' page sizes, not measurements. **Measuring them against a real org is
`D-028` item 7**, and no level's numbers should be quoted as fact until it
reports.

### Every level is priced in both currencies

A level is not proposable without both numbers: **requests to reach it** and
**rows stored to hold it**. The table above is the required shape, and a new
collection that cannot fill in both rows does not get added.

The storage number is the one that matters for `docs/security.md`. IndexedDB is
plaintext, and group and app profiles carry admin-authored descriptions that can
contain personal data. Two rules bound it:

- **No level stores a field it does not use.** Specs already store a parsed
  entity (ADR-0006); a level that adds a collection also names which of its
  fields the store keeps, and drops the rest at the boundary.
- **Extended is opt-in and reversible**, because it is the level that crosses
  from inventory into governance data.

### Membership is not a level

`src/shared/snapshot/types.ts:9-16` already commits to this, and this ADR
restates rather than revisits it:

> Deliberately does **not** include group membership: it is the largest and most
> personal collection in an org, and the questions ADR-0040 exists to answer are
> served by counts (`expand=stats`) rather than by member lists.

Membership is the collection a depth ladder would erode by accident — it is the
obvious "level 4", and it is the one that turns the snapshot into a copy of the
directory. **No level in this ADR, present or future, includes group
membership.** Adding it is a separate decision with its own retention argument,
its own ADR, and its own answer to how a plaintext local copy of who-works-where
is justified.

### Levels interact with `refreshIntervalMs`, they do not override it

Each spec keeps its own `refreshIntervalMs` (`APP_GROUPS_SPEC` already sets one).
A level does not re-time its collections — it only decides whether they run.
This keeps freshness a property of the data's own volatility rather than of a
setting the admin chose for an unrelated reason.

### Moving down a level deletes rows, at the moment of the change

This is the one-way-ratchet question, and the answer is that there is no
ratchet. Lowering the level **immediately clears the stored rows for every
collection the new level does not include**, for that origin, in the same
transaction that records the change.

Not deferred to a TTL, not left to the next sweep. An admin who lowers the level
is making a statement about what they want on disk, and the only honest response
is for it to be gone when the setting closes. `SNAPSHOT_COLLECTIONS` already
exists for exactly this kind of iteration.

Raising the level does not backfill synchronously; the newly-included
collections are marked stale and picked up by the next sync, which is the same
path a cold start takes.

### The level is per-origin

An admin with a production org and a sandbox has different appetites for each.
The level is stored per origin, alongside the sync metadata that is already
keyed that way.

## Consequences

Home can state what it can answer, because the level says so; a report that
needs `Extended` can explain that instead of silently returning nothing. The
default gets cheaper than today's behaviour for orgs that only use the group and
rule surfaces.

The costs are real. Every surface reading a collection must handle *the level
does not include this* as a distinct state from *not synced yet* and from
*empty* — three states where there is currently one, and conflating them is the
defect this ADR is most likely to cause. The default drops `apps`/`appGroups`,
so any surface currently assuming they are present needs an explicit
`Standard` requirement or a graceful empty. And the level becomes a new piece of
settings state that must survive the storage-schema migration ADR-0040 defined.

## Alternatives considered

**Per-collection toggles instead of levels.** Maximum control, and it makes the
common case a configuration exercise: 2⁶ combinations, most meaningless, each a
support question. Levels trade expressiveness for a decision an admin can
actually make.

**One level, and add collections as features need them.** The status quo. It
works until the first collection that is expensive or sensitive, at which point
there is no vocabulary to say "not that one" — and no line drawn before
membership becomes the obvious next addition.

**Derive the level from usage.** Sync what the admin opens. Appealing, and it
makes storage a function of behaviour that the admin cannot see or predict,
which is the opposite of what a plaintext local store needs.
