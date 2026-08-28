# Motion

The side panel's motion scale — durations, easings, and the animation primitives
built from them — lives once in
[`src/sidepanel/tailwind.css`](../src/sidepanel/tailwind.css), inside a dedicated
`@theme static { … }` block. `static` is required: `--dur-*` sits in no Tailwind
theme namespace and generates no utilities on its own, so it would otherwise be
tree-shaken out of a production build (see ADR-0027).

## Hard rule: no raw `ms` or `cubic-bezier()`

**Never write a literal duration or easing curve outside `tailwind.css`.** This is
the motion sibling of the "no raw hex" color rule
([design-system.md](./design-system.md)): if a duration or curve you need doesn't
exist, add a token — don't inline `150ms` or `cubic-bezier(...)` at the call site.

Consume a token two ways:

- **Primary** — inside a `--animate-*` shorthand, or as plain `var(--dur-move)`
  inside an `@layer components` rule in `tailwind.css` itself.
- **Secondary** — the Tailwind v4 arbitrary-value shorthand
  `duration-(--dur-instant)` (equivalent to `duration-[var(--dur-instant)]`) for a
  one-off utility site, e.g. `transition-colors duration-(--dur-instant)`.

**Migration status.** Complete. The scale, the nine primitives below, and the
reduced-motion contract are all in place, and every pre-existing
`duration-100`/`duration-300` utility has been retrofitted to the scale — `src/`
contains no raw `ms` literal and no `cubic-bezier()` outside `tailwind.css`. Like
the color-token rule, this one has no known outstanding violations, so a raw
literal appearing in a diff is a regression rather than legacy debt.

## Durations

| Token           | Value | Use for                                                      |
| --------------- | ----- | ------------------------------------------------------------ |
| `--dur-press`   | 60ms  | the depress on a pointer-down — below perception, on purpose |
| `--dur-instant` | 80ms  | colour / opacity / focus rings / border shifts               |
| `--dur-quick`   | 140ms | small transforms — chevrons, pills, modal exit               |
| `--dur-move`    | 220ms | things arriving or leaving — rows, modal enter, popovers     |
| `--dur-travel`  | 320ms | panel-crossing — drawer, view push/pop                       |
| `--dur-tell`    | 500ms | deliberately noticeable — count-up, success flash, progress  |

## Easings

