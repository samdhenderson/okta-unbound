# Components

Shared UI lives in [`src/sidepanel/components/shared/`](../src/sidepanel/components/shared/).
Feature components live under `components/{groups,users,apps,home}/`.

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
`CopyButton`, `CopyableId`, `CopyIconButton`, `OpenInOktaLink`, `Modal`, `Input`, `Checkbox`, `Select`,
`Textarea`, `PageHeader`, `EntityIdentity`, `EntityLink`, `Badge`, `Breadcrumbs`, `Tabs`,
`Tooltip`,
`CollapsibleSection`, `DetailSection`, `ActionBar`, `AlertMessage`, `EmptyState`,
`Eyebrow`, `StableWidth`, `LoadingSpinner`, `Skeleton`, `ListRow`, `ScrollableList`,
`SearchDropdown`, `SelectionChips`.

There are **three** copy primitives and they are not interchangeable. `CopyButton` is a
labelled `Button` for copying a _body_ of text (a list of emails, a CSV). `CopyableId` is
a truncating `<code>` plus a ghost icon button, for a single identifier sitting in a line
of metadata — never hand-roll that pair again. `CopyIconButton` is the ghost icon button
on its own, with no `<code>` beside it, for a control that copies an id the surface is
already displaying some other way (`EntityLink`'s `copyId`); `CopyableId` delegates to it,
so the glyph swap and the ~1.5s `"Copied!"` accessible-name flip are decided in one place
(D-015).

`EntityLink` is the **one** way to reference another entity — "that rule / that group /
that user / that app" — and it has three modes, picked by which of `name` and `id` you
pass. Never hand-roll any of them:

| You have         | Pass          | You get                                                                                                                         |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| a name and an id | `name` + `id` | a chip with the type glyph and a chevron that opens the entity on its own tab                                                   |
| a name, no id    | `name` only   | plain text with a tooltip saying why it cannot be opened — a link is never a control that does nothing                          |
| an id, no name   | `id` only     | the missing name **stated** in the non-answer register, the raw id beside it via `CopyableId`, and the entity still opens by id |

The id-only mode is the shared home for "this reference is known only by an id" (I-017).
Three views had each grown their own local chip for it, and none could open the entity —
a capability regression against the resolved chip beside it in the same list, since a
valid id is a valid destination whether or not the view learned a name. **Never pass the
id in as the `name`**: an id in a name's slot is indistinguishable from a group actually
called `00gFAKE…` (I-003).

Its chrome follows the house **non-answer convention** that `AppScopeIndicator` and
`GroupSourceIndicator` state explicitly and that applies well beyond `EntityLink`: **a
chip is a proven answer; a non-answer is muted italic text and is never chipped**, so a
missing answer can never carry an answer's weight at a glance. A reference whose entity
is _gone_ ("no group in this org has this id") is a proven answer and keeps its warning
chip — `RuleDetailView`'s `MissingGroupChip` is that, and is deliberately not the same
thing.

Four props parameterise the unresolved state, all with sane defaults so no caller passes
Tailwind to make it fit: `unresolvedLabel` (the words, default `"<Type> name not loaded"`),
`unresolvedReason` (the tooltip — "Okta returned no name" and "this view never asked" are
different facts), `copyIdLabel` (default `"Copy <type> id <id>"`), and `type`, which picks
the glyph. Whether it links is not a prop and should not become one: it follows the id's
navigability, so a chevron appears only where it can be honoured. Sizing is likewise fixed
at `text-xs` on purpose — a resolved and an unresolved reference share one slot in a list,
and letting a caller size one of them was the type-size mismatch I-003 had to fix.

`ListRow` is the **row chrome** primitive (ADR-0029): border, radius, hover,
`density` (`compact` | `comfortable`), `state` (`default` | `selected` |
`highlighted`) and `as` (`div` | `li` | `a` | `button`). It owns the box and
never the interior — the interior follows the typography contract in
`docs/design-system.md`. Never hand-roll a row container. Prefer
`StretchedButton` over `as="button"` when the row holds its own controls, since
a button cannot legally contain a checkbox or another button.

`StableWidth` holds a slot open at the width of its widest state, so a readout that
changes after mount cannot re-lay-out the text beside it. It is the mechanical half of
ADR-0044's layout-stability convention (`D-053`): a chip whose label swaps, a badge that
lands with a fetch, a button label that runs through three lengths, each sitting beside a
`min-w-0` column free to absorb the difference. Pass the widest state as `reserve` — it
renders invisibly in the same grid cell, so the browser measures it in the reader's own
font rather than trusting a hard-coded `min-w-[...]`. The twin is `aria-hidden` and carries
`data-reserve-width`, which both test setups add to Testing Library's `defaultIgnore`, so
a text query never sees it. It reserves the **box**; a numeric readout still needs
`tabular-nums` to stop its own digits twitching inside it — the two are used together.

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

The **`rail`** variant is what `TabNavigation` uses for the panel's top-level
sections — `RAIL_TAB_DEFS`, which is **seven** of the nine in `TAB_DEFS`.
Explorer and History carry `railHidden` and are reached through the ⌘K palette
instead (ADR-0063); the rail is the only consumer that reads the shorter list.
On a rail-hidden section no tab matches `activeKey`, so the strip shows no
selection and no indicator, and the roving anchor falls back to the first tab
so the tablist keeps its one tab stop. Inactive tabs are icon-only (`TabItem.icon`, an `IconType`);
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

The rail's interaction states are read from Odyssey rather than invented. Active
is `Tabs`' marking — a 2px `--color-primary` underline plus a
`--color-primary-text` (`TypographyColorAction`) label at `font-semibold`
(`TypographyWeightBodyBold`, 600) — and never a filled block, which is `SideNav`'s
pattern and belongs to a vertical rail. The `--color-neutral-50` hover wash and
the **inset** focus ring (`box-shadow: inset 0 0 0 2px` with `outline: none`,
Odyssey's `theme.mixins.insetFocusRing`) are `SideNav`'s, and are identical across
both Odyssey navigations. Note the rail's focus recipe is deliberately _not_ the
outset `ring-2` the `underline` and `segmented` variants use — which is why the
weight and focus classes live per-variant rather than in `Tabs`' shared base.

The underline slide and the label unfurl are **sequenced, not simultaneous**. The
labels' `grid-template-columns` transition carries a `--dur-move` delay, so the
strip is held still for one `--dur-move` window while the underline travels on
`--ease-glide`; only then do the outgoing and incoming labels cross over, and
across that second window the indicator has no transition at all and is measured
per frame. `useTabRail`'s `sliding` flag is the line between the two phases. This
amends ADR-0028, which forbade transitioning the indicator outright — the reason
it gave (an indicator chasing a growing label) is exactly what the sequence
removes.

The rail carries **no border of its own**, and neither does `ContextBar`: they are
bands of one top-chrome slab, and the single rule that closes that slab lives on
`TabNavigation`'s `<nav>` — the last band, so the edge sits where the slab meets the
content. Neither band is sticky: the whole slab sits **outside** the panel's scroller
(ADR-0050), so it holds still without needing to, and the scrollbar spans the content
region only. `ContextBar` is one line for the same reason — a band that never scrolls
away spends its height permanently.
Separation inside the slab is spacing and type weight. The `underline` variant
keeps its `border-b` — there the rule is the indicator's own track.

`Tooltip` is the **hover- and focus-triggered label chip**, and the reason no new
code should reach for a native `title=`: `title` cannot be styled, fires on an
uncontrollable delay, and never appears for a keyboard user at all. It opens on
hover **and** on focus after `--dur-hover-intent` (400ms, mirrored in JS as
`HOVER_INTENT_MS` the way `useCountUp` mirrors `--dur-tell`), carries
`role="tooltip"` wired to its trigger with `aria-describedby`, closes on Escape,
blur, pointer-leave or any scroll that would move the trigger, and traps no focus.

A tooltip **describes; it does not name.** An icon-only control still needs its own
`aria-label` — the rail's tabs keep theirs, and the chip is additive on top. It also
renders **no wrapper element**: the trigger comes from a render prop and the chip is
portalled to `document.body`, which is what lets it sit inside a `role="tablist"`
(an intervening `<span>` fails axe's `aria-required-children`) and inside a scroll
container that would otherwise clip it.

```tsx
<Tooltip label="Groups">
  {(trigger) => (
    <button type="button" aria-label="Groups" {...trigger}>
      <Icon type="users" />
    </button>
  )}
</Tooltip>
```

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
`userIdentity.ts`, `ruleIdentity.ts`) plus a unit test, with no edit to anything shared. `PageHeader`
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

**No page calls `<ActionBar>` directly — it wraps it in its own
`<Entity>ActionBar`** (`UserActionBar` is the reference shape), even for a single
action; the wrapper is where the page's second verb goes, and retrofitting one onto
an inline call site later means finding and migrating it. The wrapper decides where
each verb starts with one question, not by feel: reversible or read-only defaults to
the row (`flex`, or `pinned` for the page's one primary verb); a change to the
entity's state with **no symmetric undo** — suspend, delete, deactivate — defaults
to `tier`, behind a confirm `Modal` that states the consequence in plain language
next to the control ("Blocks sign-in until reversed," not just "Suspend").
A **list** rung reads the same rules with two additions (ADR-0051, ADR-0061). The tier
may sort by **frequency** as well as consequence, though frequency may move a verb down,
never up, and never brings a confirm `Modal` with it. And `primary` is spent on whichever
of these the rung has:

- **A page-level verb, if there is one** — one whose object is the whole page rather
  than a selection. `RulesListActionBar`'s _Load rules_ / _Refresh_ is the reference:
  rules do not load on mount, so nothing on that rung means anything until it is pressed.
- **Nothing, if there isn't** — `GroupsListActionBar` has only selection-scoped peers, so
  it has no `primary`.

**The open inline panel is named in its label, not in a colour**: `Duplicates (3)` →
`Hide duplicates`, plus an explicit `priority: 'pinned'` so the control that closes an
open panel can never overflow behind **More**. An `ActionDescriptor` carries no
`aria-pressed`, so a `primary` wash was state only a sighted reader could perceive — the
same correction `RuleCard` already made to its status dot. Pinning and emphasis are
requested separately now rather than both arriving with `variant`.

Two traps that rung found the hard way. **A wizard in front of a verb does not move that
verb into the row** — the test asks what the verb does, not what stands between the press
and the doing. And where the set of verbs **varies with state**, the leading position must
hold a control whose worst outcome is another click: a strip ordered purely by weight puts
a different control under the same pixel as the state changes, which is how
`GroupsListActionBar` briefly shipped _Merge_ where _Select all_ had been.
**An `ActionDescriptor` is never declared for a handler that isn't wired yet** — an
unimplemented verb is omitted, the same "absent is not zero" discipline ADR-0032
applies to identity facts, not rendered `disabled` forever with a tooltip standing
in for an explanation. A permission-gated verb may still render `disabled` with a
`title` naming the real reason. See ADR-0039 for the incident this closes.

A detail rung may also end up with **no `primary` at all**, and that is a result rather
than an omission: `RuleActionBar`'s one row verb is _Preview impact_, which is dropped
entirely for a rule that targets no groups — no population to compute a change for, so
no verb (ADR-0051 §3). Nothing is promoted to fill the empty slot. Say the missing fact
in prose where the reader is looking instead; `RuleDetailView` states "assigns to no
groups, so it adds nobody anywhere" in the section the verb would have acted on.

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

**One question, one load, three short sections: use the stack.** The threshold is real in
both directions — `RuleDetailView` is a `DetailSection` stack because a rule has one
condition and three facts about it, all already on the `FormattedRule` the list was
rendering. Splitting four short sections across tabs would hide three of them to save a
scroll that does not exist, and the rung fetches nothing, so there is no per-pane load to
gate. It is also the rung that closes ADR-0030's last unconverted layout dialect: `RuleCard`'s
expandable body, whose four write verbs flex-wrapped at the bottom of a card were the exact
"page-level verb read as a section's property" failure ADR-0030 §2 exists to stop.

## Documented raw-control exceptions

The button/input migration is complete; these are the raw controls that stay raw
**by decision**, each carrying an inline `§3 exception` (or `CHARACTERIZED:`)
comment at the call site:

- **Composites** where a shared primitive is not pixel-neutral: the Add-to-Group
  type-ahead (`AddToGroupModal`) and `UserComparisonModal`'s search field in
  `ComparisonSearchPhase` — leading-glyph search inputs with an absolutely
  positioned spinner/dropdown — plus `shared/FilterToggle`.

  `SearchDropdown`, `UserSearchBar` and `GroupSearchBar` **left this list**: they
  now compose `Input` + `Icon` + `LoadingSpinner` like `MemberSearchBar`. The
  exception was real — converging on the primitives cost a few pixels of field
  height (`py-3`/`py-2.5` → `py-2`), leading-icon size (20px → 16px), and the
  reserved trailing padding the shared `Input` has no slot for. That was accepted
  as the price of not maintaining a byte-identical copy of the input class string
  in two files. The two entries that remain are the ones where the delta is larger
  than that, and they still need a design call rather than a mechanical swap.

- **Roving-focus rows:** `palette/PaletteRow`, the row the ⌘K palette renders for
  both its sections and its entity results. A palette row is a left-aligned icon +
  label + trailing-mark row carrying a roving `tabIndex` and a ref for
  programmatic focus, and **neither** shared primitive can host that: `Button` is
  a centred CTA and exposes neither `tabIndex` nor a ref, and `ListRow` exposes
  `elementRef` — half of what is needed — but no `tabIndex` and no `onKeyDown`, so
  it can carry neither the roving anchor nor the Up/Down handler. The gap is
  structural rather than stylistic against both, so a new variant would not
  discharge it. The row renders as an `<a>` rather than a `<button>` when it is
  given an `href` — a kind this build cannot open in-panel has the Okta console
  as its only route, and a link nested inside the row button is a
  `nested-interactive` axe violation (`home/JumpResultRow` makes the same call
  with `as`). One interactive element per row, chosen by what the row can do.
  (The same file records why the palette uses
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
- **Prefer a bare `memo(...)` over a hand-written comparator.** Rows (`RuleCard`,
  `PolicyCard`, `GroupListItem`) are memoised with the default shallow compare, not a
  custom field list — a hand-written comparator drifts the moment the row renders a
  field it forgot to compare, which is a stale-UI bug, not a perf nit (`D-039`,
  `D-045`). It works because each row's entity prop keeps stable per-id identity from
  its list source; only add a custom comparator back with a measured reason, and keep
  it enumerated against the render body if you do.
