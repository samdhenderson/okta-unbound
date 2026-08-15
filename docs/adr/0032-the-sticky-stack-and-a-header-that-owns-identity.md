# ADR-0032: The sticky stack, and a header that owns entity identity

- Status: Accepted
- Date: 2026-08-15
- Amends: ADR-0030 (its identity-header section, and its deferral of a pinned title)
- Relates to: ADR-0018 (every tab stays mounted), ADR-0027 (motion tokens),
  ADR-0029 (a shared primitive owns chrome, never the interior), ADR-0002
  (`danger`, never `error`)

## Context

A group was named three times on one screen. `ContextBar` showed the live Okta page's
entity name and copyable id; `PageHeader` showed the title and a type badge; and the first
thing in the detail body was an identity card showing the name, the type badge, the
description and the Okta link again. In a 360px panel that spent three of the first four
visible lines before any content.

The duplication was already visible as a workaround in the code. `UserIdentity` carried
three `show*` booleans whose only purpose was to suppress it — `showName={false}` from
`UserDetailPanel` because the header already named the user, `showId={false}` from
`UserOverview` because the context bar already showed the id. Props that exist to hide a
component from itself are a layout problem wearing an API.

The same duplication had produced **four badge palettes** for one vocabulary:
`PageHeader`'s local map (still keyed on `error`, contra ADR-0002), `GroupIdentitySection`'s
`typeBadges`, `UserIdentity`'s `VARIANT_CLASSES` (built on raw Tailwind hues rather than
tokens), and `GroupsTab`'s `groupTypeBadgeVariant` — while the shared `Badge` primitive
landed by ADR-0030 had one consumer.

ADR-0030 also left a note: pinning the page title as well as the action strip "would mean
`PageHeader` and this strip sharing one sticky container; that is deliberately deferred
rather than solved with a magic offset." Meanwhile the rail and the action strip were
_both_ `sticky top-0` in the one shared scroller, and the rail's `z-40` beat the strip's
`z-10` — so a pinned action strip was already rendering underneath the rail.

## Decision

**The header is the single place the entity you are browsing is described, and the three
bands that compete for the top of the scroller publish their heights to each other.**

### 1. Two bars, two subjects

`ContextBar` and `PageHeader` are not redundant and must not converge.

|              | `ContextBar` (above the rail)                                    | `PageHeader` (below the rail)          |
| ------------ | ---------------------------------------------------------------- | -------------------------------------- |
| Subject      | the live Okta tab this panel is bound to                         | whatever you are browsing in the panel |
| Source       | `useOktaTabContext` / `useOktaPageContext`, or the pinned entity | the tab's `useViewStack` current entry |
| Changes when | the Okta tab navigates, or you pin/unpin                         | you drill in, pop, or switch tabs      |

The header therefore **never** falls back to the context entity: a list rung says "Groups",
not the name of whatever group the browser happens to be on. The context bar **never**
follows in-panel navigation. The two showing the same name is a coincidence — you drilled
into the group you were already looking at — not duplication to remove.

### 2. Three layers, so the shared header stays chrome

```
groupIdentity(group)  →  EntityIdentityDescriptor  →  <EntityIdentity/>  →  PageHeader
  pure function            plain data                  shared renderer       chrome only
```

`PageHeader` takes `identity` as an opaque `ReactNode` plus an `identityKey`, and never
learns what a group or a user is — ADR-0029's rule, unchanged. `EntityIdentity` renders the
descriptor's metadata lines from `Badge` and the other shared primitives. The per-entity
builders are **pure functions living beside their entity**, so the badge choice, the
pluralisation and the empty-state fallbacks are unit-tested without rendering anything.

Adding an entity kind is one new pure function and one test, with no edit to anything
shared. A per-kind registry inside `PageHeader` was considered and rejected: it buys the
same terse call sites at the price of making one shared component know every entity shape
in the app.

`badge` and `link` live on the descriptor even though the _tab_ spreads them onto
`PageHeader`'s existing `title` / `badge` / `actions` props. That keeps the title row's API
unchanged for the five call sites not migrating, while still leaving the builder as the
single place those decisions are made — and it is what keeps the name, the badge and the
Okta link on screen when the region is collapsed.

The badge renders in the **trailing cluster**, immediately left of `actions`, not beside
the `<h1>`. At 360px a badge next to the title pushes a long entity name onto a second and
third line before the region below it has said anything; moved right, the title gets the
width and the two trailing marks read as one group. This applies to every header, not only
the migrated ones.

### 2a. Absent is not zero

A builder **omits** a fact it cannot answer rather than emitting a zero. Okta reports a
group's `usedInRuleCount` only once the rules payload has loaded — and `ruleCount` reads
`0` in that same window — so neither renders until it is positive. A user's
`managedBy.rules` is absent until the membership analysis has run. An empty row is dropped
entirely, so the region shrinks to what is actually known instead of asserting "0
references" about a question the panel never asked.

