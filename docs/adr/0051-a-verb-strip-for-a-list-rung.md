# ADR-0051: A verb strip for a list rung

- Status: Accepted
- Date: 2026-08-28
- Discharges: ADR-0039's deferral ("that refinement is for whichever ADR ships
  `GroupSelectionBar`, not this one") and ADR-0038's named extension point
- Relates to: ADR-0030 (page-level vs section-level verbs), ADR-0032 (the header
  describes the entity)

## Context

`GroupSelectionBar` was ten `Button`s and an `N of M selected` readout, hand-laid on a
`bg-neutral-50` card above the groups list. It predates `ActionBar` and never converged on
it; ADR-0038 named it as the descriptor model's extension point "when it comes", and
ADR-0039 explicitly declined to govern it, leaving two questions open:

> A selection bar's "primary" action does not obviously mean the same thing when _N_ items
> are selected instead of one page being browsed, and whether "no symmetric undo" reads the
> same over a batch […] is a real open question this ADR does not answer.

Three things were wrong with the bar, and only the third is cosmetic:

1. **It could not overflow.** Ten verbs need well past 700px of row. The panel opens at
   480px and drags to 360, so the row wrapped to three lines, giving _Cleanup_ — a triage
   panel almost nobody opens — the same standing as _Compare_.
2. **Grey is this panel's inert wash** (disabled inputs, empty cells). A grey slab of
   controls above a white list reads as a section that has been switched off.
3. It was a fourth kind of box on a rung that already has a header, cards and rows.

## Decision

The strip becomes `GroupsListActionBar`, an ADR-0039 wrapper around the shared
`ActionBar`. The two open questions are answered as follows.

### 1. On a list rung, `primary` marks the open panel, not the important verb

A detail rung has one page-level verb, and `variant: 'primary'` names it. A list rung does
not: _Compare_, _Merge_, _Bulk actions_ and _Export_ are peers whose availability is gated
by how many rows are ticked, and which one matters is a property of what the admin is
doing, not of the page.

What this strip does have is exactly one piece of state worth marking — **which inline
panel is currently open**. So that is what `primary` is spent on. Two things fall out, and
both are wanted:

- At most one panel is open at a time, so ADR-0038's "at most one `primary` per strip"
  holds by construction rather than by discipline.
- `ActionBar` treats a `primary` action as `priority: 'pinned'`, so the control that
  **closes** the open panel can never itself overflow behind **More** while the panel it
  toggles sits open below it.

An `ActionDescriptor` carries no JSX and no `className` — deliberately, since a strip that
cannot see what it holds cannot decide what fits — so this is also the only vocabulary
available for the state. The old bar expressed it with an ad-hoc `ring-2 ring-primary/20`
on the trigger.

### 2. The tier here sorts by frequency, because nothing in it sorts by consequence

ADR-0039's row-vs-tier test is consequence: reversible or read-only goes in the row, a
state change with no symmetric undo goes behind **More** with a confirm `Modal`. Applied to
this strip, the test returns _row_ for everything. _Compare_, _Cross-search_ and _Cleanup_
read; _Collections_ writes to local storage; _Export_ writes a file; _Select all_ /
_Deselect_ change nothing but the selection. The two verbs that could mutate Okta — _Merge_
and _Bulk actions_ — do not mutate anything when pressed: they open a wizard and a panel,
each with its own confirmation, so the strip never fires a batch write directly.

So the tier is used for a second, weaker reason: **frequency**. _Cleanup_ opens an
org-wide triage panel and is the rarest verb on the rung, so it starts at
`priority: 'tier'` rather than competing for row space with verbs pressed daily. That is a
genuine refinement of ADR-0039, and it is narrow — frequency may move a verb to the tier,
but only consequence may _require_ it there, and only consequence brings a confirm `Modal`
with it.

**ADR-0039's batch question is therefore still open**, not answered: because no verb in
this strip commits a batch write, nothing here tests whether "no symmetric undo" reads the
same over _N_ items as over one. Whichever surface first puts a real batch mutation in a
strip has to answer it.

### 3. "No verb without a wire" extends to "no verb without an object"

ADR-0039 forbids declaring a descriptor for a handler that is not wired. The same
discipline covers a verb whose object does not exist yet: below its selection threshold,
_Compare_ (2–5 selected), _Merge_, _Bulk actions_, _Export (N)_ and _Deselect_ are
**omitted**, not rendered disabled. A verb with nothing to act on is not a verb yet.

_Export list_ is the one deliberate disabled state and the distinction is worth keeping
sharp: it acts on the **filter**, not the selection. At zero filtered rows it is a live,
wired verb whose result happens to be empty — which is worth saying out loud rather than
making the control vanish and leaving the admin to wonder whether exporting is possible
here at all.

### 4. The counts move into the verbs that use them

The `N of M selected` readout is gone. Both numbers survive where they are acted on:

- **N**, the selection, is the `PageHeader` badge (`3 Selected`) and rides the labels of
  every verb scoped to it — _Compare (3)_, _Merge (3)_, _Export (3)_.
- **M**, the filtered denominator, is what _Select all (128)_ offers to take, and
  `GroupsListPanel` still prints `Showing X of Y` beneath the list.

A count is only ever read in order to decide whether to press something, so putting it on
the thing you press is not a compression — it is where it was needed. Cached cross-group
results ride the label the same way (`Cross-search (5)`), because a descriptor has no
badge slot.

### 5. The strip is not sticky here

`sticky={false}`. The groups list rung is already a fixed toolbar zone above its own inner
scroller, so there is nothing for the strip to pin against and nothing to merge into; it
renders `.dock-band`'s resting card, which is the white bordered card every other surface
on the rung is.

## Consequences

- **`GroupSelectionBar` is deleted**, along with its story. `GroupsListActionBar` and
  `GroupsListActionBar.stories.tsx` replace them; `ActivePanel` moves with it and
  `GroupsTab`'s import is the only call site.
- **Seventeen `GroupsTab` tests were retargeted, none weakened** (ADR-0012). They asserted
  the old labels (`Bulk Actions` → `Bulk actions`, `Cross-Search` → `Cross-search`) and the
  `N of M selected` string; each now asserts the same two numbers through `Select all (M)`
  and the `N Selected` badge. The cross-search count assertion moved from a `Button` badge
  element to the label text, because a descriptor cannot carry one.
- **The three inline panels that opened with a grey band header** — `BulkOperationsPanel`,
  `CrossGroupSearch`, `GroupCollections` — lose it, matching `GroupCleanupPanel`, which had
  the right shape already. They remain cards below the strip rather than moving into the
  tier: they are large surfaces (a triage report, a collections manager) and a disclosure
  that stretches a band to 400px is not a disclosure. **Their placement in the page flow is
  a known open question**, raised by Sam when this landed and not addressed here.
- **Frequency as a tier reason is now precedent.** It is bounded on purpose: it may move a
  verb down, never up, and never substitutes for the consequence test.
