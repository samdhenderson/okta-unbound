# ADR-0029: A `ListRow` primitive owning row chrome, and two sanctioned separator patterns

- Status: Accepted
- Date: 2026-08-14
- Relates to: [ADR-0010](./0010-component-explorer.md), [ADR-0023](./0023-test-value-policy.md)

## Context

A row in a list is the most repeated visual element in the side panel, and it is
the least consistent. An inventory of every row-shaped component under
`src/sidepanel/components/**` found the same conceptual element rendered with:

**Ten padding values.** `p-2` (`UserOverview`, `AuthPolicyOverview`), `px-2 py-1`
(`ClauseGroupList`), `px-2 py-1.5` (`GroupListItemDetails`), `p-2.5`
(`CopyMembersModal`), `px-2.5 py-1.5` (`CurrentGroupRuleRelations`,
`BreakdownReport`), `px-3 py-2` (eleven components), `px-3 py-2.5`
(`GroupMergeModal`), `p-3` (eight components), `p-4` (`AppListItem`, `RuleCard`,
`PolicyCard`, `GroupMembershipsList`), `p-5` (`UserSearchResults`,
`EntityPicker`).

**Five hover treatments.** `hover:border-neutral-500` (six components),
`hover:border-neutral-300` (`RuleCard`, `PolicyCard`), `hover:border-neutral-400`
(`GroupMergeModal`, `CopyMembersModal`), `hover:border-primary
hover:bg-primary-light` (`RuleLinkRow`, `RuleConsolidationModal`), and
`hover:bg-neutral-50` with no border change (six more). `RuleCard` has both an
outer border hover and an inner background hover, so two fire at once.

**Six primary-line typographies**, including two that differ only in class order,
one with no weight at all, one at `text-xs`, and two — `UserSearchResults`,
`EntityPicker` — with **no size class**, so they render at 16px while every peer
renders at 14px.

**Four separator strategies.** `space-y-3` + per-row border; `divide-y
divide-neutral-100`; `divide-y divide-neutral-200` (a different divide colour for
the same job); and `border-b border-neutral-100 last:border-b-0` — which
`AddToGroupModal` writes as `last:border-0`, the same intent as a different
string.

Two things follow that are worse than the inconsistency itself:

- **Class strings are hand-copied between files.** `GroupPushSection.tsx:47` is a
  verbatim copy of `RuleLinkRow`'s container string. A copy cannot be kept in
  step with its original.
- **Several rows are not keyboard-accessible.** `UserSearchResults`,
  `AuditLogViewer`, `GroupCollections`, `CrossGroupSearch`, and `AppListItem`'s
  row body are `<div onClick>` with no `role`, no `tabIndex`, and no focus ring.
  This is a genuine accessibility defect, and it exists because there was no
  primitive to reach for — `GroupListItem` solved it correctly with
  `StretchedButton`, and nothing carried that solution to its neighbours.

`docs/components.md` already concedes the gap in passing, in the raw-control
exception list: _"no shared card primitive fits"_. That concession is the thing
this ADR removes.

## Decision

### 1. Add `ListRow` to `components/shared/`, owning row chrome only

`ListRow` renders the card: border, radius, background, hover, transition,
padding, state, and the element type. It does **not** render the interior. Each
feature keeps its own children.

That boundary is deliberate. The interiors genuinely differ — `GroupListItem`
carries a checkbox, a `StretchedButton` overlay and a `.disclose` body;
`RuleCard`'s expanded body runs to hundreds of lines; `MemberRow` is three lines
of text and a status pill. A primitive that tried to own those would need a prop
per variation and would be reconfigured, not reused. What is genuinely identical
across all thirty is the box they sit in, and that is exactly what is drifting.

Props follow the house `Record<Variant, string>` convention
(`docs/components.md`):

| Prop      | Values                                                                  | Replaces                    |
| --------- | ----------------------------------------------------------------------- | --------------------------- |
| `variant` | `card`, `nested`                                                        | two conflated idioms        |
| `density` | `tight` (`px-2 py-1.5`), `compact` (`px-3 py-2`), `comfortable` (`p-4`) | the ten padding values      |
| `state`   | `default`, `selected`, `highlighted`                                    | four selected-state recipes |
| `flash`   | boolean → `animate-affirm-flash`                                        | three hand-rolled copies    |
| `as`      | `div`, `li`, `a`, `button`                                              | the `<div onClick>` rows    |

Fixed and **not** configurable: `rounded-md border border-neutral-200 bg-white`,
`hover:border-neutral-500`, `transition-colors duration-(--dur-instant)`, and the
focus ring when interactive. A row that wants a different hover colour is the
problem this ADR exists to solve; it does not get a prop.

**Hover applies to interactive, `default` rows only.** Two gates, for two
different reasons.

_Interactive_, because hover is feedback for an affordance: on a row you cannot
activate it promises something that is not there. The first cut applied hover to
every row and handed a hover border to static lists that never had one —
`GroupPushSection`, `GroupCleanupPanel`, `GroupComparisonModal`. Interactivity is
inferred from `as`, `onClick` and `onHeaderClick`, with an `interactive` override
for the two rows whose control `ListRow` cannot see: `GroupListItem` is activated
by a `StretchedButton` overlay, `AppListItem` by an `onClick` on a child. The
override governs hover only — the cursor and focus ring still come from the row
element actually being a control, since a `StretchedButton` row already has both
from the button on top of it.

_`default`_, because a `selected` or `highlighted` row already carries
`border-primary` (or, when nested, a `primary-light` fill) to say so. Repainting
that on hover would make the row look _less_ selected the moment you pointed at
it — hover overriding state rather than responding to it.

