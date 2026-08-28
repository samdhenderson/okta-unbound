# ADR-0047: Elevation on interactive cards, and the premise that was wrong

- Status: Accepted
- Date: 2026-08-28
- Relates to: `docs/design-system.md` (Surfaces & elevation), ADR-0032 (the sticky
  stack), ADR-0038 (a strip that knows what it holds), ADR-0046 (the response layer)

## Context

`docs/design-system.md` has said, since the design system was written down:

> Elevation comes from the border alone — no drop shadow on cards. Hover feedback on
> interactive cards is a border shift, not a shadow. Shadows are reserved for true
> overlays.

with one narrow exception, `--shadow-dock`, for the docked action strip (ADR-0038).

The stated justification for the rule was **"Okta doesn't shadow them."** That premise
is false, and it was checked properly for the first time while implementing a design
handoff that asked for a hover lift.

Read from `okta/odyssey@master` and cross-checked against the published
`@okta/odyssey-design-tokens@1.67.0`:

- `odyssey-design-tokens/src/depth.json` defines `DepthLow`, `DepthMedium`, `DepthHigh`.
- `theme/components/Card.tsx` sets `boxShadow: DepthMedium` **at rest**, deepening to
  `DepthHigh` on `&.isClickable:hover`.
- `theme/components/Paper.tsx` maps MUI `elevation1/2/3` onto the same three.
- `theme/components/Menu.tsx` resolves to `DepthMedium`.

Odyssey shadows its cards, at rest, and deepens them on hover. The panel's rule was not
a considered deviation from Odyssey — it was a mistake about what Odyssey does, and it
has been enforced as a hard rule ever since.

## Decision

Narrow the rule rather than delete it, and fix its justification.

**Static cards keep the border-only treatment.** That part was always defensible on its
own merits: a panel 360px wide, densely stacked with cards, gets noisy fast if every
surface floats. The rule stays for cards you cannot click.

**Interactive cards — a card that is itself a click target — may carry a hover
elevation.** This is now _aligned with_ Odyssey rather than a departure from it, and the
ADR should be read as a correction toward the system we mirror.

Two tokens, taken from Odyssey rather than invented:

```css
--lift-1: 0 1px 2px 0 rgb(39 39 39 / 0.07); /* Odyssey DepthLow */
--lift-2:
  0 1px 4px 0 rgb(39 39 39 / 0.08), 0 4px 6px 0 rgb(39 39 39 / 0.01),
  0 5px 15px 0 rgb(39 39 39 / 0.05); /* Odyssey DepthMedium */
```

`DepthHigh` is deliberately **not** adopted. It is built for a full-page console, and it
is heavier than anything a 360px side panel needs.

### The shadow is cross-faded, never transitioned

`.lift` pre-paints the shadow on an `::after` at `opacity: 0` and animates the opacity:

```css
.lift::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: var(--lift-1);
  opacity: 0;
  transition: opacity var(--dur-instant) var(--ease-standard);
}
.lift:hover::after {
  opacity: 1;
}
```

This is Odyssey's own technique, in `labs/AppTile.tsx`. Animating a `box-shadow`
repaints every frame; animating an `opacity` composites. `border-radius: inherit` keeps
the shadow on the card's real corner without the class needing to know what that corner
is.

### No `translateY`

The design handoff asked for `translateY(-1px)` alongside the shadow. Rejected: it would
collide with `.press`'s `transform` on any surface that is both liftable and pressable,
which is most of them. The elevation change alone carries the affordance — and it is
also all Odyssey's `Card` does.

## Consequences

- `docs/design-system.md`'s elevation section is rewritten: the rule survives, scoped to
  static cards, and its justification is replaced with the real one (density in a narrow
  panel) rather than the false one (Okta doesn't do it).
- Three elevation levels now exist for three genuinely different jobs: `--shadow-dock`
  for a band with rows scrolling under it, `--lift-*` for an interactive card, and the
  modal/overlay shadows for things above the canvas.
- A reviewer can no longer reject a card shadow by citing Odyssey. They can still reject
  one on density grounds, which is the argument that was doing the real work.
- Under reduced motion the cross-fade collapses to 1ms, so the shadow appears instantly
  on hover rather than not at all. That is correct: the elevation is an affordance, not
  an animation.

## Alternatives considered

**Keep the rule as-is and drop the hover lift.** Rejected once the premise turned out to
be false. A rule enforced on a wrong fact should be re-derived, not grandfathered.

**Adopt Odyssey wholesale — `DepthMedium` at rest on every card.** Rejected. Odyssey's
cards live in a full-width admin console with room to breathe; this panel stacks them at
360px. Resting elevation on every card is exactly the noise the original rule was
protecting against, and that concern is real even though its stated reason was not.

**Reuse `--shadow-dock`.** Rejected — it is tuned for a band seen edge-on with content
sliding beneath it (`0 7px 11px -9px`, a heavy negative spread), which reads wrong on a
card seen face-on.
