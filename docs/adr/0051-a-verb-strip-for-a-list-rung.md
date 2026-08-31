# ADR-0051: A verb strip for a list rung

- Status: Accepted (§1 amended by [ADR-0059](./0059-a-list-rungs-primary-is-its-page-verb.md))
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

> **Amended by [ADR-0059](./0059-a-list-rungs-primary-is-its-page-verb.md).** This section
> generalised from one rung. Some list rungs _do_ have a page-level verb — the Rules rung's
> **Load rules** / **Refresh**, without which the rung means nothing — and on those,
> `primary` names that verb. The open panel states itself in its **label** instead
> (`Duplicates (3)` → `Hide duplicates`), which is strictly more information than the wash:
> an `ActionDescriptor` carries no `aria-pressed`, so `variant: 'primary'` was colour-only
> state that no screen reader could read. The `pinned`-while-open half below is kept, set
> explicitly rather than as a side effect of `variant` — that was always the real safety
> property. `GroupsListActionBar` is unchanged: it has no page-level verb, so this section
> still describes it exactly.

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

### 2. Position one is a safety property, and the tier sorts by both consequence and frequency

> **This section was rewritten after review.** Its first version claimed the consequence
> test returns _row_ for every verb here, on the grounds that _Merge_ and _Bulk actions_
> "open a wizard and a panel, they don't write". That reasoning is wrong, and the strip it
> produced was unsafe. It is left described here because the failure is the useful part.

Every verb on this strip except the selection control **appears and disappears with the
selection size**. That is not true of a detail rung, where the verbs are a property of the
entity and the row is stable. It means the control in any given position _changes as you
tick rows_, and the first cut of this strip ordered by weight — so at two selections the
leading control became `Compare`, and at six it became `Merge`, directly under the pointer
that had a moment ago been pressing `Select all`.

`Merge` copies members into a survivor and **empties the sources**. Sam's description of
the failure mode: "a full wipe and a new mega group."

Two rules follow.

**Position one is always a selection control.** `Deselect all` leads the moment anything is
ticked; `Select all (M)` follows, and both are `pinned`, so the row wraps rather than
overflowing either. Whatever the selection size, the two leftmost controls cost at worst
another click. `Select all (M)` stays visible — _disabled_ — once everything is taken,
because `(M)` is the strip's only statement of how many rows the filter matches, and a
count that disappears at full selection is a count you cannot check.

**A wizard in front of a verb does not move it into the row.** ADR-0039's test asks what
the verb _does_, not what stands between the press and the doing:

- **`Merge`** empties the source groups. → tier.
- **`Bulk actions`** offers _Clean inactive users_ and _Remove user from all_, which delete
  memberships across every selected group. → tier.
- **`Cleanup`** is a read-only triage report and passes the consequence test. It is in the
  tier anyway, on **frequency**: it is the rarest verb on the rung and does not deserve row
  width that `Compare` and `Export` want.

So the tier holds both kinds, and frequency remains the weaker reason: it may move a verb
down, never up, and never brings a confirm `Modal` with it. Consequence does. Each of the
two consequential verbs owns its confirmation already — the merge wizard previews the
member delta and what breaks before committing; the bulk panel reports per-group results —
so nothing new was added, but neither starts in the row.

**ADR-0039's batch question is narrowed, not answered.** _Bulk actions_ is a genuine batch
mutation and it is in the tier, so the shape of the rule holds over _N_ items. What is
still untested is the failure mode ADR-0039 actually raised: a partial batch, where some
groups succeeded and some did not, and "reversible" stops being a property of the verb.

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

### 5. The rung gives up its nested scroller so the strip can dock

The first cut passed `sticky={false}`, on the grounds that the groups list rung was
"already a fixed toolbar zone above its own inner scroller, so there is nothing for the
strip to pin against". That is a true description of the rung and the wrong conclusion
about it. The rung was the problem.

