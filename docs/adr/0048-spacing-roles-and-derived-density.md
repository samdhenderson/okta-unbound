# ADR-0048: Spacing roles, and a density nobody chooses

- Status: Accepted
- Date: 2026-08-28
- Relates to: `docs/design-system.md` (Spacing), ADR-0027 (`@theme static` and
  tree-shaking), ADR-0029 (`ListRow`), ADR-0014 (Storybook viewport presets)

## Context

The panel has a colour system, a type scale and — since ADR-0027 — a motion scale. It
has never had a spacing system. The only spacing token is Tailwind's base
`--spacing: .25rem`, and every padding and gap decision is prescribed per-component in
prose: `p-3` here, `px-4 py-2` there.

The result is measurable drift. Counted across `src/sidepanel/components`:

| Recipe                            | Occurrences        |
| --------------------------------- | ------------------ |
| `space-y-3`                       | 74                 |
| `px-3`                            | 65                 |
| `p-3`                             | 61                 |
| `space-y-2`                       | 46                 |
| `p-4`                             | 39                 |
| `px-6 py-6 space-y-6` (tab roots) | 8 identical copies |

Eight tab roots independently arrived at the same three-class recipe, and two more at
near-misses (`space-y-4`, `space-y-3`). Nothing enforces that; they agree by luck and
copy-paste. This is the same failure mode that produced eighteen drifting eyebrow
treatments and forced `Eyebrow` to exist, and the same one ADR-0029 solved for row
chrome with `ListRow`.

Second problem: the panel is **user-resized**, from roughly 320px to whatever the screen
allows. A 360px panel and a 720px panel currently get identical padding. At 360px the
gutters are too generous and cost content; at 720px they are too tight and the layout
looks stranded.

## Decision

### Six semantic roles, not a raw scale

Components consume a **role**, never a raw step:

| Token                       | Role                        |
| --------------------------- | --------------------------- |
| `--sp-gutter`               | Panel horizontal padding    |
| `--sp-rung`                 | Gap between stacked cards   |
| `--sp-card`                 | Inside a `DetailSection`    |
| `--sp-row-y` / `--sp-row-x` | `ListRow` padding           |
| `--sp-inline`               | Between chips, pills, icons |
| `--sp-field`                | Between form controls       |

This is the part that makes it a system rather than a pile of variables. A raw scale
would just be Tailwind's scale renamed, and would drift again the moment two components
disagreed about whether a card gap is `3` or `4`. A role has one right answer per
density, and a reviewer can see a wrong one.

`--sp-gutter` covers the panel's padding on **both** axes. There is deliberately no
separate vertical role: `gutter` and `card` resolve to identical pixel values at every
density, so a fourth structural role would be a distinction with no rendered difference
and one more thing for two components to disagree about. A tab root is
`px-(--sp-gutter) py-(--sp-gutter)`.

Structural roles (`gutter`, `rung`, `card`) snap to a 4px grid. The fine roles keep 2px
granularity: `--sp-row-y: 10px` and `--sp-inline: 6px` are load-bearing half-steps that
Tailwind itself ships (`py-2.5`, `gap-1.5`), and rounding them to 4px collapses
distinctions the row typography depends on. The source handoff claimed a 4px base and
then specified 10, 14 and 18; this is the reconciliation.

### Density is derived, not chosen

Three scopes — `compact` below 400px, `default` from 400 to 559, `comfortable` at 560
and above. Three, not five: each must earn a visibly different layout or it is a
distinction nobody can perceive.

**There is no user setting.** The panel is user-resized, so density follows measured
width. No prop threading, no preference to persist, no migration, nothing to keep in
sync with anything.

**Density changes space only. Type never scales.** A 360px panel and a 720px panel show
the same font sizes; only the space between things moves. A panel that also rescaled
type would be a zoom control, which is the browser's job.

### A media query, not a container query

The design handoff specified a container query on the panel root. Rejected, for a reason
specific to this app: **in a Chrome side panel the panel root _is_ the viewport.** There
is no larger page around it — which is why `useIsNarrow` has always been able to read
`window.innerWidth` and be correct.