One consequence worth naming: `PolicyCard` loses the hover border it had, because
only its chevron is clickable and the card is not. That is the rule working, but
it is a visible change from a card that previously hinted at an affordance it did
not have.

**`highlighted` is a strict superset of `selected`**, so a row that is both takes
`highlighted`. The two compose in the source they replaced (a selected row could
also be a deep-link target and gain a ring on top), and collapsing them the other
way would silently drop the ring.

**Two densities, not ten.** `compact` and `comfortable` are the two that carry
real information — a dense scanning list versus a rich card with badges and a
meta line. Every other value in the inventory is drift, not intent. Rows landing
between the two (`p-3`, `px-2.5 py-1.5`) round to the nearer one; that is a
visible change, and it is the point.

**Amended during migration: a third density and a second variant.** Working
through the detail and modal rows surfaced a genuinely different idiom that the
`card`-only design would have damaged rather than consolidated.

Four rows — `UserOverview`, `AuthPolicyOverview`, `BreakdownReport`,
`ClauseGroupList` — are **nested inside a card that already has a border**. They
carry no border of their own and separate on hover background instead. Giving
them `card` chrome would draw a box inside a box: a visible regression dressed up
as consistency. They also sit tighter than `compact`, because the containing card
already pays for one level of padding, so `compact` indents the content twice.

Hence `variant: 'card' | 'nested'` and `density: 'tight'`. Both clear the bar this
ADR set — four real call sites each, discovered rather than anticipated. A
`nested` row says "selected" with fill and a thinner ring, since it has no border
to say it with; the `primary-light` background is shared with `card` so the two
idioms read as the same state.

### 2. Write the row typography contract into `docs/design-system.md`

`ListRow` cannot own the interior, so the interior needs a rule the reviewer can
check:

- Primary line: `text-sm font-semibold text-neutral-900`
- Secondary line: `text-xs text-neutral-600`
- Tertiary / identifier: `font-mono text-xs text-neutral-500`
- Badge: `px-2 py-0.5 rounded-md text-xs font-medium`

This is what retires the arbitrary values the inventory found (`text-[11px]` and
`text-[10px]` in `MemberRow`, `text-[10px]` in `ComparisonTabBar`) and the
`text-neutral-800` / `text-neutral-900` split.

### 3. Sanction exactly two separator patterns

- **`space-y-3` + a bordered row** — the default, and what `ListRow` is built
  for. Six lists already use it.
- **`divide-y divide-neutral-100` inside one bordered container** — legitimate
  for a dense list that reads as a single table-like surface rather than a stack
  of cards (`ComparisonDiffTab`, `RuleImpactModal`, `UserProfileCard`).

`divide-neutral-200` and `border-b last:border-b-0` are **not** sanctioned;
they are the same two ideas spelled differently.

**Corrected: a `divide-y` row is not a `ListRow`.** This ADR originally said such
rows "pass `as="li"` and opt out of the card border" — which `ListRow` has no way
to do, and should not. In that idiom the separator belongs to the _container_, not
the row; the row is a padded `<li>` with no chrome of its own. Adding a
border-less escape hatch would hand every consumer a way out of the chrome this
ADR exists to enforce, to serve three call sites that do not want a row primitive
in the first place. Those three keep plain `<li>` elements at the sanctioned
`px-3 py-2`, and the container owns the `divide-y`.

`nested` is deliberately not that escape hatch: it still owns radius, padding,
hover and state, and it is for rows inside a card, not rows in a divided list.

### 4. Three kinds of row stay out, by decision

Found during the migration; each was attempted and rejected for a reason, not
skipped for convenience.

- **Data-viz rows** — `BreakdownReport`, `AttributeFacet`. These are proportion
  bars wearing a row's shape: absolutely-positioned fills layered under the text,
  an active state entangled with the bar colours, and a `relative` ancestor the
  bars resolve against. `ListRow` would supply padding and radius and threaten
  everything else. `docs/components.md` already lists the `AttributeFacet` spread
  bars as a custom control; `BreakdownReport` joins them.
- **A resting fill that is not a hover** — `ClauseGroupList`. Its non-interactive
  `<li>`s use `bg-neutral-50` as a _resting_ separator, and `nested` paints that
  colour only on hover, so migrating would flatten the list. Its `blocking`
  branch is worse: `nested`'s `hover:bg-neutral-50` is a variant utility and
  therefore ordered after anything passed through `className`, so a danger row
  would turn grey exactly when you pointed at it. This file wants a `danger` row
  state before it is worth migrating.
- **Table rows** — `ExportPreviewTable`'s `<tr>`. A table row is not a card, and
  `border-b` on `<tr>` is the correct idiom there.

## Consequences

- **Roughly thirty components migrate, one per PR** (the working agreement), six
  primary tab rows first — they are the ones seen side by side when switching
  tabs, which is where the user noticed the drift.
- **Visible changes ship with the migration, and are fixes rather than
  regressions.** `UserSearchResults` loses 8px of padding and its title drops
  from 16px to 14px; `RuleCard` and `PolicyCard` hover moves from
  `neutral-300` to `neutral-500`. Each PR names its own.
- **`as="button"` closes a real a11y gap** on five components. Each needs a story
  covering the new focus behaviour, and `StretchedButton` remains correct where
  the row contains its own controls (`GroupListItem`) — `ListRow` does not
  replace it.
- **The drift becomes visible again if it returns**, via a Storybook page
  rendering every migrated row at both densities. Per ADR-0023 this is the
  correct home for the check: a `toHaveClass` test is banned, so the story is the
  coverage.
- **This does not reduce line count much**, and that is not the goal. It converts
  thirty independent decisions into one, and the a11y defects into a default.
- **A row needing a third density is a signal, not a request.** Add it here only
  after two real call sites need it, or the scale drifts back to ten.
