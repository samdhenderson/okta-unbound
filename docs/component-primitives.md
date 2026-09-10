# Component primitives

Per-primitive contracts: the props, modes and capabilities of the primitives whose shape is not
obvious from their name. Read the one you are about to use. Which primitive to reach for, the hard
rules, the catalog and the raw-control exceptions are in [components.md](./components.md).

## `EntityLink`

The **one** way to reference another entity — "that rule / that group / that user / that app" — with
three modes, picked by which of `name` and `id` you pass. Never hand-roll any of them:

| You have         | Pass          | You get                                                                                                                         |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| a name and an id | `name` + `id` | a chip with the type glyph and a chevron that opens the entity on its own tab                                                   |
| a name, no id    | `name` only   | plain text with a tooltip saying why it cannot be opened — a link is never a control that does nothing                          |
| an id, no name   | `id` only     | the missing name **stated** in the non-answer register, the raw id beside it via `CopyableId`, and the entity still opens by id |

The id-only mode is the shared home for "this reference is known only by an id" (`I-017`) — a valid
id is a valid destination whether or not the view learned a name. **Never pass the id in as the
`name`**: an id in a name's slot is indistinguishable from a group actually called `00gFAKE…`
(`I-003`). Its chrome follows the house non-answer convention ([components.md](./components.md)).

Four props parameterise the unresolved state, all with sane defaults so no caller passes Tailwind to
make it fit: `unresolvedLabel` (the words, default `"<Type> name not loaded"`), `unresolvedReason`
(the tooltip — "Okta returned no name" and "this view never asked" are different facts),
`copyIdLabel` (default `"Copy <type> id <id>"`), and `type`, which picks the glyph. Whether it links
is not a prop: it follows the id's navigability, so a chevron appears only where it can be honoured.
Sizing is fixed at `text-xs` on purpose — a resolved and an unresolved reference share one slot in a
list.

## `RuleExpressionText`

The **one** way to print a rule's condition text. It renders the expression in mono and swaps each
quoted literal the caller can name for an `EntityLink` group chip, so
`isMemberOfAnyGroup("00gFAKE1")` reads as the group instead of an opaque id. It **resolves nothing
it was not already given** — the caller passes a `resolveGroupName` (the `GroupNameResolver` shape
`ClauseGroupList` takes), there is no fetch, and an id with no known name keeps its raw quoted form
rather than becoming a half-labelled badge. It never guesses which literal is a group id: it offers
every literal to the resolver and badges only what comes back named, which is why
`user.department == "Engineering"` prints as itself.

| Prop               | Default      | What it does                                                                                                                      |
| ------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `text`             | — (required) | the condition text; **untrusted**, rendered escaped and never logged                                                              |
| `resolveGroupName` | `undefined`  | names group ids in the text; omitted, the whole expression prints verbatim                                                        |
| `tone`             | `'default'`  | `'default'` (`neutral-900`) for the condition in question, `'subdued'` (`neutral-700`) for one printed under another it qualifies |
| `className`        | `''`         | **layout and spacing only** — `min-w-0`, `flex-1`, a margin                                                                       |

The type treatment — `block font-mono text-xs break-words whitespace-pre-wrap` — is **fixed and not
a prop**; a size prop would reintroduce the resolved-vs-unresolved type-size mismatch `I-003` fixed
on `EntityLink`. Colour is the one axis that genuinely varied — a clause versus the alternatives
nested under it — so it is a two-value `tone` and not a colour. The badge's `copyIdLabel` names the
_id_, not the group, because two groups in one condition can share a display name (`I-009`).

## `EntityChooser`

`EntityChooser` (`components/home/`) is the **scope-first launcher**: pick one entity out of a list
already in memory and hand its id back. It exists for actions a surface cannot afford to run for
everybody — Home's MFA-coverage row is a factor read per member, so the honest shape is not a number
with a list behind it but a chooser that names the group first and lands where the scan can be
started deliberately (`I-019`). It **filters; it never searches.**

Everything offered arrives through `choices`, and typing narrows that array locally. A chooser that
queried Okta per keystroke would spend requests to avoid spending requests. Its visible cap is
stated on screen whenever it truncates, the same rule the reports card applies to a capped finding
list: a list quietly cut to its first page reads as "your group is not in this org".

