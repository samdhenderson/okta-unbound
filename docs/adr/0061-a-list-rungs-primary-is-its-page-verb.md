# ADR-0061: A list rung's `primary` is its page verb, and the open panel says so in words

- Status: Accepted
- Date: 2026-08-31
- Amends: [ADR-0051](./0051-a-verb-strip-for-a-list-rung.md) §1, which spends `primary`
  on the open inline panel
- Relates to: [ADR-0038](./0038-a-strip-that-knows-what-it-holds.md) (the descriptor
  vocabulary and the fit arithmetic), [ADR-0039](./0039-wrap-the-strip-and-ship-no-verb-without-a-wire.md)
  (the wrapper and the consequence test), [ADR-0030](./0030-detail-page-layout-contract.md)
  §2 (a verb whose object is the whole page goes in `ActionBar`)

## Context

ADR-0051 §1 answered a question ADR-0039 had left open — what `variant: 'primary'` means
on a list rung — and answered it like this:

> A detail rung has one page-level verb, and `variant: 'primary'` names it. A list rung
> does not: _Compare_, _Merge_, _Bulk actions_ and _Export_ are peers whose availability
> is gated by how many rows are ticked […] What this strip does have is exactly one piece
> of state worth marking — **which inline panel is currently open**.

That is a correct description of the Groups rung and a false generalisation about list
rungs. Sam's report, on seeing the strip: _"groups tab has no blue buttons and it should."_
The observation is right, and the reason it is right is structural rather than aesthetic —
with no panel open, which is the state the rung rests in, `GroupsListActionBar` renders a
row of six identically-weighted `secondary` buttons and nothing tells a reader where to
start.

Two things were wrong with the original decision, and only the first is about colour.

**1. Some list rungs do have a page-level verb.** The Rules rung is the counter-example
that forced this: rules do not load on mount, so **Load rules** — and, once loaded,
**Refresh**, which is the same control — is the one thing that has to happen before the
rung means anything at all. That is a page-level verb in exactly ADR-0030 §2's sense: its
object is the whole page, not a selection, not a section. It was sitting in
`PageHeader.actions`, which is the slot ADR-0030 §2 exists to move verbs _out_ of.

**2. `primary` was the wrong carrier for panel state regardless.** An `ActionDescriptor`
carries no `aria-pressed` and no `aria-expanded` — ADR-0038 deliberately gave it no
vocabulary beyond `id`, `label`, `icon`, `variant`, `priority` and the handlers. So a
`primary` wash marking the open panel is **colour-only state**: a screen reader is told
nothing, and neither is a sighted reader who cannot pick a filled button out of a row.

ADR-0051 reached for `variant` because it read the descriptor's vocabulary as
`variant` plus `priority`. But it had already used the third option two sections later, in
§4, without naming it as one:

> Cached cross-group results ride the label the same way (`Cross-search (5)`), because a
> descriptor has no badge slot.

The label is state-bearing vocabulary. It was already carrying counts.

This repo has made this exact correction before, one level down. `RuleCard`'s docblock:

> **The status is stated in text, not hue.** It was a coloured dot — green ring for
> `ACTIVE`, grey for anything else — with no accompanying label, so the one fact the card
> most needed to carry was available only to a reader who could see the colour _and_ knew
> the convention.

A strip is no different from a card.

## Decision

**On a list rung that has a genuine page-level verb, `variant: 'primary'` names that verb.
The open inline panel states itself in its own label, which swaps to `Hide …`, and takes
`priority: 'pinned'` while open.**

Both halves are load-bearing, and neither weakens ADR-0051.

### 1. What counts as a page-level verb here

The ADR-0030 §2 test, unchanged: **the verb's object is the whole page.** Load/Refresh
acts on the rung's entire subject — every rule in the org — and its availability is not a
function of any selection, filter or panel. _Compare (3)_ and _Merge (3)_ fail that test on
the Groups rung, which is why that strip legitimately has no `primary` today and is not
changed by this ADR.

