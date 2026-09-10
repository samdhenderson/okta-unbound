# Motion

The side panel's motion scale — durations, easings, and the animation primitives
built from them — lives once in
[`src/sidepanel/tailwind.css`](../src/sidepanel/tailwind.css), inside a dedicated
`@theme static { … }` block. `static` is required: `--dur-*` sits in no Tailwind
theme namespace and generates no utilities on its own, so it would otherwise be
tree-shaken out of a production build.

Two pieces of choreography have outgrown this file and live in
[motion-recipes.md](./motion-recipes.md): the scroll-driven dock timeline that merges
a pinned `ActionBar` into the `PageHeader`, and the sticky-stack rules around it.

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

**There are no outstanding violations.** Every pre-existing `duration-*` utility has
been retrofitted to the scale, so `src/` contains no raw `ms` literal and no
`cubic-bezier()` outside `tailwind.css`. A raw literal in a diff is a regression, not
legacy debt.

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

**Arrival** is things entering and leaving. **Response** is the other half: what the
interface does the instant you touch something, before any work has finished.

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
`active → PalettePrimaryDarker`); the scale is our addition on top. Keep both: under
reduced motion the transform collapses and the colour step is the only press feedback
left.

Response motion is allowed to be expressive **precisely because the user's own input
caused it** — it cannot surprise them and cannot fire while they are reading.
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

