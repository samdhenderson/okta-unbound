# ADR-0068: A rung's `primary` is a verb that acts, not a verb that fetches

- Status: Accepted
- Date: 2026-09-03
- Amends: [ADR-0061](./0061-a-list-rungs-primary-is-its-page-verb.md) §1, which defines
  `primary` as the rung's "page-level verb" and offers a load/refresh control as the
  reference example
- Supersedes: [ADR-0051](./0051-a-verb-strip-for-a-list-rung.md) §1's reading, that
  `primary` marks which inline panel is open
- Relates to: [ADR-0069](./0069-refresh-is-one-app-level-control.md) (which removes the
  control ADR-0061 pointed at), [ADR-0038](./0038-a-strip-that-knows-what-it-holds.md)
  (the descriptor vocabulary and "at most one `primary`"),
  [ADR-0039](./0039-wrap-the-strip-and-ship-no-verb-without-a-wire.md) (the wrapper and
  the consequence test), [ADR-0030](./0030-detail-page-layout-contract.md) §2 (a verb
  whose object is the whole page goes in `ActionBar`)

## Context

`primary` has now been defined twice and is wrong both times, in the same direction: each
definition described the rung in front of it rather than the property being marked.

ADR-0051 §1 spent it on **which inline panel is open**. ADR-0061 corrected that — an
`ActionDescriptor` carries no `aria-pressed`, so a filled wash was state only a sighted
reader could perceive — and replaced it with **the rung's page-level verb**, tested by
ADR-0030 §2's question: is the verb's object the whole page?

That test is necessary and not sufficient. It admits two things that should never wear the
panel's one filled button:

- **A fetch.** ADR-0061's reference example was `RulesListActionBar`'s _Load rules_ /
  _Refresh_, and its argument was that "rules do not load on mount, so nothing on that rung
  means anything until it is pressed". Both halves of that were true and neither is any
  more. [ADR-0069](./0069-refresh-is-one-app-level-control.md) makes the Rules tab fetch on
  open and moves every rung-level refresh to a single app-level control, so the `load`
  descriptor leaves `RulesListActionBar` entirely. The reference example for the accepted
  rule is being deleted by the very next decision — which is the immediate reason this ADR
  exists, and the reason it has to supply a replacement.
- **An export.** Two strips reached ADR-0061's test with an export and passed it, because
  an export's object genuinely is the whole page. `GroupActionBar`
  (`src/sidepanel/components/groups/detail/GroupActionBar.tsx`) ships `export-members` as
  `primary`; `GroupsListActionBar` (`src/sidepanel/components/groups/GroupsListActionBar.tsx`)
  ships `export-list` as `primary` with a comment naming it "the rung's page-level verb,
  and the reason this strip has a `primary` at all". Neither is what an admin came to the
  rung to do. Both are the same gesture — leave, carrying a file.

So the filled button on the Groups detail rung currently advertises _Export members_ while
_Add_ — the verb that changes the group — sits beside it in plain `secondary`, and the
groups list rung advertises _Export list_ over every verb that touches a group.

**A correction to the record while we are here.** ADR-0061 §4 states that converting
`GroupsListActionBar` was "filed as an `IMPROVEMENTS.md` item". It was not. There is no
mention of `GroupsListActionBar` anywhere in `IMPROVEMENTS.md` or `DEBT.md`. The
deferral was real; the filing never happened, so the conversion has been carried by a
sentence in an accepted ADR for a fortnight with nothing tracking it. That is the failure
mode a deferral note is supposed to prevent, and it is worth stating plainly rather than
quietly fixing: **an ADR asserting that an item was filed is not evidence that it was.**

## Decision

**`primary` names a verb that acts — one that opens a modal or performs the operation. It
is chosen per rung, and it is never a refresh and never an export.**

### 1. `primary` is a verb that acts

The test is now two questions, both of which must answer yes:

1. **Is its object the whole page?** (ADR-0030 §2, unchanged — it still excludes anything
   scoped to a selection, a filter or a section.)
2. **Does pressing it act?** It opens a modal, or it performs the operation. It does not
   fetch the rung's own data, and it does not hand the reader off to a different tab.

