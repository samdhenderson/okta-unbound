# ADR-0052: The demo org can be written to

- Status: Proposed
- Date: 2026-08-28
- Amends: [ADR-0043](./0043-the-demo-is-a-stage-the-script-is-the-director.md), its
  "Memberships are derived, not asserted" supporting decision. The property is
  unchanged; how it is computed is not.
- Relates to: [ADR-0035](./0035-the-first-profile-write.md) (the real profile
  write this mimics), [ADR-0040](./0040-the-background-owns-the-org.md) (the org
  snapshot the write re-seeds), [ADR-0045](./0045-capture-thin-compose-in-react.md)
  (the capture/compose split this change re-invalidates in full)

## Context

The reel's Users chapter is supposed to end on a fix landing: correct a
mis-typed `department`, and the group rule that keys on it applies. That shot
cannot be filmed today, for three separate reasons, none of them cosmetic.

`src/sidepanel/demo/api.ts` has no write handler. It has read operations for
every surface the reel visits — `demoGetUserRaw`, `demoGetUserApps`,
`demoScanGroupMfa`, and so on — and nothing named `demoUpdateUserProfile`.
There is no function to route a POST to.

Even if there were, nothing would call it. `.storybook/mocks/useOktaApi.mock.ts`
stubs the whole facade with canned resolutions, and `updateUserProfile` is one
of them:

```
updateUserProfile: asyncFn({ outcome: 'saved' }),
```

The canned value is not merely fake, it is the wrong shape: the real
`UpdateProfileResult` (ADR-0035) is discriminated on `kind`, not `outcome`, so
this stub could never have satisfied the `kind === 'saved'` branch the panel
actually tests. Every take of the Users chapter today would show a save
button producing a `'saved'` outcome no matter what was typed, because
nothing downstream of the click is real. The panel would report success over
a write that never happened.

And even if the write landed somewhere, nothing would notice. `memberships.ts`
computes `demoGroupMembers` and `demoUserGroups` once, at module load, from
the frozen `demoUsers` array:

```ts
export const demoGroupMembers: ReadonlyMap<string, readonly string[]> = buildMemberships();
```

A module-level `const` built from a predicate over a snapshot of the user list
is exactly the kind of "looks right, is not filming a real derivation" defect
ADR-0043 spent its life avoiding for the read path. Filming a fix that changes
`department` and then reading `demoUserGroups` would read the same map before
and after, because the map was built before the story ever mounted.

## Decision

**Add a write path, and derive memberships from the panel's own current
state rather than from a snapshot taken at import time.**

### What mutates

A patch overlay, not a mutated seed. `demoUsers` stays the frozen,
deterministic array `buildUsers()` produces — the same array today's fixtures,
`memberships.ts`, and every read op already trust. A new `demo/state.ts` holds
one `Map<string, Partial<OktaUser['profile']>>` keyed by user id, and two
helpers that merge the seed with whatever the map holds: `currentUsers()` for
the whole merged array, `currentUserById(id)` for one. Every read path in
`api.ts` that returns a user goes through one of these instead of
`demoUsersById.get`.

The alternative — write straight into `demoUsers` — was rejected because it
throws away the property that makes this data trustworthy in the first place:
it stays the same 250-row array on every run, diffable against itself, and a
bug in the write path would corrupt state that every other scene in the same
story-file session also reads. A patch overlay keeps the seed inert. Reset is
`.clear()`, not a rebuild of 250 users.

One field in the merge is deliberately not anchored the way the rest of the
org is: a patched user's `lastUpdated` is stamped with the wall clock rather
than the dataset's frozen `isoDaysAgo` anchor, because the panel must not
report an edit the viewer just watched as having happened a month ago. Every
other date in the org stays anchored.

### How memberships re-derive

`memberships.ts` stops computing `demoGroupMembers` and `demoUserGroups` as
module-level constants built once from `demoUsers`. It keeps its internal
`buildMemberships()` but changes what it exports from constants to
zero-argument functions — `demoGroupMembers()` and `demoUserGroups()` —
each reading a module-level memo that is rebuilt
only when `state.ts`'s `demoRevision()` has moved since the memo was last
built. That counter, not a dirty boolean, is the invalidation signal because
it is monotonic and cannot get out of step with the data the way a boolean
can when two writes land back to back. `RULE_FED` is untouched — same ten department
predicates, same office predicates, same `githubEngineering` hero rule. The
property ADR-0043 cared about, "membership is computed from the rule
predicate, never asserted," is not merely preserved by this change. It
becomes _more_ true than it was, because the group's membership is now
recomputed against the user's live profile rather than read off a snapshot
frozen before the story mounted. A member row claiming rule-based provenance
was already telling the truth about the seed; after this change it tells the
truth about the panel's current state, which is the state the camera is
actually pointed at.

**One carve-out, and the distinction matters.** `HAND_MANAGED` groups sample
once from a seeded RNG (`new SeededRandom(778899)`) and then hold that id
list for the life of the module. This is not an oversight to fix alongside
the rest of the derivation — these groups have no predicate by definition,
they are _already_ a fixed sample rather than a computed answer, and nothing
about a profile write should make them behave otherwise. Re-sampling them on
every write would reshuffle six unrelated groups' rosters on camera for no
reason connected to the shot being filmed. So `HAND_MANAGED` membership stays
computed once and is excluded from the memo's invalidation.

