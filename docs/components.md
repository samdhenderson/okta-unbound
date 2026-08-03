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
4. **Icons come from the `Icon` registry** (`overview/shared/Icon.tsx`, 29 typed
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

`shared/`: `Button`, `IconButton`, `StretchedButton`, `FilterPill`, `SortPill`,
`CopyButton`, `OpenInOktaLink`, `Modal`, `Input`, `Checkbox`, `Select`, `Textarea`,
`PageHeader`, `Breadcrumbs`, `Tabs`, `CollapsibleSection`, `AlertMessage`,
`EmptyState`, `LoadingSpinner`, `ScrollableList`, `SearchDropdown`,
`SelectionChips`.

`IconButton` is also the **disclosure** primitive: pass `expanded` + `controls`
and it emits `aria-expanded` / `aria-controls` (as `active` does `aria-pressed`).
Any chevron that opens a region uses it — never a bare `<button>`.

`StretchedButton` makes a **whole card or row activatable**: an empty,
absolutely-positioned button that covers its `relative` ancestor and sits behind
the card's own controls (`relative z-10`). It replaces both bad alternatives —
`role="button"` on a `<div>`, and wrapping the card's content in a `<button>`
(invalid content model, and axe `nested-interactive` as soon as the card has a
checkbox). Because every card in a list shares one `label`, pass `describedBy`
pointing at that card's title. First consumer: `GroupListItem`'s row-body
drill-in.

`Tabs` is the accessible tab-bar primitive (`role="tablist"/"tab"`, roving
`tabindex`, arrow-key nav) with two variants: `underline` (section nav) and
`segmented` (compact toggle).

`Breadcrumbs` is the trail primitive for **in-tab push/pop sub-navigation**
(`nav > ol`, ancestor crumbs are buttons, the last carries `aria-current="page"`).
It shapes to the `trail` returned by `hooks/useViewStack.ts`, and drops into
`PageHeader`'s additive `breadcrumbs` slot alongside its `onBack` / `leading`
slot — a tab keeps **one** `PageHeader` mounted and swaps its contents as views
are pushed and popped, rather than each view rendering its own header.
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

## List rows derive; they never fetch

A row in a long list renders a few hundred times, so **a row must not own I/O.** Its
entire rendered model is derived by a pure, I/O-free module from (a) the entity it was
given and (b) data already banked in a session cache. `GroupListItem` is the pattern:
`groupSourceSummary.ts` computes the badge, identity line, facts and meter state, and
cannot fetch, which is the _structural_ guarantee — not a convention — that scrolling
a list cannot trigger work.

That guarantee is load-bearing for the member-source meter specifically: computing one
breakdown costs `ceil(N/200)` paginated member requests **per group**, against a
scheduler capped at 5 concurrent with a cooldown at 10% of remaining budget. So the
row renders a meter only from a breakdown already in the cache
(`useCachedMemberSource`, which has no API access at all); otherwise it says so and
offers an explicit action that hands the job to a view which can show its cost.

Two rules follow for any row-level fact:

- **Unknown is not zero.** A count that has not been loaded yet renders as absent, not
  as `0` (e.g. `usedInRuleCount` before the rules payload is known).
- **Keep the memo comparator in step.** Rows are `memo`ised with a custom comparator;
  every newly rendered field must be added to it, or long lists render stale.
