# Design system

The "Odyssey" design system. Tokens are defined once in
[`src/sidepanel/tailwind.css`](../src/sidepanel/tailwind.css) `@theme` block and
consumed as Tailwind utilities (`bg-primary`, `text-neutral-700`) or CSS vars
(`var(--color-success-text)`).

## Hard rule: no raw hex

**Never write a hex color outside `tailwind.css`.** Every color maps to a token.
The lint/review gate greps for `#[0-9a-fA-F]{3,6}` in `src/sidepanel/components/**`
— the only allowed match is inside `tailwind.css`. If you need a color that
doesn't exist, add a token; don't inline a literal.

## Color tokens

Semantic (each has base + variants where defined):

| Token     | Base      | Variants                                                       |
| --------- | --------- | -------------------------------------------------------------- |
| `primary` | `#546be7` | `-text`, `-dark`, `-light`, `-highlight`                       |
| `danger`  | `#e72500` | `-text`, `-light`                                              |
| `success` | `#16884a` | `-text`, `-light`                                              |
| `warning` | `#a16c03` | `-text`, `-light`                                              |
| `info`    | `#546be7` | `-light`                                                       |
| `accent`  | `#9333ea` | `-dark` — distinguishes the "user page" context (`ContextBar`) |

Neutral scale: `neutral-50, 100, 200, 300, 400, 500, 600, 700, 900`
(note: no `800`). Use for text (`neutral-900` headings, `neutral-700` body,
`neutral-400` disabled), borders (`neutral-200`), and surfaces (`neutral-50`).

## Surfaces

The canvas/card model, card elevation and `.lift`, the docking band's resting shape,
and `ListRow`'s chrome and interior contract live in [surfaces.md](./surfaces.md).

Two colour/type rules that live here rather than there:

- Field labels (label-above-value) are `text-xs font-medium text-neutral-600`; uppercase
  section eyebrows go through the shared `Eyebrow` primitive — see Typography below.
- **Status vocabulary is `danger`, not `error`.** The status union is
  `'success' | 'warning' | 'danger' | 'info'`.

## Chart / dataviz palettes

Sequential ramps for data visualization (e.g. `AttributeFacet`) are the one place
a multi-stop palette is legitimate. They live as named exported constants in
[`src/sidepanel/theme/chartPalette.ts`](../src/sidepanel/theme/chartPalette.ts)
(outside `components/**`, so the hex gate does not apply) — never inline hex in a
component. Stops reference Odyssey tokens via CSS vars where an equivalent exists;
the genuinely chart-only tints (`INDIGO_RAMP`) are documented in that module.

## Typography

- `--font-primary` / `--font-heading`: Inter (UI + headings)
- `--font-mono`: Roboto Mono (IDs, tokens, code)

Type scale via Tailwind: `text-xs` (chips/meta), `text-sm` (body), `text-base`
(emphasis), `text-lg` (modal/section titles). Weights: `font-medium` (secondary),
`font-semibold` (primary/headings).

**There is exactly one eyebrow recipe: `text-xs font-semibold uppercase tracking-wide
text-neutral-600`**, and it lives in the shared `Eyebrow` component
(`components/shared/Eyebrow.tsx`) — never hand-roll it. It had drifted into four
recipes across ~18 files (`tracking-wider`, the off-scale `text-[10px]`/`text-[11px]`,
and `text-neutral-500`/`600`/`700`); `tracking-wide` is the survivor, and the
primitive is what keeps it settled. `Eyebrow` has no colour, size or tracking
prop by design; a section that wants a different treatment is the drift it exists to
stop.

## Spacing

**Consume a role, never a raw step.** Six semantic roles resolve against the
panel's measured width, so the same class gets tighter at 360px and roomier at 720px
without a prop, a setting, or a second code path:

| Token                       | Role                        | Consume as            |
| --------------------------- | --------------------------- | --------------------- |
| `--sp-gutter`               | Panel horizontal padding    | `px-(--sp-gutter)`    |
| `--sp-rung`                 | Gap between stacked cards   | `space-y-(--sp-rung)` |
| `--sp-card`                 | Inside a `DetailSection`    | `p-(--sp-card)`       |
| `--sp-row-y` / `--sp-row-x` | `ListRow` padding           | `py-(--sp-row-y)`     |
| `--sp-inline`               | Between chips, pills, icons | `gap-(--sp-inline)`   |
| `--sp-field`                | Between form controls       | `gap-(--sp-field)`    |

`--sp-gutter` covers both axes — a tab root is `px-(--sp-gutter) py-(--sp-gutter)`.
There is no separate vertical role; `gutter` and `card` resolve to the same value at
every density, so a fourth would render identically and only invite disagreement.

Three density scopes — `compact` below 400px, `default` 400–559, `comfortable` at 560+.
**Density is derived from panel width, never chosen**, and it changes space only: type
never scales. `--sp-rung` is the one role that does not widen at `comfortable`: it holds
at 16px across `default` and `comfortable`, because a 24px gap between stacked cards read
as drift rather than as breathing room. `[data-density='…']` pins a scope for a story or a test and wins over the
width query.

A raw `p-4` on a card is a defect the same way a raw duration literal is. Radius is
still `rounded-md`. Component sizing goes through the size props, not ad-hoc padding:
`sm|md|lg` for most primitives, with `Icon` (`xs`…`xl`) and `LoadingSpinner`
(`sm`…`2xl`) carrying extra steps and sharing size names with each other — see
`docs/components.md`.

This replaces the old advice ("use the Tailwind scale, avoid one-off values"), which was
the best available before a system existed. It is not the best available now: eight tab
roots had independently hand-copied `px-6 py-6 space-y-6`, and `space-y-3` appeared 74
times, because prose cannot enforce agreement.

## Token violations

No known token violations. Every color in `components/**` maps to an Odyssey token;
the `ActivityBar` and `AttributeFacet` (palette in `theme/chartPalette.ts`) are
token-based, and `ContextBar` carries no raw hex.

## Motion

Durations and easings live in their own `@theme static` block in the same
`tailwind.css` file, under the identical hard rule: never write a raw `ms` or
`cubic-bezier()` outside it. Full token table, the nine animation primitives, the
reduced-motion contract, and the skeleton-vs-spinner rule are in
[motion.md](./motion.md); the scroll-driven and sticky-stack choreography is in
[motion-recipes.md](./motion-recipes.md). This section is just the pointer.

One cross-cutting gotcha worth flagging here rather than only in the motion doc:
`Modal.tsx`'s `EXIT_MS`, `useCountUp`'s `COUNT_UP_MS` and `PageHeader.tsx`'s
`SWAP_MS` are hand-kept mirrors of `--dur-quick`, `--dur-tell` and `--dur-move`
respectively, not runtime reads of the CSS custom property —
`getComputedStyle().getPropertyValue('--dur-*')` returns `''` in jsdom, so the
duration cannot be sourced from CSS at the point these components need it in every
environment this code runs in. If any of those tokens in `tailwind.css` moves, its
hand-kept mirror must move with it; there is no lint gate for this today.