A rung has **at most one** such verb, so ADR-0038's "at most one `primary` per strip"
still holds by construction rather than by discipline. It holds more strongly than it did
under ADR-0051, in fact: the load verb is always present and always `pinned`, so there is
no state in which it is absent and something else could claim `primary`.

### 2. The panel's state moves into the label

`Duplicates (3)` → `Hide duplicates`. `This group (2)` → `Hide this group`. `Stats` →
`Hide stats`.

This is strictly more information than the wash it replaces. The closed label says what
the panel holds and how much of it there is — the two things a reader needs to decide
whether to open it — and the open label names the way back. Both are read by a screen
reader, and neither depends on recognising a colour convention.

**The width cache tolerates this, and that was checked, not assumed.**
`useActionOverflow` keys its cache on a signature that includes the label, not on the
`id` alone:

```ts
/** Visible label. Part of the cache signature — it is most of the width. */
```

A label swap under a stable `id` is therefore re-measured rather than served a stale
width. Had it keyed on `id` alone, this decision would have been unavailable — the strip
would have seated `Hide duplicates` using the width of `Duplicates (3)`.

### 3. `pinned` while open is kept, and it is the half that matters for safety

ADR-0051's real safety property was never the colour. It was this:

> `ActionBar` treats a `primary` action as `priority: 'pinned'`, so the control that
> **closes** the open panel can never itself overflow behind **More** while the panel it
> toggles sits open below.

That is preserved by setting `priority: 'pinned'` explicitly instead of getting it as a
side effect of `variant`. Decoupling the two is an improvement in its own right: pinning
and emphasis were being requested with one word, and they are separate properties.

ADR-0051 §2's rule — **position one is a safety property, where the set of verbs varies
with state** — is untouched. It binds the Groups rung because its verbs appear and
disappear with the selection. The Rules strip's leading position is the load verb in every
state, whose worst outcome is a re-fetch.

### 4. What this does not change

- **The consequence test is untouched.** ADR-0039 decides which _tier_ a verb starts in;
  this decides what `primary` _means_ in the row. A page-level verb that failed the
  consequence test would go to the tier and take no `primary` at all.
- **Frequency as a bounded second tier reason survives** (ADR-0051 §2). The Rules strip
  uses it for all three panel toggles: every verb on that strip is read-only, so none is
  in the tier on consequence.
- **`GroupsListActionBar` is not converted.** It has no page-level verb to promote, so
  applying this rule to it means removing its `primary` and leaving it with none — a
  different change, with a different justification, that belongs in its own commit.
  Filed as an `IMPROVEMENTS.md` item.

## Consequences

- **`RulesListActionBar` ships to this rule** and is the reference shape for it:
  `Refresh` / `Load rules` as `primary`, three panel toggles resting in the tier with
  `Hide …` labels when open.
- **The Rules rung's `PageHeader` loses its `actions` slot.** Load/Refresh moved into the
  strip. The `N Conflicts` badge stays, and is now what carries that count at a glance,
  since `RulesStatsGrid` went behind a disclosure.
- **`RulesMergeBanner` becomes `RulesDuplicatesPanel` and loses its outer collapsible.**
  It was a band that started _collapsed_ and put each set behind a second chevron — two
  presses to see one duplicate, on the most valuable read-only analysis the tab performs.
  The strip's `Duplicates (N)` verb is the single disclosure now, and the count is stated
  where the reader decides whether to open it.
- **Two strips now differ in whether they have a `primary`**, and that is the intended
  outcome rather than an inconsistency to iron out: it reflects whether the rung has a
  page-level verb, which is a real difference between the two rungs.
- **A second colour-only state was found and fixed on the way**, one level down.
  `FilterToggle`'s count badge appended a bare digit to the button's content, so its
  accessible name computed as `Filters2` — a number read out with nothing naming what it
  counted. The badge is now `aria-hidden` and the count is stated in the `aria-label`
  (`Filters, 2 applied`). Same correction, same reason.
- **The open question ADR-0051 left about panel placement is not answered here.** Its
  consequences note that where inline panels sit in the page flow was raised by Sam and
  not addressed; the Rules rung places its three directly under the strip, which is a
  choice made by precedent rather than by a decision.