Freezing the sample of a group that has no predicate is not the same act as
hand-listing a membership to make a shot work, and a future reader must not
conflate the two. The first is what a hand-managed group already _is_ in a
real org — someone typed a roster, and no rule will ever revise it. The
second would be asserting a membership this codebase has spent three ADRs
refusing to assert. `HAND_MANAGED` groups were never derived; this change
does not start deriving them, and does not stop deriving the groups that
already were.

### How the snapshot follows the write

A write that only updated `state.ts` and the memberships memo would be
correct in memory and wrong on screen, because the panel does not read
`demoGroupMembers` directly. `snapshot.ts` used to write `_embedded.stats.usersCount`
from the membership map at module-load time, and `control.ts`'s
`seedDemoSnapshot()` pushes those rows into real IndexedDB via
`orgSnapshotStore.upsertMany` (ADR-0040). After a profile write, the stored
group rows carry counts computed before the write — the same staleness
problem ADR-0040 built the whole delta/drift mechanism to solve for a live
org, now showing up in the fixture that is supposed to demonstrate it.

So the new write operation, `demoUpdateUserProfile`, finishes by re-seeding
the group rows whose membership it just changed, and firing
`emitRuntimeMessage({ action: 'snapshotUpdated' })`. Both mechanisms already
exist on `DemoControls` — `seedDemoSnapshot` and `emitSnapshotUpdated` are
already there for the story's initial stage, and firing the same broadcast
mid-scene is not a new mechanism, only a second caller of one. This is
deliberate: the write exercises the app's genuine repaint path, the same
`onChanged`/`snapshotUpdated` listener a real org's background sync would
trigger, rather than a shortcut that repaints the panel some other way and
proves nothing about what a real write does.

### Group rows carry no frozen count

`snapshot.ts` used to stamp `_embedded.stats.usersCount` into each group
template at module load. After a write, that number is wrong and looks fine —
nothing about a stale count announces itself as stale. So the templates now
carry no `_embedded` at all; the array is module-private `groupTemplates`, and
a new `currentGroups()` stamps the count at read time from the live
memberships (`currentGroupsById()` is its map form, and `DEMO_GROUP_COUNT`
replaces the old `demoGroups.length` for callers that only need a count, not
a derivation). A stale count is invisible; an absent one is not, so the shape
that could go stale was removed rather than kept and remembered about.

### How a scene resets between takes

`stage()` in `scenes.stories.tsx` already resets the mocked chrome layer, the
scheduler, the page context, and the sync responder before every scene. A new
`resetDemoWrites()` — calling `state.ts`'s `.clear()` — joins that list. No
new lifecycle is introduced; a scene that does not know about writes calls
the same reset function every other scene already calls and pays nothing for
it.

### How the walk proves the change landed

This is the part that decides whether the shot is honest, and it follows
`attributes.mjs`'s own precedent rather than inventing a new discipline:
that walk already refuses to ship a take whose second filter did not narrow
the roster, because "two filters that compose to the same number is not an
argument, and it is invisible at playback speed unless someone reads the
numbers." A profile write that silently did nothing has the identical
failure shape.

Not a hold, and not a hope that the transition looked right. Four
read-backs and two refusals:

1. **Before.** Read the department field's current value and the user's
   Groups badge count off the panel — the panel's own state, not a value the
   walk already knows from the fixture.
2. **The write.** Type the correction, press Save, then `waitFor` the
   panel's own save confirmation — a selector the real `UpdateProfileResult`
   surface renders, never a fixed timeout. A timer here would pass on a take
   where the write silently failed, exactly the failure mode ADR-0035 wrote
   `'unknown'` into the type system to stop a caller from rounding away.
3. **After.** `waitFor` a row for the specific group, by name, appearing in
   the user's group list. A badge moving from 5 to 6 is not something
   Playwright can wait on — a number changing is not an event — but a named
   row appearing in the DOM is. Read the group count again once it has.
4. **Refuse the take** if the count after did not exceed the count before,
   or if the named group's row was already present before the write ran.
   Either means the chapter's claim — the fix landed, the rule applied — was
   not demonstrated, and a chapter that does not show what it claims must
   not ship, exactly the standard `attributes.mjs` already holds itself to.

### Consequences

Everything lands under `src/sidepanel/demo/` — a new `state.ts`, the write op
added to `api.ts`, the derivation change in `memberships.ts` — plus one
facade override in `scenes.stories.tsx` replacing the mock's canned
`updateUserProfile` stub with the real demo implementation for scenes that
need it. `demo/` is already excluded from `coverage.exclude` and unreachable
from the manifest entry graph (ADR-0043), so no shipped code path changes and
nothing here needs a behavioural test of its own. No new dependency, no
`manifest.json` change.

`capture.mjs`'s `SHARED_INPUTS` hashes the whole `src/sidepanel/demo` tree to
fingerprint every clip, so this change invalidates **every** chapter's
footage, not only Users'. A full re-shoot from cold runs roughly 2:48
(ADR-0045's own consequences). That cost is the reason this lands as one
early commit, before any chapter-specific slice, rather than being spread
across the reel restructure — paying the expensive invalidation once, up
front, instead of paying it again every time a later slice touches
`demo/`.

This also unblocks **History** as a filmable chapter. It was re-classified in
the reel treatment as blocked not on fixtures but on there being anything to
audit — no write has ever happened in the demo org, so its audit trail has
always been empty. A profile write finally produces a real audit entry, with
a real Undo behind it (ADR-0035 §2's `'partial'`-only exception aside), which
makes History the film's honest closing beat rather than an empty list with a
caption explaining why.
