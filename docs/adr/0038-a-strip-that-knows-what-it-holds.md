# ADR-0038: A strip that knows what it holds — and a merge that never ran

- Status: Accepted
- Date: 2026-08-20
- Amends: [ADR-0030](./0030-detail-page-layout-contract.md) §2, which says _where_ an
  action lives but never _how many_ fit; [ADR-0032](./0032-the-sticky-stack-and-a-header-that-owns-identity.md)
  §3a, whose merge was correct in description and inoperative in fact
- Relates to: ADR-0018 (every tab stays mounted), ADR-0023 (what we don't test),
  ADR-0027 (motion tokens and reduced motion), ADR-0029 (a shared primitive owns
  chrome, never the interior)

## Context

`ActionBar` took `children`. A strip that cannot see what it holds cannot decide
what fits, so nothing adapted: at 360px the verbs wrapped onto a second line, and
there was no path from "six actions on a wide panel" to "the important ones plus
More" on a narrow one. The four surfaces still owing ADR-0030 adoption — Rules,
Apps, Policies, History — plus bulk-selection convergence each want four to eight
verbs, and `children` gives them nowhere to go.

The disclosure was also disguised as an action. On the user rung the tier's
trigger was a third `ghost` Button labelled **Manage**, sitting inline in the same
wrapped flex row as Compare and Add to Group. It read as a peer verb, "Manage"
names a category rather than an affordance, and nothing marked the boundary
between the actions and the way to reach more of them.

**And the merge described in ADR-0032 §3a has never run.** This is the part worth
reading in a year.

A named view timeline is referenceable by the element that declares it and by that
element's **descendants**. It is not referenceable by that element's following
siblings. `tailwind.css` asserted the opposite in a comment — _"It has to precede
the band — that is the scope a named timeline is visible in"_ — ADR-0032 §3a
repeated it, and the DOM was built to match: a zero-size `.dock-sentinel` floated
immediately before the band, as its sibling. So `--dock-progress` resolved to
`null` on `.dock-band::before`, and a null timeline with `fill: both` holds an
animation on its `to` keyframe permanently.

The strip has therefore been rendering in its fully merged, full-bleed state at
all times, on every detail rung, since the day ADR-0032 landed. It was not failing
to merge; it was failing to _un_-merge. Measured in headless Chromium via
`getAnimations()`: `timeline: null`, `playState: "finished"`, and merge progress
reading 100% at `scrollTop: 0`. That is the root cause of the user-visible report
that started this work — _"it's supposed to be a standard width, not a full-width
container."_ The strip was not a slab by design. It was a permanently docked band.

Two pre-existing bugs surfaced while designing the replacement, both of which the
new resting shape makes worse:

- **Gutter leak.** The band is `inset-inline: 0` inside a `px-6` column, so a strip
  that is pinned but not merged has 24px of transparent gutter each side and page
  rows scroll through them. Under `prefers-reduced-motion` — which clears
  `animation-name` outright — and on any engine without `animation-timeline`, that
  is permanent.
- **`::before` was hit-testable.** At full merge the chrome is an absolutely
  positioned box overhanging both gutters, with no `pointer-events: none`.

## Decision

**The strip takes its actions as data, so it can measure them and decide how many
fit; it rests as a card the width of the rung and grows past the rung's margins as
it docks; and the merge that drives that growth is made to actually run.**

### 1. Actions are descriptors, not children

`ActionBar` takes `actions={ActionDescriptor[]}` — `id`, `label`, optional `icon`,
`variant`, handlers, and a `priority` of `'pinned' | 'flex' | 'tier'`. A
`ResizeObserver` on the band re-splits the row as the panel is dragged.

**A descriptor carries no JSX, and that is the point.** An arbitrary node cannot be
measured from a cached width, nor re-rendered into the tier with different chrome.
Arbitrary UI goes in `expansion`.

Each action is measured **once, in a hidden probe** — never in the real row.
`Button` is `flex: 0 1 auto`, so a button measured inside a width-constrained
wrapping row reports its _shrunk_ width, and a bar that measures there converges on
whatever it already looks like. The probe is off-layout at `max-content`, holds
every bar-eligible action twice (with icon and without) plus the trailing cluster
as one box, and is mounted only for the frame its answer is needed.

The arithmetic is a pure function (`actionBarFit.ts`) and the DOM work is a hook
(`useActionOverflow.ts`), so the ladder and its hysteresis are pinned by a table of
numbers rather than by a `ResizeObserver` stub.

### 2. The ladder is icons first, then overflow — and compact is a one-way door

An icon is the cheapest thing on the row and the least load-bearing: the label
already names the verb, so dropping the glyph costs recognition speed but never
comprehension. Overflowing an action costs the whole affordance. So the strip
spends the cheap currency first.

**Icons drop globally.** A row with some glyphs and some not reads as a rendering
bug, not as a density choice.

**Compact is monotonic, not thrifty.** The obvious rule — go compact only when
dropping the icons actually buys a seat — is not monotonic in width. Measured on
six actions, dragging the panel inward: icons went on → off → off → **on** → off →
**on**. At the widths where the two ladders happen to seat the same number, the
thrifty rule declines to pay and hands the glyphs back on a _narrower_ panel. Every
step is individually defensible and the sequence is nonsense. So the moment the bar
is cramped enough to lose a single action it goes compact and stays compact all the
way down. This costs no seats: compact widths are never wider than natural ones.

**The trailing cluster's width may never depend on how many actions overflowed.**
No "More (3)", no badge. The requirement for seating `k` actions includes that
cluster; if its width were a function of `n - k`, the requirement would be
self-referential and the split would oscillate between two states that each justify
the other. Promotion additionally demands one `gap` of slack beyond what the action
needs, so the deadband has to be crossed twice to oscillate.

### 3. The merge is painted, not laid out

At rest the strip is a card the width of the rung — `inset-inline: 0` of a column
the tab already inset by `px-6`, so it lines up with every `DetailSection` beneath
it. As it docks, the `::before` chrome alone grows to `-1 * var(--bar-bleed)` on
both sides and reaches the panel edges.

Two things follow, and both are the reason for animating a pseudo-element rather
than the band. The overflow observer watches a width that does not churn while the
merge runs; and **no verb moves**, because nothing in flow is on the timeline. The
row keeps the column's padding whether the chrome is inside the margins or past
them, which is also what keeps the verbs aligned with the header's own content once
the two have become one surface.

**More** is pushed to the trailing edge with `ms-auto`, carrying its hairline
separator inside the same wrapper so the rule cannot be left behind by that margin.
The row's `gap-2` still applies on top of the auto margin, so a full row keeps its
breathing room rather than butting the last verb against the rule.

Rejected: animating the row's own width relayouts every button every frame on the
one shared scroller; `clip-path: inset()` clips to the border box at full open and
would delete `--shadow-dock`, which is the entire point of the merged state.

#### The hug, and why it went

The first version of this decision had the strip **hug its actions** at rest — a
pill the width of its buttons, painted with
`inset-inline-end: calc(100% - var(--bar-content-w))`, with `--bar-content-w` a
registered `@property` so an opening tier could ease it out to `100%`, and a
`dock-more` animation translating the More cluster out to the docked edge. All of
it was built and measured working, including the registered-property transition
re-resolving a running scroll-driven animation's implicit `from` mid-merge.

It was reversed on review, and the reason is not a defect in the mechanism. A pill
is a fourth kind of box on a rung that already has a header, cards and rows, and it
reads as a different sort of object from the sections it governs. Its disclosure is
worse: pinned to the pill's trailing edge, **More** floats somewhere mid-column with
nothing beneath it, when the one place a "rest of the actions" control belongs is
the right edge of the thing it acts on. A card gets both for free — the edges line
up with the sections, and the trailing edge is a real edge.

What the reversal deleted: `--bar-content-measured`, `--dock-more-travel`, the
`@property --bar-content-w` registration and its transition, the
`[data-tier-open]` width override, the `dock-more` keyframes, and the `data-bare`
chromeless treatment for a one-action strip — that last one existed only because a
button inside a pill of the same radius reads as concentric, which a full-width
card cannot be. Two published variables survive, because they measure geometry CSS
cannot see: `--bar-bleed` and `--dock-offset`.

### 4. The timeline is hoisted, and two geometry errors are corrected

```css
:has(> .dock-sentinel) {
  timeline-scope: --dock-progress;
}
```

One self-installing rule, no consumer opt-in: `timeline-scope` lifts the name onto
whichever element directly holds the sentinel, which is the band's parent, and the
band is a descendant of that.

**A wrapper is rejected.** It also resolves the timeline, and both forms are worse.
A real wrapper becomes the sticky containing block and traps the strip — already
fixed once, in commit `09a83dd`. A `display: contents` wrapper was measured
collapsing the rung's `space-y-6` step to `0px`, which is the exact regression
`UserActionBar`'s docblock and ADR-0032 §3c already record.

Two consequent corrections, neither visible without instrumentation:

- **`--merge-range` is 16px, not 64px.** It must stay shorter than the gap the
  strip closes — the tab column's `py-6`, 24px — or the merge is already part-done
  before the page has moved. Measured on the real component: 64px started 61%
  merged, 32px still started 25%, 16px rests flat and finishes on the docking
  frame. Note the gap is _not_ the strip's travel; `PageHeader`'s identity collapse
  moves the strip ~96px while the gap closes by 24.
- **The timeline inset subtracts a measured `--dock-offset`.** Were the rung's
  `space-y` step to land on the _band_ and not the floated sentinel, the marker
  would sit a full step above the position it marks and the merge would finish
  early — an earlier structure was measured finishing 28px short.
  `useActionOverflow` publishes `bandTop − sentinelTop` **onto the band's parent**,
  because the element that reads it is the sentinel — the band's sibling, which
  cannot see a property set on the band. With the strip first in its rung and the
  sentinel floating, nothing collects a step and the published value is `0px`
  today; it is a guard against a composition that has not been written yet, not a
  correction currently being applied.

Measured after all three, on the real component in headless Chromium: the strip
rests unmerged with its full radius, begins merging ~7px into the scroll, and is
100% merged on exactly the frame it docks.

### 5. The gutters get an opaque plate, and the chrome stops taking clicks

`.dock-band::after` is an unconditional, `pointer-events: none` plate spanning the
band plus its measured bleed, painted `--color-canvas`. Canvas-on-canvas at rest,
so it is invisible in flow; opaque the moment the strip pins, in **every** motion
mode — animated, reduced-motion, `@supports not`, `data-motion="off"` — with no
observer and nothing to desync. Six lines of stateless CSS is what makes the
reduced-motion fallback (a card that pins and never grows) safe at all.

Rejected: a `useStuck`-driven `data-docked` flip. `useStuck` reads
`getComputedStyle().top` once and re-arms only on `window.resize`, but this band's
`top` is `calc(var(--rail-h) + var(--header-h))` and `--header-h` shrinks when
`PageHeader` collapses its identity region on pin, without any window resize. The
observer would be stale exactly when it matters.

`.dock-band::before` gains `pointer-events: none`. At full merge it was a
hit-testable slab overhanging both gutters.

### 6. The tier is a region, not a menu

It holds two things in order: the actions that overflowed, which `ActionBar` owns
and the caller never sees, and then `expansion` verbatim — arbitrary caller JSX,
with a separator only when both are present. Holding arbitrary UI is a product
requirement, and `role="menu"` would forbid it. This is also why no popover
primitive was built.

**`role="group"` stays; `role="toolbar"` is rejected.** A toolbar is a single tab
stop, which is a discoverability regression on a page whose point is a few
high-value verbs, and it would mean introducing this repo's first roving-focus
primitive as a side effect of a layout change. Additive, and a separate ADR, if it
is ever wanted.

### 7. A resize never silently drops focus, and never opens the tier

The closed tier is held `inert`, so an action that overflows while focused does not
merely move — it stops being focusable and the browser drops focus to `<body>`
without a word. Mid-drag, that is a keyboard user losing their place silently. So
when a split change moves the focused action into a closed tier, focus goes to the
**More** control, which is exactly where the user now needs to be. A resize is not
a request to disclose anything, so the tier is never auto-opened.

## Consequences

- **The four published custom properties are a contract between the hook and the
  stylesheet**, not implementation detail: `--bar-content-measured`,
  `--dock-more-travel` and `--bar-bleed` on the band, `--dock-offset` on the band's
  **parent**. They are written imperatively through refs, so **the component must
  never pass a `style` prop to the band** or React will clear them on its next
  render. Publishing `--dock-offset` on the band instead does not error — it
  silently mistimes the merge, which is why it is written down.
- **`--bar-bleed` is measured rather than assumed.** The side panel is the
  viewport, so the band's distance from its left edge is exactly the gutter to bleed
  across. This also fixes the case where `max-w-7xl` stops the column growing and
  the fixed `--merge-bleed` no longer reaches the panel edge.
- **`expansionId` is gone from the public API.** The shared strip now owns the
  disclosure control and therefore the `aria-controls` target, via `useId()`. Pages
  no longer supply their own trigger; `UserActionBar`'s `MANAGE_BAND_ID` went with
  it. A page that wants a tier passes `expansion` and nothing else.
- **The More control renders only when the tier has content.** An `aria-expanded`
  button pointing at an empty region is an a11y defect. Its label is fixed at
  "More" in both states — `aria-expanded` carries the state, and a label that
  changed with state would violate §2's constant-width constraint.
- **A hidden rung measures zero, and that is routine.** Tabs stay mounted
  (ADR-0018) and the Users tab renders the detail rung `hidden` while searching, so
  the hook never caches a zero, never splits from a zero budget, guesses "everything
  in the bar" before it has measured, and recovers on the `ResizeObserver` itself.
  There is deliberately **no `isActive` / `visible` prop** on the shared primitive:
  a layout that silently stops updating unless a caller threads a flag through it is
  a footgun every future adopter would inherit.
- **The overflow engine has thin real coverage until the four ADR-0030 adoptions
  land.** At 360px on the user rung nothing actually overflows once the icons drop.
  The pure-function table and the synthetic 360px stories are the proof today; the
  Rules, Apps, Policies and History adoptions are the moment it earns its keep.
- **No `ActionBar.test.tsx`.** It is a pure-render component with stories, so
  ADR-0023(5) applies; `actionBarFit` and `useActionOverflow` carry the unit tests.
- **The sticky stack still cannot be verified in jsdom** (ADR-0032). Everything in
  §3–§5 is a manual check in the loaded extension, plus `ActionBar`'s
  `StickyInAScroller` story, which opts into motion because stories default to
  `data-motion="off"`.
- **No `leading` slot, no split-button or icon-only descriptor, no selection
  variant.** `ActionDescriptor` is shaped so a `kind` discriminant can be added
  without breaking a call site; shipping an unused prop is dead API. The descriptor
  model is the extension point for `GroupSelectionBar` convergence when it comes.
