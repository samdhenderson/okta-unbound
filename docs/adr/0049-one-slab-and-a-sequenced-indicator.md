# ADR-0049: One slab, and an indicator that slides before the label moves

- Status: Accepted
- Date: 2026-08-28
- Amends: [ADR-0028](./0028-icon-rail-navigation.md) §"Why the sliding indicator is
  measured, not transitioned", which is now half true; and
  [ADR-0032](./0032-the-sticky-stack-and-a-header-that-owns-identity.md)'s band borders
- Relates to: ADR-0046 (the response layer), ADR-0047 (elevation), ADR-0048 (spacing
  roles), ADR-0038 (the docking band)

## Context

Three white bands stacked before any content appeared: `ContextBar`, the nav rail, and
`PageHeader`, each with a hairline border. That is four horizontal rules in the first
~150px of a ~520px panel. The rail was bordered above _and_ below, so it detached from
both neighbours and read as a strip that had wandered in.

Separately, ADR-0028 made a deliberate and well-argued decision about the rail's active
indicator: **measure it, never transition it.** The reasoning was specific and correct.
The active label unfurls from `0fr` to `1fr` over `--dur-move` at the same moment the
indicator moves, so an indicator with its own CSS transition would be chasing a target
that is itself still moving — it would overshoot or lag rather than tracking the label's
real edge. Measuring per frame of the buttons' own reflow made the slide fall out of real
layout for free.

The cost was that the indicator _teleports_. It lands correctly, but nothing marks the
journey, so the one piece of chrome that answers "where am I?" changes without saying so.

## Decision

### The slab

`ContextBar` and the rail drop their borders. One rule closes the stack instead of four.

The rule sits on `TabNavigation`'s `<nav>` rather than on a wrapper in `App.tsx`. The
`<nav>` is the sticky element; a wrapper's border scrolls away and a pinned rail would
lose its edge entirely. This is a deviation from the design, which drew the slab as one
`<div>` with one `border-bottom` — in this codebase the slab spans three components at
two levels, and only `ContextBar` and the rail are always present, since `PageHeader` is
per-rung and lives inside the tab panels.

The consequence, stated plainly: on a rung that has a `PageHeader`, the single rule lands
between the rail and the header rather than below the header. Nav chrome is separated
from entity description, which is a defensible line to draw — and the header's white
surface still reads against the gray canvas below it without an edge of its own.

### The indicator: sequence, don't overlap

ADR-0028's rationale survives. What changes is that it only applies during part of the
transition, so it is now scoped to that part rather than to the whole thing.

- **Phase 1** (`0 → --dur-move`): both the outgoing and incoming labels carry
  `delay-(--dur-move)`, so layout is frozen. The indicator transitions `left`/`width` on
  `--ease-glide` toward a target that **cannot move**. ADR-0028's objection does not
  apply, because there is nothing to chase.
- **Phase 2** (`--dur-move → 2×`): the transition class is removed, the labels cross
  over, and the indicator is measured per frame exactly as ADR-0028 specified.

`useTabRail` returns a `sliding` flag for this, set in a `useLayoutEffect` declared
_before_ the measuring effect, so the transition class and the new geometry land in the
same pre-paint flush — a transition only starts if the post-change style already carries
`transition-property`.

`--ease-glide` is a second overshoot curve, gentler than `--ease-affirm`'s 1.3. The
underline travels a short distance directly under the pointer, where affirm's overshoot
reads as a wobble rather than a confirmation.

**Reduced motion needs an explicit guard here**, unusually. The blanket freeze zeroes
`transition-duration` but _not_ `transition-delay`, so without dropping the delay a
reduced-motion user would get a label that simply appears 220ms late — motion removed and
latency added. `useTabRail` drops it.

### Odyssey corrections

Active text moves from `--color-primary` to `--color-primary-text`
(`TypographyColorAction`); `--color-primary` is now only the underline fill. Focus becomes
Odyssey's nav recipe — `inset 0 0 0 2px` with `outline: none`, its
`theme.mixins.insetFocusRing` — while `underline` and `segmented` keep the outset ring.
Item radius becomes `rounded-md` (`BorderRadiusMain`) now that the item no longer sits on
a border.

On weight, the design brief contradicted itself: it said `font-bold` while citing
`TypographyWeightBodyBold = 600`. Tailwind's `font-bold` is 700. **The cited Odyssey
value wins** — active is `font-semibold` (600), inactive drops to `font-medium` (500).
Previously every tab was `font-semibold`, so "bold on active" had no contrast to give.

### A real Tooltip

Icon-only tabs need one, and the repo had none — only the native `title=` attribute, with
no styling, no focus support and an uncontrollable delay. `Tooltip` fires on hover **and
focus**, carries `role="tooltip"`, and opens after `--dur-hover-intent` (400ms) so
sweeping across the rail does not strobe.

Two structural decisions that are not obvious:

- **It renders no wrapper element.** The trigger goes through a render prop and the chip
  is portalled to `document.body`. A positioning `<span>` between `role="tablist"` and its
  tabs fails axe's `aria-required-children` — and the rail is a scroll container that
  would clip an inline chip.
- **The chip is two nested elements.** `animate-rise-in` sets `transform` outright, so a
  single element would lose its centring `translateX(-50%)` for the length of the
  entrance and slide in half its own width off-centre.

The rail's `title=` is gone. Its `aria-label` stays — ADR-0028 derives it from
`tab.label` so the visible and accessible names cannot drift, and an icon-only tab needs
it for the `button-name` rule.

## Consequences

- The tooltip and the active label both stay. They answer different questions — "what is
  this?" on demand versus "where am I?" permanently — so keeping both is not redundancy.
  Dropping the label would make the current section knowable only by colour.
- The full transition is now ~440ms rather than ~220ms. That is the price of never
  desyncing, and it applies only to a deliberate nav hop.
- `Tabs.tsx` is 318 lines against the ~300 guidance, 118 of them comments. Splitting the
  rail tab into its own file would mean a new shared component with its own story and
  barrel entry; that was judged worse than 18 lines over.
- Fixing `useTabRail`'s scroll-into-view to guard on the key it last scrolled for closed
  a **pre-existing latent bug**: any caller re-render with a fresh ref object re-scrolled
  a tab that had not moved.

## Alternatives considered

**Transition the indicator and accept the desync** (what the design asked for: 300ms
`cubic-bezier(.4,0,.2,1)` concurrent with the unfurl). Rejected — ADR-0028 already
predicted the failure and it reproduces: the indicator's trailing edge overhangs the
label for ~80ms.

**Leave it measured, as ADR-0028 had it.** Rejected, but only just. It is still the
correct mechanism for the phase where the label is moving; sequencing keeps that and adds
a marked journey to the phase where nothing is.

**Put the closing rule on a wrapper in `App.tsx`**, matching the design's single-`<div>`
slab. Rejected: the wrapper is not the sticky element, so its border scrolls away and a
pinned rail loses its edge.
