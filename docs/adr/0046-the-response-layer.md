# ADR-0046: The response layer

- Status: Accepted
- Date: 2026-08-28
- Relates to: `docs/motion.md`, `docs/design-system.md`, ADR-0027 (motion tokens and
  reduced motion), ADR-0029 (`ListRow`), ADR-0047 (interactive elevation)

## Context

ADR-0027 gave the panel a finite motion scale and it has held up well. But it covers
exactly one half of motion: **arrival** — things entering and leaving the screen. Five
durations and four easings, all describing how something gets from absent to present.

It says nothing about **response**: what the interface does the instant you touch
something, before any work has finished. The gap is not theoretical. Audited against the
shipping code:

- `Button` has hover treatments for all five variants and **no `:active` state at all**.
- `IconButton` likewise — `transition-colors` on hover, nothing on press.
- `FilterPill` has neither a duration token nor **any** focus style, and falls back to
  Tailwind's default 150ms because it writes bare `transition-colors`.
- `--dur-tell` (500ms) exists and is described as "deliberately noticeable", and only
  `useCountUp` and one progress bar use it.
- `--animate-affirm-flash` is fully defined, with keyframes, and has exactly one
  consumer.

The user's report was that state changes "just pop." That is precisely what an interface
with arrival motion and no response motion feels like: things appear beautifully and
then nothing acknowledges you.

Checked against Odyssey, because this panel deliberately mirrors it: Odyssey's press
state is a third, darker background step beyond hover (`hover → PalettePrimaryDark`,
`active → PalettePrimaryDarker`). It is not that Odyssey decided against press feedback —
we simply never implemented the step it specifies. Odyssey uses no `transform` for hover
or press anywhere in `odyssey-react-mui`.

## Decision

Two new tokens carry the whole layer.

```css
--dur-press: 60ms;
--ease-press: cubic-bezier(0.2, 0, 0.1, 1);
```

`--dur-press` sits **below** `--dur-instant` (80ms) deliberately. A press state must
resolve inside the click, not after it; 80ms already reads as lag on a pointer-down.
This is the only place in the scale where a value is chosen to be imperceptible rather
than perceptible.

`--ease-press` is front-loaded with no overshoot. The depress is immediate; the
_release_ rides `--ease-affirm`. That asymmetry is the effect — instant down, eased back
up — and it is why `.press` re-declares `transition-duration` inside `:active` rather
than adding a separate property.

Two component classes in `tailwind.css` carry it to call sites:

- `.press` — `scale(var(--press-scale))` on `:active`, defaulting to `0.955`, skipping
  `:disabled` and `[aria-disabled='true']`.
- `.press-subtle` — overrides `--press-scale` to `0.995`. A row is a much wider target
  than a button, so the same ratio reads as a lurch; the subtle value travels roughly
  the same number of pixels at the edge.

**The scale is layered on top of Odyssey's colour step, not instead of it.** Components
gain both: the darker `active:` background Odyssey specifies and never got implemented
here, and the scale, which is this panel's own addition.

Four behaviours consume the layer: press on every clickable surface; optimistic commit
via the existing `animate-affirm-flash`; a `--dur-tell` tint on values that changed; and
the coordinated cascade already implemented in `useStaggerReveal`.

### The rule that keeps this from becoming decoration

Response motion is allowed to be expressive **precisely because it is caused by the
user's own input**. It cannot surprise them and it cannot fire while they are reading.
Enthusiasm on the input side, restraint on the ambient side. A change that animates
without the user having done something is not part of this layer and does not get to
borrow its permission.

## Consequences

- Retrofitting four files — `Button`, `IconButton`, `FilterPill`, `ListRow` — buys most
  of the perceived responsiveness in the app.
- `FilterPill`'s missing focus style was found by this audit rather than by a11y
  tooling, because it is a focus _style_ gap, not a focus _order_ gap; axe passes a
  focusable element with an invisible focus state.
- No new `.motion-exempt` sites. The blanket reduced-motion freeze already collapses
  every new transition to 1ms, and a press that resolves instantly is correct behaviour
  rather than a broken one — unlike a spinner, which encodes live state and must keep
  moving.
- The scale now has two "below perception" values (`--dur-press`) and one "deliberately
  noticeable" value (`--dur-tell`) at the extremes, which makes the middle three easier
  to choose between rather than harder.

## Alternatives considered

**Use `--dur-instant` (80ms) for press.** Rejected after comparing them: 80ms is
measurably late on a pointer-down, which is the one interaction where lateness reads as
the app being slow rather than the animation being slow.

**Reuse `--ease-standard` for the depress.** Rejected — it is not front-loaded, so the
first frames of the press are the slowest, which is backwards for an acknowledgement.

**Ship the scale without Odyssey's colour step.** Rejected. The scale alone would skip a
state Odyssey actually specifies and we simply never built, and a transform-only press
disappears entirely under reduced motion, leaving those users with no press feedback at
all. The colour step survives the freeze.