`GroupsTab` was a `h-[calc(100vh-280px)] min-h-[400px]` flex column with a frozen toolbar
over a `ScrollableList` scroll box. Three things follow from that shape, and all three are
bad:

- **Nothing in the toolbar can be `sticky`**, because there is no page scroll for it to
  stick against. So the strip could only ever be a card bolted to the top — Sam's reading
  of it: "just a grey permanently stuck component" — while every other `ActionBar` in the
  app docks and merges into its header as it parks.
- **Two scrollbars.** An inner one for the list beside the panel's own.
- **The height comes from a magic number.** `100vh - 280px` is the sum of a chrome, a
  header, two gutters and a footer, none of which it is measured from, and all of which
  ADR-0032's published heights exist to stop hard-coding.

So the rung is now a plain block that scrolls the panel's one scroller, exactly like the
Users tab, and the strip is `sticky` with no argument. `ScrollableList` gains
`scrolls={false}` for the list inside it.

**The strip is a direct child of the rung, not of the toolbar group**, and that is
load-bearing rather than tidy: a `sticky` element only travels within its own parent's box.
Nested one level deeper, in a wrapper holding just the strip and the filter panel, it
measured un-sticking and scrolling away at `y = -183` instead of parking at 205. Its parent
has to be the box the list is in. (The `.dock-sentinel` timeline hoists onto that same
parent — `:has(> .dock-sentinel)` — so the two constraints agree.)

**The search field moves into the strip**, via a new `subRow` slot on the shared
`ActionBar`: always-visible caller UI inside the band, under the verbs and above the tier.
So search docks with the verbs rather than scrolling away from them, and the **More** tier
opens _below_ the field rather than between the verbs and the thing they filter. It is
never measured — the fit arithmetic only reads the action row — which is why, unlike a
descriptor, it may carry JSX.

Measured in Chromium at 360px, scrolled: header collapses 114px → 64px, the strip parks at
`y = 155` (= the scroller's 91px top edge + 64px of header) with `top` tracking `--header-h`
live through the collapse, and its `::before` runs the merge from `inset-inline: 0` /
`radius: 6px` to `-12px` / `0`. One continuous white surface from the chrome down.

### 6. A pinned header collapses its subtitle

A detail rung's header collapses its identity region when it pins (ADR-0032). A list rung
has no identity region, so it pinned at full height — 114px on the Groups tab at 360px,
most of it the subtitle wrapping to three lines, parked permanently over 91px of chrome.
That was invisible while the rung had a nested scroller, because nothing ever scrolled past
the header.

`PageHeader`'s subtitle now collapses through the same `.disclose` grid: it is orientation,
worth a line while you are arriving and nothing once you are reading. 114px → 64px.

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
- **`ActionBar` gains one prop, `subRow`.** ADR-0038 declined to ship slots without a
  consumer ("shipping an unused prop is dead API"); this is the consumer. It is additive
  and optional, so no existing call site changes.
- **`GroupsTab`'s scroll preservation changed subject, not behaviour.** The rung's list
  offset used to live on its own `.scrollable-list` box, destroyed by `display: none` on a
  push. It now lives on the shared scroller, passed in as `scrollRootRef` — never
  `display: none`, but _clamped_ by a shorter detail view, which needs the same repair.
  `TabPanel`'s own preservation of that node does not collide: it transitions on a tab
  switch, this one on a push or pop, and the two never fire in the same commit. The test
  that pinned it was retargeted, not dropped.
- **`AppsTab` still has the old shape** — `h-[calc(100vh-280px)]` over a nested scroller.
  It was not touched here. Anything that wants a sticky band on that rung has to make the
  same move first.
- **Frequency as a tier reason is now precedent.** It is bounded on purpose: it may move a
  verb down, never up, and never substitutes for the consequence test.
- **A list rung's verb order is a safety surface, not a layout preference.** The general
  rule this incident produced: where the set of verbs varies with state, the leading
  position must be occupied by something whose worst outcome is another click. Any strip
  whose contents are conditional inherits this.
