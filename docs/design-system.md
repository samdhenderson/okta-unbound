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
| `accent`  | `#9333ea` | `-dark` — distinguishes the "user page" context (`ContextBanner`) |

Neutral scale: `neutral-50, 100, 200, 300, 400, 500, 600, 700, 900`
(note: no `800`). Use for text (`neutral-900` headings, `neutral-700` body,
`neutral-400` disabled), borders (`neutral-200`), and surfaces (`neutral-50`).

**Status vocabulary is `danger`, not `error`** (ADR-0002). The status union is
`'success' | 'warning' | 'danger' | 'info'`.

### Chart / dataviz palettes

Sequential ramps for data visualization (e.g. `AttributeFacet`) are the one place
a multi-stop palette is legitimate. Define them as a named exported constant in a
single `chartPalette` module referencing tokens where possible — not inline hex in
a component. Document any genuinely chart-only colors here.

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

## Known violations to fix

See [audit §1](./audit/2026-07-audit.md): `SchedulerStatusBar.tsx`,
`ContextBanner.tsx`, `AttributeFacet.tsx`.