| Token             | Curve                             | Use for                                               |
| ----------------- | --------------------------------- | ----------------------------------------------------- |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)`      | the workhorse                                         |
| `--ease-entrance` | `cubic-bezier(0, 0, 0, 1)`        | arriving                                              |
| `--ease-exit`     | `cubic-bezier(0.3, 0, 1, 1)`      | leaving — always one step faster than entrance        |
| `--ease-affirm`   | `cubic-bezier(0.2, 1.3, 0.4, 1)`  | **confirmation only** — the one curve that overshoots |
| `--ease-press`    | `cubic-bezier(0.2, 0, 0.1, 1)`    | the depress — front-loaded, no overshoot              |
| `--ease-glide`    | `cubic-bezier(0.3, 1.12, 0.5, 1)` | the rail indicator's slide — a gentler overshoot      |

## Arrival and response

This document was, for a long time, about **arrival** — things entering and leaving.
That is one half of motion. The other half is **response**: what the interface does the
instant you touch something, before any work has finished. ADR-0046 added it.

| Behaviour           | How                                                 | Where                                        |
| ------------------- | --------------------------------------------------- | -------------------------------------------- |
| Press               | `.press` / `.press-subtle`                          | every clickable surface                      |
| Optimistic commit   | `animate-affirm-flash` via `ListRow`'s `flash` prop | a row that changed on click, not on response |
| Values that changed | `useCountUp` + a `--dur-tell` tint                  | a refreshed count                            |
| Coordinated cascade | `useStaggerReveal`                                  | a list or card stack arriving                |

`.press` scales to `--press-scale` (0.955, or 0.995 via `.press-subtle` on wide targets)
over `--dur-press`/`--ease-press`, and releases over `--dur-quick`/`--ease-affirm`. That
asymmetry is the effect: instant down, eased back up.

Press also carries a **colour** step — an `active:` background one stop darker than
hover. That half is Odyssey's own specification (`hover → PalettePrimaryDark`,
`active → PalettePrimaryDarker`) which this panel had simply never implemented; the scale
is our addition on top. Keeping both matters under reduced motion, where the transform
collapses and the colour step is the only press feedback left.

### The rule that keeps response motion from becoming decoration

Response motion is allowed to be expressive **precisely because it is caused by the
user's own input** — it cannot surprise them and cannot fire while they are reading.
Enthusiasm on the input side, restraint on the ambient side. A change that animates
without the user having done something is not part of this layer and does not get to
borrow its permission.

## Four rules

1. **Motion explains causality, never decorates.** If an animation isn't telling
   the user something happened, it shouldn't exist.
2. **Distance sets duration, not importance.** A small chevron rotation is quick
   regardless of how much you care about it; a panel crossing the whole width of
   the side panel takes longer because it travels further, not because it matters
   more.
3. **Exits are faster than entrances.** `--ease-exit` is one step quicker than
   `--ease-entrance` at the same distance — leaving should feel brisker than
   arriving.
4. **Layout never jumps to make room.** Animate `grid-template-rows: 0fr → 1fr`
   (the `.disclose` pattern below), never toggle `display` to reveal or hide
   content — a `display` toggle can't be transitioned and the layout snaps.

## The nine primitives

Defined as `--animate-*` shorthands in the `@theme static` block, each pairing a
`@keyframes` rule with a duration and an easing token. Apply the Tailwind class
directly — never write the `animation:` property by hand.

| Primitive    | Class                  | Duration / easing                  | Use for                                                                  |
| ------------ | ---------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Rise in      | `animate-rise-in`      | `--dur-move` / `--ease-entrance`   | content arriving in place — filter panels, search results, list sections |
| Collapse out | `animate-collapse-out` | `--dur-quick` / `--ease-exit`      | content leaving in place                                                 |
| Affirm flash | `animate-affirm-flash` | `--dur-tell` / `--ease-standard`   | one-shot success confirmation on a row (background/border fade)          |
| Overlay in   | `animate-overlay-in`   | `--dur-move` / `--ease-entrance`   | `Modal`'s backdrop opening                                               |
| Overlay out  | `animate-overlay-out`  | `--dur-quick` / `--ease-exit`      | `Modal`'s backdrop closing                                               |
| Panel in     | `animate-panel-in`     | `--dur-move` / `--ease-entrance`   | `Modal`'s dialog panel opening                                           |
| Panel out    | `animate-panel-out`    | `--dur-quick` / `--ease-exit`      | `Modal`'s dialog panel closing                                           |
| Push in      | `animate-push-in`      | `--dur-travel` / `--ease-standard` | a pushed view (`useViewStack`) arriving from the right                   |
| Pop in       | `animate-pop-in`       | `--dur-travel` / `--ease-standard` | a popped view arriving from the left                                     |

**Push in and pop in fill `backwards`; everything else in the table fills `both`.**
That is deliberate and it is not a motion choice. These two run on a whole rung
wrapper — an ancestor of every sticky band on the page — and a forwards fill keeps
the animation applying after it finishes, which keeps its element a stacking
context: Chrome reports a settled `animate-push-in` wrapper as
`transform: matrix(1, 0, 0, 1, 0, 0)`, not `none`. That trapped `ActionBar`'s
`z-30` inside the rung, below `PageHeader`'s `z-20` sticky layer, and left a
hairline above the docked strip on the Groups detail rung (ADR-0032 §The sticky
stack). Both keyframe sets end at `opacity: 1; transform: none` — the element's own
resting values — so dropping the forwards half changes nothing you can see and
releases the trap. The `*-out` primitives keep `both`: they end away from their
resting state and need the fill to hold there.

**If you add a rung-level or page-level animation, check it the same way.** Anything
that animates `opacity`, `transform`, `filter` or `backdrop-filter` with a forwards
fill, on an element between a sticky band and the header it merges into, will break
that merge in exactly this way — and it will look like a CSS-border bug, not a
paint-order one, because the merge itself still runs perfectly.

Two related, non-`animate-*` primitives in `@layer components`:

- **`.disclose`** — the layout-never-jumps pattern (rule 4): a wrapper that
  transitions `grid-template-rows` between `1fr` and `0fr` (`data-open="false"`)
  over `--dur-move`/`--ease-standard`, with `overflow: hidden; min-height: 0` on
  its single child so a `0fr` row can actually clip to zero height.
  `CollapsibleSection` is the reference consumer — its body stays mounted and
  `inert` while collapsed rather than unmounting, so collapsing never resets
  state.
- **`.rise-in-stagger`** — a wrapper that applies `animate-rise-in` to each direct
  child. Applied via a wrapper class rather than a per-row index prop so the
  memoised, hand-comparator row components stay untouched. `Skeleton`'s repeated
  placeholder blocks use it.

  Pair it with [`useStaggerReveal`](../src/sidepanel/hooks/useStaggerReveal.ts) on
  any real list. The bare CSS only delays the first eight children and animates
  the rest at once, which means rows below the fold finish their entrance
  off-screen and a tall viewport shows eight rows cascade and the remainder pop
  together. The hook holds each row until it scrolls into view, then cascades the
  arriving batch.

  **Attach the hook's returned ref callback — it does not take a `RefObject`.**

  ```tsx
  const staggerRef = useStaggerReveal();
  return (
    <div ref={staggerRef} className="space-y-3 rise-in-stagger">
      {rows}
    </div>
  );
  ```

  This is load-bearing, not a style preference. Every list here renders its
  stagger container conditionally — behind `rows.length > 0`, or inside a
  `ScrollableList` whose loading and empty branches render no children at all —
  so the container is absent from the commit on which the consumer mounts. An
  effect keyed on a `RefObject` runs once, reads `null`, and returns; the ref's
  identity never changes, so the container arriving three commits later
  re-triggers nothing. Keying on the _element_ makes its arrival the trigger, and
  its departure one too, so a list that swaps to a skeleton and back re-arms on
  the replacement instead of silently degrading for the rest of the session.

  **Budget the total, never the row count.** The cascade's step is
  `min(24ms, 320ms / gaps)` — the preferred step when a batch can afford it,
  compressed when it can't, so the whole cascade lands within `--dur-travel`
  whatever the viewport height. A fixed cap ("stagger the first N") is really a
  guess about how many rows fit on screen, and it is wrong on every display it
  was not tuned for.

  The hook is safe by construction: it marks the container
  `data-stagger-reveal="on"` — the attribute the CSS hold keys on — only _after_
  its `IntersectionObserver` exists, so a missing API, a disabled hook, or reduced
  motion falls back to the plain on-mount stagger. No path leaves a row invisible.

  The `:nth-child` ladder stays as the fallback, and is the _correct_ behaviour
  for the two consumers that use `.rise-in-stagger` with no hook — `Skeleton`'s
  repeats and `TabJumpPalette`'s results — both of which are comfortably inside
  the eight-child cap.

A tenth keyframe, `skeleton-sweep` (`.skeleton`, 1.4s linear infinite), drives the
shimmer surface behind loading placeholders — categorically different from the
nine above (a continuous loop, not a one-shot transition), so it isn't counted
among them.

## The scroll-driven one

`.dock-band` is the panel's only **progress-driven** animation: it advances with
scroll position, not with a clock, so no duration token applies to it. It merges a
pinned `ActionBar` into the `PageHeader` above it — the strip **rests as a card the
width of the rung** and, over the last `--merge-range` **before it parks**, grows
past the column's margins to the panel edges, drops its radius and borders, covers
the header's seam and grows `--shadow-dock` (ADR-0032, corrected by ADR-0038).

The timeline is a `view-timeline` on a zero-size sentinel `ActionBar` renders just
before itself, not `scroll()`: the merge is a function of how close the strip is to
the header, and scroll offset does not carry that.

**None of it ran until ADR-0038, and the way it failed is the thing to learn from.**
A named timeline is referenceable by the declaring element and its _descendants_ —
not by its following siblings, which is what this doc and `tailwind.css` both
claimed. `--dock-progress` resolved to `null` on the band's `::before`, and a null
timeline with `fill: both` holds the animation on its `to` keyframe forever: the
strip rendered permanently merged and full-bleed at `scrollTop: 0`. It was not
failing to merge, it was failing to _un_-merge. Check anything you add here with
`getAnimations()` — a resolved timeline is not the default outcome, and this
failure mode looks like a styling choice rather than a bug.

```css
:has(> .dock-sentinel) {
  /* hoist the name onto the sentinel's parent, so the band can see it */
  timeline-scope: --dock-progress;
}

