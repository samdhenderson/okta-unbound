# Motion

The side panel's motion scale — durations, easings, and the animation primitives
built from them — lives once in
[`src/sidepanel/tailwind.css`](../src/sidepanel/tailwind.css), inside a dedicated
`@theme static { … }` block. `static` is required: `--dur-*` sits in no Tailwind
theme namespace and generates no utilities on its own, so it would otherwise be
tree-shaken out of a production build (see ADR-0019).

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

**Migration status.** The scale itself, the nine primitives below, and the
reduced-motion contract are all in place. Retrofitting every pre-existing
`transition-*`/`duration-100`-style utility across the codebase to the token scale
is a separate, larger cleanup and was not part of this change — treat the rule as
binding on new and touched code, not as a claim that every call site is migrated
yet (unlike the color-token rule, which has no known outstanding violations).

## Durations

| Token           | Value | Use for                                                     |
| --------------- | ----- | ----------------------------------------------------------- |
| `--dur-instant` | 80ms  | colour / opacity / focus rings / border shifts              |
| `--dur-quick`   | 140ms | small transforms — chevrons, pills, modal exit              |
| `--dur-move`    | 220ms | things arriving or leaving — rows, modal enter, popovers    |
| `--dur-travel`  | 320ms | panel-crossing — drawer, view push/pop                      |
| `--dur-tell`    | 500ms | deliberately noticeable — count-up, success flash, progress |

## Easings

| Token             | Curve                            | Use for                                               |
| ----------------- | -------------------------------- | ----------------------------------------------------- |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)`     | the workhorse                                         |
| `--ease-entrance` | `cubic-bezier(0, 0, 0, 1)`       | arriving                                              |
| `--ease-exit`     | `cubic-bezier(0.3, 0, 1, 1)`     | leaving — always one step faster than entrance        |
| `--ease-affirm`   | `cubic-bezier(0.2, 1.3, 0.4, 1)` | **confirmation only** — the one curve that overshoots |

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

Two related, non-`animate-*` primitives in `@layer components`:

- **`.disclose`** — the layout-never-jumps pattern (rule 4): a wrapper that
  transitions `grid-template-rows` between `1fr` and `0fr` (`data-open="false"`)
  over `--dur-move`/`--ease-standard`, with `overflow: hidden; min-height: 0` on
  its single child so a `0fr` row can actually clip to zero height.
  `CollapsibleSection` is the reference consumer — its body stays mounted and
  `inert` while collapsed rather than unmounting, so collapsing never resets
  state.
- **`.rise-in-stagger`** — a wrapper that applies `animate-rise-in` to each direct
  child with a 24ms delay step, capped at the 8th child (children beyond that
  animate together, unstaggered). Applied via a wrapper class rather than a
  per-row index prop so the memoised, hand-comparator row components stay
  untouched. `Skeleton`'s repeated placeholder blocks use it.

A tenth keyframe, `skeleton-sweep` (`.skeleton`, 1.4s linear infinite), drives the
shimmer surface behind loading placeholders — categorically different from the
nine above (a continuous loop, not a one-shot transition), so it isn't counted
among them.

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

Both are accessible the same way: one hidden `role="status"` node carries the
announced label, and the visual placeholder(s)/spin glyph are `aria-hidden`.

## Related

- [design-system.md](./design-system.md#motion) — tokens as part of the wider
  design system.
- [ux-guidelines.md](./ux-guidelines.md) — the reduced-motion contract and
  `Modal`'s focus-restore-before-exit rule from a UX/a11y angle.
- [component-explorer.md](./component-explorer.md#motion-is-off-by-default-in-stories) —
  why Storybook runs motion off by default and how to opt a showcase story back in.
- ADR-0019 — why a finite token scale, `@theme static`, and the reduced-motion
  design.
- ADR-0020 — the icon-rail `Tabs` variant that uses `--dur-move` for its label
  unfurl and sliding indicator.
