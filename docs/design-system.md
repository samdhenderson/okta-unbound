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

| Token     | Base      | Variants                                                          |
| --------- | --------- | ----------------------------------------------------------------- |
| `primary` | `#546be7` | `-text`, `-dark`, `-light`, `-highlight`                          |
| `danger`  | `#e72500` | `-text`, `-light`                                                 |
| `success` | `#16884a` | `-text`, `-light`                                                 |
| `warning` | `#a16c03` | `-text`, `-light`                                                 |
| `info`    | `#546be7` | `-light`                                                          |
| `accent`  | `#9333ea` | `-dark` — distinguishes the "user page" context (`ContextBar`) |

Neutral scale: `neutral-50, 100, 200, 300, 400, 500, 600, 700, 900`
(note: no `800`). Use for text (`neutral-900` headings, `neutral-700` body,
`neutral-400` disabled), borders (`neutral-200`), and surfaces (`neutral-50`).

## Surfaces & elevation

Native-Okta model: a **gray canvas** with **white cards** floating on it.

- `canvas` (`#f4f4f4`) — the page backdrop; applied once on the app shell (`App.tsx`).
  Never put content directly on it without a card.
- Content cards / panels: `bg-white` + a **1px `border-neutral-200` border**. Elevation
  comes from the border alone — **no drop shadow on cards** (Okta doesn't shadow them).
  Hover feedback on interactive cards is a border shift (`hover:border-neutral-300`),
  not a shadow.
- Shadows are reserved for **true overlays** that lift above the canvas — the `Modal`
  and dropdowns/popovers. The fixed `ActivityBar` sits on a top border, not a shadow.
- Field labels (label-above-value) are `text-xs font-medium text-neutral-600`; uppercase
  section eyebrows are `text-xs font-semibold uppercase tracking-wide`.

**Status vocabulary is `danger`, not `error`** (ADR-0002). The status union is
`'success' | 'warning' | 'danger' | 'info'`.

### Chart / dataviz palettes

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

## Spacing

Use the Tailwind scale. Dominant, preferred values: padding `p-3`/`px-4 py-2`,
gaps `gap-2`/`gap-3`, radius `rounded-md`. Avoid one-off values (`px-2.5`,
`py-0.5`, `px-5`) — snap to the scale. Component sizing goes through the `sm|md|lg`
size props, not ad-hoc padding.

## Token violations

No known token violations. Every color in `components/**` maps to an Odyssey token;
the `ActivityBar` (ADR-0008) and `AttributeFacet` (palette in
`theme/chartPalette.ts`) are token-based, and `ContextBar` carries no raw hex.
