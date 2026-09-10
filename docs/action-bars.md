# Action bars

A rung's verbs live in one place: the `ActionBar` strip beneath the header — who may
render it, what a descriptor may carry, where a new verb goes, and which verb wears
the fill. The primitive is
[`components/shared/ActionBar.tsx`](../src/sidepanel/components/shared/ActionBar.tsx);
its arithmetic is `actionBarFit.ts` and its measuring `useActionOverflow.ts`, both
beside it.

## A page-level verb lives on the strip

A verb whose object is **the whole page** belongs in the `ActionBar`. A verb scoped
to one section's data belongs in that section's `DetailSection.actions` slot. There
is no third home: `PageHeader.actions` holds badges and the working-set pin, not
verbs.

## Every page wraps the strip

**No page renders `<ActionBar>` directly.** It renders its own `<Entity>ActionBar`,
which computes the `ActionDescriptor[]`, owns whatever local state a tier needs, and
hands both to the shared strip. `UserActionBar` is the reference shape: entity plus
one callback per verb in, descriptors and tier contents out, and no disclosure
button of its own. `GroupActionBar`, `RuleActionBar`, `GroupsListActionBar` and
`RulesListActionBar` follow it.

This holds at one action exactly as it holds at five. A one-action page is the one
most likely to grow a second verb, and the wrapper is where that verb goes — an
inline call site does not get upgraded when the second arrives; someone has to
notice it was skipped.

## Verbs are data, never children

`ActionBar` takes `actions={ActionDescriptor[]}` — `id`, `label`, `icon`, `variant`,
`priority`, `onClick`, `disabled`, `loading`, `title`, `testId`. A strip that cannot
see what it holds cannot decide what fits, so it measures each action once in a
hidden probe and re-splits the row as the panel is dragged: everything on a wide
panel, every icon dropped at once when it tightens, then the tail moved behind
**More**.

**A descriptor carries no JSX, no `className`, no `aria-pressed` and no badge slot.**
An arbitrary node cannot be measured from a cached width nor re-rendered into the
tier with different chrome. Arbitrary UI goes in `expansion` (the tier) or `subRow`
(always visible, inside the band) — neither is measured, which is why they may carry
JSX.

Declaration order is reading order **and** overflow order. Put the verb an admin
came to press first; expect the last one declared to disappear first. `priority` is
`flex` by default and `pinned` for a `primary` action; `pinned` never overflows (the
row wraps first) and `tier` never reaches the row at all.

**Never render your own More button.** The strip owns the control, the region it
opens and that region's `aria-controls` target, and renders it only when the tier
has content. Leave the tier uncontrolled unless the page must collapse it on a rung
change.

## Where a new verb goes

Ask these in order.

1. **Is its object the whole page?** No — it belongs to a section, a selection or a
   filter, not this row. A selection-scoped verb goes in the `register` (below); a
   section-scoped one goes in that section.
2. **Is the handler wired, and does the verb have an object right now?** No — the
   descriptor **does not exist yet**. Omit it. Never ship a control with no path to
   firing and a tooltip that reads like a permission message.
3. **Can a second press undo it?** No — the verb starts in the tier
   (`priority: 'tier'`), behind a confirm `Modal` whose text states the consequence
   in plain language beside the control: _"Blocks sign-in until reversed"_,
   _"Copies members into one survivor and empties the others"_. The sentence names
   what changes, not what the button is called. **A wizard in front of a verb does
   not move it into the row** — the test asks what the verb does, not what stands
   between the press and the doing.
4. **Yes to both?** It starts in the row, `priority: 'flex'`.
5. **Is it rare enough that the row is not its to spend?** Frequency may move a
   row verb down to the tier — `Collections` and `Cleanup` sit there for this
   reason. Frequency may **only** move a verb down, never up, and never brings a
   confirm `Modal` with it.

Then decide the fill separately, below.

## `primary` is a verb that acts

At most one `primary` per strip. Two questions, both of which must answer **yes**:

1. **Is its object the whole page?** Not a selection, not a filter, not a section.
2. **Does pressing it act?** It opens a modal, or it performs the operation.

"Acts" is satisfied by _opening the modal_, not by _committing the write_.
`GroupActionBar`'s **Add** is the reference: its object is the whole group, it opens
a modal that writes, and adding a member is reversible, so it stays in the row.

**A fetch is never `primary`, on any rung, in any state.** So is a toggle that opens
a read-only panel: revealing something to read is not acting.

Where that leaves an export is a **ranking**, not a ban:

1. **An acting verb wins.** On a rung that has one, every export takes
   `priority: 'tier'` — `GroupActionBar`'s _Export members_ sits behind **More**,
   under **Add**. Shipping an export in the row there is a defect, not a local call.
2. **On a rung with no acting verb, the one whole-rung export may hold `primary`**
   and stay in the row. `GroupsListActionBar` keeps `export-list`;
   `RulesListActionBar` keeps `export-rules`. Any _other_ export on those rungs is
   selection- or section-scoped and still goes to the tier.