| Prop          | Default                   | What it does                                                                                                          |
| ------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `choices`     | — (required)              | every offerable `{ id, name, detail? }`, already in memory; **untrusted** names, rendered escaped                     |
| `filterLabel` | — (required)              | accessible name _and_ placeholder of the filter field ("Filter groups")                                               |
| `actionLabel` | — (required)              | accessible name of each row's press target — the **verb**, since the name is already announced via `aria-describedby` |
| `onChoose`    | — (required)              | called with the chosen id; the caller decides where that goes                                                         |
| `emptyLabel`  | `'Nothing matches that.'` | what to say when the filter matches nothing                                                                           |

What it **refuses**: no `onFilterChange` or async source (the caller passes its 20k rows and pays
nothing, but this component never fetches them); no `renderRow`, `className` or `variant`, because
the row treatment is shared with the reports card's finding lists through `EntityChoiceRow` and a
styling hatch is how those two drift apart; no `multiple`/selection state, because pressing a row is
a one-shot hand-off with nothing to accumulate and nothing to confirm; and no fuzzy matching, since
an admin filtering by name is recalling a name they already know and a fuzzy match only buries the
exact hit.

## `Tabs`

The accessible tab-bar primitive (`role="tablist"/"tab"`, roving `tabindex`, arrow-key nav) with
two variants: `underline` (section nav, the default) and `rail` (icon-first primary nav). A third,
`segmented` — a pill in a grey tray — was **retired**: its three callers were all picking one of N
views, which is what `underline` is for, and keeping a second look for the same job only invited
strips that matched neither neighbour. **Never hand-roll a `role="tablist"`**: the ARIA attributes are the part that gets
copied and the keyboard handling is the part that gets left behind — which is what
`ComparisonTabBar` shipped, a strip a keyboard user could reach and then not move inside.

Two additive capabilities keep a caller from forking it for styling, each a property of a tab
rather than of one surface:

| Capability             | What it is                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `TabItem.icon`         | a glyph before the label, in **every** variant; only `rail` collapses the tab to it. Decorative outside `rail` — the visible label is the name |
| `TabItem.countDisplay` | `always` (default) badges a `0`, right for a count that states a **size**; `nonzero` suppresses it, for one that states a **finding**          |

`countDisplay: 'nonzero'` also holds the badge's slot open at two digits from first render
(`StableWidth`), because such a count arrives with a fetch: three badges landing at once would
otherwise shove three labels sideways in one frame (`D-053e`). A strip too wide for its panel
**scrolls**; it never wraps to a second row and never truncates a label. Where a strip has to fit,
spend its glyphs and its badges rather than its labels, and measure — a 360px side panel gives a
strip 328px of track, and the user-comparison bar's four tabs went 489px with both, 401px without
the glyphs, and 292px as bare labels. A tab that gives up a count is not giving up the fact: that
strip's tabs each state their own difference count in the body, beside the items being counted.

The **`rail`** variant is what `TabNavigation` uses for the panel's top-level sections; which
sections it draws, what it shows when you stand on one it does not, and how its indicator is
sequenced are in [page-shell.md](./page-shell.md). The active tab's label unfurls via
`grid-template-columns: 0fr → 1fr` at `--dur-move`, so the strip never toggles `display` to make
room. What still overflows scrolls, scrollbar hidden, with `mask-image` edge fades keyed off a
`data-overflow` attribute. Every rail tab's `aria-label` is derived from its own `label` inside
`Tabs` — never passed separately — so an icon-only tab always has an accessible name that cannot
drift from the visible one. (A rail tab's `count` badge is therefore _not_ in its accessible name;
read the JSDoc on `TabItem.label` before adding counts to the rail.) The measurement behind the edge
state, the scroll-active-into-view and the sliding indicator lives in `hooks/useTabRail.ts`.

