# Components

Shared UI lives in [`src/sidepanel/components/shared/`](../src/sidepanel/components/shared/).
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
4. **Icons come from the `Icon` registry** (`shared/Icon.tsx`, 31 typed
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

- Size scale is `sm | md | lg` by default. Two primitives extend it where call sites
  needed steps the three-name scale could not express: `Icon` is
  `xs | sm | md | lg | xl` (12/16/20/24/32px) and `LoadingSpinner` is
  `sm | md | lg | xl | 2xl` (16/20/24/32/48px) — deliberately **name-for-name aligned**
  over the sizes they share, so a spinner standing in for a glyph is requested by the
  glyph's own size name. Extend a scale only when a real call site needs the step.
  Express sizing in Tailwind classes only — do **not** add parallel inline pixel `style`
  maps (`Button.tsx` is the model: its sizing is class-based).
- Variant/status names use the shared `StatusType` (`success | warning | danger |
info`) — never `error`.

## Catalog

`shared/`: `Button`, `IconButton`, `StretchedButton`, `FilterPill`, `SortPill`,
`CopyButton`, `CopyableId`, `OpenInOktaLink`, `Modal`, `Input`, `Checkbox`, `Select`,
`Textarea`, `PageHeader`, `EntityIdentity`, `EntityLink`, `Badge`, `Breadcrumbs`, `Tabs`,
`CollapsibleSection`, `DetailSection`, `ActionBar`, `AlertMessage`, `EmptyState`,
`Eyebrow`, `LoadingSpinner`, `Skeleton`, `ListRow`, `ScrollableList`, `SearchDropdown`,
`SelectionChips`.

There are **two** copy primitives and they are not interchangeable. `CopyButton` is a
labelled `Button` for copying a _body_ of text (a list of emails, a CSV). `CopyableId` is
a truncating `<code>` plus a ghost icon button, for a single identifier sitting in a line
of metadata — never hand-roll that pair again.

`ListRow` is the **row chrome** primitive (ADR-0029): border, radius, hover,
`density` (`compact` | `comfortable`), `state` (`default` | `selected` |
`highlighted`) and `as` (`div` | `li` | `a` | `button`). It owns the box and
never the interior — the interior follows the typography contract in
`docs/design-system.md`. Never hand-roll a row container. Prefer
`StretchedButton` over `as="button"` when the row holds its own controls, since
a button cannot legally contain a checkbox or another button.

`Eyebrow` is the **uppercase section label** — `text-xs font-semibold uppercase
tracking-wide text-neutral-600`, fixed. That one recipe had been hand-rolled across
roughly eighteen files in four variants (`tracking-wide` vs `tracking-wider`,
`text-xs` vs the off-scale `text-[10px]`/`text-[11px]`, `text-neutral-500`/`600`/`700`),
so several sizes of the same element could appear on one screen; ADR-0030 settled the
values in prose but never extracted the primitive, and the drift continued. There is
deliberately **no colour, size or tracking prop** — a section wanting a different
eyebrow treatment is the drift this exists to stop, and `className` takes layout and
spacing only. `as` picks `span` (default), `div` or `h3`; use `h3` only when the
eyebrow is a real section heading that should join the document outline. It is a label,
not a control: a section header needing a verb composes it beside a `Button`.

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
`tabindex`, arrow-key nav) with three variants: `underline` (section nav),
`segmented` (compact toggle) and `rail` (icon-first primary nav).

The **`rail`** variant is what `TabNavigation` uses for the panel's eight
top-level sections. Inactive tabs are icon-only (`TabItem.icon`, an `IconType`);
the active tab's label unfurls via `grid-template-columns: 0fr → 1fr` at
`--dur-move`, so the strip never toggles `display` to make room. What still
overflows scrolls, with the scrollbar hidden and `mask-image` edge fades keyed
off a `data-overflow` attribute. Every rail tab's `aria-label` is derived from
its own `label` inside `Tabs` — never passed separately — so an icon-only tab
always has an accessible name and it cannot drift from the visible one. (A rail
tab's `count` badge is therefore _not_ in its accessible name; see the JSDoc on
`TabItem.label` before adding counts to the rail.) The measurement behind the
edge state, the scroll-active-into-view and the sliding indicator lives in
`hooks/useTabRail.ts`, not the component.