3. **Otherwise the rung has no `primary`.** That is a real answer, not a gap to
   fill — a row of evenly-weighted `secondary` peers, or `RuleActionBar`'s empty
   row when a rule targets no groups and _Preview impact_ is dropped. Nothing is
   promoted to take the slot.

Rule 2 needs policing, because "this rung has no acting verb" is the easy thing to
claim. **It is an enumeration, written as a comment above the descriptor array**:
every verb the rung offers in any state — every branch of every conditional spread,
plus any page-scoped verb rendered outside the strip — and which question each one
fails. `RulesListActionBar` carries the model table. Four ways the claim goes wrong:
a selection-scoped verb is not a counter-example (it fails Q1); a read-only panel
toggle is not an acting verb (it fails Q2); a verb declared off the strip still
counts (move it onto the strip rather than promoting an export past it); and an
unwired descriptor is not a verb at all. A rung that later grows an acting verb
loses the fallback in the same change that adds it.

The `primary` is **constant** — it does not move with a selection size or a panel's
open state.

## Emphasis is not ordering, and position one is a safety property

`primary` is emphasis. Position is ordering. Promoting a verb changes its fill and
nothing about where it sits.

**Where a strip's set of verbs varies with state, the leading position must hold a
control whose worst outcome is another click.** Ordering by weight once put _Merge_
— which copies members into a survivor and empties the sources — directly under the
pixel that had a moment earlier been _Select all_. On a rung with a selection,
position one is always a selection control: `Deselect all` leads the moment anything
is ticked, `Select all (M)` follows, and both are `pinned`.

## The open panel says so in words

A panel toggle states its own state in its **label** — `Duplicates (3)` →
`Hide duplicates`, `Cross-search (5)` → `Hide cross-search` — and never in colour
alone. A descriptor carries no `aria-pressed`, so a fill would be state no screen
reader could read. Panel toggles take `variant: 'ghost'`: showing a panel is not an
operation on the rung, and a chromeless control says so where a bordered one claims
otherwise.

An open toggle takes `priority: 'pinned'`, set explicitly rather than as a side
effect of `variant`: the control that **closes** a panel can never be the thing
hiding behind **More** while the panel it toggles sits open below.

## The selection register

`register` is the strip's second measured row, for verbs whose object is what the
reader has ticked. It renders on the band's own white surface, at the band's own
`px-2`, one button size down (`xs` against the action row's `sm`) — no border, no
rule, no divider, no wash.

**What separates the two families is the controls, not the surface.** Selection
furniture — `Select all (M)`, `Deselect all`: the things that say how many rows the
filter matched and how to stop ticking them — takes `variant: 'link'`. A verb that
acts on the ticked rows (`Compare (N)`) keeps `secondary`, however small. The
register's old `bg-neutral-50` well carried that separation until 2026-09-10 and is
gone: a wash says _different_ but never _subordinate_, says nothing to a reader who
cannot see it, and its `mx-2 px-2` inset stacked on the band's own — pushing the
row's first glyph 24px from the card edge while every row above it started at 8px.
The band's left edge is one line now, top to bottom. Row height is unchanged: a
`link` keeps the vertical half of its size scale.

**Pass it whenever the rung has a selection at all, not only once something is
ticked.** The row holds its space in both states, so the first tick adds controls to
a row that already exists instead of pushing the list down under the pointer that
ticked it. It overflows independently against its own width, into the action row's
**one** tier behind the **one** More control. Its leading descriptor is the caller's
to keep correct — `ActionBar` pins what it is given and never reorders.

## Refresh is app chrome

There is exactly one refresh, in the top bar beside the Pin, on every rung of every
tab. No strip declares its own, and neither does `PageHeader.actions`. Its subject is
whatever the panel is showing, and its `title` — which is also its accessible name —
**names that subject**: _Refresh the groups list_, _Refresh Payments Team_. Never
_Refresh this group_.

It carries **no visible label, no badge and no count** — the name never appears as
rendered chrome. An initial load belongs in the rung's own empty state, not in a
control whose label swaps between _Load_ and _Refresh_.

## The band

The strip rests as a card the width of the rung and grows past the rung's margins as
it docks, so header and strip end up one continuous pinned surface. **Only the
painted chrome moves** — the merge animates the band's `::before`, never the row, so
no verb shifts and the overflow observer watches a width that never churns. **Never
put a layout property on that timeline**; the row keeps the column's padding whether
the chrome is inside the margins or past them.

**Never pass a `style` prop to the band.** `useActionOverflow` publishes
`--bar-bleed` on the band and `--dock-offset` on the band's **parent** imperatively
through refs; a `style` prop clears them on the next render, and publishing
`--dock-offset` on the band instead silently mistimes the merge.

The tier is a **region**, not a menu — `role="menu"` would forbid the arbitrary UI
`expansion` exists to hold. Its children stay mounted while closed, held out of the
tab order with `inert`, so closing it resets nothing.
