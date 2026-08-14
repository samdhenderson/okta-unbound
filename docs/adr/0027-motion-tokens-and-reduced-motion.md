# ADR-0027: Motion tokens and reduced motion

- Status: Accepted
- Date: 2026-08-04
- Relates to: `docs/motion.md`, `docs/design-system.md`, ADR-0008 (activity bar:
  values animate, layout doesn't), ADR-0016 (pushed views), ADR-0018 (tabs stay
  mounted)

## Context

Motion in the side panel had drifted into two problems at once.

First, durations were ad-hoc literals scattered across components — `100`, `150`,
`300`, `500` written directly as Tailwind `duration-*` classes or raw `ms` values,
with no shared vocabulary for what a given number meant or when to reach for it.

Second, and more urgent: six surfaces (`GroupFilterPanel`, `MemberFilterPanel`,
`UserSearchResults`, and others) used `tailwindcss-animate` classes —
`animate-in`, `zoom-in-95`, `slide-in-from-*` — that look like real Tailwind
utilities but resolve to nothing, because `tailwindcss-animate` **is not a
dependency of this project**. Those surfaces intended an entrance animation and
silently rendered static content instead. This was found only by grepping for the
classes and checking `package.json`, not by looking at the UI, which is exactly
the kind of gap a token scale with real primitives closes for good.

There was also no reduced-motion story at all: nothing in the codebase read
`prefers-reduced-motion`, so a user with that OS setting got full animation
regardless.

## Decision

**A finite motion scale**, defined once in `src/sidepanel/tailwind.css` and
consumed everywhere else — five durations (`--dur-instant` through `--dur-tell`)
and four easings (`--ease-standard`, `--ease-entrance`, `--ease-exit`,
`--ease-affirm`), plus nine `--animate-*` primitives built from them. Full detail
in `docs/motion.md`. **Never write a raw `ms` or `cubic-bezier()` outside
`tailwind.css`** — the greppable sibling of the existing no-raw-hex color rule.

### Why `@theme static`

Tailwind v4's `@theme` block normally tree-shakes: a custom property that no
utility class ends up referencing in the scanned content is dropped from the
build. `--dur-*` sits in no Tailwind theme namespace (there is no `--duration-*`
namespace in v4, verified against the pinned `tailwindcss@4.1.18` — durations are
consumed either inside an `--animate-*` shorthand or via the
`duration-(--dur-instant)` arbitrary-value shorthand, neither of which triggers
the namespace-based utility generation that keeps a token alive). Left in a plain
`@theme { }` block, the tokens would be silently discarded from a production
build despite compiling cleanly in dev. `@theme static` forces the block to
always emit, so the custom properties exist for `@layer components` rules and the
arbitrary-value shorthand to consume regardless of what the content scanner sees.
This was verified with the project's own build pipeline
(`npx @tailwindcss/cli -i src/sidepanel/tailwind.css -o … --content 'src/**/*.tsx'`),
grepping the output for `--dur-move`, `--ease-standard`, `.ease-standard`,
`@keyframes rise-in`, and `.animate-rise-in` — all present. The fallback
considered — a plain `:root { }` block below the `@import` — was unnecessary:
`@theme static` was accepted by the pinned Tailwind version on the first try.

### Why `1ms`, not `0s`, for the reduced-motion override

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

A `0s` transition fires **no `transitionend` event** — the browser considers a
zero-duration transition to have never started. `Modal`'s exit is a JS
mount-hold: the panel stays in the DOM until its own `animationend`/`transitionend`
fires, or an `EXIT_MS` timeout fallback releases it. Under a `0s` override, every
reduced-motion user would hit the timeout path on every modal close instead of the
event path — not a correctness bug (the fallback exists precisely for this kind of
case), but an unnecessary one, and a needless few hundred milliseconds of extra
"closing" state on every dismissal for a real, currently-supported user segment.
`1ms` fires the event immediately while remaining imperceptible.

### Why an opt-in exemption marker, not a hardcoded selector list