`Breadcrumbs` is the trail primitive for **in-tab push/pop sub-navigation**
(`nav > ol`, ancestor crumbs are buttons, the last carries `aria-current="page"`).
It shapes to the `trail` returned by `hooks/useViewStack.ts`, and drops into
`PageHeader`'s additive `breadcrumbs` slot alongside its `onBack` / `leading`
slot — a tab keeps **one** `PageHeader` mounted and swaps its contents as views
are pushed and popped, rather than each view rendering its own header.

`PageHeader` is also where the **entity you are browsing is described** (ADR-0032).
Do not open a detail view with a card repeating the name and type already in the
title. Pass `identity` (an opaque node, normally an `EntityIdentity`), `identityKey`
(the entity's id — a change crossfades the region, no change swaps silently), and
`sticky={isActive}` to pin it as the page scrolls under. The header owns chrome only
and never learns what a group or a user is; the description comes from a **pure
per-entity builder** returning an `EntityIdentityDescriptor`:

```tsx
const identity = detailGroup ? groupIdentity(detailGroup) : undefined;

<PageHeader
  title={identity?.name ?? 'Groups'}
  badge={identity?.badge ?? listBadge}
  identityKey={identity?.key}
  identity={identity && <EntityIdentity rows={identity.rows} />}
  sticky={isActive}
/>;
```

`badge` renders in the trailing cluster, immediately left of `actions` — at 360px a
badge beside the `<h1>` costs the title two lines of wrapping.

A descriptor's `rows` group facts by category (identity, counts, timestamps); facts
inside a row wrap together and an empty row is dropped. **A builder omits a fact it
cannot answer rather than emitting a zero** — a group's rule counts are absent until
the rules payload loads, and "0 references" would state as fact something the panel
never asked. `memberCount` is the exception, because zero and unknown are
distinguishable at its source.

Adding an entity kind is one new builder beside that entity (`groupIdentity.ts`,
`userIdentity.ts`) plus a unit test, with no edit to anything shared. `PageHeader`
still describes the _browsed_ entity and `ContextBar` still describes the _live Okta
tab_ — the two must not converge, and on a drilled-in view their ids routinely differ.

`ActionBar` is the detail rung's **verb strip**, and it takes its verbs as **data**
(ADR-0038) — never `Button` children, which is what it took before:

```tsx
<ActionBar
  ariaLabel={`Actions for ${userDisplayName(user)}`}
  actions={[
    { id: 'add', label: 'Add group', icon: 'plus', variant: 'primary', onClick: onAdd },
    { id: 'compare', label: 'Compare', icon: 'users', onClick: onCompare },
  ]}
  expansion={<UserLifecycleActions {...lifecycle} />}
/>
```

Declaration order is reading order _and_ overflow order: the strip measures each
action and, as the panel narrows, drops every icon at once and then moves the tail
behind **More**. So put the verb an admin came to press first, and expect the last
one to be the first to disappear.

- **`priority`** is `flex` by default (`pinned` for a `primary` action). Use `pinned`
  only for the page's own main verb — the row wraps under a pinned action rather than
  overflowing it. Use `tier` for a verb that should live behind **More** from the
  start. It is not a way to move a section's verb onto the strip; ADR-0030 §2 still
  decides that.
- **`expansion`** is arbitrary caller JSX in the disclosure tier — a form, an
  account-state block, anything. That slot is why the tier is a region and not a
  `role="menu"`, and why a descriptor may not carry a `ReactNode`: a node cannot be
  measured from a cached width.
- **Never render your own More button.** The strip owns the control, the region and
  its `aria-controls` target, and renders the control only when the tier has content.
  Leave the tier uncontrolled unless the page has to collapse it on a rung change.

**A detail page never calls `<ActionBar>` directly — it wraps it in its own
`<Entity>ActionBar`** (`UserActionBar` is the reference shape), even for a single
action; the wrapper is where the page's second verb goes, and retrofitting one onto
an inline call site later means finding and migrating it. The wrapper decides where
each verb starts with one question, not by feel: reversible or read-only defaults to
the row (`flex`, or `pinned` for the page's one primary verb); a change to the
entity's state with **no symmetric undo** — suspend, delete, deactivate — defaults
to `tier`, behind a confirm `Modal` that states the consequence in plain language
next to the control ("Blocks sign-in until reversed," not just "Suspend").
**An `ActionDescriptor` is never declared for a handler that isn't wired yet** — an
unimplemented verb is omitted, the same "absent is not zero" discipline ADR-0032
applies to identity facts, not rendered `disabled` forever with a tooltip standing
in for an explanation. A permission-gated verb may still render `disabled` with a
`title` naming the real reason. See ADR-0039 for the incident this closes.

**A detail rung that answers several questions about one entity uses tabbed panes of
one card**, not a stack of sections — `UserDetailPanel` is the pattern (Groups / Apps /
Profile, through shared `Tabs`). Stacking made the page a scroll where the reader
wanted a comparison. Panes render as siblings and the inactive ones carry the `hidden`
**attribute** as well as the class (ADR-0016/ADR-0018), so each keeps its own filter,
pills and disclosures as local state; the attribute matters because jsdom loads no
stylesheet, and a class-only hide leaves every pane answering `getByRole` at once. Only
the active pane may load — which pane is showing is the one piece of state that lifts,
because the loads are gated on it (see
[state-management.md](./state-management.md)) — and a pane's tab shows **no count**
until a walk has returned, tested by a `hasLoaded` flag rather than `items.length`
("Unknown is not zero", below). The panel composes and does not fetch.

## Documented raw-control exceptions

The button/input migration is complete; these are the raw controls that stay raw
**by decision**, each carrying an inline `§3 exception` (or `CHARACTERIZED:`)
comment at the call site:

- **Composites** where a shared primitive is not pixel-neutral: the Add-to-Group
  type-ahead (`AddToGroupModal`) and `UserComparisonModal`'s search field in
  `ComparisonSearchPhase` — leading-glyph search inputs with an absolutely
  positioned spinner/dropdown — plus `GroupFilterToggle`.

  `SearchDropdown`, `UserSearchBar` and `GroupSearchBar` **left this list**: they
  now compose `Input` + `Icon` + `LoadingSpinner` like `MemberSearchBar`. The
  exception was real — converging on the primitives cost a few pixels of field
  height (`py-3`/`py-2.5` → `py-2`), leading-icon size (20px → 16px), and the
  reserved trailing padding the shared `Input` has no slot for. That was accepted
  as the price of not maintaining a byte-identical copy of the input class string
  in two files. The two entries that remain are the ones where the delta is larger
  than that, and they still need a design call rather than a mechanical swap.

- **Roving-focus rows:** `TabJumpPalette`'s result rows. A palette row is a
  left-aligned icon + label + status row carrying a roving `tabIndex` and a ref
  for programmatic focus; `Button` is a centred CTA and exposes neither
  `tabIndex` nor a ref, so the gap is structural rather than stylistic and a new
  variant would not discharge it. (The same file records why the palette uses
  roving focus rather than combobox ARIA: `Input` deliberately does not spread
  arbitrary props, and adding `role`/`aria-expanded`/`aria-controls`/
  `aria-activedescendant` to a shared primitive for one consumer is the wrong
  trade. A `Input`-level combobox mode is accepted future work, gated on a second
  consumer.)
- **Genuinely custom controls:** `ComparisonTabBar` — a one-off `role="tab"` bar,
  now **four** tabs (Overview / Groups / Apps / Attributes). Re-evaluated for
  migration to `Tabs` `segmented` and **kept**: `segmented` ignores `TabItem.icon`
  (only `rail` renders one), so the swap would silently drop the four glyphs.
  Retiring it means either accepting that loss or teaching `segmented` to render
  icons, and the latter needs a second consumer before it earns a place in a shared
  primitive. Its off-scale `text-[10px]` badge has been brought onto the scale in the
  meantime. The fourth tab is also why it is a `grid grid-cols-2 sm:grid-cols-4`
  rather than a flex row: four icon+label tabs need ~440px against the ~330px a
  360px panel has, so below 640px the bar takes a second row instead of truncating a
  label or dropping the glyphs.
  Also: the dynamic-color banner, radio-cards, the `AttributeFacet`
  data-viz spread bars, and the Export tab's `EntityPicker` selectable entity
  cards (`role="button"` icon+title+description rows; `Button` is a centered
  CTA, so it does not fit — but `ListRow as="button"` now does, and
  `EntityPicker` is on the ADR-0029 migration list rather than a permanent
  exception).
- **Awaiting a new shared primitive (accepted future work):**
  - Chromeless **text-links** ("Clear all", "View details") have no shared
    `TextLink` primitive — adding one would discharge these across `GroupFilterPanel`,
    `AttributeFacet`, and `ComparisonOverviewTab`.
  - `FilterPill` legend-row toggles and the semantic-colored variants need a
    `className` escape hatch to match without inline classes.
  - The active-filter chip's `rounded-full` close button (`IconButton` is
    `rounded-md`).

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
