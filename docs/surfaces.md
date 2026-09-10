# Surfaces

Elevation, card chrome, and the anatomy of a list row. Colour, type and spacing
tokens live in [design-system.md](./design-system.md); this doc is about the boxes
those tokens paint.

## The canvas / card model

A **gray canvas** with **white cards** floating on it.

- `canvas` is the page backdrop, applied once on the app shell (`App.tsx`'s
  `bg-canvas`). Never put content directly on it without a card.
- A **content card** is `bg-white` + a 1px `border-neutral-200` border +
  `rounded-md`. `DetailSection` is the reference shape; its optional band header is
  `bg-neutral-50` above a `border-b`.
- `bg-canvas` inside a card is a **recessed well** — an evidence block, a nested app
  row, an attribute grid. That is the only reason to repaint the canvas colour
  inside content; a full-bleed canvas plate belongs to the docking band alone (below).

## No drop shadow on a card you cannot click

Elevation on a static card comes from the border. **A card that is not a click target
gets no shadow.**

The reason is density, not orthodoxy: this panel stacks cards at 360px, and a shadow
on every surface turns the stack into noise. Do **not** justify this rule by claiming
Okta does not shadow cards — Odyssey's own `Card` ships `DepthMedium` at rest and
deepens to `DepthHigh` on `.isClickable:hover`. A shadow on a card is Odyssey
behaviour; the narrow width is ours.

## An interactive card may lift

A card that is itself a click target may carry the `.lift` class, which cross-fades
`--lift-1` (Odyssey's `DepthLow`; `DepthHigh` is heavier than a 360px panel needs).
`StatCard` and `GroupOverviewPane`'s tile are the reference uses.

- **Never transition `box-shadow`.** `.lift` pre-paints the shadow on an `::after` at
  `opacity: 0` and cross-fades the opacity over `--dur-instant` `--ease-standard` —
  Odyssey's own technique in `labs/AppTile`. Animating a shadow repaints; animating an
  opacity composites.
- **`.lift` carries no `translateY`**, so it never collides with `.press`'s transform
  on a surface that is both liftable and pressable — which is most of them.
- A border shift (`hover:border-neutral-300`) remains fine, and is still the right
  choice for a row.

## Shadows are for overlays

Everything else that carries a shadow lifts clear of the canvas: the `Modal`
(`shadow-xl`), dropdowns and popovers (`SearchDropdown`'s `shadow-sm`), and small
chips floating on a coloured field. The fixed `ActivityBar` sits on a top border,
not a shadow.

There is exactly one shadow on a non-overlay surface: `--shadow-dock`, grown by an
`ActionBar` as it merges into the page header. A docked band is not a card on the
canvas — rows scroll _underneath_ it — so it earns the overlay treatment. At rest,
unmerged, or with motion off, it has no shadow at all. Reach for this only if you are
pinning a band, and use the token.

## The docking band's resting shape

`ActionBar` at rest is **a card the width of the rung** — it spans the tab column and
stops at the same left and right margins as every `DetailSection` below it. It grows
past those margins to the panel bleed only as it docks.

- **Only the chrome merges.** The band's `::before` is what animates; the row inside
  keeps the column's padding the whole way, so no verb moves during the merge and the
  overflow observer watches a band width that does not churn. Never put a layout
  property on that timeline.
- **The disclosure owns the trailing edge.** The **More** cluster is parked with
  `ms-auto` and carries its hairline separator with it, so the rule always reads as
  the boundary between the verbs and the way to reach the rest of them — wherever the
  verbs happen to end.
- **The bleed plate is unconditional.** The band's `::after` paints an opaque
  `--color-canvas` slab spanning the panel behind it, so page rows disappear _under_ a
  pinned strip instead of scrolling through the gutters either side of it. It is
  canvas-on-canvas at rest, so it is invisible in flow, and it is present in every
  motion mode — without it the leak is permanent wherever the merge is cleared.

Two custom properties carry the geometry, published imperatively by
`useActionOverflow` and consumed only by `tailwind.css`. They are a contract, not an
implementation detail — **never pass a `style` prop to the band**, or React clears
them on its next render.

| Property        | Host                | Meaning                                       |
| --------------- | ------------------- | --------------------------------------------- |
| `--bar-bleed`   | the band            | The band's distance from the panel edge       |
| `--dock-offset` | the band's _parent_ | Rung margin between the sentinel and the band |

`--dock-offset` sits on the parent because the element that reads it is the dock
sentinel — the band's _sibling_, which cannot see a property set on the band.

## List rows

A row is the most repeated element in the panel, so its chrome lives in one component
and its interior follows one contract. **The chrome is `ListRow`**
(`components/shared/ListRow.tsx`). Never hand-roll a row container — the radius,
resting border, hover border and transition are fixed there on purpose, and a row
wanting a different hover colour is the drift the component exists to stop.

| Prop      | Values                                                              |
| --------- | ------------------------------------------------------------------- |
| `density` | `compact` (`--sp-row-y`/`--sp-row-x`) · `comfortable` (`--sp-card`) |
| `state`   | `default` · `selected` · `highlighted`                              |
| `as`      | `div` · `li` · `a` · `button`                                       |
| `body`    | expandable region below the header                                  |

Hover repaints the border on `default` rows only: a `selected` or `highlighted` row
already carries `border-primary`, and hovering it must not make it look _less_
selected. A row that is itself the click target gets `.press press-subtle`; a row
activated by an internal `StretchedButton` does not.

**Expandable rows use the `body` slot**, not a hand-built wrapper. The border belongs
to the card, the padding belongs to the header, and a `.disclose` body sets its own —
so passing `body` moves the density padding onto an inner header wrapper and clips the
card, and the row still owns exactly one border.

**The interior is a contract, not a component.** `ListRow` deliberately does not own
it, because interiors genuinely differ. Follow these:

| Line              | Classes                                      |
| ----------------- | -------------------------------------------- |
| Primary           | `text-sm font-semibold text-neutral-900`     |
| Secondary         | `text-xs text-neutral-600`                   |
| Identifier / meta | `font-mono text-xs text-neutral-500`         |
| Badge / pill      | `px-2 py-0.5 rounded-md text-xs font-medium` |

No arbitrary type values in a row (`text-[11px]`, `text-[10px]`) and no unsized
primary line — an unsized `font-semibold` renders at 16px next to a peer's 14px.

**Two separator patterns, not four.**

1. `space-y-3` between bordered rows — the default, and what `ScrollableList` and the
   list `Skeleton` already emit, so a placeholder matches the real list.
2. `divide-y divide-neutral-100` inside one bordered container — for a dense,
   table-like surface (`ComparisonAttributesTab`, `ProfileDisplayEditor`,
   `RuleImpactModal`), whose rows opt out of the per-row border.

`divide-neutral-200` and a per-row `border-b last:border-b-0` are not sanctioned for a
list of rows. `border-b last:border-b-0` remains correct in a genuine table body
(`ExportPreviewTable`'s `<tr>`) and in a dropdown option list (`SearchDropdown`),
neither of which is a row list.