"Acts" is deliberately satisfied by _opening the modal_ rather than by _committing the
write_. ADR-0051 §2 already settled that a wizard in front of a verb does not change what
the verb is; the same holds here in the other direction. `Add` is the verb whether or not
the admin completes the dialog.

A rung has **at most one** such verb, so ADR-0038's "at most one `primary` per strip" keeps
holding by construction. A rung may legitimately have **none** — that is a real answer, not
a gap to fill, and a strip of evenly-weighted `secondary` verbs is the correct rendering of
a rung whose verbs are all peers.

### 2. A refresh is never `primary`, and an export is never in the row at all

Two exclusions, for two different reasons.

**Refresh is excluded because it is no longer a rung verb.** ADR-0069 makes it one
app-level control beside the Pin. There is nothing left on a strip for this clause to
exclude — the clause exists so that the next rung to want a fetch button does not
re-derive ADR-0061's argument from scratch and put it back.

**Export is excluded because it leaves.** An export descriptor does not produce a file
in place; it forwards to the Export tab with the column picker and presets. That is
navigation wearing a verb's clothes, and it is never the thing the rung is for. So,
everywhere, without exception:

> **An export descriptor takes `priority: 'tier'`.**

Behind **More**, in every strip, on every rung, list or detail. This is stronger than
"not `primary`" on purpose. Export is frequent enough to be tempting and consequential
enough to be worth a deliberate second press, and ADR-0051 §2 already established
frequency as a bounded reason to move a verb down. This is that reason applied in the
opposite direction — an export is not rare, it is simply never the point — and it needs
to be a flat rule rather than a judgement call, because every strip author has so far
judged it the other way.

The one export that is not a descriptor is unaffected: `Export list` acting on the
**filter** rather than the selection keeps ADR-0051 §3's deliberate disabled state. It
moves tier; it does not vanish.

### 3. `GroupActionBar`'s **Add** is the reference shape

Replacing ADR-0061's _Load rules_:

```
Add            → opens the add-members modal.  primary.
Compare        → opens the comparison panel.   flex.
Export members → forwards to the Export tab.   tier.
Remove N deprovisioned → writes, no undo.      tier + confirm Modal (ADR-0039).
```

`Add` passes both questions. Its object is the whole group, not a selection of rows and
not a section. It opens a modal that then performs a write. And it passes ADR-0039's
consequence test in the row's favour — adding a member is reversible by removing one, so
it does not owe a confirmation and does not belong in the tier.

That last point is what makes it a better reference than the verb it replaces. _Load
rules_ demonstrated the ADR-0030 §2 half of the rule and nothing else, because a fetch has
no consequence to test. `Add` exercises both gates in one descriptor, which is what a
reference example is for.

The list-rung instance is weaker and is named as such. `GroupsListActionBar`'s
**Cross-search** is the only verb on that rung whose object is the whole rung rather than
a tick-count — it searches across groups for a user, which is the thing the rung exists
to answer that a row cannot. It is the strip's `primary` under this rule. Two constraints
come with it, and neither is optional:

- Its `primary` is **constant**. It does not appear when the panel opens and vanish when
  it closes. ADR-0061 §2 still owns the open/closed state, in the label (`Cross-search (5)`
  → `Hide cross-search`), and re-coupling emphasis to panel state would reinstate exactly
  the colour-only state ADR-0061 removed.
- It is still `panelAction`-shaped, so it keeps `priority: 'pinned'` while open for
  ADR-0051 §1's surviving safety reason: the control that closes an open panel must never
  overflow behind **More** while the panel sits open below it.

### 4. ADR-0051 §2 survives untouched — position one is still a selection control

Nothing in this ADR licenses reordering `GroupsListActionBar`.

ADR-0051 §2 is a **safety property**, not a layout preference, and it is the only rule in
this family that was written from an incident. Every verb on that strip except the
selection control appears and disappears with the selection size, so whatever sits in
position one changes as you tick rows. Ordering by weight once put **Merge** — which
copies members into a survivor and **empties the sources** — directly under the pixel that
had a moment earlier been `Select all`.

So, restated so that it cannot be lost in the diff this ADR causes:

> **Position one is always a selection control.** `Deselect all` leads the moment anything
> is ticked; `Select all (M)` follows; both are `pinned`. Whatever the selection size, the
> two leftmost controls cost at worst another click.

`primary` is an **emphasis** property. Position is an **ordering** property. ADR-0061 §3
already decoupled `pinned` from `variant` for this family of reasons; this section
decouples position from emphasis for the same one. Promoting `Cross-search` to `primary`
therefore changes its fill and nothing about where it sits — it stays after the two
selection controls, in declaration order, exactly where it is today.

Any strip whose set of verbs varies with state inherits this, whether or not it has a
`primary`.

### 5. What this does not change

- **The consequence test is untouched.** ADR-0039 decides which _tier_ a verb starts in;
  this decides what `primary` _means_ in the row. A verb that acts on the whole page and
  fails the consequence test goes to the tier and takes no `primary` — `Remove N
deprovisioned` is that case.
- **The open panel still states itself in its label** (ADR-0061 §2), and the width cache
  still re-measures a label swap under a stable `id`.
- **`ActionDescriptor` gains no vocabulary.** No badge slot, no `aria-pressed`, no JSX.
  This is a rule about which existing descriptor gets `variant: 'primary'`.

## Consequences

- **`GroupActionBar`'s `primary` becomes `Add`.**
  `src/sidepanel/components/groups/detail/GroupActionBar.tsx` (L184–232) currently declares
  `export-members` first with `variant: 'primary'`; `add-member` is `priority: 'flex'`.
  Under §1 and §2, `add-member` takes `variant: 'primary'` and `export-members` takes
  `priority: 'tier'`, still forwarding to the Export tab with its column picker and
  presets. The docblock comment above the array explains the current declaration order as
  overflow order and has to be rewritten with it.
- **`GroupsListActionBar` loses `export-list` as `primary` and gains `Cross-search`.**
  `src/sidepanel/components/groups/GroupsListActionBar.tsx` (L202–308). The `export-list`
  descriptor keeps its filter-scoped disabled state (ADR-0051 §3) and moves to
  `priority: 'tier'`; `export-selection` moves with it, under the same flat rule. The two
  selection controls stay in positions one and two (§4). This is the conversion ADR-0061
  §4 deferred, finally scoped — and it is not the conversion ADR-0061 predicted, which was
  "removing its `primary` and leaving it with none".
- **Every export descriptor in the app is now `tier`, and that is a flat rule.** Any strip
  that ships an export in the row is a defect, not a local decision. It applies to strips
  not named here as much as to the two that are.
- **`docs/components.md` 319–345 must be rewritten to this rule and is not touched by this
  ADR.** That passage currently says `primary` is spent on "a page-level verb, if there is
  one — `RulesListActionBar`'s _Load rules_ / _Refresh_ is the reference", and that
  `GroupsListActionBar` "has only selection-scoped peers, so it has no `primary`". The
  first reference is deleted by ADR-0069; the second describes a target state ADR-0061 §4
  deferred and **the code never matched** — that strip has shipped `export-list` as
  `primary` since it landed. A separate workstream owns that file; this ADR records the
  requirement rather than performing it.
- **ADR-0061 §4's claim that the `GroupsListActionBar` conversion was filed is false**, and
  the item still does not exist in either ledger. Filing it belongs to whoever owns the
  ledgers; recording that the accepted record is wrong belongs here, because ADR-0061 is
  immutable and a reader will otherwise go looking for an item that was never written.
- **Two rungs still differ in whether they have a `primary`,** and that remains the
  intended outcome. What changed is the reason: it is no longer "does this rung have a
  page-level verb" but "does this rung have a verb that acts on the whole page" — a
  narrower question that the Groups list rung now answers yes and the Rules rung, having
  surrendered its only candidate to ADR-0069, may well answer no.
- **The Rules rung's `primary` is left open.** Once `load` leaves the strip, its remaining
  descriptors are three read-only panel toggles. Under §1 none of them clearly acts, so the
  honest reading is that the rung has none — but that is a judgement about the Rules rung
  that belongs with the change that empties its strip, not asserted here in advance.