.dock-sentinel {
  view-timeline: --dock-progress block;
  /* the bands already parked at the top, less the rung margin between sentinel
     and band — so `cover 100%` is exactly the docking line */
  view-timeline-inset: calc(var(--rail-h, 0px) + var(--header-h, 0px) - var(--dock-offset, 0px)) 0px;
}

:has(> .dock-sentinel) > .dock-band::before {
  animation: dock-band linear both;
  animation-timeline: --dock-progress;
  animation-range: cover calc(100% - var(--merge-range)) cover 100%;
}
```

**`--merge-range` is 16px and is bounded by the gap the strip actually closes** —
the tab column's `py-6`, 24px. Not the strip's own travel, which is larger and not
the same thing: `PageHeader` collapses its identity region on the way down, so the
strip moves ~96px while closing a 24px gap over ~24px of scroll. A range longer
than the gap means the merge is part-done before the page has moved — measured on
the real component, 64px started 61% merged and 32px still started 25%. At 16px it
rests flat through the first ~7px of scroll, merges over the next ~17, and reaches
100% on exactly the frame the strip parks. If the rung's spacing changes, this is
the token to re-check.

`--dock-offset` guards the same class of error from the other side: it is
`bandTop − sentinelTop`, subtracted from the timeline inset so the marker cannot
sit above the position it marks. At both current call sites the strip is the first
child of its `space-y-6` rung and the sentinel floats, so **nothing collects a step
and the measured value is `0px`**. It earns its keep the day a page renders
something above the strip inside the rung.

There was briefly a second animation, `dock-more`, translating the **More** cluster
out to the docked edge as the chrome widened. It went with the hug: a card's
disclosure is already at the trailing edge, and moving it during the merge would
break the rule that nothing in flow is on this timeline.

Four things to know before adding another one:

- **`@supports` is not optional**, and gate on the sentinel too. A browser that
  drops the unknown `animation-timeline` runs the keyframes on the _document_
  timeline at `0s` with `fill: both` — permanently stuck at the end state; an
  unresolvable name fails the same way, and a non-sticky strip renders no sentinel.
- **Only a `to` block.** `dock-band`'s implicit `from` is the element's own computed
  value, so the resting card is described once — in `::before` — instead of being
  duplicated in a `from` block that then drifts out of sync with it.
- **Reduced motion needs an explicit rule.** Duration plays no part in a
  progress-based timeline, so `tailwind.css` clears `animation-name` for
  `.dock-band::before` in both blocks instead. Any new one must add itself to both — and must be safe at rest, which for this one means
  the unconditional `::after` bleed plate covering the gutters.
- **Animate a positioned pseudo-element, not the element.** These are not
  compositable properties, so every frame of scroll is style work; on an absolutely
  positioned `::before` it never reflows the real content — which is what lets the
  chrome bleed past the column while the band keeps the constant layout width its
  `ResizeObserver` depends on. Animating the element itself risks a feedback loop:
  the size change alters `scrollHeight`, which alters the progress. Relatedly, the
  scroll root sets `overflow-anchor: none`; see ADR-0032 §3b.

Stories default to `data-motion="off"`, so a scroll-driven animation renders inert
there. A story that showcases one opts back in with `parameters: { motion: 'on' }`.

## Reduced motion

A blanket rule in `@layer components`, with an opt-in exemption:

```css
@media (prefers-reduced-motion: reduce) {
  *:not(.motion-exempt, .motion-exempt *),
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

- **`1ms`, not `0s`.** A `0s` transition fires no `transitionend` event, which
  would strand `Modal`'s exit mount-hold on its `EXIT_MS` timeout fallback for
  every reduced-motion user instead of releasing on the (never-fired) event.
- **Exempt by marker class (`.motion-exempt`), not a hardcoded selector list.** A
  list goes stale the moment someone adds a new spinner; a class travels with the
  element. Exactly three call sites carry it today, each with an inline comment
  explaining why — they all encode **live state**, not decoration:
  - `LoadingSpinner.tsx` — the spin itself is the loading indicator.
  - `ActivityBarView.tsx` — the busy pulse dot.
  - `ActivityBarView.tsx` — the progress bar's `width` transition.
- **`revert` is deliberately not used** inside the `!important` block — it would
  revert to the UA default (`0s`), defeating the exemption for anything relying on
  it.
- **The block does not reach scroll-driven animations.** Duration is not what
  drives them, so `.dock-band::before` gets its own `animation-name: none`
  override in both blocks. See "The scroll-driven one"
  above.
- The identical block is duplicated under `[data-motion='off'] *…` rather than
  combined with the media query, because CSS cannot `OR` a media-feature condition
  with an attribute selector in one rule, and routing both through a shared
  `var()`/`calc()` would zero out every animation's duration by default instead of
  only under one of the two triggers. Storybook's `withMotion` decorator
  (`.storybook/preview.tsx`) sets `data-motion="off"` on every story by default —
  see [component-explorer.md](./component-explorer.md#motion-is-off-by-default-in-stories)
  for why — which is what exercises this second block on every CI run.
- **`scroll-behavior: auto !important` cannot suppress a JS
  `scrollIntoView({ behavior: 'smooth' })` call** — the JS option always wins over
  the CSS property. Components that scroll programmatically (`useTabRail`,
  `useScrollPreservation`) read
  [`useReducedMotion`](../src/sidepanel/hooks/useReducedMotion.ts) and pass
  `'auto'` instead of `'smooth'` themselves. `useReducedMotion` mirrors the shape
  of `useIsNarrow.ts`: a `matchMedia` + `change` listener, guarded on
  `matchMedia`'s existence, empty dependency array. There is no `matchMedia` stub
  in `src/test/setup.ts`, so jsdom always reports `matches: false` and every
  existing test runs the motion-on path unchanged.

## Skeleton vs spinner

`Skeleton` ([`components/shared/Skeleton.tsx`](../src/sidepanel/components/shared/Skeleton.tsx))
is an **added option**, not a replacement for `LoadingSpinner`:

- **Use `Skeleton`** for content whose shape is already known before it
  arrives — a list row, a stat tile. It renders a shimmering placeholder in that
  shape (`row` / `card` / `text` variants), so the loading state previews the
  layout that's about to fill in, staggered in via `.rise-in-stagger`.
- **Keep `LoadingSpinner`** everywhere the shape or duration of the work is
  unknown: `TabPanel.tsx`'s per-tab `Suspense` fallback (an unmounted lazy chunk
  has no shape to preview), and **every error path** (an error state is not a
  "content is arriving" state at all). Spinners are the correct choice in both
  cases — this is a deliberate, explicit rule, not legacy debt to migrate away.

**"Variable-height" is usually a claim about the expanded row, not the loading
one.** The Rules tab spun for a while on the reasoning that a rule card has no
fixed height. It does at the only moment that matters: cards load **collapsed**,
and a collapsed row is a fixed-height header. The variable height arrives when a
user expands one, which cannot happen before the list exists. Before reaching for
a spinner on this basis, check which state the row is actually in while loading.

**Match `size` to the row's own padding**, or the placeholder is the wrong height
and the layout still jumps — the thing the skeleton exists to prevent. `lg` (p-4)
for `AppListItem` / `RuleCard` / `PolicyCard` / `StatCard`, `md` (p-3) for
`MemberRow`, `sm` (p-2) for the compact `GroupListItem`.

**Match the element count, not just the size.** `row` draws four elements — a
title, a two-badge strip, a meta line and a trailing block — so it is the wrong
shape for a list of **single-line** rows however small you set `size`. It is
several times too tall, and the list lurches upward when the real rows arrive; a
skeleton that mispredicts the layout has spent the spinner's honesty and bought a
jump. Single-line lists (`PolicyRulesList`, `GroupRulesSection`'s
`RuleRelationList`) want a single-line placeholder, never a shrunken `row`.

Both are accessible the same way: one hidden `role="status"` node carries the
announced label, and the visual placeholder(s)/spin glyph are `aria-hidden`.

## Related

- [design-system.md](./design-system.md#motion) — tokens as part of the wider
  design system.
- [ux-guidelines.md](./ux-guidelines.md) — the reduced-motion contract and
  `Modal`'s focus-restore-before-exit rule from a UX/a11y angle.
- [component-explorer.md](./component-explorer.md#motion-is-off-by-default-in-stories) —
  why Storybook runs motion off by default and how to opt a showcase story back in.
- ADR-0027 — why a finite token scale, `@theme static`, and the reduced-motion
  design.
- ADR-0028 — the icon-rail `Tabs` variant that uses `--dur-move` for its label
  unfurl and sliding indicator.
