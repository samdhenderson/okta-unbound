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

| Prop      | Values                                         | Replaces                    |
| --------- | ---------------------------------------------- | --------------------------- |
| `density` | `compact` (`px-3 py-2`), `comfortable` (`p-4`) | the ten padding values      |
| `state`   | `default`, `selected`, `highlighted`           | four selected-state recipes |
| `flash`   | boolean → `animate-affirm-flash`               | three hand-rolled copies    |
| `as`      | `div`, `li`, `a`, `button`                     | the `<div onClick>` rows    |

Fixed and **not** configurable: `rounded-md border border-neutral-200 bg-white`,
`hover:border-neutral-500`, `transition-colors duration-(--dur-instant)`, and the
focus ring when interactive. A row that wants a different hover colour is the
problem this ADR exists to solve; it does not get a prop.

**Hover applies to `default` rows only.** A `selected` or `highlighted` row
already carries `border-primary` to say so, and repainting that border on hover
would make the row look _less_ selected the moment you pointed at it — hover
overriding state rather than responding to it. The cursor and focus ring still
apply in every state, because those describe what the row _does_ rather than what
it _is_.

**`highlighted` is a strict superset of `selected`**, so a row that is both takes
`highlighted`. The two compose in the source they replaced (a selected row could
also be a deep-link target and gain a ring on top), and collapsing them the other
way would silently drop the ring.

**Two densities, not ten.** `compact` and `comfortable` are the two that carry
real information — a dense scanning list versus a rich card with badges and a
meta line. Every other value in the inventory is drift, not intent. Rows landing
between the two (`p-3`, `px-2.5 py-1.5`) round to the nearer one; that is a
visible change, and it is the point.

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
  of cards (`ComparisonDiffTab`, `RuleImpactModal`). These rows pass
  `as="li"` and opt out of the card border.

`divide-neutral-200` and `border-b last:border-b-0` are **not** sanctioned;
they are the same two ideas spelled differently.

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
