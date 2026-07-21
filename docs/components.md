# Components

Shared UI lives in [`src/sidepanel/components/shared/`](../src/sidepanel/components/shared/)
and [`src/sidepanel/components/overview/shared/`](../src/sidepanel/components/overview/shared/).
Feature components live under `components/{groups,users,overview}/`.

## Hard rules

1. **Never hand-roll a `<button>`, `<input>`, `<select>`, `<textarea>`, or
   `<input type="checkbox">`** in a feature component. Use `Button`/`IconButton`/
   `FilterPill`/`SortPill`, `Input`, `Select`, `Textarea`, `Checkbox`. If a shape is
   missing (e.g. a filter chip / toggle), add a variant to the shared component —
   don't inline bespoke classes. The only remaining raw controls are the
   **documented exceptions** listed below.
2. **Import from the barrel** `components/shared` — not deep paths. The barrel
   exports every shared component (see below).
3. **No raw hex / no ad-hoc spacing** — see [design-system.md](./design-system.md).
4. **Icons come from the `Icon` registry** (`overview/shared/Icon.tsx`, 27 typed
   icons, `currentColor`). Don't inline `<svg>` in feature code.

## The variant/size convention

Every configurable component uses a **`Record<Variant, string>` lookup map** plus a
composed `baseClasses` string. Follow this exact pattern (see `Button.tsx`,
`AlertMessage.tsx`, `Modal.tsx`, `Icon.tsx`):

```tsx
export type FooVariant = 'primary' | 'secondary' | 'danger';
const variantClasses: Record<FooVariant, string> = {/* … */};
const sizeClasses: Record<FooSize, string> = { sm: '…', md: '…', lg: '…' };
```

- Size scale is `sm | md | lg`. Express sizing in Tailwind classes only — do **not**
  add parallel inline pixel `style` maps (`Button.tsx` is the model: its sizing is
  class-based).
- Variant/status names use the shared `StatusType` (`success | warning | danger |
info`) — never `error`.

## Catalog

`shared/`: `Button`, `IconButton`, `FilterPill`, `SortPill`, `CopyButton`,
`OpenInOktaLink`, `Modal`, `Input`, `Checkbox`, `Select`, `Textarea`, `PageHeader`,
`Tabs`, `CollapsibleSection`, `AlertMessage`, `EmptyState`, `LoadingSpinner`,
`ScrollableList`, `SearchDropdown`, `SelectionChips`.

`Tabs` is the accessible tab-bar primitive (`role="tablist"/"tab"`, roving
`tabindex`, arrow-key nav) with two variants: `underline` (section nav) and
`segmented` (compact toggle).
`overview/shared/`: `Icon`, `StatCard`.

## Documented raw-control exceptions

The button/input migration is complete; these are the raw controls that stay raw
**by decision**, each carrying an inline `§3 exception` (or `CHARACTERIZED:`)
comment at the call site:

- **Composites** where a shared primitive is not pixel-neutral: `SearchDropdown`,
  `UserSearchBar`, `GroupSearchBar`, and the Add-to-Group type-ahead (leading-glyph
  search inputs with an absolutely-positioned spinner/dropdown), plus
  `GroupFilterToggle`.
- **Genuinely custom controls:** `ComparisonTabBar` (a documented one-off
  `role="tab"` bar that predates and has not been migrated to the shared `Tabs`
  primitive), the dynamic-color banner, radio-cards, the `AttributeFacet`
  data-viz spread bars, and the Export tab's `EntityPicker` selectable entity
  cards (`role="button"` icon+title+description rows — no shared card primitive
  fits, and `Button` is a centered CTA; kept keyboard-accessible).
- **Awaiting a new shared primitive (accepted future work):**
  - Chromeless **text-links** ("Clear all", "View details") have no shared
    `TextLink` primitive — adding one would discharge these across `GroupFilterPanel`,
    `AttributeFacet`, and `ComparisonOverviewTab`.
  - `FilterPill` legend-row toggles and the semantic-colored variants need a
    `className` escape hatch to match without inline classes.
  - The active-filter chip's `rounded-full` close button (`IconButton` is
    `rounded-md`).
  - `UserComparisonModal`'s search `Input` (`py-3`/`shadow-sm`) is not pixel-neutral
    against the shared `Input` base — needs a design call, not a mechanical swap.

**Barrel:** `shared/index.ts` now exports the full catalog above — import from the
barrel (`../shared`), not deep paths.

## When to build vs reuse

- Reuse a shared component if one exists (check the catalog first).
- Extend via a new variant/prop if the difference is stylistic.
- Build a new shared component only for a genuinely new primitive; put it in
  `shared/`, follow the variant/size convention, add it to the barrel, and note it
  here. Delegate this to the `component-builder` agent.
- New or changed `shared`/leaf components ship a co-located `.stories.tsx` — see
  [component-explorer.md](./component-explorer.md) for the two templates. Use
  Storybook to develop and visually review the component in isolation before
  wiring it into a feature.
- Composition over configuration: large feature UIs (e.g. a comparison modal) are
  built by composing primitives, and should be split into subcomponents rather than
  growing past ~300 lines (see [state-management.md](./state-management.md)).