A container query would additionally require an ancestor declaring `container-type`, and
an element cannot respond to a container query on itself, so it would force a wrapper
element to exist purely to be queried. Same measurement, extra DOM, no behavioural gain.

It also survives Storybook for free: ADR-0014's `sidepanelCompact` (360),
`sidepanelDefault` (480) and `sidepanelWide` (720) presets resize the story iframe's
viewport, so every story exercises the real breakpoints without a decorator.

### `[data-density]` rides alongside

An explicit attribute scope carries the same three value sets and **wins over the media
query**. It is not a user setting — it is an escape hatch for stories and tests that need
to pin one scope without resizing a viewport, and it wins deliberately so a pinned story
is not silently reinterpreted by the runner's window size.

### `@theme static`, for the ADR-0027 reason

`--sp-*` sits in no Tailwind v4 theme namespace, exactly like `--dur-*`. It is only ever
consumed through arbitrary-value shorthands (`px-(--sp-gutter)`), which do not trigger
namespace-based utility generation, so a plain `@theme` block would tree-shake it out of
production while compiling fine in dev. Verified against a real production build: all
seven roles are present in the emitted CSS.

### The docking band's geometry had to follow

ADR-0038 pins `--merge-range` — the scroll distance over which a sticky `ActionBar`
merges into the header — with an explicit invariant: it **must be shorter than the gap
the strip closes**, or the merge is already part-done before the page has moved and the
strip can never show its resting shape. That gap is the tab column's top padding, and
the ADR's measured value (16px) was calibrated against a fixed `py-6` of 24px.

Converting the tab roots to `py-(--sp-gutter)` makes that gap **12px at compact
density** — smaller than the 16px range. Below 400px the strip would have rested
partially merged at scroll zero: exactly the failure ADR-0038 exists to prevent.

`--merge-range` and `--merge-bleed` therefore move under the density scopes too:

- `--merge-bleed` now _derives_ from `--sp-gutter` rather than restating it as a
  literal. It was documented as "the tab content wrapper's `px-6`", which silently
  stopped being true at every density the moment the wrapper became a role.
- `--merge-range` scales with the gutter at the 2/3 ratio the ADR-0038 measurements were
  taken at (16/24) — 8px / 10px / 13px against gutters of 12 / 16 / 20 — rather than a
  fresh guess. The invariant holds at all three.

This is worth stating plainly because **no test catches it.** jsdom and the headless
story runner load no CSS, ADR-0038 itself notes the sticky mechanism is unverifiable in
jsdom, and ADR-0023 bans the class assertions that might otherwise have flagged the
change. It was found by tracing the geometry by hand. Any future change to a gutter has
to re-check this invariant the same way.

## Consequences

- `ListRow`'s existing `density` prop and this scale must not run in parallel. The prop
  survives as a **content**-density selector — "this list is for dense scanning" is a
  property of the content, not the viewport — while the width scale moves all rows
  together beneath it.
- `docs/design-system.md`'s Spacing section changes from "use the Tailwind scale, avoid
  one-off values" to "consume the role." The old advice was the best available without a
  system; it is not the best available with one.
- A reviewer gains a cheap test: a raw `p-4` on a card is now a defect, the same way a
  raw `150ms` became one after ADR-0027.
- Adding a fourth density is a value column, not a refactor. Adding a seventh role is
  one token and a docs line.

## Alternatives considered

**An explicit density preference in Settings.** Rejected. It is another setting to build,
persist, migrate and explain, and it ignores that the panel's width is already an
explicit statement of how much room the user wants to give it. Dragging the panel wider
_is_ the preference.

**Keep prescribing spacing in prose.** Rejected — that is the status quo that produced
eight identical hand-copied tab roots and 74 `space-y-3`s.

**Five breakpoints.** Rejected. Below 400 and above 560 are perceptibly different
layouts; intermediate steps were not distinguishable when compared side by side, and an
imperceptible token is a token people set wrong.