Each is an `--animate-*` shorthand in the `@theme static` block pairing a
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
That is a paint-order fix, not a motion choice — a forwards fill on a rung wrapper
keeps its element a stacking context and traps the sticky bands inside it. The full
account, and how to check a new rung-level animation for the same trap, is in
[motion-recipes.md](./motion-recipes.md#the-sticky-stack).

Two related, non-`animate-*` primitives in `@layer components`:

- **`.disclose`** — the layout-never-jumps pattern (rule 4): a wrapper transitioning
  `grid-template-rows` between `1fr` and `0fr` (`data-open="false"`) over
  `--dur-move`/`--ease-standard`, with `overflow: hidden; min-height: 0` on its single
  child so a `0fr` row can clip to zero height. `CollapsibleSection` is the reference
  consumer — its body stays mounted and `inert` while collapsed rather than
  unmounting, so collapsing never resets state.
- **`.rise-in-stagger`** — a wrapper applying `animate-rise-in` to each direct child.
  A wrapper class rather than a per-row index prop, so the memoised, hand-comparator
  row components stay untouched. `Skeleton`'s repeated placeholder blocks use it.

  Pair it with [`useStaggerReveal`](../src/sidepanel/hooks/useStaggerReveal.ts) on any
  real list: the bare CSS delays only the first eight children, so a tall viewport
  cascades eight rows, pops the rest together, and finishes the below-fold entrances
  off-screen. The hook holds each row until it scrolls into view, then cascades the
  arriving batch.

  **Attach the hook's returned ref callback — it does not take a `RefObject`**, and
  that is load-bearing. Every list renders its stagger container conditionally, so the
  container is absent from the commit on which the consumer mounts; an effect keyed on
  a `RefObject` reads `null` once and never re-runs, because the ref's identity never
  changes. Keying on the _element_ makes its arrival the trigger and its departure one
  too, so a list that swaps to a skeleton and back re-arms.

  **Budget the total, never the row count.** The step is the preferred one when a
  batch can afford it and compressed when it can't, so the whole cascade lands within
  `--dur-travel` whatever the viewport height. A fixed cap ("stagger the first N") is a
  guess about how many rows fit on screen, and it is wrong on every display it was not
  tuned for.

  The hook is safe by construction: it sets `data-stagger-reveal="on"` — the attribute
  the CSS hold keys on — only _after_ its `IntersectionObserver` exists, so a missing
  API, a disabled hook, or reduced motion falls back to the plain on-mount stagger and
  no path leaves a row invisible. That `:nth-child` fallback is also the _correct_
  behaviour for the two hookless consumers, `Skeleton`'s repeats and
  `TabJumpPalette`'s results, both inside the eight-child cap.

A tenth keyframe, `skeleton-sweep` (`.skeleton`, 1.4s linear infinite), drives the
shimmer surface behind loading placeholders — categorically different from the
nine above (a continuous loop, not a one-shot transition), so it isn't counted
among them.

`.dock-band` is the panel's only **progress-driven** animation — it advances with
scroll position rather than a clock, so no duration token applies to it and the
reduced-motion block below cannot reach it. It has its own page,
[motion-recipes.md](./motion-recipes.md).

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

- **`1ms`, not `0s`.** A `0s` transition fires no `transitionend`, which would strand
  `Modal`'s exit mount-hold on its `EXIT_MS` timeout fallback for every
  reduced-motion user instead of releasing on the (never-fired) event.
- **Exempt by marker class (`.motion-exempt`), not a hardcoded selector list** — a
  list goes stale the moment someone adds a spinner; a class travels with the
  element. Three call sites carry it, each encoding **live state**, not decoration:
  `LoadingSpinner`'s spin, and `ActivityBarView`'s busy pulse dot and progress-bar
  `width` transition.
- **`revert` is deliberately not used** inside the `!important` block — it reverts to
  the UA default (`0s`), defeating the exemption for anything relying on it.
- **The block does not reach scroll-driven animations.** Duration is not what
  drives them, so `.dock-band::before` gets its own `animation-name: none`
  override in both blocks — see
  [motion-recipes.md](./motion-recipes.md#four-things-to-know-before-adding-another-one).
- **The block is duplicated verbatim under `[data-motion='off'] *…`**, not combined
  with the media query: CSS cannot `OR` a media feature with an attribute selector in
  one rule, and routing both through a shared `var()` would zero every duration by
  default rather than under one of the two triggers. Storybook sets
  `data-motion="off"` on every story
  ([component-explorer.md](./component-explorer.md)),
  which exercises the second block on every CI run.
- **`scroll-behavior: auto !important` cannot suppress a JS
  `scrollIntoView({ behavior: 'smooth' })` call** — the JS option always wins.
  Components that scroll programmatically (`useTabRail`, `useScrollPreservation`)
  read [`useReducedMotion`](../src/sidepanel/hooks/useReducedMotion.ts) and pass
  `'auto'` themselves. That hook is a `matchMedia` + `change` listener, guarded on
  `matchMedia`'s existence. There is no `matchMedia` stub in
  `src/test/setup.ts`, so jsdom always reports `matches: false` and every existing
  test runs the motion-on path.

## Skeleton vs spinner

`Skeleton` ([`components/shared/Skeleton.tsx`](../src/sidepanel/components/shared/Skeleton.tsx))
is an **added option**, not a replacement for `LoadingSpinner`:

- **Use `Skeleton`** for content whose shape is known before it arrives — a list row,
  a stat tile. Its `row` / `card` / `text` variants preview the layout about to fill
  in, staggered via `.rise-in-stagger`.
- **Keep `LoadingSpinner`** where the shape or duration of the work is unknown:
  `TabPanel`'s per-tab `Suspense` fallback (an unmounted lazy chunk has no shape to
  preview), and **every error path** (an error is not a "content is arriving" state).
  Both are deliberate, not legacy debt to migrate away.

**"Variable-height" is usually a claim about the expanded row, not the loading one.**
The Rules tab spun for a while on the reasoning that a rule card has no fixed height.
It does at the only moment that matters: cards load **collapsed**, and a collapsed row
is a fixed-height header. The variable height arrives when a user expands one, which
cannot happen before the list exists. Check which state the row is in while loading
before reaching for a spinner on this basis.

**Match `size` to the row's own padding**, or the placeholder is the wrong height and
the layout still jumps — the thing the skeleton exists to prevent. `lg` for
`AppListItem` / `RuleCard` / `PolicyCard` / `StatCard`, `md` for `MemberRow`, `sm` for
the compact `GroupListItem`.

**Match the element count, not just the size.** `row` draws four elements — a title, a
two-badge strip, a meta line and a trailing block — so it is the wrong shape for a list
of **single-line** rows however small you set `size`: several times too tall, and the
list lurches upward when the real rows arrive. A skeleton that mispredicts the layout
has spent the spinner's honesty and bought a jump. Single-line lists
(`PolicyRulesList`, `GroupRulesSection`'s `RuleRelationList`) want a single-line
placeholder, never a shrunken `row`.

Both are accessible the same way: one hidden `role="status"` node carries the
announced label, and the visual placeholder(s)/spin glyph are `aria-hidden`.

## Related

- [motion-recipes.md](./motion-recipes.md) — the scroll-driven dock timeline and the
  sticky-stack rules.
- [design-system.md](./design-system.md#motion) — tokens as part of the wider
  design system.
- [surfaces.md](./surfaces.md) — the card, elevation and list-row chrome the motion
  primitives are applied to.
- [ux-guidelines.md](./ux-guidelines.md) — the reduced-motion contract and
  `Modal`'s focus-restore-before-exit rule from a UX/a11y angle.
- [component-explorer.md](./component-explorer.md) — writing stories, which run with
  motion off by default.
