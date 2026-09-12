# Components

Shared UI lives in [`src/sidepanel/components/shared/`](../src/sidepanel/components/shared/).
Feature components live under `components/{groups,users,apps,home}/`.

This doc answers **which primitive to reach for, and what the rules are**; the per-primitive prop
and mode contracts are in [component-primitives.md](./component-primitives.md). Verb strips —
`ActionBar`, descriptors, `primary`, refresh: [action-bars.md](./action-bars.md). Shell layout, the
rail, sticky bands, the view stack: [page-shell.md](./page-shell.md). Card chrome and `ListRow`'s
row contract: [surfaces.md](./surfaces.md).

## Hard rules

1. **Never hand-roll a `<button>`, `<input>`, `<select>`, `<textarea>`, or
   `<input type="checkbox">`** in a feature component. Use
   `Button`/`IconButton`/`FilterPill`/`SortPill`, `Input`, `Select`, `Textarea`, `Checkbox`. If a
   shape is missing (e.g. a filter chip / toggle), add a variant to the shared component — don't
   inline bespoke classes. The only remaining raw controls are the **documented exceptions** below.
2. **Import from the barrel** `components/shared` — not deep paths. The barrel exports every shared
   component.
3. **No raw hex / no ad-hoc spacing** — see [design-system.md](./design-system.md).
4. **Icons come from the `Icon` registry** (`shared/Icon.tsx`, 31 typed icons, `currentColor`).
   Don't inline `<svg>` in feature code.

## The variant/size convention

Every configurable component uses a **`Record<Variant, string>` lookup map** plus a composed
`baseClasses` string (see `Button.tsx`, `AlertMessage.tsx`, `Modal.tsx`, `Icon.tsx`):

```tsx
export type FooVariant = 'primary' | 'secondary' | 'danger';
const variantClasses: Record<FooVariant, string> = {/* … */};
const sizeClasses: Record<FooSize, string> = { sm: '…', md: '…', lg: '…' };
```

- Size scale is `sm | md | lg` by default. Three primitives extend it where a call site needed a
  step the three-name scale could not express: `Button` adds `xs` (24px, the recessed step —
  `ActionBar`'s selection register and the docked `ActivityBar`, never a page verb), `Icon` is `xs | sm | md | lg | xl`
  (12/16/20/24/32px), `LoadingSpinner` is `sm | md | lg | xl | 2xl` (16/20/24/32/48px). The scales
  are **name-for-name aligned** over the sizes they share, so a spinner standing in for a glyph is
  requested by the glyph's own size name. Extend a scale only when a real call site needs the step,
  and express sizing in Tailwind classes only — never a parallel inline pixel `style` map
  (`Button.tsx` is the model).
- Variant/status names use the shared `StatusType` (`success | warning | danger | info`) — never
  `error`.
- **`Button`'s `ghost` and `link` are different kinds of quiet.** `ghost` is still a box: it keeps
  its size's horizontal padding and sits in a row of buttons as one of them — the treatment for a
  panel toggle or a disclosure trigger, which _is_ a button but must not compete with the verbs
  beside it. `link` is not a box: it drops horizontal padding entirely, takes `text-primary-text`
  and underlines on hover, so its first glyph lands on the same vertical line as the box edges
  above and below it. It keeps the _vertical_ half of the size scale, so a row of links is exactly
  as tall as the row of buttons it replaced. Use it where the control is a phrase in the layout
  rather than an object in a row of objects — `ActionBar`'s selection register (`Select all (M)`,
  `Deselect all`) is the reference case. It stays a real `<button>`; the look is a link, the
  semantics are not. Never reach for `link` to make a _verb_ quieter — a verb that acts gets
  `secondary`, and the size scale is what makes it quiet.

## Catalog

