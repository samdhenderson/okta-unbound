# ADR-0030: One layout contract for detail pages, and where an action is allowed to live

- Status: Accepted (amended by ADR-0032)
- Date: 2026-08-14
- Relates to: [ADR-0002](./0002-status-vocabulary-danger.md),
  [ADR-0016](./0016-in-tab-view-stack-navigation.md),
  [ADR-0029](./0029-list-row-primitive.md), `docs/design-system.md`

## Context

Every tab lets a reader drill into a list item, and every drill-in was built
separately. An inventory of the detail surfaces found **five layout dialects** for
what is conceptually one thing:

| Surface                      | Section idiom                            | Eyebrow                   |
| ---------------------------- | ---------------------------------------- | ------------------------- |
| `groups/detail/*`            | `DetailSection` white cards              | `tracking-wide`           |
| `RuleCard`                   | eyebrow blocks on `bg-neutral-50`        | `tracking-wider`          |
| `policies/PolicyCard`        | eyebrow block on `bg-neutral-50`         | `tracking-wider`          |
| `apps/AppListItem`           | 2-column grid of grey field tiles        | —                         |
| `users/GroupMembershipsList` | hand-rolled row cards                    | `text-sm`, not an eyebrow |
| `AuditLogViewer`             | bare `<div onClick>`, inline SVG chevron | —                         |

The divergence was not only cosmetic. Three concrete failures traced back to
having no contract:

1. **A badge that rendered as nothing.** `GroupMembershipsList` emitted
   `badge badge-info` / `badge-success` / `badge-muted` — class names whose CSS was
   dropped in the Tailwind v4 migration and never replaced. Eighteen files
   hand-rolled the badge recipe; only a primitive makes that class of rot
   impossible.
2. **The page's main verb read as a section's property.** "Compare" — an action on
   the whole user — lived in the group-memberships card header, in the same slot as
   "Add to group", which acts on that card alone. There was no page-level place to
   put it, so it went where there was room.
3. **A cross-reference that could not be clicked.** `RuleCard` renders its target
   groups as pills visually identical to the neighbouring _attribute_ pills. They
   are inert, because threading a navigation callback that far down was more work
   than the pill was worth — even though `App` had held
   `handleNavigateToRule`/`Group`/`User` the whole time and the receiving tabs
   already consumed them.

A sixth surface, the History tab's row, is a `<div onClick>` with no `role`, no
`tabIndex` and no `aria-expanded` — not reachable by keyboard at all.

## Decision

**A detail page is: an identity header, then a sticky `ActionBar`, then a stack of
`DetailSection` cards.** Four shared primitives carry it, and one rule decides
where an action goes.

> **Amended by [ADR-0032](./0032-the-sticky-stack-and-a-header-that-owns-identity.md).**
> The identity header is no longer a card at the top of the _body_ — the tab's one
> `PageHeader` describes the entity, and the body opens on its first real section.

### 1. The primitives

- **`shared/DetailSection`** — promoted out of `groups/detail/`, where it already
  was the only section primitive in the codebase. Its `tracking-wide` eyebrow is
  the survivor of the `tracking-wide`/`tracking-wider` split; `docs/design-system.md`
  already named that the section-header pattern.
- **`shared/ActionBar`** — the page-level action strip, `sticky top-0`.
- **`shared/Badge`** — the single home for the badge recipe. Variants are the
  shared status vocabulary (`danger`, never `error` — ADR-0002) plus `neutral` and
  `primary`, deliberately a superset of `UserStatusVariant` so
  `userStatusVariant(status)` needs no mapping layer.
- **`shared/EntityLink`** — a typed chip for every cross-entity reference.

### 2. Where an action lives

> **A verb whose object is the whole page goes in `ActionBar`. A verb scoped to one
> section's data goes in that section's `DetailSection.actions` slot.**

This is not a matter of taste. A page-level slot has no view of whether a given
section's data is loaded, so an "Add member" button in the header would let a
reader mutate a list that is still behind its analyze gate. The slot that owns the
data is the slot that owns its verbs.

### 3. Why `ActionBar` can be sticky

The side panel has exactly **one** scroller: the `overflow-y-auto` app root in
`App`. `TabPanel` shares it, and the Users tab explicitly does not shadow it with a
scroll box of its own. No intermediate wrapper sets `overflow`, so `sticky top-0`
pins against that root.

`PageHeader` lives in the same scroller and therefore scrolls away above the strip.
The strip consequently carries an opaque background and its own border — once
pinned it is the only chrome on screen and must not let rows show through it.
Keeping the page title pinned too would require `PageHeader` and `ActionBar` to
share one sticky container; that is deliberately deferred rather than solved with a
magic offset.

> **Amended by [ADR-0032](./0032-the-sticky-stack-and-a-header-that-owns-identity.md).**
> The deferral is resolved, but not by a shared container or a magic offset: each band
> publishes its measured height as a CSS custom property and the band below consumes it.
> `ActionBar` now parks at `calc(var(--rail-h,0px) + var(--header-h,0px))`, which also fixes
> a pre-existing overlap — the strip and the rail were both `sticky top-0` in one scroller,
> and the rail's `z-40` beat the strip's `z-10`.

### 4. Cross-entity navigation is a context, not a prop

`contexts/NavigationContext` publishes `navigateTo({type, id})`, backed by the
handlers `App` already owned. Prop-drilling was the reason Apps and Policies
received no navigation at all and `RuleCard`'s chips stayed inert; a context makes
the cost of linking zero at any depth.

**Absence is a first-class answer.** `useEntityNavigation` never throws without a
provider, and a provider may omit a handler for a kind it cannot reach yet. Both
surface through `canNavigateTo`, which is what lets `EntityLink` degrade to plain
text. That matters beyond convenience, because three references in this app
genuinely have no navigable target and inventing one would render a guess as a
fact:

- a rule condition's `isMemberOfGroupName("sales")` — one name can match an Okta
  group _and_ a Workday group _and_ a Salesforce group;
- `PushGroupMapping.targetGroupName` — a group inside the downstream app, which is
  not an Okta entity;
- `profile.manager` without an accompanying `managerId`.

"Not linkable" therefore has to be an expressible state, not a bug.

## Consequences

- **Rows inside a detail section still belong to ADR-0029.** `DetailSection` owns
  the card; `ListRow` owns the rows inside it. Neither absorbs the other.
- **`Badge` is a label, never a control.** A badge that needs a click handler is a
  `FilterPill` or a `Button`; a clickable `<span>` is the bug the primitive exists
  to prevent.
- **One `PageHeader` per tab still holds** (ADR-0016). `ActionBar` is a second
  region inside the body, not a second header, and a pushed detail view keeps
  swapping the existing header's contents rather than mounting its own.
- **Migration is one surface per PR**, as with ADR-0029. Users and Groups adopt the
  contract first; Rules, Apps, Policies and History are tracked in
  `docs/features-plan.md` and are not silently left behind.
- **Storybook is the coverage** for the layout itself: ADR-0023 bans `toHaveClass`
  assertions, so each new primitive ships a co-located, axe-clean `.stories.tsx`
  including its 360px-width case, which is where a squeezed or wrapping action strip
  actually shows up.
- The `contexts/NavigationContext` file trips `react-refresh/only-export-components`
  by exporting a provider and a hook together. That is the shape `ProgressContext`
  already established, and the warning is accepted for consistency.
