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
`py-0.5`, `px-5`) — snap to the scale. Component sizing goes through the size
props, not ad-hoc padding. The scale is `sm|md|lg` for most primitives; `Icon`
(`xs`…`xl`) and `LoadingSpinner` (`sm`…`2xl`) carry extra steps and share size names
with each other — see `docs/components.md`.

## List rows

A row is the most repeated element in the panel, so its chrome lives in one
component and its interior follows one contract (ADR-0029).

**The chrome is `ListRow`** (`components/shared/ListRow.tsx`). Never hand-roll a
row container — the radius, resting border, hover border and transition are fixed
there on purpose, and a row wanting a different hover colour is the drift the
component exists to stop.

| Prop      | Values                                                                     |
| --------- | -------------------------------------------------------------------------- |
| `variant` | `card` (bordered) · `nested` (inside a card — no border, hover background) |
| `density` | `tight` (`px-2 py-1.5`) · `compact` (`px-3 py-2`) · `comfortable` (`p-4`)  |
| `state`   | `default` · `selected` · `highlighted`                                     |
| `as`      | `div` · `li` · `a` · `button`                                              |
| `body`    | expandable region below the header                                         |

**`card` versus `nested`.** A `card` row carries the border that separates it from
its neighbours. A `nested` row sits inside something already bordered — an
overview preview list — so it draws no border (a box inside a box is noise) and
separates on hover background instead. It usually wants `tight`, because the
containing card already pays for one level of padding.

**Expandable rows use the `body` slot**, not a hand-built wrapper. The border
belongs to the card, the padding belongs to the header, and a `.disclose` body
sets its own — so passing `body` moves the density padding onto an inner header
wrapper and clips the card, and the row still owns exactly one border.

**Hover applies to `default` rows only.** A selected row already says so with its
border (or, nested, its fill); repainting that on hover would make it look less
selected the moment you point at it.

**The interior is a contract, not a component** — `ListRow` deliberately does not
own it, because interiors genuinely differ. Follow these:

| Line              | Classes                                      |
| ----------------- | -------------------------------------------- |
| Primary           | `text-sm font-semibold text-neutral-900`     |
| Secondary         | `text-xs text-neutral-600`                   |
| Identifier / meta | `font-mono text-xs text-neutral-500`         |
| Badge / pill      | `px-2 py-0.5 rounded-md text-xs font-medium` |

No arbitrary type values in a row (`text-[11px]`, `text-[10px]`) and no unsized
primary line — an unsized `font-semibold` renders at 16px next to a peer's 14px,
which is how two rows ended up a size apart.

**Two separator patterns, not four.** `space-y-3` with a bordered `ListRow` is the
default. `divide-y divide-neutral-100` inside one bordered container is for a
dense, table-like surface (`ComparisonDiffTab`, `RuleImpactModal`,
`UserProfileCard`, `SearchDropdown`). `divide-neutral-200` and
`border-b last:border-b-0` are not sanctioned.

**A `divide-y` row is not a `ListRow`.** In that idiom the separator belongs to
the container, and the row is a plain padded element (`px-3 py-2`) with no chrome
of its own. `ListRow` has no border-less escape hatch on purpose — one would hand
every consumer a way out of the chrome it exists to enforce. `nested` is not that
hatch either: it still owns radius, padding, hover and state, and it is for rows
inside a card rather than rows in a divided list.

## Token violations

No known token violations. Every color in `components/**` maps to an Odyssey token;
the `ActivityBar` (ADR-0008) and `AttributeFacet` (palette in
`theme/chartPalette.ts`) are token-based, and `ContextBar` carries no raw hex.

## Motion

Durations and easings live in their own `@theme static` block in the same
`tailwind.css` file, under the identical hard rule: never write a raw `ms` or
`cubic-bezier()` outside it. Full token table, the nine animation primitives, the
reduced-motion contract, and the skeleton-vs-spinner rule are in
[motion.md](./motion.md) (ADR-0027, ADR-0028) — this section is just the pointer.

One cross-cutting gotcha worth flagging here rather than only in the motion doc:
`Modal.tsx`'s `EXIT_MS` constant and `useCountUp`'s `COUNT_UP_MS` constant are
hand-kept mirrors of `--dur-quick` and `--dur-tell` respectively, not runtime
reads of the CSS custom property — `getComputedStyle().getPropertyValue('--dur-*')`
returns `''` in jsdom, so the duration cannot be sourced from CSS at the point
these components need it in every environment this code runs in. If either token
in `tailwind.css` moves, its hand-kept mirror must move with it; there is no lint
gate for this today.