The reduced-motion rule is a blanket `*` override, which is correct for
decorative motion but wrong for the small set of animations that **encode live
state** rather than decorate an entrance or exit — a loading spinner's spin, a
busy-indicator's pulse, a progress bar's width. Freezing those under reduced
motion doesn't reduce motion the user finds distracting; it removes information
(is this still running?). The alternative — a hardcoded selector list
(`.spinner, .busy-dot, .progress-fill { }`) inside the media query — goes stale
the moment a new spinner is added anywhere in the app, silently re-freezing live
state with no test to catch it. An opt-in `.motion-exempt` marker class instead
travels with the element: the three current call sites (`LoadingSpinner`, the
`ActivityBarView` busy dot, the `ActivityBarView` progress width) each carry the
class and an inline comment explaining why, and a fourth in the future is a
one-line addition rather than a rule to remember to update elsewhere.
`revert` was considered and rejected for the exemption mechanism — it resolves to
the UA default (`0s`), not to "un-overridden", so it would have reintroduced the
`0s`/`transitionend` problem above for every exempted element.

### Why the media query and the Storybook attribute hook are separate, duplicated blocks

`tailwind.css` carries the reduced-motion override twice — once as
`@media (prefers-reduced-motion: reduce) { … }`, once as `[data-motion='off'] … { }`
with an otherwise-identical body. CSS has no way to `OR` a media-feature condition
with an attribute selector in a single rule, so one of the two mechanisms had to
be a real duplicate rather than a shared selector. Routing both through one
`var()`/`calc()`-driven duration instead was considered and rejected: it would
zero out every animation's duration **by default**, correct only until the first
consumer needed a duration that participates in some other calculation, at which
point the indirection becomes its own footgun. Two adjacent, clearly-commented
blocks cost nothing at runtime and stay legible.

The `[data-motion='off']` half exists for Storybook: `.storybook/preview.tsx`'s
`withMotion` decorator stamps the attribute onto every story root, **defaulting
to off**, with a showcase story opting back in via `parameters: { motion: 'on' }`.
This keeps the ~550-story browser suite deterministic — it already carries
`retry: 2` for an unrelated Vite dep-optimizer race, so a second timing-shaped
flake source (an interaction assertion racing a 220ms transition) was unwelcome —
and it forces the reduced-motion CSS path itself to be exercised by every story on
every CI run, which the OS-level media query alone never would be in headless
Chromium. `.storybook/scripts/shoot-stories.mjs` additionally passes
`reducedMotion: 'reduce'` to `browser.newPage(...)`, a second belt so contact
sheets never catch an entrance animation mid-flight.

### `useReducedMotion`

`src/sidepanel/hooks/useReducedMotion.ts` exists because the CSS override cannot
reach everything: `scroll-behavior: auto !important` does not suppress a JS
`scrollIntoView({ behavior: 'smooth' })` call — the imperative option always wins
over the CSS property. Components that scroll programmatically read this hook and
choose `'auto'` over `'smooth'` themselves. It is shaped on the existing
`useIsNarrow.ts`: `matchMedia` plus a `change` listener, guarded on `matchMedia`'s
existence (present in jsdom, happy-dom, and real Chromium alike), empty dependency
array, no legacy `addListener` fallback (Chrome-only extension). There is no
`matchMedia` stub in `src/test/setup.ts`, and jsdom's default is
`matches: false`, so every pre-existing test runs the motion-on path unchanged
without modification.

## Consequences

- The six `tailwindcss-animate`-dependent surfaces now animate for real, via
  `animate-rise-in`.
- A reduced-motion user gets a genuinely quieter panel — decorative motion is
  frozen at 1ms — while still seeing that a spinner is spinning, a background
  operation is busy, and a progress bar is moving.
- `Modal`'s `EXIT_MS` constant (140ms, in `Modal.tsx`) is a hand-kept mirror of
  `--dur-quick`, not a read of the CSS custom property — `getComputedStyle` on a
  custom property returns `''` in jsdom, so the duration cannot be sourced from
  CSS at runtime in every environment this code runs in. `useCountUp`'s
  `COUNT_UP_MS` mirrors `--dur-tell` the same way. Whoever changes `--dur-quick`
  or `--dur-tell` must update both call sites by hand; there is no lint gate for
  this today.
- The full nine-primitive catalog, the reduced-motion contract in detail, and the
  skeleton-vs-spinner rule live in `docs/motion.md`, not duplicated here.
- Every pre-existing raw `duration-100`/`duration-300` utility across the codebase
  was retrofitted to the scale as part of this change (46 occurrences in 34
  files). `src/` now contains no raw `ms` literal and no `cubic-bezier()` outside
  `tailwind.css`, so — as with the color-token rule — a raw literal in a diff is a
  regression rather than legacy debt. This was deliberate: a hard rule documented
  with a standing exemption is one people learn to ignore.