`memberCount` is the deliberate asymmetry: the list payload always carries it, so
`0 members` is a real answer. The rule of thumb is whether zero and unknown are
distinguishable at that field's source. `lastLogin` is the same test read the other way —
`null` means never signed in and is stated, `undefined` means the payload did not carry it
and is omitted.

### 3. The sticky stack replaces the magic offset

Each band measures itself and publishes its height as a CSS custom property; the band below
consumes it in its own `top`. One owner per variable, every value measured.

| Band            | Position                              | Publishes                       | Consumes                                        |
| --------------- | ------------------------------------- | ------------------------------- | ----------------------------------------------- |
| `TabNavigation` | `sticky top-0 z-40`                   | `--rail-h` on the document root | —                                               |
| `PageHeader`    | `sticky top-[var(--rail-h,0px)] z-20` | `--header-h` on its `TabPanel`  | `--rail-h`                                      |
| `ActionBar`     | `sticky z-10`                         | —                               | `calc(var(--rail-h,0px) + var(--header-h,0px))` |

This is what ADR-0030 declined, but not in the form it declined it. A hard-coded offset
rots the moment a band's padding or wrapping changes; a measured one cannot. Both variables
default to `0px`, so a story — or any surface without those bands — behaves exactly as
before. It also fixes the rail/strip overlap described above.

**`--header-h` is scoped to the `TabPanel`, not the document root.** Every tab stays mounted
(ADR-0018), so all seven headers exist at once and a root-scoped variable would be
overwritten by whichever _hidden_ tab measured last. `TabPanel` carries
`data-header-scope`; `PageHeader` publishes to `closest('[data-header-scope]')`.

For the same reason, `sticky` is passed the tab's `isActive` rather than a bare `true`: a
hidden panel is `display: none`, so its sentinel never intersects and it would otherwise
report a permanently pinned header and publish a stale height.

"Is it pinned?" is answered by a zero-height sentinel in normal flow immediately above the
header, watched by an `IntersectionObserver` whose `rootMargin` comes from the header's own
resolved `top`. No scroll listener, nothing per frame, and no component needs a reference
to the shared scroller — or any knowledge that the rail is what it parks below.

### 4. Only the region crossfades

On an `identityKey` change the identity region fades out over `--dur-quick` while collapsing
to `0fr` over `--dur-move`, swaps, then expands and fades back in. The `<h1>`, its badge and
the breadcrumbs update **synchronously**.

Two reasons. Visually, the title is the anchor the panel is read against, so it should be
the last thing to flicker. Structurally, holding an outgoing headline on screen while the
incoming one mounts would put two `<h1>`s in the tree mid-transition — which
`GroupsTab.navigation` and `UsersTab.navigation` assert can never happen.

An **unchanged** key with new content swaps silently: that is the same entity's data
refreshing (a member count landing, a status changing), and animating it would report
navigation that did not happen.

## Consequences

- `GroupIdentitySection` is deleted. `UserIdentity` becomes `UserIdentityCard`, kept only
  because `UserOverview` still renders a full identity card and the Overview tab has no
  `PageHeader` to move it into. Its `showName` prop goes.
- The group description moves to `GroupMetadataSection`, retitled **About**. It is not in
  the header's field set and nothing else rendered it, so without this it would vanish from
  the app.
- `PageHeader`'s badge renders through shared `Badge`, retiring the last palette keyed on
  `error` (ADR-0002). No call site passed `error`.
- **`shared/CopyableId`** is the new home for the inline id recipe — a truncating `<code>`
  beside a ghost `IconButton` that flips to a confirmation. It was hand-rolled identically
  in `ContextBar` and the user identity card, both of which also pinned the glyph to
  `w-3.5 h-3.5` and the text to `text-[11px]`, arbitrary values the identifier contract and
  `Icon`'s own scale already answer. Both now use it, and so does the header's `id` fact.
  It is distinct from `CopyButton`, which is a labelled button for copying a _body_ of text.
- The header carries the entity id even though `ContextBar` also shows one. They are not
  the same id: the context bar's belongs to the live Okta tab, the header's to what you are
  browsing, and on a drilled-in view those routinely differ.
- `Icon` gains `clock` for the timestamp facts. Identity facts use registry glyphs, never
  emoji.
- Three of the four badge palettes are gone; the fourth (`UserIdentityCard`'s) goes when
  the Overview tab gains a header.
- `SWAP_MS` in `PageHeader` is a hand-kept mirror of `--dur-move`, in the same arrangement
  as `Modal`'s `EXIT_MS` and `useCountUp`'s `COUNT_UP_MS`. There is no lint gate.
- The sticky stack cannot be verified in jsdom or in a story — neither has a scroller. It is
  a manual check in the loaded extension, listed in `docs/ux-guidelines.md`.
- Overview, Apps, Policies, Rules and Export keep their static headers. Every new prop is
  optional and a header given none of them renders exactly the markup it did before.