The rail's interaction states are read from Odyssey rather than invented. Active is `Tabs`' marking
— a 2px `--color-primary` underline plus a `--color-primary-text` (`TypographyColorAction`) label at
`font-semibold` (`TypographyWeightBodyBold`, 600) — never a filled block, which is `SideNav`'s
pattern and belongs to a vertical rail. The `--color-neutral-50` hover wash and the **inset** focus
ring (`box-shadow: inset 0 0 0 2px` with `outline: none`, Odyssey's `theme.mixins.insetFocusRing`)
are `SideNav`'s, identical across both Odyssey navigations, and deliberately _not_ the outset
`ring-2` that `underline` uses — which is why weight and focus classes live per-variant, not in
`Tabs`' shared base. The `underline` variant keeps its `border-b`: there the
rule is the indicator's own track.

## `Tooltip`

The **hover- and focus-triggered label chip**, and the reason no new code should reach for a native
`title=`: `title` cannot be styled, fires on an uncontrollable delay, and never appears for a
keyboard user at all. It opens on hover **and** on focus after `--dur-hover-intent` (400ms, mirrored
in JS as `HOVER_INTENT_MS` the way `useCountUp` mirrors `--dur-tell`), carries `role="tooltip"`
wired to its trigger with `aria-describedby`, closes on Escape, blur, pointer-leave or any scroll
that would move the trigger, and traps no focus.

A tooltip **describes; it does not name.** An icon-only control still needs its own `aria-label` —
the rail's tabs keep theirs, and the chip is additive. It renders **no wrapper element**: the
trigger comes from a render prop and the chip is portalled to `document.body`, which is what lets it
sit inside a `role="tablist"` (an intervening `<span>` fails axe's `aria-required-children`) and
inside a scroll container that would otherwise clip it. `children` is that render prop — `(trigger)
=> ReactNode`, spreading `trigger` onto the control you have already given an `aria-label`:

```tsx
<Tooltip label="Groups">
  {(trigger) => (
    <button type="button" aria-label="Groups" {...trigger}>
      <Icon type="users" />
    </button>
  )}
</Tooltip>
```

## `IconButton` and `StretchedButton`

`IconButton` is also the **disclosure** primitive: pass `expanded` + `controls` and it emits
`aria-expanded` / `aria-controls` (as `active` does `aria-pressed`). Any chevron that opens a region
uses it — never a bare `<button>`.

`StretchedButton` makes a **whole card or row activatable**: an empty, absolutely-positioned button
covering its `relative` ancestor, behind the card's own controls (`relative z-10`). It replaces both
bad alternatives — `role="button"` on a `<div>`, and wrapping the card's content in a `<button>`
(invalid content model, and axe `nested-interactive` the moment the card has a checkbox). Prefer it
over `ListRow as="button"` when the row holds its own controls, since a button cannot legally
contain a checkbox or another button. Because every card in a list shares one `label`, pass
`describedBy` pointing at that card's title. First consumer: `GroupListItem`'s row-body drill-in.

When the card **discloses** a region rather than navigating, pass `expanded` and `controls` — the
same disclosure contract, so a card and a chevron announce a collapse identically. Two traps
`AttributeHealthCard` had to solve and the next consumer will too. Scope the overlay to the card's
**header** region (`ListRow`'s `headerClassName`), or the button covers the body it just opened and
a click inside collapses the card. And give the button a `label` naming its subject — a grid of
cards otherwise offers a screen-reader user a list of identically-named controls, and `describedBy`
does not fix that, because a description is not a name.

## `StableWidth`

Holds a slot open at its widest state: pass that state as `reserve` and it renders invisibly in the
same grid cell, so the browser measures it in the reader's own font, not a hard-coded
`min-w-[...]`. The twin is
`aria-hidden` and carries `data-reserve-width`, which both test setups add to Testing Library's
`defaultIgnore`, so a text query never sees it. It reserves the **box** only; a numeric readout
still needs `tabular-nums` to stop its digits twitching inside it.

## `Breadcrumbs` and `PageHeader`

`Breadcrumbs` is the trail primitive for **in-tab push/pop sub-navigation** (`nav > ol`, ancestor
crumbs are buttons, the last carries `aria-current="page"`). It shapes to the `trail` from
`hooks/useViewStack.ts` and drops into `PageHeader`'s additive `breadcrumbs` slot beside its
`onBack` / `leading` slot — see [page-shell.md](./page-shell.md) for how one header serves a whole
stack of views.

`PageHeader` takes the browsed entity's description as `identity` (an opaque node, normally an
`EntityIdentity`) plus `identityKey` (the entity's id — a change crossfades the region, no change
swaps silently). The descriptor comes from a **pure per-entity builder** returning an
`EntityIdentityDescriptor` — `groupIdentity(detailGroup)` — whose `name`, `badge`, `key` and `rows`
feed `title` (falling back to the list's own title), `badge` (falling back to the list badge),
`identityKey` and `identity={<EntityIdentity rows={…} />}`.

`badge` renders in the trailing cluster, immediately left of `actions` — at 360px a badge beside the
`<h1>` costs the title two lines of wrapping.

A descriptor's `rows` group facts by category (identity, counts, timestamps); facts inside a row
wrap together and an empty row is dropped. **A builder omits a fact it cannot answer rather than
emitting a zero** — a group's rule counts are absent until the rules payload loads, and
"0 references" would state as fact something the panel never asked. `memberCount` is the exception,
because zero and unknown are distinguishable at its source. Adding an entity kind is one new builder
beside that entity (`groupIdentity.ts`, `userIdentity.ts`, `ruleIdentity.ts`) plus a unit test, with
no edit to anything shared.