`shared/`: `Button`, `IconButton`, `StretchedButton`, `FilterPill`, `SortPill`, `CopyButton`,
`CopyableId`, `CopyIconButton`, `OpenInOktaLink`, `Modal`, `Input`, `Checkbox`, `Select`,
`Textarea`, `PageHeader`, `EntityIdentity`, `EntityLink`, `Badge`, `Breadcrumbs`, `Tabs`, `Tooltip`,
`CollapsibleSection`, `DetailSection`, `ActionBar`, `AlertMessage`, `EmptyState`, `Eyebrow`,
`StableWidth`, `LoadingSpinner`, `Skeleton`, `ListRow`, `ScrollableList`, `SearchDropdown`,
`SelectionChips`, `RuleExpressionText`, `ClauseLedger`, `ClauseLedgerBranch`, `ClauseLedgerClause`,
`GroupReferenceChip`, `RawExpressionWell`.

- [`ClauseLedger`](#clauseledger-family) — the tree-shaped rule-condition explanation (below)

### `ClauseLedger` family

Renders {@link module:shared/rules/explainExpression.explainRuleExpression}'s **tree**
projection — `&&`/`||` structure intact, rather than a flattened row-per-clause list.
It replaced `groups/detail/ClauseChecklist`, which no longer exists;
`users/MembershipRuleEvidence` is the production adopter. `ClauseLedger` composes
`ClauseLedgerBranch` (a connective group, indented under a rail, with the
Kleene-shortcut sentence when the structured fields say one applies) and
`ClauseLedgerClause` (one leaf, including the plain-language label for a
group-membership clause and its `GroupReferenceChip` row). `RawExpressionWell` is
the toggled-to raw-EL view. Logic lives in `useClauseLedger` (memoised explanation,
view-toggle state) per `docs/state-management.md`.

These carry a written contract; read it before using one:

- [`EntityLink`](./component-primitives.md#entitylink) — reference another entity
- [`RuleExpressionText`](./component-primitives.md#ruleexpressiontext) — print a rule's condition
- [`EntityChooser`](./component-primitives.md#entitychooser) — the scope-first launcher (`home/`)
- [`Tabs`](./component-primitives.md#tabs) — the tab bar: `underline` (default) or `rail`
- [`Tooltip`](./component-primitives.md#tooltip) — the hover- and focus-triggered label chip
- [`IconButton` / `StretchedButton`](./component-primitives.md#iconbutton-and-stretchedbutton) — the
  disclosure control, and the whole-card press target
- [`StableWidth`](./component-primitives.md#stablewidth) — hold a slot open at its widest state
- [`Breadcrumbs` / `PageHeader`](./component-primitives.md#breadcrumbs-and-pageheader) — the in-tab
  trail, and the rung's header
- [`ListRow`](./surfaces.md) — the row chrome primitive; props and interior contract in surfaces.md
- [`Eyebrow`](./design-system.md) — the one uppercase section-label recipe, fixed in
  design-system.md. `as` picks `span` (default), `div` or `h3`; use `h3` only for a heading that
  joins the document outline. A label, not a control: one needing a verb sits beside a `Button`.

### Copy primitives

Three, not interchangeable. `CopyButton` is a labelled `Button` for copying a _body_ of text (a list
of emails, a CSV). `CopyableId` is a truncating `<code>` plus a ghost icon button, for a single
identifier in a line of metadata — never hand-roll that pair again. `CopyIconButton` is that ghost
icon button alone, for a control copying an id the surface already shows another way (`EntityLink`'s
`copyId`); `CopyableId` delegates to it, so the glyph swap and the ~1.5s `"Copied!"` accessible-name
flip are decided in one place (`D-015`).

## Two conventions that outlive their primitive

**A chip is a proven answer; a non-answer is muted italic text and is never chipped.** `EntityLink`
states it, and so do `AppScopeIndicator` and `GroupSourceIndicator`. A reference whose entity is
_gone_ ("no group in this org has this id") is a proven answer and keeps its warning chip —
`RuleDetailView`'s `MissingGroupChip` is that, deliberately not the same thing.

**A value that arrives late must not move the text beside it** (`D-053`). `StableWidth` is the
mechanical half of that rule: reserve the widest state so a late chip, badge or label lands in a
slot already the right size, beside a `min-w-0` column free to absorb the difference.

## Panes or a section stack

**A detail rung that answers several questions about one entity uses tabbed panes of one card**, not
a stack of sections — `UserDetailPanel` is the pattern (Groups / Apps / Profile, through shared
`Tabs`). Stacking made the page a scroll where the reader wanted a comparison. Panes render as
siblings and the inactive ones carry the `hidden` **attribute** as well as the class — every tab
stays mounted, so each pane keeps its filter, pills and disclosures as local state, and the
attribute matters because jsdom loads no stylesheet: a class-only hide leaves every pane answering
`getByRole` at once. Only the active pane may load — which pane is showing is the one piece of state
that lifts, because the loads are gated on it (see [state-management.md](./state-management.md)) —
and a pane's tab shows **no count** until a walk has returned, tested by a `hasLoaded` flag rather
than `items.length` ("Unknown is not zero", below). The panel composes and does not fetch.

**One question, one load, three short sections: use the stack.** The threshold is real in both
directions — `RuleDetailView` is a `DetailSection` stack because a rule has one condition and three
facts about it, all already on the `FormattedRule` the list was rendering. Splitting four short
sections across tabs would hide three of them to save a scroll that does not exist, and the rung
fetches nothing, so there is no per-pane load to gate. It is also the rung that retired the last
hand-rolled layout dialect: `RuleCard`'s expandable body, whose four write verbs flex-wrapped at the
bottom of a card, is exactly the "page-level verb read as a section's property" failure the verb
strip exists to stop ([action-bars.md](./action-bars.md)).

## Documented raw-control exceptions

The button/input migration is complete; these raw controls stay raw **by decision**, each carrying
an inline `§3 exception` (or `CHARACTERIZED:`) comment at the call site:

- **Composites** where a shared primitive is not pixel-neutral: the Add-to-Group type-ahead
  (`AddToGroupModal`) and `UserComparisonModal`'s search field in `ComparisonSearchPhase` —
  leading-glyph search inputs with an absolutely positioned spinner/dropdown — plus
  `shared/FilterToggle`. `SearchDropdown`, `UserSearchBar` and `GroupSearchBar` **left this list**:
  they compose `Input` + `Icon` + `LoadingSpinner` like `MemberSearchBar`. Converging cost a few
  pixels of field height (`py-3`/`py-2.5` → `py-2`), leading-icon size (20px → 16px) and the
  reserved trailing padding the shared `Input` has no slot for — accepted as the price of not
  maintaining a byte-identical copy of the input class string in two files. The two that remain have
  a larger delta and need a design call, not a mechanical swap.
- **Roving-focus rows:** `palette/PaletteRow`, the row the ⌘K palette renders for both its sections
  and its entity results — a left-aligned icon + label + trailing-mark row carrying a roving
  `tabIndex` and a ref for programmatic focus. **Neither** shared primitive can host that: `Button`
  is a centred CTA and exposes neither `tabIndex` nor a ref; `ListRow` exposes `elementRef` but no
  `tabIndex` and no `onKeyDown`, so it can carry neither the roving anchor nor the Up/Down handler.
  The gap is structural, not stylistic, so a new variant would not discharge it. The row renders as
  an `<a>` rather than a `<button>` when given an `href` — a kind this build cannot open in-panel
  has the Okta console as its only route, and a link nested inside the row button is a
  `nested-interactive` axe violation (`home/JumpResultRow` makes the same call with `as`). One
  interactive element per row, chosen by what the row can do. (The same file records why the palette
  uses roving focus rather than combobox ARIA: `Input` deliberately does not spread arbitrary props,
  and adding `role`/`aria-expanded`/`aria-controls`/`aria-activedescendant` to a shared primitive
  for one consumer is the wrong trade. An `Input`-level combobox mode is accepted future work, gated
  on a second consumer.)
- **Genuinely custom controls:** the dynamic-color banner, radio-cards, the `AttributeFacet` and
  `AttributeSpreadBar` data-viz spread bars, the Activity Bar's `BucketRow` lane (a track whose
  fills, hatches and folded badges encode scheduler state — dataviz, not a list row, so `ListRow`
  would fight it rather than serve it), and the Export tab's `EntityPicker` selectable entity cards
  (`role="button"` icon+title+description rows; `Button` is a centered CTA and does not fit — but
  `ListRow as="button"` does, so `EntityPicker` is on the `ListRow` migration list rather than a
  permanent exception).
- **Awaiting a new shared primitive (accepted future work):** chromeless **text-links** ("Clear
  all", "View details") have no shared `TextLink` primitive — adding one would discharge
  `GroupFilterPanel`, `AttributeFacet`, `AttributeHealthCard` (its `Other (N values)` drill-in) and
  `ComparisonOverviewTab`; `FilterPill` legend-row toggles and the semantic-colored variants need a
  `className` escape hatch to match without inline classes; the active-filter chip's `rounded-full`
  close button has no home (`IconButton` is `rounded-md`).

## When to build vs reuse

- Reuse a shared component if one exists (check the catalog first).
- Extend via a new variant/prop if the difference is stylistic.
- Build a new shared component only for a genuinely new primitive; put it in `shared/`, follow the
  variant/size convention, add it to the barrel, and note it here. Delegate to the
  `component-builder` agent.
- A primitive with exactly one caller lives beside that caller, not in `shared/` — `EntityChooser`
  and `ReportRow` (`RowLines` + `RowDisclosure`) sit under `home/` for that reason. The promotion
  trigger is `RuleExpressionText`'s: the second feature to consume it moves it to `shared/`, into
  the barrel, unchanged.
- New or changed `shared`/leaf components ship a co-located `.stories.tsx` — see
  [component-explorer.md](./component-explorer.md) for the two templates. Develop and review the
  component in Storybook before wiring it into a feature.
- Composition over configuration: large feature UIs (e.g. a comparison modal) are built by composing
  primitives and split into subcomponents rather than growing past ~300 lines (see
  [state-management.md](./state-management.md)).

## List rows derive; they never fetch

A row in a long list renders a few hundred times, so **a row must not own I/O.** Its entire rendered
model is derived by a pure, I/O-free module from (a) the entity it was given and (b) data already
banked in a session cache. `GroupListItem` is the pattern: `groupSourceSummary.ts` computes the
badge, identity line, facts and meter state, and cannot fetch — the _structural_ guarantee, not a
convention, that scrolling a list cannot trigger work.

That is load-bearing for the member-source meter specifically: one breakdown costs `ceil(N/200)`
paginated member requests **per group**, against a scheduler capped at 5 concurrent with a cooldown
at 10% of remaining budget. So the row renders a meter only from a breakdown already in the cache
(`useCachedMemberSource`, which has no API access at all); otherwise it says so and offers an
explicit action that hands the job to a view which can show its cost.

Two rules follow for any row-level fact:

- **Unknown is not zero.** A count not yet loaded renders as absent, not as `0` (e.g.
  `usedInRuleCount` before the rules payload is known).
- **Prefer a bare `memo(...)` over a hand-written comparator.** Rows (`RuleCard`, `PolicyCard`,
  `GroupListItem`) are memoised with the default shallow compare — a hand-written comparator drifts
  the moment the row renders a field it forgot to compare, which is a stale-UI bug, not a perf nit
  (`D-039`, `D-045`). It works because each row's entity prop keeps stable per-id identity from its
  list source; add a custom comparator back only with a measured reason, and keep it enumerated
  against the render body if you do.
